import { useEffect, useMemo, useState } from 'react';
import { isBotTurn, isLegal, play, replayStates, type GameState, type Path, type PlayerId } from '../game';
import { BoardView, type MovePreview } from './BoardView';
import { GameOver } from './GameOver';
import { Mark } from './Mark';
import { PlayerCards } from './PlayerCards';
import { MODE_LABEL } from './players';
import { Replay } from './Replay';
import { RulesModal } from './RulesModal';
import { TurnBar } from './TurnBar';
import { useGameReview } from './useGameReview';

/** Present only for online games. A local game omits it and behaves as pass-and-play. */
export interface OnlineGame {
  /** The viewer's seat, or null for a spectator. */
  you: PlayerId | null;
  isHost: boolean;
  /** False while a guest is cut off from the host; moves sent then would be lost. */
  live: boolean;
  connected: readonly boolean[];
  /** Connection trouble to show above the board. */
  banner: string | null;
}

interface Props {
  state: GameState;
  online?: OnlineGame;
  onPlay: (path: Path) => void;
  onNewGame: () => void;
  onPlayAgain: () => void;
}

function previewOf(state: GameState, path: Path | null): MovePreview | null {
  if (path === null || !isLegal(state, path)) return null;
  const after = play(state, path);
  const next = after.status.kind === 'playing' ? { turn: after.turn, zone: after.zone } : null;
  return { path, next };
}

export function GameScreen({ state, online, onPlay, onNewGame, onPlayAgain }: Props) {
  const { mode, players } = state.config;
  const [showRules, setShowRules] = useState(false);
  const [afterGame, setAfterGame] = useState<'result' | 'board' | 'replay'>('result');
  const [zoomPref, setZoomPref] = useState(false);
  const [hover, setHover] = useState<Path | null>(null);

  const over = state.status.kind !== 'playing';
  useEffect(() => {
    if (!over) setAfterGame('result');
  }, [over]);
  const review = useGameReview(state);
  const { config, history } = state;
  const states = useMemo(
    () => (over && history ? replayStates(config, history) : null),
    [over, config, history],
  );
  const watchReplay = states && (() => setAfterGame('replay'));
  const zoomedLarge = zoomPref && mode === 'omega' && !over ? state.zone[0] : undefined;
  const zoomed = zoomedLarge !== undefined;
  const canPlay =
    online === undefined ? !isBotTurn(state) : online.live && online.you === state.turn;
  const preview = previewOf(state, canPlay ? hover : null);
  const ruleLine = players.length === 2 ? 'three in a row wins' : 'most boards wins';

  return (
    <div className="screen game">
      <header className="app-header">
        <div className="brand">
          <Mark d="M9 3V21M15 3V21M3 9H21M3 15H21" color="#111827" size={28} strokeWidth={2} />
          <span className="brand-text">
            <span className="brand-name">Ultimate Tic-Tac-Toe</span>
            <span className="brand-sub">
              {MODE_LABEL[mode]} · {players.length} players · {ruleLine}
            </span>
          </span>
          <span className="chip">
            {MODE_LABEL[mode]} · {players.length} players
          </span>
        </div>
        <div className="header-actions">
          <button type="button" className="btn" onClick={() => setShowRules(true)}>
            Rules
          </button>
          <button type="button" className="btn primary" onClick={onNewGame}>
            {online ? 'Leave' : 'New game'}
          </button>
        </div>
      </header>

      {over && states && afterGame === 'replay' ? (
        <Replay states={states} review={review} shortcuts={!showRules} onClose={() => setAfterGame('result')} />
      ) : (
        <main className="game-main">
          {online?.banner && (
            <div className="banner" role="status">
              {online.banner}
            </div>
          )}
          <div className="bar-row">
            {over ? (
              <div className="over-actions">
                <button type="button" className="btn" onClick={() => setAfterGame('result')}>
                  Game over · Show results
                </button>
                {watchReplay && (
                  <button type="button" className="btn" onClick={watchReplay}>
                    ▶ Watch replay
                  </button>
                )}
              </div>
            ) : (
              <TurnBar state={state} you={online?.you} />
            )}
            {mode === 'omega' && (
              <div className="segmented small" role="group" aria-label="Board view">
                <button type="button" aria-pressed={!zoomPref} onClick={() => setZoomPref(false)}>
                  Overview
                </button>
                <button
                  type="button"
                  aria-pressed={zoomPref}
                  title="Shows the large board you must play in, when there is exactly one"
                  onClick={() => setZoomPref(true)}
                >
                  Zoom to move
                </button>
              </div>
            )}
          </div>

          <div className={`frame mode-${mode}${zoomed ? ' zoomed' : ''}`}>
            <BoardView
              key={zoomed ? 'zoom' : 'overview'}
              state={state}
              prefix={zoomed ? [zoomedLarge] : []}
              canPlay={canPlay}
              preview={preview}
              onHover={setHover}
              onPlay={onPlay}
            />
          </div>

          <PlayerCards state={state} online={online} />
        </main>
      )}

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {over && afterGame === 'result' && (
        <GameOver
          state={state}
          review={review}
          onAgain={online && !online.isHost ? null : onPlayAgain}
          onSetup={onNewGame}
          onViewBoard={() => setAfterGame('board')}
          onReplay={watchReplay}
        />
      )}
    </div>
  );
}
