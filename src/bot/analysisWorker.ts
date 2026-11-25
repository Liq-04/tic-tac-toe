import type { Config, Path } from '../game';
import { roundChances } from './analysis';

export interface AnalysisRequest {
  config: Config;
  history: readonly Path[];
}

self.onmessage = ({ data }: MessageEvent<AnalysisRequest>) => {
  for (const result of roundChances(data.config, data.history)) self.postMessage(result);
  self.close();
};
