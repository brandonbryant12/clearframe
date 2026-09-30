// Generative assets, cached by content hash so nothing is paid for twice.
// Order of preference: code (free) → draft (free, local) → Gemini (paid, only what the storyboard asks for).
import fs from 'node:fs';
import path from 'node:path';
import { analyseVoice, cleanVoice, draftMusic, draftVoice } from './audio.mjs';
import { loadStoryboard, paths } from './project.mjs';
import { computeTiming, estimateDuration, tokenize } from './timing.mjs';
import { hashOf, log, readJSON, round, writeJSON } from './util.mjs';
import { findMusicBed, writeMusicBed } from './music-files.mjs';
import * as tts from '../../skills/gemini-tts/scripts/tts.mjs';
import * as image from '../../skills/gemini-image/scripts/image.mjs';
import * as music from '../../skills/lyria-music/scripts/music.mjs';
import * as veo from '../../skills/veo-video/scripts/veo.mjs';
import * as omni from '../../skills/gemini-omni/scripts/omni.mjs';
import { clipSpec } from './continuity.mjs';
import { palette } from '../../fframes/catalog.mjs';
import { mediaDuration } from './util.mjs';

const money = n => `$${n.toFixed(n < 0.1 ? 4 : 2)}`;

function guardBudget(total, budget) {
  if (budget != null && total > budget) {
    throw new Error(
      `Estimated spend ${money(total)} exceeds the budget ${money(budget)}. Raise it with --budget or storyboard.budget.`,
    );
  }
}

// ------------------------------------------------------------------ voice
function voiceSpec(sb, b, provider) {
  return {
    provider,
    model: sb.voice.model,
    voice: sb.voice.voice,
    style: b.style ?? sb.voice.style ?? '',
    language: sb.voice.language ?? null,
    text: b.vo,
  };
}

export async function voice(root, { draft = false, force = false, only, budget } = {}) {
  const sb = loadStoryboard(root);
  if (sb.voice.takes === 'chapter') {
    // One take per chapter: continuous delivery, split back into beats afterwards.
    const { planTakes, recordTakes } = await import('./takes.mjs');
    if (!draft && sb.voice.provider === 'gemini') {
      const secs = planTakes(sb)
        .flatMap(t => t.beats)
        .reduce((a, b) => a + estimateDuration(b.vo, sb.voice.wpm), 0);
      const cost = tts.estimateCost({ seconds: secs, model: sb.voice.model });
      log.step(`Gemini TTS (continuous takes): ~${secs.toFixed(0)}s of speech, ≈ ${money(cost)}`);
      guardBudget(cost, budget ?? sb.budget);
    } else log.step('Draft voice in continuous takes (local OS TTS, free)');
    return recordTakes(root, sb, {
      draft,
      force,
      synthesize: async (spec, out) => {
        const r = await tts.synthesize({
          parts: spec.parts,
          cast: spec.cast,
          voice: spec.voice,
          model: spec.model,
          language: spec.language ?? undefined,
        });
        if (!r.wav) throw new Error(`TTS returned ${r.mimeType}, expected WAV`);
        fs.writeFileSync(`${out}.raw`, r.wav);
        await cleanVoice(`${out}.raw`, out);
        fs.rmSync(`${out}.raw`, { force: true });
      },
    });
  }
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
    const cached = meta?.hash === hashOf(spec) && nonempty(wavFile);
    if (cached && !force) continue;
    if (meta?.provider === 'imported' && meta.textHash === hashOf(b.vo) && nonempty(wavFile) && !force) {
      log.dim(`  ${b.id}: keeping the imported recording (use --force to replace)`);
      continue;
    }
    if (draft && meta?.provider === 'gemini' && meta.textHash === hashOf(b.vo) && !force) {
      log.dim(`  ${b.id}: keeping the real take (use --force to replace with a draft)`);
      continue;
    }
    todo.push({ b, spec, metaFile, wavFile });
  }
  if (!todo.length) {
    log.ok('Voice is up to date.');
    return;
  }
  if (provider === 'gemini') {
    const secs = todo.reduce((a, x) => a + estimateDuration(x.b.vo, sb.voice.wpm), 0);
    const cost = tts.estimateCost({ seconds: secs, model: sb.voice.model });
    log.step(
      `Gemini TTS: ${todo.length} line(s), ~${secs.toFixed(0)}s of speech, ≈ ${money(cost)} (${sb.voice.model}, voice ${sb.voice.voice})`,
    );
    guardBudget(cost, budget ?? sb.budget);
  } else log.step(`Draft voice (local OS TTS, free): ${todo.length} line(s)`);

  for (const { b, spec, metaFile, wavFile } of todo) {
    const raw = `${wavFile}.raw`;
    if (provider === 'gemini') {
      const r = await tts.synthesize({
        text: b.vo,
        voice: spec.voice,
        style: spec.style || undefined,
        model: spec.model,
        language: spec.language || undefined,
      });
      if (!r.wav) throw new Error(`[${b.id}] TTS returned ${r.mimeType}, expected WAV`);
      fs.writeFileSync(raw, r.wav);
      await cleanVoice(raw, wavFile);
      fs.rmSync(raw, { force: true });
    } else {
      await draftVoice(b.vo, wavFile, { wpm: sb.voice.wpm, voice: sb.voice.draftVoice });
    }
    const a = await analyseVoice(wavFile, b.vo);
    writeJSON(metaFile, {
      hash: hashOf(spec),
      textHash: hashOf(b.vo),
      provider,
      model: provider === 'gemini' ? spec.model : 'os-tts',
      voice: spec.voice,
      style: spec.style,
      text: b.vo,
      ...a,
      createdAt: new Date().toISOString(),
    });
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
    if (g && g.key === key) g.to = b.end;
    else groups.push({ key, from: b.start, to: b.end });
  }
  const arc = sb.music?.arc ?? {};
  return groups.map((g, i) => ({
    from: round(g.from, 1),
    to: round(g.to, 1),
    text:
      arc[g.key] ??
      (i === 0
        ? 'Intro: sparse and airy — a soft pad and a gentle pulse.'
        : i === groups.length - 1
          ? 'Outro: resolve and thin out to one sustained chord.'
          : 'Steady, understated groove; one new layer at most; leave space for a speaking voice.'),
  }));
}

function musicSpec(sb, timing) {
  const model = sb.music.model ?? 'lyria-3.5';
  const seconds = Math.ceil(timing.duration + 2);
  if (model === 'lyria-realtime')
    return {
      model,
      prompts: sb.music.weightedPrompts ?? [{ text: sb.music.prompt, weight: 1.0 }],
      bpm: sb.music.bpm,
      density: sb.music.density,
      brightness: sb.music.brightness,
      scale: sb.music.scale,
      seconds,
    };
  return {
    model,
    prompt: music.composePrompt({
      style: sb.music.prompt,
      bpm: sb.music.bpm,
      key: sb.music.key,
      seconds,
      sections: musicSections(timing, sb),
      ending: sb.music.ending,
    }),
  };
}

export async function scoreMusic(root, { draft = false, force = false, budget } = {}) {
  const sb = loadStoryboard(root);
  if (!sb.music) {
    log.dim('storyboard.music is false — skipping music.');
    return;
  }
  const P = paths(root);
  fs.mkdirSync(P.music, { recursive: true });
  const timing = computeTiming(root);
  const seconds = Math.ceil(timing.duration + 2);
  const metaFile = path.join(P.music, 'bed.json');
  const meta = readJSON(metaFile, null);
  if (draft) {
    if (meta?.provider && meta.provider !== 'local' && findMusicBed(root, meta) && !force) {
      log.dim('  keeping the generated music (use --force to replace with a draft)');
      return;
    }
    const out = path.join(P.music, `bed-draft-${process.pid}.wav`);
    try {
      await draftMusic(out, { seconds, bpm: sb.music.bpm ?? 72 });
      writeMusicBed(root, fs.readFileSync(out), 'wav', {
        provider: 'local',
        seconds,
        createdAt: new Date().toISOString(),
      });
    } finally {
      fs.rmSync(out, { force: true });
    }
    log.ok(`Draft music bed (${seconds}s) → assets/music/bed.wav`);
    return;
  }
  const spec = musicSpec(sb, timing),
    { model, prompt } = spec;
  if (meta?.hash === hashOf(spec) && findMusicBed(root, meta) && !force) {
    log.ok('Music is up to date.');
    return;
  }
  if (model === 'lyria-realtime') {
    const { stream } = await import('../../skills/lyria-music/scripts/realtime.mjs');
    log.step(`Lyria RealTime: streaming ${seconds}s (experimental)…`);
    const buf = await stream(spec, { seconds });
    writeMusicBed(root, buf, 'wav', {
      hash: hashOf(spec),
      provider: 'lyria-realtime',
      ...spec,
      createdAt: new Date().toISOString(),
    });
    log.ok('Music → assets/music/bed.wav');
    return;
  }
  const cost = music.estimateCost({ model });
  log.step(`Lyria (${model}): ${seconds}s bed, ≈ ${money(cost)}`);
  guardBudget(cost, budget ?? sb.budget);
  const r = await music.generateMusic({ prompt, model, format: 'mp3' });
  const file = writeMusicBed(root, r.data, r.ext, {
    hash: hashOf(spec),
    provider: 'lyria',
    model,
    prompt,
    notes: r.text,
    createdAt: new Date().toISOString(),
  });
  log.ok(`Music → ${file}${r.text ? ' (model notes saved in bed.json)' : ''}`);
  if (sb.music.file && sb.music.file !== file)
    log.warn(`storyboard.music.file points to ${sb.music.file}; the new bed is ${file}`);
}

// ------------------------------------------------------------------ images & clips
const nonempty = file => {
  try {
    return fs.statSync(file).size > 0;
  } catch {
    return false;
  }
};
function assetMeta(dir, id) {
  return readJSON(path.join(dir, `${id}.json`), null);
}

/**
 * The prompt actually sent for a generated still: the author's subject, then the film's palette
 * and continuity, then composition hints from how the storyboard uses the image (a split plate
 * needs its subject away from the seam; a full plate needs calm space where text sits).
 * `raw: true` sends the author's prompt unchanged.
 */
export function imagePrompt(sb, a) {
  if (a.raw) return a.prompt;
  const colors = palette(sb.theme ?? 'paper'),
    style = sb.continuity ?? {};
  const uses = sb.beats.filter(b => b.plate?.asset === a.id || b.props?.asset === a.id);
  const hints = [
    ...new Set(
      uses
        .map(b => {
          const side = b.plate?.side ?? (b.plate ? 'full' : null);
          if (side === 'full')
            return `Composition: a calm, uncluttered area on the ${b.props?.align === 'center' ? 'centre' : 'left half'} where large text will sit; the subject toward the ${b.props?.align === 'center' ? 'edges' : 'right third'}.`;
          if (side === 'left' || side === 'top')
            return 'Composition: the subject centred in the frame, nothing important near the right edge (it meets a text panel).';
          if (side === 'right' || side === 'bottom')
            return 'Composition: the subject centred, nothing important near the left edge (it meets a text panel).';
          return null;
        })
        .filter(Boolean),
    ),
  ];
  const treated = uses.some(b => ['duotone', 'tint', 'mono'].includes(b.plate?.treatment));
  return [
    a.prompt,
    treated
      ? 'Strong tonal contrast and clear shapes; it will be recoloured into two tones, so readable light and shadow matter more than colour.'
      : `Colour palette: background ${colors.bg}, deep tones near ${colors.ink}, one accent close to ${colors.accent}.`,
    `Treatment: ${style.treatment ?? 'editorial, restrained, generous negative space'}. Lighting: ${style.lighting ?? 'soft, diffuse'}.`,
    ...hints,
    'No text, letters, numbers, logos, watermarks, charts or UI anywhere in the image.',
  ].join('\n');
}

export async function images(root, { only, force = false, budget } = {}) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const list = sb.assets.filter(a => a.kind === 'image' && !a.file && (!only || only.includes(a.id)));
  const specHash = a => hashOf({ ...a, prompt: imagePrompt(sb, a) });
  const todo = list.filter(
    a => force || assetMeta(P.img, a.id)?.hash !== specHash(a) || !fs.existsSync(path.join(P.img, `${a.id}.jpg`)),
  );
  if (!todo.length) {
    log.ok('Images are up to date.');
    return;
  }
  const cost = todo.reduce((s, a) => s + image.estimateCost({ model: a.model, size: a.size ?? '2K' }), 0);
  log.step(`Gemini image: ${todo.length} image(s), ≈ ${money(cost)}`);
  guardBudget(cost, budget ?? sb.budget);
  fs.mkdirSync(P.img, { recursive: true });
  for (const a of todo) {
    const refs = (a.refs ?? []).map(r =>
      fs.existsSync(path.join(root, r)) ? path.join(root, r) : path.join(P.img, `${r}.jpg`),
    );
    const aspect =
      a.aspect ?? (sb.format.width > sb.format.height ? '16:9' : sb.format.width < sb.format.height ? '9:16' : '1:1');
    const prompt = imagePrompt(sb, a);
    const r = await image.generateImage({
      prompt,
      model: a.model ?? 'gemini-3.1-flash-image',
      aspect,
      size: a.size ?? '2K',
      refs,
    });
    fs.writeFileSync(path.join(P.img, `${a.id}.jpg`), r.data);
    writeJSON(path.join(P.img, `${a.id}.json`), {
      hash: specHash(a),
      model: a.model ?? 'gemini-3.1-flash-image',
      prompt,
      note: r.text,
      createdAt: new Date().toISOString(),
    });
    log.ok(`${a.id} → assets/img/${a.id}.jpg`);
  }
}

export async function clips(root, { only, force = false, budget } = {}) {
  const sb = loadStoryboard(root),
    P = paths(root);
  const list = sb.assets.filter(a => a.kind === 'clip' && !a.file && (!only || only.includes(a.id)));
  const jobs = list.map(a => ({ a, spec: clipSpec(root, sb, a) }));
  const todo = jobs.filter(
    ({ a, spec }) =>
      force || assetMeta(P.clips, a.id)?.hash !== spec.hash || !nonempty(path.join(P.clips, `${a.id}.mp4`)),
  );
  if (!todo.length) {
    log.ok('Clips are up to date.');
    return;
  }
  for (const { spec } of todo)
    if (spec.model !== omni.MODEL && !Object.hasOwn(veo.MODELS, spec.model))
      throw new Error(`Unsupported video model ${spec.model}`);
  const estimate = todo.reduce((n, { spec }) => n + (spec.model === omni.MODEL ? omni : veo).estimateCost(spec), 0);
  log.step(
    `${todo.length} generated insert(s), approximately ${money(estimate)}. Omni duration and final charges can vary; this is an estimate, not a billing cap.`,
  );
  guardBudget(estimate, budget ?? sb.budget);
  fs.mkdirSync(P.clips, { recursive: true });
  for (const { a, spec } of todo) {
    const out = path.join(P.clips, `${a.id}.mp4`),
      stage = path.join(P.clips, `${a.id}-${process.pid}.tmp.mp4`);
    let result;
    try {
      if (spec.model === omni.MODEL) {
        result = await omni.generateVideo(spec);
        fs.writeFileSync(stage, result.data);
      } else
        await veo.generateVideo(
          { ...spec, image: spec.refs[0] },
          { out: stage, onPoll: () => process.stdout.write('.') },
        );
      const seconds = await mediaDuration(stage);
      if (!(seconds > 0)) throw new Error('Generated clip is not playable');
      fs.renameSync(stage, out);
      const { refs, ...saved } = spec;
      writeJSON(path.join(P.clips, `${a.id}.json`), {
        ...saved,
        seconds,
        requestedSeconds: spec.seconds,
        interactionId: result?.interactionId,
        usage: result?.usage,
        createdAt: new Date().toISOString(),
      });
      log.ok(`${a.id} → assets/clips/${a.id}.mp4 (${seconds.toFixed(2)}s; clip audio is excluded from the film mix)`);
    } finally {
      fs.rmSync(stage, { force: true });
    }
  }
}

// ------------------------------------------------------------------ plan
/** What would we pay for, and what is already cached? */
export function plan(root) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const timing = computeTiming(root);
  const rows = [];
  for (const b of sb.beats.filter(x => x.vo)) {
    const meta = readJSON(path.join(P.vo, `${b.id}.json`), null);
    const done =
      ((meta?.provider === 'gemini' && meta.hash === hashOf(voiceSpec(sb, b, 'gemini'))) ||
        (meta?.provider === 'imported' && meta.textHash === hashOf(b.vo))) &&
      nonempty(path.join(P.vo, `${b.id}.wav`));
    const secs = estimateDuration(b.vo, sb.voice.wpm);
    rows.push({
      kind: 'voice',
      id: b.id,
      detail: `${secs.toFixed(1)}s speech`,
      cost: done ? 0 : tts.estimateCost({ seconds: secs, model: sb.voice.model }),
      status: done ? 'cached' : meta?.provider === 'local' ? 'draft only' : 'todo',
    });
  }
  if (sb.music) {
    const meta = readJSON(path.join(P.music, 'bed.json'), null);
    const model = sb.music.model ?? 'lyria-3.5';
    const done =
      meta?.provider !== 'local' && meta?.hash === hashOf(musicSpec(sb, timing)) && !!findMusicBed(root, meta);
    rows.push({
      kind: 'music',
      id: 'bed',
      detail: `${Math.ceil(timing.duration + 2)}s ${model}`,
      cost: done ? 0 : model === 'lyria-realtime' ? 0 : music.estimateCost({ model }),
      status: done ? 'cached' : meta?.provider === 'local' ? 'draft only' : 'todo',
    });
  }
  for (const a of sb.assets.filter(a => !a.file)) {
    if (a.kind === 'image') {
      const done =
        assetMeta(P.img, a.id)?.hash === hashOf({ ...a, prompt: imagePrompt(sb, a) }) &&
        nonempty(path.join(P.img, `${a.id}.jpg`));
      rows.push({
        kind: 'image',
        id: a.id,
        detail: `${a.size ?? '2K'} ${a.model ?? 'gemini-3.1-flash-image'}`,
        cost: done ? 0 : image.estimateCost({ model: a.model, size: a.size ?? '2K' }),
        status: done ? 'cached' : 'todo',
      });
    }
    if (a.kind === 'clip') {
      const spec = clipSpec(root, sb, a, { allowMissing: true }),
        done = assetMeta(P.clips, a.id)?.hash === spec.hash && nonempty(path.join(P.clips, `${a.id}.mp4`));
      rows.push({
        kind: 'clip',
        id: a.id,
        detail: `~${spec.seconds}s ${spec.resolution} ${spec.model}`,
        cost: done ? 0 : (spec.model === omni.MODEL ? omni : veo).estimateCost(spec),
        status: done ? 'cached' : 'todo',
      });
    }
  }
  const clipSecs = sb.assets.filter(a => a.kind === 'clip').reduce((s, a) => s + (a.seconds ?? 4), 0);
  return {
    rows,
    total: rows.reduce((s, r) => s + r.cost, 0),
    duration: timing.duration,
    clipShare: clipSecs / timing.duration,
  };
}
