// Film models: the storyboard and timing as film reads them, the canvas element dialect, block
// props, the native job the renderer draws, and library items. Types only.
//
// Authored values are validated where they enter (catalog.mjs, validators.mjs, canvas.mjs and
// each structured chart's spec function); these interfaces describe what those checks accept.
// Fields a validator fills (defaults, resolved times) are optional here unless every path that
// produces the value sets them.

// ------------------------------------------------------------------ basics

/** A JSON object whose fields are still to be checked. */
export type JsonRecord = Record<string, unknown>;

/** Throws with the caller's context: `fail(message)` never returns. */
export type Fail = (message: string) => never;

/** [x, y] in frame or world pixels. */
export type Point = [number, number];

/** A camera rect [x, y, w, h]. */
export type Rect = [number, number, number, number];

/** Scene seconds or a spoken word/phrase of the beat's narration. */
export type Cue = number | string;

/** Resolves a cue to scene seconds; `fallback` when it is null. */
export type CueResolver = (
  value: Cue | null | undefined,
  fallback?: number,
) => number;

export interface FrameSize {
  width: number;
  height: number;
}

/** When something happens: scene seconds, a spoken word, or a named moment (plus `after`). */
export interface Timed {
  at?: number;
  say?: string;
  cue?: string;
  after?: number;
  dur?: number;
}
