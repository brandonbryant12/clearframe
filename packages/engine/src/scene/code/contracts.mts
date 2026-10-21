import type { Cue, StageArea, Staged } from '../types.mjs';

export type DiffOp =
  | { op: 'keep'; a: number; b: number }
  | { op: 'del'; a: number }
  | { op: 'add'; b: number };

export interface GitSidesInput {
  repo: string;
  commit: string;
  base?: string;
  file: string;
}

export interface GitSides {
  commit: string;
  base: string;
  file: string;
  oldBlob: string | null;
  newBlob: string | null;
  before: string;
  after: string;
}

export interface CodeOptions {
  cue: Cue;
  where: string;
  staged?: Staged;
  root?: string;
  area?: StageArea | null;
}
