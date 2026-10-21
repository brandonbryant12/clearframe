import {
  agentPaths,
  DEFAULT_MODEL,
  OPENCODE_VERSION,
  PLUGIN_ENTRY,
  PLUGIN_TOOLS_ENTRY,
  INSTRUCTIONS,
  modelKey,
  runtimeConfig,
  opencodeBinary,
  type RuntimeOptions,
  type RuntimeStatus,
} from './runtime-config.mjs';
export {
  agentPaths,
  DEFAULT_MODEL,
  OPENCODE_VERSION,
  PLUGIN_DIR,
  INSTRUCTIONS,
  PERMISSIONS,
  parseModel,
  isFree,
  runtimeConfig,
  opencodeBinary,
  type RuntimeOptions,
  type RuntimeStatus,
  type ModelRef,
} from './runtime-config.mjs';
const stampSchema = Schema.Struct({ stamp: Schema.String });
// The OpenCode runtime ClearFrame owns: one local background service (OpenCode 2.1.0, from this
// package's node_modules), isolated from any global OpenCode install by its own XDG data, state,
// cache and config folders under the studio state directory. Its endpoint and password stay in
// this process; the browser only ever sees a status. See docs/agent-studio.md.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { OpenCodeClient, ModelInfo } from '@opencode/client';
import type { Endpoint } from '@opencode/client/service';
import * as Effect from 'effect/Effect';
import * as Data from 'effect/Data';
import * as Schema from 'effect/Schema';
import { errorMessage } from '../harness/contracts.mjs';
/**
 * Own the service: write its config, ensure it is running (once, however many callers), restart
 * it when the config ClearFrame writes has changed, and wait for the model catalog to load.
 * `service` and `client` are injectable for tests.
 */
export function createRuntime({
  base = process.cwd(),
  model = DEFAULT_MODEL,
  service,
  client: makeClient,
  catalogTimeout = 45000,
}: RuntimeOptions = {}) {
  const paths = agentPaths(base);
  let status: RuntimeStatus = {
    state: 'stopped',
    version: OPENCODE_VERSION,
    catalog: 'unknown',
    model: modelKey(model),
    error: null,
    hint: null,
  };
  // A generation per start/stop: a start that finishes after a stop (or after a newer start) cannot
  // overwrite the newer state. Service.ensure itself is shared, so a slow start that times out is
  // awaited again by the retry instead of spawning a second service.
  let starting: Promise<OpenCodeClient> | null = null,
    client: OpenCodeClient | null = null,
    models: ModelInfo[] | null = null,
    generation = 0,
    ensuring: Promise<Endpoint> | null = null,
    stale = false;
  const set = (patch: Partial<RuntimeStatus>) => {
    status = { ...status, ...patch };
  };

  async function libs() {
    const svc = service ?? (await import('@opencode/client/service')).Service;
    const make = makeClient ?? (await import('@opencode/client')).OpenCode.make;
    return { svc, make };
  }
  function writeConfig() {
    for (const d of [paths.config, paths.agent, ...Object.values(paths.env)])
      fs.mkdirSync(d, { recursive: true });
    const config =
      JSON.stringify(runtimeConfig(paths, { model }), null, 2) + '\n';
    const file = path.join(paths.config, 'opencode.json');
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== config)
      fs.writeFileSync(file, config);
    // Plugin and instructions are part of what the running service loaded.
    const stamp = crypto
      .createHash('sha256')
      .update(config)
      .update(fs.readFileSync(PLUGIN_ENTRY))
      .update(fs.readFileSync(PLUGIN_TOOLS_ENTRY))
      .update(fs.readFileSync(INSTRUCTIONS))
      .digest('hex');
    return stamp;
  }
  const readStamp = () => {
    try {
      return Schema.decodeUnknownSync(stampSchema)(
        JSON.parse(fs.readFileSync(paths.runtime, 'utf8')),
      ).stamp;
    } catch {
      return null;
    }
  };

  async function start(gen: number): Promise<OpenCodeClient> {
    const { svc, make } = await libs();
    set({ state: 'starting', error: null, hint: null });
    const stamp = writeConfig();
    const running =
      !ensuring && readStamp() !== stamp
        ? await svc.discover({ file: paths.registration }).catch(() => null)
        : null;
    if (running) {
      // ClearFrame changed the plugin, instructions or permissions: restart so they apply, but never
      // in the middle of a reply (that would stop someone's work); then they apply after the next stop.
      const busy = await make({
        baseUrl: running.url,
        headers: svc.headers(running),
      })
        .session.active()
        .then(
          (a) => Object.keys(a ?? {}).length > 0,
          () => false,
        );
      if (!busy) await svc.stop({ file: paths.registration }).catch(() => {});
      else stale = true;
    }
    ensuring ??= svc
      .ensure({
        file: paths.registration,
        version: OPENCODE_VERSION,
        command: [opencodeBinary(), 'serve', '--service', '--port', '0'],
        env: paths.env,
      })
      .finally(() => {
        ensuring = null;
      });
    const ensure = ensuring;
    let timer: NodeJS.Timeout | undefined;
    const ep = await Promise.race([
      ensure,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error('OpenCode did not start within 40 seconds.')),
          40000,
        );
      }),
    ]).finally(() => clearTimeout(timer));
    if (gen !== generation) throw new Error('superseded');
    if (!stale)
      fs.writeFileSync(
        paths.runtime,
        JSON.stringify({
          stamp,
          version: OPENCODE_VERSION,
          startedAt: new Date().toISOString(),
        }),
      );
    const c = make({ baseUrl: ep.url, headers: svc.headers(ep) });
    const info = await c.server.info();
    if (gen !== generation) throw new Error('superseded');
    client = c;
    set({
      state: 'ready',
      version: info.version,
      pid: info.pid,
      catalog: 'loading',
      hint: stale
        ? "ClearFrame's agent tools changed while a reply was running; they apply after `clearframe agent stop` (or the next start when no reply is running)."
        : null,
    });
    waitForCatalog(gen).catch(() => {});
    return client;
  }
  /** The catalog loads asynchronously after start: an early empty list is not an error. */
  async function waitForCatalog(gen = generation): Promise<ModelInfo[]> {
    const until = Date.now() + catalogTimeout;
    while (Date.now() < until) {
      if (gen !== generation || !client) return models ?? [];
      try {
        const r = await client.model.list({ location: { directory: base } });
        const list: ModelInfo[] = Array.isArray(r) ? r : (r.data ?? []);
        if (
          list.some(
            (m) => m.providerID === model.providerID && m.id === model.id,
          )
        ) {
          models = list;
          set({ catalog: 'ready' });
          return list;
        }
        if (list.length) models = list;
      } catch {}
      await new Promise((r) => setTimeout(r, 750));
    }
    set({
      catalog: models?.length ? 'missing-model' : 'empty',
      hint: models?.length
        ? `The model ${modelKey(model)} is not in this runtime's catalog. Choose another model, or connect its provider.`
        : 'OpenCode has not loaded its model catalog. It downloads it on first start: check this computer can reach opencode.ai, then retry.',
    });
    return models ?? [];
  }

  return {
    paths,
    status: () => ({ ...status }),
    /** A ready client, starting the service if needed. Concurrent callers share one start. */
    async client(): Promise<OpenCodeClient> {
      if (client && status.state === 'ready') return client;
      if (!starting) {
        const gen = ++generation;
        const p = start(gen)
          .catch((e) => {
            if (gen === generation) {
              set({ state: 'error', error: errorMessage(e), hint: hintFor(e) });
              client = null;
            }
            throw e;
          })
          .finally(() => {
            if (starting === p) starting = null;
          });
        starting = p;
      }
      return starting;
    },
    /** Called when a request to the service fails: the next call rediscovers or restarts it. */
    lost(e: unknown) {
      if (
        /fetch failed|ECONNREFUSED|socket|terminated/i.test(errorMessage(e))
      ) {
        generation++;
        client = null;
        starting = null;
        set({
          state: 'stopped',
          error:
            'The OpenCode service stopped; it restarts with the next request.',
        });
      }
    },
    async models({ refresh = false }: { refresh?: boolean } = {}): Promise<
      ModelInfo[]
    > {
      const c = await this.client();
      if (refresh || !models) {
        const r = await c.model.list({ location: { directory: base } });
        models = Array.isArray(r) ? r : (r.data ?? []);
      }
      return models ?? [];
    },
    catalog: () => waitForCatalog(),
    async stop() {
      const { svc } = await libs();
      generation++;
      client = null;
      starting = null;
      await svc.stop({ file: paths.registration });
      set({ state: 'stopped', catalog: 'unknown', pid: undefined });
    },
  };
}

function hintFor(e: unknown) {
  const m = errorMessage(e);
  if (/ENOENT|spawn/i.test(m))
    return 'The OpenCode binary is missing. Run `npm install` in the ClearFrame folder (it installs @opencode/cli 2.1.0 for this platform).';
  if (/EADDRINUSE|address in use/i.test(m))
    return "OpenCode could not bind a local port. Stop other OpenCode services or restart the computer's network stack, then retry.";
  if (/did not start/i.test(m))
    return 'Run `clearframe agent doctor` to see the runtime folders and the service log.';
  return 'Run `clearframe agent doctor` for details, then retry.';
}

export type AgentRuntime = ReturnType<typeof createRuntime>;
export class AgentRuntimeError extends Data.TaggedError('AgentRuntimeError')<{
  operation: string;
  message: string;
  cause: unknown;
}> {}
/** Runtime lifetime and provider failures can be composed without executing a Promise at call sites. */
export interface AgentRuntimeEffects {
  client: Effect.Effect<OpenCodeClient, AgentRuntimeError>;
  models: (refresh?: boolean) => Effect.Effect<ModelInfo[], AgentRuntimeError>;
  stop: Effect.Effect<void, AgentRuntimeError>;
}
export const agentRuntimeEffects = (
  runtime: AgentRuntime,
): AgentRuntimeEffects => {
  const attempt = <A,>(operation: string, body: () => Promise<A>) =>
    Effect.tryPromise({
      try: body,
      catch: (cause) =>
        new AgentRuntimeError({
          operation,
          message: errorMessage(cause),
          cause,
        }),
    });
  return {
    client: attempt('client', () => runtime.client()),
    models: (refresh = false) =>
      attempt('models', () => runtime.models({ refresh })),
    stop: attempt('stop', () => runtime.stop()),
  };
};
export const agentRuntime = (options: RuntimeOptions = {}) =>
  Effect.acquireRelease(
    Effect.sync(() => createRuntime(options)),
    (runtime) => Effect.orDie(agentRuntimeEffects(runtime).stop),
  );
