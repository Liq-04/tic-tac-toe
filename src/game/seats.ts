import type { GameState } from './types';

/** The game is in progress and a bot seat is to move. */
export function isBotTurn(state: GameState): boolean {
  return state.status.kind === 'playing' && state.config.players[state.turn]?.bot === true;
}
