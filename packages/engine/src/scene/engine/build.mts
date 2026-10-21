import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { spawnSync } from 'node:child_process';

import * as Context from 'effect/Context';
import * as Effect from 'effect/Effect';

import * as Layer from 'effect/Layer';
import * as Schema from 'effect/Schema';
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner';
import * as NodeServices from '@effect/platform-node/NodeServices';
import { readJSON, writeJSON, log } from '../../engine/lib/util.mjs';
import { errorMessage } from '../../engine/lib/errors.mjs';
import { gateIsInherited } from '../../engine/lib/resource-gate.mjs';
import { SceneEngineError, runRenderer } from '../engine-process.mjs';
import type { RunOptions } from '../engine-process.mjs';
import {
  sceneCache,
  TARGET,
  CRATE,
  REPO,
  sceneEnv,
  sceneBinary,
} from './paths.mjs';
import type { BuildOptions, EngineContext } from './contracts.mjs';
import { sceneArgs } from './commands.mjs';
import { sceneHash, sceneSources } from './sources.mjs';

/** Who holds the machine-wide heavy-job lock, if its recorded owner is still running. */
export function lockHolder(): string | null {
  try {
    const pid = Number(
      fs
        .readFileSync(
          `/private/tmp/codex-heavy-${os.userInfo().uid}.lock`,
          'utf8',
        )
        .trim(),
    );
    if (!Number.isInteger(pid) || pid <= 0 || pid === process.pid) return null;
    const ps = spawnSync('ps', ['-o', 'etime=,command=', '-p', String(pid)], {
      encoding: 'utf8',
    }).stdout.trim();
    if (!ps.includes('codex-heavy')) return null;
    const [elapsed, ...command] = ps.split(/\s+/);
    return `PID ${pid} for ${elapsed} (${command
      .slice(command.indexOf('--') + 1)
      .join(' ')
      .slice(0, 90)})`;
  } catch {
    return null;
  }
}

/** The marker written after a build: the source hash the binary was built from. */
export const BuildMarker = Schema.Struct({ hash: Schema.String });

export const isBuildMarker = Schema.is(BuildMarker);

export const backend = () =>
  process.platform === 'darwin' ? 'skia-metal' : 'skia-raster';

/** Gibibytes free on the renderer's volume, and whether its dependency cache is warm. */
export function headroom(): { free: number; warm: boolean } {
  fs.mkdirSync(sceneCache(), { recursive: true });
  const st = fs.statfsSync(sceneCache());
  return {
    free: (st.bavail * st.bsize) / 2 ** 30,
    warm: fs.existsSync(path.join(TARGET(), 'release/deps')),
  };
}

/** Keep saying so while the heavy-job lock is someone else's, so a queued build is not taken for a hang. */
export const queuedNotice = Effect.acquireRelease(
  Effect.sync(() => {
    const holder = lockHolder();
    if (holder)
      log.warn(
        `Heavy-job lock is held by ${holder}; the build starts when it finishes.`,
      );
    const started = Date.now();
    const heartbeat = setInterval(() => {
      const now = lockHolder();
      if (!now || now.includes(CRATE)) return clearInterval(heartbeat);
      log.warn(
        `Still queued (${Math.round((Date.now() - started) / 1000)}s) behind ${now}. The build starts by itself; don't stop this command.`,
      );
    }, 30000);
    heartbeat.unref();
    return heartbeat;
  }),
  (heartbeat) => Effect.sync(() => clearInterval(heartbeat)),
);

export class SceneEngine extends Context.Service<
  SceneEngine,
  {
    /** Build the renderer when its sources changed; the binary's path. */
    build: (options?: BuildOptions) => Effect.Effect<string, SceneEngineError>;
    /** Run a renderer command on a prepared project; its captured output, if captured. */
    command: (
      ctx: EngineContext,
      command: string,
      args?: readonly string[],
      capture?: boolean,
    ) => Effect.Effect<string, SceneEngineError>;
    /** Run a program with the renderer's environment and stderr handling. */
    run: (
      bin: string,
      args: readonly string[],
      options?: RunOptions,
    ) => Effect.Effect<string, SceneEngineError>;
  }
>()('clearframe/scene/SceneEngine') {}

export const attempt = <A,>(thunk: () => A) =>
  Effect.try({
    try: thunk,
    catch: (e) => new SceneEngineError({ message: errorMessage(e), cause: e }),
  });

export const SceneEngineLive = Layer.effect(
  SceneEngine,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner;
    const run = (
      bin: string,
      args: readonly string[],
      { cwd = REPO, env = sceneEnv(), capture = false }: RunOptions = {},
    ) => runRenderer(spawner, bin, args, { cwd, env, capture });

    /** One Cargo job; compilation takes the heavy-job gate. */
    const build = Effect.fnUntraced(function* ({
      force = false,
    }: BuildOptions = {}) {
      const hash = yield* attempt(sceneHash);
      const marker = path.join(sceneCache(), 'build.json');
      const recorded = yield* attempt(() => readJSON(marker, null));
      if (
        !force &&
        fs.existsSync(sceneBinary()) &&
        isBuildMarker(recorded) &&
        recorded.hash === hash
      )
        return sceneBinary();
      const { free, warm } = yield* attempt(headroom);
      if (free < (warm ? 10 : 25))
        return yield* Effect.fail(
          new SceneEngineError({
            message: `The renderer build needs ${warm ? 10 : 25} GiB free; ${free.toFixed(1)} GiB available.`,
          }),
        );
      log.step(
        `Building the renderer ${warm ? 'with the existing dependency cache' : 'from a cold cache'} (one Cargo job)`,
      );
      const gate = path.join(os.homedir(), '.local/bin/codex-heavy');
      const cargo = [
        'build',
        '--manifest-path',
        path.join(CRATE, 'Cargo.toml'),
        '--release',
        '--locked',
        '--jobs',
        '1',
      ];
      if (fs.existsSync(gate) && !gateIsInherited())
        yield* Effect.scoped(
          Effect.andThen(queuedNotice, run(gate, ['--', 'cargo', ...cargo])),
        );
      else yield* run('cargo', cargo);
      // The build may have waited for the lock while sources changed; cargo compiles what is on
      // disk when it starts. If every source is older than the binary, the binary is current.
      yield* attempt(() => {
        const built = fs.statSync(sceneBinary()).mtimeMs;
        const current = sceneSources().every(
          (f) => fs.statSync(f).mtimeMs <= built,
        );
        writeJSON(marker, {
          hash: current ? sceneHash() : hash,
          backend: backend(),
        });
      });
      return sceneBinary();
    });

    const command = (
      ctx: EngineContext,
      name: string,
      args: readonly string[] = [],
      capture = false,
    ) =>
      Effect.flatMap(build(), (bin) =>
        run(bin, sceneArgs(path.join(ctx.dir, 'plan.json'), name, args), {
          capture,
          cwd: ctx.dir,
        }),
      );

    return SceneEngine.of({ build, command, run });
  }),
).pipe(Layer.provide(NodeServices.layer));
