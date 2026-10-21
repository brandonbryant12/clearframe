import type { Author, Keep } from './notes-model.mjs';

export interface KeepViolation {
  keep: string;
  what: string;
  beat?: string;
  message: string;
}

export interface KeepConflict {
  keep: Keep;
  beats: string[];
}

export interface KeepRequest {
  what: string;
  beats?: string[] | null;
  film?: boolean;
  revision?: string;
  by: Author | null | undefined;
  said?: string;
  note?: string;
}
