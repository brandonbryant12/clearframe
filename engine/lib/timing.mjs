// Voice-first timing. Every scene's length comes from the narration it carries,
// plus a lead-in (visual lands before the voice) and a tail (let it breathe).
import fs from 'node:fs';
import path from 'node:path';
import { loadStoryboard, paths } from './project.mjs';
import { hashOf, readJSON, round, snap, wavDuration } from './util.mjs';
import { findMusicBed } from './music-files.mjs';
import { blockByName } from '../../fframes/catalog.mjs';
import { audioHash, validateWords, wordKey } from './word-timing.mjs';

const PAUSES = [
  [/(\.\.\.|…)$/, 0.45],
  [/[.!?]["')\]]*$/, 0.38],
  [/[;:]$/, 0.26],
  [/(—|--|–)$/, 0.24],
  [/,$/, 0.17],
];
const TAG_PAUSES = { 'short pause': 0.35, 'long pause': 0.8, breath: 0.3, 'heavy breath': 0.45, sigh: 0.5, exhales: 0.4 };

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
      if (raw === '—' || raw === '--' || raw === '–') { if (tokens.length) tokens.at(-1).pause += 0.24; continue; }
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

const secPerSyl = (wpm) => 60 / (wpm * 1.6);

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
  let segs = segments.filter((s) => s.end - s.start > 0.06).map((s) => ({ ...s }));
  if (!segs.length) return distributeWords(tokens, 0, duration);

  let phrases = [];
  let cur = [];
  for (const t of tokens) { cur.push(t); if (t.pause >= 0.17) { phrases.push(cur); cur = []; } }
  if (cur.length) phrases.push(cur);

  while (segs.length > phrases.length) {
    let best = 0, gap = Infinity;
    for (let i = 0; i < segs.length - 1; i++) { const g = segs[i + 1].start - segs[i].end; if (g < gap) { gap = g; best = i; } }
    segs.splice(best, 2, { start: segs[best].start, end: segs[best + 1].end });
  }
  while (phrases.length > segs.length) {
    let best = 0, weakest = Infinity;
    for (let i = 0; i < phrases.length - 1; i++) { const p = phrases[i].at(-1).pause; if (p < weakest) { weakest = p; best = i; } }
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
    if(!Number.isFinite(duration)||duration<=0)throw new Error(`${beat.id}: narration WAV is empty or invalid; import or regenerate it.`);
    let words = meta.words ?? distributeWords(tokenize(beat.vo), 0, duration);
    let wordTiming = 'estimated', alignmentIssue;
    if(meta.alignment?.kind==='measured') {
      try {
        if(meta.alignment.audioHash!==audioHash(file)) throw new Error('audio changed after alignment');
        validateWords(words,tokenize(beat.vo),duration);wordTiming='measured';
      } catch(e) { alignmentIssue=e.message;words=distributeWords(tokenize(beat.vo),0,duration); }
    }
    return { src: `assets/vo/${beat.id}.wav`, duration, words, estimated: false, provider: meta.provider, wordTiming, alignmentIssue, take: meta.take };
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
export function computeTiming(root) {
  const sb = loadStoryboard(root);
  const { fps, width, height } = sb.format;
  const beats = [];
  let cursor = 0;
  for (const [index, b] of sb.beats.entries()) {
    // A continuous recording (imported podcast or talk) plays back to back: no added lead or tail.
    const vo = b.vo ? voiceFor(root, b, sb) : null;
    // Continuous takes play back to back: no lead inside a take, no tail until its last beat.
    const take = vo?.take;
    const continuousLead = (sb.pacing.continuous === true && b.vo) || (take && take.index > 0);
    const continuousTail = (sb.pacing.continuous === true && b.vo) || (take && take.index < take.count - 1);
    const lead = b.lead ?? (continuousLead ? 0 : sb.pacing.lead);
    const tail = b.tail ?? (continuousTail ? 0 : (b.block ? blockTail(b.block) : null) ?? sb.pacing.tail);
    const natural = vo ? Math.max(0, lead) + vo.duration + tail + (b.hold ?? 0) : sb.pacing.silentBeat + (b.hold ?? 0);
    const dur = b.duration ?? Math.max(b.min ?? sb.pacing.minBeat, natural);
    const start = snap(cursor, fps);
    const end = snap(cursor + dur, fps);
    const beat = {
      id: b.id, index, chapter: b.chapter ?? null, scene: b.scene ?? null, block: b.block ?? null, props: b.props ?? null,
      transition: b.transition ?? null, start, end, dur: round(end - start), visual: b.visual ?? null,
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
        words: vo.words.map((w) => ({ w: w.w, t0: round(voStart + w.t0), t1: round(voStart + w.t1) })),
      };
    }
    if (b.sfx) beat.sfx = b.sfx.map((s) => ({ src: s.src, volume: s.volume ?? 0.6, t: resolveAt(s.at ?? 0, beat) }));
    beats.push(beat);
    cursor = end;
  }
  const duration = round(cursor + (sb.pacing.outro ?? 0));
  const music = sb.music && sb.music.file !== false ? musicInfo(root, sb) : null;
  return {
    title: sb.title ?? 'Untitled',
    width, height, fps, duration,
    frames: Math.round(duration * fps),
    theme: sb.theme ?? 'paper',
    // Recorded for reference; the native job (fframes/production.mjs) is authoritative.
    look: {
      backdrop: sb.backdrop ?? 'none', chrome: sb.chrome === true, captions: sb.captions ?? 'auto',
      transition: sb.transition ?? 'fade', sfx: sb.sfx ?? false, voiceProvider: sb.voice.provider,
    },
    estimated: beats.some((b) => b.vo?.estimated),
    beats,
    music,
    assets: sb.assets.map((a) => ({ id: a.id, kind: a.kind, src: assetSrc(root, a) })),
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
export function findWord(words, query, nth = 0) {
  const q = query.split(/\s+/).map(norm).filter(Boolean);
  if(!q.length)return null;
  let seen = 0;
  for (let i = 0; i + q.length <= words.length; i++) {
    if (q.every((part, j) => norm(words[i + j].w) === part)) {
      if (seen++ === nth) return words[i].t0;
    }
  }
  return null;
}

function musicInfo(root, sb) {
  const candidates = [sb.music.file, findMusicBed(root)].filter(Boolean);
  const src = candidates.find((f) => fs.existsSync(path.join(root, f))) ?? null;
  return { src, volume: sb.music.volume, duck: sb.music.duck, fadeIn: sb.music.fadeIn, fadeOut: sb.music.fadeOut, offset: sb.music.offset ?? 0 };
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

/** Caption cues from narration timing (phrase-chunked). Used for SRT/VTT export and burned-in captions. */
export function captionCues(timing, { maxWords = 7, maxChars = 42 } = {}) {
  const cues = [];
  for (const b of timing.beats) {
    const words = b.vo?.words ?? [];
    let cur = [];
    const flush = () => { if (cur.length) cues.push({ start: cur[0].t0, end: cur.at(-1).t1, text: cur.map((w) => w.w).join(' ') }); cur = []; };
    for (const w of words) {
      cur.push(w);
      if (cur.length >= maxWords || cur.map((x) => x.w).join(' ').length >= maxChars || /[.!?;:,—]$/.test(w.w)) flush();
    }
    flush();
  }
  return cues;
}

const stamp = (t, sep) => {
  const ms = Math.round(t * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}${sep}${String(ms % 1000).padStart(3, '0')}`;
};
export function toSRT(cues) { return cues.map((c, i) => `${i + 1}\n${stamp(c.start, ',')} --> ${stamp(c.end, ',')}\n${c.text}\n`).join('\n'); }
export function toVTT(cues) { return `WEBVTT\n\n${cues.map((c) => `${stamp(c.start, '.')} --> ${stamp(c.end, '.')}\n${c.text}\n`).join('\n')}`; }
