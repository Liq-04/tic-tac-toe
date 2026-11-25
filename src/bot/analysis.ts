import { replayStates } from '../game/replay';
import { play } from '../game/game';
import type { Config, GameState, Mode, Path } from '../game/types';
import { FastBoard } from './fastboard';
import { search } from './mcts';
import { Rng } from './rng';

/** Per searched position, usually two a move. On a laptop, about 10 seconds for an Ultimate game and 30 for a long Omega game. */
const ITERATIONS: Record<Mode, number> = { ultimate: 25_000, omega: 1_000 };
/** Measured against 400,000-iteration searches, this cuts the error of the bot's own setting by 30% to 50% at the same cost. */
const EXPLORATION = 0.5;

const BIG_GAP = 0.1;
const SAME = 0.03;

export interface Alternative {
  path: Path;
  /** The mover's chance of winning had they played it. */
  chance: number;
}

export type Verdict =
  /** Lowered the mover's own chance when another move was far better. */
  | { kind: 'blunder'; better: Alternative }
  /** Left the mover's chance about where it was, or higher, when another move was far better. */
  | { kind: 'missed'; better: Alternative }
  /** Far better for the mover than any other move. */
  | { kind: 'great'; next: Alternative };

export interface PlyReview {
  /** Moves played so far. 0 is the start of the game. */
  ply: number;
  /** Each seat's chance of winning, a shared win counting as a fraction. Adds up to 1 minus the chance of a draw. */
  chances: readonly number[];
  /** On the move that led here. Null for an unremarkable move, and at the start. */
  verdict: Verdict | null;
}

interface Evaluation {
  chances: readonly number[];
  /** Legal moves, most promising first. */
  ranked: readonly Path[];
}

function evaluate(state: GameState, seed: number, iterations: number): Evaluation {
  const { status, config } = state;
  if (status.kind === 'playing') {
    const board = FastBoard.fromGame(state);
    const budget = { kind: 'iterations', n: iterations } as const;
    const { chances, ranked } = search(board, new Rng(seed), budget, { exploration: EXPLORATION });
    return { chances, ranked: ranked.map((move) => board.toPath(move)) };
  }
  const winners: readonly number[] = status.kind === 'won' ? status.winners : [];
  return { chances: config.players.map((_, seat) => (winners.includes(seat) ? 1 / winners.length : 0)), ranked: [] };
}

/** `before` and `after` are the mover's chances around the move, and `other` is the best alternative to it. */
export function judge(before: number, after: number, other: Alternative): Verdict | null {
  const dropped = before - after >= SAME;
  if (other.chance - after >= BIG_GAP) return { kind: dropped ? 'blunder' : 'missed', better: other };
  return after - other.chance >= BIG_GAP && !dropped ? { kind: 'great', next: other } : null;
}

/** Yields the start, then the position after each move. */
export function* reviewGame(
  config: Config,
  history: readonly Path[],
  iterations = ITERATIONS[config.mode],
): Generator<PlyReview> {
  const states = replayStates(config, history);
  const start = states?.[0];
  if (!states || !start) throw new Error('the recorded game has an illegal move');
  let seed = 1;
  const evaluateNext = (state: GameState) => evaluate(state, seed++, iterations);
  let from = start;
  let before = evaluateNext(start);
  yield { ply: 0, chances: before.chances, verdict: null };
  for (const [i, to] of states.slice(1).entries()) {
    const after = evaluateNext(to);
    const mover = from.turn;
    const was = before.chances[mover] ?? 0;
    const is = after.chances[mover] ?? 0;
    const played = to.lastMove;
    const others = before.ranked.filter((path) => path.some((d, level) => d !== played?.[level]));
    const weigh = (path: Path): Alternative => ({
      path,
      chance: evaluateNext(play(from, path)).chances[mover] ?? 0,
    });
    let other = others[0] ? weigh(others[0]) : null;
    const stands = (chance: number) => Math.abs(is - chance) >= BIG_GAP;
    if (other && others[1] && (stands(was) || stands(other.chance))) {
      const second = weigh(others[1]);
      if (second.chance > other.chance) other = second;
    }
    // A move that ends the game speaks for itself.
    const over = to.status.kind !== 'playing';
    const verdict = other && judge(was, is, other);
    yield { ply: i + 1, chances: after.chances, verdict: over && verdict?.kind === 'great' ? null : verdict };
    from = to;
    before = after;
  }
}
