import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

import * as Schema from 'effect/Schema';

import { errorMessage } from '../../engine/lib/errors.mjs';

import { sceneEnv, SCENE } from './paths.mjs';
import { headroom } from './build.mjs';

export interface DoctorRow {
  name: string;
  ok: boolean;
  detail: string;
}

/** Free word timings: whisper.cpp with a local model is the fast path; the Python CLI works too. */
export function whisperRow(): DoctorRow {
  const cpp =
    spawnSync('whisper-cli', ['--help'], { encoding: 'utf8' }).status === 0;
  const modelDir = path.join(os.homedir(), '.cache/whisper-cpp');
  const model =
    process.env.CLEARFRAME_WHISPER_MODEL ??
    ['ggml-base.en.bin', 'ggml-base.bin']
      .map((n) => path.join(modelDir, n))
      .find((f) => fs.existsSync(f));
  const py =
    spawnSync('whisper', ['--help'], { encoding: 'utf8' }).status === 0;
  let detail = 'no local Whisper: install whisper-cpp or openai-whisper';
  if (cpp && model)
    detail = `whisper.cpp with ${path.basename(model)} (fast, GPU)`;
  else if (py)
    detail = `Python whisper (slow, CPU)${cpp ? `; for ~10× faster alignment put ggml-base.en.bin in ${modelDir}` : ''}`;
  return { name: 'Word timings', ok: (cpp && !!model) || py, detail };
}

/** Tools the renderer and the film pipeline need, and the disk headroom for a build. */
export function doctor(): DoctorRow[] {
  const env = sceneEnv(),
    rows: DoctorRow[] = [];
  const tools: ReadonlyArray<readonly [string, string, readonly string[]]> = [
    ['Rust', 'rustc', ['--version']],
    ['Cargo', 'cargo', ['--version']],
    ['FFmpeg', 'ffmpeg', ['-version']],
    ['ffprobe', 'ffprobe', ['-version']],
  ];
  for (const [name, bin, args] of tools) {
    const r = spawnSync(bin, args, { encoding: 'utf8', env });
    rows.push({
      name,
      ok: r.status === 0,
      detail: (r.stdout || r.stderr || r.error?.message || '')
        .trim()
        .split('\n')[0],
    });
  }
  const encoders =
    spawnSync('ffmpeg', ['-hide_banner', '-encoders'], {
      encoding: 'utf8',
      env,
    }).stdout || '';
  rows.push({
    name: 'H.264 encoder',
    ok: /\blibx264\b/.test(encoders),
    detail: /\blibx264\b/.test(encoders) ? 'libx264' : 'ffmpeg has no libx264',
  });
  const { free, warm } = headroom();
  rows.push({
    name: 'Disk headroom',
    ok: free >= (warm ? 10 : 25),
    detail: `${free.toFixed(1)} GiB free (${warm ? 'warm cache' : 'cold build'})`,
  });
  // A full render or the full test suite wants more than a warm build does (AGENTS.md).
  rows.push({
    name: 'Render headroom',
    ok: free >= 20,
    detail:
      free >= 20
        ? `${free.toFixed(1)} GiB free`
        : `${free.toFixed(1)} GiB free: keep 20 GiB before a full render or the full test suite (clear old build/ outputs)`,
  });
  rows.push(fontCheck());
  rows.push(whisperRow());
  return rows;
}

export const FontFile = Schema.Struct({
  file: Schema.String,
  sha256: Schema.String,
});

export const FontProvenance = Schema.Struct({
  files: Schema.Array(FontFile),
  staticInstances: Schema.Array(FontFile),
  families: Schema.Array(
    Schema.Struct({
      files: Schema.Array(FontFile),
      instances: Schema.optionalKey(Schema.Array(FontFile)),
    }),
  ),
});

/**
 * Type is measured and drawn with the bundled fonts only, so a missing or different file changes
 * every line break: check each against the hash recorded when it was imported.
 */
export function fontCheck(): DoctorRow {
  const dir = path.join(SCENE, '..', 'film', 'assets', 'fonts');
  try {
    const raw: unknown = JSON.parse(
      fs.readFileSync(path.join(dir, 'provenance.json'), 'utf8'),
    );
    const p = Schema.decodeUnknownSync(FontProvenance)(raw);
    const files = [
      ...p.files,
      ...p.staticInstances,
      ...p.families.flatMap((f) => [...f.files, ...(f.instances ?? [])]),
    ];
    const bad = files.filter((f) => {
      const file = path.join(dir, f.file);
      return (
        !fs.existsSync(file) ||
        crypto
          .createHash('sha256')
          .update(fs.readFileSync(file))
          .digest('hex') !== f.sha256
      );
    });
    return {
      name: 'Bundled fonts',
      ok: !bad.length,
      detail: bad.length
        ? `${bad.length} of ${files.length} missing or changed: ${bad
            .slice(0, 3)
            .map((f) => f.file)
            .join(', ')} (restore film/assets/fonts from git)`
        : `${files.length} files match their recorded hashes`,
    };
  } catch (e) {
    return { name: 'Bundled fonts', ok: false, detail: errorMessage(e) };
  }
}
