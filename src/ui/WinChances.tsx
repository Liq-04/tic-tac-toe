import { useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { RoundChances } from '../bot';
import type { PlayerInfo } from '../game';
import { Mark } from './Mark';
import { styleOf } from './players';
import type { Analysis } from './useRoundChances';

function percent(chance: number): string {
  if (chance > 0 && chance < 0.005) return '<1%';
  if (chance < 1 && chance >= 0.995) return '>99%';
  return `${Math.round(chance * 100)}%`;
}

function drawChance({ chances }: RoundChances): number {
  return Math.max(0, 1 - chances.reduce((a, b) => a + b, 0));
}

function roundLabel(round: number, rounds: number): string {
  if (round === 0) return 'Start of the game';
  return round === rounds ? 'Final result' : `After round ${round} of ${rounds}`;
}

interface ChartProps {
  players: readonly PlayerInfo[];
  results: readonly RoundChances[];
  rounds: number;
}

function Chart({ players, results, rounds }: ChartProps) {
  const [picked, setPicked] = useState<number | null>(null);
  const last = results.length - 1;
  const at = Math.min(picked ?? last, last);
  const shown = results[at];
  const hasDraw = results.some((r) => drawChance(r) >= 0.005);
  const x = (round: number) => (100 * round) / rounds;
  const y = (chance: number) => 100 * (1 - chance);

  const pick = (e: PointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const round = Math.round(((e.clientX - box.left) / box.width) * rounds);
    setPicked(Math.max(0, Math.min(rounds, round)));
  };
  const step = (e: KeyboardEvent) => {
    const to = { ArrowLeft: at - 1, ArrowDown: at - 1, ArrowRight: at + 1, ArrowUp: at + 1, Home: 0, End: last }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    setPicked(Math.max(0, Math.min(last, to)));
  };

  const readout = shown
    ? [
        ...players.map((p, i) => `${p.name} ${percent(shown.chances[i] ?? 0)}`),
        ...(hasDraw ? [`Draw ${percent(drawChance(shown))}`] : []),
      ].join(', ')
    : '';

  return (
    <>
      <p className="chances-round">{shown ? roundLabel(at, rounds) : 'Calculating…'}</p>
      <ul className="chances-legend">
        {players.map((p, i) => {
          const s = styleOf(i as 0 | 1 | 2 | 3);
          return (
            <li key={i}>
              <Mark d={s.d} color={s.color} size={16} />
              <span className="chances-name">{p.name}</span>
              <strong>{shown ? percent(shown.chances[i] ?? 0) : ''}</strong>
            </li>
          );
        })}
        {hasDraw && shown && (
          <li>
            <Mark d="M5 9H19M5 15H19" color="#4B5563" size={16} />
            <span className="chances-name">Draw</span>
            <strong>{percent(drawChance(shown))}</strong>
          </li>
        )}
      </ul>
      <div className="chances-chart">
        <div className="chances-y" aria-hidden="true">
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>
        <div
          className="chances-plot"
          role="slider"
          tabIndex={0}
          aria-label="Round"
          aria-valuemin={0}
          aria-valuemax={rounds}
          aria-valuenow={Math.max(at, 0)}
          aria-valuetext={shown ? `${roundLabel(at, rounds)}: ${readout}` : 'Calculating'}
          onPointerDown={pick}
          onPointerMove={pick}
          onKeyDown={step}
        >
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
            {[0, 50, 100].map((line) => (
              <line key={line} className="chances-grid" x1="0" x2="100" y1={line} y2={line} />
            ))}
            {shown && <line className="chances-cursor" x1={x(at)} x2={x(at)} y1="0" y2="100" />}
            {players.map((_, i) => (
              <polyline
                key={i}
                className="chances-line"
                stroke={styleOf(i as 0 | 1 | 2 | 3).color}
                points={results.map((r) => `${x(r.round)},${y(r.chances[i] ?? 0)}`).join(' ')}
              />
            ))}
          </svg>
          {shown?.chances.map((chance, i) => (
            <span
              key={i}
              className="chances-dot"
              style={{ left: `${x(at)}%`, top: `${y(chance)}%`, background: styleOf(i as 0 | 1 | 2 | 3).color }}
            />
          ))}
        </div>
        <div className="chances-x" aria-hidden="true">
          <span>Start</span>
          <span>{rounds === 1 ? '1 round' : `${rounds} rounds`}</span>
        </div>
      </div>
      <details className="chances-table">
        <summary>Show as a table</summary>
        <div>
          <table>
            <thead>
              <tr>
                <th scope="col">Round</th>
                {players.map((p, i) => (
                  <th key={i} scope="col">
                    {p.name}
                  </th>
                ))}
                {hasDraw && <th scope="col">Draw</th>}
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.round}>
                  <th scope="row">{r.round === 0 ? 'Start' : r.round === rounds ? 'Result' : r.round}</th>
                  {r.chances.map((chance, i) => (
                    <td key={i}>{percent(chance)}</td>
                  ))}
                  {hasDraw && <td>{percent(drawChance(r))}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}

function note(analysis: Analysis): string {
  switch (analysis.kind) {
    case 'unavailable':
      return 'Not available, because this game started before moves were recorded.';
    case 'failed':
      return 'Could not be calculated for this game.';
    case 'rounds': {
      const { results, rounds } = analysis;
      return results.length <= rounds
        ? `Calculating… ${results.length} of ${rounds + 1}`
        : 'Estimated by the bot, which plays out the rest of the game many times from each point.';
    }
    default: {
      const _exhaustive: never = analysis;
      return _exhaustive;
    }
  }
}

export function WinChances({ players, analysis }: { players: readonly PlayerInfo[]; analysis: Analysis }) {
  return (
    <section className="chances" aria-labelledby="chances-title">
      <h3 id="chances-title">Win chances by round</h3>
      {analysis.kind === 'rounds' && (
        <Chart players={players} results={analysis.results} rounds={analysis.rounds} />
      )}
      <p className="hint">{note(analysis)}</p>
    </section>
  );
}
