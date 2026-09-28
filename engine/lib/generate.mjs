// Generative assets, cached by content hash so nothing is paid for twice.
// Order of preference: code (free) → draft (free, local) → Gemini (paid, only what the storyboard asks for).
import fs from 'node:fs';
import path from 'node:path';
import { analyseVoice, cleanVoice, draftMusic, draftVoice } from './audio.mjs';
import { loadStoryboard, paths } from './project.mjs';
import { computeTiming, estimateDuration, tokenize } from './timing.mjs';
import { hashOf, log, readJSON, round, writeJSON } from './util.mjs';
import * as tts from '../../skills/gemini-tts/scripts/tts.mjs';
import * as image from '../../skills/gemini-image/scripts/image.mjs';
import * as music from '../../skills/lyria-music/scripts/music.mjs';
import * as veo from '../../skills/veo-video/scripts/veo.mjs';

const money = (n) => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;

function guardBudget(total, budget) {
  if (budget != null && total > budget) {
    throw new Error(`Estimated spend ${money(total)} exceeds the budget ${money(budget)}. Raise it with --budget or storyboard.budget.`);
  }
}

// ------------------------------------------------------------------ voice
function voiceSpec(sb, b, provider) {
  return { provider, model: sb.voice.model, voice: sb.voice.voice, style: b.style ?? sb.voice.style ?? '', language: sb.voice.language ?? null, text: b.vo };
}

export async function voice(root, { draft = false, force = false, only, budget } = {}) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  fs.mkdirSync(P.vo, { recursive: true });
  const provider = draft ? 'local' : sb.voice.provider;
  const todo = [];
  for (const b of sb.beats) {
    if (!b.vo || (only && !only.includes(b.id))) continue;
    const spec = voiceSpec(sb, b, provider);
    const metaFile = path.join(P.vo, `${b.id}.json`);
    const wavFile = path.join(P.vo, `${b.id}.wav`);
    const meta = readJSON(metaFile, null);
    const cached = meta?.hash === hashOf(spec) && fs.existsSync(wavFile);
    if (cached && !force) continue;
    if (draft && meta?.provider === 'gemini' && meta.textHash === hashOf(b.vo) && !force) { log.dim(`  ${b.id}: keeping the real take (use --force to replace with a draft)`); continue; }
    todo.push({ b, spec, metaFile, wavFile });
  }
  if (!todo.length) { log.ok('Voice is up to date.'); return; }
  if (provider === 'gemini') {
    const secs = todo.reduce((a, x) => a + estimateDuration(x.b.vo, sb.voice.wpm), 0);
    const cost = tts.estimateCost({ seconds: secs, model: sb.voice.model });
    log.step(`Gemini TTS: ${todo.length} line(s), ~${secs.toFixed(0)}s of speech, ≈ ${money(cost)} (${sb.voice.model}, voice ${sb.voice.voice})`);
    guardBudget(cost, budget ?? sb.budget);
  } else log.step(`Draft voice (local OS TTS, free): ${todo.length} line(s)`);

  for (const { b, spec, metaFile, wavFile } of todo) {
    const raw = `${wavFile}.raw`;
    if (provider === 'gemini') {
      const r = await tts.synthesize({ text: b.vo, voice: spec.voice, style: spec.style || undefined, model: spec.model, language: spec.language || undefined });
      if (!r.wav) throw new Error(`[${b.id}] TTS returned ${r.mimeType}, expected WAV`);
      fs.writeFileSync(raw, r.wav);
      await cleanVoice(raw, wavFile);
      fs.rmSync(raw, { force: true });
    } else {
      await draftVoice(b.vo, wavFile, { wpm: sb.voice.wpm, voice: sb.voice.draftVoice });
    }
    const a = await analyseVoice(wavFile, b.vo);
    writeJSON(metaFile, { hash: hashOf(spec), textHash: hashOf(b.vo), provider, model: provider === 'gemini' ? spec.model : 'os-tts', voice: spec.voice, style: spec.style, text: b.vo, ...a, createdAt: new Date().toISOString() });
    const wpm = Math.round((tokenize(b.vo).length / a.duration) * 60);
    log.ok(`${b.id}: ${a.duration.toFixed(2)}s · ${wpm} wpm · ${a.segments.length} phrase(s)`);
  }
}

// ------------------------------------------------------------------ music
/** Derive a timestamped musical arc from the edit, so the score breathes with the story. */
export function musicSections(timing, sb) {
  if (sb.music?.sections) return sb.music.sections;
  const groups = [];
  for (const b of timing.beats) {
    const key = b.chapter ?? (b.index === 0 ? 'open' : b.index === timing.beats.length - 1 ? 'close' : 'body');
    const g = groups.at(-1);
    if (g && g.key === key) g.to = b.end; else groups.push({ key, from: b.start, to: b.end });
  }
  const arc = sb.music?.arc ?? {};
  return groups.map((g, i) => ({
    from: round(g.from, 1), to: round(g.to, 1),
    text: arc[g.key] ?? (i === 0 ? 'Intro: sparse and airy — a soft pad and a gentle pulse.'
      : i === groups.length - 1 ? 'Outro: resolve and thin out to one sustained chord.'
        : 'Steady, understated groove; one new layer at most; leave space for a speaking voice.'),
  }));
}

export async function scoreMusic(root, { draft = false, force = false, budget } = {}) {
  const sb = loadStoryboard(root);
  if (!sb.music) { log.dim('storyboard.music is false — skipping music.'); return; }
  const P = paths(root);
  fs.mkdirSync(P.music, { recursive: true });
  const timing = computeTiming(root);
  const seconds = Math.ceil(timing.duration + 2);
  const metaFile = path.join(P.music, 'bed.json');
  const meta = readJSON(metaFile, null);
  if (draft) {
    if (meta?.provider && meta.provider !== 'local' && !force) { log.dim('  keeping the generated music (use --force to replace with a draft)'); return; }
    const out = path.join(P.music, 'bed.wav');
    await draftMusic(out, { seconds, bpm: sb.music.bpm ?? 72 });
    writeJSON(metaFile, { provider: 'local', seconds, createdAt: new Date().toISOString() });
    log.ok(`Draft music bed (${seconds}s) → assets/music/bed.wav`);
    return;
  }
  const model = sb.music.model ?? 'lyria-3.5';
  if (model === 'lyria-realtime') {
    const { stream } = await import('../../skills/lyria-music/scripts/realtime.mjs');
    const prompts = sb.music.weightedPrompts ?? [{ text: sb.music.prompt, weight: 1.0 }];
    const spec = { model, prompts, bpm: sb.music.bpm, density: sb.music.density, brightness: sb.music.brightness, scale: sb.music.scale, seconds };
    if (meta?.hash === hashOf(spec) && !force) { log.ok('Music is up to date.'); return; }
    log.step(`Lyria RealTime: streaming ${seconds}s (experimental)…`);
    const buf = await stream(spec, { seconds });
    fs.writeFileSync(path.join(P.music, 'bed.wav'), buf);
    writeJSON(metaFile, { hash: hashOf(spec), provider: 'lyria-realtime', ...spec, createdAt: new Date().toISOString() });
    log.ok('Music → assets/music/bed.wav');
    return;
  }
  const prompt = music.composePrompt({ style: sb.music.prompt, bpm: sb.music.bpm, key: sb.music.key, seconds, sections: musicSections(timing, sb), ending: sb.music.ending });
  const spec = { model, prompt };
  if (meta?.hash === hashOf(spec) && !force) { log.ok('Music is up to date.'); return; }
  const cost = music.estimateCost({ model });
  log.step(`Lyria (${model}): ${seconds}s bed, ≈ ${money(cost)}`);
  guardBudget(cost, budget ?? sb.budget);
  const r = await music.generateMusic({ prompt, model, format: 'wav' });
  for (const old of ['bed.wav', 'bed.mp3', 'bed.ogg']) fs.rmSync(path.join(P.music, old), { force: true });
  const file = path.join(P.music, `bed.${r.ext}`);
  fs.writeFileSync(file, r.data);
  writeJSON(metaFile, { hash: hashOf(spec), provider: 'lyria', model, prompt, notes: r.text, createdAt: new Date().toISOString() });
  log.ok(`Music → ${path.relative(root, file)}${r.text ? ' (model notes saved in bed.json)' : ''}`);
  if (sb.music.file && sb.music.file !== path.relative(root, file)) log.warn(`storyboard.music.file points to ${sb.music.file}; the new bed is ${path.relative(root, file)}`);
}

// ------------------------------------------------------------------ images & clips
function assetMeta(dir, id) { return readJSON(path.join(dir, `${id}.json`), null); }

export async function images(root, { only, force = false, budget } = {}) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const list = sb.assets.filter((a) => a.kind === 'image' && (!only || only.includes(a.id)));
  const todo = list.filter((a) => force || assetMeta(P.img, a.id)?.hash !== hashOf(a) || !fs.existsSync(path.join(P.img, `${a.id}.jpg`)));
  if (!todo.length) { log.ok('Images are up to date.'); return; }
  const cost = todo.reduce((s, a) => s + image.estimateCost({ model: a.model, size: a.size ?? '2K' }), 0);
  log.step(`Gemini image: ${todo.length} image(s), ≈ ${money(cost)}`);
  guardBudget(cost, budget ?? sb.budget);
  fs.mkdirSync(P.img, { recursive: true });
  for (const a of todo) {
    const refs = (a.refs ?? []).map((r) => (fs.existsSync(path.join(root, r)) ? path.join(root, r) : path.join(P.img, `${r}.jpg`)));
    const aspect = a.aspect ?? (sb.format.width > sb.format.height ? '16:9' : sb.format.width < sb.format.height ? '9:16' : '1:1');
    const r = await image.generateImage({ prompt: a.prompt, model: a.model ?? 'gemini-3.1-flash-image', aspect, size: a.size ?? '2K', refs });
    fs.writeFileSync(path.join(P.img, `${a.id}.jpg`), r.data);
    writeJSON(path.join(P.img, `${a.id}.json`), { hash: hashOf(a), model: a.model ?? 'gemini-3.1-flash-image', prompt: a.prompt, note: r.text, createdAt: new Date().toISOString() });
    log.ok(`${a.id} → assets/img/${a.id}.jpg`);
  }
}

export async function clips(root, { only, force = false, budget } = {}) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const list = sb.assets.filter((a) => a.kind === 'clip' && (!only || only.includes(a.id)));
  const todo = list.filter((a) => force || assetMeta(P.clips, a.id)?.hash !== hashOf(a) || !fs.existsSync(path.join(P.clips, `${a.id}.mp4`)));
  if (!todo.length) { log.ok('Clips are up to date.'); return; }
  const cost = todo.reduce((s, a) => s + veo.estimateCost({ model: a.model, resolution: a.resolution ?? '720p', seconds: a.seconds ?? 4 }), 0);
  log.step(`Veo: ${todo.length} clip(s), ≈ ${money(cost)} — each takes 11 s to 6 min`);
  guardBudget(cost, budget ?? sb.budget);
  fs.mkdirSync(P.clips, { recursive: true });
  for (const a of todo) {
    const img = a.from ? path.join(P.img, `${a.from}.jpg`) : a.image ? path.join(root, a.image) : undefined;
    if (img && !fs.existsSync(img)) throw new Error(`[${a.id}] source image missing: ${img} (run \`clearframe images\` first)`);
    const aspect = sb.format.width >= sb.format.height ? '16:9' : '9:16';
    const out = path.join(P.clips, `${a.id}.mp4`);
    await veo.generateVideo({ prompt: a.prompt, model: a.model, image: img, aspect, resolution: a.resolution ?? '720p', seconds: a.seconds ?? 4, seed: a.seed },
      { out, onPoll: () => process.stdout.write('.') });
    process.stdout.write('\n');
    writeJSON(path.join(P.clips, `${a.id}.json`), { hash: hashOf(a), model: a.model ?? 'veo-3.1-lite-generate-preview', prompt: a.prompt, createdAt: new Date().toISOString() });
    log.ok(`${a.id} → assets/clips/${a.id}.mp4`);
  }
}

// ------------------------------------------------------------------ plan
/** What would we pay for, and what is already cached? */
export function plan(root) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const timing = computeTiming(root);
  const rows = [];
  for (const b of sb.beats.filter((x) => x.vo)) {
    const meta = readJSON(path.join(P.vo, `${b.id}.json`), null);
    const done = meta?.provider === 'gemini' && meta.hash === hashOf(voiceSpec(sb, b, 'gemini'));
    const secs = estimateDuration(b.vo, sb.voice.wpm);
    rows.push({ kind: 'voice', id: b.id, detail: `${secs.toFixed(1)}s speech`, cost: done ? 0 : tts.estimateCost({ seconds: secs, model: sb.voice.model }), status: done ? 'cached' : meta?.provider === 'local' ? 'draft only' : 'todo' });
  }
  if (sb.music) {
    const meta = readJSON(path.join(P.music, 'bed.json'), null);
    const model = sb.music.model ?? 'lyria-3.5';
    const done = meta && meta.provider !== 'local';
    rows.push({ kind: 'music', id: 'bed', detail: `${Math.ceil(timing.duration + 2)}s ${model}`, cost: done ? 0 : model === 'lyria-realtime' ? 0 : music.estimateCost({ model }), status: done ? 'cached' : meta ? 'draft only' : 'todo' });
  }
  for (const a of sb.assets) {
    if (a.kind === 'image') {
      const done = assetMeta(P.img, a.id)?.hash === hashOf(a);
      rows.push({ kind: 'image', id: a.id, detail: `${a.size ?? '2K'} ${a.model ?? 'gemini-3.1-flash-image'}`, cost: done ? 0 : image.estimateCost({ model: a.model, size: a.size ?? '2K' }), status: done ? 'cached' : 'todo' });
    }
    if (a.kind === 'clip') {
      const done = assetMeta(P.clips, a.id)?.hash === hashOf(a);
      rows.push({ kind: 'clip', id: a.id, detail: `${a.seconds ?? 4}s ${a.resolution ?? '720p'} ${a.model ?? 'veo-3.1-lite'}`, cost: done ? 0 : veo.estimateCost({ model: a.model, resolution: a.resolution ?? '720p', seconds: a.seconds ?? 4 }), status: done ? 'cached' : 'todo' });
    }
  }
  const clipSecs = sb.assets.filter((a) => a.kind === 'clip').reduce((s, a) => s + (a.seconds ?? 4), 0);
  return { rows, total: rows.reduce((s, r) => s + r.cost, 0), duration: timing.duration, clipShare: clipSecs / timing.duration };
}
