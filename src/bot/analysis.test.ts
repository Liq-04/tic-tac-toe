import { describe, expect, it } from 'vitest';
import { play, type GameState, type Mode, type Path } from '../game';
import { roundChances } from './analysis';
import { FastBoard } from './fastboard';
import { Rng } from './rng';
import { start, type Count } from './testkit';

function randomGame(mode: Mode, count: Count, seed: number, stop: (s: GameState) => boolean = () => false): GameState {
  const rng = new Rng(seed);
  let state = start(mode, count);
  while (state.status.kind === 'playing' && !stop(state)) {
    const fast = FastBoard.fromGame(state);
    state = play(state, fast.toPath(fast.randomMove(rng)));
  }
  return state;
}

const analyse = (state: GameState) => [...roundChances(state.config, state.history ?? [])];
const total = (chances: readonly number[]) => chances.reduce((a, b) => a + b, 0);

function finishedWith(count: Count, wanted: (s: GameState) => boolean): GameState {
  for (let seed = 1; seed < 2000; seed++) {
    const state = randomGame('ultimate', count, seed);
    if (wanted(state)) return state;
  }
  throw new Error('no such game found');
}

describe('roundChances', () => {
  it.each([2, 3, 4] as const)('%i players: covers the start and every round, with valid chances', (count) => {
    const state = randomGame('ultimate', count, 5);
    const results = analyse(state);
    const rounds = Math.ceil((state.history ?? []).length / count);
    expect(results.map((r) => r.round)).toEqual(Array.from({ length: rounds + 1 }, (_, i) => i));
    for (const { chances } of results) {
      expect(chances).toHaveLength(count);
      for (const c of chances) expect(c).toBeGreaterThanOrEqual(0);
      expect(total(chances)).toBeLessThanOrEqual(1 + 1e-6);
    }
  });

  it('ends on the result: a sole win, a win cut short mid-round, a shared win and a draw', () => {
    const last = (state: GameState) => analyse(state).at(-1)?.chances;
    const soleMidRound = finishedWith(
      3,
      (s) => s.status.kind === 'won' && s.status.winners.length === 1 && (s.history ?? []).length % 3 !== 0,
    );
    const sole = soleMidRound.status.kind === 'won' ? soleMidRound.status.winners[0] : undefined;
    expect(last(soleMidRound)).toEqual([0, 1, 2].map((seat) => (seat === sole ? 1 : 0)));

    const shared = finishedWith(3, (s) => s.status.kind === 'won' && s.status.winners.length === 2);
    const winners: readonly number[] = shared.status.kind === 'won' ? shared.status.winners : [];
    expect(last(shared)).toEqual([0, 1, 2].map((seat) => (winners.includes(seat) ? 0.5 : 0)));

    expect(last(finishedWith(2, (s) => s.status.kind === 'draw'))).toEqual([0, 0]);
  });

  it('gives a player who can win at once a chance above 90%', () => {
    const winsNext = (s: GameState) =>
      s.turn === 0 &&
      (s.history ?? []).length > 0 &&
      Array.from({ length: 81 }, (_, m): Path => [Math.floor(m / 9), m % 9]).some((path) => {
        const { status } = play(s, path);
        return status.kind === 'won' && status.winners[0] === 0;
      });
    const state = randomGame('ultimate', 2, 3, winsNext);
    expect(state.status.kind).toBe('playing');
    expect(analyse(state).at(-1)?.chances[0]).toBeGreaterThan(0.9);
  });

  it('gives the same answer every time', () => {
    const state = randomGame('ultimate', 3, 8);
    expect(analyse(state)).toEqual(analyse(state));
  });

  it('covers a full Omega game', () => {
    const state = randomGame('omega', 4, 2);
    const results = analyse(state);
    expect(results).toHaveLength(Math.ceil((state.history ?? []).length / 4) + 1);
  }, 60_000);

  it('rejects a recorded game with an illegal move', () => {
    const { config } = start('ultimate', 2);
    expect(() => [...roundChances(config, [[4, 4], [0, 0]])]).toThrow('illegal');
  });
});
