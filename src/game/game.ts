import type {
  BoardNode,
  Config,
  GameState,
  Mode,
  Node,
  Path,
  PlayerId,
  Status,
} from './types';

export const DEPTH: Record<Mode, number> = { ultimate: 2, omega: 3 };

export const LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
] as const;

function build(level: number, depth: number): Node {
  if (level === depth) return { kind: 'cell', mark: null };
  return {
    kind: 'board',
    owner: null,
    closed: false,
    children: Array.from({ length: 9 }, () => build(level + 1, depth)),
  };
}

export function newGame(config: Config): GameState {
  return {
    config,
    root: build(0, DEPTH[config.mode]) as BoardNode,
    turn: 0,
    zone: [],
    lastMove: null,
    status: { kind: 'playing' },
  };
}

export function nodeAt(root: Node, prefix: Path): Node {
  let node = root;
  for (const digit of prefix) {
    if (node.kind !== 'board') throw new Error('path goes below a cell');
    const child = node.children[digit];
    if (!child) throw new Error(`no child ${digit}`);
    node = child;
  }
  return node;
}

function isClosed(node: Node): boolean {
  return node.kind === 'cell' ? node.mark !== null : node.closed;
}

function claimant(node: Node): PlayerId | null {
  return node.kind === 'cell' ? node.mark : node.owner;
}

function hasLine(children: readonly Node[], player: PlayerId): boolean {
  return LINES.some((line) => line.every((i) => children[i] && claimant(children[i]) === player));
}

function boardAt(root: BoardNode, prefix: Path): BoardNode | null {
  const node = nodeAt(root, prefix);
  return node.kind === 'board' ? node : null;
}

/** True when neither the board at `prefix` nor any ancestor is closed. */
function isOpen(root: BoardNode, prefix: Path): boolean {
  let node: Node = root;
  if (isClosed(node)) return false;
  for (const digit of prefix) {
    if (node.kind !== 'board') return false;
    const child: Node | undefined = node.children[digit];
    if (!child || isClosed(child)) return false;
    node = child;
  }
  return true;
}

function isStartsWith(path: Path, prefix: Path): boolean {
  return prefix.every((digit, i) => path[i] === digit);
}

export function isLegal(state: GameState, path: Path): boolean {
  const depth = DEPTH[state.config.mode];
  if (state.status.kind !== 'playing') return false;
  if (path.length !== depth) return false;
  if (!path.every((d) => Number.isInteger(d) && d >= 0 && d <= 8)) return false;
  if (!isStartsWith(path, state.zone)) return false;
  if (!isOpen(state.root, path.slice(0, -1))) return false;
  return nodeAt(state.root, path).kind === 'cell' && !isClosed(nodeAt(state.root, path));
}

function place(node: Node, path: Path, player: PlayerId): Node {
  const [digit, ...rest] = path;
  if (node.kind === 'cell' || digit === undefined) return { kind: 'cell', mark: player };
  const children = node.children.map((child, i) =>
    i === digit ? place(child, rest, player) : child,
  );
  const owner = node.owner ?? (hasLine(children, player) ? player : null);
  return { kind: 'board', owner, closed: owner !== null || children.every(isClosed), children };
}

function leafOwners(node: BoardNode, inherited: PlayerId | null, into: (owner: PlayerId | null) => void) {
  const owner = inherited ?? node.owner;
  for (const child of node.children) {
    if (child.kind === 'board') leafOwners(child, owner, into);
  }
  if (node.children[0]?.kind === 'cell') into(owner);
}

export function scores(state: GameState): number[] {
  const totals = state.config.players.map(() => 0);
  leafOwners(state.root, null, (owner) => {
    if (owner !== null) totals[owner] = (totals[owner] ?? 0) + 1;
  });
  return totals;
}

function computeStatus(state: GameState): Status {
  const { root } = state;
  if (root.owner !== null) return { kind: 'won', winners: [root.owner] };
  if (!root.closed) return { kind: 'playing' };
  if (state.config.players.length === 2) return { kind: 'draw' };
  const totals = scores(state);
  const best = Math.max(...totals);
  if (best === 0) return { kind: 'draw' };
  const winners = totals.flatMap((t, i) => (t === best ? [i as PlayerId] : []));
  return { kind: 'won', winners };
}

function resolveZone(root: BoardNode, path: Path): Path {
  let target = path.slice(1);
  while (target.length > 0 && !isOpen(root, target)) target = target.slice(0, -1);
  return target;
}

export function play(state: GameState, path: Path): GameState {
  if (!isLegal(state, path)) return state;
  const root = place(state.root, path, state.turn) as BoardNode;
  const status = computeStatus({ ...state, root });
  const playing = status.kind === 'playing';
  return {
    config: state.config,
    root,
    lastMove: path,
    status,
    turn: playing ? (((state.turn + 1) % state.config.players.length) as PlayerId) : state.turn,
    zone: playing ? resolveZone(root, path) : [],
  };
}

/** Prefix lies inside the playable zone (or contains it) and the board there is open. */
export function isInZone(state: GameState, prefix: Path): boolean {
  if (state.status.kind !== 'playing') return false;
  const related = isStartsWith(prefix, state.zone) || isStartsWith(state.zone, prefix);
  return related && isOpen(state.root, prefix) && boardAt(state.root, prefix) !== null;
}
