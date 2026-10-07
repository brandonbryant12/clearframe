// Films made elsewhere, described by film.json, and finding films on disk.
import fs from 'node:fs';
import path from 'node:path';
import { readJSON, slug, filmId, rel, fileHash, duration, frameSize, frameAt } from './media.mjs';
import { describeFile, walkFiles, byGroup } from './files.mjs';
import { noteView } from './notes.mjs';
import { manifestStage, stageInfo } from './stages.mjs';
import { briefOf, hasBrief } from './boards.mjs';


/** A film made outside ClearFrame, described by film.json: versions, scenes, lanes, fonts and files. */
export function manifestFilm(dir, ctx) {
  const m = readJSON(path.join(dir, 'film.json'));
  if (!m?.versions?.length) return null;
  const { out, media, fonts } = ctx, id = filmId(dir), title = m.title ?? path.basename(dir);
  const notes = readJSON(path.join(dir, 'notes.json'), { notes: [] }).notes;
  const fontList = (m.fonts ?? []).map(f => ({ entry: fonts.add(path.join(dir, f.file), { family: f.family, style: f.style, license: f.license, origin: title }), roles: f.used ?? [] })).filter(x => x.entry);
  for (const { entry, roles } of fontList) { entry.films.add(title); roles.forEach(r => entry.uses.add(r)); }
  const fontId = file => fonts.add(path.join(dir, file))?.id ?? null;
  const versions = m.versions.map((v, i) => {
    const file = path.join(dir, v.file);
    if (!fs.existsSync(file)) return null;
    const seconds = duration(file), frame = frameSize(file) ?? m.frame ?? { width: 1920, height: 1080 }, prefix = `${id}-${slug(v.id ?? `v${i + 1}`)}-${fileHash(file)}`;
    const scenes = (v.scenes ?? (i === m.versions.length - 1 ? m.scenes : null) ?? []).map((s, k) => ({
      number: k + 1, id: s.id ?? `scene-${k + 1}`, start: s.start, end: s.end, kind: s.kind ?? 'Shot', onScreen: s.onScreen ?? [], source: s.source ?? null,
      narration: s.narration ?? null, description: s.description ?? null, media: s.media ?? [],
      elements: (s.elements ?? []).map((e, n) => ({ id: e.id ?? `e${n}`, text: e.text, font: e.font ? fontId(e.font) : null, size: e.size ?? null,
        color: { token: e.colorName ?? null, hex: e.color ?? null }, box: e.box, at: e.at ?? s.start })),
      thumb: (p => p && rel(out, p))(frameAt(file, media, `${prefix}-scene-${k}`, s.end - .35, 480)),
    }));
    const lanes = i === m.versions.length - 1 ? m.lanes ?? {} : v.lanes ?? {};
    const vid = v.id ?? `v${i + 1}`;
    return { id: vid, number: i + 1, label: v.label ?? null, createdAt: v.createdAt ?? fs.statSync(file).mtime.toISOString(), seconds, quality: v.quality ?? 'Draft',
      approved: v.approved ? { by: v.approved.by ?? null, said: v.approved.said ?? null } : null,
      notes: notes.filter(n => n.version === vid).map(n => noteView(n)),
      video: rel(out, file), poster: (p => p && rel(out, p))(frameAt(file, media, `${prefix}-poster`, v.posterAt ?? seconds * .8)),
      frame, colors: m.palette ?? {}, scenes, lanes: { narration: lanes.narration ?? [], music: lanes.music ?? [], sfx: lanes.sfx ?? [] },
      fonts: i === m.versions.length - 1 ? fontList.map(x => ({ font: x.entry.id, roles: x.roles })) : [], look: m.look ?? {} };
  }).filter(Boolean);
  if (!versions.length) return null;
  const versionFiles = new Set(m.versions.map(v => path.join(dir, v.file)));
  const files = walkFiles(dir).filter(f => !versionFiles.has(f) && !['film.json', 'notes.json'].includes(path.basename(f)));
  return { id, kind: 'external', title, folder: path.relative(process.cwd(), dir), shape: (versions.at(-1).frame.height > versions.at(-1).frame.width) ? 'tall' : 'wide',
    beats: versions.at(-1).scenes.length, versions, files: files.map(f => describeFile(f, dir, out, media, fonts)).sort(byGroup), notesTo: 'film', about: m.about ?? null,
    stage: stageInfo(manifestStage(m, versions), { openNotes: versions.at(-1).notes.filter(n => !n.resolved).length }), brief: briefOf(dir), boards: [], updatedAt: versions.at(-1).createdAt };
}

/** Folders under `root` that hold a storyboard or a film.json, skipping build output. */
export function findFilms(root, depth = 4) {
  const found = [];
  const walk = (dir, d) => {
    if (fs.existsSync(path.join(dir, 'storyboard.json')) || fs.existsSync(path.join(dir, 'film.json')) || hasBrief(dir)) { found.push(dir); return; }
    if (d >= depth) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'build', 'review', 'assets', 'source'].includes(e.name)) walk(path.join(dir, e.name), d + 1);
  };
  for (const r of root) if (fs.existsSync(r)) walk(r, 0);
  return found;
}


/** A film that is only a brief so far. */
export function briefFilm(dir, ctx) {
  const text = briefOf(dir), title = text?.match(/^#\s+(.+)$/m)?.[1] ?? path.basename(dir);
  const files = walkFiles(dir).filter(f => !/^brief\.md$/i.test(path.basename(f)));
  return { id: filmId(dir), kind: 'brief', title, folder: path.relative(process.cwd(), dir), shape: 'wide', beats: 0, versions: [],
    files: files.map(f => describeFile(f, dir, ctx.out, ctx.media, ctx.fonts)).sort(byGroup), notesTo: null, stage: stageInfo('brief'), brief: text, boards: [],
    updatedAt: fs.statSync(path.join(dir, fs.existsSync(path.join(dir, 'brief.md')) ? 'brief.md' : 'BRIEF.md')).mtime.toISOString() };
}
