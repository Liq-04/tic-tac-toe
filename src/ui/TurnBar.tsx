import { Fragment, type ReactNode } from 'react';
import { DEPTH, roundOf, type GameState, type Path, type PlayerId } from '../game';
import { Mark } from './Mark';
import { LEVEL_NAMES, position, styleOf } from './players';

/** Index of the position with the longest name ("bottom-middle"), used to size the bar for its widest text. */
const WIDEST_DIGIT = 7;

function MiniMap({ active, color }: { active: number; color: string }) {
  return (
    <span className="minimap" aria-hidden="true">
      {Array.from({ length: 9 }, (_, i) => (
        <span key={i} style={{ background: i === active ? color : '#D1D5DB' }} />
      ))}
    </span>
  );
}

function RoundOrder({ state }: { state: GameState }) {
  const { round, order } = roundOf(state);
  const { players } = state.config;
  const currentIndex = order.indexOf(state.turn);
  const label = `Round ${round} order: ${order.map((id) => players[id]?.name).join(', ')}`;

  return (
    <div className="round-order" role="group" aria-label={label}>
      <span className="round-label" aria-hidden="true">
        Round {round}
      </span>
      {order.map((id, i) => {
        const style = styleOf(id);
        const current = i === currentIndex;
        return (
          <Fragment key={id}>
            {i > 0 && (
              <span className="chev" aria-hidden="true">
                →
              </span>
            )}
            <span
              className={`round-step${current ? ' current' : ''}${i < currentIndex ? ' done' : ''}`}
              style={current ? { background: style.tint } : undefined}
            >
              <Mark d={style.d} color={style.color} size={16} />
            </span>
          </Fragment>
        );
      })}
    </div>
  );
}

function Target({ zone, levels, color }: { zone: Path; levels: readonly string[]; color: string }) {
  return (
    <>
      {zone.length === 0 && (
        <span>
          Play in <strong>any</strong> open board
        </span>
      )}
      {zone.map((digit, i) => (
        <Fragment key={i}>
          {i > 0 && <span className="chev">›</span>}
          <MiniMap active={digit} color={color} />
          <span>
            <strong>{position(digit)}</strong>{' '}
            {levels.length === 1 ? 'board' : levels[i]?.replace(' board', '')}
          </span>
        </Fragment>
      ))}
      {zone.length > 0 && zone.length < levels.length && (
        <span>
          <span className="chev">›</span> any open {levels[zone.length]?.replace(' board', '')}
        </span>
      )}
    </>
  );
}

/**
 * Renders `shown` with every entry of `reserve` stacked invisibly beneath it, so the box is always
 * as large as its largest possible content and the board below never shifts between turns.
 */
function Stable({ className, shown, reserve }: { className: string; shown: ReactNode; reserve: ReactNode[] }) {
  return (
    <span className={`stable ${className}`}>
      <span className="stable-item">{shown}</span>
      {reserve.map((node, i) => (
        <span key={i} className="stable-item" aria-hidden="true">
          {node}
        </span>
      ))}
    </span>
  );
}

interface Props {
  state: GameState;
  /** Online only: the viewer's seat, or null for a spectator. Undefined for a local game. */
  you?: PlayerId | null;
}

export function TurnBar({ state, you }: Props) {
  const { mode, players } = state.config;
  const current = styleOf(state.turn);
  const levels = LEVEL_NAMES[mode].slice(0, DEPTH[mode] - 1);
  const labelFor = (id: number) => {
    const player = players[id];
    if (you === undefined) return player?.bot ? `${player.name} is thinking…` : `${player?.name}'s turn`;
    return you === id ? 'Your turn' : `Waiting for ${player?.name}`;
  };
  const widestZones = levels.map((_, i) => Array<number>(i + 1).fill(WIDEST_DIGIT));

  return (
    <div className="turn-wrap">
      <div className="turn-bar">
        <span className="turn-badge" style={{ background: current.tint }}>
          <Mark d={current.d} color={current.color} />
        </span>
        <Stable
          className="turn-name"
          shown={labelFor(state.turn)}
          reserve={players.map((_, id) => labelFor(id))}
        />
        <span className="turn-divider" />
        <Stable
          className="turn-target"
          shown={<Target zone={state.zone} levels={levels} color={current.color} />}
          reserve={[[], ...widestZones].map((zone) => (
            <Target zone={zone} levels={levels} color={current.color} />
          ))}
        />
      </div>
      {players.length > 2 && <RoundOrder state={state} />}
    </div>
  );
}
