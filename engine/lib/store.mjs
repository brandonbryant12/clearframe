// The project's durable review state lives in `review/`: revisions, notes, keeps, decisions,
// the run log and a content-addressed object store. Everything is plain files; writes are
// atomic (temp file + rename) and serialised by a lock file, so a crash never leaves half a
// record and two commands never take the same revision number.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const ID = {
  revision: /^r\d{3,}$/,
  note: /^n\d{3,}$/,
  keep: /^k\d{3,}$/,
  decision: /^d\d{3,}$/,
  cut: /^c\d{3,}$/,
  beat: /^[a-z0-9][a-z0-9-_]*$/i,
};
export function checkId(kind, value) {
  if (typeof value !== 'string' || !ID[kind].test(value)) throw new Error(`Invalid ${kind} id: ${JSON.stringify(value)}`);
  return value;
}

export const reviewDir = root => path.join(root, 'review');
export const reviewPath = (root, ...parts) => path.join(root, 'review', ...parts);

/** Keys sorted at every level, so equal content always hashes the same. */
export const canonical = value =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map(k => [k, v[k]]),
        )
      : v,
  );
export const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
export const fingerprint = value => sha256(canonical(value ?? null)).slice(0, 16);

/** SHA-256 of a file read in chunks (review videos can be hundreds of megabytes). */
export function sha256File(file) {
  const hash = crypto.createHash('sha256'),
    fd = fs.openSync(file, 'r'),
    buf = Buffer.alloc(8 << 20);
  try {
    let n;
    while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) hash.update(buf.subarray(0, n));
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest('hex');
}

export function writeAtomic(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${crypto.randomUUID().slice(0, 8)}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
}
export const writeJSONAtomic = (file, value) => writeAtomic(file, JSON.stringify(value, null, 2) + '\n');
export function readJSONFile(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    if (fallback !== undefined && e.code === 'ENOENT') return fallback;
    throw new Error(`Could not read ${file}: ${e.message}`);
  }
}

let held = 0;
/** Run `fn` (sync or async) holding review/.lock; a lock whose process is gone is taken over. */
export function withLock(root, fn) {
  if (held) return fn();
  const lock = reviewPath(root, '.lock');
  fs.mkdirSync(path.dirname(lock), { recursive: true });
  const deadline = Date.now() + 30000;
  for (;;) {
    try {
      fs.writeFileSync(lock, String(process.pid), { flag: 'wx' });
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      const owner = Number(fs.readFileSync(lock, 'utf8'));
      let alive = false;
      if (Number.isInteger(owner) && owner > 0)
        try {
          process.kill(owner, 0);
          alive = true;
        } catch (k) {
          alive = k.code === 'EPERM';
        }
      if (!alive) {
        fs.rmSync(lock, { force: true });
        continue;
      }
      if (Date.now() > deadline) throw new Error(`review/ is locked by process ${owner}; try again when it finishes.`);
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
  held++;
  const release = () => {
    held--;
    fs.rmSync(lock, { force: true });
  };
  let result;
  try {
    result = fn();
  } catch (e) {
    release();
    throw e;
  }
  if (result && typeof result.then === 'function') return result.finally(release);
  release();
  return result;
}

/** Next id with a prefix: r001, n014 … (never reused, even after deletion). */
export function nextId(prefix, taken) {
  let max = 0;
  for (const id of taken) {
    const n = Number(String(id).slice(prefix.length));
    if (String(id).startsWith(prefix) && Number.isInteger(n)) max = Math.max(max, n);
  }
  return `${prefix}${String(max + 1).padStart(3, '0')}`;
}

// ------------------------------------------------------------------ objects

/** review/objects/ab/abcdef….ext — one copy per distinct content. */
export function objectRel(sha, ext = '') {
  if (!/^[0-9a-f]{64}$/.test(sha)) throw new Error(`Invalid object hash ${sha}`);
  if (ext && !/^\.[a-z0-9]{1,8}$/i.test(ext)) throw new Error(`Invalid object extension ${ext}`);
  return path.join('review', 'objects', sha.slice(0, 2), `${sha}${ext.toLowerCase()}`);
}

/**
 * Preserve a file by content. On APFS the copy is a clone: no bytes are duplicated until the
 * working file is rewritten, and rewriting it in place cannot change the stored version.
 */
export function putObject(root, file, { sha, ext = path.extname(file) } = {}) {
  sha ??= sha256File(file);
  const rel = objectRel(sha, ext),
    out = path.join(root, rel);
  if (!fs.existsSync(out)) {
    fs.mkdirSync(path.dirname(out), { recursive: true });
    const tmp = `${out}.${process.pid}.tmp`;
    fs.copyFileSync(file, tmp, fs.constants.COPYFILE_FICLONE);
    if (sha256File(tmp) !== sha) {
      fs.rmSync(tmp, { force: true });
      throw new Error(`${file} changed while it was being preserved; run again.`);
    }
    fs.chmodSync(tmp, 0o444);
    fs.renameSync(tmp, out);
  }
  return { sha256: sha, object: rel.split(path.sep).join('/') };
}

/** Path of a stored object after checking its content still matches its name. */
export function objectFile(root, rel, { verify = true } = {}) {
  const parts = String(rel).split('/');
  const m = parts.length === 4 && parts[0] === 'review' && parts[1] === 'objects' && /^([0-9a-f]{64})(\.[a-z0-9]{1,8})?$/.exec(parts[3]);
  if (!m || parts[2] !== m[1].slice(0, 2)) throw new Error(`Invalid object reference ${rel}`);
  const file = path.join(root, ...parts);
  if (!fs.existsSync(file)) return null;
  if (verify && sha256File(file) !== m[1]) throw new Error(`Stored object ${rel} is damaged (its content no longer matches its hash).`);
  return file;
}

/** Copy a stored object back to a working path (a fresh file, never a link to the store). */
export function restoreObject(root, rel, dest) {
  const file = objectFile(root, rel);
  if (!file) throw new Error(`Stored object ${rel} is missing; this version cannot be restored.`);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const tmp = `${dest}.${process.pid}.restore`;
  fs.copyFileSync(file, tmp, fs.constants.COPYFILE_FICLONE);
  fs.chmodSync(tmp, 0o644);
  fs.renameSync(tmp, dest);
}
