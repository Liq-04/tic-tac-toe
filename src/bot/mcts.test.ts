import { describe, expect, it } from 'vitest';
import { isLegal, play, type GameState, type Mode, type PlayerId } from '../game';
import { FastBoard } from './fastboard';
import { chooseMove, search, type Budget } from './mcts';
import { Rng } from './rng';
import { oneCellFromAllTied, put, start, TIE_PATTERN, turnAfter, winBoard, type Count } from './testkit';

const CONFIGS = ([2, 3, 4] as const).flatMap((count) => (['ultimate', 'omega'] as const).map((mode) => [mode, count] as const));

const iterations = (n: number): Budget => ({ kind: 'iterations', n });

function randomMove(state: GameState, rng: Rng) {
  const fast = FastBoard.fromGame(state);
  return fast.toPath(fast.randomMove(rng));
}

describe('chooseMove', () => {
  it.each(CONFIGS)('%s, %i players: returns a legal move at every checked ply of random games', (mode, count) => {
    const every = mode === 'ultimate' ? 1 : 25;
    const games = mode === 'ultimate' ? 6 : 1;
    for (let game = 0; game < games; game++) {
      const rng = new Rng(game + 11);
      let state = start(mode, count);
      for (let ply = 0; state.status.kind === 'playing'; ply++) {
        if (ply % every === 0) {
          const { path } = chooseMove(state, { seed: ply, budget: iterations(50) });
          expect(isLegal(state, path), `ply ${ply}`).toBe(true);
        }
        state = play(state, randomMove(state, rng));
      }
    }
  });

  it.each(CONFIGS)('%s, %i players: bots playing every seat finish the game', (mode, count) => {
    let state = start(mode, count);
    for (let ply = 0; state.status.kind === 'playing'; ply++) {
      const { path } = chooseMove(state, { seed: ply, budget: iterations(mode === 'omega' ? 20 : 50) });
      const next = play(state, path);
      expect(next, `ply ${ply}`).not.toBe(state);
      state = next;
    }
    expect(state.status.kind).not.toBe('playing');
  });

  it('the same state, seed and iteration budget give the same path', () => {
    const state = play(start('ultimate', 3), [4, 4]);
    const a = chooseMove(state, { seed: 7, budget: iterations(300) });
    const b = chooseMove(state, { seed: 7, budget: iterations(300) });
    expect(a).toEqual(b);
  });

  it('answers a forced move at once, without searching', () => {
    const state = oneCellFromAllTied(3);
    expect(chooseMove(state, { seed: 1, budget: iterations(1000) })).toEqual({ path: [8, 8], iterations: 0 });
  });

  it('throws on a finished game', () => {
    const finished = play(oneCellFromAllTied(2), [8, 8]);
    expect(finished.status.kind).toBe('draw');
    expect(() => chooseMove(finished, { seed: 1, budget: iterations(10) })).toThrow();
  });

  it('a time budget returns a legal move after at least one iteration', () => {
    const state = start('omega', 4);
    const { path, iterations: done } = chooseMove(state, { seed: 3, budget: { kind: 'time', ms: 30 } });
    expect(isLegal(state, path)).toBe(true);
    expect(done).toBeGreaterThan(0);
  });

  it('stops expanding when the node pool is full and still returns a legal move', () => {
    for (const [mode, count] of [['ultimate', 2], ['omega', 3]] as const) {
      const state = start(mode, count);
      const board = FastBoard.fromGame(state);
      const result = search(board, new Rng(5), iterations(3000), 300);
      expect(result.iterations).toBe(3000);
      expect(isLegal(state, board.toPath(result.move))).toBe(true);
    }
  });
});

describe('terminal rewards', () => {
  const reward = (state: GameState) => {
    const fast = FastBoard.fromGame(state);
    expect(fast.over).toBe(true);
    const out = new Float32Array(4);
    fast.reward(out);
    return Array.from(out.subarray(0, state.config.players.length));
  };

  const allOwned = (count: Count, change?: [board: number, owner: PlayerId]) => {
    const owners = TIE_PATTERN.map((owner, board) => (change?.[0] === board ? change[1] : owner));
    return owners.reduce((s, owner, board) => winBoard(s, [board], owner), start('ultimate', count));
  };

  const rootLine = (count: Count, winner: PlayerId) =>
    [0, 1, 2].reduce((s, board) => winBoard(s, [board], winner), start('ultimate', count));

  it('2 players: win 1 / 0, loss 0 / 1, draw 0.5 each', () => {
    expect(reward(rootLine(2, 0))).toEqual([1, 0]);
    expect(reward(rootLine(2, 1))).toEqual([0, 1]);
    expect(reward(play(oneCellFromAllTied(2), [8, 8]))).toEqual([0.5, 0.5]);
  });

  it('3 players: a root line is worth exactly 1 to its owner', () => {
    expect(reward(rootLine(3, 2))).toEqual([0, 0, 1]);
  });

  it('3 players: a sole winner on boards takes 0.9 plus a tenth of their board share', () => {
    const state = allOwned(3);
    expect(state.status).toEqual({ kind: 'won', winners: [0] });
    const [a, b, c] = reward(state);
    expect(a).toBeCloseTo(0.9 + (0.1 * 5) / 9, 5);
    expect(b).toBeCloseTo((0.1 * 4) / 9, 5);
    expect(c).toBe(0);
  });

  it('3 players: a two-way tie splits the win share', () => {
    const state = allOwned(3, [8, 2]);
    expect(state.status).toEqual({ kind: 'won', winners: [0, 1] });
    const [a, b, c] = reward(state);
    expect(a).toBeCloseTo(0.45 + (0.1 * 4) / 9, 5);
    expect(b).toBeCloseTo(0.45 + (0.1 * 4) / 9, 5);
    expect(c).toBeCloseTo(0.1 / 9, 5);
  });

  it('3 and 4 players: a board nobody scores on gives every seat 0.9 / n', () => {
    for (const count of [3, 4] as const) {
      const state = play(oneCellFromAllTied(count), [8, 8]);
      expect(state.status.kind).toBe('draw');
      for (const r of reward(state)) expect(r).toBeCloseTo(0.9 / count, 5);
    }
  });
});

describe('tactics', () => {
  function oneMoveFromWin(count: Count, seat: PlayerId): GameState {
    const real = [0, 1].reduce((s, board) => winBoard(s, [board], seat), start('ultimate', count));
    return { ...put(put(real, seat, [2, 0]), seat, [2, 1]), zone: [] };
  }

  it.each([2, 3] as const)('takes a top-level line that is one move away, with %i players', (count) => {
    const seat = turnAfter('ultimate', count, 8);
    expect(seat).toBe(count === 2 ? 0 : 2);
    const state = oneMoveFromWin(count, seat);
    expect(state.turn).toBe(seat);
    expect(chooseMove(state, { seed: 4, budget: iterations(20_000) }).path).toEqual([2, 2]);
  });
});

describe('strength against uniform random play', () => {
  interface Outcome {
    sole: number;
    shared: number;
    draw: number;
    loss: number;
  }

  function match(mode: Mode, count: Count, budget: number, games: number): Outcome {
    const out: Outcome = { sole: 0, shared: 0, draw: 0, loss: 0 };
    let botMoves = 0;
    for (let g = 0; g < games; g++) {
      const botSeat = g % count;
      const rng = new Rng(g * 31 + 5);
      let state = start(mode, count);
      while (state.status.kind === 'playing') {
        const path =
          state.turn === botSeat
            ? chooseMove(state, { seed: g * 1000 + botMoves++, budget: iterations(budget) }).path
            : randomMove(state, rng);
        state = play(state, path);
      }
      const status = state.status;
      if (status.kind === 'draw') out.draw++;
      else if (status.kind === 'won' && status.winners.some((w) => w === botSeat)) {
        if (status.winners.length === 1) out.sole++;
        else out.shared++;
      } else out.loss++;
    }
    return out;
  }

  it('ultimate, 2 players: wins at least 36 of 40', () => {
    expect(match('ultimate', 2, 200, 40).sole).toBeGreaterThanOrEqual(36);
  });

  it('ultimate, 3 players: wins or shares at least 24 of 30', () => {
    const r = match('ultimate', 3, 200, 30);
    expect(r.sole + r.shared).toBeGreaterThanOrEqual(24);
  });

  it('ultimate, 4 players: wins or shares at least 30 of 40', () => {
    const r = match('ultimate', 4, 200, 40);
    expect(r.sole + r.shared).toBeGreaterThanOrEqual(30);
  });

  it('omega, 2 players: wins at least 3 of 4', () => {
    expect(match('omega', 2, 100, 4).sole).toBeGreaterThanOrEqual(3);
  });

  it('omega, 3 players: wins or shares at least 2 of 3', () => {
    const r = match('omega', 3, 100, 3);
    expect(r.sole + r.shared).toBeGreaterThanOrEqual(2);
  });

  it('omega, 4 players: wins or shares at least 3 of 4', () => {
    const r = match('omega', 4, 100, 4);
    expect(r.sole + r.shared).toBeGreaterThanOrEqual(3);
  });
});
