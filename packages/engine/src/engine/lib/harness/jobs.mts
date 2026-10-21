import { createHarnessState } from './job-state.mjs';
import { createJobRunner } from './job-runner.mjs';
// Studio jobs: native stills, section previews, rough cuts, checks, exports and review verbs,
// run as CLI children one at a time behind the heavy gate. Cancellable. A job's inputs are pinned
// when it starts (not when it was queued); a preview is cached only for its project and the exact
// inputs it read, and a result whose inputs changed at any point while it ran is never cached or
// labelled current.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import * as Effect from 'effect/Effect';
import * as Data from 'effect/Data';
import {
  errorMessage,
  hydrateJob,
  type HarnessJob,
  type JobRequest,
  type SoundGrant,
  type EventOptions,
} from './contracts.mjs';
import { fileURLToPath } from 'node:url';

import { signalChild, KINDS } from './job-inputs.mjs';

import { prepareJob, requestIdentity } from './job-requests.mjs';

export { SOUND_GRANT } from './contracts.mjs';
export { inputPrint, probeMedia } from './job-inputs.mjs';
const CLI = fileURLToPath(
  new URL(
    import.meta.url.endsWith('.mts') ? '../../cli.mts' : '../../cli.mjs',
    import.meta.url,
  ),
);
const GATE = path.join(os.homedir(), '.local/bin/codex-heavy');
const KEEP_JOBS = 60;
/** `cli` and `gate` default to the real CLI and the heavy-work gate; tests pass a stand-in CLI and gate: null. */
export interface HarnessOptions {
  base?: string;
  out?: string;
  onDone?: (job: HarnessJob) => void | Promise<void>;
  cli?: string;
  gate?: string | null;
  keepJobs?: number;
}
export type { SoundGrant } from './contracts.mjs';
export function createJobHarness({
  base = process.cwd(),
  out = path.join(base, 'build/viewer'),
  onDone = async () => {},
  cli = CLI,
  gate = GATE,
  keepJobs = KEEP_JOBS,
}: HarnessOptions = {}) {
  const context = createHarnessState(base, out, keepJobs);
  const {
    jobs,
    queue,
    state,
    store,
    ledger,
    view,
    freshView,
    healthy,
    persist,
    evict,
    cached,
  } = context;
  const next = createJobRunner(context, { cli, gate, onDone });

  return {
    /** The job that pauses source edits on this film, if any (queued ones count: their input is the source as it will be). */
    pausing: (dir: string) => {
      const project = fs.realpathSync(dir);
      return (
        [state.running, ...queue].find(
          (j) => j && j.dir === project && KINDS[j.kind].edits === false,
        ) ?? null
      );
    },
    events: (options?: EventOptions) => ledger.events(options),
    get(id: string) {
      if (state.storageError) throw state.storageError;
      const j = jobs.get(id) ?? ledger.get(id);
      return j ? freshView(hydrateJob(j)) : null;
    },
    health: () => {
      const status = state.stopped ? 'stopped' : 'ready';
      return {
        state: state.storageError ? 'failed' : status,
        error: state.storageError ? errorMessage(state.storageError) : null,
      };
    },
    list(film?: string) {
      if (state.storageError) throw state.storageError;
      const prints = new Map();
      return [...jobs.values()]
        .filter((j) => !film || j.film === film)
        .map((j) => freshView(j, prints));
    },
    start(dir: string, body: JobRequest, grant: SoundGrant | null = null) {
      healthy();
      dir = fs.realpathSync(dir);
      const { requestKey, requestFingerprint } = requestIdentity(body, grant);
      if (requestKey != null) {
        if (
          typeof requestKey !== 'string' ||
          !/^[\w:.-]{1,160}$/.test(requestKey)
        )
          throw new Error(
            'Use a request key of 1–160 letters, numbers, dots, colons, underscores or hyphens.',
          );
        const old = ledger.findByKey(dir, requestKey);
        if (old) {
          if (old.requestFingerprint !== requestFingerprint)
            throw Object.assign(
              new Error('That request key belongs to a different job request.'),
              { status: 409 },
            );
          return {
            id: old.id,
            duplicate: true,
            job: freshView(jobs.get(old.id) ?? hydrateJob(old)),
          };
        }
      }
      const j = prepareJob(dir, body, grant, store),
        id = j.id;
      if (requestKey != null) {
        j.requestKey = requestKey;
        j.requestFingerprint = requestFingerprint;
      }
      const hit = !requestKey && cached(j.key);
      if (hit) return { id: hit.id, cached: true };
      // The same request for the same project and inputs, still queued: follow it rather than queue a
      // twin. (A running one may already be reading inputs that have since changed: queue anew.)
      const twin = !requestKey && j.key && queue.find((x) => x.key === j.key);
      if (twin) return { id: twin.id };
      if (j.output) fs.mkdirSync(path.dirname(j.output), { recursive: true });
      jobs.set(id, j);
      queue.push(j);
      evict();
      try {
        persist();
      } catch (e) {
        jobs.delete(id);
        queue.splice(queue.indexOf(j), 1);
        throw e;
      }
      next();
      return { id };
    },
    cancel(id: string) {
      if (state.stopped) throw new Error('The job harness is stopped.');
      const j = jobs.get(id);
      if (!j) throw new Error('No such job.');
      const q = queue.indexOf(j);
      const cancellation = () => {
        try {
          persist();
          return view(j);
        } catch (error) {
          return { ...view(j), persistenceError: errorMessage(error) };
        }
      };
      if (q >= 0) {
        queue.splice(q, 1);
        j.status = 'cancelled';
        j.finishedAt = new Date().toISOString();
        return cancellation();
      }
      if (!j.child || !['running', 'waiting'].includes(j.status))
        throw new Error('That job is not running.');
      j.cancelled = true;
      const result = cancellation();
      signalChild(j.child, 'SIGTERM');
      j.killTimer = setTimeout(() => {
        if (j.workerPid)
          try {
            process.kill(-j.workerPid, 'SIGKILL');
          } catch {}
        if (
          j.child?.pid != null &&
          Number.isSafeInteger(j.child.pid) &&
          j.child.pid > 0
        )
          try {
            process.kill(-j.child.pid, 'SIGKILL');
          } catch {}
      }, 9000);
      return result;
    },
    /** Commit interruption before stopping children; keep the owner until all children settle. */
    stopAll() {
      if (state.closing) return state.closing;
      state.stopped = true;
      const active = [...jobs.values()].filter((j) => j.child);
      const changed = queue.length || active.length;
      for (const j of queue.splice(0)) {
        j.status = 'interrupted';
        j.finishedAt = new Date().toISOString();
      }
      for (const j of active)
        if (['running', 'waiting'].includes(j.status)) j.cancelled = true;
      let failure: unknown;
      if (changed)
        try {
          persist();
        } catch (e) {
          failure = e;
        }
      for (const j of active) {
        if (j.child?.exitCode == null && j.child?.signalCode == null)
          signalChild(j.child, 'SIGTERM');
      }
      state.closing = Promise.all(active.map((j) => j.settled)).then(() => {
        ledger.close();
        if (failure) throw failure;
      });
      return state.closing;
    },
  };
}
export type JobHarness = ReturnType<typeof createJobHarness>;
export class HarnessError extends Data.TaggedError('HarnessError')<{
  operation: string;
  message: string;
  cause: unknown;
}> {}
/** Effect-native operations preserve cancellation and the durable ledger's ownership scope. */
export const harnessEffects = (harness: JobHarness) => {
  const attempt = <A,>(operation: string, body: () => A) =>
    Effect.try({
      try: body,
      catch: (cause) =>
        new HarnessError({ operation, message: errorMessage(cause), cause }),
    });
  return {
    list: (film?: string) => attempt('list', () => harness.list(film)),
    get: (id: string) => attempt('get', () => harness.get(id)),
    start: (dir: string, request: JobRequest, grant?: SoundGrant) =>
      attempt('start', () => harness.start(dir, request, grant)),
    cancel: (id: string) => attempt('cancel', () => harness.cancel(id)),
    events: (options?: EventOptions) =>
      attempt('events', () => harness.events(options)),
    stop: Effect.tryPromise({
      try: () => harness.stopAll(),
      catch: (cause) =>
        new HarnessError({
          operation: 'stop',
          message: errorMessage(cause),
          cause,
        }),
    }),
  };
};
