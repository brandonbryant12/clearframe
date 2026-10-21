import type { CanvasElement } from './types.mjs';
import { eachElement } from './canvas-traverse.mjs';

/** Latest scheduled entrance start (for too-late checks). */
export function latestEntrance(list: CanvasElement[]): {
  at: number;
  end: number;
} {
  let latest = { at: 0, end: 0 };
  eachElement(list, (el) => {
    // Scheduled elements carry at and dur (scheduleElements).
    const at = el.at ?? 0,
      end = at + (el.dur ?? 0);
    if (end > latest.end) latest = { at, end };
  });
  return latest;
}

/** True when any element reacts to the narration's loudness. */
export const usesLevels = (
  list: CanvasElement[] | null | undefined,
): boolean => {
  let found = false;
  eachElement(list, (el) => {
    if (el.type === 'meter' || el.loop?.type === 'level') found = true;
  });
  return found;
};

export const hasCount = (list: CanvasElement[] | null | undefined): boolean => {
  let found = false;
  eachElement(list, (el) => {
    if (el.type === 'text' && el.count) found = true;
  });
  return found;
};

export const hasDigits = (
  list: CanvasElement[] | null | undefined,
): boolean => {
  let found = false;
  eachElement(list, (el) => {
    // Chapter numbering ("01 · Software", "2. Tools") is not a figure.
    const text = String(el.text ?? '').replace(
      /^\s*\d{1,2}\s*[·.)\-–—:]\s*/,
      '',
    );
    // A lone digit is an index (a step, a tile, a list position), not a figure.
    if (el.type === 'text' && /\d/.test(text) && !/^\s*\d\s*$/.test(text))
      found = true;
    if (
      el.type === 'document' &&
      el.sections?.some((sec) => /\d/.test(`${sec.heading ?? ''} ${sec.text}`))
    )
      found = true;
  });
  return found;
};
