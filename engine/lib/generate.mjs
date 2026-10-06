// Generative assets, cached by content hash so nothing is paid for twice.
// Order of preference: code (free) → draft (free, local) → Gemini (paid, only what the storyboard asks for).
import fs from 'node:fs';
import { planTakes, takeSpec } from './takes.mjs';
import { CHROMA, keyOut } from './plates.mjs';
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
import * as runway from '../../skills/runway-video/scripts/runway.mjs';

/** The skill that serves a clip model: Gemini Omni, Veo or Runway (Seedance, Gen-4.5). */
export function clipProvider(model) {
  if (model === omni.MODEL) return omni;
  if (Object.hasOwn(veo.MODELS, model)) return veo;
  if (Object.hasOwn(runway.MODELS, model)) return runway;
  throw new Error(`Unsupported video model ${model}`);
}
import { clipSpec, footageProblems } from './continuity.mjs';
import { palette } from '../../film/catalog.mjs';
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

/** The text parts a take sends: one text and one style for a single voice, turns for a cast. */
function takeParts(sb, spec) {
  const single = !spec.cast && !sb.voice.perBeatStyle;
  return single ? [{ text: spec.parts.map(p => p.text).join('\n\n'), style: spec.style }] : spec.parts;
}

export async function voice(root, { draft = false, force = false, only, budget, 'dry-run': dryRun = false } = {}) {
  const sb = loadStoryboard(root);
  if (dryRun && sb.voice.takes !== 'beat') {
    // The exact requests a real run would send, without a key or a call.
    const { planTakes, takeSpec } = await import('./takes.mjs');
    return planTakes(sb).map(take => {
      const spec = takeSpec(sb, take, 'gemini');
      return {
        take: take.id,
        beats: take.beats.map(b => b.id),
        request: tts.buildRequest({
          parts: takeParts(sb, spec),
          cast: spec.cast,
          voice: spec.voice,
          model: spec.model,
          language: spec.language ?? undefined,
        }),
      };
    });
  }
  if (sb.voice.takes !== 'beat') {
    // Continuous takes (the whole film by default): one performance, split into beats afterwards.
    const { planTakes, recordTakes } = await import('./takes.mjs');
    const styled = sb.beats.filter(b => b.vo && b.style);
    if (styled.length && !sb.voice.perBeatStyle)
      log.warn(
        `${styled.length} beat(s) set their own style; a continuous take uses voice.style for every line so the voice stays consistent. Shape delivery with the words, punctuation and a few inline tags instead (voice.perBeatStyle: true sends them anyway).`,
      );
    if (!draft && sb.voice.provider === 'gemini') {
      const secs = planTakes(sb)
        .flatMap(t => t.beats)
        .reduce((a, b) => a + estimateDuration(b.vo, sb.voice.wpm), 0);
      const cost = tts.estimateCost({ seconds: secs, model: sb.voice.model });
      const takes = planTakes(sb).length;
      log.step(
        `Gemini TTS: ${takes === 1 ? 'one continuous take' : `${takes} continuous takes`}, ~${secs.toFixed(0)}s of speech, ≈ ${money(cost)}`,
      );
      guardBudget(cost, budget ?? sb.budget);
    } else
      log.step(
        `Draft voice in ${planTakes(sb).length === 1 ? 'one continuous take' : 'continuous takes'} (local OS TTS, free)`,
      );
    return recordTakes(root, sb, {
      draft,
      force,
      synthesize: async (spec, out) => {
        // A single voice reads the take as one text with one style: paragraphs between beats
        // give natural pauses, and nothing re-prompts the voice mid-performance.
        const r = await tts.synthesize({
          parts: takeParts(sb, spec),
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
  // A film with silent beats is scored to its edit: a build that climbs into each silence,
  // the silence itself, and a hit that carries whatever follows.
  const silences = timing.beats.filter(b => !b.vo && b.dur >= 0.8);
  // An explicit chapter arc wins: voiceless beats there are picture-led, not scripted silences.
  if (silences.length && !sb.music?.arc) {
    const out = [];
    let from = 0;
    silences.forEach((s, i) => {
      const climb = Math.max(from, s.start - 3);
      if (climb - from > 1)
        out.push({
          from: round(from, 1),
          to: round(climb, 1),
          text:
            i === 0
              ? 'Intro: sparse and low, a slow pulse that grows bar by bar.'
              : 'Pick up again, darker and fuller.',
        });
      out.push({
        from: round(climb, 1),
        to: round(s.start, 1),
        text: 'Build: every layer in, rising tension climbing into a sudden stop.',
      });
      out.push({
        from: round(s.start, 1),
        to: round(s.end, 1),
        text: 'Silence: the music stops completely. Nothing plays.',
      });
      from = s.end;
    });
    if (timing.duration - from > 0.5)
      out.push({
        from: round(from, 1),
        to: round(timing.duration, 1),
        text: 'One deep impact on the first beat, then a low sustained chord that rings out to the end.',
      });
    return out;
  }
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
      // Silent beats: a pulse bed cuts dead through them, so the silence is real.
      const silences = timing.beats.filter(b => !b.vo).map(b => [b.start, b.end]);
      await draftMusic(out, { seconds, bpm: sb.music.bpm ?? 72, style: sb.music.style ?? 'pad', silences });
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
/** What an image's cache depends on: how it is drawn, not how it is staged (bounds, ground). */
function imageHash(sb, a) {
  const { bounds, ground, ...drawn } = a;
  return hashOf({ ...drawn, prompt: imagePrompt(sb, drawn) });
}

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
      : a.cutout
        ? `Colour palette for the subject: deep tones near ${colors.ink}, one accent close to ${colors.accent}.`
        : `Colour palette: background ${colors.bg}, deep tones near ${colors.ink}, one accent close to ${colors.accent}.`,
    `Treatment: ${style.treatment ?? 'editorial, restrained, generous negative space'}. Lighting: ${style.lighting ?? 'soft, diffuse'}.`,
    ...hints,
    'No text, letters, numbers, logos, watermarks, charts or UI anywhere in the image.',
    ...(a.cutout ? [CHROMA] : []),
  ].join('\n');
}

export async function images(root, { only, force = false, budget } = {}) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const list = sb.assets.filter(a => a.kind === 'image' && !a.file && (!only || only.includes(a.id)));
  const specHash = a => imageHash(sb, a);
  const todo = list.filter(
    a =>
      force ||
      assetMeta(P.img, a.id)?.hash !== specHash(a) ||
      !fs.existsSync(path.join(P.img, `${a.id}.${a.cutout ? 'png' : 'jpg'}`)),
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
    if (a.cutout) {
      // Keyed to transparency so the layer can stand in depth over the others.
      const raw = path.join(P.img, `${a.id}.green.jpg`);
      fs.writeFileSync(raw, r.data);
      await keyOut(raw, path.join(P.img, `${a.id}.png`));
      fs.rmSync(path.join(P.img, `${a.id}.jpg`), { force: true });
    } else fs.writeFileSync(path.join(P.img, `${a.id}.jpg`), r.data);
    writeJSON(path.join(P.img, `${a.id}.json`), {
      hash: specHash(a),
      model: a.model ?? 'gemini-3.1-flash-image',
      prompt,
      note: r.text,
      createdAt: new Date().toISOString(),
    });
    log.ok(`${a.id} → assets/img/${a.id}.${a.cutout ? 'png (keyed)' : 'jpg'}`);
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
  for (const { spec } of todo) clipProvider(spec.model);
  // Refuse to pay for footage that cannot cover its beats without looping or repeating.
  const making = new Set(todo.map(({ a }) => a.id));
  const asked = id => sb.assets.find(a => a.id === id).seconds ?? 4;
  const short = footageProblems(footageUses(sb, computeTiming(root), P).filter(u => making.has(u.source)).map(u => ({ ...u, have: asked(u.source) }))).errors;
  if (short.length) throw new Error(`Not generating: ${short.join(' ')}`);
  const estimate = todo.reduce((n, { spec }) => n + clipProvider(spec.model).estimateCost(spec), 0);
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
      } else if (clipProvider(spec.model) === runway)
        // Two references are the opening and closing keyframes; one is the opening frame.
        result = await runway.generateVideo(
          { ...spec, images: spec.refs.slice(0, 2) },
          { out: stage, onPoll: () => process.stdout.write('.') },
        );
      else
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
        interactionId: result?.interactionId ?? result?.taskId,
        usage: result?.usage,
        createdAt: new Date().toISOString(),
      });
      log.ok(`${a.id} → assets/clips/${a.id}.mp4 (${seconds.toFixed(2)}s; clip audio is excluded from the film mix)`);
    } finally {
      fs.rmSync(stage, { force: true });
    }
  }
}

/** Where the film shows generated clips: one entry per beat that uses one (plate or video). */
function footageUses(sb, timing, P) {
  const uses = [];
  for (const b of timing.beats) {
    const src = sb.beats[b.index], ref = src.plate ?? (src.block === 'video' ? src.props : null);
    const a = ref?.asset != null ? sb.assets.find(x => x.id === ref.asset && x.kind === 'clip') : null;
    if (!a || a.file) continue;
    // A made take's measured length wins over the length that was asked for.
    const made = assetMeta(P.clips, a.id)?.seconds;
    uses.push({ beat: b.id, index: b.index, source: a.id, offset: ref.offset ?? 0, seconds: b.end - b.start, have: made ?? a.seconds ?? 4, generated: true });
  }
  return uses;
}

// ------------------------------------------------------------------ plan
/** What would we pay for, and what is already cached? */
export function plan(root) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const timing = computeTiming(root);
  const rows = [];
  // Continuous takes: a beat is recorded when its take's current spec matches what was made.
  const takeHash = new Map();
  for (const take of planTakes(sb)) {
    const h = hashOf(takeSpec(sb, take, sb.voice.provider));
    for (const b of take.beats) takeHash.set(b.id, h);
  }
  for (const b of sb.beats.filter(x => x.vo)) {
    const meta = readJSON(path.join(P.vo, `${b.id}.json`), null);
    const done =
      ((meta?.provider === 'gemini' &&
        (meta.take ? meta.take.hash === takeHash.get(b.id) : meta.hash === hashOf(voiceSpec(sb, b, 'gemini')))) ||
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
        assetMeta(P.img, a.id)?.hash === imageHash(sb, a) &&
        nonempty(path.join(P.img, `${a.id}.${a.cutout ? 'png' : 'jpg'}`));
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
        cost: done ? 0 : clipProvider(spec.model).estimateCost(spec),
        status: done ? 'cached' : 'todo',
      });
    }
  }
  const clipSecs = sb.assets.filter(a => a.kind === 'clip').reduce((s, a) => s + (a.seconds ?? 4), 0);
  const footage = footageProblems(footageUses(sb, timing, P));
  return {
    footage,
    rows,
    total: rows.reduce((s, r) => s + r.cost, 0),
    duration: timing.duration,
    clipShare: clipSecs / timing.duration,
  };
}
