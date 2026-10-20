import { DOCS, INTAKE, MEDIA, MAX_UPLOAD } from './upload-types.mjs';
export { DOCS, INTAKE, MEDIA, MAX_UPLOAD } from './upload-types.mjs';
// New films from the browser, and files people add to them. Projects are ordinary ClearFrame
// folders under one projects root (default ./projects, or --projects / CLEARFRAME_PROJECTS),
// created with the same intake as `clearframe start`. Uploads land inside one project only,
// with sanitised names, an allowlist of types and size limits.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { startProject } from '../start.mjs';
import { updateLink, readLink } from './links.mjs';
import type { IncomingHttpHeaders } from 'node:http';
import type { Readable } from 'node:stream';
import { errorCode, errorMessage, errorStatus } from '../harness/contracts.mjs';
export type UploadRequest = Readable & {
  headers?: IncomingHttpHeaders;
  complete?: boolean;
};
export interface ProjectRequest {
  request?: string;
  idea?: string;
  title?: string;
  documents?: string[];
  playbook?: string;
  treatment?: string;
  direction?: string;
  audience?: string;
  takeaway?: string;
  format?: string;
  mode?: string;
}

const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
export function projectsRoot(base = process.cwd(), option?: string) {
  const root = path.resolve(
    base,
    option ?? process.env.CLEARFRAME_PROJECTS ?? 'projects',
  );
  // The viewer serves films' media from its working folder; a projects root outside it could not play back.
  if (root !== base && !root.startsWith(base + path.sep))
    throw new Error(
      `The projects folder must be inside ${base} (the folder the studio serves): ${root}`,
    );
  return root;
}

/** A file name a person chose, made safe: no folders, no leading dots, a known extension. */
export function safeName(name: unknown) {
  const ext = path.extname(String(name ?? '')).toLowerCase();
  if (!DOCS.has(ext) && !MEDIA.has(ext))
    throw fail(
      `ClearFrame does not take ${ext || 'files without an extension'} here. Documents: ${[...DOCS].join(' ')}; media: ${[...MEDIA].join(' ')}.`,
      415,
    );
  const stem =
    path
      .basename(String(name), path.extname(String(name)))
      .normalize('NFKD')
      .replace(/[^\w.-]+/g, '-')
      .replace(/^[.-]+|[.-]+$/g, '')
      .slice(0, 80) || 'file';
  return {
    name: `${stem}${ext}`,
    ext,
    kind: DOCS.has(ext) ? ('doc' as const) : ('media' as const),
  };
}
/** The next free variant of a name (notes.txt, notes-2.txt…) as of now; publishing re-checks atomically. */
const variant = (name: string, n: number) => {
  const ext = path.extname(name),
    stem = path.basename(name, ext);
  return n < 2 ? name : `${stem}-${n}${ext}`;
};
// Cut at 48 characters, then trim a dash the cut may leave ("…-for-the-").
export const slugify = (s: unknown) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
    .replace(/-+$/, '') || 'film';

/** A folder inside the project by real path: a symlinked source/ or assets/ cannot lead outside it. */
function ownFolder(dir: string, rel: string) {
  const root = fs.realpathSync(dir),
    folder = path.join(root, rel);
  fs.mkdirSync(folder, { recursive: true });
  const real = fs.realpathSync(folder);
  if (real !== root && !real.startsWith(root + path.sep))
    throw fail(
      `${rel} leads outside the project; uploads stay inside it.`,
      403,
    );
  return real;
}

/**
 * Stream a request body into a hidden temporary file in `folder`, refusing it past `limit` bytes,
 * then publish it under `name` without ever replacing an existing file: link() fails if the name is
 * taken (by an earlier file or a concurrent upload), and the next variant is tried. Returns the
 * published name. Temporary files are removed on every failure.
 */
export function receive(
  req: UploadRequest,
  folder: string,
  name: string,
  limit: number,
): Promise<{ name: string; size: number }> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers?.['content-length']);
    if (Number.isFinite(declared) && declared > limit) {
      req.resume?.();
      return reject(
        fail(`That file is larger than ${Math.round(limit / 1e6)} MB.`, 413),
      );
    }
    const tmp = path.join(folder, `.upload-${crypto.randomUUID()}.part`),
      out = fs.createWriteStream(tmp, { flags: 'wx' });
    let size = 0,
      done = false;
    const stop = (e: unknown) => {
      if (done) return;
      done = true;
      out.destroy();
      fs.rmSync(tmp, { force: true });
      reject(e);
    };
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) {
        stop(
          fail(`That file is larger than ${Math.round(limit / 1e6)} MB.`, 413),
        );
        req.destroy?.();
      }
    });
    req.on('aborted', () => stop(fail('The upload was interrupted.', 400)));
    req.on('error', () => stop(fail('The upload was interrupted.', 400)));
    req.on('close', () => {
      if (!req.complete && req.complete !== undefined)
        stop(fail('The upload was interrupted.', 400));
    });
    out.on('error', stop);
    out.on('finish', () => {
      if (done) return;
      if (!size) return stop(fail('That file is empty.'));
      try {
        for (let n = 1; n < 10000; n++) {
          const candidate = variant(name, n);
          try {
            fs.linkSync(tmp, path.join(folder, candidate));
            done = true;
            fs.rmSync(tmp, { force: true });
            return resolve({ name: candidate, size });
          } catch (e) {
            if (errorCode(e) !== 'EEXIST') throw e;
          }
        }
        throw fail('Too many files with that name.', 409);
      } catch (e) {
        done = false;
        stop(e);
      }
    });
    req.pipe(out);
  });
}

/** Save one upload into a project: documents under source/, pictures, footage and sound under assets/uploads/. */
export async function uploadToProject(
  dir: string,
  req: UploadRequest,
  rawName: unknown,
) {
  const { name, kind } = safeName(rawName);
  const rel = kind === 'doc' ? 'source' : path.join('assets', 'uploads');
  const folder = ownFolder(dir, rel);
  const r = await receive(req, folder, name, MAX_UPLOAD[kind]);
  return {
    file: path.join(rel, r.name).split(path.sep).join('/'),
    size: r.size,
    kind,
  };
}

/** Uploads for a film that does not exist yet wait in a draft folder in studio state. */
export async function uploadToDraft(
  uploads: string,
  draft: unknown,
  req: UploadRequest,
  rawName: unknown,
) {
  if (typeof draft !== 'string' || !/^[a-z0-9-]{8,64}$/.test(draft))
    throw fail('Unknown draft.');
  // Documents feed the intake; pictures, footage and sound go to the film's assets/uploads/.
  const { name, kind } = safeName(rawName);
  const folder = path.join(uploads, draft);
  fs.mkdirSync(folder, { recursive: true });
  const r = await receive(req, folder, name, MAX_UPLOAD[kind]);
  return { file: r.name, size: r.size };
}

function reserveProject(root: string, stem: string): string {
  fs.mkdirSync(root, { recursive: true });
  // Reserve the folder atomically: mkdir fails if a concurrent create took the name first.
  let dir = null;
  for (let n = 1; !dir && n < 10000; n++) {
    const d = path.join(root, variant(stem, n));
    try {
      fs.mkdirSync(d);
      dir = d;
    } catch (e) {
      if (errorCode(e) !== 'EEXIST') throw e;
    }
  }
  if (!dir) throw fail('Could not reserve a project folder.', 409);
  return dir;
}
function copyUpload(file: string, into: string): void {
  for (let n = 1; ; n++) {
    try {
      fs.copyFileSync(
        file,
        path.join(into, variant(path.basename(file), n)),
        fs.constants.COPYFILE_EXCL,
      );
      return;
    } catch (error) {
      if (errorCode(error) !== 'EEXIST') throw error;
    }
  }
}
function publishUploads(dir: string, kept: string[], media: string[]): void {
  // Pictures and footage given with the brief: into assets/uploads/, never replacing a file.
  const groups: [string[], string][] = [
    [kept, 'source'],
    [media, path.join('assets', 'uploads')],
  ];
  for (const [files, rel] of groups) {
    if (!files.length) continue;
    const into = path.join(dir, rel);
    fs.mkdirSync(into, { recursive: true });
    for (const file of files) copyUpload(file, into);
  }
}
function intakeOptions(
  body: ProjectRequest,
  idea: string,
  title: string,
  documents: string[],
) {
  const opt = (v: unknown, re: RegExp) =>
    typeof v === 'string' && re.test(v) ? v : undefined;
  return {
    idea: idea || undefined,
    document: documents.length ? documents : undefined,
    title: title || undefined,
    playbook: opt(body.playbook, /^[\w-]{1,60}$/),
    treatment: opt(body.treatment, /^[\w-]{1,60}$/),
    direction: opt(body.direction, /^[\w-]{1,60}$/),
    audience:
      typeof body.audience === 'string' && body.audience.trim()
        ? body.audience.trim().slice(0, 400)
        : undefined,
    takeaway:
      typeof body.takeaway === 'string' && body.takeaway.trim()
        ? body.takeaway.trim().slice(0, 400)
        : undefined,
    vertical: body.format === 'vertical' || undefined,
  };
}

const created = new Map<string, string>();
/**
 * Create a film from the browser's new-project form (idempotent per request id within this server:
 * a retried create returns the same film). Returns the new folder.
 */
export function createProject(
  root: string,
  uploads: string,
  body: ProjectRequest,
): string {
  const request =
    typeof body.request === 'string' && /^[a-z0-9-]{8,64}$/.test(body.request)
      ? body.request
      : null;
  if (!request) throw fail('A new film needs its request id.');
  const previous = created.get(request);
  if (previous) return previous;
  const idea = typeof body.idea === 'string' ? body.idea.trim() : '';
  const title =
    typeof body.title === 'string' ? body.title.trim().slice(0, 100) : '';
  if (!idea && !(body.documents ?? []).length)
    throw fail('Describe the film, or add a source document.');
  if (idea.length > 8000)
    throw fail(
      'Keep the idea under 8,000 characters; add longer material as a document.',
    );
  const draftDir = path.join(uploads, request);
  const uploaded = (Array.isArray(body.documents) ? body.documents : []).map(
    (f) => {
      const file = path.join(draftDir, path.basename(String(f)));
      if (!fs.existsSync(file))
        throw fail(`The upload ${f} is missing; add it again.`);
      return file;
    },
  );
  // The intake reads prose documents; other accepted files (JSON data) are kept in source/ as they are.
  const ext = (f: string) => path.extname(f).toLowerCase();
  const documents = uploaded.filter((f) => INTAKE.has(ext(f))),
    kept = uploaded.filter((f) => DOCS.has(ext(f)) && !INTAKE.has(ext(f))),
    media = uploaded.filter((f) => MEDIA.has(ext(f)));
  const dir = reserveProject(root, slugify(title || idea.split(/[.\n]/)[0]));
  try {
    startProject(dir, intakeOptions(body, idea, title, documents));
  } catch (e) {
    fs.rmSync(dir, { recursive: true, force: true });
    throw errorStatus(e) ? e : fail(errorMessage(e));
  }
  publishUploads(dir, kept, media);
  updateLink(dir, (l) => ({
    ...l,
    createdBy: request,
    createdAt: new Date().toISOString(),
    mode: body.mode === 'together' ? 'together' : 'oneshot',
  }));
  fs.rmSync(draftDir, { recursive: true, force: true });
  created.set(request, dir);
  return dir;
}
/** After a restart, a retried create finds the film it already made. */
export function findCreated(dirs: readonly string[], request: string) {
  return dirs.find((d) => readLink(d).createdBy === request) ?? null;
}
