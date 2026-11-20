import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { newGame, play, type GameState } from '../game';
import { botTurn } from './index';

describe('import boundary', () => {
  it('UI code reaches the bot only through its index', () => {
    const files = import.meta.glob('../ui/**/*.{ts,tsx}', { query: '?raw', import: 'default', eager: true });
    expect(Object.keys(files).length).toBeGreaterThan(5);
    const deep = Object.entries(files).flatMap(([file, source]) =>
      [...String(source).matchAll(/['"]([^'"]*\/bot\/[^'"]*)['"]/g)].map((m) => `${file} imports ${m[1]}`),
    );
    expect(deep).toEqual([]);
  });
});

class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onerror: unknown = null;
  posted: unknown[] = [];
  terminated = false;

  constructor() {
    FakeWorker.made.push(this);
  }

  postMessage(message: unknown) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }
}

function botToMove(): GameState {
  const start = newGame({ mode: 'ultimate', players: [{ name: 'You' }, { name: 'Bot', bot: true }] });
  return play(start, [4, 4]);
}

describe('botTurn', () => {
  beforeEach(() => {
    FakeWorker.made = [];
    vi.stubGlobal('Worker', FakeWorker);
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  const reply = (path: number[]) => FakeWorker.made[0]?.onmessage?.({ data: { path, iterations: 1 } });

  it('does nothing when a human is to move or the game is over', () => {
    const onMove = vi.fn();
    const fresh = newGame({ mode: 'ultimate', players: [{ name: 'You' }, { name: 'Bot', bot: true }] });
    botTurn(fresh, onMove)();
    botTurn({ ...botToMove(), status: { kind: 'draw' } }, onMove)();
    expect(FakeWorker.made).toHaveLength(0);
    expect(onMove).not.toHaveBeenCalled();
  });

  it('asks one worker, then applies its legal reply once after the minimum turn time', () => {
    const onMove = vi.fn();
    const state = botToMove();
    botTurn(state, onMove);
    expect(FakeWorker.made).toHaveLength(1);
    expect(FakeWorker.made[0]?.posted).toEqual([expect.objectContaining({ state, budgetMs: 1000 })]);

    reply([4, 0]);
    expect(FakeWorker.made[0]?.terminated).toBe(true);
    vi.advanceTimersByTime(399);
    expect(onMove).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onMove).toHaveBeenCalledExactlyOnceWith([4, 0]);
    vi.advanceTimersByTime(5000);
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('never calls onMove after cancel, before or after the reply', () => {
    const early = vi.fn();
    botTurn(botToMove(), early)();
    expect(FakeWorker.made[0]?.terminated).toBe(true);
    reply([4, 0]);
    vi.advanceTimersByTime(5000);
    expect(early).not.toHaveBeenCalled();

    FakeWorker.made = [];
    const late = vi.fn();
    const cancel = botTurn(botToMove(), late);
    reply([4, 0]);
    cancel();
    vi.advanceTimersByTime(5000);
    expect(late).not.toHaveBeenCalled();
  });

  it('rejects a reply that is not a legal move for the state', () => {
    const onMove = vi.fn();
    botTurn(botToMove(), onMove);
    expect(() => reply([5, 5])).toThrow('illegal');
    vi.advanceTimersByTime(5000);
    expect(onMove).not.toHaveBeenCalled();
  });
});
