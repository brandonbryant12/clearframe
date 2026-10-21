import type { Decision } from './notes-model.mjs';
export interface Milestone {
  state: 'none' | 'broken' | 'stale' | 'output' | 'current';
  closed: boolean;
  detail: string;
  revision?: string;
  video?: string;
  human?: Decision | null;
  agent?: Decision | null;
  verdict?: Decision | null;
}
export interface ChapterCoverage {
  chapter: string;
  beats: number;
  placeholders: number;
  unfinished: number;
  pictured: number;
  accepted: number;
}
export interface Checkpoint {
  id: string;
  name: string;
  ask: boolean;
  done: boolean;
  detail: string;
  question: string;
  decision?: Decision | null;
}
