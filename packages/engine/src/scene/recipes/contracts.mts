import type { Cue, FrameSize, Staged } from '../types.mjs';

export const STAGE_KEYS = [
  'actors',
  'links',
  'events',
  'code',
  'ground',
  'under',
  'elements',
  'over',
  'camera',
  'shutter',
  'samples',
  'motion',
  'z',
];

export const HEADING_KEYS = ['title', 'kicker', 'source', 'support', 'land'];

export const SLUG = /^[a-z0-9][a-z0-9_-]*$/i;

export interface StageOptions {
  /** Seconds or a spoken word → layer seconds. */
  cue: Cue;
  /** The layer length in seconds. */
  end: number;
  where: string;
  frame: FrameSize;
  staged?: Staged;
  root?: string;
  heading?: boolean;
  notes?: string[];
}
