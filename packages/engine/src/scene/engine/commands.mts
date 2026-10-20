import * as Effect from 'effect/Effect';
import { runCommandEffect } from '../../engine/lib/command-scope.mjs';

import type { SceneEngineError, RunOptions } from '../engine-process.mjs';
import { SceneEngine, SceneEngineLive } from './build.mjs';
import type { BuildOptions, EngineContext } from './contracts.mjs';

/** Run a SceneEngine effect for a Promise caller; a failure rejects with its error. */
export async function runEngine<A>(
  effect: Effect.Effect<A, SceneEngineError, SceneEngine>,
): Promise<A> {
  return runCommandEffect(effect.pipe(Effect.provide(SceneEngineLive)));
}

export function run(
  bin: string,
  args: readonly string[],
  options: RunOptions = {},
): Promise<string> {
  return runEngine(
    Effect.flatMap(SceneEngine, (engine) => engine.run(bin, args, options)),
  );
}

/** Build the renderer when its sources changed. One Cargo job; compilation takes the heavy-job gate. */
export function buildScene(options: BuildOptions = {}): Promise<string> {
  return runEngine(
    Effect.flatMap(SceneEngine, (engine) => engine.build(options)),
  );
}

/**
 * Run a renderer command on a prepared project: `render [A..B] [--draft] [--scale S] -o OUT`,
 * `frame LIST -o DIR`, `inspect --fail-on error`, `--audit FILE`.
 */
export function engineCommand(
  ctx: EngineContext,
  command: string,
  args: readonly string[] = [],
  capture = false,
): Promise<string> {
  return runEngine(
    Effect.flatMap(SceneEngine, (engine) =>
      engine.command(ctx, command, args, capture),
    ),
  );
}

/** Command words → renderer arguments (`--draft`/`--scale` become globals). */
export function sceneArgs(
  plan: string,
  command: string,
  args: readonly string[] = [],
): string[] {
  const flags: string[] = [],
    rest: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--draft') flags.push('--draft');
    else if (args[i] === '--scale') flags.push('--scale', args[++i]);
    else rest.push(args[i]);
  }
  return [
    '--plan',
    plan,
    ...flags,
    ...(command === '--audit' ? ['audit', ...rest] : [command, ...rest]),
  ];
}
