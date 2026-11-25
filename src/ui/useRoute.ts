import { useEffect, useMemo, useState } from 'react';
import { ROUTE_MOVES, findRoute, type RouteStep } from '../bot';
import { play, type GameState, type Path } from '../game';

export interface RouteStart {
  state: GameState;
  first: Path;
}

export interface Route {
  /** The position before the first move, then after each move found so far. */
  states: readonly GameState[];
  steps: readonly RouteStep[];
  /** The last index `states` can reach. Falls to its final value once the game ends on the way. */
  last: number;
  failed: boolean;
}

/** Works out the moves that follow `start`. `start` must keep its identity while it is the same route. */
export function useRoute(start: RouteStart | null): Route | null {
  const [found, setFound] = useState<{ start: RouteStart | null; steps: readonly RouteStep[]; failed: boolean }>({
    start: null,
    steps: [],
    failed: false,
  });

  useEffect(() => {
    setFound({ start, steps: [], failed: false });
    if (!start) return;
    return findRoute(start, {
      onStep: (step) => setFound((f) => ({ ...f, steps: [...f.steps, step] })),
      onError: () => setFound((f) => ({ ...f, failed: true })),
    });
  }, [start]);

  return useMemo(() => {
    if (!start) return null;
    const { steps, failed } = found.start === start ? found : { steps: [], failed: false };
    const states = [start.state];
    for (const { path } of steps) states.push(play(states[states.length - 1] ?? start.state, path));
    const over = states[states.length - 1]?.status.kind !== 'playing';
    return { states, steps, failed, last: over || failed ? states.length - 1 : ROUTE_MOVES };
  }, [start, found]);
}
