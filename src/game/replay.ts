import { newGame, play } from './game';
import type { Config, GameState, Path } from './types';

/** The start of the game, then the state after each move. Null when a recorded move is illegal. */
export function replayStates(config: Config, history: readonly Path[]): readonly GameState[] | null {
  let state = newGame(config);
  const states = [state];
  for (const path of history) {
    const next = play(state, path);
    if (next === state) return null;
    state = next;
    states.push(state);
  }
  return states;
}
