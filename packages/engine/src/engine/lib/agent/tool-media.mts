import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import * as Schema from 'effect/Schema';
import type { JobView } from '../harness/contracts.mjs';
import { fail } from './tool-common.mjs';
const revisionSchema = Schema.Struct({
  videos: Schema.optionalKey(
    Schema.Array(Schema.Struct({ object: Schema.optionalKey(Schema.String) })),
  ),
});
function webpSize(b: Buffer) {
  if (
    b.length >= 30 &&
    b.toString('ascii', 0, 4) === 'RIFF' &&
    b.toString('ascii', 8, 12) === 'WEBP'
  ) {
    const kind = b.toString('ascii', 12, 16);
    if (kind === 'VP8X')
      return {
        width: 1 + b.readUIntLE(24, 3),
        height: 1 + b.readUIntLE(27, 3),
      };
    if (kind === 'VP8 ')
      return {
        width: b.readUInt16LE(26) & 0x3fff,
        height: b.readUInt16LE(28) & 0x3fff,
      };
    if (kind === 'VP8L') {
      const v = b.readUInt32LE(21);
      return { width: 1 + (v & 0x3fff), height: 1 + ((v >> 14) & 0x3fff) };
    }
  }
  return null;
}
function jpegSize(b: Buffer) {
  if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const m = b[i + 1];
      if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m))
        return { width: b.readUInt16BE(i + 7), height: b.readUInt16BE(i + 5) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** A picture's pixel size from its header (PNG, JPEG, GIF, WebP), or null: the agent has no shell to ask. */
export function pictureSize(file: string) {
  let b;
  try {
    const fd = fs.openSync(file, 'r');
    try {
      b = Buffer.alloc(65536);
      b = b.subarray(0, fs.readSync(fd, b, 0, b.length, 0));
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    return null;
  }
  if (
    b.length >= 24 &&
    b.readUInt32BE(0) === 0x89504e47 &&
    b.toString('ascii', 12, 16) === 'IHDR'
  )
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 10 && b.toString('ascii', 0, 3) === 'GIF')
    return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  return webpSize(b) ?? jpegSize(b);
}
/**
 * A path inside the project by real path: no dot segments, and no symlink (of the file or any folder
 * on the way) leading outside the project. Lexical checks alone would follow a link out.
 */
export function inside(dir: string, rel: unknown) {
  if (
    typeof rel !== 'string' ||
    !rel ||
    rel.length > 400 ||
    path.isAbsolute(rel)
  )
    throw fail('Name a file inside the project, relative to it.');
  const root = fs.realpathSync(dir),
    file = path.resolve(root, rel);
  const lexical = path.relative(root, file);
  if (
    lexical.startsWith('..') ||
    lexical.split(path.sep).some((s) => s.startsWith('.'))
  )
    throw fail('That file is outside the project.');
  let real;
  try {
    real = fs.realpathSync(file);
  } catch {
    throw fail(`No file ${rel}.`);
  }
  if (!real.startsWith(root + path.sep))
    throw fail('That file links outside the project.', 403);
  return real;
}

// One ffmpeg at a time for agent looks, each call bounded: a look never ties up the machine.
let lookChain: Promise<unknown> = Promise.resolve();
const runBounded = (cmd: string, args: readonly string[]) => {
  const go = () =>
    new Promise<string>((resolve, reject) =>
      execFile(cmd, args, { timeout: 20000, maxBuffer: 1 << 20 }, (e, out) =>
        e ? reject(e) : resolve(String(out)),
      ),
    );
  const next = lookChain.then(go, go);
  lookChain = next.catch(() => {});
  return next;
};

async function renderSheet(
  file: string,
  out: string,
  times: number[],
  phone: boolean,
  tall: boolean,
) {
  const regularTile = tall ? 270 : 480;
  const tile = phone ? 360 : regularTile,
    cols = Math.min(4, times.length),
    rows = Math.ceil(times.length / cols);
  const tmp = fs.mkdtempSync(path.join(path.dirname(out), 'frames-'));
  try {
    for (const [i, t] of times.entries())
      await runBounded('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-threads',
        '1',
        '-ss',
        String(t),
        '-i',
        file,
        '-frames:v',
        '1',
        '-vf',
        `scale=${tile}:-2`,
        '-q:v',
        '4',
        path.join(tmp, `${String(i).padStart(2, '0')}.jpg`),
      ]);
    await runBounded('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-threads',
      '1',
      '-i',
      path.join(tmp, '%02d.jpg'),
      '-vf',
      `tile=${cols}x${rows}:padding=6:color=white`,
      '-frames:v',
      '1',
      '-q:v',
      '4',
      out,
    ]);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

/**
 * One bounded picture of a finished render, for an agent to look at: a still scaled down, or a
 * motion sheet of a video: n frames at the middle of n equal slices of [from, to] video seconds,
 * each taken by an accurate seek (the first frame at or after that time), tiled four across in
 * reading order. `phone` draws each frame 360 px wide, as a phone shows it. Returns the JPEG path
 * and the requested time of each tile. Cached beside the film's other agent previews.
 */
export async function lookImage(
  file: string,
  {
    dir,
    key,
    frames = 8,
    from = null,
    to = null,
    phone = false,
  }: {
    dir: string;
    key: string;
    frames?: number;
    from?: number | null;
    to?: number | null;
    phone?: boolean;
  },
) {
  const out = path.join(dir, 'build', 'look', `${key}.jpg`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  const probe = async (args: string[]) =>
    (
      await runBounded('ffprobe', [
        '-v',
        'error',
        ...args,
        '-of',
        'csv=p=0',
        file,
      ])
    ).trim();
  const [w, h] = (
    await probe([
      '-select_streams',
      'v:0',
      '-show_entries',
      'stream=width,height',
    ])
  )
    .split(',')
    .map(Number);
  const tall = h > w;
  if (/\.(png|jpe?g)$/i.test(file)) {
    const maxWidth = tall ? 720 : 1280;
    const width = phone ? 360 : Math.min(w, maxWidth);
    if (!fs.existsSync(out))
      await runBounded('ffmpeg', [
        '-v',
        'error',
        '-y',
        '-threads',
        '1',
        '-i',
        file,
        '-vf',
        `scale=${width}:-2`,
        '-q:v',
        '4',
        out,
      ]);
    return { out, times: null, tall, size: [w, h] };
  }
  const duration =
    Number(await probe(['-show_entries', 'format=duration'])) || 0;
  const n = Math.max(2, Math.min(12, Math.round(frames)));
  const a = Math.max(0, Math.min(from ?? 0, duration)),
    b = Math.max(a + 0.1, Math.min(to ?? duration, duration));
  const times = Array.from(
    { length: n },
    (_, i) =>
      +Math.min(
        a + ((i + 0.5) * (b - a)) / n,
        Math.max(0, duration - 0.05),
      ).toFixed(2),
  );
  if (!fs.existsSync(out)) await renderSheet(file, out, times, phone, tall);
  return { out, times, tall, size: [w, h] };
}

/**
 * The file a finished job made, and the timeline it was rendered from: the job's own output (a
 * still or section in the studio's store), or a rough cut's or final's saved revision video inside
 * the film. Nothing outside the studio store or the film is ever read.
 */
export function renderedFile(
  j: JobView,
  { base, dir }: { base: string; dir: string },
) {
  // The real file must lie under the real root: a symlink cannot carry a read outside it.
  const within = (f: string, root: string) => {
    try {
      const r = fs.realpathSync(root),
        real = fs.realpathSync(f);
      return real.startsWith(r + path.sep) ? real : null;
    } catch {
      return null;
    }
  };
  const out = j.output && (within(j.output, base) ?? within(j.output, dir));
  if (out) return { file: out, timeline: null };
  if (typeof j.revision === 'string' && /^r\d{3,}$/.test(j.revision)) {
    const revDir = path.join(dir, 'review', 'revisions', j.revision);
    try {
      const v = Schema.decodeUnknownSync(revisionSchema)(
        JSON.parse(fs.readFileSync(path.join(revDir, 'revision.json'), 'utf8')),
      ).videos?.at(-1);
      const f = v?.object && within(path.resolve(dir, v.object), dir);
      const timeline = within(path.join(revDir, 'timeline.json'), dir);
      if (f) return { file: f, timeline };
    } catch {}
  }
  return null;
}
