// The project's durable review state lives in `review/`: revisions, notes, keeps, decisions,
// the run log and a content-addressed object store. Everything is plain files; writes are
// atomic (temp file + rename) and serialised by a lock file, so a crash never leaves half a
// record and two commands never take the same revision number.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { errorCode, errorMessage, isRecord } from './errors.mjs';

export const ID = {
  revision: /^r\d{3,}$/,
  note: /^n\d{3,}$/,
  keep: /^k\d{3,}$/,
  decision: /^d\d{3,}$/,
  cut: /^c\d{3,}$/,
  beat: /^[a-z0-9][a-z0-9-_]*$/i,
} as const;
export type IdKind = keyof typeof ID;
export function checkId(kind: IdKind, value: unknown): string {
  if (typeof value !== 'string' || !ID[kind].test(value))
    throw new Error(`Invalid ${kind} id: ${JSON.stringify(value)}`);
  return value;
}

export const reviewDir = (root: string): string => path.join(root, 'review');
export const reviewPath = (root: string, ...parts: string[]): string =>
  path.join(root, 'review', ...parts);

/** Keys sorted at every level, so equal content always hashes the same. */
export const canonical = (value: unknown): string =>
  JSON.stringify(value, (_: string, v: unknown) =>
    isRecord(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k): [string, unknown] => [k, v[k]]),
        )
      : v,
  );
export const sha256 = (data: string | NodeJS.ArrayBufferView): string =>
  crypto.createHash('sha256').update(data).digest('hex');
export const fingerprint = (value: unknown): string =>
  sha256(canonical(value ?? null)).slice(0, 16);

/** SHA-256 of a file read in chunks (review videos can be hundreds of megabytes). */
export function sha256File(file: string): string {
  const hash = crypto.createHash('sha256'),
    fd = fs.openSync(file, 'r'),
    buf = Buffer.alloc(8 << 20);
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0)
      hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

export function writeAtomic(
  file: string,
  data: string | NodeJS.ArrayBufferView,
): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
export const writeJSONAtomic = (file: string, value: unknown): void =>
  writeAtomic(file, JSON.stringify(value, null, 2) + '\n');
/** Parsed JSON, unchecked: callers decode the shape they consume. A missing file gives `fallback` when one is set. */
export function readJSONFile(file: string, fallback?: unknown): unknown {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined && errorCode(e) === 'ENOENT') return fallback;
    throw new Error(`Could not read ${file}: ${errorMessage(e)}`);
  }
}

/** True while process `owner` still runs (EPERM: it runs as another user). */
function processAlive(owner: number): boolean {
  if (!Number.isInteger(owner) || owner <= 0) return false;
  try {
    process.kill(owner, 0);
    return true;
  } catch (k) {
    return errorCode(k) === 'EPERM';
  }
}

function acquire(lock: string): void {
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      return;
    } catch (e) {
      if (errorCode(e) !== 'EEXIST') throw e;
      const owner = Number(fs.readFileSync(lock, 'utf8'));
      if (!processAlive(owner)) {
        fs.rmSync(lock, { force: true });
        continue;
      }
      if (Date.now() > deadline)
        throw new Error(
          `review/ is locked by process ${owner}; try again when it finishes.`,
        );
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

const isPromise = (value: unknown): value is Promise<unknown> =>
  value instanceof Promise ||
  (isRecord(value) &&
    typeof value.then === 'function' &&
    typeof value.finally === 'function');

let held = 0;
/** Run `fn` (sync or async) holding review/.lock; a lock whose process is gone is taken over. */
export function withLock<T>(root: string, fn: () => T): T {
  if (held) return fn();
  const lock = reviewPath(root, '.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  acquire(lock);
  held++;
  const release = (): void => {
    held--;
    fs.rmSync(lock, { force: true });
  };
  let result: T;
  try {
    result = fn();
  } catch (e) {
    release();
    throw e;
  }
  // An async `fn` keeps the lock until its promise settles. `finally` resolves to the same
  // value as `result`, so the chained promise has `result`'s type T.
  if (isPromise(result)) return result.finally(release) as T;
  release();
  return result;
}

/** Next id with a prefix: r001, n014 … (never reused, even after deletion). */
export function nextId(prefix: string, taken: Iterable<unknown>): string {
  let max = 0;
  for (const id of taken) {
    const n = Number(String(id).slice(prefix.length));
    if (String(id).startsWith(prefix) && Number.isInteger(n))
      max = Math.max(max, n);
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ objects

export interface StoredObject {
  sha256: string;
  object: string;
}

/** review/objects/ab/abcdef….ext — one copy per distinct content. */
export function objectRel(sha: string, ext = ''): string {
  if (!/^[0-9a-f]{64}$/.test(sha))
    throw new Error(`Invalid object hash ${sha}`);
  if (ext && !/^\.[a-z0-9]{1,8}$/i.test(ext))
    throw new Error(`Invalid object extension ${ext}`);
  return path.join(
    'review',
    'objects',
    sha.slice(0, 2),
    `${sha}${ext.toLowerCase()}`,
  );
}

/**
 * Preserve a file by content. On APFS the copy is a clone: no bytes are duplicated until the
 * working file is rewritten, and rewriting it in place cannot change the stored version.
 */
export function putObject(
  root: string,
  file: string,
  { sha, ext = path.extname(file) }: { sha?: string; ext?: string } = {},
): StoredObject {
  const digest = sha ?? sha256File(file);
  const rel = objectRel(digest, ext),
    out = path.join(root, rel);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.tmp`;
    fs.copyFileSync(file, tmp, fs.constants.COPYFILE_FICLONE);
    if (sha256File(tmp) !== digest) {
      fs.rmSync(tmp, { force: true });
      throw new Error(
        `${file} changed while it was being preserved; run again.`,
      );
    }
    fs.chmodSync(tmp, 0o444);
    fs.renameSync(tmp, out);
  }
  return { sha256: digest, object: rel.split(path.sep).join('/') };
}

/** Path of a stored object after checking its content still matches its name. */
export function objectFile(
  root: string,
  rel: unknown,
  { verify = true }: { verify?: boolean } = {},
): string | null {
  const parts = String(rel).split('/');
  const m =
    parts.length === 4 &&
    parts[0] === 'review' &&
    parts[1] === 'objects' &&
    /^([0-9a-f]{64})(\.[a-z0-9]{1,8})?$/.exec(parts[3]);
  if (!m || parts[2] !== m[1].slice(0, 2))
    throw new Error(`Invalid object reference ${String(rel)}`);
  const file = path.join(root, ...parts);
  if (!fs.existsSync(file)) return null;
  if (verify && sha256File(file) !== m[1])
    throw new Error(
      `Stored object ${String(rel)} is damaged (its content no longer matches its hash).`,
    );
  return file;
}

/** Copy a stored object back to a working path (a fresh file, never a link to the store). */
export function restoreObject(root: string, rel: unknown, dest: string): void {
  const file = objectFile(root, rel);
  if (!file)
    throw new Error(
      `Stored object ${String(rel)} is missing; this version cannot be restored.`,
    );
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.restore`;
  fs.copyFileSync(file, tmp, fs.constants.COPYFILE_FICLONE);
  fs.chmodSync(tmp, 0o644);
  fs.renameSync(tmp, dest);
}
