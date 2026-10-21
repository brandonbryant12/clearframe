import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

import { fileURLToPath } from 'node:url';
import { cacheRoot } from '../../engine/lib/cache.mjs';

export const SCENE = path.dirname(
  fileURLToPath(new URL('../engine.mjs', import.meta.url)),
);

export const REPO = path.dirname(SCENE);

/** The film pipeline (job, prepare, render) and its bundled assets. */
export const FILM = path.join(REPO, 'film');

export const sha256 = (data: crypto.BinaryLike) =>
  crypto.createHash('sha256').update(data).digest('hex');

export const CRATE = path.join(SCENE, 'native');

/** Native builds outlive replaceable package distributions and work in read-only installations. */
export const sceneCache = (): string => {
  const configured = process.env.CLEARFRAME_SCENE_CACHE;
  if (configured !== undefined) {
    if (!configured.trim())
      throw new Error('CLEARFRAME_SCENE_CACHE must name a directory.');
    return path.resolve(configured);
  }
  return path.join(cacheRoot(), 'scene');
};

export const TARGET = () => path.join(sceneCache(), 'target');

export const sceneBinary = () =>
  path.join(TARGET(), 'release/clearframe-scene');

/** Build environment: one Cargo job, at most two worker threads anywhere in the build. */
export const sceneEnv = () => ({
  ...process.env,
  PATH: [path.join(os.homedir(), '.cargo/bin'), process.env.PATH].join(
    path.delimiter,
  ),
  CARGO_TARGET_DIR: TARGET(),
  CARGO_BUILD_JOBS: '1',
  // Incremental release builds apply only to local crates, so an edit recompiles only it.
  CARGO_PROFILE_RELEASE_INCREMENTAL: 'true',
  // Used only if rust-skia has no prebuilt binary and compiles Skia: two ninja jobs.
  SKIA_NINJA_COMMAND: path.join(SCENE, 'tools/ninja-limited'),
  RAYON_NUM_THREADS: '2',
  CMAKE_BUILD_PARALLEL_LEVEL: '2',
  NUM_JOBS: '2',
});
