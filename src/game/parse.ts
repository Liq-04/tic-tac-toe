import { DEPTH, nodeAt } from './game';
import type { GameState } from './types';

/** Shape-checks untrusted JSON (storage, network); returns null when it is not a usable game. */
export function parseGame(value: unknown): GameState | null {
  const s = value as Partial<GameState> | null;
  const mode = s?.config?.mode;
  if (!s?.config || (mode !== 'ultimate' && mode !== 'omega')) return null;
  const count = s.config.players?.length ?? 0;
  if (count < 2 || count > 4) return null;
  if (s.root?.kind !== 'board' || !s.status || !Array.isArray(s.zone)) return null;
  try {
    const leaf = nodeAt(s.root, Array<number>(DEPTH[mode]).fill(0));
    return leaf.kind === 'cell' ? (s as GameState) : null;
  } catch {
    return null;
  }
}
