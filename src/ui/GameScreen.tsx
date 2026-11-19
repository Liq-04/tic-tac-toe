import { useState } from 'react';
import type { GameState, Path } from '../game';
import { BoardView } from './BoardView';
import { GameOver } from './GameOver';
import { Mark } from './Mark';
import { PlayerCards } from './PlayerCards';
import { MODE_LABEL } from './players';
import { RulesModal } from './RulesModal';
import { TurnBar } from './TurnBar';

interface Props {
  state: GameState;
  onPlay: (path: Path) => void;
  onNewGame: () => void;
  onPlayAgain: () => void;
}

export function GameScreen({ state, onPlay, onNewGame, onPlayAgain }: Props) {
  const { mode, players } = state.config;
  const [showRules, setShowRules] = useState(false);
  const [resultHidden, setResultHidden] = useState(false);
  const [zoomPref, setZoomPref] = useState(false);

  const over = state.status.kind !== 'playing';
  const zoomedLarge = zoomPref && mode === 'omega' && !over ? state.zone[0] : undefined;
  const zoomed = zoomedLarge !== undefined;
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
            New game
          </button>
        </div>
      </header>

      <main className="game-main">
        <div className="bar-row">
          {over ? (
            <button type="button" className="btn" onClick={() => setResultHidden(false)}>
              Game over · Show results
            </button>
          ) : (
            <TurnBar state={state} />
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
            onPlay={onPlay}
          />
        </div>

        <PlayerCards state={state} />
      </main>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
      {over && !resultHidden && (
        <GameOver
          state={state}
          onAgain={onPlayAgain}
          onSetup={onNewGame}
          onViewBoard={() => setResultHidden(true)}
        />
      )}
    </div>
  );
}
