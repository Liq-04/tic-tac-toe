import { useEffect, useMemo, useRef, useState } from 'react';
import type { MoveReview } from '../bot';
import { samePath, type GameState, type Path, type PlayerId } from '../game';
import { BoardView, noteKey, type CellNote, type CellNotes } from './BoardView';
import { ChancesChart, drawChance, percent, type Chances } from './ChancesChart';
import { KeyMoves, type KeyMove } from './KeyMoves';
import { Mark } from './Mark';
import { styleOf } from './players';
import { useRoute, type Route, type RouteStart } from './useRoute';
import { BEST_MOVE, VERDICTS, type VerdictStyle } from './verdicts';
import type { Review } from './useGameReview';
import { reviewNote } from './WinChances';

const MOVE_MS = 900;
/** Longer, to look at the better move. */
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

/** A move of the game, or a step along the best line that could have been played instead of it. */
interface Position {
  ply: number;
  /** 0 is the position before the line's first move. Null while the game itself is on the board. */
  step: number | null;
}

function styleOfMove({ verdict }: MoveReview, isBest: boolean): VerdictStyle | null {
  return verdict ? VERDICTS[verdict.kind] : isBest ? BEST_MOVE : null;
}

function gameNotes(move: MoveReview, played: Path, seat: PlayerId): CellNotes {
  const isBest = samePath(move.best.path, played);
  const style = styleOfMove(move, isBest);
  const notes = new Map<string, CellNote>();
  if (style) {
    notes.set(noteKey(played), { className: style.className, label: style.label, badge: style.glyph, ghost: null });
  }
  if (!isBest) {
    notes.set(noteKey(move.best.path), { className: 'better', label: 'best move', badge: null, ghost: seat });
  }
  return notes;
}

function routeNotes(route: Route, step: number): CellNotes {
  return new Map(
    route.steps
      .slice(0, step)
      .map(({ path }, i) => [
        noteKey(path),
        { className: 'in-route', label: `move ${i + 1} of the line`, badge: String(i + 1), ghost: null },
      ]),
  );
}

interface MoveStripProps {
  ply: number;
  from: GameState;
  played: Path;
  move: MoveReview;
  after: Chances;
  /** Null when there is no line to show. */
  onShowRoute: (() => void) | null;
}

/** What was played against what was best, on one line. */
function MoveStrip({ ply, from, played, move, after, onShowRoute }: MoveStripProps) {
  const mover = styleOf(from.turn);
  const isBest = samePath(move.best.path, played);
  const style = styleOfMove(move, isBest);
  return (
    <div className="move-strip">
      <span className="strip-move">
        <Mark d={mover.d} color={mover.color} size={18} />
        Move {ply}
      </span>
      {style && (
        <span className={`verdict-pill ${style.className}`}>
          {style.glyph} {style.label}
        </span>
      )}
      <span className="strip-chances">
        <span>
          Played <strong>{percent(after[from.turn] ?? 0)}</strong>
        </span>
        {!isBest && (
          <span className="strip-best">
            Best <strong>{percent(move.best.chance)}</strong>
          </span>
        )}
      </span>
      {onShowRoute && (
        <button type="button" className="btn" onClick={onShowRoute}>
          Show best line
        </button>
      )}
    </div>
  );
}

export function Replay({ states, review, shortcuts, onClose }: Props) {
  const last = states.length - 1;
  const [{ ply, step }, setPosition] = useState<Position>({ ply: 0, step: null });
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const plies = review.kind === 'plies' ? review.plies : [];
  const from = states[ply - 1];
  const played = states[ply]?.lastMove;
  const move = plies[ply]?.move ?? null;

  const routeStart = useMemo<RouteStart | null>(
    () => (step !== null && from && move ? { state: from, first: move.best.path } : null),
    [step !== null, from, move],
  );
  const route = useRoute(routeStart);
  // The game, or the line while one is open. A step not worked out yet shows as soon as it is.
  const at = route ? Math.min(step ?? 0, route.states.length - 1) : ply;
  const end = route ? route.last : last;
  const state = route ? route.states[at] : states[ply];
  const now = route && at > 0 ? route.steps[at - 1]?.chances : plies[route ? ply - 1 : ply]?.chances;
  const before = route ? (at > 1 ? route.steps[at - 2]?.chances : plies[ply - 1]?.chances) : plies[ply - 1]?.chances;

  const notes = useMemo<CellNotes | undefined>(() => {
    if (route) return routeNotes(route, at);
    return move && played && from ? gameNotes(move, played, from.turn) : undefined;
  }, [route, at, move, played, from]);
  const keyMoves = useMemo(
    () =>
      plies.flatMap((p): KeyMove[] => {
        const seat = states[p.ply - 1]?.turn;
        return p.move?.verdict && seat !== undefined ? [{ step: p.ply, seat, ...p.move.verdict }] : [];
      }),
    [plies, states],
  );

  const playButton = useRef<HTMLButtonElement>(null);
  useEffect(() => playButton.current?.focus({ preventScroll: true }), []);

  const running = playing && at < end;
  const ready = route ? at < route.states.length - 1 : review.kind !== 'plies' || plies[ply] !== undefined;
  const wait = (!route && move?.verdict ? NOTED_MS : MOVE_MS) / speed;
  const inRoute = route !== null;
  useEffect(() => {
    if (!running || !ready) return;
    const timer = setTimeout(() => setPosition(inRoute ? { ply, step: at + 1 } : { ply: at + 1, step: null }), wait);
    return () => clearTimeout(timer);
  }, [running, ready, inRoute, ply, at, wait]);

  const moveTo = (to: number) => setPosition(inRoute ? { ply, step: to } : { ply: to, step: null });
  const goTo = (to: number) => {
    setPlaying(false);
    moveTo(Math.max(0, Math.min(end, to)));
  };
  const goToMove = (to: number) => {
    setPlaying(false);
    setPosition({ ply: to, step: null });
  };
  const openRoute = () => {
    setPosition({ ply, step: 0 });
    setPlaying(true);
    playButton.current?.focus({ preventScroll: true });
  };
  const closeRoute = () => {
    goToMove(ply);
    playButton.current?.focus({ preventScroll: true });
  };
  const togglePlay = () => {
    if (at >= end) {
      moveTo(0);
      setPlaying(true);
    } else setPlaying(!playing);
  };

  useEffect(() => {
    if (!shortcuts) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      const on = (selector: string) => e.target instanceof Element && e.target.closest(selector) !== null;
      if (e.key === 'Escape') (inRoute ? closeRoute : onClose)();
      else if (e.key === 'ArrowLeft' && !on('input')) goTo(at - 1);
      else if (e.key === 'ArrowRight' && !on('input')) goTo(at + 1);
      else if (e.key === ' ' && !on('button')) togglePlay();
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (!state) return null;
  const { mode, players } = state.config;
  const gameLabel = (at: number) => (at === 0 ? 'Start of the game' : `Move ${at} of ${last}`);
  const routeLabel = (at: number) => (at === 0 ? `Before move ${ply}` : `Best line, ${at} of ${end}`);
  const steps = plies.map((p) => p.chances);
  const label = (inRoute ? routeLabel : gameLabel)(at);

  return (
    <main className="replay">
      <div className="replay-board">
        <div className={`frame mode-${mode}${inRoute ? ' frame-route' : ''}`}>
          <BoardView
            state={state}
            prefix={ROOT}
            canPlay={false}
            preview={null}
            notes={notes}
            onHover={ignore}
            onPlay={ignore}
          />
        </div>
        {route ? (
          <div className="move-strip strip-route" role="status">
            <span className="strip-move">Best line from move {ply}</span>
            <span className="strip-chances">
              {route.failed ? 'Could not be worked out' : ready || at >= end ? `${at} of ${end}` : 'Thinking…'}
            </span>
            <button type="button" className="btn primary" onClick={closeRoute}>
              Back to the game
            </button>
          </div>
        ) : from && played && move ? (
          <MoveStrip
            ply={ply}
            from={from}
            played={played}
            move={move}
            after={plies[ply]?.chances ?? []}
            onShowRoute={ply === last && samePath(move.best.path, played) ? null : openRoute}
          />
        ) : (
          <div className="move-strip">
            <span className="strip-move">{gameLabel(ply)}</span>
            {ply > 0 && review.kind === 'plies' && <span className="strip-chances">Finding the best move…</span>}
          </div>
        )}
        <input
          type="range"
          className="replay-scrub"
          aria-label={inRoute ? 'Move of the best line' : 'Move'}
          aria-valuetext={label}
          min={0}
          max={end}
          value={at}
          onChange={(e) => goTo(Number(e.target.value))}
        />
        <div className="replay-controls">
          <div className="replay-transport">
            <button type="button" className="btn replay-jump" aria-label="Go to the start" aria-disabled={at === 0} onClick={() => goTo(0)}>
              ⏮
            </button>
            <button type="button" className="btn" aria-label="Previous move" aria-disabled={at === 0} onClick={() => goTo(at - 1)}>
              ◀
            </button>
            <button type="button" ref={playButton} className="btn primary replay-play" onClick={togglePlay}>
              {running ? 'Pause' : at >= end ? 'Play again' : 'Play'}
            </button>
            <button type="button" className="btn" aria-label="Next move" aria-disabled={at >= end} onClick={() => goTo(at + 1)}>
              ▶
            </button>
            <button type="button" className="btn replay-jump" aria-label="Go to the end" aria-disabled={at >= end} onClick={() => goTo(end)}>
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
          <p className="chances-round">{label}</p>
          <ChanceBars state={state} now={now} before={before} />
          {review.kind === 'plies' && (
            <ChancesChart
              players={players}
              steps={steps}
              last={last}
              at={ply}
              onPick={goToMove}
              stepName="Move"
              stepLabel={gameLabel}
              endLabel={`${last} moves`}
              markers={keyMoves}
            />
          )}
        </section>
        <section className="key-moves" aria-labelledby="key-moves-title">
          <h3 id="key-moves-title">Key moves</h3>
          <KeyMoves
            players={players}
            moves={keyMoves}
            at={ply}
            complete={review.kind === 'plies' && plies.length > last}
            onPick={goToMove}
          />
          <p className="hint">{reviewNote(review)}</p>
        </section>
      </aside>
    </main>
  );
}
