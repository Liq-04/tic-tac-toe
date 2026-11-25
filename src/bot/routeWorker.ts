import type { GameState, Path } from '../game';
import { bestRoute } from './route';

export interface RouteRequest {
  state: GameState;
  first: Path;
}

self.onmessage = ({ data }: MessageEvent<RouteRequest>) => {
  for (const step of bestRoute(data.state, data.first)) self.postMessage(step);
  self.close();
};
