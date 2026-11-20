import { useEffect, useState, useSyncExternalStore } from 'react';
import { isBotTurn, newGame, play, type Config, type GameState, type Path } from '../game';
import { botTurn } from '../bot';
import { parseCode } from '../online/protocol';
import { createHostedRoom } from '../online/storage';
import { GameScreen } from './GameScreen';
import { OnlineApp } from './OnlineApp';
import { Setup } from './Setup';
import { loadGame, saveGame } from './storage';

const DEFAULT_CONFIG: Config = {
  mode: 'ultimate',
  players: [{ name: '' }, { name: '' }],
};

function subscribeHash(onChange: () => void) {
  window.addEventListener('hashchange', onChange);
  return () => window.removeEventListener('hashchange', onChange);
}

export function App() {
  const hash = useSyncExternalStore(subscribeHash, () => location.hash);
  const code = parseCode(/^#\/g\/([^/]+)$/.exec(hash)?.[1] ?? '');
  return code ? <OnlineApp code={code} /> : <LocalApp />;
}

function LocalApp() {
  const [game, setGame] = useState<GameState | null>(loadGame);
  const [gameId, setGameId] = useState(0);
  const [lastConfig, setLastConfig] = useState<Config>(game?.config ?? DEFAULT_CONFIG);

  useEffect(() => saveGame(game), [game]);

  useEffect(() => {
    if (!game) return;
    return botTurn(game, (path) => setGame((g) => (g === game ? play(g, path) : g)));
  }, [game]);

  const start = (config: Config) => {
    setLastConfig(config);
    setGameId((n) => n + 1);
    setGame(newGame(config));
  };

  const hostOnline = (config: Config) => {
    if (config.players.some((p) => p.bot)) return;
    location.hash = `#/g/${createHostedRoom(config)}`;
  };

  if (!game) return <Setup initial={lastConfig} onStart={start} onPlayOnline={hostOnline} />;

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
      onPlay={(path: Path) => setGame((g) => (g && !isBotTurn(g) ? play(g, path) : g))}
      onNewGame={leaveGame}
      onPlayAgain={() => start(game.config)}
    />
  );
}
