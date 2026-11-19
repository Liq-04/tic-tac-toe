import { DEPTH, nodeAt, type GameState } from '../game';

const KEY = 'nested-ttt:game:v1';

export function saveGame(state: GameState | null): void {
  try {
    if (state) localStorage.setItem(KEY, JSON.stringify(state));
    else localStorage.removeItem(KEY);
  } catch {
    // Storage can be unavailable (private mode, quota); the game still works without it.
  }
}

export function loadGame(): GameState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return parseGame(JSON.parse(raw));
  } catch {
    return null;
  }
}

function parseGame(value: unknown): GameState | null {
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
