import type { Film, Version } from './00-boundary-films.js';

import type { Job } from './00-boundary-agent.js';

import type { AgentState } from './40-agent.js';

import type { NotesColumn } from './10-notes.js';

// One film: the picture, a filmstrip to find your place, sticky notes, and the agent.
// Click anywhere on the picture to leave a note on that spot at that moment; send your notes to
// the agent; watch the version it makes. Before the first cut, the film shows its brief and boards.
export type Tab = 'notes' | 'agent';

/** The keys the page answers while no field has focus. */
export interface PageKeys {
  toggle?: () => void;
  nudge?: (s: number) => void;
  note?: () => void;
}

/** The film on screen. Async work checks it is still the current one before touching the page. */
export interface FilmSession {
  id: string;
  f: Film;
  v: Version | null;
  withAgent: boolean;
  time: () => number;
  disposed: boolean;
  jobs: Job[];
  agent?: AgentState;
  notesChanged?: () => void;
  drawMarks?: () => void;
}

export const TABS: readonly Tab[] = ['notes', 'agent'];

export const tabOf = (value: string | null | undefined) =>
  TABS.find((t) => t === value) ?? null;

export const LIVE_JOBS = ['queued', 'waiting', 'running'];

// ---------------------------------------------------------------- the picture

/** The picture's parts, shared by the strip, the stickies on it and the transport. */
export interface PictureView {
  f: Film;
  v: Version;
  T: number;
  W: number;
  H: number;
  notes: NotesColumn;
  seek: (t: number) => void;
  video: HTMLVideoElement;
  layer: HTMLElement;
  bigplay: HTMLButtonElement;
}

export interface PicturePins {
  draw: (force?: boolean) => void;
  close: () => void;
}
