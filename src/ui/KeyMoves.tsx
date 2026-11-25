import { useEffect, useRef, useState } from 'react';
import type { Verdict } from '../bot';
import type { PlayerInfo } from '../game';
import { Mark } from './Mark';
import { styleOf } from './players';
import { VERDICTS, VERDICT_KINDS } from './verdicts';

type Kind = Verdict['kind'];

export interface KeyMove {
  step: number;
  seat: 0 | 1 | 2 | 3;
  kind: Kind;
  margin: number;
}

interface Props {
  players: readonly PlayerInfo[];
  moves: readonly KeyMove[];
  /** The move on the board. */
  at: number;
  /** False while moves are still being reviewed. */
  complete: boolean;
  onPick: (step: number) => void;
}

function points(margin: number): string {
  const n = Math.round(Math.abs(margin) * 100);
  return `${margin < 0 ? '−' : '+'}${n}`;
}

export function KeyMoves({ players, moves, at, complete, onPick }: Props) {
  const [filter, setFilter] = useState<{ seat: number; kind: Kind } | null>(null);
  const shown = moves.filter((m) => !filter || (m.seat === filter.seat && m.kind === filter.kind));

  const list = useRef<HTMLOListElement>(null);
  useEffect(() => {
    const box = list.current;
    const row = box?.querySelector<HTMLElement>('[aria-current]');
    if (!box || !row) return;
    const top = row.offsetTop - box.offsetTop;
    if (top < box.scrollTop) box.scrollTop = top;
    else if (top + row.offsetHeight > box.scrollTop + box.clientHeight) box.scrollTop = top + row.offsetHeight - box.clientHeight;
  }, [at]);

  if (moves.length === 0) {
    return complete ? <p className="hint">No great moves, misses or blunders in this game.</p> : null;
  }
  return (
    <>
      <table className="key-counts">
        <thead>
          <tr>
            <td />
            {VERDICT_KINDS.map((kind) => (
              <th key={kind} scope="col" className={VERDICTS[kind].className}>
                <span className="key-badge" aria-hidden="true">
                  {VERDICTS[kind].glyph}
                </span>
                <span>{VERDICTS[kind].label}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {players.map((player, seat) => {
            const s = styleOf(seat as KeyMove['seat']);
            return (
              <tr key={seat}>
                <th scope="row">
                  <span className="key-player">
                    <Mark d={s.d} color={s.color} size={18} />
                    <span className="chance-name">{player.name}</span>
                  </span>
                </th>
                {VERDICT_KINDS.map((kind) => {
                  const count = moves.filter((m) => m.seat === seat && m.kind === kind).length;
                  const on = filter?.seat === seat && filter.kind === kind;
                  return (
                    <td key={kind}>
                      <button
                        type="button"
                        className={VERDICTS[kind].className}
                        aria-pressed={on}
                        aria-label={`${player.name}, ${VERDICTS[kind].label}: ${count}. ${on ? 'Show all' : 'Show only these'}`}
                        disabled={count === 0 && !on}
                        onClick={() => setFilter(on ? null : { seat, kind })}
                      >
                        {count}
                      </button>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
      {filter && (
        <button type="button" className="link-btn key-all" onClick={() => setFilter(null)}>
          Show all {moves.length} key moves
        </button>
      )}
      <ol ref={list} className="key-list">
        {shown.map(({ step, seat, kind, margin }) => {
          const s = styleOf(seat);
          const { className, glyph, label } = VERDICTS[kind];
          return (
            <li key={step}>
              <button
                type="button"
                className={className}
                aria-current={step === at ? 'step' : undefined}
                onClick={() => onPick(step)}
              >
                <span className="key-badge" aria-hidden="true">
                  {glyph}
                </span>
                <span className="key-what">
                  <strong>{label}</strong>
                  <span className="key-player">
                    <Mark d={s.d} color={s.color} size={14} />
                    <span className="chance-name">{players[seat]?.name}</span>
                    <span className="key-step">move {step}</span>
                  </span>
                </span>
                <span className="key-points">
                  {points(margin)}
                  <small>points</small>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <p className="hint">Points of win chance, against the best other move.</p>
    </>
  );
}
