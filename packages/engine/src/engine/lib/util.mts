// Shared helpers for the ClearFrame engine (Node side).
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';
import { NodeProcessRunnerLive, runCommand } from './process.mjs';
import { errorMessage } from './errors.mjs';
import { runCommandEffect } from './command-scope.mjs';

export const ENGINE_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
export const REPO_DIR = path.resolve(ENGINE_DIR, '..');
export const require = createRequire(import.meta.url);

const c = (n: number) => (s: unknown) =>
  process.stdout.isTTY ? `\x1b[${n}m${String(s)}\x1b[0m` : String(s);
export const color = {
  dim: c(2),
  bold: c(1),
  red: c(31),
  green: c(32),
  yellow: c(33),
  cyan: c(36),
};

const progress = (message: string) =>
  (process.env.CLEARFRAME_PROGRESS_STDERR === '1'
    ? console.error
    : console.log)(message);
export const log = {
  step: (msg: string) => progress(`${color.cyan('›')} ${msg}`),
  ok: (msg: string) => progress(`${color.green('✓')} ${msg}`),
  warn: (msg: string) => progress(`${color.yellow('!')} ${msg}`),
  err: (msg: string) => console.error(`${color.red('✗')} ${msg}`),
  dim: (msg: string) => progress(color.dim(msg)),
};

let ffmpegPath: string | undefined;
/** Resolve ffmpeg: $FFMPEG_PATH → system ffmpeg → optional ffmpeg-static. */
export function ffmpegBin() {
  if (ffmpegPath) return ffmpegPath;
  const candidates = [process.env.FFMPEG_PATH, 'ffmpeg'];
  try {
    const optionalBinary: unknown = require('ffmpeg-static');
    if (typeof optionalBinary === 'string') candidates.push(optionalBinary);
  } catch {}
  for (const bin of candidates.filter((item): item is string =>
    Boolean(item),
  )) {
    const r = spawnSync(bin, ['-version'], { stdio: 'ignore' });
    if (r.status === 0) return (ffmpegPath = bin);
  }
  throw new Error(
    'ffmpeg not found. Install it (brew install ffmpeg / apt install ffmpeg) or `npm i ffmpeg-static`, or set FFMPEG_PATH.',
  );
}

/** Run ffmpeg, resolve with stderr text. Rejects with the tail of stderr on failure. */
export function ffmpegEffect(
  args: readonly string[],
  { quiet = true }: { quiet?: boolean } = {},
) {
  return Effect.flatMap(
    Effect.try(() => ffmpegBin()),
    (executable) =>
      runCommand({
        executable,
        args: [
          '-hide_banner',
          '-threads',
          '2',
          '-filter_threads',
          '2',
          '-filter_complex_threads',
          '2',
          ...(quiet ? ['-loglevel', 'info'] : []),
          ...args,
        ],
      }),
  ).pipe(Effect.map((result) => result.stderr));
}
/** Promise adapter for the existing production calls; Effect callers use ffmpegEffect. */
export function ffmpeg(
  args: readonly string[],
  options: { quiet?: boolean; signal?: AbortSignal } = {},
): Promise<string> {
  return runCommandEffect(
    ffmpegEffect(args, options).pipe(Effect.provide(NodeProcessRunnerLive)),
    options.signal,
  );
}

/** Duration of any media file in seconds (parsed from ffmpeg's probe output; no ffprobe needed). */
export async function mediaDuration(file: string) {
  if (/\.wav$/i.test(file)) {
    const d = wavDuration(file);
    if (d != null) return d;
  }
  const out = await ffmpeg(['-i', file, '-f', 'null', '-'], {
    quiet: false,
  }).catch((e) => e.message);
  const all = [...String(out).matchAll(/time=(\d+):(\d+):(\d+\.\d+)/g)];
  const m = all.at(-1) ?? String(out).match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
  if (!m) throw new Error(`Could not read duration of ${file}`);
  return +m[1] * 3600 + +m[2] * 60 + +m[3];
}

/** Read a PCM WAV header and return duration in seconds, or null if not a plain PCM wav. */
export function wavDuration(file: string) {
  const buf = fs.readFileSync(file);
  if (
    buf.toString('ascii', 0, 4) !== 'RIFF' ||
    buf.toString('ascii', 8, 12) !== 'WAVE'
  )
    return null;
  let off = 12,
    fmt: { channels: number; rate: number; bits: number } | null = null;
  while (off + 8 <= buf.length) {
    const id = buf.toString('ascii', off, off + 4);
    let size = buf.readUInt32LE(off + 4);
    if (id === 'fmt ')
      fmt = {
        channels: buf.readUInt16LE(off + 10),
        rate: buf.readUInt32LE(off + 12),
        bits: buf.readUInt16LE(off + 22),
      };
    if (id === 'data' && fmt) {
      if (size === 0 || size === 0xffffffff || off + 8 + size > buf.length)
        size = buf.length - off - 8; // streamed wavs
      return size / (fmt.rate * fmt.channels * (fmt.bits / 8));
    }
    off += 8 + size + (size % 2);
  }
  return null;
}

/** Wrap raw s16le PCM in a WAV header. */
export function pcmToWav(
  pcm: Uint8Array,
  { sampleRate = 24000, channels = 1, bits = 16 } = {},
) {
  const h = Buffer.alloc(44);
  const byteRate = sampleRate * channels * (bits / 8);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(sampleRate, 24);
  h.writeUInt32LE(byteRate, 28);
  h.writeUInt16LE(channels * (bits / 8), 32);
  h.writeUInt16LE(bits, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export function readJSON(file: string, fallback?: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined) return fallback;
    throw new Error(`Could not read ${file}: ${errorMessage(e)}`);
  }
}

export function readDecodedJSON<T>(
  file: string,
  schema: Schema.Codec<T>,
  fallback?: T,
): T {
  return Schema.decodeUnknownSync(schema)(readJSON(file, fallback));
}
export function writeJSON(file: string, data: unknown) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
}

export function hashOf(value: unknown) {
  // FNV-1a 32-bit, hex. Enough to detect changed prompts; not for security.
  let h = 0x811c9dc5;
  const s =
    typeof value === 'string' ? value : (JSON.stringify(value) ?? 'undefined');
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export const round = (n: number, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
export const snap = (t: number, fps: number) => Math.round(t * fps) / fps;
export const slug = (s: unknown) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'video';
