import type { Motion } from '../../film/types.mjs';
import type {
  Footage,
  FrameSize,
  LayerCue,
  LayerProvenance,
  PlanContext,
  PlanLayer,
} from '../types.mjs';

export const PLAN_KIND = 'clearframe.scene';

export const PLAN_VERSION = 1;

export const STAGE_HEADING = ['title', 'kicker', 'source', 'support', 'land'];

export const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;

export interface PlanBuild {
  ctx: PlanContext;
  fps: number;
  frame: FrameSize;
  warnings: string[];
  footage: Footage[];
  provenance: LayerProvenance[];
  layers: PlanLayer[];
  settle: Record<string, number>;
}

export interface LayerInput {
  id: string;
  spec: unknown;
  start: number;
  frames: number;
  /** The beat a layer belongs to; none for a film stage spanning beats. */
  beat?: string;
  z: unknown;
  cue: LayerCue;
  where: string;
  fade: [number, number];
  heading: boolean;
  motion: Motion;
}
