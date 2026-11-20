import { DEPTH, nodeAt } from './game';
import type { GameState, PlayerInfo } from './types';

/**
 * Shape-checks untrusted JSON (storage, network); returns null when it is not a usable game.
 * The result is a copy whose players carry `bot: true` only on seats above 0 that had exactly `true`.
 */
export function parseGame(value: unknown): GameState | null {
  const s = value as Partial<GameState> | null;
  const mode = s?.config?.mode;
  if (!s?.config || (mode !== 'ultimate' && mode !== 'omega')) return null;
  const players: unknown = s.config.players;
  if (!Array.isArray(players) || players.length < 2 || players.length > 4) return null;
  if (!players.every((p) => typeof p === 'object' && p !== null)) return null;
  if (s.root?.kind !== 'board' || !s.status || !Array.isArray(s.zone)) return null;
  try {
    const leaf = nodeAt(s.root, Array<number>(DEPTH[mode]).fill(0));
    if (leaf.kind !== 'cell') return null;
  } catch {
    return null;
  }
  const seats = players.map((p: PlayerInfo, i): PlayerInfo => {
    const { bot, ...rest } = p;
    return bot === true && i > 0 ? { ...rest, bot } : rest;
  });
  return { ...(s as GameState), config: { ...s.config, players: seats } };
}
