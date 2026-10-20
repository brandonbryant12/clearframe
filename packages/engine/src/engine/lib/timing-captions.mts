// Captions to a broadcast standard, after Netflix's English timed-text style guide: at most two
// lines of 42 characters (28 on a vertical frame), one sentence per caption where it fits, lines
// broken where a reader would pause, at most 20 characters a second, on screen 5/6 s to 7 s,
// 2 frames apart, and never across a cut.
import type { Word } from '../domain.mjs';

/** A caption: film seconds and its text, optionally already broken into lines. */
export interface CaptionText {
  start: number;
  end: number;
  text: string;
  lines?: readonly string[];
}
export interface CaptionCue extends CaptionText {
  lines: string[];
}
/** What captions need from a timeline. */
export interface CaptionTiming {
  fps?: number;
  width: number;
  height: number;
  beats: readonly { end: number; vo?: { words: readonly Word[] } }[];
}

const CPS = 20;
const MIN_CAPTION = 5 / 6;
const MAX_CAPTION = 7;
// A caption or a line should not end on these: they belong with the word after them.
const LEANS = new Set(
  'a an the of to in on at by for with from into onto as and or but nor so if than that which who whose whom when where while because my your our their his her its this these those is are was were be been being am will would can could should shall may might must has have had do does did not no'.split(
    ' ',
  ),
);
// A line may start with these: a conjunction or preposition opens the next phrase.
// (Not "of": it binds a noun phrase, "a pile of forms".)
const OPENS = new Set(
  'and or but nor so because which who whose whom when where while if than that to in on at by for with from into as'.split(
    ' ',
  ),
);
const bare = (w: string): string =>
  w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
const clause = (w: string): boolean => /[,;:—–]["”’)]?$/.test(w);
const sentence = (w: string): boolean => /[.!?…]["”’)]?$/.test(w);
const last = <T,>(list: readonly T[]): T => list[list.length - 1];
const joined = (ws: readonly Word[]): string => ws.map((w) => w.w).join(' ');

/** How well a word ends a line or caption: a sentence end, then a clause end. */
function endWeight(w: string, onSentence: number, onClause: number): number {
  if (sentence(w)) return onSentence;
  return clause(w) ? onClause : 0;
}

/** The best place to break `words` into two lines of at most `max` characters, or null. With
 *  `strict`, a break that would end a line on a word leaning on the next does not count. */
export function captionLines(
  words: readonly string[],
  max = 42,
  { strict = false }: { strict?: boolean } = {},
): string[] | null {
  const text = words.join(' ');
  if (text.length <= max || words.length < 2) return [text];
  let best: { score: number; lines: string[] } | null = null;
  for (let k = 1; k < words.length; k++) {
    const [a, b] = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
    if (a.length > max || b.length > max) continue;
    const end = words[k - 1];
    // Balanced lines first (a long top line over a short one is the worst shape), then the
    // grammar of the break.
    const score =
      endWeight(end, 5, 3) +
      (OPENS.has(bare(words[k])) ? 1 : 0) -
      (LEANS.has(bare(end)) ? 5 : 0) -
      (4 * Math.abs(a.length - b.length)) / max +
      (b.length >= a.length ? 0.3 : 0);
    if (!best || score > best.score) best = { score, lines: [a, b] };
  }
  return best && !(strict && best.score < -2) ? best.lines : null;
}

/** Where to end a caption that has run out of room: after punctuation, before a new phrase,
 *  never on a word that leans on the next, and not so early that a scrap is left on screen. */
function captionEnd(ws: readonly Word[], maxChars = 42): number {
  let best = { k: ws.length, score: -Infinity };
  for (let k = 1; k <= ws.length; k++) {
    const end = ws[k - 1].w,
      next: string | undefined = ws[k]?.w,
      chars = joined(ws.slice(0, k)).length;
    const score =
      endWeight(end, 6, 4) +
      (next && OPENS.has(bare(next)) ? 2 : 0) -
      (LEANS.has(bare(end)) ? 5 : 0) +
      (0.8 * k) / ws.length -
      (!sentence(end) && chars < maxChars * 0.6 ? 3 : 0);
    if (score > best.score) best = { k, score };
  }
  return best.k;
}

/** One beat's spoken words grouped into captions that fit `chars`-wide lines. */
function captionGroups(words: readonly Word[], chars: number): Word[][] {
  const fits = (ws: readonly Word[]): boolean =>
    captionLines(
      ws.map((w) => w.w),
      chars,
      { strict: true },
    ) != null;
  const groups: Word[][] = [];
  let cur: Word[] = [];
  for (const w of words) {
    const prev: Word | undefined = cur[cur.length - 1];
    // A long pause starts a new caption; so does running out of two lines or seven seconds.
    const paused = !!prev && w.t0 - prev.t1 > 0.7;
    if (
      prev &&
      (paused || !fits([...cur, w]) || w.t1 - cur[0].t0 > MAX_CAPTION)
    ) {
      const k = paused ? cur.length : captionEnd(cur, chars);
      groups.push(cur.slice(0, k));
      cur = cur.slice(k);
    }
    cur.push(w);
    // One sentence per caption: a short one waits for the next if both fit and follow closely.
    const short = joined(cur).length < 16 && w.t1 - cur[0].t0 < MIN_CAPTION;
    if (sentence(w.w) && !short) {
      groups.push(cur);
      cur = [];
    }
  }
  if (cur.length) groups.push(cur);
  return joinFragments(groups, fits).filter((g) => g.length);
}

/** A fragment too short to read (a word stranded by a pause) joins the caption after it. */
function joinFragments(
  groups: Word[][],
  fits: (ws: readonly Word[]) => boolean,
): Word[][] {
  for (let i = 0; i < groups.length - 1; i++) {
    const [g, h] = [groups[i], groups[i + 1]];
    if (
      last(g).t1 - g[0].t0 < MIN_CAPTION &&
      h[0].t0 - last(g).t1 < 1.5 &&
      fits([...g, ...h])
    ) {
      groups.splice(i, 2, [...g, ...h]);
      i--;
    }
  }
  return groups;
}

/** Readable: long enough for its words and for the eye, held a moment after the voice,
 *  chained to the next caption when the gap is under half a second, and ended by the cut. */
function holdCaptions(beat: CaptionCue[], cut: number, gap: number): void {
  beat.forEach((c, i) => {
    const next: CaptionCue | undefined = beat[i + 1];
    const want = Math.max(
      c.end + 0.4,
      c.start + MIN_CAPTION,
      c.start + c.text.length / CPS,
    );
    const room = Math.min(next ? next.start - gap : Infinity, cut);
    c.end = Math.min(
      Math.max(c.end, Math.min(want, c.start + MAX_CAPTION)),
      room,
    );
    if (next && next.start - c.end < 0.5)
      c.end = Math.max(c.end, next.start - gap);
    if (c.end <= c.start) c.end = Math.min(c.start + gap, cut);
  });
}

/** Caption cues from measured narration: `{start, end, text, lines}` in film seconds. Used for
 *  burned-in captions and the SRT/VTT sidecars, so the two always agree. */
export function captionCues(
  timing: CaptionTiming,
  { maxChars, fps }: { maxChars?: number; fps?: number } = {},
): CaptionCue[] {
  const rate = fps ?? timing.fps ?? 30;
  const chars = maxChars ?? (timing.height > timing.width ? 28 : 42);
  const gap = 2 / rate;
  const cues: CaptionCue[] = [];
  for (const b of timing.beats) {
    const words = (b.vo?.words ?? []).filter((w) => String(w.w ?? '').trim());
    const beat = captionGroups(words, chars).map((g): CaptionCue => {
      const text = joined(g);
      return {
        start: g[0].t0,
        end: last(g).t1,
        text,
        lines: captionLines(
          g.map((w) => w.w),
          chars,
        ) ?? [text],
      };
    });
    holdCaptions(beat, b.end, gap);
    cues.push(...beat.filter((c) => c.end > c.start));
  }
  return cues;
}

const stamp = (t: number, sep: string): string => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000),
    s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
export function toSRT(cues: readonly CaptionText[]): string {
  return cues
    .map(
      (c, i) =>
        `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${(c.lines ?? [c.text]).join('\n')}\n`,
    )
    .join('\n');
}
export function toVTT(cues: readonly CaptionText[]): string {
  return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${(c.lines ?? [c.text]).join('\n')}\n`).join('\n')}`;
}
