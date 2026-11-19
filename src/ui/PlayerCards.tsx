import { scores, type GameState } from '../game';
import { Mark } from './Mark';
import { styleOf } from './players';

function topBoardsWon(state: GameState, player: number): number {
  return state.root.children.filter((c) => c.kind === 'board' && c.owner === player).length;
}

export function PlayerCards({ state }: { state: GameState }) {
  const { players } = state.config;
  const points = scores(state);
  const playing = state.status.kind === 'playing';
  const twoPlayer = players.length === 2;

  return (
    <div className="players" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }}>
      {players.map((p, i) => {
        const s = styleOf(i as 0 | 1 | 2 | 3);
        const isTurn = playing && state.turn === i;
        const boards = topBoardsWon(state, i);
        return (
          <div
            key={i}
            className="player-card"
            style={{ borderColor: isTurn ? s.color : undefined }}
            aria-current={isTurn ? 'true' : undefined}
          >
            <span className="player-badge" style={{ background: s.tint }}>
              <Mark d={s.d} color={s.color} size={20} />
            </span>
            <span className="player-info">
              <span className="player-name">{p.name}</span>
              <span className="player-note">
                {twoPlayer
                  ? `${boards} ${boards === 1 ? 'board' : 'boards'} won`
                  : isTurn
                    ? 'To move'
                    : 'Points'}
              </span>
            </span>
            {twoPlayer ? (
              isTurn && (
                <span className="turn-pill" style={{ color: s.ink, background: s.tint }}>
                  To move
                </span>
              )
            ) : (
              <span className="player-score" style={{ color: s.ink }}>
                {points[i]}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
