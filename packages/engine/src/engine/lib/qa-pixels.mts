import type { DecodedFrames } from './qa-contracts.mjs';

import { spawnSync } from 'node:child_process';

import { ffmpegBin } from './util.mjs';

// Analysis grid: the long side at 128 px is enough to see a pop or a jump, and small enough
// to hold a few minutes of film in memory.
const LONG = 128;
// Mean absolute grey difference (0–255) over one second. The viral references we measured
// never drop under 3 for even 2.5 s (medians 8–42); a held slide sits under 1.
export const HELD = { change: 2, seconds: 2.5, local: 7 };

/** How much the whole picture changed between two frames. */
export function pictureDifference(a: Uint8Array, b: Uint8Array): number {
  return diff(a, b);
}

export function grid(width: number, height: number): [number, number] {
  const k = LONG / Math.max(width, height);
  const even = (n: number) => Math.max(2, Math.round((n * k) / 2) * 2);
  return [even(width), even(height)];
}

/** Decoded grey frames of a video at the analysis grid. */
export function decode(file: string, w: number, h: number): DecodedFrames {
  const r = spawnSync(
    ffmpegBin(),
    [
      // Two decoder threads: this machine runs at most two workers (AGENTS.md).
      '-v',
      'error',
      '-threads',
      '2',
      '-filter_threads',
      '2',
      '-i',
      file,
      '-an',
      '-vf',
      `scale=${w}:${h}:flags=area,format=gray`,
      '-threads',
      '2',
      '-f',
      'rawvideo',
      '-',
    ],
    { maxBuffer: 2 ** 31 - 1 },
  );
  if (r.status !== 0)
    throw new Error(`ffmpeg could not decode ${file}: ${r.stderr}`);
  const n = w * h;
  return {
    frames: Math.floor(r.stdout.length / n),
    at: (i: number) => r.stdout.subarray(i * n, (i + 1) * n),
    size: n,
  };
}

/**
 * The largest change in any 16×16 cell of the analysis grid (about 240 px at 1080p), above a
 * band at the bottom (burned captions change with every phrase and are not the picture). A coin
 * dropping, a value typed or a menu opening is small next to the whole frame but plain in its
 * cell; the frame average alone called such a picture held.
 */
export function localDifference(
  a: Uint8Array,
  b: Uint8Array,
  width: number,
  height: number,
  skipBottom = 0,
): number {
  const T = 16,
    rows = height - skipBottom;
  let best = 0;
  for (let ty = 0; ty < rows; ty += T)
    for (let tx = 0; tx < width; tx += T) {
      let sum = 0,
        n = 0;
      for (let y = ty; y < Math.min(rows, ty + T); y++)
        for (let x = tx; x < Math.min(width, tx + T); x++) {
          sum += Math.abs(a[y * width + x] - b[y * width + x]);
          n++;
        }
      if (n && sum / n > best) best = sum / n;
    }
  return best;
}

/**
 * Where the picture sits in one decoded frame: the bounding box of 4×4-pixel cells that differ
 * from the background (the median of the frame's top and side edges), above a band at the bottom
 * for the source line and captions. Shares of the frame's width and height, and the box's centre.
 * A lone line of small type (a source, a footnote) does not fill a cell, so it does not count.
 */
export function pictureExtent(
  frame: Uint8Array,
  width: number,
  height: number,
  skipBottom = 0,
) {
  const edge: number[] = [];
  for (let x = 0; x < width; x++) edge.push(frame[x]);
  for (let y = 0; y < height - skipBottom; y++)
    edge.push(frame[y * width], frame[y * width + width - 1]);
  const bg = median(edge),
    C = 4,
    rows = height - skipBottom;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let ty = 0; ty < rows; ty += C)
    for (let tx = 0; tx < width; tx += C) {
      const on = cellPixels(frame, width, rows, tx, ty, C, bg);
      if (on >= 5) {
        x0 = Math.min(x0, tx);
        y0 = Math.min(y0, ty);
        x1 = Math.max(x1, Math.min(width, tx + C));
        y1 = Math.max(y1, Math.min(rows, ty + C));
      }
    }
  if (x1 < 0) return { w: 0, h: 0, cx: 0.5, cy: 0.5 };
  return {
    w: (x1 - x0) / width,
    h: (y1 - y0) / rows,
    cx: (x0 + x1) / 2 / width,
    cy: (y0 + y1) / 2 / rows,
  };
}

export const diff = (a: Uint8Array, b: Uint8Array): number => {
  let s = 0;
  for (let k = 0; k < a.length; k++) s += Math.abs(a[k] - b[k]);
  return s / a.length;
};
export const median = (xs: readonly number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[s.length >> 1] : 0;
};
export const r2 = (n: number): number => Math.round(n * 100) / 100;

function cellPixels(
  frame: Uint8Array,
  width: number,
  rows: number,
  tx: number,
  ty: number,
  cell: number,
  bg: number,
): number {
  let on = 0;
  for (let y = ty; y < Math.min(rows, ty + cell); y++)
    for (let x = tx; x < Math.min(width, tx + cell); x++)
      if (Math.abs(frame[y * width + x] - bg) > 16) on++;
  return on;
}
