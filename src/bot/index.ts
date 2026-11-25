import { isBotTurn, isLegal, type GameState, type Path } from '../game';
import type { RoundChances } from './analysis';
import type { AnalysisRequest } from './analysisWorker';
import type { ThinkReply, ThinkRequest } from './worker';

export type { RoundChances };

const THINK_MS = 1000;
const MIN_TURN_MS = 400;

/**
 * If the seat to move in `state` is a bot, searches in a worker and calls `onMove` once with a legal path
 * for `state`, no sooner than MIN_TURN_MS. Otherwise does nothing. After the returned function runs, `onMove`
 * is never called.
 */
export function botTurn(state: GameState, onMove: (path: Path) => void): () => void {
  if (!isBotTurn(state)) return () => {};
  const startedAt = performance.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<ThinkReply>) => {
    worker.terminate();
    if (!isLegal(state, data.path)) throw new Error('bot returned an illegal move');
    if (import.meta.env.DEV) console.debug('bot', data.iterations, 'iterations');
    timer = setTimeout(() => onMove(data.path), Math.max(0, MIN_TURN_MS - (performance.now() - startedAt)));
  };
  worker.onerror = (e) => console.error('bot worker failed', e);
  const request: ThinkRequest = { state, seed: (Math.random() * 2 ** 32) >>> 0, budgetMs: THINK_MS };
  worker.postMessage(request);
  return () => {
    worker.onmessage = null;
    worker.terminate();
    clearTimeout(timer);
  };
}

/**
 * Works out each player's chance of winning after every round of `game` in a worker, calling `onRound` in
 * round order as results arrive. After the returned function runs, neither callback is called.
 */
export function analyseGame(
  game: AnalysisRequest,
  callbacks: { onRound: (result: RoundChances) => void; onError: () => void },
): () => void {
  const worker = new Worker(new URL('./analysisWorker.ts', import.meta.url), { type: 'module' });
  worker.onmessage = ({ data }: MessageEvent<RoundChances>) => callbacks.onRound(data);
  worker.onerror = (e) => {
    console.error('analysis worker failed', e);
    callbacks.onError();
  };
  worker.postMessage(game);
  return () => {
    worker.onmessage = null;
    worker.onerror = null;
    worker.terminate();
  };
}
