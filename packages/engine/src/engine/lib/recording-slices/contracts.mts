import type { TranscriptWord } from '../recording-model.mjs';

// seconds faded at each join, inside the pause, so a join never clicks

/** The master's samples (16-bit mono) and its identity. */
export interface SourceAudio {
  file: string;
  rate: number;
  pcm: Buffer;
  samples: number;
  sha: string;
}

export interface SamplePiece {
  from: number;
  to: number;
}

export interface PadPiece {
  pad: number;
}

export type Piece = SamplePiece | PadPiece;

export interface Clock {
  rate: number;
  fps: number;
}

export interface SegmentMap {
  at: number;
  from: number;
  to: number;
}

export type KeptWord = TranscriptWord & { index: number };

export interface MasterState {
  sha: string | null;
  recorded: string | null;
  problem: string | null;
}

export interface PlacedPiece extends SamplePiece {
  at: number;
}

export interface SliceSamples {
  out: Buffer;
  placed: PlacedPiece[];
  length: number;
}
