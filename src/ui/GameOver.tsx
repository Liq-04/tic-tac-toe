import { scores, type GameState } from '../game';
import { Mark } from './Mark';
import { Modal } from './Modal';
import { styleOf } from './players';

interface Props {
  state: GameState;
  onAgain: () => void;
  onSetup: () => void;
  onViewBoard: () => void;
}

function title(state: GameState): string {
  const { status, config } = state;
  if (status.kind === 'draw') return "It's a draw";
  if (status.kind !== 'won') return '';
  const names = status.winners.map((w) => config.players[w]?.name ?? '');
  if (names.length === 1) return `${names[0]} wins`;
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]} share the win`;
}

function subtitle(state: GameState, points: number[]): string {
  const { status, config } = state;
  const sorted = [...points].sort((a, b) => b - a);
  if (status.kind === 'draw') return 'No one completed a line on the top board.';
  if (state.root.owner !== null) {
    return config.players.length === 2
      ? 'Three boards in a row on the top board.'
      : 'Three in a row on the top board claimed every board.';
  }
  return `${sorted[0]} boards to ${sorted[1]}.`;
}

export function GameOver({ state, onAgain, onSetup, onViewBoard }: Props) {
  const { players } = state.config;
  // A top-board win claims every board, so 2-player standings count boards actually won instead.
  const points =
    players.length === 2
      ? players.map((_, i) => state.root.children.filter((c) => c.kind === 'board' && c.owner === i).length)
      : scores(state);
  const winnerId = state.status.kind === 'won' ? state.status.winners[0] : undefined;
  const headline = winnerId === undefined ? null : styleOf(winnerId);
  const isWinner = (id: number) => state.status.kind === 'won' && state.status.winners.includes(id as 0);
  const beats = (a: { id: number; score: number }, b: { id: number; score: number }) =>
    isWinner(a.id) !== isWinner(b.id) ? isWinner(a.id) : a.score > b.score;
  const rows = players
    .map((p, i) => ({ name: p.name, id: i as 0 | 1 | 2 | 3, score: points[i] ?? 0 }))
    .sort((a, b) => Number(beats(b, a)) - Number(beats(a, b)));

  return (
    <Modal titleId="result-title">
      <span className="result-badge" style={{ background: headline?.tint ?? '#F3F4F6' }}>
        {headline ? (
          <Mark d={headline.d} color={headline.color} size={42} strokeWidth={2.4} />
        ) : (
          <Mark d="M5 9H19M5 15H19" color="#4B5563" size={42} strokeWidth={2.4} />
        )}
      </span>
      <div className="result-text">
        <h2 id="result-title" className="modal-title">
          {title(state)}
        </h2>
        <p>{subtitle(state, points)}</p>
      </div>
      <ol className="standings">
        {rows.map((r) => {
          const s = styleOf(r.id);
          const rank = 1 + rows.filter((x) => beats(x, r)).length;
          return (
            <li key={r.id} style={{ background: isWinner(r.id) ? s.tint : '#F9FAFB' }}>
              <span className="rank">{rank}</span>
              <Mark d={s.d} color={s.color} size={20} />
              <span className="standing-name">{r.name}</span>
              <span className="standing-score">
                {r.score} {r.score === 1 ? 'board' : 'boards'}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="modal-actions">
        <button type="button" className="btn primary" onClick={onAgain}>
          Play again
        </button>
        <button type="button" className="btn" onClick={onSetup}>
          Change setup
        </button>
      </div>
      <button type="button" className="link-btn" onClick={onViewBoard}>
        View board
      </button>
    </Modal>
  );
}
