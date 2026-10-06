// New films from the browser, and files people add to them. Projects are ordinary ClearFrame
// folders under one projects root (default ./projects, or --projects / CLEARFRAME_PROJECTS),
// created with the same intake as `clearframe start`. Uploads land inside one project only,
// with sanitised names, an allowlist of types and size limits.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { startProject } from '../start.mjs';
import { updateLink, readLink } from './links.mjs';

const fail = (message, status = 400) => Object.assign(new Error(message), { status });
export const DOCS = new Set(['.md', '.markdown', '.txt', '.pdf', '.docx', '.html', '.htm', '.rtf', '.csv', '.json']);
export const MEDIA = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg', '.mp4', '.mov', '.webm', '.wav', '.mp3', '.m4a', '.srt', '.vtt']);
export const MAX_UPLOAD = { doc: 25e6, media: 500e6 };

export function projectsRoot(base = process.cwd(), option) {
  const root = path.resolve(base, option ?? process.env.CLEARFRAME_PROJECTS ?? 'projects');
  // The viewer serves films' media from its working folder; a projects root outside it could not play back.
  if (root !== base && !root.startsWith(base + path.sep)) throw new Error(`The projects folder must be inside ${base} (the folder the studio serves): ${root}`);
  return root;
}

/** A file name a person chose, made safe: no folders, no leading dots, a known extension. */
export function safeName(name) {
  const ext = path.extname(String(name ?? '')).toLowerCase();
  if (!DOCS.has(ext) && !MEDIA.has(ext)) throw fail(`ClearFrame does not take ${ext || 'files without an extension'} here. Documents: ${[...DOCS].join(' ')}; media: ${[...MEDIA].join(' ')}.`, 415);
  const stem = path.basename(String(name), path.extname(String(name))).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '').slice(0, 80) || 'file';
  return { name: `${stem}${ext}`, ext, kind: DOCS.has(ext) ? 'doc' : 'media' };
}
/** The next free variant of a name (notes.txt, notes-2.txt…) as of now; publishing re-checks atomically. */
const variant = (name, n) => { const ext = path.extname(name), stem = path.basename(name, ext); return n < 2 ? name : `${stem}-${n}${ext}`; };
const unique = (dir, name) => { let n = 1; while (fs.existsSync(path.join(dir, variant(name, n)))) n++; return variant(name, n); };
export const slugify = s => String(s ?? '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'film';

/** A folder inside the project by real path: a symlinked source/ or assets/ cannot lead outside it. */
function ownFolder(dir, rel) {
  const root = fs.realpathSync(dir), folder = path.join(root, rel);
  fs.mkdirSync(folder, { recursive: true });
  const real = fs.realpathSync(folder);
  if (real !== root && !real.startsWith(root + path.sep)) throw fail(`${rel} leads outside the project; uploads stay inside it.`, 403);
  return real;
}

/**
 * Stream a request body into a hidden temporary file in `folder`, refusing it past `limit` bytes,
 * then publish it under `name` without ever replacing an existing file: link() fails if the name is
 * taken (by an earlier file or a concurrent upload), and the next variant is tried. Returns the
 * published name. Temporary files are removed on every failure.
 */
export function receive(req, folder, name, limit) {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers?.['content-length']);
    if (Number.isFinite(declared) && declared > limit) { req.resume?.(); return reject(fail(`That file is larger than ${Math.round(limit / 1e6)} MB.`, 413)); }
    const tmp = path.join(folder, `.upload-${crypto.randomUUID()}.part`), out = fs.createWriteStream(tmp, { flags: 'wx' });
    let size = 0, done = false;
    const stop = e => { if (done) return; done = true; out.destroy(); fs.rmSync(tmp, { force: true }); reject(e); };
    req.on('data', c => { size += c.length; if (size > limit) { stop(fail(`That file is larger than ${Math.round(limit / 1e6)} MB.`, 413)); req.destroy?.(); } });
    req.on('aborted', () => stop(fail('The upload was interrupted.', 400)));
    req.on('error', () => stop(fail('The upload was interrupted.', 400)));
    req.on('close', () => { if (!req.complete && req.complete !== undefined) stop(fail('The upload was interrupted.', 400)); });
    out.on('error', stop);
    out.on('finish', () => {
      if (done) return;
      if (!size) return stop(fail('That file is empty.'));
      try {
        for (let n = 1; n < 10000; n++) {
          const candidate = variant(name, n);
          try { fs.linkSync(tmp, path.join(folder, candidate)); done = true; fs.rmSync(tmp, { force: true }); return resolve({ name: candidate, size }); }
          catch (e) { if (e.code !== 'EEXIST') throw e; }
        }
        throw fail('Too many files with that name.', 409);
      } catch (e) { done = false; stop(e); }
    });
    req.pipe(out);
  });
}

/** Save one upload into a project: documents under source/, pictures, footage and sound under assets/uploads/. */
export async function uploadToProject(dir, req, rawName) {
  const { name, kind } = safeName(rawName);
  const rel = kind === 'doc' ? 'source' : path.join('assets', 'uploads');
  const folder = ownFolder(dir, rel);
  const r = await receive(req, folder, name, MAX_UPLOAD[kind]);
  return { file: path.join(rel, r.name).split(path.sep).join('/'), size: r.size, kind };
}

/** Uploads for a film that does not exist yet wait in a draft folder in studio state. */
export async function uploadToDraft(uploads, draft, req, rawName) {
  if (typeof draft !== 'string' || !/^[a-z0-9-]{8,64}$/.test(draft)) throw fail('Unknown draft.');
  const { name, kind } = safeName(rawName);
  if (kind !== 'doc') throw fail('Add documents here (Markdown, text, PDF, DOCX, HTML, RTF, CSV, JSON); add pictures and footage inside the film.', 415);
  const folder = path.join(uploads, draft);
  fs.mkdirSync(folder, { recursive: true });
  const r = await receive(req, folder, name, MAX_UPLOAD.doc);
  return { file: r.name, size: r.size };
}

const created = new Map();
/**
 * Create a film from the browser's new-project form (idempotent per request id within this server:
 * a retried create returns the same film). Returns the new folder.
 */
export function createProject(root, uploads, body) {
  const request = typeof body.request === 'string' && /^[a-z0-9-]{8,64}$/.test(body.request) ? body.request : null;
  if (!request) throw fail('A new film needs its request id.');
  if (created.has(request)) return created.get(request);
  const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
  if (!idea && !(body.documents ?? []).length) throw fail('Describe the film, or add a source document.');
  if (idea.length > 8000) throw fail('Keep the idea under 8,000 characters; add longer material as a document.');
  const draftDir = path.join(uploads, request);
  const documents = (Array.isArray(body.documents) ? body.documents : []).map(f => {
    const file = path.join(draftDir, path.basename(String(f)));
    if (!fs.existsSync(file)) throw fail(`The upload ${f} is missing; add it again.`);
    return file;
  });
  const opt = (v, re) => (typeof v === 'string' && re.test(v) ? v : undefined);
  fs.mkdirSync(root, { recursive: true });
  // Reserve the folder atomically: mkdir fails if a concurrent create took the name first.
  const stem = slugify(title || idea.split(/[.\n]/)[0]);
  let dir = null;
  for (let n = 1; !dir && n < 10000; n++) { const d = path.join(root, variant(stem, n)); try { fs.mkdirSync(d); dir = d; } catch (e) { if (e.code !== 'EEXIST') throw e; } }
  try { startProject(dir, {
    idea: idea || undefined, document: documents.length ? documents : undefined, title: title || undefined,
    playbook: opt(body.playbook, /^[\w-]{1,60}$/), treatment: opt(body.treatment, /^[\w-]{1,60}$/), direction: opt(body.direction, /^[\w-]{1,60}$/),
    audience: typeof body.audience === 'string' && body.audience.trim() ? body.audience.trim().slice(0, 400) : undefined,
    takeaway: typeof body.takeaway === 'string' && body.takeaway.trim() ? body.takeaway.trim().slice(0, 400) : undefined,
    vertical: body.format === 'vertical' || undefined,
  }); } catch (e) { fs.rmSync(dir, { recursive: true, force: true }); throw e.status ? e : fail(e.message); }
  updateLink(dir, l => ({ ...l, createdBy: request, createdAt: new Date().toISOString() }));
  fs.rmSync(draftDir, { recursive: true, force: true });
  created.set(request, dir);
  return dir;
}
/** After a restart, a retried create finds the film it already made. */
export function findCreated(dirs, request) {
  return dirs.find(d => readLink(d).createdBy === request) ?? null;
}
