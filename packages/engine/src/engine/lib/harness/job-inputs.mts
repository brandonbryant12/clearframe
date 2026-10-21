import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, type ChildProcess } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as Schema from 'effect/Schema';
import { sceneCache } from '../../../scene/engine/paths.mjs';
import {
  errorCode,
  ProbeSchema,
  type HarnessJob,
  type JobKind,
  type MediaProbe,
} from './contracts.mjs';
export const sha = (s: string) =>
  crypto.createHash('sha256').update(s).digest('hex');
/**
 * Narration and music jobs start only with a grant made by the studio's sound gate (spend.mjs), never
 * from request fields: a paid one carries the budget a named person approved for exactly that content.
 */
export const hashOf = (dir: string) =>
  sha(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8'));
const LIBRARY = fileURLToPath(new URL('../../../library', import.meta.url));
// Folders a render writes into or never reads as input.
const SKIP = new Set(['build', 'review', 'node_modules']);
const MAX_INPUT_FILES = 20000;
// Failed spawns can retain an uninitialized native handle. Never signal it or PID 0.
export const signalChild = (
  child: ChildProcess | undefined,
  signal: NodeJS.Signals,
) => {
  if (child?.pid != null && Number.isSafeInteger(child.pid) && child.pid > 0)
    try {
      child.kill(signal);
    } catch {}
};

/**
 * Everything a preview reads, by file identity: the project's files outside build/ and review/
 * (storyboard, narration, recordings, pictures, clips, music, the project library), the built-in
 * and shared libraries, and the renderer's build stamp. Path, size, mtime, ctime and inode: an
 * atomic rewrite (an edit and its undo) changes it even when the content ends up the same. Stats
 * only, never content, so a large project stays cheap; past MAX_INPUT_FILES it is unknown (null)
 * and nothing is cached.
 */
export function inputPrint(dir: string) {
  const h = crypto.createHash('sha256');
  let n = 0;
  const stat = (label: string, f: string) => {
    const s = fs.statSync(f);
    h.update(`${label}\0${s.size}\0${s.mtimeMs}\0${s.ctimeMs}\0${s.ino}\n`);
  };
  const walk = (root: string, tag: string, d = root): void => {
    let entries;
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch (e) {
      if (errorCode(e) === 'ENOENT') return;
      throw e;
    }
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.name.startsWith('.') || (d === root && SKIP.has(e.name))) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(root, tag, f);
      else {
        if (++n > MAX_INPUT_FILES) throw new Error('too many input files');
        stat(`${tag}:${path.relative(root, f)}`, f);
      }
    }
  };
  try {
    walk(path.resolve(dir), 'p');
    walk(LIBRARY, 'l');
    const shared = (process.env.CLEARFRAME_LIBRARY ?? '')
      .split(path.delimiter)
      .filter(Boolean);
    for (const [index, directory] of shared.entries())
      walk(path.resolve(directory), `x${index}`);
    const buildStamp = path.join(sceneCache(), 'build.json');
    if (fs.existsSync(buildStamp)) stat('renderer', buildStamp);
  } catch {
    return null;
  }
  return h.digest('hex');
}

/**
 * kind → how to run it. `edits: false` pauses source edits while it runs (it saves a revision or
 * rewrites the working copy); `heavy` goes through the gate; `cache` reuses an identical result.
 */
interface KindConfig {
  heavy: boolean;
  cache?: boolean;
  edits?: boolean;
  label: (job: HarnessJob) => string;
}
export const KINDS: Record<JobKind, KindConfig> = {
  still: {
    heavy: true,
    cache: true,
    label: (j) => `Still · ${j.beat ?? `${j.at?.toFixed(2)} s`}`,
  },
  section: {
    heavy: true,
    cache: true,
    label: (j) => `Section preview · ${(j.beats ?? []).join(', ')}`,
  },
  check: { heavy: true, label: () => 'Check the working copy' },
  draft: { heavy: true, edits: false, label: () => 'Rough cut (half size)' },
  final: { heavy: true, edits: false, label: () => 'Final render' },
  captions: { heavy: false, label: () => 'Caption files' },
  revise: {
    heavy: true,
    edits: false,
    label: (j) => `Candidate for ${j.note}`,
  },
  reject: { heavy: true, edits: false, label: (j) => `Reject ${j.revision}` },
  // Sound: free local drafts, or Google (paid) only with an approved budget the engine enforces.
  voice: {
    heavy: true,
    edits: false,
    label: (j) =>
      j.paid
        ? `Google narration (approved up to $${(j.budget ?? 0).toFixed(2)})`
        : 'Free draft narration',
  },
  music: {
    heavy: true,
    edits: false,
    label: (j) =>
      j.paid
        ? `Google music bed (approved up to $${(j.budget ?? 0).toFixed(2)})`
        : 'Free draft music bed',
  },
};

/** What a rendered file actually is (not what the project asks for): size, length and whether it has sound. */
export function probeMedia(file: string): MediaProbe | null {
  const r = spawnSync(
    'ffprobe',
    [
      '-v',
      'error',
      '-show_entries',
      'stream=codec_type,width,height:format=duration',
      '-of',
      'json',
      file,
    ],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) return null;
  try {
    const { streams = [], format = {} } = Schema.decodeUnknownSync(ProbeSchema)(
        JSON.parse(r.stdout),
      ),
      v = streams.find((x) => x.codec_type === 'video');
    return {
      width: v?.width ?? null,
      height: v?.height ?? null,
      duration: Number(format.duration) || null,
      audio: streams.some((x) => x.codec_type === 'audio'),
    };
  } catch {
    return null;
  }
}

export const required = <T,>(value: T | null | undefined, label: string): T => {
  if (value == null) throw new Error(`The job is missing ${label}.`);
  return value;
};
export function jobArguments(j: HarnessJob): string[] {
  const rough = j.rough ? ['--rough'] : [];
  switch (j.kind) {
    case 'still':
      return [
        'still',
        j.dir,
        ...(j.beat
          ? ['--beat', j.beat, '--pos', String(j.pos)]
          : ['--at', String(j.at)]),
        '--draft',
        ...rough,
        '--out',
        required(j.output, 'output'),
      ];
    case 'section':
      return [
        'preview',
        j.dir,
        '--beats',
        required(j.beats, 'scenes').join(','),
        '--handles',
        String(j.handles),
        ...rough,
        '--out',
        required(j.output, 'output'),
      ];
    case 'check':
      return ['check', j.dir, '--draft', ...rough];
    case 'draft':
      return ['draft', j.dir, ...rough, '--scale', '0.5'];
    case 'final':
      return ['render', j.dir];
    case 'captions':
      return ['captions', j.dir, ...(j.draft ? ['--draft'] : [])];
    case 'revise':
      return ['revise', j.dir, '--note', required(j.note, 'note'), '--json'];
    case 'voice':
    case 'music':
      return [
        j.kind,
        j.dir,
        ...(j.paid ? ['--budget', String(j.budget)] : ['--draft']),
        ...(j.force ? ['--force'] : []),
      ];
    case 'reject':
      return [
        'reject',
        j.dir,
        required(j.revision, 'revision'),
        ...(j.note ? ['--note', required(j.note, 'note')] : []),
        '--by',
        required(j.by, 'reviewer'),
        '--said',
        required(j.said, 'decision'),
        '--json',
      ];
    default:
      throw new Error('Unknown job kind.');
  }
}

export const keyOf = (j: HarnessJob) =>
  sha(
    JSON.stringify([
      path.resolve(j.dir ?? ''),
      j.print,
      j.kind,
      j.beat ?? null,
      j.pos ?? null,
      j.at ?? null,
      j.beats ?? null,
      j.handles ?? null,
      j.rough,
    ]),
  );
