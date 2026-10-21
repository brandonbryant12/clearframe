// The studio's durable job ledger: one SQLite file (normally out/studio/.harness/jobs.sqlite) that
// outlives the server. Every job ever queued stays in it; `list` shows the active ones plus the
// latest terminal history. Each save writes the rows and their transition events in one
// transaction. One process owns the ledger at a time; a stale owner's unfinished jobs come back as
// interrupted, never replayed, and the store refuses to start while a job's child may still be
// alive. The store never starts or kills processes and never touches files beside its own.
import fs from 'node:fs';
import path from 'node:path';

import type { DatabaseSync, SQLInputValue } from 'node:sqlite';
import { JobSchema } from './job-schema.mjs';
import * as Data from 'effect/Data';

import * as Schema from 'effect/Schema';
import {
  errorCode,
  errorMessage,
  isRecord,
  type JobRecord,
  type JobEvent,
} from './contracts.mjs';

export const SCHEMA_VERSION = 1;
export const ACTIVE: readonly string[] = ['queued', 'waiting', 'running'];

export class JobStoreError extends Data.TaggedError('JobStoreError')<{
  reason: string;
  message: string;
  cause?: unknown;
}> {}

export const fail = (reason: string, message: string, cause?: unknown) =>
  new JobStoreError({
    reason,
    message: `Job store: ${message}`,
    ...(cause ? { cause } : {}),
  });
export const asError = (reason: string, e: unknown) =>
  e instanceof JobStoreError ? e : fail(reason, errorMessage(e), e);

export { JobSchema } from './job-schema.mjs';
const decodeJob = Schema.decodeUnknownSync(JobSchema);
export const validJob = (job: unknown, where: string): JobRecord => {
  if (!isRecord(job))
    throw fail('invalid-job', `${where}: a job must be an object.`);
  let decoded: Schema.Schema.Type<typeof JobSchema>;
  try {
    decoded = decodeJob(job);
  } catch (e) {
    throw fail(
      'invalid-job',
      `${where} (${job.id ?? 'no id'}): ${errorMessage(e).replace(/\s*\n\s*/g, ' ')}`,
      e,
    );
  }
  if (decoded.childPid != null && decoded.childPid <= 0)
    throw fail('invalid-job', `${where}: childPid must be positive.`);
  if (decoded.workerPid != null && decoded.workerPid <= 0)
    throw fail('invalid-job', `${where}: workerPid must be positive.`);
  return decoded;
};

export const MIGRATIONS = [
  `CREATE TABLE jobs (
     seq INTEGER PRIMARY KEY AUTOINCREMENT,
     id TEXT NOT NULL UNIQUE,
     dir TEXT NOT NULL,
     kind TEXT NOT NULL,
     status TEXT NOT NULL,
     cancelled INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     request_key TEXT,
     data TEXT NOT NULL,
     UNIQUE (dir, request_key)
   );
   CREATE INDEX jobs_status ON jobs (status, created_at);
   CREATE TABLE events (
     seq INTEGER PRIMARY KEY AUTOINCREMENT,
     job_id TEXT NOT NULL REFERENCES jobs (id),
     type TEXT NOT NULL,
     at TEXT NOT NULL,
     data TEXT NOT NULL
   );
   CREATE INDEX events_job ON events (job_id, seq);
   CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);`,
];

// Signal 0 checks existence only; EPERM means it exists under another user.
const exists = (pid: number | null | undefined) => {
  if (typeof pid !== 'number' || !Number.isInteger(pid) || pid === 0)
    return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return errorCode(e) === 'EPERM';
  }
};

// BEGIN IMMEDIATE takes the write lock up front; the result is returned only after COMMIT.
export const transaction = <A,>(db: DatabaseSync, fn: () => A): A => {
  db.exec('BEGIN IMMEDIATE');
  let result;
  try {
    result = fn();
    db.exec('COMMIT');
  } catch (e) {
    try {
      db.exec('ROLLBACK');
    } catch {
      /* already rolled back by SQLite */
    }
    throw e;
  }
  return result;
};

export const now = () => new Date().toISOString();

export const sqlite = (db: DatabaseSync) => {
  const s = {
    meta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare(
      'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
    ),
    delMeta: db.prepare('DELETE FROM meta WHERE key = ?'),
    job: db.prepare(
      'SELECT status, cancelled, dir, request_key FROM jobs WHERE id = ?',
    ),
    byKey: db.prepare('SELECT id FROM jobs WHERE dir = ? AND request_key = ?'),
    insert: db.prepare(
      'INSERT INTO jobs (id, dir, kind, status, cancelled, created_at, request_key, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    ),
    update: db.prepare(
      'UPDATE jobs SET dir = ?, kind = ?, status = ?, cancelled = ?, created_at = ?, request_key = ?, data = ? WHERE id = ?',
    ),
    event: db.prepare(
      'INSERT INTO events (job_id, type, at, data) VALUES (?, ?, ?, ?) RETURNING seq',
    ),
    active: db.prepare(
      `SELECT data FROM jobs WHERE status IN (${ACTIVE.map(() => '?').join(', ')}) ORDER BY seq`,
    ),
  };
  return { ...s, get: (key: string) => s.meta.get(key)?.value };
};
type Statements = ReturnType<typeof sqlite>;
export const sqlText = (value: unknown): string => {
  if (typeof value !== 'string')
    throw fail('sqlite', 'Expected text in ledger row.');
  return value;
};

export const writeJob = (
  s: Statements,
  job: JobRecord,
  at: string,
  created?: string,
): JobEvent[] => {
  const prior = s.job.get(job.id);
  const key = job.requestKey ?? null;
  if (key != null) {
    const holder = s.byKey.get(job.dir, key);
    if (holder && holder.id !== job.id)
      throw fail(
        'duplicate-key',
        `request ${key} in ${job.dir} already belongs to job ${holder.id}.`,
      );
  }
  const cancelled = job.cancelled === true ? 1 : 0;
  const row: SQLInputValue[] = [
    job.dir,
    job.kind,
    job.status,
    cancelled,
    job.createdAt,
    key,
    JSON.stringify(job),
  ];
  const events: JobEvent[] = [];
  const add = (type: string, data: unknown) => {
    const row = s.event.get(job.id, type, at, JSON.stringify(data));
    if (!row) throw fail('sqlite', 'Event insertion returned no sequence.');
    const { seq } = row;
    events.push({ seq: Number(seq), jobId: job.id, type, at, data });
  };
  if (!prior) {
    s.insert.run(job.id, ...row);
    add(created ?? 'created', {
      status: job.status,
      cancelled: cancelled === 1,
    });
  } else {
    s.update.run(...row, job.id);
    if (prior.status !== job.status || prior.cancelled !== cancelled)
      add('transition', {
        from: { status: prior.status, cancelled: prior.cancelled === 1 },
        to: { status: job.status, cancelled: cancelled === 1 },
      });
  }
  return events;
};

// An unfinished job from a run that ended without finishing it. Paid work may or may not have
// been billed or written, so its outcome is unknown; it is never replayed.
const interrupt = (job: JobRecord, at: string, reason: string): JobRecord => ({
  ...job,
  status: 'interrupted',
  interruptedAt: at,
  recovery: {
    at,
    reason,
    from: job.status,
    ...(job.paid ? { outcome: 'unknown' } : {}),
  },
});

const readLegacy = (file: string): JobRecord[] => {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (errorCode(e) === 'ENOENT') return [];
    throw fail('legacy', `cannot read ${file}: ${errorMessage(e)}`, e);
  }
  let jobs;
  try {
    jobs = JSON.parse(text);
  } catch (e) {
    throw fail(
      'legacy',
      `${file} is not valid JSON (${errorMessage(e)}); fix or move it, then restart.`,
      e,
    );
  }
  if (!Array.isArray(jobs))
    throw fail(
      'legacy',
      `${file} must hold an array of jobs; fix or move it, then restart.`,
    );
  return jobs.map((j, i) => validJob(j, `${path.basename(file)} entry ${i}`));
};

function importLegacy(s: Statements, legacyFile: string, at: string): void {
  const jobs = readLegacy(legacyFile);
  for (const j of jobs) {
    if (s.job.get(j.id))
      throw fail(
        'legacy',
        `legacy job ${j.id} duplicates existing history; resolve the conflict before importing.`,
      );
    const job = ACTIVE.includes(j.status)
      ? interrupt(
          j,
          at,
          `imported from ${path.basename(legacyFile)} while ${j.status}`,
        )
      : j;
    writeJob(s, job, at, 'migrated');
  }
  s.setMeta.run(
    'legacy_imported',
    JSON.stringify({ at, file: legacyFile, jobs: jobs.length }),
  );
}

// Ownership, recovery and the one-time legacy import happen in a single transaction: if any part
// fails, nothing is claimed or imported and the next start tries again.
const hasLivingProcess = (job: JobRecord) =>
  [job.childPid, job.workerPid].some(
    (pid) => exists(pid) || (pid != null && exists(-pid)),
  );
export const claim = (
  db: DatabaseSync,
  s: Statements,
  { legacyFile, token }: { legacyFile?: string; token: string },
) =>
  transaction(db, () => {
    const ownerPid = Number(s.get('owner_pid'));
    if (s.get('owner_token') && exists(ownerPid))
      throw fail(
        'owned',
        `another studio (pid ${ownerPid}${ownerPid === process.pid ? ', this process' : ''}) already owns this ledger. Stop that studio first. If the pid was reused, wait for that process to exit; do not stop an unrelated process.`,
      );
    const active = s.active
      .all(...ACTIVE)
      .map((r) => validJob(JSON.parse(sqlText(r.data)), 'stored job'));
    const living = active.filter(hasLivingProcess);
    if (living.length)
      throw fail(
        'living-child',
        `the last studio stopped while ${living.map((j) => `job ${j.id} (${j.kind}, supervisor ${j.childPid ?? 'unknown'}, worker ${j.workerPid ?? 'unknown'})`).join(', ')} may still be running. Wait for it to finish or stop it yourself, then restart; the studio will not start another copy or kill it.`,
      );
    const at = now();
    s.setMeta.run('owner_token', token);
    s.setMeta.run('owner_pid', String(process.pid));
    s.setMeta.run('owner_since', at);
    for (const j of active)
      writeJob(
        s,
        interrupt(j, at, `the studio stopped while this job was ${j.status}`),
        at,
      );
    if (legacyFile && !s.get('legacy_imported'))
      importLegacy(s, legacyFile, at);
  });
