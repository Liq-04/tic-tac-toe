import { play } from '../game/game';
import type { GameState, Mode, Path } from '../game/types';
import { evaluate } from './analysis';

/** The first move and the five turns after it. */
export const ROUTE_MOVES = 6;

/** Per move. Higher than a review's in Omega, because a route is only worked out when asked for. */
const ITERATIONS: Record<Mode, number> = { ultimate: 25_000, omega: 8_000 };

export interface RouteStep {
  path: Path;
  /** Each seat's chance of winning once `path` is played. */
  chances: readonly number[];
}

/** Yields `first`, then the best reply to each move, and stops early when the game ends. */
export function* bestRoute(
  state: GameState,
  first: Path,
  iterations = ITERATIONS[state.config.mode],
): Generator<RouteStep> {
  let path: Path | undefined = first;
  for (let move = 1; path && move <= ROUTE_MOVES; move++) {
    const next = play(state, path);
    if (next === state) throw new Error('the route has an illegal move');
    const { chances, ranked } = evaluate(next, move, iterations);
    yield { path, chances };
    state = next;
    path = ranked[0];
  }
}
