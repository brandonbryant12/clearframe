import type { CanvasElement, JsonRecord } from '../types.mjs';
import { item } from '../library.mjs';
import { sketchParams } from './parameters.mjs';
const sketchByName = (name: string) => item('sketches', name);
/** Each moment's time in a drawing: the earliest default second of anything cued on it. */
export function momentTimes(list: CanvasElement[] | undefined) {
  const first: Record<string, number> = {};
  const note = (cue: string | undefined, at: number | undefined) =>
    cue != null &&
    at != null &&
    (first[cue] = Math.min(first[cue] ?? Infinity, at));
  const walk = (l: CanvasElement[] | undefined): void =>
    (l ?? []).forEach((el) => {
      for (const t of [
        el,
        ...(el.keys ?? []),
        ...(el.along ? [el.along] : []),
        ...(el.marks ?? []),
      ])
        if (!Array.isArray(t)) note(t.cue, t.at);
      note(el.exitCue, el.exitAt);
      walk(el.children);
    });
  walk(list);
  return first;
}

/**
 * A sketch's named moments (for sketchSay) with these numbers, in the order they happen (each by its
 * earliest default second). Narration words are filled in this order, so it must be time order, not
 * the order the elements are written in (match draws its TOTAL exit before its coins).
 */
export function sketchMoments(name: string, params: JsonRecord = {}): string[] {
  const s = sketchByName(name);
  if (!s) return [];
  const first = new Map<string, number>(),
    note = (cue: string | undefined, at: number | undefined) =>
      cue != null &&
      first.set(cue, Math.min(first.get(cue) ?? Infinity, at ?? Infinity));
  const walk = (list: CanvasElement[] | undefined): void =>
    (list ?? []).forEach((el) => {
      note(el.cue, el.at);
      for (const k of [...(el.keys ?? []), ...(el.marks ?? [])])
        if (!Array.isArray(k)) note(k.cue, k.at);
      if (el.along) note(el.along.cue, el.along.at ?? el.at);
      note(el.exitCue, el.exitAt);
      walk(el.children);
    });
  try {
    walk(s.build(1920, 1080, { params: sketchParams(s, params) }).elements);
  } catch {
    return [];
  }
  return [...first].sort((a, b) => a[1] - b[1]).map(([cue]) => cue);
}

/**
 * A sketch's placeholder words (CAPS, three or more characters) with these numbers: what `sketchText`
 * replaces. Words the sketch lists in `keepText` (weekday headers) may stay as drawn, so they are left out.
 * (A sketch's `freeMoments` are moments that may land on any word, outside the order `sketchMoments` gives.)
 */
export function sketchWords(name: string, params: JsonRecord = {}): string[] {
  const s = sketchByName(name),
    out = new Set<string>(),
    keep = new Set(s?.keepText ?? []);
  if (!s) return [];
  const walk = (list: CanvasElement[] | undefined): void =>
    (list ?? []).forEach((el) => {
      if (
        el.type === 'text' &&
        el.text != null &&
        /^[A-Z][A-Z0-9_]{2,}$/.test(el.text) &&
        !keep.has(el.text)
      )
        out.add(el.text);
      walk(el.children);
    });
  try {
    walk(s.build(1920, 1080, { params: sketchParams(s, params) }).elements);
  } catch {
    return [];
  }
  return [...out];
}
