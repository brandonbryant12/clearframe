// Loading and validating a ClearFrame project folder.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON } from './util.mjs';

export const PRESETS = {
  landscape: { width: 1920, height: 1080, fps: 30 },
  vertical: { width: 1080, height: 1920, fps: 30 },
  square: { width: 1080, height: 1080, fps: 30 },
  portrait: { width: 1080, height: 1350, fps: 30 },
};

export const DEFAULTS = {
  voice: { provider: 'gemini', model: 'gemini-3.8-flash-tts', voice: 'Charon', style: '', wpm: 150 },
  pacing: { lead: 0.25, tail: 0.6, minBeat: 1.6, silentBeat: 2.5 },
  music: { provider: 'lyria', model: 'lyria-3.5', volume: 0.22, duck: true, fadeIn: 1.5, fadeOut: 2.5 },
  mix: { loudness: -14, voiceGain: 1.0 },
};

export function resolveProject(dir) {
  const root = path.resolve(dir ?? '.');
  const file = path.join(root, 'storyboard.json');
  if (!fs.existsSync(file)) throw new Error(`No storyboard.json in ${root}. Create a project with: clearframe new <dir>`);
  return root;
}

export function loadStoryboard(root) {
  const sb = readJSON(path.join(root, 'storyboard.json'));
  const errors = validateStoryboard(sb);
  if (errors.length) throw new Error(`storyboard.json is invalid:\n  - ${errors.join('\n  - ')}`);
  const preset = PRESETS[sb.format?.preset] ?? PRESETS.landscape;
  return {
    ...sb,
    format: { ...preset, ...sb.format },
    voice: { ...DEFAULTS.voice, ...sb.voice },
    pacing: { ...DEFAULTS.pacing, ...sb.pacing },
    music: sb.music === false ? false : { ...DEFAULTS.music, ...sb.music },
    mix: { ...DEFAULTS.mix, ...sb.mix },
    assets: sb.assets ?? [],
    sources: sb.sources ?? [],
  };
}

export function validateStoryboard(sb) {
  const errors = [];
  if (!sb || typeof sb !== 'object') return ['storyboard must be a JSON object'];
  if (!Array.isArray(sb.beats) || sb.beats.length === 0) errors.push('`beats` must be a non-empty array');
  const ids = new Set();
  for (const [i, b] of (sb.beats ?? []).entries()) {
    if (!b.id || !/^[a-z0-9][a-z0-9-_]*$/i.test(b.id)) errors.push(`beats[${i}].id must be a slug (letters, digits, - or _)`);
    if (ids.has(b.id)) errors.push(`duplicate beat id "${b.id}"`);
    ids.add(b.id);
    if (b.vo != null && typeof b.vo !== 'string') errors.push(`beats[${i}].vo must be a string`);
    if (b.duration != null && !(b.duration > 0)) errors.push(`beats[${i}].duration must be > 0`);
    if (b.scene && b.block) errors.push(`beats[${i}] has both "scene" and "block" — use one`);
    if (b.block && !/^[a-z0-9-]+$/.test(b.block)) errors.push(`beats[${i}].block must be a block name like "stat" (see: clearframe blocks)`);
  }
  const assetIds = new Set();
  for (const [i, a] of (sb.assets ?? []).entries()) {
    if (!a.id) errors.push(`assets[${i}].id is required`);
    if (assetIds.has(a.id)) errors.push(`duplicate asset id "${a.id}"`);
    assetIds.add(a.id);
    if (!['image', 'clip', 'sfx'].includes(a.kind)) errors.push(`assets[${i}].kind must be image | clip | sfx`);
    if (a.kind !== 'sfx' && !a.prompt) errors.push(`assets[${i}].prompt is required for kind "${a.kind}"`);
  }
  return errors;
}

export const paths = (root) => ({
  root,
  storyboard: path.join(root, 'storyboard.json'),
  build: path.join(root, 'build'),
  vo: path.join(root, 'assets', 'vo'),
  music: path.join(root, 'assets', 'music'),
  img: path.join(root, 'assets', 'img'),
  clips: path.join(root, 'assets', 'clips'),
  sfx: path.join(root, 'assets', 'sfx'),
});
