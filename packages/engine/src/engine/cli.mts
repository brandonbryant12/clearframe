#!/usr/bin/env node
import path from 'node:path';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Runtime from 'effect/Runtime';
import * as NodeRuntime from '@effect/platform-node/NodeRuntime';
import { resolveProject } from './lib/project.mjs';
import { startRun, finishRun } from './lib/runlog.mjs';
import { errorMessage } from './lib/errors.mjs';
import { commandScope } from './lib/command-scope.mjs';
import { useProject } from '../film/library.mjs';
import { renderGeometry } from '../film/render-geometry.mjs';
import { HELP } from './commands/help.mjs';
import {
  parseOptions,
  normalizeOptions,
  numberOption,
  type CommandContext,
} from './commands/options.mjs';
import { standaloneCommands, projectCommands } from './commands/registry.mjs';

function showHelp(command: string): void {
  const lines = HELP.split('\n');
  const at = lines.findIndex((line) => line.startsWith(`  ${command} `));
  if (at < 0) return console.log(HELP);
  let end = at + 1;
  while (end < lines.length && /^ {6,}\S/.test(lines[end])) end++;
  console.log(lines.slice(at, end).join('\n'));
}

function configure(context: CommandContext): void {
  const { cmd, o, opts } = context;
  if (o.library) {
    process.env.CLEARFRAME_LIBRARY = [
      process.env.CLEARFRAME_LIBRARY,
      path.resolve(o.library),
    ]
      .filter(Boolean)
      .join(path.delimiter);
    useProject(null);
  }
  if (opts.scale != null) {
    if (!['render', 'preview', 'draft', 'pipeline'].includes(cmd)) {
      throw new Error(
        '--scale is only supported by render, preview, draft and pipeline',
      );
    }
    renderGeometry(
      { width: 1920, height: 1080 },
      {
        scale: opts.scale,
        draft: o.draft || ['preview', 'draft'].includes(cmd),
      },
    );
  }
  if (opts.budget != null && opts.budget < 0)
    throw new Error('budget must be nonnegative');
}

export async function main(argv = process.argv.slice(2)): Promise<unknown> {
  const [cmd, ...args] = argv;
  const { values: o, positionals } = parseOptions(args);
  if (!cmd || cmd === 'help') return console.log(HELP);
  if (o.help) return showHelp(cmd);
  const context: CommandContext = {
    cmd,
    args,
    positionals,
    o,
    opts: normalizeOptions(o),
    num: (key) => numberOption(o, key),
    dir: '',
  };
  configure(context);
  const standalone = standaloneCommands.find((command) =>
    command.matches(context),
  );
  if (standalone) return standalone.run(context);
  context.dir = resolveProject(positionals[0]);
  if (cmd !== 'studio') startRun(context.dir, cmd, args);
  const project = projectCommands.find((command) => command.matches(context));
  if (project) return project.run(context);
  throw new Error(`Unknown command ${cmd}. Run clearframe help.`);
}

class CommandError extends Data.TaggedError('CommandError')<{
  message: string;
  cause: unknown;
}> {}
const program = commandScope(
  () => main(),
  (cause) => new CommandError({ message: errorMessage(cause), cause }),
).pipe(
  Effect.tapError((error) =>
    Effect.sync(() => {
      finishRun({ error });
      console.error(`ClearFrame: ${error.message}`);
    }),
  ),
  Effect.ensuring(Effect.sync(() => finishRun())),
);
NodeRuntime.runMain(program, {
  disableErrorReporting: true,
  teardown: (exit, onExit) =>
    Runtime.defaultTeardown(exit, (code) => {
      onExit(code === 0 ? Number(process.exitCode ?? 0) : code);
    }),
});
