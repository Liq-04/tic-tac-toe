import { useEffect, useMemo, useState } from 'react';
import { analyseGame, type PlyReview } from '../bot';
import type { GameState } from '../game';

export type Review =
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  /** `plies` fills up in move order until it covers the start and every one of `moves`. */
  | { kind: 'plies'; plies: readonly PlyReview[]; moves: number };

/** Reviews the game in `state` once it is over. Until then it is empty. */
export function useGameReview({ config, history, status }: GameState): Review {
  const over = status.kind !== 'playing';
  // Online, every room update re-parses the game, so the review restarts on content and not on identity.
  const key = useMemo(
    () =>
      over && history
        ? JSON.stringify({ config: { mode: config.mode, players: config.players }, history })
        : null,
    [over, config, history],
  );
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
