// Running the renderer (and its build): a scoped child process whose stderr shows live while
// its tail is kept, so a failure says why (and the run log records it) instead of only
// "exited 1". Captured runs return stdout and stderr interleaved as they arrived.
import path from 'node:path';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Stream from 'effect/Stream';
import * as ChildProcess from 'effect/process/ChildProcess';
import type {
  ChildProcessHandle,
  ChildProcessSpawner,
} from 'effect/process/ChildProcessSpawner';
import { errorMessage } from '../engine/lib/errors.mjs';
import { hasCommandScope } from '../engine/lib/command-scope.mjs';

export class SceneEngineError extends Data.TaggedError('SceneEngineError')<{
  message: string;
  cause?: unknown;
}> {}

export interface RunOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  /** Return stdout and stderr instead of showing them. */
  capture?: boolean;
}

/** Characters of output a failure keeps. */
const TAIL = 6000;

/** While the renderer runs, Ctrl-C and termination stop it, and this process reports how it ended. */
const forwardSignals = (handle: ChildProcessHandle) =>
  Effect.acquireRelease(
    Effect.sync(() => {
      const forward = (killSignal: 'SIGINT' | 'SIGTERM') => () => {
        Effect.runFork(Effect.ignore(handle.kill({ killSignal })));
      };
      const listeners = {
        SIGINT: forward('SIGINT'),
        SIGTERM: forward('SIGTERM'),
      };
      process.once('SIGINT', listeners.SIGINT);
      process.once('SIGTERM', listeners.SIGTERM);
      return listeners;
    }),
    (listeners) =>
      Effect.sync(() => {
        process.removeListener('SIGINT', listeners.SIGINT);
        process.removeListener('SIGTERM', listeners.SIGTERM);
      }),
  );

/** Everything the renderer printed, in arrival order. */
function captureAll(handle: ChildProcessHandle) {
  let output = '';
  return handle.all.pipe(
    Stream.decodeText(),
    Stream.runForEach((chunk) =>
      Effect.sync(() => {
        output += chunk;
      }),
    ),
    Effect.map(() => output),
  );
}

/** Stderr shown live (stdout too, on stderr, when progress goes there); the stderr tail kept. */
function showLive(handle: ChildProcessHandle, stdoutToStderr: boolean) {
  let output = '';
  const decoder = new TextDecoder();
  const stderr = handle.stderr.pipe(
    Stream.runForEach((chunk) =>
      Effect.sync(() => {
        process.stderr.write(chunk);
        output = (output + decoder.decode(chunk, { stream: true })).slice(
          -TAIL,
        );
      }),
    ),
  );
  const toStderr = (chunk: Uint8Array) =>
    Effect.sync(() => {
      process.stderr.write(chunk);
    });
  const stdout = stdoutToStderr
    ? handle.stdout.pipe(Stream.runForEach(toStderr))
    : Effect.void;
  return Effect.all([stdout, stderr], { concurrency: 'unbounded' }).pipe(
    Effect.map(() => output),
  );
}

/** Run `bin` to completion; a non-zero exit fails with the output's tail. */
export function runRenderer(
  spawner: ChildProcessSpawner['Service'],
  bin: string,
  args: readonly string[],
  { cwd, env, capture = false }: RunOptions,
): Effect.Effect<string, SceneEngineError> {
  const progress = process.env.CLEARFRAME_PROGRESS_STDERR === '1';
  return Effect.scoped(
    Effect.gen(function* () {
      const handle = yield* spawner.spawn(
        ChildProcess.make(bin, [...args], {
          cwd,
          env,
          extendEnv: false,
          detached: false,
          stdin: capture ? 'ignore' : 'inherit',
          stdout: capture || progress ? 'pipe' : 'inherit',
          stderr: 'pipe',
          forceKillAfter: '2 seconds',
        }),
      );
      if (!hasCommandScope()) yield* forwardSignals(handle);
      const output = capture
        ? yield* captureAll(handle)
        : yield* showLive(handle, progress);
      const code = Number(yield* handle.exitCode);
      if (code !== 0)
        return yield* Effect.fail(
          new SceneEngineError({
            message: `${path.basename(bin)} exited ${code}${output ? '\n' + output.slice(-TAIL) : ''}`,
          }),
        );
      return output;
    }),
  ).pipe(
    Effect.mapError((e) =>
      e instanceof SceneEngineError
        ? e
        : new SceneEngineError({ message: errorMessage(e), cause: e }),
    ),
  );
}
