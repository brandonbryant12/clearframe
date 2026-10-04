// A self-contained HTML viewer for people who review films rather than build them:
// every film with its versions, and the library's building blocks. Static output, no server.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { listRevisions, revisionVideo, loadRevision } from './revisions.mjs';
import { readNotes, readDecisions } from './notes.mjs';
import { stillProject } from '../../fframes/render.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const UI = path.join(ROOT, 'engine/ui/viewer');
const readJSON = (f, fallback = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const rel = (from, file) => path.relative(from, file).split(path.sep).join('/');

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || null;
}

/** A settled frame for the poster: just before the end of the scene playing a third of the way in. */
function posterTime(dir, id, seconds) {
  try {
    const beats = loadRevision(dir, id).timeline.beats, mark = seconds * 0.35;
    const b = beats.find(x => x.start <= mark && x.end > mark) ?? beats[0];
    return Math.max(0, b.end - 0.35);
  } catch { return seconds * 0.35; }
}

/** One poster frame per video, cached by the video's identity. */
function poster(file, media, key, seconds, at) {
  const out = path.join(media, `${key}.jpg`);
  if (!fs.existsSync(out)) {
    at ??= Math.max(0, (seconds ?? duration(file) ?? 4) * 0.35);
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(at), '-i', file, '-frames:v', '1', '-vf', 'scale=640:-2', '-q:v', '4', out]);
  }
  return fs.existsSync(out) ? out : null;
}

/** Folders under `root` that hold a storyboard, skipping dependencies and build output. */
function findFilms(root, depth = 3) {
  const found = [];
  const walk = (dir, d) => {
    if (fs.existsSync(path.join(dir, 'storyboard.json'))) found.push(dir);
    if (d >= depth) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'build', 'review', 'assets', 'source'].includes(e.name)) walk(path.join(dir, e.name), d + 1);
  };
  walk(root, 0);
  return found;
}

const QUALITY = { final: 'Final', draft: 'Draft', rough: 'Rough cut' };

function collectFilm(dir, out, media) {
  const sb = readJSON(path.join(dir, 'storyboard.json'), {});
  const id = slug(path.relative(process.cwd(), dir));
  const notes = readNotes(dir);
  const decisions = readDecisions(dir).filter(d => d.role === 'human');
  const versions = listRevisions(dir).flatMap((r, i) => {
    const v = revisionVideo(dir, r);
    if (!v || !fs.existsSync(v.file)) return [];
    const approved = decisions.find(d => d.action === 'accept' && d.revision === r.id);
    return [{
      id: r.id, number: i + 1, label: r.label ?? null, createdAt: r.createdAt, seconds: r.duration ?? duration(v.file),
      quality: QUALITY[v.profile] ?? (r.kind === 'render' ? 'Draft' : 'Snapshot'),
      approved: approved ? { by: approved.by ?? null, said: approved.said ?? null, checkpoint: approved.checkpoint ?? null } : null,
      notes: notes.filter(n => n.revision === r.id).map(n => ({ text: n.text, by: n.by ?? null, status: n.status ?? 'open', at: n.at ?? null })),
      video: rel(out, v.file), poster: (p => p && rel(out, p))(poster(v.file, media, `${id}-${r.id}-${v.sha256.slice(0, 8)}-s`, r.duration, posterTime(dir, r.id, r.duration ?? 4))),
    }];
  });
  // A project rendered before versions existed still shows its latest video.
  const loose = path.join(dir, 'build/video.mp4');
  if (!versions.length && fs.existsSync(loose)) {
    const stat = fs.statSync(loose), seconds = duration(loose);
    versions.push({ id: 'latest', number: 1, label: null, createdAt: stat.mtime.toISOString(), seconds, quality: 'Draft', approved: null, notes: [],
      video: rel(out, loose), poster: (p => p && rel(out, p))(poster(loose, media, `${id}-latest-${hash(String(stat.mtimeMs))}`, seconds)) });
  }
  if (!versions.length) return null;
  const preset = sb.format?.preset ?? 'landscape';
  return { id, title: sb.title ?? path.basename(dir), folder: path.relative(process.cwd(), dir), shape: preset === 'vertical' || preset === 'portrait' ? 'tall' : 'wide',
    beats: (sb.beats ?? []).length, versions };
}

/** Chart template thumbnails: one still at the end of each beat, cached by beat content. */
async function chartTemplates(out, media, { render = true } = {}) {
  const kit = path.join(ROOT, 'examples/finance-charts');
  const readme = fs.existsSync(path.join(kit, 'README.md')) ? fs.readFileSync(path.join(kit, 'README.md'), 'utf8') : '';
  const uses = Object.fromEntries([...readme.matchAll(/^\| `([a-z-]+)` \| ([^|]+) \| ([^|]+) \|$/gm)].map(m => [m[1], { pattern: m[2].trim(), use: m[3].trim() }]));
  const templates = [];
  for (const shape of ['landscape', 'vertical']) {
    const file = path.join(kit, `storyboard-${shape}.json`);
    const sb = readJSON(file);
    if (!sb) continue;
    const work = path.join(out, 'work', `charts-${shape}`);
    fs.mkdirSync(work, { recursive: true });
    fs.writeFileSync(path.join(work, 'storyboard.json'), JSON.stringify(sb));
    let t = 0;
    for (const b of sb.beats) {
      t += b.duration;
      const key = `chart-${shape}-${b.id}-${hash(JSON.stringify(b))}`, img = path.join(media, `${key}.png`);
      if (render && !fs.existsSync(img)) {
        try { await stillProject(work, { draft: true, at: t - 0.3, out: img }); } catch (e) { console.error(`viewer: ${b.id} (${shape}): ${e.message}`); }
      }
      const kind = Object.keys(b.props ?? {}).find(k => ['stat', 'plot', 'bars', 'distribution'].includes(k));
      const spec = b.props?.[kind] ?? {};
      templates.push({ id: b.id, shape, kind, title: spec.title ?? spec.kicker ?? b.id, pattern: uses[b.id]?.pattern ?? '', use: uses[b.id]?.use ?? '',
        image: fs.existsSync(img) ? rel(out, img) : null, snippet: JSON.stringify(b, null, 2) });
    }
  }
  return templates;
}

function palettes() {
  const dir = path.join(ROOT, 'library/palettes');
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.startsWith('_')).map(f => {
    const p = readJSON(path.join(dir, f), {});
    return { id: f.replace(/\.json$/, ''), order: p.order ?? 999, notes: p.notes ?? '', colors: p.colors ?? {} };
  }).sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

function elements3d(out) {
  const dir = path.join(ROOT, 'examples/sculptures');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(d => fs.existsSync(path.join(dir, d, 'asset.json'))).map(d => {
    const a = readJSON(path.join(dir, d, 'asset.json'), {});
    return { id: d, title: a.title ?? d, use: a.use ?? '', description: a.description ?? '', loop: a.loop === true,
      poster: rel(out, path.join(dir, d, a.poster ?? 'poster.png')), video: rel(out, path.join(dir, d, a.file ?? 'clip.mp4')) };
  });
}

export async function buildViewer({ root = 'examples', out = 'build/viewer', render = true } = {}) {
  root = path.resolve(root); out = path.resolve(out);
  const media = path.join(out, 'media');
  fs.mkdirSync(media, { recursive: true });
  const films = findFilms(root).map(d => collectFilm(d, out, media)).filter(Boolean)
    .sort((a, b) => Date.parse(b.versions.at(-1).createdAt) - Date.parse(a.versions.at(-1).createdAt));
  const data = { generatedAt: new Date().toISOString(), root: path.relative(process.cwd(), root) || '.', films,
    library: { charts: await chartTemplates(out, media, { render }), palettes: palettes(), elements: elements3d(out) } };
  const html = fs.readFileSync(path.join(UI, 'index.html'), 'utf8')
    .replace('/*STYLE*/', () => fs.readFileSync(path.join(UI, 'style.css'), 'utf8'))
    .replace('/*APP*/', () => fs.readFileSync(path.join(UI, 'app.js'), 'utf8'))
    .replace('"/*DATA*/"', () => JSON.stringify(data).replace(/</g, '\\u003c'));
  const file = path.join(out, 'index.html');
  fs.writeFileSync(file, html);
  return { file, films: films.length, versions: films.reduce((n, f) => n + f.versions.length, 0), charts: data.library.charts.length };
}
