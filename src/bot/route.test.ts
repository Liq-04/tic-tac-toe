import { describe, expect, it } from 'vitest';
import { isLegal, play, type Path } from '../game';
import { ROUTE_MOVES, bestRoute } from './route';
import { start } from './testkit';

const ALMOST_OVER =
  '21 16 66 62 26 65 51 17 75 53 35 54 48 87 76 61 11 15 52 23 31 13 37 77 74 47 73 38 82 25 50 06 68 86 60 08 80 04 44 43 33 30 07 88 10 00 32 22 27 24 40 12 63';

function played(moves: string) {
  return moves
    .split(' ')
    .map((move): Path => [Number(move[0]), Number(move[1])])
    .reduce(play, start('ultimate', 2));
}

describe('bestRoute', () => {
  it.each([
    ['ultimate', 2],
    ['ultimate', 3],
    ['omega', 4],
  ] as const)('%s, %i players: starts with the given move and five legal turns follow', (mode, count) => {
    let state = start(mode, count);
    const first = mode === 'omega' ? [4, 4, 4] : [4, 4];
    const route = [...bestRoute(state, first, 300)];
    expect(route).toHaveLength(ROUTE_MOVES);
    expect(route[0]?.path).toEqual(first);
    for (const { path, chances } of route) {
      expect(isLegal(state, path)).toBe(true);
      expect(chances).toHaveLength(count);
      state = play(state, path);
    }
  });

  it('stops when the game ends', () => {
    let state = played(ALMOST_OVER);
    const route = [...bestRoute(state, [3, 4], 3000)];
    expect(route.length).toBeLessThan(ROUTE_MOVES);
    for (const { path } of route) state = play(state, path);
    expect(state.status).toEqual({ kind: 'won', winners: [1] });
    expect(route.at(-1)?.chances).toEqual([0, 1]);
  });

  it('gives the same line every time', () => {
    const state = start('ultimate', 2);
    expect([...bestRoute(state, [4, 4], 500)]).toEqual([...bestRoute(state, [4, 4], 500)]);
  });

  it('rejects a first move that is not legal', () => {
    expect(() => [...bestRoute(start('ultimate', 2), [4, 4, 4])]).toThrow('illegal');
  });
});
