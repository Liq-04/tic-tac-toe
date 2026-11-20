export type PlayerId = 0 | 1 | 2 | 3;
export type Mode = 'ultimate' | 'omega';
export type Path = readonly number[];

export type Node =
  | { readonly kind: 'cell'; readonly mark: PlayerId | null }
  | {
      readonly kind: 'board';
      readonly owner: PlayerId | null;
      /** Owned, or every child closed/filled. Ancestor closure is checked by walking the path. */
      readonly closed: boolean;
      readonly children: readonly Node[];
    };

export type BoardNode = Extract<Node, { kind: 'board' }>;

export interface PlayerInfo {
  name: string;
  /** The offline bot plays this seat. */
  bot?: true;
}

export interface Config {
  mode: Mode;
  players: readonly PlayerInfo[];
}

export type Status =
  | { kind: 'playing' }
  | { kind: 'won'; winners: readonly PlayerId[] }
  | { kind: 'draw' };

export interface GameState {
  config: Config;
  root: BoardNode;
  turn: PlayerId;
  /** Prefix the current player must play inside; [] means anywhere. */
  zone: Path;
  lastMove: Path | null;
  status: Status;
}
