// Named moments: one event, many responses. A canvas beat names its moments once — a word of the
// narration (measured like every other spoken cue), scene seconds, or another moment plus a delay —
// and any element, key, route, exit, mark, document scroll or structured step lands on one with
// `cue: NAME` (and `after`, seconds from the moment, negative to anticipate it). Retiming the word
// moves every response together, including the sounds attached to them, which play on the times
// their elements and keys are given here.
import { isRecord, finite } from './guards.mjs';
import type { CanvasElement, Fail, Timed } from './types.mjs';
import { applyNestedMoments } from './moments-nested.mjs';

/** One moment: a spoken word, scene seconds, or another moment, each plus `after`. */
export interface MomentDef {
  say?: string;
  at?: number;
  cue?: string;
  after?: number;
}
export type MomentSpec = Record<string, MomentDef>;
/** Scene seconds for each moment of a beat. */
export type Moments = Map<string, number>;

const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const AFTER = [-3, 10];
const own = (o: unknown, k: string): boolean =>
  o != null && typeof o === 'object' && Object.hasOwn(o, k);
const thrown: Fail = (m) => {
  throw new Error(m);
};
// Elements whose entrance a moment sets: pacing and other automatic retiming leave them alone, so
// a shared event stays shared (the box and its ring land together, with the box's sound).
const TIMED = new WeakSet<CanvasElement>();
/** Whether a moment set this element's entrance (film/job.mjs keepPace never moves one). */
export const timedByMoment = (el: CanvasElement): boolean => TIMED.has(el);

/** Check a beat's `moments` shape: {NAME: "word" | {say, after} | {at} | {cue, after}}. */
export function momentSpec(
  input: unknown,
  fail: Fail = thrown,
): MomentSpec | null {
  if (input == null) return null;
  if (!isRecord(input))
    return fail(
      'moments must be {NAME: "a spoken word" | {say, after} | {at} | {cue, after}}',
    );
  const names = Object.keys(input);
  if (!names.length || names.length > 24)
    fail('moments needs 1–24 named moments');
  const out: MomentSpec = {};
  for (const name of names) {
    validateMoment({ name, fail, input, names, out });
  }
  return out;
}

function validateMoment({
  name,
  fail,
  input,
  names,
  out,
}: ValidateMomentContext) {
  const where = `moments.${name}`;
  if (!NAME.test(name))
    fail(
      `${where}: a moment name is a letter then letters, digits, _ or - (up to 32), like LAND or first-step`,
    );
  const raw: unknown = input[name];
  const v: unknown = typeof raw === 'string' ? { say: raw } : raw;
  if (!isRecord(v))
    return fail(
      `${where} must be a spoken word, {say, after}, {at} or {cue, after}`,
    );
  for (const k of Object.keys(v))
    if (!['say', 'at', 'cue', 'after'].includes(k))
      fail(
        `${where}: unsupported field ${k} (a moment takes say, at, cue and after)`,
      );
  const given = ['say', 'at', 'cue'].filter((k) => v[k] != null);
  if (given.length !== 1)
    fail(
      `${where} needs exactly one of say (a spoken word), at (scene seconds) or cue (another moment)`,
    );
  if (v.say != null && (typeof v.say !== 'string' || !v.say.trim()))
    fail(`${where}.say must be a word or phrase of the narration`);
  if (v.at != null && (!finite(v.at) || v.at < 0))
    fail(`${where}.at must be scene seconds (0 or more)`);
  if (v.cue != null && (typeof v.cue !== 'string' || !own(input, v.cue)))
    fail(
      `${where}.cue "${v.cue}" names no moment of this beat (${names.join(', ')})`,
    );
  validateMomentDelay(v, where, fail);
  out[name] = decodedMoment(v);
}

/**
 * Scene seconds for every moment. `word(phrase)` is the beat's spoken-cue resolver (measured word
 * timings; it throws, naming the narration, for a word the line does not say); `dur` the beat's
 * length. A chain that loops back on itself is refused, naming the loop.
 */
export function resolveMoments(
  input: unknown,
  {
    word,
    dur = Infinity,
    fail = thrown,
  }: { word: (phrase: string) => number; dur?: number; fail?: Fail },
): Moments | null {
  const spec = momentSpec(input, fail);
  if (!spec) return null;
  const times: Moments = new Map(),
    visiting: string[] = [];
  const time = (name: string): number => {
    const known = times.get(name);
    if (known !== undefined) return known;
    if (visiting.includes(name))
      fail(
        `moments loop: ${[...visiting.slice(visiting.indexOf(name)), name].join(' → ')}; one of them needs a word or seconds`,
      );
    visiting.push(name);
    const v = spec[name];
    // momentSpec gave each moment exactly one of say, at and cue.
    const base = momentBase(v, word, time);
    visiting.pop();
    const t = base + (v.after ?? 0);
    if (t < 0)
      fail(
        `moments.${name} lands ${t.toFixed(2)} s, before the beat starts; shorten its negative after`,
      );
    if (t >= dur)
      fail(
        `moments.${name} lands at ${t.toFixed(2)} s, after the beat ends (${dur.toFixed(2)} s); extend the beat or cue it earlier`,
      );
    times.set(name, t);
    return t;
  };
  for (const name of Object.keys(spec)) time(name);
  return times;
}

/**
 * Seconds for a structured item that may name a moment: `{cue, after}` → the moment's time plus
 * after. Returns null when the item has no cue (the caller resolves say/at as before).
 */
export function momentTime(
  item: Timed | null | undefined,
  moments: Moments | null | undefined,
  where: string,
  fail: Fail = thrown,
): number | null {
  if (item?.cue == null) return null;
  if (item.say != null || item.at != null)
    fail(`${where} takes one of say, at or cue`);
  if (typeof item.cue !== 'string' || !moments?.has(item.cue))
    fail(
      `${where}.cue "${item.cue}" names no moment${moments?.size ? ` (this beat's moments: ${[...moments.keys()].join(', ')})` : '; declare it in the canvas props moments'}`,
    );
  const after = item.after ?? 0;
  if (!finite(after) || after < AFTER[0] || after > AFTER[1])
    fail(`${where}.after must be ${AFTER[0]}–${AFTER[1]} seconds`);
  return Math.max(0, (moments.get(item.cue) ?? 0) + after);
}

/**
 * Replace every `cue`/`exitCue` in an element list (groups, keys, routes, marks, document scrolls,
 * a shine) with the exact seconds of its moment. Returns the moment names used, so the beat can
 * report one that nothing lands on.
 */
export function applyMoments(
  list: CanvasElement[] | null | undefined,
  moments: Moments | null | undefined,
  where = 'elements',
  fail: Fail = thrown,
  dur = Infinity,
): Set<string> {
  const used = new Set<string>();
  const at = (item: Timed, path: string): number => {
    const name = item.cue;
    const t = momentTime(item, moments, path, fail);
    if (name == null || t == null) fail(`${path} names no moment`);
    // A response the beat never reaches would be silently lost: refuse it, naming the moment.
    if (t >= dur)
      fail(
        `${path} lands at ${t.toFixed(2)} s (moment ${name}${item.after ? ` + ${item.after} s` : ''}), after the beat ends at ${dur.toFixed(2)} s`,
      );
    used.add(name);
    delete item.cue;
    delete item.after;
    return t;
  };
  const walk = (
    items: CanvasElement[] | null | undefined,
    base: string,
  ): void =>
    (items ?? []).forEach((el, i) => {
      const path = `${base}[${i}]`;
      if (el.cue != null) {
        el.at = at(el, path);
        TIMED.add(el);
      }
      applyExitMoment({ el, fail, path, moments, used });
      applyNestedMoments(el, path, at);
      if (el.type === 'group') walk(el.children, `${path}.children`);
    });
  walk(list, where);
  return used;
}

function applyExitMoment({
  el,
  fail,
  path,
  moments,
  used,
}: ApplyExitMomentContext) {
  if (el.exitCue != null) {
    if (el.exitSay != null || el.exitAt != null)
      fail(`${path} takes one of exitSay, exitAt or exitCue`);
    const t = momentTime(
      { cue: el.exitCue, after: el.exitAfter },
      moments,
      `${path}.exitCue`,
      fail,
    );
    if (t == null) return fail(`${path}.exitCue names no moment`);
    used.add(el.exitCue);
    el.exitAt = t;
    el.exit ??= 'fade';
    delete el.exitCue;
    delete el.exitAfter;
  }
}

/** Whether any element, key, route, mark or scroll in the list names a moment. */
export function namesMoments(
  list: CanvasElement[] | null | undefined,
): boolean {
  return (list ?? []).some(elementNamesMoment);
}

function elementNamesMoment(el: CanvasElement): boolean {
  if (
    el.cue != null ||
    el.exitCue != null ||
    el.along?.cue != null ||
    (typeof el.shine === 'object' && el.shine.cue != null)
  )
    return true;
  const nested = [
    ...(el.keys ?? []),
    ...(el.marks ?? []),
    ...(el.scroll ?? []),
  ];
  if (nested.some((item) => !Array.isArray(item) && item?.cue != null))
    return true;
  return el.type === 'group' && namesMoments(el.children);
}

function momentBase(
  value: MomentDef,
  word: (phrase: string) => number,
  time: (name: string) => number,
): number {
  if (value.say != null) return word(value.say);
  return value.at != null ? value.at : time(String(value.cue));
}

interface ValidateMomentContext {
  name: string;
  fail: Fail;
  input: Record<string, unknown>;
  names: string[];
  out: MomentSpec;
}

interface ApplyExitMomentContext {
  el: CanvasElement;
  fail: Fail;
  path: string;
  moments: Moments | null | undefined;
  used: Set<string>;
}

function validateMomentDelay(
  v: Readonly<Record<string, unknown>>,
  where: string,
  fail: Fail,
): void {
  if (
    v.after != null &&
    (!finite(v.after) || v.after < AFTER[0] || v.after > AFTER[1])
  )
    fail(
      `${where}.after must be ${AFTER[0]}–${AFTER[1]} seconds from its word or moment`,
    );
  if (v.after != null && v.at != null)
    fail(
      `${where}: after belongs to a word or another moment; give the seconds in at`,
    );
}

function decodedMoment(value: Readonly<Record<string, unknown>>): MomentDef {
  return {
    ...(typeof value.say === 'string' ? { say: value.say } : {}),
    ...(typeof value.at === 'number' ? { at: value.at } : {}),
    ...(typeof value.cue === 'string' ? { cue: value.cue } : {}),
    ...(typeof value.after === 'number' ? { after: value.after } : {}),
  };
}
