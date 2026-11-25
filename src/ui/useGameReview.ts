import { useEffect, useMemo, useState } from 'react';
import { analyseGame, type PlyReview } from '../bot';
import type { GameState } from '../game';

export type Review =
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  /** `plies` fills up in move order until it covers the start and every one of `moves`. */
  | { kind: 'plies'; plies: readonly PlyReview[]; moves: number };

/**
 * The finished game in `state` as JSON, or null while it is being played or has no record of its moves.
 * Online, every room update re-parses the game, so this identifies it by content.
 */
export function useFinishedGame({ config, history, status }: GameState): string | null {
  const over = status.kind !== 'playing';
  return useMemo(
    () => (over && history ? JSON.stringify({ config: { mode: config.mode, players: config.players }, history }) : null),
    [over, config, history],
  );
}

/** Reviews the game in `key`, from `useFinishedGame`. Until there is one it is empty. */
export function useGameReview(key: string | null, history: GameState['history']): Review {
  const [plies, setPlies] = useState<readonly PlyReview[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setPlies([]);
    setFailed(false);
    if (key === null) return;
    return analyseGame(JSON.parse(key), {
      onPly: (review) => setPlies((all) => [...all, review]),
      onError: () => setFailed(true),
    });
  }, [key]);

  if (history === null) return { kind: 'unavailable' };
  if (failed) return { kind: 'failed' };
  return { kind: 'plies', plies, moves: history.length };
}
