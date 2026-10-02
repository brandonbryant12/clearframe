// Times and anchors: reading 2:13.4, and finding what is on screen and spoken at a moment of a
// revision's timeline. Shared by notes (where a note points) and targets (what a cut takes).
const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;

// ------------------------------------------------------------------ time

/** 133.4, 2:13, 2:13.4 or 1:02:13.5 → seconds. */
export function parseTime(value) {
  const s = String(value).trim();
  if (!/^(?:\d+(?::\d{1,2}){0,2}(?:\.\d*)?|\.\d+)$/.test(s)) throw new Error(`Not a time: ${JSON.stringify(value)} (use 133.4 or 2:13.4)`);
  return s.split(':').reduce((acc, part) => acc * 60 + Number(part), 0);
}
export function formatTime(t) {
  const m = Math.floor(t / 60),
    s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

// ------------------------------------------------------------------ anchors

const sourceAt = (beat, t) => {
  const s = beat.source?.segments?.find(x => t >= x.film[0] - 1e-6 && t <= x.film[1] + 1e-6);
  return s ? round(s.source[0] + (t - s.film[0]), 3) : null;
};

/**
 * Where time `at` falls on a revision's timeline: the beat showing at that frame, the words
 * spoken around it, their time in the source recording, and any cut close enough that the
 * person may have meant the neighbouring beat (reported, never guessed).
 */
export function anchorAt(timeline, at, { to, beat: forced, element } = {}) {
  if (!(Number.isFinite(at) && at >= 0 && at < timeline.duration + 1e-6))
    throw new Error(`${formatTime(at)} is outside this revision (${formatTime(timeline.duration)} long).`);
  if (to != null && !(to > at)) throw new Error('A range must end after it starts.');
  const frame = Math.min(timeline.frames - 1, Math.floor(at * timeline.fps + 1e-6));
  let beat = timeline.beats.find(b => frame >= b.startFrame && frame < b.startFrame + b.frames);
  const near = [];
  for (const b of timeline.beats) {
    if (b === beat) continue;
    const edge = Math.min(Math.abs(at - b.end), Math.abs(at - b.start));
    if (edge <= 0.3) near.push({ beat: b.id, seconds: round(edge) });
  }
  if (forced) {
    const f = timeline.beats.find(b => b.id === forced);
    if (!f) throw new Error(`No beat ${forced} in this revision.`);
    if (f !== beat && !near.some(n => n.beat === forced))
      throw new Error(`${forced} is not on screen at ${formatTime(at)} in this revision (that is ${beat.id}).`);
    beat = f;
  }
  const words = beat.words ?? [];
  let k = words.findIndex(w => at >= w.t0 && at < w.t1);
  if (k < 0) k = words.findIndex(w => w.t0 >= at);
  if (k < 0) k = words.length - 1;
  const i0 = Math.max(0, k - 2),
    i1 = Math.min(words.length - 1, k + 2);
  if (element != null && !beat.elements.includes(element))
    throw new Error(`${beat.id} has no element "${element}" (it has: ${beat.elements.join(', ') || 'none named'}).`);
  const beats = to != null ? timeline.beats.filter(b => b.start < to && b.end > at).map(b => b.id) : [beat.id];
  let quote = words.length ? words.slice(i0, i1 + 1) : [];
  // A range quotes what its first beat says inside it: a quote is always found within one beat.
  if (to != null) quote = words.filter(w => w.t1 > at && w.t0 < to).slice(0, 12);
  const src = quote.length && beat.source ? [sourceAt(beat, quote[0].t0), sourceAt(beat, quote.at(-1).t1)] : null;
  return {
    beat: beat.id,
    beats,
    at: round(at),
    ...(to != null ? { to: round(to) } : {}),
    beatTime: round(at - beat.start),
    chapter: beat.chapter ?? null,
    words: quote.map(w => w.w).join(' '),
    ...(quote.length ? { quoteAt: round(quote[0].t0) } : {}),
    ...(src && src[0] != null && src[1] != null
      ? { source: { file: beat.source.file, from: src[0], to: src[1], original: [round(src[0] + beat.source.offset), round(src[1] + beat.source.offset)] } }
      : {}),
    ...(element != null ? { element } : {}),
    ...(near.length ? { near } : {}),
    prints: { authored: beat.prints.authored, picture: beat.prints.picture, words: beat.prints.words, rendered: beat.prints.rendered },
  };
}
