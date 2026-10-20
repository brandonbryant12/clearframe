// Shared paths and media helpers for the viewer: probing, stills, waveforms.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(
  fileURLToPath(new URL('../../..', import.meta.url)),
);
export const UI = path.join(ROOT, 'engine/ui/viewer');
export const FONT_DIR = path.join(ROOT, 'film/assets/fonts');
export const readJSON = (f: string, fallback: unknown = null): unknown => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return fallback;
  }
};
export function readSchema<S extends Schema.Top & { DecodingServices: never }>(
  file: string,
  schema: S,
  fallback: S['Type'],
): S['Type'] {
  try {
    return Schema.decodeUnknownSync(schema)(
      JSON.parse(fs.readFileSync(file, 'utf8')),
    );
  } catch {
    return fallback;
  }
}
export const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item';
/**
 * A film's id: its folder path as a slug. A folder name with a stray leading or trailing dash
 * ("…-for-the-", from an older project namer) would share the id of the same name without it,
 * so it carries a short hash of its path; every other film keeps its plain id.
 */
export const filmId = (dir: string) => {
  const rel = path.relative(process.cwd(), dir),
    id = slug(rel);
  return /^-|-$/.test(path.basename(rel))
    ? `${id}-${crypto.createHash('sha1').update(rel).digest('hex').slice(0, 6)}`
    : id;
};
export const hash = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
export const rel = (from: string, file: string) =>
  path.relative(from, file).split(path.sep).join('/');
export const fileHash = (f: string) => {
  const s = fs.statSync(f);
  return hash(`${f}:${s.size}:${s.mtimeMs}`);
};

export function duration(file: string) {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file],
    { encoding: 'utf8' },
  );
  return Number((r.stdout ?? '').trim()) || null;
}
export function frameSize(file: string) {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
      '-of',
      'csv=p=0',
      file,
    ],
    { encoding: 'utf8' },
  );
  const [width, height] = (r.stdout ?? '').trim().split(',').map(Number);
  return width && height ? { width, height } : null;
}
/** One still from a video at `at` seconds, cached under `key`. */
export function frameAt(
  file: string,
  media: string,
  key: string,
  at: number,
  width = 640,
) {
  const out = path.join(media, `${key}.jpg`);
  if (!fs.existsSync(out))
    spawnSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-ss',
      String(Math.max(0, at)),
      '-i',
      file,
      '-frames:v',
      '1',
      '-vf',
      `scale=${width}:-2`,
      '-q:v',
      '4',
      out,
    ]);
  return fs.existsSync(out) ? out : null;
}
export function waveform(file: string, media: string) {
  const out = path.join(media, `wave-${fileHash(file)}.png`);
  if (!fs.existsSync(out))
    spawnSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-i',
      file,
      '-filter_complex',
      'aformat=channel_layouts=mono,showwavespic=s=1200x140:colors=0x4fc1b0',
      '-frames:v',
      '1',
      out,
    ]);
  return fs.existsSync(out) ? out : null;
}
