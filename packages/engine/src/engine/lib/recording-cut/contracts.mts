import type { EditAuthor, Removal } from '../recording-model.mjs';

/** One beat's share of a planned cut: deleted whole, or a removal from its slice. */
export interface CutPart {
  beat: string;
  deleted?: boolean;
  removal?: Removal;
  frames: number;
  seconds: number;
  span?: number[];
  indices: number[];
  pieces?: number[][];
}

export interface CutReport {
  id: string;
  op: 'cut' | 'pauses';
  words: string;
  over?: number;
  keep?: number;
  beats: CutPart[];
  frames: number;
  seconds: number;
}

export interface EditOptions {
  by?: EditAuthor;
  note?: string;
  dryRun?: boolean;
}

export const AGENT: EditAuthor = { role: 'agent' };
