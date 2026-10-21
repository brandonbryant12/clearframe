import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import type { ModelInfo, OpenCode } from '@opencode/client';
import type { Service } from '@opencode/client/service';
export interface ModelRef {
  providerID: string;
  id: string;
}
export interface RuntimeStatus {
  state: 'stopped' | 'starting' | 'ready' | 'error';
  version: string;
  catalog: 'unknown' | 'loading' | 'ready' | 'missing-model' | 'empty';
  model: string | null;
  error: string | null;
  hint: string | null;
  pid?: number;
}
export interface RuntimeOptions {
  base?: string;
  model?: ModelRef;
  service?: typeof Service;
  client?: typeof OpenCode.make;
  catalogTimeout?: number;
}

export const OPENCODE_VERSION = '2.1.0';
const require = createRequire(import.meta.url);
export const PLUGIN_DIR = fileURLToPath(
  new URL('../../agent-plugin', import.meta.url),
);
export const PLUGIN_ENTRY = path.join(
  PLUGIN_DIR,
  import.meta.url.endsWith('.mts') ? 'server.ts' : 'server.js',
);
export const PLUGIN_TOOLS_ENTRY = path.join(
  PLUGIN_DIR,
  import.meta.url.endsWith('.mts')
    ? 'tool-definitions.ts'
    : 'tool-definitions.js',
);
export const INSTRUCTIONS = path.join(PLUGIN_DIR, 'INSTRUCTIONS.md');
/** The free OpenCode Zen model verified for this integration; never silently replaced by a paid one. */
export const DEFAULT_MODEL = { providerID: 'opencode', id: 'big-pickle' };

/**
 * Permissions every studio session runs with. Rules are last-match-wins. The OpenCode free tier
 * refuses requests whose built-in shell tool is denied outright (403 "free tier can only be used
 * from within OpenCode"), so shell and web stay available behind a person's approval ("ask") and
 * appear as approval cards in the browser. Direct file edits are denied: storyboard changes go
 * through clearframe_edit, which validates them and records undo history. OpenCode's own
 * "external directory" boundary is the git worktree, not the session's folder (a project inside
 * this repository could read the whole repository), so reads are held to the project explicitly:
 * a read's resource is its path relative to the session folder, and anything starting with `../`,
 * `/` or `~` is outside. grep, glob and list match their pattern rather than their folder, so they
 * are denied; clearframe_files lists and reads the project instead. Skills other than ClearFrame's
 * are denied so unrelated globally installed skills cannot steer a film. Verified against the free
 * model (none of these rules trips the free-tier refusal; only denying shell does).
 */
export const PERMISSIONS = [
  { action: 'shell', resource: '*', effect: 'ask' },
  { action: 'webfetch', resource: '*', effect: 'ask' },
  { action: 'websearch', resource: '*', effect: 'ask' },
  { action: 'edit', resource: '*', effect: 'deny' },
  { action: 'external_directory', resource: '*', effect: 'deny' },
  ...['../*', '/*', '~*'].map((resource) => ({
    action: 'read',
    resource,
    effect: 'deny',
  })),
  // Narration records are read through clearframe_files, which says what actually spoke each line.
  { action: 'read', resource: '*assets/vo/*.json', effect: 'deny' },
  ...['grep', 'glob', 'list'].map((action) => ({
    action,
    resource: '*',
    effect: 'deny',
  })),
  { action: 'skill', resource: '*', effect: 'deny' },
  { action: 'skill', resource: 'clearframe*', effect: 'allow' },
];

/** Where studio state lives: a dot folder (the static server never serves dot paths), overridable. */
export function agentPaths(base = process.cwd()) {
  const state = path.resolve(
    process.env.CLEARFRAME_STATE ?? path.join(base, '.clearframe'),
  );
  const oc = path.join(state, 'opencode');
  return {
    state,
    oc,
    agent: path.join(state, 'agent'),
    uploads: path.join(state, 'uploads'),
    bridge: path.join(state, 'agent', 'bridge.json'),
    runtime: path.join(state, 'agent', 'runtime.json'),
    config: path.join(oc, 'config'),
    registration: path.join(oc, 'state', 'opencode', 'service.json'),
    env: {
      XDG_CONFIG_HOME: path.join(oc, 'xdg-config'),
      XDG_DATA_HOME: path.join(oc, 'data'),
      XDG_STATE_HOME: path.join(oc, 'state'),
      XDG_CACHE_HOME: path.join(oc, 'cache'),
      OPENCODE_CONFIG_DIR: path.join(oc, 'config'),
    },
  };
}

/** The native OpenCode binary installed with @opencode/cli for this platform. */
export function opencodeBinary() {
  if (process.env.CLEARFRAME_OPENCODE_BIN)
    return process.env.CLEARFRAME_OPENCODE_BIN;
  const pkg = `@opencode/cli-${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  try {
    return path.join(
      path.dirname(require.resolve(`${pkg}/package.json`)),
      'bin',
      process.platform === 'win32' ? 'opencode.exe' : 'opencode',
    );
  } catch {
    return path.join(
      path.dirname(require.resolve('@opencode/cli/package.json')),
      'bin',
      'opencode.exe',
    );
  }
}

export const modelKey = (m: ModelRef | null | undefined) =>
  m ? `${m.providerID}/${m.id}` : null;
export const parseModel = (s: unknown): ModelRef | null => {
  const m = /^([\w.-]+)\/(.+)$/.exec(String(s ?? ''));
  return m ? { providerID: m[1], id: m[2] } : null;
};
/** Free when every listed price is zero (OpenCode Zen's free models report zero input, output and cache cost). */
export const isFree = (m: Pick<ModelInfo, 'cost'> | null | undefined) =>
  Array.isArray(m?.cost) &&
  m.cost.length > 0 &&
  m.cost.every(
    (c) => !c.input && !c.output && !c.cache?.read && !c.cache?.write,
  );

export function runtimeConfig(
  paths: ReturnType<typeof agentPaths>,
  { model = DEFAULT_MODEL }: { model?: ModelRef } = {},
) {
  return {
    $schema: 'https://opencode.ai/config.json',
    model: modelKey(model),
    share: 'disabled',
    update: 'disable',
    snapshots: false,
    plugins: [{ package: PLUGIN_DIR, options: { bridgeFile: paths.bridge } }],
    instructions: [INSTRUCTIONS],
    permissions: PERMISSIONS,
  };
}
