import { Fragment } from 'react';
import { DEPTH, type GameState } from '../game';
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

export function TurnBar({ state }: { state: GameState }) {
  const { mode, players } = state.config;
  const current = styleOf(state.turn);
  const boardLevels = LEVEL_NAMES[mode].slice(0, DEPTH[mode] - 1);
  const { zone } = state;

  return (
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
            <span className="chev">›</span> any open {boardLevels[zone.length]?.replace(' board', '')}
          </span>
        )}
      </span>
    </div>
  );
}
