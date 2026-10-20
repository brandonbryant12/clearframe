import type { BarCase } from './library-bar-contracts.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { ffmpeg, ffmpegBin } from './util.mjs';
import { sha256, sha256File, writeJSONAtomic } from './store.mjs';
import { REPO } from '../../scene/engine.mjs';

const inside = (root: string, rel: string): string => {
  const file = path.resolve(root, rel);
  if (!file.startsWith(path.resolve(root) + path.sep))
    throw new Error(`Fixture file must stay inside its project: ${rel}`);
  return file;
};

/** RGB byte comparison: a pixel changes when any channel differs by more than tolerance. */
export function comparePixels(a: Uint8Array, b: Uint8Array, tolerance = 3) {
  if (!a.length || a.length !== b.length || a.length % 3)
    throw new Error('Pixel comparisons need equally sized RGB images');
  let changed = 0,
    squared = 0;
  for (let i = 0; i < a.length; i += 3) {
    let different = false;
    for (let c = 0; c < 3; c++) {
      const d = a[i + c] - b[i + c];
      squared += d * d;
      different ||= Math.abs(d) > tolerance;
    }
    if (different) changed++;
  }
  return {
    changedPixels: changed,
    pixels: a.length / 3,
    changedFraction: changed / (a.length / 3),
    psnr: squared ? 10 * Math.log10(255 ** 2 / (squared / a.length)) : Infinity,
  };
}

export function rgb(file: string): Buffer {
  const result = spawnSync(
    ffmpegBin(),
    [
      '-v',
      'error',
      '-threads',
      '2',
      '-i',
      file,
      '-frames:v',
      '1',
      '-threads',
      '2',
      '-f',
      'rawvideo',
      '-pix_fmt',
      'rgb24',
      '-',
    ],
    { maxBuffer: 64 * 2 ** 20 },
  );
  if (result.status !== 0)
    throw new Error(
      `Could not decode ${file}: ${result.error?.message ?? result.stderr?.toString()}`,
    );
  return result.stdout;
}

export function project(entry: BarCase, dir: string, base: string): void {
  const storyboard: unknown =
    typeof entry.storyboard === 'string'
      ? JSON.parse(
          fs.readFileSync(path.resolve(base, entry.storyboard), 'utf8'),
        )
      : structuredClone(entry.storyboard);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, source] of Object.entries(entry.files ?? {})) {
    if (rel === 'storyboard.json' || /^(build|review)(\/|$)/.test(rel))
      throw new Error(`${entry.id}: files may only supply source inputs`);
    const dest = inside(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.resolve(base, source), dest);
  }
  writeJSONAtomic(path.join(dir, 'storyboard.json'), storyboard);
}

export const listPngs = (dir: string): string[] =>
  fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.png'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => path.join(dir, f));

export const relative = (out: string, file: string): string =>
  path.relative(out, file).split(path.sep).join('/');

export function implementation() {
  const files: string[] = [];
  const walk = (dir: string, recursive: boolean): void => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory() && recursive) walk(file, true);
      else if (e.isFile() && /\.(mts|mjs|ts|js|json)$/.test(e.name))
        files.push(file);
    }
  };
  walk(path.join(REPO, 'film'), true);
  walk(path.join(REPO, 'engine/lib'), true);
  walk(path.join(REPO, 'library'), true);
  const hashes = Object.fromEntries(
    files.sort().map((f) => [relative(REPO, f), sha256File(f)]),
  );
  return { hashes, sha256: sha256(JSON.stringify(hashes)) };
}

export async function phoneSheet(files: string[], dir: string) {
  const tiles = path.join(dir, 'phone-tiles');
  fs.mkdirSync(tiles);
  for (const [i, file] of files.entries())
    fs.copyFileSync(
      file,
      path.join(tiles, `tile-${String(i).padStart(3, '0')}.png`),
    );
  const columns = Math.min(3, files.length),
    output = path.join(dir, 'phone.png');
  await ffmpeg([
    '-y',
    '-framerate',
    '1',
    '-i',
    path.join(tiles, 'tile-%03d.png'),
    '-vf',
    `scale=360:-2,tile=${columns}x${Math.ceil(files.length / columns)}:padding=8:margin=8:color=0x161b22`,
    '-frames:v',
    '1',
    '-threads',
    '2',
    output,
  ]);
  fs.rmSync(tiles, { recursive: true, force: true });
  return output;
}
