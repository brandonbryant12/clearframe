// Shared paths and media helpers for the viewer: probing, stills, waveforms.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const ROOT = path.resolve(new URL('../../..', import.meta.url).pathname);
export const UI = path.join(ROOT, 'engine/ui/viewer');
export const FONT_DIR = path.join(ROOT, 'film/assets/fonts');
export const readJSON = (f, fallback = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
export const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
export const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
export const rel = (from, file) => path.relative(from, file).split(path.sep).join('/');
export const fileHash = f => { const s = fs.statSync(f); return hash(`${f}:${s.size}:${s.mtimeMs}`); };

export function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || null;
}
export function frameSize(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [width, height] = r.stdout.trim().split(',').map(Number);
  return width && height ? { width, height } : null;
}
/** One still from a video at `at` seconds, cached under `key`. */
export function frameAt(file, media, key, at, width = 640) {
  const out = path.join(media, `${key}.jpg`);
  if (!fs.existsSync(out))
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, at)), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '4', out]);
  return fs.existsSync(out) ? out : null;
}
export function waveform(file, media) {
  const out = path.join(media, `wave-${fileHash(file)}.png`);
  if (!fs.existsSync(out))
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=1200x140:colors=0x4fc1b0', '-frames:v', '1', out]);
  return fs.existsSync(out) ? out : null;
}

