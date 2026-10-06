// The OpenCode runtime ClearFrame owns: one local background service (OpenCode 2.0.24, from this
// package's node_modules), isolated from any global OpenCode install by its own XDG data, state,
// cache and config folders under the studio state directory. Its endpoint and password stay in
// this process; the browser only ever sees a status. See docs/agent-studio.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

export const OPENCODE_VERSION = '2.0.24';
const require = createRequire(import.meta.url);
export const PLUGIN_DIR = fileURLToPath(new URL('../../agent-plugin', import.meta.url));
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
  ...['../*', '/*', '~*'].map(resource => ({ action: 'read', resource, effect: 'deny' })),
  ...['grep', 'glob', 'list'].map(action => ({ action, resource: '*', effect: 'deny' })),
  { action: 'skill', resource: '*', effect: 'deny' },
  { action: 'skill', resource: 'clearframe*', effect: 'allow' },
];

/** Where studio state lives: a dot folder (the static server never serves dot paths), overridable. */
export function agentPaths(base = process.cwd()) {
  const state = path.resolve(process.env.CLEARFRAME_STATE ?? path.join(base, '.clearframe'));
  const oc = path.join(state, 'opencode');
  return {
    state, oc, agent: path.join(state, 'agent'), uploads: path.join(state, 'uploads'),
    bridge: path.join(state, 'agent', 'bridge.json'), runtime: path.join(state, 'agent', 'runtime.json'),
    config: path.join(oc, 'config'), registration: path.join(oc, 'state', 'opencode', 'service.json'),
    env: { XDG_CONFIG_HOME: path.join(oc, 'xdg-config'), XDG_DATA_HOME: path.join(oc, 'data'), XDG_STATE_HOME: path.join(oc, 'state'), XDG_CACHE_HOME: path.join(oc, 'cache'), OPENCODE_CONFIG_DIR: path.join(oc, 'config') },
  };
}

/** The native OpenCode binary installed with @opencode/cli for this platform. */
export function opencodeBinary() {
  if (process.env.CLEARFRAME_OPENCODE_BIN) return process.env.CLEARFRAME_OPENCODE_BIN;
  const pkg = `@opencode/cli-${process.platform === 'win32' ? 'windows' : process.platform}-${process.arch}`;
  try { return path.join(path.dirname(require.resolve(`${pkg}/package.json`)), 'bin', process.platform === 'win32' ? 'opencode.exe' : 'opencode'); }
  catch { return path.join(path.dirname(require.resolve('@opencode/cli/package.json')), 'bin', 'opencode.exe'); }
}

const modelKey = m => (m ? `${m.providerID}/${m.id}` : null);
export const parseModel = s => { const m = /^([\w.-]+)\/(.+)$/.exec(String(s ?? '')); return m ? { providerID: m[1], id: m[2] } : null; };
/** Free when every listed price is zero (OpenCode Zen's free models report zero input, output and cache cost). */
export const isFree = m => Array.isArray(m?.cost) && m.cost.length > 0 && m.cost.every(c => !c.input && !c.output && !c.cache?.read && !c.cache?.write);

export function runtimeConfig(paths, { model = DEFAULT_MODEL } = {}) {
  return {
    $schema: 'https://opencode.ai/config.json',
    model: modelKey(model), share: 'disabled', update: 'disable', snapshots: false,
    plugins: [{ package: PLUGIN_DIR, options: { bridgeFile: paths.bridge } }],
    instructions: [INSTRUCTIONS],
    permissions: PERMISSIONS,
  };
}

/**
 * Own the service: write its config, ensure it is running (once, however many callers), restart
 * it when the config ClearFrame writes has changed, and wait for the model catalog to load.
 * `service` and `client` are injectable for tests.
 */
export function createRuntime({ base = process.cwd(), model = DEFAULT_MODEL, service, client: makeClient, catalogTimeout = 45000 } = {}) {
  const paths = agentPaths(base);
  let status = { state: 'stopped', version: OPENCODE_VERSION, catalog: 'unknown', model: modelKey(model), error: null, hint: null };
  // A generation per start/stop: a start that finishes after a stop (or after a newer start) cannot
  // overwrite the newer state. Service.ensure itself is shared, so a slow start that times out is
  // awaited again by the retry instead of spawning a second service.
  let starting = null, client = null, endpoint = null, models = null, generation = 0, ensuring = null, stale = false;
  const set = patch => { status = { ...status, ...patch }; };

  async function libs() {
    const svc = service ?? (await import('@opencode/client/service')).Service;
    const make = makeClient ?? (await import('@opencode/client')).OpenCode.make;
    return { svc, make };
  }
  function writeConfig() {
    for (const d of [paths.config, paths.agent, ...Object.values(paths.env)]) fs.mkdirSync(d, { recursive: true });
    const config = JSON.stringify(runtimeConfig(paths, { model }), null, 2) + '\n';
    const file = path.join(paths.config, 'opencode.json');
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== config) fs.writeFileSync(file, config);
    // Plugin and instructions are part of what the running service loaded.
    const stamp = crypto.createHash('sha256').update(config).update(fs.readFileSync(path.join(PLUGIN_DIR, 'server.js'))).update(fs.readFileSync(INSTRUCTIONS)).digest('hex');
    return stamp;
  }
  const readStamp = () => { try { return JSON.parse(fs.readFileSync(paths.runtime, 'utf8')).stamp; } catch { return null; } };

  async function start(gen) {
    const { svc, make } = await libs();
    set({ state: 'starting', error: null, hint: null });
    const stamp = writeConfig();
    const running = !ensuring && readStamp() !== stamp ? await svc.discover({ file: paths.registration }).catch(() => null) : null;
    if (running) {
      // ClearFrame changed the plugin, instructions or permissions: restart so they apply, but never
      // in the middle of a reply (that would stop someone's work); then they apply after the next stop.
      const busy = await make({ baseUrl: running.url, headers: svc.headers(running) }).session.active().then(a => Object.keys(a ?? {}).length > 0, () => false);
      if (!busy) await svc.stop({ file: paths.registration }).catch(() => {});
      else stale = true;
    }
    ensuring ??= svc.ensure({ file: paths.registration, version: OPENCODE_VERSION, command: [opencodeBinary(), 'serve', '--service', '--port', '0'], env: paths.env })
      .finally(() => { ensuring = null; });
    const ensure = ensuring;
    let timer;
    const ep = await Promise.race([ensure, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('OpenCode did not start within 40 seconds.')), 40000); })]).finally(() => clearTimeout(timer));
    if (gen !== generation) throw new Error('superseded');
    if (!stale) fs.writeFileSync(paths.runtime, JSON.stringify({ stamp, version: OPENCODE_VERSION, startedAt: new Date().toISOString() }));
    const c = make({ baseUrl: ep.url, headers: svc.headers(ep) });
    const info = await c.server.info();
    if (gen !== generation) throw new Error('superseded');
    endpoint = ep; client = c;
    set({ state: 'ready', version: info.version, pid: info.pid, catalog: 'loading', hint: stale ? 'ClearFrame\'s agent tools changed while a reply was running; they apply after `clearframe agent stop` (or the next start when no reply is running).' : null });
    waitForCatalog(gen).catch(() => {});
    return client;
  }
  /** The catalog loads asynchronously after start: an early empty list is not an error. */
  async function waitForCatalog(gen = generation) {
    const until = Date.now() + catalogTimeout;
    while (Date.now() < until) {
      if (gen !== generation || !client) return models ?? [];
      try {
        const r = await client.model.list({ location: { directory: base } });
        const list = Array.isArray(r) ? r : r?.data ?? [];
        if (list.some(m => m.providerID === model.providerID && m.id === model.id)) { models = list; set({ catalog: 'ready' }); return list; }
        if (list.length) models = list;
      } catch {}
      await new Promise(r => setTimeout(r, 750));
    }
    set({ catalog: models?.length ? 'missing-model' : 'empty', hint: models?.length
      ? `The model ${modelKey(model)} is not in this runtime's catalog. Choose another model, or connect its provider.`
      : 'OpenCode has not loaded its model catalog. It downloads it on first start: check this computer can reach opencode.ai, then retry.' });
    return models ?? [];
  }

  return {
    paths,
    status: () => ({ ...status }),
    /** A ready client, starting the service if needed. Concurrent callers share one start. */
    async client() {
      if (client && status.state === 'ready') return client;
      if (!starting) {
        const gen = ++generation;
        const p = start(gen).catch(e => {
          if (gen === generation) { set({ state: 'error', error: e.message, hint: hintFor(e) }); client = null; }
          throw e;
        }).finally(() => { if (starting === p) starting = null; });
        starting = p;
      }
      return starting;
    },
    /** Called when a request to the service fails: the next call rediscovers or restarts it. */
    lost(e) { if (/fetch failed|ECONNREFUSED|socket|terminated/i.test(String(e?.message ?? e))) { generation++; client = null; starting = null; set({ state: 'stopped', error: 'The OpenCode service stopped; it restarts with the next request.' }); } },
    async models({ refresh = false } = {}) {
      const c = await this.client();
      if (refresh || !models) { const r = await c.model.list({ location: { directory: base } }); models = Array.isArray(r) ? r : r?.data ?? []; }
      return models;
    },
    catalog: () => waitForCatalog(),
    async stop() {
      const { svc } = await libs();
      generation++; client = null; starting = null;
      await svc.stop({ file: paths.registration });
      set({ state: 'stopped', catalog: 'unknown', pid: undefined });
    },
  };
}

function hintFor(e) {
  const m = String(e?.message ?? e);
  if (/ENOENT|spawn/i.test(m)) return 'The OpenCode binary is missing. Run `npm install` in the ClearFrame folder (it installs @opencode/cli 2.0.24 for this platform).';
  if (/EADDRINUSE|address in use/i.test(m)) return 'OpenCode could not bind a local port. Stop other OpenCode services or restart the computer\'s network stack, then retry.';
  if (/did not start/i.test(m)) return 'Run `clearframe agent doctor` to see the runtime folders and the service log.';
  return 'Run `clearframe agent doctor` for details, then retry.';
}
