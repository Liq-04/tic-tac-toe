import { useEffect, useMemo, useState } from 'react';
import { analyseGame, type RoundChances } from '../bot';
import type { GameState } from '../game';

export type Analysis =
  | { kind: 'unavailable' }
  | { kind: 'failed' }
  /** `results` fills up in round order until it covers rounds 0 to `rounds`. */
  | { kind: 'rounds'; results: readonly RoundChances[]; rounds: number };

/** Each player's chance of winning after every round of the finished game `state`. */
export function useRoundChances({ config, history }: GameState): Analysis {
  // Online, every room update re-parses the game, so the analysis restarts on content and not on identity.
  const key = useMemo(
    () => history && JSON.stringify({ config: { mode: config.mode, players: config.players }, history }),
    [config, history],
  );
  const [results, setResults] = useState<readonly RoundChances[]>([]);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (key === null) return;
    setResults([]);
    setFailed(false);
    return analyseGame(JSON.parse(key), {
      onRound: (result) => setResults((all) => [...all, result]),
      onError: () => setFailed(true),
    });
  }, [key]);

  if (history === null) return { kind: 'unavailable' };
  if (failed) return { kind: 'failed' };
  return { kind: 'rounds', results, rounds: Math.ceil(history.length / config.players.length) };
}
