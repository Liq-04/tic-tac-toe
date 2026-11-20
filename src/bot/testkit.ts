import { expect } from 'vitest';
import { newGame, play, type GameState, type Mode, type Path, type PlayerId } from '../game';
import type { Move } from './fastboard';

export type Count = 2 | 3 | 4;

export function start(mode: Mode, count: Count): GameState {
  return newGame({ mode, players: Array.from({ length: count }, (_, i) => ({ name: `P${i + 1}` })) });
}

export function pathOf(move: Move, depth: number): Path {
  const path: number[] = [];
  for (let i = 0; i < depth; i++) {
    path.unshift(move % 9);
    move = Math.floor(move / 9);
  }
  return path;
}

export function moveOf(path: Path): Move {
  return path.reduce((m, d) => m * 9 + d, 0);
}

export function put(state: GameState, player: PlayerId, path: Path): GameState {
  const next = play({ ...state, turn: player, zone: [] }, path);
  expect(next.lastMove, `setup move ${path.join(',')} is legal`).toEqual(path);
  return next;
}

export function winBoard(state: GameState, prefix: Path, player: PlayerId): GameState {
  return [0, 1, 2].reduce((s, cell) => put(s, player, [...prefix, cell]), state);
}

export function winLargeBoard(state: GameState, large: number, player: PlayerId): GameState {
  return [0, 1, 2].reduce((s, small) => winBoard(s, [large, small], player), state);
}

export function turnAfter(mode: Mode, count: Count, marks: number): PlayerId {
  let s = start(mode, count);
  for (let i = 0; i < marks; i++) {
    const head = mode === 'ultimate' ? [i % 9] : [Math.floor(i / 9), i % 9];
    s = put(s, 0, [...head, 0]);
  }
  return s.turn;
}

export const TIE_PATTERN: PlayerId[] = [0, 0, 1, 1, 1, 0, 0, 1, 0];

export function oneCellFromAllTied(count: Count): GameState {
  let real = start('ultimate', count);
  for (let board = 0; board < 9; board++) {
    TIE_PATTERN.forEach((mark, cell) => {
      if (board === 8 && cell === 8) return;
      real = put(real, mark, [board, cell]);
    });
  }
  return { ...real, zone: [8] };
}
