import type { JobBeat } from './types.mjs';

/** A scene's exit mirrors the next scene's entrance unless authored. */
export function exitFor(authored: string, next: string | undefined): string {
  if (authored !== 'auto') return authored;
  if (next == null) return 'fade';
  // A wipe's edge crosses this scene held whole, a push carries it off beside the next one and
  // an into goes through it (compose.rs), so it does not leave first.
  if (['cut', 'wipe', 'push', 'into'].includes(next)) return 'none';
  return next;
}

// ------------------------------------------------------------------ across beats

export function mirrorExitStyles(beats: JobBeat[]) {
  for (let i = 0; i + 1 < beats.length; i++)
    if (beats[i + 1].enter_style && beats[i].exit === beats[i + 1].transition)
      beats[i].exit_style = beats[i + 1].enter_style;
}
