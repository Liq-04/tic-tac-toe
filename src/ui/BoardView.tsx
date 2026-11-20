import type { CSSProperties } from 'react';
import { DEPTH, isInZone, isLegal, nodeAt, type BoardNode, type GameState, type Path } from '../game';
import { Mark } from './Mark';
import { LEVEL_NAMES, SHAPES, position, styleOf } from './players';

interface Props {
  state: GameState;
  prefix: Path;
  onPlay: (path: Path) => void;
}

function samePath(a: Path | null, b: Path): boolean {
  return a !== null && a.length === b.length && a.every((d, i) => d === b[i]);
}

function cellLabel(state: GameState, path: Path): string {
  const names = LEVEL_NAMES[state.config.mode];
  const place = path.map((d, i) => `${position(d)} ${names[i]}`).join(', ');
  const mark = nodeAt(state.root, path);
  const who =
    mark.kind === 'cell' && mark.mark !== null ? state.config.players[mark.mark]?.name : 'empty';
  return `${place}, ${who}`;
}

export function BoardView({ state, prefix, onPlay }: Props) {
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

  return (
    <div
      className={`board lvl-${level}${isLeaf ? ' leaf' : ''}${level === 0 ? ' root' : ''}`}
      style={style}
    >
      {node.children.map((child, i) => {
        const path = [...prefix, i];
        if (child.kind === 'board') {
          return <BoardView key={i} state={state} prefix={path} onPlay={onPlay} />;
        }
        const legal = isLegal(state, path);
        const mark = child.mark === null ? null : styleOf(child.mark);
        return (
          <button
            key={i}
            type="button"
            className={`cell${samePath(state.lastMove, path) ? ' last' : ''}`}
            aria-label={cellLabel(state, path)}
            disabled={!legal}
            onClick={() => onPlay(path)}
          >
            {mark && <Mark d={mark.d} color={mark.color} size="74%" strokeWidth={3.2} />}
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
      {dead && (
        <div className="owned dead" role="img" aria-label="Tied board, no moves left">
          <Mark d={SHAPES.x} color="#374151" size="68%" strokeWidth={2.4} />
          {deadLabel && <span className="claim-pill dead-pill">Tied</span>}
        </div>
      )}
    </div>
  );
}
