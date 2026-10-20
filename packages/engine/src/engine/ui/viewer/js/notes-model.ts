import type { Spot, Film, Version } from './00-boundary-films.js';

// Sticky notes: a moment (or a scene, or the whole film), an optional spot on the picture, and
// words for the agent. Saved in the film's review record when served; kept in this browser otherwise.
// States: open; changed (the agent says it acted, with one line on what it did); done.
export type NoteState = 'open' | 'changed' | 'done';

/** What a sticky's buttons do to its note. */
export type NoteAct = 'done' | 'open' | 'removed';

/** A note as the list shows it: saved in the film, or kept in this browser (`local`). */
export interface Note {
  id: string;
  text: string;
  state: NoteState;
  local?: boolean;
  version?: string | null;
  at?: number | null;
  scene?: string | null;
  spot?: Spot | null;
  pin?: Spot | null;
  on?: string | null;
  element?: string | null;
  by?: string | null;
  changedIn?: string | null;
  answer?: string | null;
}

/** What a new note is about: a moment of a version, a scene on the boards, or the whole film. */
export interface NoteAnchor {
  version?: string | null;
  at?: number | null;
  scene?: string | null;
}

/** A note left on the picture: its words, its spot, and the words or element under it. */
export interface NoteExtra {
  text?: string;
  spot?: Spot;
  on?: string;
  element?: string;
}

export interface NewNote extends NoteAnchor {
  text: string;
  spot?: Spot;
  on?: string;
  element?: string;
}

// ---------------------------------------------------------------- the notes list
export interface NotesColumnOptions {
  f: Film;
  v: Version | null;
  placeholder: string;
  /** What a new note is about now: {version, at} for a video, {scene} on boards. */
  anchor: () => NoteAnchor;
  /** How the composer chip reads ("At 0:12", "Scene 3"). */
  anchorLabel: () => string;
  /** Show a note's moment or scene. */
  seek: (n: Note) => void;
  /** Redraw what shows notes elsewhere (filmstrip markers, stickies on the picture). */
  changed?: () => void;
  onTyping?: () => void;
  /** Hand open notes to the agent. */
  send: (notes: Note[]) => void;
}

export interface NotesColumn {
  redraw(): void;
  save(extra?: NoteExtra): Promise<boolean>;
  numbers(): Map<string, number>;
  focus(): void;
  anchorMoved(): void;
  highlight(id: string): void;
}
