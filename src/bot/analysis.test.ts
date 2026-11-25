import { describe, expect, it } from 'vitest';
import { isLegal, play, type GameState, type Mode, type Path } from '../game';
import { judge, reviewGame } from './analysis';
import { FastBoard } from './fastboard';
import { Rng } from './rng';
import { start, type Count } from './testkit';

const never = () => false;

function randomGame(mode: Mode, count: Count, seed: number, stop: (s: GameState) => boolean = never): GameState {
  const rng = new Rng(seed);
  let state = start(mode, count);
  while (state.status.kind === 'playing' && !stop(state)) {
    const fast = FastBoard.fromGame(state);
    state = play(state, fast.toPath(fast.randomMove(rng)));
  }
  return state;
}

const analyse = (state: GameState) => [...reviewGame(state.config, state.history ?? [], 3000)];
const total = (chances: readonly number[]) => chances.reduce((a, b) => a + b, 0);

function finishedWith(count: Count, wanted: (s: GameState) => boolean): GameState {
  return gameWith(count, never, wanted);
}

function gameWith(count: Count, stop: (s: GameState) => boolean, wanted: (s: GameState) => boolean): GameState {
  for (let seed = 1; seed < 2000; seed++) {
    const state = randomGame('ultimate', count, seed, stop);
    if (wanted(state)) return state;
  }
  throw new Error('no such game found');
}

describe('reviewGame', () => {
  it.each([2, 3, 4] as const)('%i players: covers the start and every move, with valid chances', (count) => {
    const state = randomGame('ultimate', count, 5);
    const results = analyse(state);
    const moves = (state.history ?? []).length;
    expect(results.map((r) => r.ply)).toEqual(Array.from({ length: moves + 1 }, (_, i) => i));
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

  it('calls a thrown-away win a blunder and offers the winning move', () => {
    const wins = (s: GameState, path: Path) => {
      const { status } = play(s, path);
      return status.kind === 'won' && status.winners[0] === s.turn;
    };
    const cells = Array.from({ length: 81 }, (_, m): Path => [Math.floor(m / 9), m % 9]);
    const canWin = (s: GameState) => cells.some((path) => wins(s, path));
    const givesAway = (s: GameState) =>
      cells.find((path) => {
        const after = play(s, path);
        return isLegal(s, path) && after.status.kind === 'playing' && canWin(after);
      });
    const blundersNext = (s: GameState) => s.status.kind === 'playing' && canWin(s) && givesAway(s) !== undefined;
    const state = gameWith(2, blundersNext, blundersNext);
    const thrownAway = givesAway(state);
    expect(thrownAway).toBeDefined();
    const last = analyse(play(state, thrownAway ?? [])).at(-1);
    expect(last?.verdict).toMatchObject({ kind: 'blunder', better: { chance: 1 } });
    const better = last?.verdict?.kind === 'blunder' ? last.verdict.better.path : [];
    expect(wins(state, better)).toBe(true);
  });

  it('calls the only move that punishes a blunder great', () => {
    const recorded =
      '21 16 66 62 26 65 51 17 75 53 35 54 48 87 76 61 11 15 52 23 31 13 37 77 74 47 73 38 82 25 50 06 68 86 60 08 80 04 44 43 33 30 07 88 10 00 32 22 27 24 40 12 63 34';
    const history = recorded.split(' ').map((move): Path => [Number(move[0]), Number(move[1])]);
    const [blunder, reply] = [...reviewGame(start('ultimate', 2).config, history, 3000)].slice(-2);
    expect(blunder?.verdict?.kind).toBe('blunder');
    expect(blunder?.chances[0]).toBeLessThan(0.1);
    expect(reply?.verdict?.kind).toBe('great');
    expect(reply?.chances[1]).toBeGreaterThan(0.9);
    expect(reply?.verdict?.kind === 'great' && reply.verdict.next.chance).toBeLessThan(0.1);
  });

  it('does not call the move that ends the game great', () => {
    const state = finishedWith(2, (s) => s.status.kind === 'won');
    expect(analyse(state).at(-1)?.verdict).toBeNull();
  });

  it('has no verdict on a move that was the only legal one', () => {
    const onlyOne = (s: GameState) =>
      s.status.kind === 'playing' && FastBoard.fromGame(s).legalMoves(new Uint16Array(81)) === 1;
    const state = gameWith(2, onlyOne, onlyOne);
    const fast = FastBoard.fromGame(state);
    const forced = play(state, fast.toPath(fast.randomMove(new Rng(1))));
    expect(analyse(forced).at(-1)?.verdict).toBeNull();
  });

  it('gives the same answer every time', () => {
    const state = randomGame('ultimate', 3, 8);
    expect(analyse(state)).toEqual(analyse(state));
  });

  it('covers a full Omega game', () => {
    const state = randomGame('omega', 4, 2);
    expect([...reviewGame(state.config, state.history ?? [], 500)]).toHaveLength((state.history ?? []).length + 1);
  }, 120_000);

  it('rejects a recorded game with an illegal move', () => {
    const { config } = start('ultimate', 2);
    expect(() => [...reviewGame(config, [[4, 4], [0, 0]])]).toThrow('illegal');
  });
});

describe('judge', () => {
  const other = (chance: number) => ({ path: [4, 4], chance });

  it('calls a big drop a blunder only when another move was far better', () => {
    expect(judge(0.6, 0.4, other(0.62))).toEqual({ kind: 'blunder', better: other(0.62) });
    expect(judge(0.6, 0.4, other(0.44))).toBeNull();
  });

  it('calls a flat or rising move a missed chance when another move was far better', () => {
    expect(judge(0.6, 0.6, other(0.8))).toEqual({ kind: 'missed', better: other(0.8) });
    expect(judge(0.4, 0.6, other(0.9))).toEqual({ kind: 'missed', better: other(0.9) });
  });

  it('calls a move great only when it was far better than the next best and cost nothing', () => {
    expect(judge(0.4, 0.6, other(0.3))).toEqual({ kind: 'great', next: other(0.3) });
    expect(judge(0.4, 0.6, other(0.55))).toBeNull();
    expect(judge(0.6, 0.4, other(0.2))).toBeNull();
  });

  it('has nothing to say about small gaps', () => {
    expect(judge(0.5, 0.46, other(0.53))).toBeNull();
    expect(judge(0.5, 0.54, other(0.5))).toBeNull();
  });
});
