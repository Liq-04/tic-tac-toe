import { describe, expect, it } from 'vitest';
import {
  isInZone,
  isLegal,
  newGame,
  nodeAt,
  play,
  roundOf,
  scores,
  type GameState,
  type Mode,
  type Path,
  type PlayerId,
} from './index';

function start(mode: Mode, playerCount: 2 | 3 | 4): GameState {
  return newGame({
    mode,
    players: Array.from({ length: playerCount }, (_, i) => ({ name: `P${i + 1}` })),
  });
}

function playAll(state: GameState, moves: Path[]): GameState {
  return moves.reduce((s, move) => {
    const next = play(s, move);
    expect(next, `move ${move.join(',')} should be legal`).not.toBe(s);
    return next;
  }, state);
}

/** Places a mark for `player` regardless of turn order or zone, to set up a position. */
function put(state: GameState, player: PlayerId, path: Path): GameState {
  const next = play({ ...state, turn: player, zone: [] }, path);
  expect(next.lastMove, `setup move ${path.join(',')} should be legal`).toEqual(path);
  return next;
}

function ownerOf(state: GameState, prefix: Path) {
  const node = nodeAt(state.root, prefix);
  if (node.kind !== 'board') throw new Error('not a board');
  return node.owner;
}

function winUltimateBoard(state: GameState, board: number, player: PlayerId): GameState {
  return [0, 1, 2].reduce((s, cell) => put(s, player, [board, cell]), state);
}

function winOmegaLeaf(state: GameState, prefix: Path, player: PlayerId): GameState {
  return [0, 1, 2].reduce((s, cell) => put(s, player, [...prefix, cell]), state);
}

function fillUltimateBoards(state: GameState, owners: PlayerId[]): GameState {
  return owners.reduce((s, owner, board) => winUltimateBoard(s, board, owner), state);
}

describe('forwarding', () => {
  it('ultimate: a move at [s, c] sends the next player to small board c', () => {
    const s0 = start('ultimate', 2);
    expect(s0.zone).toEqual([]);
    const s1 = play(s0, [4, 2]);
    expect(s1.turn).toBe(1);
    expect(s1.zone).toEqual([2]);
    expect(isLegal(s1, [2, 7])).toBe(true);
    expect(isLegal(s1, [3, 7])).toBe(false);
    const s2 = play(s1, [2, 7]);
    expect(s2.turn).toBe(0);
    expect(s2.zone).toEqual([7]);
  });

  it('omega: a move at [m, s, c] sends the next player to small board c of large board s', () => {
    const s1 = play(start('omega', 2), [0, 1, 2]);
    expect(s1.zone).toEqual([1, 2]);
    expect(isLegal(s1, [1, 2, 8])).toBe(true);
    expect(isLegal(s1, [1, 3, 8])).toBe(false);
    expect(isLegal(s1, [0, 2, 8])).toBe(false);
  });

  it('cycles turns through all players', () => {
    let s = start('ultimate', 4);
    s = playAll(s, [
      [0, 0],
      [0, 1],
      [1, 1],
      [1, 2],
    ]);
    expect(s.turn).toBe(0);
    expect(nodeAt(s.root, [0, 1])).toEqual({ kind: 'cell', mark: 1 });
    expect(nodeAt(s.root, [1, 2])).toEqual({ kind: 'cell', mark: 3 });
  });
});

describe('small-board win', () => {
  it('ultimate: three in a row claims the small board for the mover', () => {
    const s = playAll(start('ultimate', 2), [
      [0, 4],
      [4, 0],
      [0, 1],
      [1, 0],
      [0, 7],
    ]);
    expect(ownerOf(s, [0])).toBe(0);
    expect(ownerOf(s, [])).toBeNull();
    expect(s.status).toEqual({ kind: 'playing' });
    expect(s.zone).toEqual([7]);
  });

  it('a won board accepts no more moves, even in empty cells', () => {
    const s = winUltimateBoard(start('ultimate', 2), 0, 0);
    expect(isLegal({ ...s, zone: [], turn: 1 }, [0, 5])).toBe(false);
  });
});

describe('fallback when the target board is closed', () => {
  const wonBoardZero = playAll(start('ultimate', 2), [
    [0, 4],
    [4, 0],
    [0, 1],
    [1, 0],
    [0, 7],
  ]);

  it('ultimate: sending the opponent to a closed board lets them play anywhere', () => {
    const s = play(wonBoardZero, [7, 0]);
    expect(s.turn).toBe(0);
    expect(s.zone).toEqual([]);
    expect(isLegal(s, [8, 8])).toBe(true);
    expect(isLegal(s, [5, 5])).toBe(true);
    expect(isLegal(s, [0, 2])).toBe(false);
  });

  it('ultimate: a full small board with no winner is also closed', () => {
    // Fill board 0 with a drawn pattern: X O X / X O O / O X X
    const marks: PlayerId[] = [0, 1, 0, 0, 1, 1, 1, 0, 0];
    const s = marks.reduce((acc, mark, cell) => put(acc, mark, [0, cell]), start('ultimate', 2));
    expect(ownerOf(s, [0])).toBeNull();
    expect(nodeAt(s.root, [0])).toMatchObject({ closed: true });
    const next = put(s, 1, [3, 0]);
    expect(next.zone).toEqual([]);
  });

  it('omega: a closed small board falls back to the whole large board', () => {
    let s = winOmegaLeaf(start('omega', 2), [3, 5], 0);
    s = play({ ...s, turn: 1, zone: [] }, [7, 3, 5]);
    expect(s.zone).toEqual([3]);
    expect(isLegal(s, [3, 0, 0])).toBe(true);
    expect(isLegal(s, [3, 4, 8])).toBe(true);
    expect(isLegal(s, [3, 5, 4])).toBe(false);
    expect(isLegal(s, [4, 0, 0])).toBe(false);
  });

  it('omega: a closed large board falls back to anywhere', () => {
    let s = start('omega', 2);
    for (const leaf of [0, 1, 2]) s = winOmegaLeaf(s, [3, leaf], 0);
    expect(ownerOf(s, [3])).toBe(0);
    s = play({ ...s, turn: 1, zone: [] }, [7, 3, 5]);
    expect(s.zone).toEqual([]);
    expect(isLegal(s, [4, 4, 4])).toBe(true);
    expect(isLegal(s, [3, 4, 4])).toBe(false);
  });
});

describe('game end, 2 players', () => {
  it('three small boards in a row on the top board wins and ends the game', () => {
    const s = fillUltimateBoardsRow(start('ultimate', 2));
    expect(ownerOf(s, [])).toBe(0);
    expect(s.status).toEqual({ kind: 'won', winners: [0] });
    expect(isLegal(s, [5, 5])).toBe(false);
    expect(play(s, [5, 5])).toBe(s);
  });

  it('a top board that fills with no line is a draw', () => {
    const owners: PlayerId[] = [0, 1, 0, 0, 1, 1, 1, 0, 0];
    const s = fillUltimateBoards(start('ultimate', 2), owners);
    expect(ownerOf(s, [])).toBeNull();
    expect(s.status).toEqual({ kind: 'draw' });
  });

  it('omega: three large boards in a row wins', () => {
    let s = start('omega', 2);
    for (const large of [0, 1, 2]) {
      for (const leaf of [0, 1, 2]) s = winOmegaLeaf(s, [large, leaf], 1);
    }
    expect(s.status).toEqual({ kind: 'won', winners: [1] });
  });
});

describe('claim rule, 3-4 players', () => {
  it('omega: winning a large board scores 9 and wipes other players boards inside it', () => {
    let s = start('omega', 3);
    s = winOmegaLeaf(s, [3, 3], 1);
    expect(scores(s)).toEqual([0, 1, 0]);

    s = winOmegaLeaf(s, [3, 0], 0);
    s = winOmegaLeaf(s, [3, 1], 0);
    expect(scores(s)).toEqual([2, 1, 0]);

    s = winOmegaLeaf(s, [3, 2], 0);
    expect(ownerOf(s, [3])).toBe(0);
    expect(scores(s)).toEqual([9, 0, 0]);
    expect(s.status).toEqual({ kind: 'playing' });
  });

  it('claimed large boards accept no further moves', () => {
    let s = start('omega', 3);
    for (const leaf of [0, 1, 2]) s = winOmegaLeaf(s, [3, leaf], 0);
    expect(isLegal({ ...s, turn: 1, zone: [] }, [3, 4, 4])).toBe(false);
  });

  it('ultimate: each small board is 1 point', () => {
    let s = start('ultimate', 4);
    s = winUltimateBoard(s, 0, 2);
    s = winUltimateBoard(s, 4, 2);
    s = winUltimateBoard(s, 8, 3);
    expect(scores(s)).toEqual([0, 0, 2, 1]);
  });

  it('owning the top board ends the game for its owner', () => {
    const s = fillUltimateBoardsRow(start('ultimate', 3), 2);
    expect(s.status).toEqual({ kind: 'won', winners: [2] });
    expect(scores(s)).toEqual([0, 0, 9]);
  });

  it('a full top board with tied scores gives a shared win', () => {
    const owners: PlayerId[] = [0, 1, 2, 0, 1, 2, 1, 2, 0];
    const s = fillUltimateBoards(start('ultimate', 3), owners);
    expect(scores(s)).toEqual([3, 3, 3]);
    expect(s.status).toEqual({ kind: 'won', winners: [0, 1, 2] });
  });

  it('a full top board with a unique leader names that player', () => {
    const owners: PlayerId[] = [0, 1, 2, 0, 1, 2, 1, 2, 1];
    const s = fillUltimateBoards(start('ultimate', 3), owners);
    expect(scores(s)).toEqual([2, 4, 3]);
    expect(s.status).toEqual({ kind: 'won', winners: [1] });
  });
});

describe('illegal moves leave state unchanged', () => {
  const s = play(start('ultimate', 2), [4, 2]);

  it.each<[string, Path]>([
    ['outside the zone', [3, 3]],
    ['too short', [2]],
    ['too long', [2, 3, 4]],
    ['digit out of range', [2, 9]],
    ['negative digit', [2, -1]],
    ['fractional digit', [2, 1.5]],
  ])('%s', (_, path) => {
    expect(isLegal(s, path)).toBe(false);
    expect(play(s, path)).toBe(s);
  });

  it('an occupied cell', () => {
    const after = playAll(s, [[2, 4]]);
    const back = play({ ...after, zone: [] }, [2, 4]);
    expect(back.root).toBe(after.root);
    expect(back.turn).toBe(after.turn);
  });
});

describe('isInZone', () => {
  it('marks only the forwarded board while playing', () => {
    const s = play(start('ultimate', 2), [4, 2]);
    expect(isInZone(s, [2])).toBe(true);
    expect(isInZone(s, [3])).toBe(false);
  });

  it('covers every open board when the zone is anywhere', () => {
    const s = start('omega', 2);
    expect(isInZone(s, [3, 4])).toBe(true);
    expect(isInZone(s, [3])).toBe(true);
  });
});

function fillUltimateBoardsRow(state: GameState, player: PlayerId = 0): GameState {
  return [0, 1, 2].reduce((s, board) => winUltimateBoard(s, board, player), state);
}

const SCHEDULE_4: PlayerId[][] = [
  [0, 1, 2, 3],
  [0, 2, 3, 1],
  [0, 3, 1, 2],
  [0, 1, 3, 2],
  [0, 2, 1, 3],
  [0, 3, 2, 1],
];

function firstLegal(state: GameState): Path {
  for (let a = 0; a < 9; a++) {
    for (let b = 0; b < 9; b++) {
      if (isLegal(state, [a, b])) return [a, b];
    }
  }
  throw new Error('no legal move');
}

function turnSequence(playerCount: 2 | 3 | 4, moves: number): PlayerId[] {
  let s = start('ultimate', playerCount);
  const turns: PlayerId[] = [];
  for (let i = 0; i < moves; i++) {
    turns.push(s.turn);
    s = play(s, firstLegal(s));
  }
  return turns;
}

describe('turn order by round', () => {
  it('2 players alternate', () => {
    expect(turnSequence(2, 6)).toEqual([0, 1, 0, 1, 0, 1]);
  });

  it('3 players: 0,1,2 then 0,2,1, then back to 0,1,2', () => {
    expect(turnSequence(3, 7)).toEqual([0, 1, 2, 0, 2, 1, 0]);
  });

  it('4 players follow the six-round schedule', () => {
    expect(turnSequence(4, 24)).toEqual(SCHEDULE_4.flat());
  });

  it('4 players: every ordered pair follows each other exactly twice per cycle', () => {
    const seq = turnSequence(4, 24);
    const counts = new Map<string, number>();
    seq.forEach((x, i) => {
      const key = `${x}>${seq[(i + 1) % seq.length]}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    expect(counts.size).toBe(12);
    expect([...counts.values()].every((c) => c === 2)).toBe(true);
  });

  it('4 players: each round has every player once', () => {
    const seq = turnSequence(4, 24);
    for (let r = 0; r < 6; r++) {
      expect([...seq.slice(r * 4, r * 4 + 4)].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it('winning a small board does not change who moves next', () => {
    const s = winUltimateBoard(start('ultimate', 3), 0, 0);
    expect(ownerOf(s, [0])).toBe(0);
    expect(s.turn).toBe(0);
    const s2 = play(s, firstLegal(s));
    expect(s2.turn).toBe(2);
  });

  it('roundOf reports the round and order of the current turn', () => {
    const s0 = start('ultimate', 3);
    expect(roundOf(s0)).toEqual({ round: 1, order: [0, 1, 2] });
    const s3 = playAll(s0, [
      [0, 0],
      [0, 1],
      [1, 1],
    ]);
    expect(roundOf(s3)).toEqual({ round: 2, order: [0, 2, 1] });
    expect(roundOf(playAll(s3, [[1, 0]]))).toEqual({ round: 2, order: [0, 2, 1] });
  });
});
