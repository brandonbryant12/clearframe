// Voice-first timing. Every scene's length comes from the narration it carries,
// plus a lead-in (visual lands before the voice) and a tail (let it breathe).
import { sketch } from '../../film/sketches.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { loadStoryboard, paths } from './project.mjs';
import { hashOf, readJSON, round, snap, wavDuration } from './util.mjs';
import { findMusicBed } from './music-files.mjs';
import { blockByName } from '../../film/catalog.mjs';
import { audioHash, validateWords, wordKey } from './word-timing.mjs';
import { planTakes } from './takes.mjs';
import { COVER } from '../../film/constants.mjs';
import { analyseTrack } from './beatmap.mjs';

const PAUSES = [
  [/(\.\.\.|…)$/, 0.45],
  [/[.!?]["')\]]*$/, 0.38],
  [/[;:]$/, 0.26],
  [/(—|--|–)$/, 0.24],
  [/,$/, 0.17],
];
const TAG_PAUSES = {
  'short pause': 0.35,
  'long pause': 0.8,
  breath: 0.3,
  'heavy breath': 0.45,
  sigh: 0.5,
  exhales: 0.4,
};

/** Spoken text → tokens with syllable weights and trailing pauses. Inline <tags> become pauses; |backchannels| are dropped. */
export function tokenize(text) {
  const tokens = [];
  const cleaned = String(text).replace(/\|[^|]*\|/g, ' ');
  for (const part of cleaned.split(/(<[^>]+>)/)) {
    const tag = part.match(/^<([^>]+)>$/);
    if (tag) {
      if (tokens.length) tokens.at(-1).pause += TAG_PAUSES[tag[1].trim().toLowerCase()] ?? 0.15;
      continue;
    }
    for (const raw of part.split(/\s+/).filter(Boolean)) {
      if (raw === '—' || raw === '--' || raw === '–') {
        if (tokens.length) tokens.at(-1).pause += 0.24;
        continue;
      }
      const pause = PAUSES.find(([re]) => re.test(raw))?.[1] ?? 0;
      tokens.push({ w: raw, syl: syllables(raw), pause });
    }
  }
  return tokens;
}

export function syllables(word) {
  const w = word.toLowerCase();
  const digits = (w.match(/\d/g) ?? []).length;
  if (digits) {
    const [int, dec = ''] = w.replace(/[^\d.]/g, '').split('.');
    let s = Math.min(int.length, 3) * 1.8 + Math.max(0, int.length - 3) * 1.1 + (int.length > 3 ? 2 : 0);
    s += dec.length ? 1 + dec.length * 1.2 : 0;
    if (w.includes('%')) s += 2;
    if (w.includes('$') || w.includes('€') || w.includes('£')) s += 1.5;
    if (/\d(k|m|bn|b|x)\b/.test(w)) s += 1.5;
    return Math.max(1, s);
  }
  const letters = w.replace(/[^a-z]/g, '');
  if (!letters) return 0.5;
  if (/^[A-Z]{2,5}$/.test(word.replace(/[^A-Za-z]/g, ''))) return letters.length; // acronyms are spelled out
  let s = (letters.match(/[aeiouy]+/g) ?? []).length;
  if (/[^aeiou]e$/.test(letters) && s > 1) s -= 1;
  if (/[^aeiou]le$/.test(letters)) s += 1;
  return Math.max(1, s);
}

const secPerSyl = wpm => 60 / (wpm * 1.6);

/** Estimated spoken duration of `text` at `wpm` (used until real audio exists). */
export function estimateDuration(text, wpm = 150) {
  const toks = tokenize(text);
  if (!toks.length) return 0;
  const speech = toks.reduce((a, t) => a + t.syl, 0) * secPerSyl(wpm);
  const pauses = toks.slice(0, -1).reduce((a, t) => a + t.pause, 0);
  return speech + pauses;
}

/** Spread words over [t0, t1] proportionally to syllables, honouring punctuation pauses. */
export function distributeWords(tokens, t0, t1) {
  if (!tokens.length) return [];
  const weights = tokens.map((t, i) => ({ speak: t.syl, gap: i < tokens.length - 1 ? t.pause * 6 : 0 }));
  const total = weights.reduce((a, w) => a + w.speak + w.gap, 0) || 1;
  const scale = (t1 - t0) / total;
  let cursor = t0;
  return tokens.map((t, i) => {
    const s = cursor;
    const e = s + weights[i].speak * scale;
    cursor = e + weights[i].gap * scale;
    return { w: t.w, t0: round(s), t1: round(e) };
  });
}

/**
 * Align words to real audio using detected speech segments (from ffmpeg silencedetect).
 * Phrases (split at punctuation) are matched to speech segments; words are spread inside each.
 */
export function alignWords(text, segments, duration) {
  const tokens = tokenize(text);
  if (!tokens.length) return [];
  let segs = segments.filter(s => s.end - s.start > 0.06).map(s => ({ ...s }));
  if (!segs.length) return distributeWords(tokens, 0, duration);

  let phrases = [];
  let cur = [];
  for (const t of tokens) {
    cur.push(t);
    if (t.pause >= 0.17) {
      phrases.push(cur);
      cur = [];
    }
  }
  if (cur.length) phrases.push(cur);

  while (segs.length > phrases.length) {
    let best = 0,
      gap = Infinity;
    for (let i = 0; i < segs.length - 1; i++) {
      const g = segs[i + 1].start - segs[i].end;
      if (g < gap) {
        gap = g;
        best = i;
      }
    }
    segs.splice(best, 2, { start: segs[best].start, end: segs[best + 1].end });
  }
  while (phrases.length > segs.length) {
    let best = 0,
      weakest = Infinity;
    for (let i = 0; i < phrases.length - 1; i++) {
      const p = phrases[i].at(-1).pause;
      if (p < weakest) {
        weakest = p;
        best = i;
      }
    }
    phrases.splice(best, 2, [...phrases[best], ...phrases[best + 1]]);
  }
  return phrases.flatMap((p, i) => distributeWords(p, segs[i].start, segs[i].end));
}

function voiceFor(root, beat, sb) {
  const p = paths(root);
  const file = path.join(p.vo, `${beat.id}.wav`);
  const meta = readJSON(path.join(p.vo, `${beat.id}.json`), null);
  if (fs.existsSync(file) && meta && meta.textHash === hashOf(beat.vo)) {
    const duration = wavDuration(file);
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error(`${beat.id}: narration WAV is empty or invalid; import or regenerate it.`);
    let words = meta.words ?? distributeWords(tokenize(beat.vo), 0, duration);
    let wordTiming = 'estimated',
      alignmentIssue;
    if (meta.alignment?.kind === 'measured') {
      try {
        if (meta.alignment.audioHash !== audioHash(file)) throw new Error('audio changed after alignment');
        validateWords(words, tokenize(beat.vo), duration);
        wordTiming = 'measured';
      } catch (e) {
        alignmentIssue = e.message;
        words = distributeWords(tokenize(beat.vo), 0, duration);
      }
    }
    return {
      src: `assets/vo/${beat.id}.wav`,
      duration,
      words,
      estimated: false,
      provider: meta.provider,
      wordTiming,
      alignmentIssue,
      take: meta.take,
    };
  }
  const duration = estimateDuration(beat.vo, sb.voice.wpm);
  return {
    src: null,
    duration,
    words: distributeWords(tokenize(beat.vo), 0, duration),
    estimated: true,
    stale: fs.existsSync(file) ? 'narration text changed since this take was recorded' : undefined,
  };
}

/** Recommended reading hold from the native catalog. */
export function blockTail(name) {
  return blockByName(name)?.tail ?? null;
}

/** Compute the full timeline for a project. Pure file reads; cheap enough to run per request. */
export function computeTiming(root, { storyboard } = {}) {
  const sb = loadStoryboard(root, storyboard);
  const { fps, width, height } = sb.format;
  const beats = [];
  let cursor = 0;
  // Before any audio exists, time the beats the way their planned continuous takes will
  // play: back to back inside a take, with lead and tail only at its ends.
  const planned = new Map();
  for (const t of planTakes(sb)) t.beats.forEach((b, i) => planned.set(b.id, { index: i, count: t.beats.length }));
  for (const [index, b] of sb.beats.entries()) {
    // A continuous recording (imported podcast or talk) plays back to back: no added lead or tail.
    const vo = b.vo ? voiceFor(root, b, sb) : null;
    // Continuous takes play back to back: no lead inside a take, no tail until its last beat.
    const take = vo?.take ?? (vo?.estimated && planned.get(b.id));
    const continuousLead = (sb.pacing.continuous === true && b.vo) || (take && take.index > 0);
    const continuousTail = (sb.pacing.continuous === true && b.vo) || (take && take.index < take.count - 1);
    const lead = b.lead ?? (continuousLead ? 0 : sb.pacing.lead);
    // A graphic transition marks a turn: the voice takes a breath there, so the outgoing
    // scene has time to cover the cut after its last word (take slices are separate files).
    const next = sb.beats[index + 1];
    const cover = next && COVER[next.transition ?? sb.transition];
    // Type that builds with the voice (kinetic, a statement) holds its finished line a
    // moment before the cut, so the last word is read, not just heard.
    const reads = ['kinetic', 'statement'].includes(b.block) ? 0.5 : 0;
    const breath = sb.pacing.continuous === true ? 0 : Math.max(cover ? cover[0] + 0.1 : 0, reads);
    const tail =
      b.tail ?? (continuousTail ? breath : Math.max(breath, (b.block ? blockTail(b.block) : null) ?? sb.pacing.tail));
    let natural = vo ? Math.max(0, lead) + vo.duration + tail + (b.hold ?? 0) : sb.pacing.silentBeat + (b.hold ?? 0);
    // Words cued to the narration must stay up long enough to be read: a note on the last
    // spoken word would otherwise flash for a fraction of a second before the cut.
    // Not inside an imported recording, though: its next slice follows straight on, and stretching
    // this one would insert silence into the conversation (7 s in one podcast). A voice take may
    // pause for its picture.
    if (vo && !(continuousTail && vo.provider === 'imported')) natural = Math.max(natural, Math.max(0, lead) + readUntil(b, vo.words));
    // Stretching a slice of a continuous recording would insert silence into it.
    const dur =
      b.duration ?? (continuousLead || continuousTail ? natural : Math.max(b.min ?? sb.pacing.minBeat, natural));
    const start = snap(cursor, fps);
    const end = snap(cursor + dur, fps);
    const beat = {
      id: b.id,
      index,
      chapter: b.chapter ?? null,
      scene: b.scene ?? null,
      block: b.block ?? null,
      props: b.props ?? null,
      transition: b.transition ?? null,
      start,
      end,
      dur: round(end - start),
      visual: b.visual ?? null,
    };
    if (vo) {
      const voStart = round(Math.max(0, start + lead));
      beat.vo = {
        text: b.vo,
        src: vo.src,
        start: voStart,
        end: round(voStart + vo.duration),
        dur: round(vo.duration),
        estimated: vo.estimated,
        provider: vo.provider ?? null,
        wordTiming: vo.wordTiming ?? 'estimated',
        ...(vo.alignmentIssue ? { alignmentIssue: vo.alignmentIssue } : {}),
        ...(vo.stale ? { stale: vo.stale } : {}),
        words: vo.words.map(w => ({ w: w.w, t0: round(voStart + w.t0), t1: round(voStart + w.t1) })),
      };
    }
    if (b.sfx) beat.sfx = b.sfx.map(s => ({ src: s.src, volume: s.volume ?? 0.6, t: resolveAt(s.at ?? 0, beat) }));
    beats.push(beat);
    cursor = end;
  }
  const duration = round(cursor + (sb.pacing.outro ?? 0));
  const music = sb.music && sb.music.file !== false ? musicInfo(root, sb, beats) : null;
  return {
    title: sb.title ?? 'Untitled',
    width,
    height,
    fps,
    duration,
    frames: Math.round(duration * fps),
    theme: sb.theme ?? 'paper',
    // Recorded for reference; the native job (film/production.mjs) is authoritative.
    look: {
      backdrop: sb.backdrop ?? 'none',
      chrome: sb.chrome === true,
      captions: sb.captions ?? 'auto',
      transition: sb.transition ?? 'cut',
      sfx: sb.sfx ?? false,
      voiceProvider: sb.voice.provider,
    },
    estimated: beats.some(b => b.vo?.estimated),
    beats,
    music,
    assets: sb.assets.map(a => ({ id: a.id, kind: a.kind, src: assetSrc(root, a) })),
  };
}

/** Resolve a cue position: seconds after beat start, "word:<text>", "vo", "vo-end" or "end". */
export function resolveAt(at, beat) {
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

const norm = wordKey;
/** When the last narration-cued line of type in a beat has been on screen long enough to read. */
function readUntil(b, words) {
  let until = 0;
  const read = text => Math.max(1.3, String(text).split(/\s+/).length / 3 + 0.6);
  const cued = (say, text) => {
    const t = typeof say === 'string' ? findWord(words, say) : null;
    if (t != null && text) until = Math.max(until, t + read(text));
  };
  const walk = list =>
    (list ?? []).forEach(el => {
      if (el.type === 'text') cued(el.say, el.text ?? el.count?.to);
      walk(el.children);
    });
  walk(b.props?.elements);
  walk(b.art?.under);
  walk(b.art?.over);
  if (b.props?.chart?.note) cued(b.props.chart.note.say, b.props.chart.note.text);
  // A sketch's moments land on words with offsets after them (a coin drops 0.45 s after its word,
  // the view leans in after the save): the beat lasts until the last of them has landed, instead
  // of failing when the moment is on the narration's last word.
  if (b.props?.sketch && b.props.sketchSay) {
    let drawn = null;
    try {
      drawn = sketch(b.props.sketch, 'landscape', { text: b.props.sketchText, say: b.props.sketchSay, params: b.props.sketchParams });
    } catch {}
    const land = list =>
      (list ?? []).forEach(el => {
        for (const t of [el, ...(el.keys ?? [])]) {
          const at = typeof t.say === 'string' ? findWord(words, t.say) : null;
          if (at != null) until = Math.max(until, at + (t.after ?? 0) + (t.dur ?? 0.5) + 0.6);
        }
        land(el.children);
      });
    land(drawn?.elements);
  }
  return until;
}

export function findWord(words, query, nth = 0) {
  const q = query.split(/\s+/).map(norm).filter(Boolean);
  if (!q.length) return null;
  const search = list => {
    let seen = 0;
    for (let i = 0; i + q.length <= list.length; i++) {
      if (q.every((part, j) => norm(list[i + j].w) === part)) {
        if (seen++ === nth) return list[i].t0;
      }
    }
    return null;
  };
  // A cue can name part of a hyphenated or slashed word ("approved" in "pre-approved").
  return search(words) ?? search(words.flatMap(w => String(w.w).split(/[-–—/]/).filter(Boolean).map(part => ({ w: part, t0: w.t0 }))));
}

function musicInfo(root, sb, beats) {
  const candidates = [sb.music.file, findMusicBed(root)].filter(Boolean);
  const src = candidates.find(f => fs.existsSync(path.join(root, f))) ?? null;
  const info = {
    src,
    volume: sb.music.volume,
    duck: sb.music.duck,
    fadeIn: sb.music.fadeIn,
    fadeOut: sb.music.fadeOut,
    offset: sb.music.offset ?? 0,
    // A bed scored to an explicit arc keeps playing under voiceless beats.
    scored: Boolean(sb.music.arc || sb.music.sections),
  };
  // The drop lands on the key picture: the song starts so that its drop (measured, or given in
  // song seconds) plays at a beat's start or a cue in it. A negative offset delays the song.
  const d = sb.music.drop;
  if (d && src) {
    const beat = beats.find(b => b.id === d.beat);
    if (!beat) throw new Error(`music.drop.beat "${d.beat}" is not a beat id`);
    const song = d.song == null || d.song === 'auto' ? analyseTrack(path.join(root, src)).drop?.t : d.song;
    if (song == null) throw new Error(`No drop measured in ${src}; give music.drop.song in seconds.`);
    const film = resolveAt(d.at ?? 0, beat);
    info.offset = round(song - film);
    info.drop = { beat: beat.id, film, song };
  }
  return info;
}

export function assetSrc(root, a) {
  if (a.file) return a.file;
  const dir = a.kind === 'image' ? 'assets/img' : a.kind === 'clip' ? 'assets/clips' : 'assets/sfx';
  const exts = a.kind === 'image' ? ['jpg', 'png', 'webp'] : a.kind === 'clip' ? ['mp4', 'webm'] : ['wav', 'mp3'];
  for (const ext of exts) {
    const rel = `${dir}/${a.id}.${ext}`;
    if (fs.existsSync(path.join(root, rel))) return rel;
  }
  return null;
}

// Captions to a broadcast standard, after Netflix's English timed-text style guide: at most two
// lines of 42 characters (28 on a vertical frame), one sentence per caption where it fits, lines
// broken where a reader would pause, at most 20 characters a second, on screen 5/6 s to 7 s,
// 2 frames apart, and never across a cut.
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
const OPENS = new Set('and or but nor so because which who whose whom when where while if than that to in on at by for with from into as'.split(' '));
const bare = w => w.toLowerCase().replace(/[^\p{L}\p{N}']/gu, '');
const clause = w => /[,;:—–]["”’)]?$/.test(w);
const sentence = w => /[.!?…]["”’)]?$/.test(w);

/** The best place to break `words` into two lines of at most `max` characters, or null. With
 *  `strict`, a break that would end a line on a word leaning on the next does not count. */
export function captionLines(words, max = 42, { strict = false } = {}) {
  const text = words.join(' ');
  if (text.length <= max || words.length < 2) return [text];
  let best = null;
  for (let k = 1; k < words.length; k++) {
    const [a, b] = [words.slice(0, k).join(' '), words.slice(k).join(' ')];
    if (a.length > max || b.length > max) continue;
    const end = words[k - 1];
    // Balanced lines first (a long top line over a short one is the worst shape), then the
    // grammar of the break.
    const score =
      (sentence(end) ? 5 : clause(end) ? 3 : 0) +
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
function captionEnd(ws, maxChars = 42) {
  let best = { k: ws.length, score: -Infinity };
  for (let k = 1; k <= ws.length; k++) {
    const end = ws[k - 1].w,
      next = ws[k]?.w,
      chars = ws.slice(0, k).map(w => w.w).join(' ').length;
    const score =
      (sentence(end) ? 6 : clause(end) ? 4 : 0) +
      (next && OPENS.has(bare(next)) ? 2 : 0) -
      (LEANS.has(bare(end)) ? 5 : 0) +
      (0.8 * k) / ws.length -
      (!sentence(end) && chars < maxChars * 0.6 ? 3 : 0);
    if (score > best.score) best = { k, score };
  }
  return best.k;
}

/** Caption cues from measured narration: `{start, end, text, lines}` in film seconds. Used for
 *  burned-in captions and the SRT/VTT sidecars, so the two always agree. */
export function captionCues(timing, { maxChars, fps } = {}) {
  fps ??= timing.fps ?? 30;
  maxChars ??= timing.height > timing.width ? 28 : 42;
  const gap = 2 / fps;
  const cues = [];
  for (const b of timing.beats) {
    const words = (b.vo?.words ?? []).filter(w => String(w.w ?? '').trim());
    const groups = [];
    let cur = [];
    const fits = ws => captionLines(ws.map(w => w.w), maxChars, { strict: true }) != null;
    for (const w of words) {
      const last = cur.at(-1);
      // A long pause starts a new caption; so does running out of two lines or seven seconds.
      if (last && (w.t0 - last.t1 > 0.7 || !fits([...cur, w]) || w.t1 - cur[0].t0 > MAX_CAPTION)) {
        const k = w.t0 - last.t1 > 0.7 ? cur.length : captionEnd(cur, maxChars);
        groups.push(cur.slice(0, k));
        cur = cur.slice(k);
      }
      cur.push(w);
      // One sentence per caption: a short one waits for the next if both fit and follow closely.
      if (sentence(w.w) && !(cur.map(x => x.w).join(' ').length < 16 && w.t1 - cur[0].t0 < MIN_CAPTION)) {
        groups.push(cur);
        cur = [];
      }
    }
    if (cur.length) groups.push(cur);
    // A fragment too short to read (a word stranded by a pause) joins the caption after it.
    for (let i = 0; i < groups.length - 1; i++) {
      const [g, h] = [groups[i], groups[i + 1]];
      if (g.at(-1).t1 - g[0].t0 < MIN_CAPTION && h[0].t0 - g.at(-1).t1 < 1.5 && fits([...g, ...h])) {
        groups.splice(i, 2, [...g, ...h]);
        i--;
      }
    }
    const beat = groups
      .filter(g => g.length)
      .map(g => {
        const text = g.map(w => w.w).join(' ');
        return { start: g[0].t0, end: g.at(-1).t1, text, lines: captionLines(g.map(w => w.w), maxChars) ?? [text] };
      });
    beat.forEach((c, i) => {
      const next = beat[i + 1];
      // Readable: long enough for its words and for the eye, held a moment after the voice,
      // chained to the next caption when the gap is under half a second, and ended by the cut.
      const want = Math.max(c.end + 0.4, c.start + MIN_CAPTION, c.start + c.text.length / CPS);
      const room = Math.min(next ? next.start - gap : Infinity, b.end);
      c.end = Math.min(Math.max(c.end, Math.min(want, c.start + MAX_CAPTION)), room);
      if (next && next.start - c.end < 0.5) c.end = Math.max(c.end, next.start - gap);
      if (c.end <= c.start) c.end = Math.min(c.start + gap, b.end);
    });
    cues.push(...beat.filter(c => c.end > c.start));
  }
  return cues;
}

const stamp = (t, sep) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000),
    m = Math.floor((ms % 3600000) / 60000),
    s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
export function toSRT(cues) {
  return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${(c.lines ?? [c.text]).join('\n')}\n`).join('\n');
}
export function toVTT(cues) {
  return `WEBVTT\n\n${cues.map(c => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${(c.lines ?? [c.text]).join('\n')}\n`).join('\n')}`;
}
