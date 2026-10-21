import fs from 'node:fs';
import path from 'node:path';

import type { StudioOperation } from '../lib/viewer/studio-contracts.mjs';

import type { CommandContext, RawOptions } from './options.mjs';

export async function viewerCommand({ positionals, o, num }: CommandContext) {
  const { buildViewer, serveViewer } = await import('../lib/viewer.mjs');
  const root = positionals.length ? positionals : ['examples', 'real-examples'];
  if (o.serve) {
    const s = await serveViewer({
      root,
      out: o.out ?? 'build/viewer',
      render: !o['no-render'],
      port: num('port') ?? 4317,
      projects: o.projects,
      agent: !o['no-agent'],
    });
    const address = s.server.address();
    if (!address || typeof address === 'string')
      throw new Error('Studio did not bind a TCP port');
    console.log(
      `${s.films} film(s), ${s.versions} version(s). Studio: http://127.0.0.1:${address.port}/\nNew films go to ${path.relative(process.cwd(), s.projects) || '.'}/${s.agent ? '; the agent runtime (OpenCode) starts with the first conversation' : ''}.\nPress Ctrl+C to stop.`,
    );
    return new Promise<void>((resolve) => s.server.once('close', resolve));
  }
  const r = await buildViewer({
    root,
    out: o.out ?? 'build/viewer',
    render: !o['no-render'],
  });
  return console.log(
    `${r.films} film(s), ${r.versions} version(s) → ${path.relative(process.cwd(), r.file)}\nOpen it in a browser (double-click works) to watch and take notes, or run with --serve to work with the agent.`,
  );
}

export async function agentCommand({ positionals, o }: CommandContext) {
  // The studio's OpenCode runtime: isolated folders, the service, its model catalog (docs/agent-studio.md).
  const {
    createRuntime,
    agentPaths,
    opencodeBinary,
    OPENCODE_VERSION,
    DEFAULT_MODEL,
  } = await import('../lib/agent/runtime.mjs');
  const verb = positionals[0] ?? 'status',
    paths = agentPaths(),
    rt = createRuntime();
  const { Service } = await import('@opencode/client/service');
  if (verb === 'stop') {
    await rt.stop();
    return console.log(
      "Stopped the studio's OpenCode service. Conversations are kept and resume when it next starts.",
    );
  }
  if (verb === 'start') {
    await rt.client();
    const list = await rt.catalog();
    const s = rt.status();
    console.log(
      `OpenCode ${s.version} running (pid ${s.pid}); catalog ${s.catalog}, ${list.length} models; default ${DEFAULT_MODEL.providerID}/${DEFAULT_MODEL.id}.`,
    );
    if (s.hint) console.log(s.hint);
    return process.exit(0);
  }
  const running = await Service.discover({ file: paths.registration }).catch(
    () => null,
  );
  const rows = [
    [
      'OpenCode binary',
      opencodeBinary(),
      fs.existsSync(opencodeBinary()) ? 'present' : 'MISSING: run npm install',
    ],
    ['Version', OPENCODE_VERSION, ''],
    [
      'Studio state',
      paths.state,
      'never served; holds the runtime folders and bridge token',
    ],
    ['Runtime data (sessions, saved credentials)', paths.env.XDG_DATA_HOME, ''],
    [
      'Service registration',
      paths.registration,
      running ? 'running' : 'not running',
    ],
    ['Config', paths.config, ''],
    ['Log', path.join(paths.env.XDG_DATA_HOME, 'opencode', 'log'), ''],
    [
      'Default model',
      `${DEFAULT_MODEL.providerID}/${DEFAULT_MODEL.id}`,
      'free (OpenCode Zen)',
    ],
  ];
  if (verb === 'doctor' || verb === 'status')
    return console.log(
      o.json
        ? JSON.stringify(
            Object.fromEntries(
              rows.map(([k, v, n]) => [k, { value: v, note: n }]),
            ),
            null,
            2,
          )
        : rows
            .map(([k, v, n]) => `${k.padEnd(44)} ${v}${n ? `  (${n})` : ''}`)
            .join('\n'),
    );
  throw new Error('agent [status|doctor|start|stop]');
}

export async function studioCommand({ positionals, o, dir }: CommandContext) {
  // The studio's own commands: the same validation, stale-write check and undo history as the UI.
  const { studioState, studioCommand } =
    await import('../lib/viewer/studio.mjs');
  const [, verb = 'state', ...rest] = positionals;
  const show = (s: ReturnType<typeof studioState>) =>
    console.log(
      o.json
        ? JSON.stringify(s, null, 2)
        : [
            `${s.storyboard.beats.length} scenes · ${s.timing?.duration ?? '?'} s${s.timing?.estimated ? ' (narration timing estimated)' : ''}`,
            s.errors.length
              ? `the engine refuses this working copy:\n  ${s.errors.join('\n  ')}`
              : 'the engine accepts this working copy',
            `undo: ${s.undoLabel ?? '—'} · redo: ${s.redoLabel ?? '—'}${s.externalChanges ? ' · edited outside the studio since its last command' : ''}`,
          ].join('\n'),
    );
  if (verb === 'state') return show(studioState(dir));
  if (verb === 'history')
    return console.log(
      studioState(dir)
        .history.map(
          (h) =>
            `${h.applied ? '•' : '○'} ${h.at.slice(0, 19).replace('T', ' ')}  ${h.label}`,
        )
        .join('\n') || 'No studio edits yet.',
    );
  const body = studioOperation(verb, rest, o);
  const result = studioCommand(dir, { ...body, hash: studioState(dir).hash });
  if ('storyboard' in result) return show(result);
  return console.log(JSON.stringify(result, null, 2));
}

function parseValue(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
function studioOperation(
  verb: string,
  args: string[],
  options: RawOptions,
): StudioOperation {
  switch (verb) {
    case 'undo':
    case 'redo':
      return { command: verb };
    case 'set':
      return {
        command: 'set',
        target: options.beat ? 'beat' : 'film',
        beat: options.beat,
        path: args[0],
        value: args.length > 1 ? parseValue(args.slice(1).join(' ')) : null,
      };
    case 'insert':
      return { command: 'insert', block: args[0], after: options.beat };
    case 'sketch':
      return { command: 'insert', sketch: args[0], after: options.beat };
    case 'move':
      return {
        command: 'move',
        beat: options.beat,
        to: Number(options.to) - 1,
      };
    case 'duplicate':
    case 'delete':
      return { command: verb, beat: options.beat };
    case 'treatment':
      return { command: 'treatment', id: args[0] };
    default:
      throw new Error(
        'studio DIR [state|history|undo|redo|set PATH VALUE [--beat ID]|insert BLOCK|sketch NAME [--beat AFTER]|move --beat ID --to N|duplicate|delete --beat ID|treatment ID]',
      );
  }
}
