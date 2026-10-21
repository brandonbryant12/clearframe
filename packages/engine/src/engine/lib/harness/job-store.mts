import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import * as Effect from 'effect/Effect';
import type { JobRecord, EventOptions, StoreOptions } from './contracts.mjs';
import {
  SCHEMA_VERSION,
  ACTIVE,
  fail,
  asError,
  validJob,
  MIGRATIONS,
  transaction,
  now,
  sqlite,
  sqlText,
  writeJob,
  claim,
} from './job-store-db.mjs';
export { SCHEMA_VERSION, ACTIVE, JobStoreError } from './job-store-db.mjs';
export { JobSchema } from './job-schema.mjs';
const open = ({ file, legacyFile, keepJobs = 60 }: StoreOptions) => {
  if (!file) throw fail('options', 'a ledger file is required.');
  if (!(Number.isInteger(keepJobs) && keepJobs >= 0))
    throw fail('options', 'keepJobs must be a whole number.');
  const parent = path.dirname(file);
  const made = fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (made) fs.chmodSync(parent, 0o700);
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout = 3000;');
    const version = Number(
      db.prepare('PRAGMA user_version').get()?.user_version,
    );
    if (!Number.isSafeInteger(version) || version < 0)
      throw fail('sqlite', 'Invalid schema version.');
    if (version > SCHEMA_VERSION)
      throw fail(
        'future-schema',
        `${file} is schema version ${version}, newer than this ClearFrame (${SCHEMA_VERSION}). Update ClearFrame; the ledger was left untouched.`,
      );
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (let v = version; v < SCHEMA_VERSION; v++)
      transaction(db, () => {
        const migration = MIGRATIONS[v];
        if (!migration) throw fail('sqlite', 'Missing schema migration.');
        db.exec(migration);
        db.exec(`PRAGMA user_version = ${v + 1}`);
      });
    const s = sqlite(db);
    const token = crypto.randomUUID();
    claim(db, s, { legacyFile, token });
    return { db, s, token, keepJobs, file };
  } catch (e) {
    try {
      db.close();
    } catch {
      /* closing a failed open is best effort */
    }
    throw e;
  }
};

const makeStore = (state: ReturnType<typeof open>) => {
  let closed = false;
  const { db, s, token, keepJobs } = state;
  const usable = () => {
    if (closed) throw fail('closed', 'the ledger is closed.');
  };
  const owned = () => {
    if (s.get('owner_token') !== token)
      throw fail(
        'not-owner',
        'this studio no longer owns the ledger; restart it.',
      );
  };
  const recent = db.prepare(`SELECT data FROM jobs WHERE seq IN (
    SELECT seq FROM jobs WHERE status IN (${ACTIVE.map(() => '?').join(', ')})
    UNION ALL
    SELECT seq FROM (SELECT seq FROM jobs WHERE status NOT IN (${ACTIVE.map(() => '?').join(', ')}) ORDER BY created_at DESC, seq DESC LIMIT ?)
  ) ORDER BY created_at, seq`);
  const byKey = db.prepare(
    'SELECT data FROM jobs WHERE dir = ? AND request_key = ?',
  );
  const byId = db.prepare('SELECT data FROM jobs WHERE id = ?');
  const eventRows = db.prepare(
    'SELECT seq, job_id, type, at, data FROM events WHERE seq > ? AND (? IS NULL OR job_id = ?) ORDER BY seq LIMIT ?',
  );

  const op =
    <Args extends readonly unknown[], A>(
      reason: string,
      fn: (...args: Args) => A,
    ) =>
    (...args: Args) =>
      Effect.try({
        try: () => {
          usable();
          return fn(...args);
        },
        catch: (e) => asError(reason, e),
      });
  const effect = {
    list: op('sqlite', () =>
      recent
        .all(...ACTIVE, ...ACTIVE, keepJobs)
        .map((r) => validJob(JSON.parse(sqlText(r.data)), 'stored job')),
    ),
    get: op('sqlite', (id: string) => {
      const row = byId.get(String(id));
      return row ? validJob(JSON.parse(sqlText(row.data)), 'stored job') : null;
    }),
    saveAll: op('sqlite', (jobs: readonly JobRecord[]) => {
      if (!Array.isArray(jobs))
        throw fail('invalid-job', 'saveAll takes an array of jobs.');
      return transaction(db, () => {
        owned();
        const at = now();
        const events = jobs.flatMap((j, i) =>
          writeJob(s, validJob(j, `job ${i}`), at),
        );
        return { saved: jobs.length, events };
      });
    }),
    findByKey: op('sqlite', (dir: string, requestKey: string) => {
      const row = byKey.get(String(dir), String(requestKey));
      return row ? validJob(JSON.parse(sqlText(row.data)), 'stored job') : null;
    }),
    events: op(
      'sqlite',
      ({ after = 0, jobId, limit = 200 }: EventOptions = {}) => {
        if (
          !Number.isSafeInteger(after) ||
          after < 0 ||
          !Number.isSafeInteger(limit) ||
          limit < 0
        )
          throw fail(
            'options',
            'event cursor and limit must be nonnegative whole numbers.',
          );
        return eventRows
          .all(after, jobId ?? null, jobId ?? null, Math.min(limit, 10000))
          .map((r) => ({
            seq: Number(r.seq),
            jobId: sqlText(r.job_id),
            type: sqlText(r.type),
            at: sqlText(r.at),
            data: JSON.parse(sqlText(r.data)),
          }));
      },
    ),
    close: () =>
      Effect.try({
        try: () => {
          if (closed) return;
          closed = true;
          try {
            transaction(db, () => {
              if (s.get('owner_token') !== token) return;
              for (const key of ['owner_token', 'owner_pid', 'owner_since'])
                s.delMeta.run(key);
            });
          } finally {
            db.close();
          }
        },
        catch: (e) => asError('sqlite', e),
      }),
  };
  return {
    file: state.file,
    effect,
    list: () => Effect.runSync(effect.list()),
    get: (id: string) => Effect.runSync(effect.get(id)),
    saveAll: (jobs: readonly JobRecord[]) =>
      Effect.runSync(effect.saveAll(jobs)),
    findByKey: (dir: string, requestKey: string) =>
      Effect.runSync(effect.findByKey(dir, requestKey)),
    events: (options?: EventOptions) => Effect.runSync(effect.events(options)),
    close: () => Effect.runSync(effect.close()),
  };
};

// Effect form: fails with a JobStoreError; the store's `effect` holds the same operations as Effects.
export const openJobStoreEffect = (options: StoreOptions) =>
  Effect.try({
    try: () => {
      const state = open(options);
      try {
        return makeStore(state);
      } catch (error) {
        try {
          transaction(state.db, () => {
            if (state.s.get('owner_token') === state.token)
              for (const key of ['owner_token', 'owner_pid', 'owner_since'])
                state.s.delMeta.run(key);
          });
        } finally {
          state.db.close();
        }
        throw error;
      }
    },
    catch: (e) => asError('sqlite', e),
  });

// Synchronous form for the studio server: throws the JobStoreError.
export const openJobStore = (options: StoreOptions) =>
  Effect.runSync(openJobStoreEffect(options));

export type JobStore = ReturnType<typeof openJobStore>;
/** Scope ownership includes the SQLite connection and durable owner record. */
export const jobStore = (options: StoreOptions) =>
  Effect.acquireRelease(openJobStoreEffect(options), (store) =>
    Effect.orDie(store.effect.close()),
  );
