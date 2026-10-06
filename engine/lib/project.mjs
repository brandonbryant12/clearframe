// Loading and validating a ClearFrame project folder.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON } from './util.mjs';
import { measuredRate } from './voice-rates.mjs';
import { expandAssets, alphaBounds } from './plates.mjs';
import { useProject } from '../../film/library.mjs';

export const PRESETS = {
  landscape: { width: 1920, height: 1080, fps: 30 },
  vertical: { width: 1080, height: 1920, fps: 30 },
  square: { width: 1080, height: 1080, fps: 30 },
  portrait: { width: 1080, height: 1350, fps: 30 },
};

export const DEFAULTS = {
  voice: { provider: 'gemini', model: 'gemini-3.8-flash-tts', voice: 'Charon', style: '', wpm: 150, takes: 'film' },
  pacing: { lead: 0.25, tail: 0.6, minBeat: 1.6, silentBeat: 2.5 },
  music: { provider: 'lyria', model: 'lyria-3.5', volume: 0.22, duck: true, fadeIn: 1.5, fadeOut: 2.5 },
  mix: { loudness: -14, voiceGain: 1.0 },
};

export function resolveProject(dir) {
  const root = path.resolve(dir ?? '.');
  const file = path.join(root, 'storyboard.json');
  if (!fs.existsSync(file))
    throw new Error(`No storyboard.json in ${root}. Create a project with: clearframe new <dir>`);
  return root;
}

export function loadStoryboard(root, given) {
  // The project's own library/ (palettes, treatments, sketches, playbooks) overrides the built-ins.
  useProject(root);
  // `given`: a candidate storyboard (the studio validates an edit before writing it).
  const sb = given ? structuredClone(given) : readJSON(path.join(root, 'storyboard.json'));
  const errors = validateStoryboard(sb);
  if (errors.length) throw new Error(`storyboard.json is invalid:\n  - ${errors.join('\n  - ')}`);
  const preset = PRESETS[sb.format?.preset] ?? PRESETS.landscape;
  return {
    ...sb,
    format: { ...preset, ...sb.format },
    // Drafts use this voice's measured reading speed unless the storyboard sets one.
    voice: {
      ...DEFAULTS.voice,
      ...sb.voice,
      wpm: sb.voice?.wpm ?? measuredRate({ ...DEFAULTS.voice, ...sb.voice }) ?? DEFAULTS.voice.wpm,
    },
    pacing: { ...DEFAULTS.pacing, ...sb.pacing },
    music: sb.music === false ? false : { ...DEFAULTS.music, ...sb.music },
    mix: { ...DEFAULTS.mix, ...sb.mix },
    // Layered image assets become their far, mid and near plates; a keyed cut-out carries
    // where its subject sits, so the plate can ground it.
    assets: expandAssets(sb.assets ?? []).map(a => {
      const png = path.join(root, 'assets', 'img', `${a.id}.png`);
      return a.cutout && fs.existsSync(png) ? { ...a, bounds: alphaBounds(png) } : a;
    }),
    sources: sb.sources ?? [],
  };
}

export function validateStoryboard(sb) {
  const errors = [];
  if (!sb || typeof sb !== 'object') return ['storyboard must be a JSON object'];
  if (!Array.isArray(sb.beats) || sb.beats.length === 0) errors.push('`beats` must be a non-empty array');
  if (sb.budget != null && (!Number.isFinite(sb.budget) || sb.budget < 0)) errors.push('budget must be nonnegative');
  if (sb.format?.preset && !PRESETS[sb.format.preset]) errors.push('Unknown format preset');
  if (
    sb.continuity?.maxGeneratedShare != null &&
    (!Number.isFinite(sb.continuity.maxGeneratedShare) ||
      sb.continuity.maxGeneratedShare < 0 ||
      sb.continuity.maxGeneratedShare > 1)
  )
    errors.push('maxGeneratedShare must be 0–1');
  for (const k of ['lead', 'tail', 'minBeat', 'silentBeat', 'outro'])
    if (sb.pacing?.[k] != null && (!Number.isFinite(sb.pacing[k]) || sb.pacing[k] < 0))
      errors.push(`pacing.${k} must be nonnegative`);
  if (sb.pacing?.continuous != null && typeof sb.pacing.continuous !== 'boolean')
    errors.push('pacing.continuous must be true or false');
  if (sb.voice?.takes != null && !['beat', 'chapter', 'film'].includes(sb.voice.takes))
    errors.push('voice.takes must be film (one continuous take, the default), chapter or beat');
  if (sb.voice?.cast != null) {
    if (typeof sb.voice.cast !== 'object' || Array.isArray(sb.voice.cast))
      errors.push('voice.cast must map speaker ids to {voice, style}');
    else
      for (const b of sb.beats ?? [])
        if (b.vo && !sb.voice.cast[b.speaker]) errors.push(`beats "${b.id}" needs a speaker from voice.cast`);
  }
  if (sb.speakers != null) {
    if (typeof sb.speakers !== 'object' || Array.isArray(sb.speakers))
      errors.push('speakers must map ids to {name, role, color}');
    else
      for (const [id, s] of Object.entries(sb.speakers)) {
        if (!s || typeof s.name !== 'string' || !s.name.trim() || s.name.length > 40)
          errors.push(`speakers.${id}.name must be text up to 40 characters`);
        if (s?.role != null && (typeof s.role !== 'string' || s.role.length > 40))
          errors.push(`speakers.${id}.role must be text up to 40 characters`);
        if (s?.color != null && !['accent', 'accent2', 'ink', 'positive', 'negative'].includes(s.color))
          errors.push(`speakers.${id}.color must be accent, accent2, ink, positive or negative`);
        if (s?.stem != null && typeof s.stem !== 'string') errors.push(`speakers.${id}.stem must be a file path`);
      }
  }
  const ids = new Set();
  for (const [i, b] of (sb.beats ?? []).entries()) {
    if (!b.id || !/^[a-z0-9][a-z0-9-_]*$/i.test(b.id))
      errors.push(`beats[${i}].id must be a slug (letters, digits, - or _)`);
    if (ids.has(b.id)) errors.push(`duplicate beat id "${b.id}"`);
    ids.add(b.id);
    if (b.vo != null && typeof b.vo !== 'string') errors.push(`beats[${i}].vo must be a string`);
    if (b.duration != null && (!Number.isFinite(b.duration) || !(b.duration > 0)))
      errors.push(`beats[${i}].duration must be > 0`);
    for (const k of ['lead', 'tail', 'hold', 'min'])
      if (b[k] != null && (!Number.isFinite(b[k]) || b[k] < 0)) errors.push(`beats[${i}].${k} must be nonnegative`);
    if (b.scene && b.block) errors.push(`beats[${i}] has both "scene" and "block" — use one`);
    if (b.block && !/^[a-z0-9-]+$/.test(b.block))
      errors.push(`beats[${i}].block must be a block name like "stat" (see: clearframe blocks)`);
    if (b.speaker != null && !sb.speakers?.[b.speaker])
      errors.push(`beats[${i}].speaker "${b.speaker}" is not in storyboard.speakers`);
  }
  const assetIds = new Set();
  for (const [i, a] of (sb.assets ?? []).entries()) {
    if (!a.id || !/^[a-z0-9][a-z0-9_-]*$/i.test(a.id)) errors.push(`assets[${i}].id must be a slug`);
    if (assetIds.has(a.id)) errors.push(`duplicate asset id "${a.id}"`);
    assetIds.add(a.id);
    if (!['image', 'clip', 'sfx'].includes(a.kind)) errors.push(`assets[${i}].kind must be image | clip | sfx`);
    if (a.kind !== 'sfx' && !a.file && !a.prompt) errors.push(`assets[${i}].prompt is required for kind "${a.kind}"`);
  }
  return errors;
}

export const paths = root => ({
  root,
  storyboard: path.join(root, 'storyboard.json'),
  build: path.join(root, 'build'),
  vo: path.join(root, 'assets', 'vo'),
  music: path.join(root, 'assets', 'music'),
  img: path.join(root, 'assets', 'img'),
  clips: path.join(root, 'assets', 'clips'),
  sfx: path.join(root, 'assets', 'sfx'),
});
