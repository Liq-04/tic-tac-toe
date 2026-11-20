import type { GameState, Path } from '../game/types';
import { FastBoard, type Move } from './fastboard';
import { Rng } from './rng';

export type Budget = { kind: 'time'; ms: number } | { kind: 'iterations'; n: number };

const MAX_NODES = 1 << 21;
const EXPLORATION = Math.SQRT2;
const CLOCK_EVERY = 256;

export interface SearchResult {
  move: Move;
  iterations: number;
}

export function search(root: FastBoard, rng: Rng, budget: Budget, maxNodes = MAX_NODES): SearchResult {
  const cells = root.cells;
  const moves = new Uint16Array(cells);
  const scratch = root.blank();
  scratch.copyFrom(root);
  const rootMoves = scratch.legalMoves(moves);
  if (rootMoves === 1) return { move: moves[0]!, iterations: 0 };

  const wanted = budget.kind === 'iterations' ? 1 + budget.n * cells : maxNodes;
  const cap = Math.max(1 + rootMoves, Math.min(maxNodes, wanted));
  const move = new Uint16Array(cap);
  const nChildren = new Uint16Array(cap);
  const tried = new Uint16Array(cap);
  const firstChild = new Uint32Array(cap);
  const visits = new Uint32Array(cap);
  const wins = new Float32Array(cap);
  let nodes = 1;

  const pathNode = new Uint32Array(cells + 1);
  const pathMover = new Uint8Array(cells + 1);
  const reward = new Float32Array(4);

  const expandShuffled = (node: number): boolean => {
    const n = scratch.legalMoves(moves);
    if (nodes + n > cap) return false;
    for (let i = n - 1; i > 0; i--) {
      const j = rng.below(i + 1);
      const t = moves[i]!;
      moves[i] = moves[j]!;
      moves[j] = t;
    }
    firstChild[node] = nodes;
    nChildren[node] = n;
    move.set(moves.subarray(0, n), nodes);
    nodes += n;
    return true;
  };

  const deadline = budget.kind === 'time' ? performance.now() + budget.ms : Infinity;
  const limit = budget.kind === 'iterations' ? Math.max(1, budget.n) : Infinity;
  let iterations = 0;
  while (iterations < limit) {
    if (iterations > 0 && iterations % CLOCK_EVERY === 0 && performance.now() >= deadline) break;
    iterations++;
    scratch.copyFrom(root);
    let node = 0;
    let depth = 0;
    while (!scratch.over) {
      if (firstChild[node] === 0 && !expandShuffled(node)) break;
      const first = firstChild[node]!;
      const count = nChildren[node]!;
      const t = tried[node]!;
      let child: number;
      if (t < count) {
        child = first + t;
        tried[node] = t + 1;
      } else {
        const logN = Math.log(visits[node]!);
        let best = -1;
        child = first;
        for (let c = first; c < first + count; c++) {
          const v = visits[c]!;
          const score = wins[c]! / v + EXPLORATION * Math.sqrt(logN / v);
          if (score > best) {
            best = score;
            child = c;
          }
        }
      }
      pathMover[depth] = scratch.toMove;
      pathNode[depth++] = child;
      scratch.play(move[child]!);
      node = child;
      if (t < count) break;
    }
    scratch.playout(rng);
    scratch.reward(reward);
    visits[0]!++;
    for (let i = 0; i < depth; i++) {
      const n = pathNode[i]!;
      visits[n]!++;
      wins[n]! += reward[pathMover[i]!]!;
    }
  }

  let best = firstChild[0]!;
  const end = best + nChildren[0]!;
  for (let c = best; c < end; c++) {
    if (visits[c]! > visits[best]! || (visits[c] === visits[best] && wins[c]! > wins[best]!)) best = c;
  }
  return { move: move[best]!, iterations };
}

export function chooseMove(
  state: GameState,
  opts: { seed: number; budget: Budget },
): { path: Path; iterations: number } {
  if (state.status.kind !== 'playing') throw new Error('game is over');
  const board = FastBoard.fromGame(state);
  const { move, iterations } = search(board, new Rng(opts.seed), opts.budget);
  return { path: board.toPath(move), iterations };
}
