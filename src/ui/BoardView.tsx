import type { CSSProperties } from 'react';
import {
  DEPTH,
  isInZone,
  isLegal,
  nodeAt,
  samePath,
  type BoardNode,
  type GameState,
  type Path,
  type PlayerId,
} from '../game';
import { Mark } from './Mark';
import { SHAPES, placeName, styleOf } from './players';

/** What the hovered move would do: the cell it fills, and who moves next and where (null if it ends the game). */
export interface MovePreview {
  path: Path;
  next: { turn: PlayerId; zone: Path } | null;
}

/** Points out a cell in a replay. */
export interface CellNote {
  className: string;
  /** Read out after the cell's name. */
  label: string;
  badge: string | null;
  /** A player who could have moved here, drawn faintly. */
  ghost: PlayerId | null;
}

/** Notes by `noteKey`. */
export type CellNotes = ReadonlyMap<string, CellNote>;

export function noteKey(path: Path): string {
  return path.join('');
}

const NO_NOTES: CellNotes = new Map();

interface Props {
  state: GameState;
  prefix: Path;
  /** False while it is not this viewer's turn (online play), so no cell is clickable. */
  canPlay: boolean;
  preview: MovePreview | null;
  notes?: CellNotes;
  onHover: (path: Path | null) => void;
  onPlay: (path: Path) => void;
}

function cellLabel(state: GameState, path: Path): string {
  const mark = nodeAt(state.root, path);
  const who =
    mark.kind === 'cell' && mark.mark !== null ? state.config.players[mark.mark]?.name : 'empty';
  return `${placeName(state.config.mode, path)}, ${who}`;
}

export function BoardView({ state, prefix, canPlay, preview, notes = NO_NOTES, onHover, onPlay }: Props) {
  const { mode, players } = state.config;
  const depth = DEPTH[mode];
  const level = prefix.length;
  const isLeaf = level === depth - 1;
  const node = nodeAt(state.root, prefix) as BoardNode;
  const current = styleOf(state.turn);
  const inZone = level > 0 && isInZone(state, prefix);
  const showRing = inZone && state.zone.length > 0;

  const style: CSSProperties = {};
  if (inZone && isLeaf) style.background = current.tint;
  if (showRing) {
    style.boxShadow = isLeaf
      ? `0 0 0 ${mode === 'ultimate' ? 3 : 2}px ${current.color}`
      : `0 0 0 4px ${current.color}66`;
  }

  const owner = level > 0 ? node.owner : null;
  const ownerStyle = owner === null ? null : styleOf(owner);
  const claimed = owner !== null && players.length > 2 && mode === 'omega' && level === 1;
  const dead = level > 0 && node.closed && node.owner === null;
  const deadLabel = dead && level === 1;
  const next = preview?.next && samePath(preview.next.zone, prefix) ? preview.next : null;
  const nextStyle = next && styleOf(next.turn);

  return (
    <div
      className={`board lvl-${level}${isLeaf ? ' leaf' : ''}${level === 0 ? ' root' : ''}${next ? ' next-target' : ''}`}
      style={style}
    >
      {node.children.map((child, i) => {
        const path = [...prefix, i];
        if (child.kind === 'board') {
          return (
            <BoardView
              key={i}
              state={state}
              prefix={path}
              canPlay={canPlay}
              preview={preview}
              notes={notes}
              onHover={onHover}
              onPlay={onPlay}
            />
          );
        }
        const legal = canPlay && isLegal(state, path);
        const mark = child.mark === null ? null : styleOf(child.mark);
        const ghost = preview !== null && samePath(preview.path, path);
        const last = state.lastMove !== null && samePath(state.lastMove, path);
        const note = notes.get(noteKey(path));
        const couldBe = note && note.ghost !== null ? styleOf(note.ghost) : null;
        return (
          <button
            key={i}
            type="button"
            className={`cell${last ? ' last' : ''}${note ? ` noted ${note.className}` : ''}`}
            aria-label={cellLabel(state, path) + (note ? `, ${note.label}` : '')}
            disabled={!legal}
            onClick={() => onPlay(path)}
            onPointerEnter={() => onHover(path)}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover(path)}
            onBlur={() => onHover(null)}
          >
            {mark && <Mark d={mark.d} color={mark.color} size="74%" strokeWidth={3.2} />}
            {ghost && (
              <span className="ghost">
                <Mark d={current.d} color={current.color} size="74%" strokeWidth={3.2} />
              </span>
            )}
            {couldBe && <Mark d={couldBe.d} color={couldBe.color} size="66%" strokeWidth={2.6} style={{ opacity: 0.55 }} />}
            {note?.badge && (
              <span className="cell-badge" aria-hidden="true">
                {note.badge}
              </span>
            )}
          </button>
        );
      })}
      {ownerStyle && (
        <div
          className="owned"
          style={{ background: ownerStyle.tint + (claimed ? 'F2' : 'EB') }}
        >
          <Mark
            d={ownerStyle.d}
            color={ownerStyle.color}
            size={claimed ? '52%' : '68%'}
            strokeWidth={claimed ? 2 : 2.4}
          />
          {claimed && (
            <span className="claim-pill" style={{ background: ownerStyle.ink }}>
              Claimed · 9 pts
            </span>
          )}
        </div>
      )}
      {nextStyle && (
        <div className="next-zone" style={{ borderColor: nextStyle.color, background: nextStyle.color + '1F' }}>
          <span className="next-badge" style={{ background: nextStyle.tint, borderColor: nextStyle.color }}>
            <Mark d={nextStyle.d} color={nextStyle.color} size="60%" strokeWidth={3} />
          </span>
        </div>
      )}
      {dead && (
        <div className="owned dead" role="img" aria-label="Tied board, no moves left">
          <Mark d={SHAPES.x} color="#374151" size="68%" strokeWidth={2.4} />
          {deadLabel && <span className="claim-pill dead-pill">Tied</span>}
        </div>
      )}
    </div>
  );
}
