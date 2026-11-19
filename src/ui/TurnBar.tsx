import { Fragment } from 'react';
import { DEPTH, roundOf, type GameState } from '../game';
import { Mark } from './Mark';
import { LEVEL_NAMES, position, styleOf } from './players';

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

export function TurnBar({ state }: { state: GameState }) {
  const { mode, players } = state.config;
  const current = styleOf(state.turn);
  const boardLevels = LEVEL_NAMES[mode].slice(0, DEPTH[mode] - 1);
  const { zone } = state;

  return (
    <div className="turn-wrap">
      <div className="turn-bar">
        <span className="turn-badge" style={{ background: current.tint }}>
          <Mark d={current.d} color={current.color} />
        </span>
        <span className="turn-name">{players[state.turn]?.name}&apos;s turn</span>
        <span className="turn-divider" />
        <span className="turn-target">
          {zone.length === 0 && (
            <span>
              Play in <strong>any</strong> open board
            </span>
          )}
          {zone.map((digit, i) => (
            <Fragment key={i}>
              {i > 0 && <span className="chev">›</span>}
              <MiniMap active={digit} color={current.color} />
              <span>
                <strong>{position(digit)}</strong>{' '}
                {boardLevels.length === 1 ? 'board' : boardLevels[i]?.replace(' board', '')}
              </span>
            </Fragment>
          ))}
          {zone.length > 0 && zone.length < boardLevels.length && (
            <span>
              <span className="chev">›</span> any open{' '}
              {boardLevels[zone.length]?.replace(' board', '')}
            </span>
          )}
        </span>
      </div>
      {players.length > 2 && <RoundOrder state={state} />}
    </div>
  );
}
