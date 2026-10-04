// A self-contained HTML viewer for people who review films rather than build them:
// every film with its versions, what each moment is made of (scenes, text, fonts, colours,
// narration, music, sound, media), notes pinned to the picture, and the library's building
// blocks. Works as a double-clicked file; `serveViewer` adds saving notes.
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { listRevisions, revisionVideo, loadRevision } from './revisions.mjs';
import { readNotes, readDecisions, addNote } from './notes.mjs';
import { stillProject } from '../../fframes/render.mjs';
import { FACE_SETS } from '../../fframes/type.mjs';

const ROOT = path.resolve(new URL('../..', import.meta.url).pathname);
const UI = path.join(ROOT, 'engine/ui/viewer');
const FONT_DIR = path.join(ROOT, 'fframes/assets/fonts');
const readJSON = (f, fallback = null) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return fallback; } };
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'item';
const hash = s => crypto.createHash('sha256').update(s).digest('hex').slice(0, 12);
const rel = (from, file) => path.relative(from, file).split(path.sep).join('/');
const fileHash = f => { const s = fs.statSync(f); return hash(`${f}:${s.size}:${s.mtimeMs}`); };

function duration(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  return Number(r.stdout.trim()) || null;
}
function frameSize(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', file], { encoding: 'utf8' });
  const [width, height] = r.stdout.trim().split(',').map(Number);
  return width && height ? { width, height } : null;
}
/** One still from a video at `at` seconds, cached under `key`. */
function frameAt(file, media, key, at, width = 640) {
  const out = path.join(media, `${key}.jpg`);
  if (!fs.existsSync(out))
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-ss', String(Math.max(0, at)), '-i', file, '-frames:v', '1', '-vf', `scale=${width}:-2`, '-q:v', '4', out]);
  return fs.existsSync(out) ? out : null;
}
function waveform(file, media) {
  const out = path.join(media, `wave-${fileHash(file)}.png`);
  if (!fs.existsSync(out))
    spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', file, '-filter_complex', 'aformat=channel_layouts=mono,showwavespic=s=1200x140:colors=0x4fc1b0', '-frames:v', '1', out]);
  return fs.existsSync(out) ? out : null;
}

// ------------------------------------------------------------------ files and fonts

const TYPES = [
  ['image', /\.(png|jpe?g|webp|gif|avif|bmp)$/i], ['svg', /\.svg$/i], ['video', /\.(mp4|mov|webm|m4v)$/i],
  ['audio', /\.(wav|mp3|m4a|aac|ogg|flac|aiff?)$/i], ['font', /\.(ttf|otf|woff2?)$/i], ['text', /\.(json|jsonl|md|txt|csv|ya?ml|srt|vtt)$/i],
  ['document', /\.pdf$/i], ['model', /\.(blend|glb|gltf|obj|fbx|usdz?|vdb|abc)$/i],
];
export const fileType = f => TYPES.find(([, re]) => re.test(f))?.[0] ?? 'other';
const GROUPS = { image: 'Images', svg: 'Vector art', video: 'Video', audio: 'Audio', font: 'Fonts', text: 'Text and data', document: 'Documents', model: '3D and simulation', other: 'Other files' };
const FONT_MIME = { '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff': 'font/woff', '.woff2': 'font/woff2' };

/** Fonts used anywhere in the page, embedded once in fonts.css so specimens work from a plain file. */
class FontRegistry {
  constructor() { this.fonts = new Map(); }
  add(file, { family, style, license, origin } = {}) {
    const abs = path.resolve(file);
    if (!fs.existsSync(abs)) return null;
    const id = `f${hash(abs)}`;
    if (!this.fonts.has(id)) {
      const parts = path.basename(abs).replace(/\.[^.]+$/, '').split('-'), words = s => s.replace(/([a-z])([A-Z])/g, '$1 $2');
      this.fonts.set(id, { id, family: family ?? words(parts[0]), style: style ?? words(parts[1] ?? 'Regular'), file: abs, license: license ?? null,
        origin: origin ?? null, size: fs.statSync(abs).size, films: new Set(), uses: new Set() });
    }
    return this.fonts.get(id);
  }
  css() {
    return [...this.fonts.values()].map(f => `@font-face{font-family:"${f.id}";src:url(data:${FONT_MIME[path.extname(f.file).toLowerCase()] ?? 'font/ttf'};base64,${fs.readFileSync(f.file).toString('base64')});font-display:block}`).join('\n');
  }
  list(out) {
    return [...this.fonts.values()].map(f => ({ id: f.id, family: f.family, style: f.style, license: f.license, origin: f.origin, size: f.size,
      path: rel(out, f.file), name: path.basename(f.file), films: [...f.films], uses: [...f.uses] }));
  }
}

function describeFile(file, base, out, media, fonts) {
  const type = fileType(file), size = fs.statSync(file).size, name = path.relative(base, file).split(path.sep).join('/');
  const info = { name, type, group: GROUPS[type], path: rel(out, file), size };
  if (type === 'audio') { info.seconds = duration(file); info.wave = (w => w && rel(out, w))(waveform(file, media)); }
  if (type === 'video') { info.seconds = duration(file); info.poster = (p => p && rel(out, p))(frameAt(file, media, `clip-${fileHash(file)}`, Math.min(1, (info.seconds ?? 2) / 2), 480)); }
  if (type === 'text') info.preview = fs.readFileSync(file, 'utf8').slice(0, 4000);
  if (type === 'font') info.font = fonts.add(file, { origin: 'project' })?.id ?? null;
  // Audio placed by role, the way a reviewer thinks about it.
  if (type === 'audio') info.group = /(^|\/)vo\//.test(name) ? 'Narration' : /(^|\/)music\//.test(name) ? 'Music' : /(^|\/)sfx\//.test(name) ? 'Sound effects' : /^source\//.test(name) ? 'Recordings' : 'Audio';
  return info;
}

const GROUP_ORDER = ['Video', 'Images', 'Vector art', 'Narration', 'Music', 'Sound effects', 'Recordings', 'Audio', 'Fonts', '3D and simulation', 'Documents', 'Text and data', 'Other files'];
const byGroup = (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group) || a.name.localeCompare(b.name);

function walkFiles(dir, skip = new Set()) {
  const files = [];
  const walk = d => {
    if (!fs.existsSync(d)) return;
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name.startsWith('.') || skip.has(e.name)) continue;
      const f = path.join(d, e.name);
      if (e.isDirectory()) walk(f); else files.push(f);
    }
  };
  walk(dir);
  return files;
}

// ------------------------------------------------------------------ ClearFrame films

/** Canvas font names → bundled files (mirrors text_font in fframes/native/src/canvas_geometry.rs). */
const FONT_FILES = {
  text: 'Inter-Regular.ttf', regular: 'Inter-Regular.ttf', strong: 'Inter-SemiBold.ttf', light: 'InterDisplay-Light.ttf',
  bold: 'InterDisplay-Bold.ttf', figures: 'InterDisplay-Figures.ttf', display: 'InterDisplay-SemiBold.ttf', semibold: 'InterDisplay-SemiBold.ttf',
  serif: 'InstrumentSerif-Regular.ttf', 'serif-italic': 'InstrumentSerif-Italic.ttf', italic: 'InstrumentSerif-Italic.ttf',
  mono: 'IBMPlexMono-Medium.ttf', hand: 'ArchitectsDaughter-Regular.ttf', poster: 'BebasNeue-Regular.ttf',
  'serif-display': 'DMSerifDisplay-Regular.ttf', 'serif-display-italic': 'DMSerifDisplay-Italic.ttf',
  didone: 'PlayfairDisplay-Bold.ttf', 'didone-italic': 'PlayfairDisplay-BoldItalic.ttf', wide: 'ArchivoExpanded-ExtraBold.ttf',
  geometric: 'SpaceGrotesk-Bold.ttf', 'geometric-light': 'SpaceGrotesk-Light.ttf', condensed: 'BigShouldersDisplay-ExtraBold.ttf',
};
const bundled = (fonts, file) => fonts.add(path.join(FONT_DIR, file), { license: 'OFL-1.1', origin: 'ClearFrame' });
/** The font a canvas text element draws with (unnamed text: display when large, else body). */
const elementFont = el => FONT_FILES[el.font] ?? (el.count ? FONT_FILES.figures : (el.size ?? 48) >= 40 ? FONT_FILES.display : FONT_FILES.text);

/** Where a text element sits on the frame, from its baseline position, size, width and anchor. */
function textBox(el) {
  const size = el.size ?? 48, text = String(el.count ? `${el.count.prefix ?? ''}${el.count.to}${el.count.suffix ?? ''}` : el.text ?? '');
  if (el.width && el.height) return [el.x, el.y - size * .82, el.width, el.height];
  // Average advance: uppercase and figures run wider than mixed-case text; tracking adds per letter.
  const advance = el.upper || text === text.toUpperCase() && /[A-Z]/.test(text) ? .66 : el.font === 'figures' || el.count ? .6 : .52;
  const w = Math.min(el.fit ?? Infinity, text.length * size * (advance + (el.tracking ?? 0))), x = el.anchor === 'middle' ? el.x - w / 2 : el.anchor === 'end' ? el.x - w : el.x;
  return [x, el.y - size * .82, w, size * 1.05];
}

function describeBeat(b) {
  const CHART = { stat: 'Headline figure', plot: 'Line chart', bars: 'Bar chart', distribution: 'Distribution', multiples: 'Small multiples', kpi: 'Key figure', chart: 'Chart', teaching: 'Question', sketch: 'Illustration' };
  const KIND = { title: 'Title card', endcard: 'End card', statement: 'Statement', quote: 'Quote', video: 'Video clip', image: 'Image', kinetic: 'Moving type', chapter: 'Chapter card' };
  const props = b.props ?? {}, chart = Object.keys(CHART).find(k => props[k] != null), spec = chart ? props[chart] : props;
  const onScreen = [spec?.kicker, spec?.title, spec?.label, props.support].filter(t => typeof t === 'string' && t.trim());
  return { kind: chart ? CHART[chart] : KIND[b.block] ?? (b.block === 'canvas' ? 'Graphic' : b.block.replace(/^\w/, c => c.toUpperCase())),
    onScreen: [...new Set(onScreen)].slice(0, 3), source: spec?.source ?? props.source ?? null };
}

/** Media a storyboard beat places: image and clip assets, prepared files, plates. */
function beatMedia(b, sb, dir) {
  const ids = new Set(), files = new Set();
  JSON.stringify(b.props ?? {}, (k, v) => { if (['asset', 'plates', 'image'].includes(k) && typeof v === 'string') ids.add(v); if (k === 'file' && typeof v === 'string') files.add(v); return v; });
  for (const id of ids) {
    const a = (sb.assets ?? []).find(x => x.id === id);
    const f = a?.file ?? [`assets/img/${id}.jpg`, `assets/img/${id}.png`, `assets/clips/${id}.mp4`].find(p => fs.existsSync(path.join(dir, p)));
    if (f) files.add(f);
  }
  return [...files];
}

function clearframeVersion(dir, sb, r, i, ctx) {
  const { out, media, fonts, notes, decisions, pins, film } = ctx;
  const v = revisionVideo(dir, r);
  if (!v || !fs.existsSync(v.file)) return null;
  let timeline = null;
  try { timeline = loadRevision(dir, r.id).timeline; } catch {}
  const vsb = readJSON(path.join(dir, r.inputs?.['storyboard.json'] ?? ''), sb);
  const job = r.job ? readJSON(path.join(dir, r.job)) : null;
  const fps = job?.fps ?? timeline?.fps ?? 30, prefix = `${film}-${r.id}-${v.sha256.slice(0, 8)}`;
  const theme = job?.theme ?? {};
  const voice = job?.type ?? null, faces = FACE_SETS[voice?.display ?? 'inter'];
  const used = new Map(), use = (file, role) => { const f = bundled(fonts, file); if (f) { used.set(f.id, [...new Set([...(used.get(f.id) ?? []), role])]); f.uses.add(role); } return f; };
  use('Inter-Regular.ttf', 'Body text, labels and sources');
  const narration = [], sceneList = [];
  let t = 0;
  for (const [k, b] of (vsb.beats ?? []).entries()) {
    const jb = job?.beats?.find(x => x.id === b.id), tb = timeline?.beats?.find(x => x.id === b.id);
    const start = jb ? jb.start_frame / fps : tb?.start ?? t, end = jb ? (jb.start_frame + jb.frames) / fps : tb?.end ?? t + (b.duration ?? 4);
    t = end;
    for (const c of jb?.captions ?? []) narration.push({ start: start + c.start, end: start + c.end, text: c.text });
    const elements = [];
    for (const el of jb?.props?.elements ?? []) {
      if (el.type !== 'text' || !String(el.text ?? '').trim()) continue;
      const f = use(elementFont(el), ['title', 'endcard'].includes(b.block) ? 'Titles and headlines' : 'Graphics and charts');
      elements.push({ id: el.id, text: el.count ? `${el.count.prefix ?? ''}${el.count.to}${el.count.suffix ?? ''}` : el.text, font: f?.id ?? null,
        size: Math.round(el.size ?? 48), color: { token: el.fill ?? 'ink', hex: theme[el.fill] ?? (String(el.fill).startsWith('#') ? el.fill : theme.ink ?? null) },
        box: textBox(el).map(n => Math.round(n)), at: start + (el.at ?? 0) });
    }
    if (['title', 'endcard', 'statement', 'quote', 'chapter', 'kinetic'].includes(b.block)) { use(faces.bold, 'Titles and headlines'); use(faces.regular, 'Titles and headlines'); }
    const thumb = frameAt(v.file, media, `${prefix}-scene-${slug(b.id)}`, end - 0.35, 480);
    sceneList.push({ number: k + 1, id: b.id, start, end, ...describeBeat(b), narration: b.vo ?? null, elements, thumb: thumb && rel(out, thumb),
      media: beatMedia(b, vsb, dir) });
  }
  if (voice?.emphasis === 'weight') use(faces.light, 'Headline emphasis');
  if (voice?.emphasis === 'serif') use('InstrumentSerif-Italic.ttf', 'Headline emphasis');
  for (const id of used.keys()) fonts.fonts.get(id).films.add(ctx.title);
  const seconds = r.duration ?? duration(v.file);
  const bed = readJSON(path.join(dir, 'assets/music/bed.json'));
  const music = vsb.music && bed?.file && fs.existsSync(path.join(dir, bed.file)) ? [{ start: 0, end: seconds, name: `Music bed (${bed.provider === 'local' ? 'draft' : bed.provider ?? 'generated'})`, asset: bed.file }] : [];
  const mark = seconds * .35, settled = sceneList.find(s => s.start <= mark && s.end > mark) ?? sceneList[0];
  const approved = decisions.find(d => d.action === 'accept' && d.revision === r.id);
  return {
    id: r.id, number: i + 1, label: r.label ?? null, createdAt: r.createdAt, seconds, quality: { final: 'Final', draft: 'Draft', rough: 'Rough cut' }[v.profile] ?? 'Draft',
    approved: approved ? { by: approved.by ?? null, said: approved.said ?? null } : null,
    notes: notes.filter(n => n.revision === r.id).map(n => ({ id: n.id, text: n.text, by: n.author?.name ?? n.author ?? null, status: n.status ?? 'open',
      at: n.anchor?.at ?? null, element: n.anchor?.element ?? pins[n.id]?.element ?? null, pin: pins[n.id]?.x != null ? { x: pins[n.id].x, y: pins[n.id].y } : null, createdAt: n.createdAt })),
    video: rel(out, v.file), poster: (p => p && rel(out, p))(frameAt(v.file, media, `${prefix}-poster`, settled ? settled.end - .35 : mark)),
    frame: { width: job?.width ?? 1920, height: job?.height ?? 1080 }, colors: Object.fromEntries(Object.entries(theme).filter(([k]) => k !== 'base')),
    scenes: sceneList, lanes: { narration, music, sfx: [] }, fonts: [...used].map(([font, roles]) => ({ font, roles })),
    look: { palette: theme.base ?? vsb.theme ?? 'paper', type: voice?.id ?? 'inter', format: vsb.format?.preset ?? 'landscape', fps },
  };
}

function clearframeFilm(dir, ctx) {
  const sb = readJSON(path.join(dir, 'storyboard.json'), {});
  const id = slug(path.relative(process.cwd(), dir)), title = sb.title ?? path.basename(dir);
  const fctx = { ...ctx, notes: readNotes(dir), decisions: readDecisions(dir).filter(d => d.role === 'human'), pins: readJSON(path.join(dir, 'review/viewer-pins.json'), {}), film: id, title };
  const versions = listRevisions(dir).map((r, i) => clearframeVersion(dir, sb, r, i, fctx)).filter(Boolean).map((v, i) => ({ ...v, number: i + 1 }));
  // Sound cues describe the latest build only.
  const cues = readJSON(path.join(dir, 'build/cues.json'), []);
  if (versions.length && Array.isArray(cues)) versions.at(-1).lanes.sfx = cues.map(c => ({ t: c.t, name: c.name }));
  const loose = path.join(dir, 'build/video.mp4');
  if (!versions.length && fs.existsSync(loose)) {
    const seconds = duration(loose), stat = fs.statSync(loose);
    versions.push({ id: 'latest', number: 1, label: null, createdAt: stat.mtime.toISOString(), seconds, quality: 'Draft', approved: null, notes: [],
      video: rel(ctx.out, loose), poster: (p => p && rel(ctx.out, p))(frameAt(loose, ctx.media, `${id}-latest-${fileHash(loose)}`, seconds * .35)),
      frame: frameSize(loose) ?? { width: 1920, height: 1080 }, colors: {}, scenes: [], lanes: { narration: [], music: [], sfx: [] }, fonts: [], look: {} });
  }
  if (!versions.length) return null;
  const files = ['assets', 'source', 'media'].flatMap(s => walkFiles(path.join(dir, s))).filter(f => !/\.tmp\./.test(f) && fileType(f) !== 'text' || /\.(md|txt|srt|vtt)$/.test(f));
  const preset = sb.format?.preset ?? 'landscape';
  return { id, kind: 'clearframe', title, folder: path.relative(process.cwd(), dir), shape: preset === 'vertical' || preset === 'portrait' ? 'tall' : 'wide',
    beats: (sb.beats ?? []).length, versions, files: files.map(f => describeFile(f, dir, ctx.out, ctx.media, ctx.fonts)).sort(byGroup), notesTo: 'engine' };
}

// ------------------------------------------------------------------ films from elsewhere

/** A film made outside ClearFrame, described by film.json: versions, scenes, lanes, fonts and files. */
function manifestFilm(dir, ctx) {
  const m = readJSON(path.join(dir, 'film.json'));
  if (!m?.versions?.length) return null;
  const { out, media, fonts } = ctx, id = slug(path.relative(process.cwd(), dir)), title = m.title ?? path.basename(dir);
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
      notes: notes.filter(n => n.version === vid).map(n => ({ id: n.id, text: n.text, by: n.by ?? null, status: n.status ?? 'open', at: n.at ?? null, element: n.element ?? null, pin: n.pin ?? null, createdAt: n.createdAt })),
      video: rel(out, file), poster: (p => p && rel(out, p))(frameAt(file, media, `${prefix}-poster`, v.posterAt ?? seconds * .8)),
      frame, colors: m.palette ?? {}, scenes, lanes: { narration: lanes.narration ?? [], music: lanes.music ?? [], sfx: lanes.sfx ?? [] },
      fonts: i === m.versions.length - 1 ? fontList.map(x => ({ font: x.entry.id, roles: x.roles })) : [], look: m.look ?? {} };
  }).filter(Boolean);
  if (!versions.length) return null;
  const versionFiles = new Set(m.versions.map(v => path.join(dir, v.file)));
  const files = walkFiles(dir).filter(f => !versionFiles.has(f) && !['film.json', 'notes.json'].includes(path.basename(f)));
  return { id, kind: 'external', title, folder: path.relative(process.cwd(), dir), shape: (versions.at(-1).frame.height > versions.at(-1).frame.width) ? 'tall' : 'wide',
    beats: versions.at(-1).scenes.length, versions, files: files.map(f => describeFile(f, dir, out, media, fonts)).sort(byGroup), notesTo: 'film', about: m.about ?? null };
}

/** Folders under `root` that hold a storyboard or a film.json, skipping build output. */
function findFilms(root, depth = 4) {
  const found = [];
  const walk = (dir, d) => {
    if (fs.existsSync(path.join(dir, 'storyboard.json')) || fs.existsSync(path.join(dir, 'film.json'))) { found.push(dir); return; }
    if (d >= depth) return;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && !e.name.startsWith('.') && !['node_modules', 'build', 'review', 'assets', 'source'].includes(e.name)) walk(path.join(dir, e.name), d + 1);
  };
  for (const r of root) if (fs.existsSync(r)) walk(r, 0);
  return found;
}

// ------------------------------------------------------------------ library

async function chartTemplates(out, media, { render = true } = {}) {
  const kit = path.join(ROOT, 'examples/finance-charts');
  const readme = fs.existsSync(path.join(kit, 'README.md')) ? fs.readFileSync(path.join(kit, 'README.md'), 'utf8') : '';
  const uses = Object.fromEntries([...readme.matchAll(/^\| `([a-z-]+)` \| ([^|]+) \| ([^|]+) \|$/gm)].map(m => [m[1], { pattern: m[2].trim(), use: m[3].trim() }]));
  const templates = [];
  for (const shape of ['landscape', 'vertical']) {
    const sb = readJSON(path.join(kit, `storyboard-${shape}.json`));
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
      const kind = Object.keys(b.props ?? {}).find(k => ['stat', 'plot', 'bars', 'distribution', 'multiples'].includes(k));
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

export async function buildViewer({ root = ['examples', 'real-examples'], out = 'build/viewer', render = true } = {}) {
  const roots = (Array.isArray(root) ? root : [root]).map(r => path.resolve(r));
  out = path.resolve(out);
  const media = path.join(out, 'media');
  fs.mkdirSync(media, { recursive: true });
  const fonts = new FontRegistry();
  for (const f of fs.readdirSync(FONT_DIR).filter(f => f.endsWith('.ttf'))) bundled(fonts, f);
  const ctx = { out, media, fonts };
  const films = findFilms(roots).map(d => fs.existsSync(path.join(d, 'film.json')) ? manifestFilm(d, ctx) : clearframeFilm(d, ctx)).filter(Boolean)
    .sort((a, b) => Date.parse(b.versions.at(-1).createdAt) - Date.parse(a.versions.at(-1).createdAt));
  const data = { generatedAt: new Date().toISOString(), roots: roots.map(r => path.relative(process.cwd(), r) || '.'), films,
    library: { charts: await chartTemplates(out, media, { render }), palettes: palettes(), elements: elements3d(out), fonts: fonts.list(out) } };
  fs.writeFileSync(path.join(out, 'fonts.css'), fonts.css());
  const html = fs.readFileSync(path.join(UI, 'index.html'), 'utf8')
    .replace('/*STYLE*/', () => fs.readFileSync(path.join(UI, 'style.css'), 'utf8'))
    .replace('/*APP*/', () => fs.readFileSync(path.join(UI, 'app.js'), 'utf8'))
    .replace('"/*DATA*/"', () => JSON.stringify(data).replace(/</g, '\\u003c'));
  const file = path.join(out, 'index.html');
  fs.writeFileSync(file, html);
  return { file, films: films.length, versions: films.reduce((n, f) => n + f.versions.length, 0), charts: data.library.charts.length, fonts: data.library.fonts.length,
    dirs: Object.fromEntries(findFilms(roots).map(d => [slug(path.relative(process.cwd(), d)), d])) };
}

// ------------------------------------------------------------------ saving notes

/** Record a note from the viewer: into the engine's review record, or the film's notes.json. */
export function saveNote(dir, { version, at, text, by, element, pin }) {
  if (typeof text !== 'string' || !text.trim() || text.length > 2000) throw new Error('A note needs text (up to 2,000 characters).');
  if (pin != null && !(Number.isFinite(pin.x) && Number.isFinite(pin.y) && pin.x >= 0 && pin.x <= 1 && pin.y >= 0 && pin.y <= 1)) throw new Error('pin needs x and y between 0 and 1');
  if (fs.existsSync(path.join(dir, 'film.json'))) {
    const file = path.join(dir, 'notes.json'), data = readJSON(file, { notes: [] });
    const note = { id: `n${String(data.notes.length + 1).padStart(3, '0')}`, version, at: Number(at) || 0, text: text.trim(), by: by || null, element: element ?? null,
      pin: pin ?? null, status: 'open', createdAt: new Date().toISOString() };
    data.notes.push(note);
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    return note;
  }
  const args = { text, revision: version === 'latest' ? undefined : version, at: Number(at) || 0, by: by || undefined, via: 'viewer' };
  // Authored elements anchor in the engine; generated chart parts anchor to the moment, and the viewer keeps the element.
  let note;
  try { note = addNote(dir, { ...args, element: element ?? undefined }); }
  catch (e) { if (element == null || !/has no element/.test(e.message)) throw e; note = addNote(dir, args); }
  if (pin || element) {
    const file = path.join(dir, 'review/viewer-pins.json'), pins = readJSON(file, {});
    pins[note.id] = { ...(pin ?? {}), ...(element ? { element } : {}) };
    fs.writeFileSync(file, JSON.stringify(pins, null, 2) + '\n');
  }
  return { id: note.id, text: note.text, by: note.author?.name ?? by ?? null, status: note.status, at: note.anchor?.at ?? at, element: note.anchor?.element ?? element ?? null, pin: pin ?? null, createdAt: note.createdAt };
}

/** Serve the viewer on localhost so notes save straight into each film's record. */
export async function serveViewer({ root, out = 'build/viewer', port = 4317, render = true } = {}) {
  const base = process.cwd(), built = await buildViewer({ root, out, render });
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.mov': 'video/quicktime', '.webm': 'video/webm', '.wav': 'audio/wav', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.ttf': 'font/ttf', '.otf': 'font/otf', '.woff2': 'font/woff2', '.pdf': 'application/pdf' };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const reply = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
    if (url.pathname === '/api/ping') return reply(200, { ok: true });
    if (url.pathname === '/api/notes' && req.method === 'POST') {
      let raw = '';
      req.on('data', c => { raw += c; if (raw.length > 1e5) req.destroy(); });
      req.on('end', () => {
        try {
          const body = JSON.parse(raw), dir = built.dirs[body.film];
          if (!dir) return reply(404, { error: 'Unknown film' });
          reply(200, saveNote(dir, body));
        } catch (e) { reply(400, { error: e.message }); }
      });
      return;
    }
    // Static files under the working folder only; ranges so videos scrub.
    const file = path.resolve(base, '.' + decodeURIComponent(url.pathname === '/' ? `/${rel(base, built.file)}` : url.pathname));
    if (!file.startsWith(base + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); return res.end('Not found'); }
    const size = fs.statSync(file).size, type = types[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
    const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? '');
    if (range) {
      const start = range[1] ? Number(range[1]) : 0, end = range[2] ? Number(range[2]) : size - 1;
      res.writeHead(206, { 'content-type': type, 'content-range': `bytes ${start}-${end}/${size}`, 'accept-ranges': 'bytes', 'content-length': end - start + 1 });
      return fs.createReadStream(file, { start, end }).pipe(res);
    }
    res.writeHead(200, { 'content-type': type, 'content-length': size, 'accept-ranges': 'bytes' });
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve, reject) => {
    server.once('error', e => reject(e.code === 'EADDRINUSE' ? new Error(`Port ${port} is in use (another viewer may be running). Stop it or pass --port.`) : e));
    server.listen(port, '127.0.0.1', resolve);
  });
  return { server, url: `http://127.0.0.1:${port}/${rel(base, built.file)}`, ...built };
}
