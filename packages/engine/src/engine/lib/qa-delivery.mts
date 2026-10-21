import * as Schema from 'effect/Schema';
import type {
  Probe,
  ProbeStream,
  Loudness,
  QaFinding,
} from './qa-contracts.mjs';
import fs from 'node:fs';

import { spawn, spawnSync } from 'node:child_process';

import { ffmpegBin } from './util.mjs';

import { r2 } from './qa-pixels.mjs';
/**
 * Whether an MP4's index (moov) comes before its media (mdat): a player can start and seek
 * before the whole file has arrived. Reads only the top-level box headers. null if neither is found.
 */
export function moovFirst(file: string): boolean | null {
  const fd = fs.openSync(file, 'r'),
    head = Buffer.alloc(16),
    size = fs.fstatSync(fd).size;
  try {
    for (let at = 0, boxes = 0; at + 8 <= size && boxes < 64; boxes++) {
      fs.readSync(fd, head, 0, 16, at);
      let len = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (type === 'moov') return true;
      if (type === 'mdat') return false;
      if (len === 1) len = Number(head.readBigUInt64BE(8));
      else if (len === 0) return null;
      if (len < 8) return null;
      at += len;
    }
    return null;
  } finally {
    fs.closeSync(fd);
  }
}

/** Container and loudness facts a platform reads before it shows a single frame. */
export function deliveryFindings(
  probe: Probe,
  {
    loudness,
    target = -14,
    fps,
    frames,
    width,
    height,
    moovFirst: indexed,
  }: {
    loudness?: Loudness | null;
    target?: number;
    fps: number;
    frames?: number;
    width: number;
    height: number;
    moovFirst?: boolean | null;
  },
): QaFinding[] {
  const v = probe.streams.find((s) => s.codec_type === 'video'),
    a = probe.streams.find((s) => s.codec_type === 'audio');
  const out: QaFinding[] = [];
  const bad = (level: QaFinding['level'], message: string) =>
    out.push({ level, kind: 'delivery', message });
  if (!v)
    return [{ level: 'error', kind: 'delivery', message: 'no video stream' }];
  if (v.width !== width || v.height !== height)
    bad('error', `size ${v.width}×${v.height}, storyboard ${width}×${height}`);
  const [n, dd] = String(v.avg_frame_rate ?? '0/1')
    .split('/')
    .map(Number);
  if (Math.abs(n / dd - fps) > 0.001)
    bad('error', `frame rate ${r2(n / dd)}, storyboard ${fps}`);
  if (frames && Number(v.nb_frames) && Number(v.nb_frames) !== frames)
    bad('error', `${v.nb_frames} frames, storyboard ${frames}`);
  colorFindings(v, bad);
  if (a) audioFindings(v, a, fps, loudness, target, bad);
  if (indexed === false)
    bad(
      'warn',
      'the MP4 index (moov) sits after the media: streaming playback can start and seek late, or needs extra range requests to find it (remux with -movflags +faststart)',
    );
  return out;
}

export function probeStreams(file: string): Probe {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_streams', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(r.stderr || 'ffprobe failed');
  return Schema.decodeUnknownSync(ProbeSchema)(JSON.parse(r.stdout));
}

/** Integrated loudness and true peak; runs beside the picture decode (qaProject starts it first). */
export function measureLoudness(file: string): Promise<Loudness | null> {
  return new Promise((resolve) => {
    const child = spawn(ffmpegBin(), [
      '-hide_banner',
      '-nostats',
      '-threads',
      '2',
      '-filter_threads',
      '2',
      '-i',
      file,
      '-map',
      '0:a:0',
      '-af',
      'ebur128=peak=true',
      '-threads',
      '2',
      '-f',
      'null',
      '-',
    ]);
    let err = '';
    child.stderr.on('data', (d) => (err = (err + d).slice(-20000)));
    child.on('error', () => resolve(null));
    // A meter that failed part-way may still have printed numbers: only a clean exit measures.
    child.on('close', (code) => resolve(code === 0 ? loudnessOf(err) : null));
  });
}
function loudnessOf(stderr: string): Loudness | null {
  const r = { stderr };
  const tail = r.stderr.slice(r.stderr.lastIndexOf('Summary:'));
  const i = tail.match(/I:\s+(-?[\d.]+) LUFS/),
    p = tail.match(/Peak:\s+(-?[\d.]+) dBFS/);
  return i ? { integrated: Number(i[1]), peak: p ? Number(p[1]) : null } : null;
}

const ProbeSchema: Schema.Codec<Probe> = Schema.Struct({
  streams: Schema.Array(
    Schema.Struct({
      codec_type: Schema.optionalKey(Schema.String),
      width: Schema.optionalKey(Schema.Number),
      height: Schema.optionalKey(Schema.Number),
      avg_frame_rate: Schema.optionalKey(Schema.String),
      nb_frames: Schema.optionalKey(Schema.String),
      sample_aspect_ratio: Schema.optionalKey(Schema.String),
      pix_fmt: Schema.optionalKey(Schema.String),
      color_range: Schema.optionalKey(Schema.String),
      color_primaries: Schema.optionalKey(Schema.String),
      color_transfer: Schema.optionalKey(Schema.String),
      color_space: Schema.optionalKey(Schema.String),
      duration: Schema.optionalKey(Schema.String),
    }),
  ),
});

type AddDelivery = (level: QaFinding['level'], message: string) => void;
function audioFindings(
  v: ProbeStream,
  a: ProbeStream,
  fps: number,
  loudness: Loudness | null | undefined,
  target: number,
  bad: AddDelivery,
): void {
  const vd = Number(v.duration),
    ad = Number(a.duration);
  if (Number.isFinite(vd) && Number.isFinite(ad) && ad + 1 / fps < vd)
    bad('warn', `audio ends ${r2(vd - ad)} s before the picture`);
  if (loudness) {
    if (Math.abs(loudness.integrated - target) > 1)
      bad('warn', `loudness ${loudness.integrated} LUFS, target ${target}`);
    if (loudness.peak == null)
      bad(
        'warn',
        'true peak not reported by the meter: the ceiling is unchecked',
      );
    else if (loudness.peak > -1)
      bad('warn', `true peak ${loudness.peak} dBTP; keep it under −1`);
  } else if (loudness === null)
    // A meter that returned nothing is a missing measurement, not a pass.
    bad(
      'error',
      'the film has sound, but its loudness and true peak could not be measured (and the music drop was not checked)',
    );
}

function colorFindings(v: ProbeStream, bad: AddDelivery): void {
  if (
    v.sample_aspect_ratio &&
    !['1:1', '0:1', 'N/A'].includes(v.sample_aspect_ratio)
  )
    bad(
      'error',
      `pixel aspect ratio ${v.sample_aspect_ratio}: players that respect it stretch the film (setsar=1)`,
    );
  if (v.pix_fmt !== 'yuv420p')
    bad('warn', `pixel format ${v.pix_fmt}; social players expect yuv420p`);
  if (v.color_range && v.color_range !== 'tv')
    bad('warn', `colour range ${v.color_range}; deliver TV range`);
  for (const k of ['color_primaries', 'color_transfer', 'color_space'] as const)
    if (!v[k] || v[k] === 'unknown')
      bad(
        'warn',
        `${k.replace('_', ' ')} untagged: players guess, and guesses differ`,
      );
}
