// Named moments: one event, many responses. A canvas beat names its moments once — a word of the
// narration (measured like every other spoken cue), scene seconds, or another moment plus a delay —
// and any element, key, route, exit, mark, document scroll or structured step lands on one with
// `cue: NAME` (and `after`, seconds from the moment, negative to anticipate it). Retiming the word
// moves every response together, including the sounds attached to them, which play on the times
// their elements and keys are given here.

const NAME = /^[A-Za-z][A-Za-z0-9_-]{0,31}$/;
const finite = v => typeof v === 'number' && Number.isFinite(v);
const AFTER = [-3, 10];
const own = (o, k) => o != null && Object.hasOwn(o, k);
// Elements whose entrance a moment sets: pacing and other automatic retiming leave them alone, so
// a shared event stays shared (the box and its ring land together, with the box's sound).
const TIMED = new WeakSet();
/** Whether a moment set this element's entrance (film/job.mjs keepPace never moves one). */
export const timedByMoment = el => TIMED.has(el);

/** Check a beat's `moments` shape: {NAME: "word" | {say, after} | {at} | {cue, after}}. */
export function momentSpec(input, fail = m => { throw new Error(m); }) {
  if (input == null) return null;
  if (typeof input !== 'object' || Array.isArray(input)) fail('moments must be {NAME: "a spoken word" | {say, after} | {at} | {cue, after}}');
  const names = Object.keys(input);
  if (!names.length || names.length > 24) fail('moments needs 1–24 named moments');
  const out = {};
  for (const name of names) {
    const where = `moments.${name}`;
    if (!NAME.test(name)) fail(`${where}: a moment name is a letter then letters, digits, _ or - (up to 32), like LAND or first-step`);
    const v = typeof input[name] === 'string' ? { say: input[name] } : input[name];
    if (!v || typeof v !== 'object' || Array.isArray(v)) fail(`${where} must be a spoken word, {say, after}, {at} or {cue, after}`);
    for (const k of Object.keys(v)) if (!['say', 'at', 'cue', 'after'].includes(k)) fail(`${where}: unsupported field ${k} (a moment takes say, at, cue and after)`);
    const given = ['say', 'at', 'cue'].filter(k => v[k] != null);
    if (given.length !== 1) fail(`${where} needs exactly one of say (a spoken word), at (scene seconds) or cue (another moment)`);
    if (v.say != null && (typeof v.say !== 'string' || !v.say.trim())) fail(`${where}.say must be a word or phrase of the narration`);
    if (v.at != null && (!finite(v.at) || v.at < 0)) fail(`${where}.at must be scene seconds (0 or more)`);
    if (v.cue != null && (typeof v.cue !== 'string' || !own(input, v.cue))) fail(`${where}.cue "${v.cue}" names no moment of this beat (${names.join(', ')})`);
    if (v.after != null && (!finite(v.after) || v.after < AFTER[0] || v.after > AFTER[1]))
      fail(`${where}.after must be ${AFTER[0]}–${AFTER[1]} seconds from its word or moment`);
    if (v.after != null && v.at != null) fail(`${where}: after belongs to a word or another moment; give the seconds in at`);
    out[name] = { ...v };
  }
  return out;
}

/**
 * Scene seconds for every moment. `word(phrase)` is the beat's spoken-cue resolver (measured word
 * timings; it throws, naming the narration, for a word the line does not say); `dur` the beat's
 * length. A chain that loops back on itself is refused, naming the loop.
 */
export function resolveMoments(input, { word, dur = Infinity, fail = m => { throw new Error(m); } }) {
  const spec = momentSpec(input, fail);
  if (!spec) return null;
  const times = new Map(), visiting = [];
  const time = name => {
    if (times.has(name)) return times.get(name);
    if (visiting.includes(name)) fail(`moments loop: ${[...visiting.slice(visiting.indexOf(name)), name].join(' → ')}; one of them needs a word or seconds`);
    visiting.push(name);
    const v = spec[name];
    const base = v.say != null ? word(v.say) : v.at != null ? v.at : time(v.cue);
    visiting.pop();
    const t = base + (v.after ?? 0);
    if (t < 0) fail(`moments.${name} lands ${t.toFixed(2)} s, before the beat starts; shorten its negative after`);
    if (t >= dur) fail(`moments.${name} lands at ${t.toFixed(2)} s, after the beat ends (${dur.toFixed(2)} s); extend the beat or cue it earlier`);
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
export function momentTime(item, moments, where, fail = m => { throw new Error(m); }) {
  if (item?.cue == null) return null;
  if (item.say != null || item.at != null) fail(`${where} takes one of say, at or cue`);
  if (typeof item.cue !== 'string' || !moments?.has(item.cue))
    fail(`${where}.cue "${item.cue}" names no moment${moments?.size ? ` (this beat's moments: ${[...moments.keys()].join(', ')})` : '; declare it in the canvas props moments'}`);
  const after = item.after ?? 0;
  if (!finite(after) || after < AFTER[0] || after > AFTER[1]) fail(`${where}.after must be ${AFTER[0]}–${AFTER[1]} seconds`);
  return Math.max(0, moments.get(item.cue) + after);
}

/**
 * Replace every `cue`/`exitCue` in an element list (groups, keys, routes, marks, document scrolls,
 * a shine) with the exact seconds of its moment. Returns the moment names used, so the beat can
 * report one that nothing lands on.
 */
export function applyMoments(list, moments, where = 'elements', fail = m => { throw new Error(m); }, dur = Infinity) {
  const used = new Set();
  const at = (item, path) => {
    const name = item.cue;
    const t = momentTime(item, moments, path, fail);
    // A response the beat never reaches would be silently lost: refuse it, naming the moment.
    if (t >= dur) fail(`${path} lands at ${t.toFixed(2)} s (moment ${name}${item.after ? ` + ${item.after} s` : ''}), after the beat ends at ${dur.toFixed(2)} s`);
    used.add(name);
    delete item.cue;
    delete item.after;
    return t;
  };
  const walk = (items, base) =>
    (items ?? []).forEach((el, i) => {
      const path = `${base}[${i}]`;
      if (el.cue != null) {
        el.at = at(el, path);
        TIMED.add(el);
      }
      if (el.exitCue != null) {
        if (el.exitSay != null || el.exitAt != null) fail(`${path} takes one of exitSay, exitAt or exitCue`);
        const t = momentTime({ cue: el.exitCue, after: el.exitAfter }, moments, `${path}.exitCue`, fail);
        used.add(el.exitCue);
        el.exitAt = t;
        el.exit ??= 'fade';
        delete el.exitCue;
        delete el.exitAfter;
      }
      for (const [j, k] of (el.keys ?? []).entries()) if (k.cue != null) k.at = at(k, `${path}.keys[${j}]`);
      if (el.along?.cue != null) el.along.at = at(el.along, `${path}.along`);
      for (const [j, m] of (el.marks ?? []).entries()) if (m.cue != null) m.at = at(m, `${path}.marks[${j}]`);
      for (const [j, s] of (el.type === 'document' ? (el.scroll ?? []) : []).entries()) if (s.cue != null) s.at = at(s, `${path}.scroll[${j}]`);
      if (el.shine?.cue != null) el.shine.at = at(el.shine, `${path}.shine`);
      if (el.type === 'group') walk(el.children, `${path}.children`);
    });
  walk(list, where);
  return used;
}

/** Whether any element, key, route, mark or scroll in the list names a moment. */
export function namesMoments(list) {
  let found = false;
  const walk = items =>
    (items ?? []).forEach(el => {
      if (el.cue != null || el.exitCue != null || el.along?.cue != null || el.shine?.cue != null) found = true;
      for (const x of [...(el.keys ?? []), ...(el.marks ?? []), ...(el.scroll ?? [])]) if (x?.cue != null) found = true;
      if (el.type === 'group') walk(el.children);
    });
  walk(list);
  return found;
}
