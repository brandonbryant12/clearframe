// Cues against narration: a position named by a word or a landmark of the beat, and how long a
// beat's word-cued type needs to stay up to be read.
import { sketch } from '../../film/sketches.mjs';
import type { Beat, Count, Element, TimeRange, Word } from '../domain.mjs';
import { round } from './util.mjs';
import { wordKey } from './word-timing.mjs';

/** A beat (or anything shaped like one) that cues can be resolved against. */
export interface CueBeat extends TimeRange {
  vo?: { start: number; end: number; words: readonly Word[] };
}

/** A word as a cue search reads it: its text and when it starts. */
interface WordStart {
  w: string;
  t0: number;
}

/** Resolve a cue position: seconds after beat start, "word:<text>", "vo", "vo-end" or "end". */
export function resolveAt(at: number | string, beat: CueBeat): number {
  if (typeof at === 'number') return round(beat.start + at);
  const s = String(at);
  if (s === 'vo') return beat.vo?.start ?? beat.start;
  if (s === 'vo-end') return beat.vo?.end ?? beat.end;
  if (s === 'end') return beat.end;
  const m = s.match(/^word:(.+?)(?:\+(-?[\d.]+))?$/);
  if (m && beat.vo) {
    const t = findWord(beat.vo.words, m[1]);
    return round((t ?? beat.vo.start) + (m[2] ? parseFloat(m[2]) : 0));
  }
  return beat.start;
}

/** The start of the `nth` (from 0) run of `list` that spells the normalized query, or null. */
function searchWords(
  list: readonly WordStart[],
  q: readonly string[],
  want: number,
): number | null {
  let seen = 0;
  for (let i = 0; i + q.length <= list.length; i++) {
    if (q.every((part, j) => wordKey(list[i + j].w) === part)) {
      if (seen++ === want) return list[i].t0;
    }
  }
  return null;
}

export function findWord(
  words: readonly WordStart[],
  query: string,
  nth = 0,
): number | null {
  const q = query.split(/\s+/).map(wordKey).filter(Boolean);
  if (!q.length) return null;
  // A cue can name part of a hyphenated or slashed word ("approved" in "pre-approved"), but only
  // when no whole word matches: "fifty" is the whole word, not the start of "fifty-six".
  const whole = searchWords(words, q, 0);
  if (whole != null) return nth === 0 ? whole : searchWords(words, q, nth);
  return searchWords(
    words.flatMap((w) =>
      String(w.w)
        .split(/[-–—/]/)
        .filter(Boolean)
        .map((part) => ({ w: part, t0: w.t0 })),
    ),
    q,
    nth,
  );
}

/** Anything cued to a word that holds on screen after it: an element, its keys, its children. */
interface WordCued {
  say?: string;
  after?: number;
  dur?: number;
  keys?: readonly WordCued[];
  children?: readonly WordCued[];
}

/** The number a counting element finishes on; a bare number has no `to`. */
const countTo = (count: Count | number | undefined): number | undefined =>
  typeof count === 'object' ? count.to : undefined;

/** Seconds a line of type needs on screen to be read. */
const readTime = (text: string | number): number =>
  Math.max(1.3, String(text).split(/\s+/).length / 3 + 0.6);

/** When the last word-cued text element (or chart note) of a beat has been read. */
function typeReadUntil(b: Beat, words: readonly Word[]): number {
  let until = 0;
  const cued = (
    say: string | undefined,
    text: string | number | undefined,
  ): void => {
    const t = typeof say === 'string' ? findWord(words, say) : null;
    if (t != null && text) until = Math.max(until, t + readTime(text));
  };
  const walk = (list: readonly Element[] | undefined): void =>
    (list ?? []).forEach((el) => {
      if (el.type === 'text') cued(el.say, el.text ?? countTo(el.count));
      walk(el.children);
    });
  walk(b.props?.elements);
  walk(b.art?.under);
  walk(b.art?.over);
  if (b.props?.chart?.note)
    cued(b.props.chart.note.say, b.props.chart.note.text);
  return until;
}

/** A beat's sketch as drawn, or null when it does not draw. */
function drawnSketch(b: Beat): { elements?: readonly WordCued[] } | null {
  if (!b.props?.sketch || !b.props.sketchSay) return null;
  try {
    return sketch(b.props.sketch, 'landscape', {
      text: b.props.sketchText,
      say: b.props.sketchSay,
      params: b.props.sketchParams,
    });
  } catch {
    return null;
  }
}

/** When the last word-cued moment of a beat's sketch has landed. */
function sketchLandsBy(b: Beat, words: readonly Word[]): number {
  let until = 0;
  const land = (list: readonly WordCued[] | undefined): void =>
    (list ?? []).forEach((el) => {
      for (const t of [el, ...(el.keys ?? [])]) {
        const at = typeof t.say === 'string' ? findWord(words, t.say) : null;
        if (at != null)
          until = Math.max(until, at + (t.after ?? 0) + (t.dur ?? 0.5) + 0.6);
      }
      land(el.children);
    });
  land(drawnSketch(b)?.elements);
  return until;
}

/** When the last narration-cued line of type in a beat has been on screen long enough to read. */
export function readUntil(b: Beat, words: readonly Word[]): number {
  // A sketch's moments land on words with offsets after them (a coin drops 0.45 s after its word,
  // the view leans in after the save): the beat lasts until the last of them has landed, instead
  // of failing when the moment is on the narration's last word.
  return Math.max(typeReadUntil(b, words), sketchLandsBy(b, words));
}
