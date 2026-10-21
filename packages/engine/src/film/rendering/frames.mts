// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.

// Encoded outputs: the film, single stills, contact sheets and palette lookbooks.
import path from 'node:path';

import { ffmpeg } from '../../engine/lib/util.mjs';

/** PSNR (dB) between two images of the same size. */
export async function psnr(x: string, y: string): Promise<number | null> {
  const log = await ffmpeg([
    '-i',
    x,
    '-i',
    y,
    '-lavfi',
    '[0][1]psnr',
    '-f',
    'null',
    '-',
  ]);
  const m = /average:(inf|[\d.]+)/.exec(log);
  if (!m) return null;
  return m[1] === 'inf' ? Infinity : Number(m[1]);
}

/** Decode frames (by index) of a video to PNGs: [file…]. */
export async function decodeFrames(
  video: string,
  frames: number[],
  dir: string,
): Promise<string[]> {
  const out = [];
  for (const n of frames) {
    const file = path.join(dir, `decoded-${n}.png`);
    await ffmpeg([
      '-y',
      '-i',
      video,
      '-vf',
      `select=eq(n\\,${n})`,
      '-fps_mode',
      'passthrough',
      '-frames:v',
      '1',
      file,
    ]);
    out.push(file);
  }
  return out;
}
