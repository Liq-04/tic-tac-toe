import { describe, expect, it } from 'vitest';
import { DEPTH, isLegal, nodeAt, play, scores, type GameState, type Mode, type Path } from '../game';
import { FastBoard, type Move } from './fastboard';
import { Rng } from './rng';
import { moveOf, oneCellFromAllTied, pathOf, put, start, turnAfter, winBoard, winLargeBoard, type Count } from './testkit';

function pop(mask: number): number {
  let n = 0;
  for (; mask; mask &= mask - 1) n++;
  return n;
}

function engineLegal(state: GameState): Move[] {
  const depth = DEPTH[state.config.mode];
  const moves: Move[] = [];
  for (let m = 0; m < 9 ** depth; m++) if (isLegal(state, pathOf(m, depth))) moves.push(m);
  return moves;
}

function expectedReward(state: GameState): number[] {
  const n = state.config.players.length;
  const status = state.status;
  if (status.kind === 'playing') throw new Error('game is not over');
  if (n === 2) {
    if (status.kind === 'draw') return [0.5, 0.5];
    return status.winners[0] === 0 ? [1, 0] : [0, 1];
  }
  const leaves = 9 ** (DEPTH[state.config.mode] - 1);
  return scores(state).map((score, p) => {
    const share =
      status.kind === 'draw' ? 1 / n : status.winners.some((w) => w === p) ? 1 / status.winners.length : 0;
    return 0.9 * share + (0.1 * score) / leaves;
  });
}

const legalBuf = new Uint16Array(729);
const scoreBuf = new Float32Array(4);

function expectAgree(real: GameState, fast: FastBoard, scan: boolean): void {
  const n = real.config.players.length;
  expect(fast.sameAs(FastBoard.fromGame(real)), 'masks, ply, zone and result match a snapshot of the engine').toBe(true);
  expect(fast.over).toBe(real.status.kind !== 'playing');
  fast.scores(scoreBuf);
  expect(Array.from(scoreBuf.subarray(0, n)), 'scores').toEqual(scores(real));
  if (real.status.kind === 'playing') {
    expect(fast.toMove, 'turn').toBe(real.turn);
    if (scan) {
      const count = fast.legalMoves(legalBuf);
      expect(Array.from(legalBuf.subarray(0, count)), 'legal set').toEqual(engineLegal(real));
    }
  } else {
    fast.reward(scoreBuf);
    const want = expectedReward(real);
    want.forEach((w, p) => expect(scoreBuf[p], `reward of seat ${p}`).toBeCloseTo(w, 5));
  }
}

const COVERAGE_KEYS = [
  'leafWon',
  'leafTied',
  'largeWon',
  'largeTied',
  'cascade',
  'rootLine2',
  'rootLine3',
  'rootLine4',
  'scoreWinner',
  'sharedWin',
  'allZeroDraw',
  'draw2p',
  'zoneLarge',
  'zoneAnywhere',
] as const;
type Coverage = Record<(typeof COVERAGE_KEYS)[number], number>;

function emptyCoverage(): Coverage {
  return Object.fromEntries(COVERAGE_KEYS.map((k) => [k, 0])) as Coverage;
}

interface Tally {
  leafWon: number;
  leafTied: number;
  largeWon: number;
  largeTied: number;
  rootWon: number;
}

function tally(fast: FastBoard): Tally {
  const { s, g, players } = fast;
  const at = (b: number) => {
    let claimed = 0;
    for (let p = 0; p < players; p++) claimed |= s[b * 5 + p] ?? 0;
    const won = pop(claimed);
    return { won, tied: pop(s[b * 5 + 4] ?? 0) - won };
  };
  const t: Tally = { leafWon: 0, leafTied: 0, largeWon: 0, largeTied: 0, rootWon: fast.winner >= 0 ? 1 : 0 };
  for (let b = 0; b < g.firstLeaf; b++) {
    if (9 * b + 1 < g.firstLeaf) continue;
    const { won, tied } = at(b);
    t.leafWon += won;
    t.leafTied += tied;
  }
  if (g.depth === 3) {
    const { won, tied } = at(0);
    t.largeWon = won;
    t.largeTied = tied;
  }
  return t;
}

function step(real: GameState, fast: FastBoard, path: Path, scan: boolean, cov = emptyCoverage()): GameState {
  const before = tally(fast);
  const next = play(real, path);
  expect(next, `move ${path.join(',')} is legal`).not.toBe(real);
  const move = moveOf(path);
  fast.play(move);
  const after = tally(fast);
  expectAgree(next, fast, scan);

  const gained = [after.leafWon > before.leafWon, after.largeWon > before.largeWon, after.rootWon > before.rootWon];
  if (gained[0]) cov.leafWon++;
  if (after.leafTied > before.leafTied) cov.leafTied++;
  if (gained[1]) cov.largeWon++;
  if (after.largeTied > before.largeTied) cov.largeTied++;
  if (gained.filter(Boolean).length >= 2) cov.cascade++;

  const status = next.status;
  const n = next.config.players.length;
  if (status.kind === 'playing') {
    const z = fast.zone;
    if (z === 0) cov.zoneAnywhere++;
    else if (z !== fast.g.nextLeaf[move]) cov.zoneLarge++;
  } else if (next.root.owner !== null) {
    cov[`rootLine${n as Count}`]++;
  } else if (status.kind === 'draw') {
    if (n === 2) cov.draw2p++;
    else cov.allZeroDraw++;
  } else if (status.winners.length > 1) {
    cov.sharedWin++;
  } else {
    cov.scoreWinner++;
  }
  return next;
}

function pickMove(fast: FastBoard, scratch: FastBoard, rng: Rng): Move {
  if (rng.below(2) === 0) return fast.randomMove(rng);
  const wins = (fb: FastBoard) => {
    const t = tally(fb);
    return t.leafWon + t.largeWon + t.rootWon;
  };
  const base = wins(fast);
  const count = fast.legalMoves(legalBuf);
  let best = 0;
  let bestMoves: Move[] = [];
  for (let i = 0; i < count; i++) {
    const move = legalBuf[i] ?? 0;
    scratch.copyFrom(fast);
    scratch.play(move);
    const gain = wins(scratch) - base;
    if (gain > best) {
      best = gain;
      bestMoves = [move];
    } else if (gain === best && gain > 0) bestMoves.push(move);
  }
  if (best === 0) return fast.randomMove(rng);
  return bestMoves[rng.below(bestMoves.length)] ?? 0;
}

function playSteeredGame(mode: Mode, count: Count, seed: number, cov: Coverage): void {
  const rng = new Rng(seed * 7919 + count * 104729 + (mode === 'omega' ? 1 : 0));
  let real = start(mode, count);
  const fast = FastBoard.fromGame(real);
  const scratch = fast.blank();
  while (real.status.kind === 'playing') {
    const scan = mode === 'ultimate' || seed <= 10 || fast.ply % 7 === 0;
    real = step(real, fast, fast.toPath(pickMove(fast, scratch, rng)), scan, cov);
  }
  expect(fast.over).toBe(true);
}

function allZeroDraw(count: Count, cov: Coverage): void {
  let real = oneCellFromAllTied(count);
  const fast = FastBoard.fromGame(real);
  expectAgree(real, fast, true);
  real = step(real, fast, [8, 8], true, cov);
  expect(real.status.kind).toBe('draw');
}

const CONFIGS = ([2, 3, 4] as const).flatMap((count) => (['ultimate', 'omega'] as const).map((mode) => [mode, count] as const));
const GAMES: Record<Mode, number> = { ultimate: 600, omega: 50 };

describe('differential test against game.ts', () => {
  it('agrees on every ply of steered random games and reaches every rule branch', () => {
    const cov = emptyCoverage();
    for (const [mode, count] of CONFIGS) {
      for (let seed = 1; seed <= GAMES[mode]; seed++) playSteeredGame(mode, count, seed, cov);
    }
    for (const count of [2, 3, 4] as const) allZeroDraw(count, cov);
    const missed = COVERAGE_KEYS.filter((k) => cov[k] === 0);
    expect(missed, `never reached: ${missed.join(', ')}`).toEqual([]);
  }, 120_000);
});

describe('hand-built positions', () => {
  it('a won Omega large board makes its small boards illegal although they are not marked closed', () => {
    const real = { ...winLargeBoard(start('omega', 2), 0, 0), zone: [] };
    const inner = nodeAt(real.root, [0, 4]);
    expect(inner.kind === 'board' && inner.closed).toBe(false);
    const fast = FastBoard.fromGame(real);
    expectAgree(real, fast, true);
    const count = fast.legalMoves(legalBuf);
    expect(Array.from(legalBuf.subarray(0, count)).some((m) => m < 81)).toBe(false);

    const next = step(real, fast, [1, 0, 4], true);
    expect(next.zone).toEqual([]);
    expect(fast.zone).toBe(0);
  });

  it('a last empty cell that completes a line gives an owner, not a tie', () => {
    let real = start('ultimate', 2);
    for (const cell of [0, 1, 5, 6]) real = put(real, 0, [0, cell]);
    for (const cell of [3, 4, 7, 8]) real = put(real, 1, [0, cell]);
    real = { ...real, zone: [] };
    const fast = FastBoard.fromGame(real);
    expectAgree(real, fast, true);
    expect(real.turn).toBe(0);

    real = step(real, fast, [0, 2], true);
    const board = nodeAt(real.root, [0]);
    expect(board.kind === 'board' && board.owner).toBe(0);
    expect(tally(fast).leafWon).toBe(1);
    expect(tally(fast).leafTied).toBe(0);
  });

  it('a claimed large board credits 9, including a small board another player won', () => {
    let real = winBoard(start('omega', 3), [0, 5], 1);
    real = winLargeBoard(real, 0, 0);
    expect(scores(real)).toEqual([9, 0, 0]);
    const fast = FastBoard.fromGame({ ...real, zone: [] });
    expectAgree({ ...real, zone: [] }, fast, true);
    fast.scores(scoreBuf);
    expect(Array.from(scoreBuf.subarray(0, 3))).toEqual([9, 0, 0]);
  });

  it.each([3, 4] as const)('a top-level line ends a %i-player game with the turn unchanged and no zone', (count) => {
    const winner = turnAfter('ultimate', count, 8);
    let real = winBoard(winBoard(start('ultimate', count), [0], winner), [1], winner);
    real = put(put(real, winner, [2, 0]), winner, [2, 1]);
    real = { ...real, zone: [] };
    const fast = FastBoard.fromGame(real);
    expectAgree(real, fast, true);
    expect(real.turn).toBe(winner);

    real = step(real, fast, [2, 2], true);
    expect(real.status).toEqual({ kind: 'won', winners: [winner] });
    expect(real.turn).toBe(winner);
    expect(real.zone).toEqual([]);
    expect(fast.over).toBe(true);
    expect(fast.zone).toBe(0);
    expect(fast.winner).toBe(winner);
    fast.reward(scoreBuf);
    expect(scoreBuf[winner]).toBeCloseTo(1, 5);
  });

  it('one Omega move can win a small board, a large board and the game', () => {
    const marks = 9 + 9 + 6 + 2;
    const winner = turnAfter('omega', 2, marks);
    let real = winLargeBoard(winLargeBoard(start('omega', 2), 0, winner), 1, winner);
    real = winBoard(winBoard(real, [2, 0], winner), [2, 1], winner);
    real = put(put(real, winner, [2, 2, 0]), winner, [2, 2, 1]);
    real = { ...real, zone: [] };
    const fast = FastBoard.fromGame(real);
    expectAgree(real, fast, true);
    expect(real.turn).toBe(winner);

    const before = tally(fast);
    real = step(real, fast, [2, 2, 2], true);
    const after = tally(fast);
    expect(real.status).toEqual({ kind: 'won', winners: [winner] });
    expect([after.leafWon - before.leafWon, after.largeWon - before.largeWon, after.rootWon - before.rootWon]).toEqual([1, 1, 1]);
  });
});

describe('FastBoard', () => {
  it('copyFrom and blank give independent boards with the same shape', () => {
    const real = play(start('omega', 3), [4, 4, 4]);
    const fast = FastBoard.fromGame(real);
    const copy = fast.blank();
    expect(copy.sameAs(fast)).toBe(false);
    copy.copyFrom(fast);
    expect(copy.sameAs(fast)).toBe(true);
    copy.play(copy.randomMove(new Rng(1)));
    expect(copy.sameAs(fast)).toBe(false);
    expect(fast.sameAs(FastBoard.fromGame(real))).toBe(true);
  });

  it.each(['ultimate', 'omega'] as const)('%s: randomMove is uniform over the open boards', (mode) => {
    const base = mode === 'omega' ? winLargeBoard(start('omega', 2), 0, 0) : winBoard(start('ultimate', 2), [0], 0);
    const real = { ...base, zone: [] };
    const fast = FastBoard.fromGame(real);
    const legal = engineLegal(real);
    const rng = new Rng(99);
    const draws = legal.length * 300;
    const hits = new Map<Move, number>();
    for (let i = 0; i < draws; i++) {
      const m = fast.randomMove(rng);
      hits.set(m, (hits.get(m) ?? 0) + 1);
    }
    expect([...hits.keys()].sort((a, b) => a - b)).toEqual(legal);
    for (const count of hits.values()) expect(count).toBeGreaterThan(300 * 0.55);
    for (const count of hits.values()) expect(count).toBeLessThan(300 * 1.6);
  });
});
