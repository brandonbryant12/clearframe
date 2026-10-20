// The studio's durable job ledger: one SQLite file (normally out/studio/.harness/jobs.sqlite) that
// outlives the server. Every job ever queued stays in it; `list` shows the active ones plus the
// latest terminal history. Each save writes the rows and their transition events in one
// transaction. One process owns the ledger at a time; a stale owner's unfinished jobs come back as
// interrupted, never replayed, and the store refuses to start while a job's child may still be
// alive. The store never starts or kills processes and never touches files beside its own.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import * as Data from 'effect/Data';
import * as Effect from 'effect/Effect';
import * as Schema from 'effect/Schema';

export const SCHEMA_VERSION = 1;
export const ACTIVE = ['queued', 'waiting', 'running'];

export class JobStoreError extends Data.TaggedError('JobStoreError') {}

const fail = (reason, message, cause) => new JobStoreError({ reason, message: `Job store: ${message}`, ...(cause ? { cause } : {}) });
const asError = (reason, e) => e instanceof JobStoreError ? e : fail(reason, e?.message ?? String(e), e);

// The core shape every job must have. Decoding checks it; the original object (extra fields and
// all) is what gets stored.
export const JobSchema = Schema.Struct({
  dir: Schema.NonEmptyString,
  id: Schema.NonEmptyString,
  kind: Schema.NonEmptyString,
  status: Schema.Literals(['queued', 'waiting', 'running', 'complete', 'failed', 'cancelled', 'interrupted']),
  createdAt: Schema.NonEmptyString,
  requestKey: Schema.optionalKey(Schema.NullOr(Schema.NonEmptyString)),
  cancelled: Schema.optionalKey(Schema.Boolean),
  paid: Schema.optionalKey(Schema.Boolean),
  childPid: Schema.optionalKey(Schema.NullOr(Schema.Int)),
  workerPid: Schema.optionalKey(Schema.NullOr(Schema.Int)),
  log: Schema.optionalKey(Schema.String),
});
const decodeJob = Schema.decodeUnknownSync(JobSchema);
const validJob = (job, where) => {
  if (!job || typeof job !== 'object' || Array.isArray(job)) throw fail('invalid-job', `${where}: a job must be an object.`);
  try { decodeJob(job); } catch (e) { throw fail('invalid-job', `${where} (${job.id ?? 'no id'}): ${e.message.replace(/\s*\n\s*/g, ' ')}`, e); }
  if (job.childPid != null && job.childPid <= 0) throw fail('invalid-job', `${where}: childPid must be positive.`);
  if (job.workerPid != null && job.workerPid <= 0) throw fail('invalid-job', `${where}: workerPid must be positive.`);
  return job;
};

const MIGRATIONS = [
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
const exists = pid => {
  if (!Number.isInteger(pid) || pid === 0) return false;
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
};

// BEGIN IMMEDIATE takes the write lock up front; the result is returned only after COMMIT.
const transaction = (db, fn) => {
  db.exec('BEGIN IMMEDIATE');
  let result;
  try {
    result = fn();
    db.exec('COMMIT');
  } catch (e) {
    try { db.exec('ROLLBACK'); } catch { /* already rolled back by SQLite */ }
    throw e;
  }
  return result;
};

const now = () => new Date().toISOString();

const sqlite = db => {
  const s = {
    meta: db.prepare('SELECT value FROM meta WHERE key = ?'),
    setMeta: db.prepare('INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value'),
    delMeta: db.prepare('DELETE FROM meta WHERE key = ?'),
    job: db.prepare('SELECT status, cancelled, dir, request_key FROM jobs WHERE id = ?'),
    byKey: db.prepare('SELECT id FROM jobs WHERE dir = ? AND request_key = ?'),
    insert: db.prepare('INSERT INTO jobs (id, dir, kind, status, cancelled, created_at, request_key, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'),
    update: db.prepare('UPDATE jobs SET dir = ?, kind = ?, status = ?, cancelled = ?, created_at = ?, request_key = ?, data = ? WHERE id = ?'),
    event: db.prepare('INSERT INTO events (job_id, type, at, data) VALUES (?, ?, ?, ?) RETURNING seq'),
    active: db.prepare(`SELECT data FROM jobs WHERE status IN (${ACTIVE.map(() => '?').join(', ')}) ORDER BY seq`),
  };
  s.get = key => s.meta.get(key)?.value;
  return s;
};

const writeJob = (s, job, at, created) => {
  const prior = s.job.get(job.id);
  const key = job.requestKey ?? null;
  if (key != null) {
    const holder = s.byKey.get(job.dir, key);
    if (holder && holder.id !== job.id) throw fail('duplicate-key', `request ${key} in ${job.dir} already belongs to job ${holder.id}.`);
  }
  const cancelled = job.cancelled === true ? 1 : 0;
  const row = [job.dir, job.kind, job.status, cancelled, job.createdAt, key, JSON.stringify(job)];
  const events = [];
  const add = (type, data) => {
    const { seq } = s.event.get(job.id, type, at, JSON.stringify(data));
    events.push({ seq: Number(seq), jobId: job.id, type, at, data });
  };
  if (!prior) {
    s.insert.run(job.id, ...row);
    add(created ?? 'created', { status: job.status, cancelled: cancelled === 1 });
  } else {
    s.update.run(...row, job.id);
    if (prior.status !== job.status || prior.cancelled !== cancelled)
      add('transition', { from: { status: prior.status, cancelled: prior.cancelled === 1 }, to: { status: job.status, cancelled: cancelled === 1 } });
  }
  return events;
};

// An unfinished job from a run that ended without finishing it. Paid work may or may not have
// been billed or written, so its outcome is unknown; it is never replayed.
const interrupt = (job, at, reason) => ({
  ...job,
  status: 'interrupted',
  interruptedAt: at,
  recovery: { at, reason, from: job.status, ...(job.paid ? { outcome: 'unknown' } : {}) },
});

const readLegacy = file => {
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch (e) {
    if (e.code === 'ENOENT') return [];
    throw fail('legacy', `cannot read ${file}: ${e.message}`, e);
  }
  let jobs;
  try { jobs = JSON.parse(text); } catch (e) { throw fail('legacy', `${file} is not valid JSON (${e.message}); fix or move it, then restart.`, e); }
  if (!Array.isArray(jobs)) throw fail('legacy', `${file} must hold an array of jobs; fix or move it, then restart.`);
  return jobs.map((j, i) => validJob(j, `${path.basename(file)} entry ${i}`));
};

// Ownership, recovery and the one-time legacy import happen in a single transaction: if any part
// fails, nothing is claimed or imported and the next start tries again.
const claim = (db, s, { legacyFile, token }) => transaction(db, () => {
  const ownerPid = Number(s.get('owner_pid'));
  if (s.get('owner_token') && exists(ownerPid))
    throw fail('owned', `another studio (pid ${ownerPid}${ownerPid === process.pid ? ', this process' : ''}) already owns this ledger. Stop that studio first. If the pid was reused, wait for that process to exit; do not stop an unrelated process.`);
  const active = s.active.all(...ACTIVE).map(r => validJob(JSON.parse(r.data), 'stored job'));
  const living = active.filter(j => exists(j.childPid) || exists(-j.childPid) || exists(j.workerPid) || exists(-j.workerPid));
  if (living.length)
    throw fail('living-child', `the last studio stopped while ${living.map(j => `job ${j.id} (${j.kind}, supervisor ${j.childPid ?? 'unknown'}, worker ${j.workerPid ?? 'unknown'})`).join(', ')} may still be running. Wait for it to finish or stop it yourself, then restart; the studio will not start another copy or kill it.`);
  const at = now();
  s.setMeta.run('owner_token', token);
  s.setMeta.run('owner_pid', String(process.pid));
  s.setMeta.run('owner_since', at);
  for (const j of active) writeJob(s, interrupt(j, at, `the studio stopped while this job was ${j.status}`), at);
  if (legacyFile && !s.get('legacy_imported')) {
    const jobs = readLegacy(legacyFile);
    for (const j of jobs) {
      if (s.job.get(j.id)) throw fail('legacy', `legacy job ${j.id} duplicates existing history; resolve the conflict before importing.`);
      const job = ACTIVE.includes(j.status) ? interrupt(j, at, `imported from ${path.basename(legacyFile)} while ${j.status}`) : j;
      writeJob(s, job, at, 'migrated');
    }
    s.setMeta.run('legacy_imported', JSON.stringify({ at, file: legacyFile, jobs: jobs.length }));
  }
});

const open = ({ file, legacyFile, keepJobs = 60 }) => {
  if (!file) throw fail('options', 'a ledger file is required.');
  if (!(Number.isInteger(keepJobs) && keepJobs >= 0)) throw fail('options', 'keepJobs must be a whole number.');
  const parent = path.dirname(file);
  const made = fs.mkdirSync(parent, { recursive: true, mode: 0o700 });
  if (made) fs.chmodSync(parent, 0o700);
  const db = new DatabaseSync(file);
  try {
    db.exec('PRAGMA busy_timeout = 3000;');
    const version = db.prepare('PRAGMA user_version').get().user_version;
    if (version > SCHEMA_VERSION) throw fail('future-schema', `${file} is schema version ${version}, newer than this ClearFrame (${SCHEMA_VERSION}). Update ClearFrame; the ledger was left untouched.`);
    db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    for (let v = version; v < SCHEMA_VERSION; v++) transaction(db, () => { db.exec(MIGRATIONS[v]); db.exec(`PRAGMA user_version = ${v + 1}`); });
    const s = sqlite(db);
    const token = crypto.randomUUID();
    claim(db, s, { legacyFile, token });
    return { db, s, token, keepJobs, file };
  } catch (e) {
    try { db.close(); } catch { /* closing a failed open is best effort */ }
    throw e;
  }
};

const makeStore = state => {
  let closed = false;
  const { db, s, token, keepJobs } = state;
  const usable = () => { if (closed) throw fail('closed', 'the ledger is closed.'); };
  const owned = () => {
    if (s.get('owner_token') !== token) throw fail('not-owner', 'this studio no longer owns the ledger; restart it.');
  };
  const recent = db.prepare(`SELECT data FROM jobs WHERE seq IN (
    SELECT seq FROM jobs WHERE status IN (${ACTIVE.map(() => '?').join(', ')})
    UNION ALL
    SELECT seq FROM (SELECT seq FROM jobs WHERE status NOT IN (${ACTIVE.map(() => '?').join(', ')}) ORDER BY created_at DESC, seq DESC LIMIT ?)
  ) ORDER BY created_at, seq`);
  const byKey = db.prepare('SELECT data FROM jobs WHERE dir = ? AND request_key = ?');
  const byId = db.prepare('SELECT data FROM jobs WHERE id = ?');
  const eventRows = db.prepare('SELECT seq, job_id, type, at, data FROM events WHERE seq > ? AND (? IS NULL OR job_id = ?) ORDER BY seq LIMIT ?');

  const op = (reason, fn) => (...args) => Effect.try({ try: () => { usable(); return fn(...args); }, catch: e => asError(reason, e) });
  const effect = {
    list: op('sqlite', () => recent.all(...ACTIVE, ...ACTIVE, keepJobs).map(r => validJob(JSON.parse(r.data), 'stored job'))),
    get: op('sqlite', id => {
      const row = byId.get(String(id));
      return row ? validJob(JSON.parse(row.data), 'stored job') : null;
    }),
    saveAll: op('sqlite', jobs => {
      if (!Array.isArray(jobs)) throw fail('invalid-job', 'saveAll takes an array of jobs.');
      return transaction(db, () => {
        owned();
        const at = now();
        const events = jobs.flatMap((j, i) => writeJob(s, validJob(j, `job ${i}`), at));
        return { saved: jobs.length, events };
      });
    }),
    findByKey: op('sqlite', (dir, requestKey) => {
      const row = byKey.get(String(dir), String(requestKey));
      return row ? validJob(JSON.parse(row.data), 'stored job') : null;
    }),
    events: op('sqlite', ({ after = 0, jobId, limit = 200 } = {}) => {
      if (!Number.isSafeInteger(after) || after < 0 || !Number.isSafeInteger(limit) || limit < 0)
        throw fail('options', 'event cursor and limit must be nonnegative whole numbers.');
      return eventRows.all(after, jobId ?? null, jobId ?? null, Math.min(limit, 10000))
        .map(r => ({ seq: Number(r.seq), jobId: r.job_id, type: r.type, at: r.at, data: JSON.parse(r.data) }));
    }),
    close: () => Effect.try({
      try: () => {
        if (closed) return;
        closed = true;
        try {
          transaction(db, () => {
            if (s.get('owner_token') !== token) return;
            for (const key of ['owner_token', 'owner_pid', 'owner_since']) s.delMeta.run(key);
          });
        } finally { db.close(); }
      },
      catch: e => asError('sqlite', e),
    }),
  };
  const sync = name => (...args) => Effect.runSync(effect[name](...args));
  return {
    file: state.file,
    effect,
    list: sync('list'),
    get: sync('get'),
    saveAll: sync('saveAll'),
    findByKey: sync('findByKey'),
    events: sync('events'),
    close: sync('close'),
  };
};

// Effect form: fails with a JobStoreError; the store's `effect` holds the same operations as Effects.
export const openJobStoreEffect = options => Effect.try({
  try: () => {
    const state = open(options ?? {});
    try { return makeStore(state); }
    catch (error) {
      try {
        transaction(state.db, () => {
          if (state.s.get('owner_token') === state.token)
            for (const key of ['owner_token', 'owner_pid', 'owner_since']) state.s.delMeta.run(key);
        });
      } finally { state.db.close(); }
      throw error;
    }
  },
  catch: e => asError('sqlite', e),
});

// Synchronous form for the studio server: throws the JobStoreError.
export const openJobStore = options => Effect.runSync(openJobStoreEffect(options));
