import { parseGame, type GameState } from '../game';

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
