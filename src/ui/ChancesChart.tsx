import type { KeyboardEvent, PointerEvent } from 'react';
import type { Verdict } from '../bot';
import type { PlayerInfo } from '../game';
import { Mark } from './Mark';
import { styleOf } from './players';
import { VERDICTS } from './verdicts';

export type Chances = readonly number[];

export interface ChartMarker {
  step: number;
  seat: number;
  kind: Verdict['kind'];
}

export function percent(chance: number): string {
  if (chance > 0 && chance < 0.005) return '<1%';
  if (chance < 1 && chance >= 0.995) return '>99%';
  return `${Math.round(chance * 100)}%`;
}

export function drawChance(chances: Chances): number {
  return Math.max(0, 1 - chances.reduce((a, b) => a + b, 0));
}

/** True when a draw is worth showing anywhere in `steps`. */
export function canDraw(steps: readonly Chances[]): boolean {
  return steps.some((chances) => drawChance(chances) >= 0.005);
}

interface Props {
  players: readonly PlayerInfo[];
  /** The chances at each step so far. Grows until it covers steps 0 to `last`. */
  steps: readonly Chances[];
  last: number;
  at: number;
  onPick: (step: number) => void;
  /** What one step is, such as "Round". */
  stepName: string;
  stepLabel: (step: number) => string;
  /** Label for the right end of the axis. */
  endLabel: string;
  markers?: readonly ChartMarker[];
  /** Pick the step under the pointer without a press. */
  pickOnHover?: boolean;
}

export function ChancesChart({
  players,
  steps,
  last,
  at,
  onPick,
  stepName,
  stepLabel,
  endLabel,
  markers = [],
  pickOnHover = false,
}: Props) {
  const shown = steps[at];
  const x = (step: number) => (100 * step) / last;
  const y = (chance: number) => 100 * (1 - chance);

  const pick = (e: PointerEvent<HTMLElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    const step = Math.round(((e.clientX - box.left) / box.width) * last);
    onPick(Math.max(0, Math.min(last, step)));
  };
  const onKeyDown = (e: KeyboardEvent) => {
    const to = { ArrowLeft: at - 1, ArrowDown: at - 1, ArrowRight: at + 1, ArrowUp: at + 1, Home: 0, End: last }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    onPick(Math.max(0, Math.min(last, to)));
  };

  const readout = shown
    ? [
        ...players.map((p, i) => `${p.name} ${percent(shown[i] ?? 0)}`),
        ...(canDraw(steps) ? [`Draw ${percent(drawChance(shown))}`] : []),
      ].join(', ')
    : '';

  return (
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
        aria-label={stepName}
        aria-valuemin={0}
        aria-valuemax={last}
        aria-valuenow={Math.max(at, 0)}
        aria-valuetext={shown ? `${stepLabel(at)}: ${readout}` : 'Calculating'}
        onPointerDown={pick}
        onPointerMove={(e) => (pickOnHover || e.buttons > 0) && pick(e)}
        onKeyDown={onKeyDown}
      >
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {[0, 50, 100].map((line) => (
            <line key={line} className="chances-grid" x1="0" x2="100" y1={line} y2={line} />
          ))}
          {at >= 0 && <line className="chances-cursor" x1={x(at)} x2={x(at)} y1="0" y2="100" />}
          {players.map((_, i) => (
            <polyline
              key={i}
              className="chances-line"
              stroke={styleOf(i as 0 | 1 | 2 | 3).color}
              points={steps.map((chances, step) => `${x(step)},${y(chances[i] ?? 0)}`).join(' ')}
            />
          ))}
        </svg>
        {markers.map(({ step, seat, kind }) => (
          <span
            key={step}
            className={`chances-marker ${VERDICTS[kind].className}`}
            style={{ left: `${x(step)}%`, top: `${y(steps[step]?.[seat] ?? 0)}%` }}
          />
        ))}
        {shown?.map((chance, i) => (
          <span
            key={i}
            className="chances-dot"
            style={{ left: `${x(at)}%`, top: `${y(chance)}%`, background: styleOf(i as 0 | 1 | 2 | 3).color }}
          />
        ))}
      </div>
      <div className="chances-x" aria-hidden="true">
        <span>Start</span>
        <span>{endLabel}</span>
      </div>
    </div>
  );
}

interface LegendProps {
  players: readonly PlayerInfo[];
  shown: Chances | undefined;
  withDraw: boolean;
}

export function ChancesLegend({ players, shown, withDraw }: LegendProps) {
  return (
    <ul className="chances-legend">
      {players.map((p, i) => {
        const s = styleOf(i as 0 | 1 | 2 | 3);
        return (
          <li key={i}>
            <Mark d={s.d} color={s.color} size={16} />
            <span className="chances-name">{p.name}</span>
            <strong>{shown ? percent(shown[i] ?? 0) : ''}</strong>
          </li>
        );
      })}
      {withDraw && shown && (
        <li>
          <Mark d="M5 9H19M5 15H19" color="#4B5563" size={16} />
          <span className="chances-name">Draw</span>
          <strong>{percent(drawChance(shown))}</strong>
        </li>
      )}
    </ul>
  );
}
