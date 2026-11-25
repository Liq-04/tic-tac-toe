import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlyReview } from '../bot';
import type { GameState, Path } from '../game';
import { BoardView, type MoveNote } from './BoardView';
import { ChancesChart, drawChance, percent, type Chances } from './ChancesChart';
import { Mark } from './Mark';
import { placeName, styleOf } from './players';
import { VERDICTS } from './verdicts';
import type { Review } from './useGameReview';
import { reviewNote } from './WinChances';

const MOVE_MS = 900;
/** Longer, to read why the move stands out and look at the better one. */
const NOTED_MS = 3200;
const SPEEDS = [1, 2, 4] as const;
const ROOT: Path = [];
const ignore = () => {};

interface Props {
  /** The start of a finished game, then the state after each move. */
  states: readonly GameState[];
  review: Review;
  /** False while something covers the replay. */
  shortcuts: boolean;
  onClose: () => void;
}

function chanceText(chance: number | undefined): string {
  return chance === undefined ? '…' : percent(chance);
}

function ChanceBars({ state, now, before }: { state: GameState; now: Chances | undefined; before: Chances | undefined }) {
  const { players } = state.config;
  const draw = now && drawChance(now);
  return (
    <ul className="chance-bars">
      {players.map((p, i) => {
        const s = styleOf(i as 0 | 1 | 2 | 3);
        const chance = now?.[i];
        const points = chance === undefined ? 0 : Math.round(chance * 100) - Math.round((before?.[i] ?? chance) * 100);
        return (
          <li key={i}>
            <Mark d={s.d} color={s.color} size={18} />
            <span className="chance-name">{p.name}</span>
            <span className={`chance-change ${points > 0 ? 'up' : 'down'}`}>
              {points !== 0 && `${points > 0 ? '▲' : '▼'} ${Math.abs(points)}`}
            </span>
            <strong>{chanceText(chance)}</strong>
            <span className="chance-track">
              <span style={{ width: `${100 * (chance ?? 0)}%`, background: s.color }} />
            </span>
          </li>
        );
      })}
      {draw !== undefined && draw >= 0.005 && (
        <li>
          <Mark d="M5 9H19M5 15H19" color="#4B5563" size={18} />
          <span className="chance-name">Draw</span>
          <span />
          <strong>{percent(draw)}</strong>
          <span className="chance-track">
            <span style={{ width: `${100 * draw}%`, background: '#6B7280' }} />
          </span>
        </li>
      )}
    </ul>
  );
}

function nameOf(state: GameState, seat: number): string {
  return state.config.players[seat]?.name ?? '';
}

interface MoveCardProps {
  ply: number;
  from: GameState | undefined;
  to: GameState;
  before: PlyReview | undefined;
  after: PlyReview | undefined;
  reviewed: boolean;
  quiet: boolean;
}

function explain(from: GameState, before: PlyReview, after: PlyReview): string | null {
  const { verdict } = after;
  if (!verdict) return null;
  const was = percent(before.chances[from.turn] ?? 0);
  const is = percent(after.chances[from.turn] ?? 0);
  const name = nameOf(from, from.turn);
  switch (verdict.kind) {
    case 'blunder':
      return `${name}'s chance of winning fell from ${was} to ${is}.`;
    case 'missed':
      return `${name}'s chance of winning is ${is}, and it could have been far higher.`;
    case 'great':
      return `${name}'s chance of winning ${was === is ? `stayed at ${is}` : `went from ${was} to ${is}`}. The next best move was worth ${percent(verdict.next.chance)}.`;
    default: {
      const _exhaustive: never = verdict;
      return _exhaustive;
    }
  }
}

function MoveCard({ ply, from, to, before, after, reviewed, quiet }: MoveCardProps) {
  if (!from || !to.lastMove) {
    return (
      <div className="move-card">
        <p className="move-title">Start of the game</p>
        <p>Press play to watch, or pick a move below.</p>
      </div>
    );
  }
  const { mode } = to.config;
  const mover = styleOf(from.turn);
  const verdict = after?.verdict ?? null;
  const style = verdict && VERDICTS[verdict.kind];
  const why = before && after ? explain(from, before, after) : null;
  return (
    <div className={`move-card ${style?.className ?? ''}`} aria-live={quiet ? 'off' : 'polite'}>
      <p className="move-title">
        <Mark d={mover.d} color={mover.color} size={18} />
        <span>
          Move {ply}: {nameOf(from, from.turn)}
        </span>
        {style && (
          <span className="verdict-pill">
            {style.glyph} {style.label}
          </span>
        )}
      </p>
      <p>Played {placeName(mode, to.lastMove)}.</p>
      {why && <p>{why}</p>}
      {verdict && 'better' in verdict && (
        <p className="better-line">
          <strong>Better:</strong> {placeName(mode, verdict.better.path)}, for {percent(verdict.better.chance)}. It is
          outlined in green on the board.
        </p>
      )}
      {!after && reviewed && <p>Working out the chances…</p>}
    </div>
  );
}

export function Replay({ states, review, shortcuts, onClose }: Props) {
  const last = states.length - 1;
  const [ply, setPly] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const plies = review.kind === 'plies' ? review.plies : [];
  const state = states[ply] ?? states[0];
  const from = states[ply - 1];
  const after = plies[ply];
  const before = plies[ply - 1];
  const verdict = after?.verdict ?? null;
  const path = state?.lastMove;
  const note = useMemo<MoveNote | null>(
    () => (verdict && path && from ? { path, seat: from.turn, verdict } : null),
    [verdict, path, from],
  );
  const keyMoves = useMemo(
    () =>
      plies.flatMap((p) => {
        const seat = states[p.ply - 1]?.turn;
        return p.verdict && seat !== undefined ? [{ step: p.ply, seat, kind: p.verdict.kind, verdict: p.verdict }] : [];
      }),
    [plies, states],
  );

  const playButton = useRef<HTMLButtonElement>(null);
  useEffect(() => playButton.current?.focus({ preventScroll: true }), []);

  const running = playing && ply < last;
  const ready = review.kind !== 'plies' || after !== undefined;
  const wait = (verdict ? NOTED_MS : MOVE_MS) / speed;
  useEffect(() => {
    if (!running || !ready) return;
    const timer = setTimeout(() => setPly(ply + 1), wait);
    return () => clearTimeout(timer);
  }, [running, ready, ply, wait]);

  const goTo = (to: number) => {
    setPlaying(false);
    setPly(Math.max(0, Math.min(last, to)));
  };
  const togglePlay = () => {
    if (ply >= last) {
      setPly(0);
      setPlaying(true);
    } else setPlaying(!playing);
  };

  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const on = (selector: string) => e.target instanceof Element && e.target.closest(selector) !== null;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' && !on('input')) goTo(ply - 1);
      else if (e.key === 'ArrowRight' && !on('input')) goTo(ply + 1);
      else if (e.key === ' ' && !on('button')) togglePlay();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!state) return null;
  const { mode, players } = state.config;
  const steps = plies.map((p) => p.chances);
  const stepLabel = (step: number) => (step === 0 ? 'Start of the game' : `Move ${step} of ${last}`);

  return (
    <main className="replay">
      <div className="replay-board">
        <div className={`frame mode-${mode}`}>
          <BoardView
            state={state}
            prefix={ROOT}
            canPlay={false}
            preview={null}
            note={note}
            onHover={ignore}
            onPlay={ignore}
          />
        </div>
        <input
          type="range"
          className="replay-scrub"
          aria-label="Move"
          aria-valuetext={stepLabel(ply)}
          min={0}
          max={last}
          value={ply}
          onChange={(e) => goTo(Number(e.target.value))}
        />
        <div className="replay-controls">
          <div className="replay-transport">
            <button type="button" className="btn replay-jump" aria-label="Go to the start" aria-disabled={ply === 0} onClick={() => goTo(0)}>
              ⏮
            </button>
            <button type="button" className="btn" aria-label="Previous move" aria-disabled={ply === 0} onClick={() => goTo(ply - 1)}>
              ◀
            </button>
            <button type="button" ref={playButton} className="btn primary replay-play" onClick={togglePlay}>
              {running ? 'Pause' : ply >= last ? 'Play again' : 'Play'}
            </button>
            <button type="button" className="btn" aria-label="Next move" aria-disabled={ply >= last} onClick={() => goTo(ply + 1)}>
              ▶
            </button>
            <button type="button" className="btn replay-jump" aria-label="Go to the end" aria-disabled={ply >= last} onClick={() => goTo(last)}>
              ⏭
            </button>
          </div>
          <div className="segmented small" role="group" aria-label="Replay speed">
            {SPEEDS.map((s) => (
              <button key={s} type="button" aria-pressed={s === speed} onClick={() => setSpeed(s)}>
                {s}×
              </button>
            ))}
          </div>
        </div>
      </div>

      <aside className="replay-side">
        <div className="replay-head">
          <h2>Replay</h2>
          <button type="button" className="btn" onClick={onClose}>
            Back to results
          </button>
        </div>
        <section className="chances" aria-label="Win chances">
          <p className="chances-round">{stepLabel(ply)}</p>
          <ChanceBars state={state} now={after?.chances} before={before?.chances} />
          {review.kind === 'plies' && (
            <ChancesChart
              players={players}
              steps={steps}
              last={last}
              at={ply}
              onPick={goTo}
              stepName="Move"
              stepLabel={stepLabel}
              endLabel={`${last} moves`}
              markers={keyMoves}
            />
          )}
        </section>
        <MoveCard
          ply={ply}
          from={from}
          to={state}
          before={before}
          after={after}
          reviewed={review.kind === 'plies'}
          quiet={running}
        />
        <section className="key-moves" aria-labelledby="key-moves-title">
          <h3 id="key-moves-title">Key moves</h3>
          {keyMoves.length > 0 ? (
            <ol>
              {keyMoves.map(({ step, seat, kind, verdict }) => {
                const s = styleOf(seat);
                const chance = (at: number) => chanceText(plies[at]?.chances[seat]);
                return (
                  <li key={step}>
                    <button
                      type="button"
                      className={VERDICTS[kind].className}
                      aria-current={step === ply ? 'step' : undefined}
                      onClick={() => goTo(step)}
                    >
                      <span className="key-glyph">{VERDICTS[kind].glyph}</span>
                      <span className="key-move">{step}</span>
                      <Mark d={s.d} color={s.color} size={16} />
                      <span className="chance-name">{nameOf(state, seat)}</span>
                      <span className="key-label">{VERDICTS[kind].label}</span>
                      <span className="key-chance">
                        {'better' in verdict
                          ? `${chance(step)}, best ${percent(verdict.better.chance)}`
                          : `${chance(step)}, next ${percent(verdict.next.chance)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : (
            review.kind === 'plies' &&
            plies.length > last && <p className="hint">No blunders, missed chances or great moves in this game.</p>
          )}
          <p className="hint">{reviewNote(review)}</p>
        </section>
      </aside>
    </main>
  );
}
