import { DEPTH, LINES } from '../game/game';
import type { Config, GameState, Mode, Node, Path } from '../game/types';
import type { Rng } from './rng';

export type Move = number;

const FULL = 511;
const MAX_PLAYERS = 4;
const CLOSED = MAX_PLAYERS;
const STRIDE = CLOSED + 1;

const TURN = 0;
const ZONE = 1;
const OVER = 2;
const WINNER = 3;
const NO_WINNER = -1;

const WIN_SHARE = 0.9;
const LEAF_SHARE = 0.1;

const WIN = new Uint8Array(512);
const POP = new Uint8Array(512);
const NTH = new Uint8Array(512 * 16);
for (let m = 0; m < 512; m++) {
  for (const [a, b, c] of LINES) if ((m >> a) & (m >> b) & (m >> c) & 1) WIN[m] = 1;
  let k = 0;
  for (let i = 0; i < 9; i++) if ((m >> i) & 1) NTH[(m << 4) | k++] = i;
  POP[m] = k;
}

interface Geometry {
  depth: number;
  boards: number;
  firstLeaf: number;
  leaves: number;
  cells: number;
  parent: Uint8Array;
  slot: Uint8Array;
  leafOf: Uint8Array;
  nextLeaf: Uint8Array;
}

function geometry(depth: number): Geometry {
  const cells = 9 ** depth;
  const leaves = cells / 9;
  const boards = (cells - 1) / 8;
  const firstLeaf = (leaves - 1) / 8;
  const parent = new Uint8Array(boards);
  const slot = new Uint8Array(boards);
  for (let b = 1; b < boards; b++) {
    parent[b] = ((b - 1) / 9) | 0;
    slot[b] = (b - 1) % 9;
  }
  const leafOf = new Uint8Array(cells);
  const nextLeaf = new Uint8Array(cells);
  for (let m = 0; m < cells; m++) {
    leafOf[m] = firstLeaf + ((m / 9) | 0);
    nextLeaf[m] = firstLeaf + (m % leaves);
  }
  return { depth, boards, firstLeaf, leaves, cells, parent, slot, leafOf, nextLeaf };
}

const GEOMETRY: Record<Mode, Geometry> = {
  ultimate: geometry(DEPTH.ultimate),
  omega: geometry(DEPTH.omega),
};

export class FastBoard {
  readonly g: Geometry;
  readonly config: Config;
  readonly players: number;
  readonly cells: number;
  readonly s: Uint16Array;
  private readonly tail: number;
  private readonly scratchLeaf = new Uint8Array(81);
  private readonly scratchCount = new Uint8Array(81);
  private readonly scratchTotals = new Float32Array(MAX_PLAYERS);
  private nLeaves = 0;

  constructor(config: Config) {
    this.config = config;
    this.g = GEOMETRY[config.mode];
    this.players = config.players.length;
    this.cells = this.g.cells;
    this.tail = this.g.boards * STRIDE;
    this.s = new Uint16Array(this.tail + WINNER + 1);
  }

  static fromGame(state: GameState): FastBoard {
    const fb = new FastBoard(state.config);
    const s = fb.s;
    const walk = (node: Node, b: number) => {
      if (node.kind !== 'board') return;
      node.children.forEach((child, i) => {
        const claimant = child.kind === 'cell' ? child.mark : child.owner;
        const closed = child.kind === 'cell' ? child.mark !== null : child.closed;
        if (claimant !== null) s[b * STRIDE + claimant]! |= 1 << i;
        if (closed) s[b * STRIDE + CLOSED]! |= 1 << i;
        walk(child, 9 * b + 1 + i);
      });
    };
    walk(state.root, 0);
    s[fb.tail + TURN] = state.turn;
    let zone = 0;
    for (const d of state.zone) zone = 9 * zone + 1 + d;
    s[fb.tail + ZONE] = zone;
    s[fb.tail + OVER] = state.root.closed ? 1 : 0;
    s[fb.tail + WINNER] = state.root.owner === null ? 0 : state.root.owner + 1;
    return fb;
  }

  blank(): FastBoard {
    return new FastBoard(this.config);
  }

  copyFrom(other: FastBoard): void {
    this.s.set(other.s);
  }

  sameAs(other: FastBoard): boolean {
    if (other.s.length !== this.s.length) return false;
    for (let i = 0; i < this.s.length; i++) if (this.s[i] !== other.s[i]) return false;
    return true;
  }

  get zone(): number {
    return this.s[this.tail + ZONE]!;
  }

  get over(): boolean {
    return this.s[this.tail + OVER] === 1;
  }

  get winner(): number {
    return this.s[this.tail + WINNER]! - 1;
  }

  get toMove(): number {
    return this.s[this.tail + TURN]!;
  }

  play(move: Move): void {
    const s = this.s;
    const g = this.g;
    const tail = this.tail;
    const p = s[tail + TURN]!;
    let b = g.leafOf[move]!;
    let bit = 1 << (move % 9);
    let over = false;
    let claim = true;
    for (;;) {
      const at = b * STRIDE;
      s[at + CLOSED]! |= bit;
      let won = false;
      if (claim) {
        const mine = (s[at + p]! |= bit);
        won = WIN[mine] === 1;
      }
      if (!won && s[at + CLOSED] !== FULL) break;
      if (b === 0) {
        over = true;
        s[tail + OVER] = 1;
        s[tail + WINNER] = won ? p + 1 : 0;
        break;
      }
      bit = 1 << g.slot[b]!;
      b = g.parent[b]!;
      claim = won;
    }
    if (over) {
      s[tail + ZONE] = 0;
      return;
    }
    s[tail + TURN] = (p + 1) % this.players;
    s[tail + ZONE] = this.resolveZone(move);
  }

  private resolveZone(move: Move): number {
    const s = this.s;
    const g = this.g;
    let z = g.nextLeaf[move]!;
    for (let c = z; c !== 0; ) {
      const par = g.parent[c]!;
      if ((s[par * STRIDE + CLOSED]! >> g.slot[c]!) & 1) z = par;
      c = par;
    }
    return z;
  }

  private openLeaves(): number {
    const s = this.s;
    const g = this.g;
    const z = s[this.tail + ZONE]!;
    const leaves = this.scratchLeaf;
    const counts = this.scratchCount;
    let n = 0;
    let total = 0;
    if (z >= g.firstLeaf) {
      leaves[0] = z;
      total = counts[0] = POP[FULL ^ s[z * STRIDE + CLOSED]!]!;
      n = 1;
    } else if (9 * z + 1 >= g.firstLeaf) {
      const closed = s[z * STRIDE + CLOSED]!;
      for (let i = 0; i < 9; i++) {
        if ((closed >> i) & 1) continue;
        const leaf = 9 * z + 1 + i;
        const c = POP[FULL ^ s[leaf * STRIDE + CLOSED]!]!;
        leaves[n] = leaf;
        counts[n++] = c;
        total += c;
      }
    } else {
      const top = s[z * STRIDE + CLOSED]!;
      for (let i = 0; i < 9; i++) {
        if ((top >> i) & 1) continue;
        const mid = 9 * z + 1 + i;
        const closed = s[mid * STRIDE + CLOSED]!;
        for (let j = 0; j < 9; j++) {
          if ((closed >> j) & 1) continue;
          const leaf = 9 * mid + 1 + j;
          const c = POP[FULL ^ s[leaf * STRIDE + CLOSED]!]!;
          leaves[n] = leaf;
          counts[n++] = c;
          total += c;
        }
      }
    }
    this.nLeaves = n;
    return total;
  }

  legalMoves(out: Uint16Array): number {
    this.openLeaves();
    const s = this.s;
    const first = this.g.firstLeaf;
    let n = 0;
    for (let i = 0; i < this.nLeaves; i++) {
      const leaf = this.scratchLeaf[i]!;
      const free = FULL ^ s[leaf * STRIDE + CLOSED]!;
      const base = (leaf - first) * 9;
      const count = POP[free]!;
      for (let k = 0; k < count; k++) out[n++] = base + NTH[(free << 4) | k]!;
    }
    return n;
  }

  randomMove(rng: Rng): Move {
    const s = this.s;
    const g = this.g;
    const z = s[this.tail + ZONE]!;
    if (z >= g.firstLeaf) {
      const free = FULL ^ s[z * STRIDE + CLOSED]!;
      return (z - g.firstLeaf) * 9 + NTH[(free << 4) | rng.below(POP[free]!)]!;
    }
    let r = rng.below(this.openLeaves());
    let i = 0;
    while (r >= this.scratchCount[i]!) r -= this.scratchCount[i++]!;
    const leaf = this.scratchLeaf[i]!;
    const free = FULL ^ s[leaf * STRIDE + CLOSED]!;
    return (leaf - g.firstLeaf) * 9 + NTH[(free << 4) | r]!;
  }

  playout(rng: Rng): void {
    const tail = this.tail;
    const s = this.s;
    while (s[tail + OVER] === 0) this.play(this.randomMove(rng));
  }

  scores(out: Float32Array): void {
    const s = this.s;
    const g = this.g;
    const winner = this.winner;
    let owned = 0;
    for (let q = 0; q < this.players; q++) owned |= s[q]!;
    for (let p = 0; p < this.players; p++) {
      if (winner !== NO_WINNER) {
        out[p] = p === winner ? g.leaves : 0;
      } else if (g.depth === 2) {
        out[p] = POP[s[p]!]!;
      } else {
        let total = 9 * POP[s[p]!]!;
        for (let i = 0; i < 9; i++) {
          if ((owned >> i) & 1) continue;
          total += POP[s[(1 + i) * STRIDE + p]!]!;
        }
        out[p] = total;
      }
    }
  }

  /** Each seat's share of the win in a finished game: 1 for a sole winner, split on a tie, all 0 for a draw. */
  winShares(out: Float32Array): void {
    const n = this.players;
    const winner = this.winner;
    if (n === 2 || winner !== NO_WINNER) {
      for (let p = 0; p < n; p++) out[p] = p === winner ? 1 : 0;
      return;
    }
    this.scores(out);
    let best = 0;
    let ties = 0;
    for (let p = 0; p < n; p++) {
      if (out[p]! > best) {
        best = out[p]!;
        ties = 1;
      } else if (out[p] === best) ties++;
    }
    for (let p = 0; p < n; p++) out[p] = best > 0 && out[p] === best ? 1 / ties : 0;
  }

  reward(out: Float32Array): void {
    const n = this.players;
    this.winShares(out);
    let drawn = true;
    for (let p = 0; p < n; p++) if (out[p]! > 0) drawn = false;
    if (drawn) for (let p = 0; p < n; p++) out[p] = 1 / n;
    if (n === 2) return;
    const totals = this.scratchTotals;
    this.scores(totals);
    const leaves = this.g.leaves;
    for (let p = 0; p < n; p++) out[p] = WIN_SHARE * out[p]! + (LEAF_SHARE * totals[p]!) / leaves;
  }

  toPath(move: Move): Path {
    const path: number[] = [];
    for (let i = 0; i < this.g.depth; i++) {
      path.unshift(move % 9);
      move = (move / 9) | 0;
    }
    return path;
  }
}
