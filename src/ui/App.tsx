import { useEffect, useState } from 'react';
import { newGame, play, type Config, type GameState, type Path } from '../game';
import { GameScreen } from './GameScreen';
import { Setup } from './Setup';
import { loadGame, saveGame } from './storage';

const DEFAULT_CONFIG: Config = {
  mode: 'ultimate',
  players: [{ name: '' }, { name: '' }],
};

export function App() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [gameId, setGameId] = useState(0);
  const [lastConfig, setLastConfig] = useState<Config>(game?.config ?? DEFAULT_CONFIG);

  useEffect(() => saveGame(game), [game]);

  const start = (config: Config) => {
    setLastConfig(config);
    setGameId((n) => n + 1);
    setGame(newGame(config));
  };

  if (!game) return <Setup initial={lastConfig} onStart={start} />;

  const leaveGame = () => {
    const inProgress = game.status.kind === 'playing' && game.lastMove !== null;
    if (inProgress && !window.confirm('Leave this game and go back to setup?')) return;
    setLastConfig(game.config);
    setGame(null);
  };

  return (
    <GameScreen
      key={gameId}
      state={game}
      onPlay={(path: Path) => setGame((g) => (g ? play(g, path) : g))}
      onNewGame={leaveGame}
      onPlayAgain={() => start(game.config)}
    />
  );
}
