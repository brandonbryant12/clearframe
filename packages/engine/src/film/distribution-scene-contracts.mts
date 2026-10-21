import type {
  DistributionBin,
  DistributionObservation,
} from './distribution-data.mjs';
import type { distributionContext } from './distribution-scene-context.mjs';
/** Where each bar, sample and threshold is drawn, for checks and reviews. */
export interface DistributionGeometry {
  bars: Array<DistributionBin & { box: number[]; at: number; end: number }>;
  points: Array<
    DistributionObservation & {
      point: number[];
      r: number;
      selected: boolean | null;
      at: number;
    }
  >;
  threshold: {
    x: number;
    segments: number[][];
    at: number;
    end: number;
  } | null;
}
export interface DistributionSceneOptions {
  width: number;
  height: number;
  id: string;
  focus?: boolean;
  reveal?: boolean;
}
export type DistributionContext = ReturnType<typeof distributionContext>;
