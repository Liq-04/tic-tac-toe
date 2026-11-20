import type { GameState, Path } from '../game';
import { chooseMove } from './mcts';

export interface ThinkRequest {
  state: GameState;
  seed: number;
  budgetMs: number;
}

export interface ThinkReply {
  path: Path;
  iterations: number;
}

self.onmessage = ({ data }: MessageEvent<ThinkRequest>) => {
  const reply: ThinkReply = chooseMove(data.state, { seed: data.seed, budget: { kind: 'time', ms: data.budgetMs } });
  self.postMessage(reply);
};
