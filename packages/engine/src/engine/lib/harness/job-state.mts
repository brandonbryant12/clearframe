import fs from 'node:fs';
import path from 'node:path';
import {
  errorMessage,
  HarnessRequestError,
  hydrateJob,
  type HarnessJob,
  type JobView,
} from './contracts.mjs';
import { openJobStore } from './job-store.mjs';
import { inputPrint, KINDS } from './job-inputs.mjs';
const KEEP_FILES = 60,
  KEEP_BYTES = 400e6;
export function createHarnessState(
  base: string,
  out: string,
  keepJobs: number,
) {
  base = fs.realpathSync(base);
  out = path.resolve(out);
  const jobs = new Map<string, HarnessJob>(),
    queue: HarnessJob[] = [];
  const state: {
    running: HarnessJob | null;
    stopped: boolean;
    closing: Promise<void> | null;
    storageError: Error | null;
  } = { running: null, stopped: false, closing: null, storageError: null };
  const store = path.join(out, 'studio');
  const ledger = openJobStore({
    file: path.join(store, '.harness/jobs.sqlite'),
    legacyFile: path.join(store, 'jobs.json'),
    keepJobs,
  });
  const view = ({
    dir: _dir,
    child: _child,
    killTimer: _killTimer,
    settled: _settled,
    ...j
  }: HarnessJob): JobView => j;
  const freshView = (
    j: HarnessJob,
    prints = new Map<string, string | null>(),
  ) => {
    const result = view(j);
    if (KINDS[j.kind]?.cache && j.status === 'complete') {
      if (j.dir && !prints.has(j.dir)) prints.set(j.dir, inputPrint(j.dir));
      result.matches = !!(
        j.matches &&
        j.print &&
        prints.get(j.dir) === j.print &&
        fs.existsSync(j.output ?? '')
      );
    }
    return result;
  };
  const healthy = () => {
    if (state.storageError) throw state.storageError;
    if (state.stopped)
      throw new HarnessRequestError({
        reason: 'unavailable',
        message: 'The job harness is stopped.',
        status: 503,
      });
  };
  const persist = () => {
    try {
      ledger.saveAll(
        [...jobs.values()].map((j) => ({ ...view(j), dir: j.dir })),
      );
    } catch (e) {
      state.storageError = e instanceof Error ? e : new Error(errorMessage(e));
      throw state.storageError;
    }
  };
  try {
    for (const j of ledger.list()) jobs.set(j.id, hydrateJob(j));
  } catch (error) {
    ledger.close();
    throw error;
  }
  // key → job. A key names the project, its input print and the request, so identical storyboards in
  // two films never share a preview. Only results whose inputs held still are entered.
  const cache = new Map(
    [...jobs.values()]
      .filter(
        (j) =>
          j.status === 'complete' &&
          j.cached &&
          j.key &&
          j.output &&
          fs.existsSync(j.output ?? ''),
      )
      .map((j) => [j.key, j]),
  );
  const uncache = (id: string) => {
    for (const [k, x] of cache) if (x.id === id) cache.delete(k);
  };
  /** Forget the oldest finished jobs past the limit, and any cache entry that points at them. */
  function evict() {
    while (
      [...jobs.values()].filter(
        (x) => !['queued', 'waiting', 'running'].includes(x.status),
      ).length > keepJobs
    ) {
      const old = [...jobs.values()].find(
        (x) => !['queued', 'waiting', 'running'].includes(x.status),
      );
      if (!old) break;
      jobs.delete(old.id);
      uncache(old.id);
    }
  }
  /** A cached result that is still listed (so the UI can find it) and still on disk. */
  function cached(key: string | null | undefined) {
    const hit = key && cache.get(key);
    if (!hit) return null;
    if (jobs.get(hit.id) !== hit || !fs.existsSync(hit.output ?? '')) {
      cache.delete(key);
      return null;
    }
    return hit;
  }

  function prune() {
    for (const sub of ['stills', 'sections']) {
      const dir = path.join(store, sub);
      if (!fs.existsSync(dir)) continue;
      const files = fs
        .readdirSync(dir)
        .map((f) => path.join(dir, f))
        .map((f) => ({ f, s: fs.statSync(f) }))
        .sort((a, b) => b.s.mtimeMs - a.s.mtimeMs);
      let bytes = 0;
      files.forEach(({ f, s }, i) => {
        bytes += s.size;
        if (i >= KEEP_FILES || bytes > KEEP_BYTES) {
          fs.rmSync(f, { force: true });
          for (const [k, j] of cache) if (j.output === f) cache.delete(k);
        }
      });
    }
  }

  return {
    base,
    out,
    jobs,
    queue,
    state,
    store,
    ledger,
    view,
    freshView,
    healthy,
    persist,
    cache,
    evict,
    cached,
    prune,
  };
}
export type HarnessContext = ReturnType<typeof createHarnessState>;
