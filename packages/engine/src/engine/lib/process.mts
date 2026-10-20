import * as Context from 'effect/Context';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Layer from 'effect/Layer';
import * as Stream from 'effect/Stream';
import * as ChildProcess from 'effect/process/ChildProcess';
import { ChildProcessSpawner } from 'effect/process/ChildProcessSpawner';
import * as NodeServices from '@effect/platform-node/NodeServices';
import { errorMessage } from './errors.mjs';

export interface Command {
  executable: string;
  args: readonly string[];
  cwd?: string;
  env?: Record<string, string | undefined>;
  maxOutputBytes?: number;
}
export interface CommandResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}
export class ProcessError extends Data.TaggedError('ProcessError')<{
  executable: string;
  message: string;
  exitCode?: number;
  stderr?: string;
  cause?: unknown;
}> {}
export class ProcessRunner extends Context.Service<
  ProcessRunner,
  {
    run: (command: Command) => Effect.Effect<CommandResult, ProcessError>;
  }
>()('clearframe/ProcessRunner') {}

function collectOutput<E, R>(
  stream: Stream.Stream<Uint8Array, E, R>,
  limit: number,
  executable: string,
) {
  return stream.pipe(
    Stream.decodeText(),
    Stream.runFoldEffect(
      () => '',
      (text, chunk) =>
        Buffer.byteLength(text) + Buffer.byteLength(chunk) <= limit
          ? Effect.succeed(text + chunk)
          : Effect.fail(
              new ProcessError({
                executable,
                message: `Process output exceeded ${limit} bytes.`,
              }),
            ),
    ),
  );
}

export const ProcessRunnerLive = Layer.effect(
  ProcessRunner,
  Effect.gen(function* () {
    const spawner = yield* ChildProcessSpawner;
    const run = (command: Command) =>
      Effect.scoped(
        Effect.gen(function* () {
          const child = yield* spawner.spawn(
            ChildProcess.make(command.executable, [...command.args], {
              cwd: command.cwd,
              env: command.env,
              extendEnv: true,
              detached: false,
              stdin: 'ignore',
              stdout: 'pipe',
              stderr: 'pipe',
              forceKillAfter: '2 seconds',
            }),
          );
          const limit = command.maxOutputBytes ?? 16 * 1024 * 1024;
          const [stdout, stderr] = yield* Effect.all(
            [
              collectOutput(child.stdout, limit, command.executable),
              collectOutput(child.stderr, limit, command.executable),
            ],
            { concurrency: 2 },
          );
          const exitCode = yield* child.exitCode;
          if (exitCode !== 0)
            return yield* Effect.fail(
              new ProcessError({
                executable: command.executable,
                exitCode,
                stderr,
                message: `${command.executable} exited ${exitCode}\n${stderr.split('\n').slice(-25).join('\n')}`,
              }),
            );
          return { stdout, stderr, exitCode };
        }),
      ).pipe(
        Effect.mapError((error) =>
          error instanceof ProcessError
            ? error
            : new ProcessError({
                executable: command.executable,
                message: errorMessage(error),
                cause: error,
              }),
        ),
      );
    return { run };
  }),
);
export const NodeProcessRunnerLive = ProcessRunnerLive.pipe(
  Layer.provide(NodeServices.layer),
);
export const runCommand = (command: Command) =>
  Effect.flatMap(ProcessRunner, (runner) => runner.run(command));
