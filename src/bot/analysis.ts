import { newGame, play } from '../game/game';
import type { Config, GameState, Mode, Path } from '../game/types';
import { FastBoard } from './fastboard';
import { search } from './mcts';
import { Rng } from './rng';

/** About half a second for a whole Ultimate game and 5 seconds for an Omega game on a laptop. */
const ITERATIONS: Record<Mode, number> = { ultimate: 10_000, omega: 1_000 };

export interface RoundChances {
  /** 0 is the start of the game. */
  round: number;
  /** Each seat's chance of winning, a shared win counting as a fraction. Adds up to 1 minus the chance of a draw. */
  chances: readonly number[];
}

function chancesIn(state: GameState, seed: number): readonly number[] {
  const { status, config } = state;
  if (status.kind === 'playing') {
    const budget = { kind: 'iterations', n: ITERATIONS[config.mode] } as const;
    return search(FastBoard.fromGame(state), new Rng(seed), budget).chances;
  }
  const winners: readonly number[] = status.kind === 'won' ? status.winners : [];
  return config.players.map((_, seat) => (winners.includes(seat) ? 1 / winners.length : 0));
}

/** Yields the start, then the position after each round, then the result if the last round was cut short. */
export function* roundChances(config: Config, history: readonly Path[]): Generator<RoundChances> {
  const seats = config.players.length;
  let state = newGame(config);
  yield { round: 0, chances: chancesIn(state, 1) };
  for (const [i, path] of history.entries()) {
    const next = play(state, path);
    if (next === state) throw new Error(`move ${i + 1} of the recorded game is illegal`);
    state = next;
    const moves = i + 1;
    const round = Math.ceil(moves / seats);
    if (moves % seats === 0 || moves === history.length) yield { round, chances: chancesIn(state, round + 1) };
  }
}
