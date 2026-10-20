import type { CanvasElement, Timed } from '../types.mjs';
import { momentTimes } from './moments.mjs';
export interface SketchFills {
  text?: Record<string, string>;
  say?: Record<string, string>;
}
export function fillSketch(
  list: CanvasElement[] | undefined,
  { text = {}, say = {} }: SketchFills = {},
  cues = new Set<string>(),
  base = momentTimes(list),
): Set<string> {
  for (const el of list ?? []) {
    if (el.type === 'text' && el.text != null && text[el.text] != null)
      el.text = text[el.text];
    for (const t of [
      el,
      ...(el.keys ?? []),
      ...(el.along ? [el.along] : []),
      ...(el.marks ?? []),
    ]) {
      if (!Array.isArray(t)) fillCue(t, say, cues, base);
    }
    fillExit(el, say, cues, base);
    if (el.children) fillSketch(el.children, { text, say }, cues, base);
  }
  removeEmptyText(list);
  return cues;
}

function fillCue(
  t: Timed,
  say: Record<string, string>,
  cues: Set<string>,
  base: Record<string, number>,
): void {
  // A part set some seconds after its moment keeps that offset once the moment is on a word.
  const offset = (cue: string, at: number | undefined) =>
    at != null && base[cue] != null && at - base[cue] > 0.01
      ? Math.round((at - base[cue]) * 1000) / 1000
      : null;
  if (t.cue != null) cues.add(t.cue);
  if (t.cue != null && say[t.cue] != null) {
    t.say = say[t.cue];
    t.after ??= offset(t.cue, t.at) ?? undefined;
    if (t.after === undefined) delete t.after;
    delete t.at;
  } else if (t.cue != null) {
    // `after` keeps an offset from the moment once it lands on a word; with its default
    // seconds the offset is already in `at`.
    delete t.after;
  }
  delete t.cue;
}

function fillExit(
  el: CanvasElement,
  say: Record<string, string>,
  cues: Set<string>,
  base: Record<string, number>,
): void {
  // A part set some seconds after its moment keeps that offset once the moment is on a word.
  const offset = (cue: string, at: number | undefined) =>
    at != null && base[cue] != null && at - base[cue] > 0.01
      ? Math.round((at - base[cue]) * 1000) / 1000
      : null;
  if (el.exitCue != null) cues.add(el.exitCue);
  if (el.exitCue != null && say[el.exitCue] != null) {
    el.exitSay = say[el.exitCue];
    const off = el.exitAfter ?? offset(el.exitCue, el.exitAt);
    if (off != null) el.exitAfter = off;
    delete el.exitAt;
  }
  delete el.exitCue;
}

function removeEmptyText(list: CanvasElement[] | undefined): void {
  // An empty word ("EACH": "") takes that line of type out of the drawing; it used to fail later
  // as "text needs text or count".
  if (Array.isArray(list))
    for (let i = list.length - 1; i >= 0; i--) {
      const el = list[i];
      if (el.type === 'text' && typeof el.text === 'string' && !el.text.trim())
        list.splice(i, 1);
    }
}
