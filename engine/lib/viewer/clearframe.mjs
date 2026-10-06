// Films made with ClearFrame: versions from the review record, scenes and lens boxes from the prepared job.
import fs from 'node:fs';
import path from 'node:path';
import { listRevisions, revisionVideo, loadRevision } from '../revisions.mjs';
import { readNotes, readDecisions } from '../notes.mjs';
import { FACE_SETS } from '../../../film/type.mjs';
import { FONT_DIR, readJSON, slug, rel, fileHash, duration, frameSize, frameAt } from './media.mjs';
import { describeFile, walkFiles, fileType, byGroup } from './files.mjs';
import { noteView } from './notes.mjs';
import { clearframeStage, stageInfo } from './stages.mjs';
import { boards, briefOf } from './boards.mjs';


/** Canvas font names → bundled files (mirrors text_font in scene/native/src/blocks/canvas_geometry.rs). */
export const FONT_FILES = {
  text: 'Inter-Regular.ttf', regular: 'Inter-Regular.ttf', strong: 'Inter-SemiBold.ttf', light: 'InterDisplay-Light.ttf',
  bold: 'InterDisplay-Bold.ttf', figures: 'InterDisplay-Figures.ttf', display: 'InterDisplay-SemiBold.ttf', semibold: 'InterDisplay-SemiBold.ttf',
  serif: 'InstrumentSerif-Regular.ttf', 'serif-italic': 'InstrumentSerif-Italic.ttf', italic: 'InstrumentSerif-Italic.ttf',
  mono: 'IBMPlexMono-Medium.ttf', hand: 'ArchitectsDaughter-Regular.ttf', poster: 'BebasNeue-Regular.ttf',
  'serif-display': 'DMSerifDisplay-Regular.ttf', 'serif-display-italic': 'DMSerifDisplay-Italic.ttf',
  didone: 'PlayfairDisplay-Bold.ttf', 'didone-italic': 'PlayfairDisplay-BoldItalic.ttf', wide: 'ArchivoExpanded-ExtraBold.ttf',
  geometric: 'SpaceGrotesk-Bold.ttf', 'geometric-light': 'SpaceGrotesk-Light.ttf', condensed: 'BigShouldersDisplay-ExtraBold.ttf',
};
export const bundled = (fonts, file) => fonts.add(path.join(FONT_DIR, file), { license: 'OFL-1.1', origin: 'ClearFrame' });
/** The font a canvas text element draws with (unnamed text: display when large, else body). */
export const elementFont = el => FONT_FILES[el.font] ?? (el.count ? FONT_FILES.figures : (el.size ?? 48) >= 40 ? FONT_FILES.display : FONT_FILES.text);

/** Where a text element sits on the frame, from its baseline position, size, width and anchor. */
export function textBox(el) {
  const size = el.size ?? 48, text = String(el.count ? `${el.count.prefix ?? ''}${el.count.to}${el.count.suffix ?? ''}` : el.text ?? '');
  if (el.width && el.height) return [el.x, el.y - size * .82, el.width, el.height];
  // Average advance: uppercase and figures run wider than mixed-case text; tracking adds per letter.
  const advance = el.upper || text === text.toUpperCase() && /[A-Z]/.test(text) ? .66 : el.font === 'figures' || el.count ? .6 : .52;
  const w = Math.min(el.fit ?? Infinity, text.length * size * (advance + (el.tracking ?? 0))), x = el.anchor === 'middle' ? el.x - w / 2 : el.anchor === 'end' ? el.x - w : el.x;
  return [x, el.y - size * .82, w, size * 1.05];
}

export function describeBeat(b) {
  const CHART = { stat: 'Headline figure', plot: 'Line chart', bars: 'Bar chart', distribution: 'Distribution', multiples: 'Small multiples', kpi: 'Key figure', chart: 'Chart', teaching: 'Question', sketch: 'Illustration' };
  const KIND = { title: 'Title card', endcard: 'End card', statement: 'Statement', quote: 'Quote', video: 'Video clip', image: 'Image', kinetic: 'Moving type', chapter: 'Chapter card' };
  const props = b.props ?? {}, chart = Object.keys(CHART).find(k => props[k] != null), spec = chart ? props[chart] : props;
  const onScreen = [spec?.kicker, spec?.title, spec?.label, props.support].filter(t => typeof t === 'string' && t.trim());
  return { kind: chart ? CHART[chart] : KIND[b.block] ?? (b.block === 'canvas' ? 'Graphic' : b.block.replace(/^\w/, c => c.toUpperCase())),
    onScreen: [...new Set(onScreen)].slice(0, 3), source: spec?.source ?? props.source ?? null };
}

/** Media a storyboard beat places: image and clip assets, prepared files, plates. */
export function beatMedia(b, sb, dir) {
  const ids = new Set(), files = new Set();
  JSON.stringify(b.props ?? {}, (k, v) => { if (['asset', 'plates', 'image'].includes(k) && typeof v === 'string') ids.add(v); if (k === 'file' && typeof v === 'string') files.add(v); return v; });
  for (const id of ids) {
    const a = (sb.assets ?? []).find(x => x.id === id);
    const f = a?.file ?? [`assets/img/${id}.jpg`, `assets/img/${id}.png`, `assets/clips/${id}.mp4`].find(p => fs.existsSync(path.join(dir, p)));
    if (f) files.add(f);
  }
  return [...files];
}

export function clearframeVersion(dir, sb, r, i, ctx) {
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
    sceneList.push({ number: k + 1, id: b.id, start, end, ...describeBeat(b), narration: b.vo ?? null, placeholder: b.placeholder ?? null, elements, thumb: thumb && rel(out, thumb),
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
    id: r.id, number: i + 1, profile: v.profile ?? 'draft', placeholders: r.placeholders ?? [], label: r.label ?? null, createdAt: r.createdAt, seconds, quality: { final: 'Final', draft: 'Draft', rough: 'Rough cut' }[v.profile] ?? 'Draft',
    approved: approved ? { by: approved.by ?? null, said: approved.said ?? null } : null,
    notes: notes.filter(n => n.revision === r.id).map(n => noteView(n, { pins, engine: true })),
    video: rel(out, v.file), poster: (p => p && rel(out, p))(frameAt(v.file, media, `${prefix}-poster`, settled ? settled.end - .35 : mark)),
    frame: { width: job?.width ?? 1920, height: job?.height ?? 1080 }, colors: Object.fromEntries(Object.entries(theme).filter(([k]) => k !== 'base')),
    scenes: sceneList, lanes: { narration, music, sfx: [] }, fonts: [...used].map(([font, roles]) => ({ font, roles })),
    look: { palette: theme.base ?? vsb.theme ?? 'paper', type: voice?.id ?? 'inter', format: vsb.format?.preset ?? 'landscape', fps },
  };
}

export async function clearframeFilm(dir, ctx) {
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
  const files = ['assets', 'source', 'media'].flatMap(s => walkFiles(path.join(dir, s))).filter(f => !/\.tmp\./.test(f) && fileType(f) !== 'text' || /\.(md|txt|srt|vtt)$/.test(f));
  const preset = sb.format?.preset ?? 'landscape';
  const openNotes = versions.at(-1)?.notes.filter(n => !n.resolved).length ?? 0;
  return { id, kind: 'clearframe', title, folder: path.relative(process.cwd(), dir), shape: preset === 'vertical' || preset === 'portrait' ? 'tall' : 'wide',
    beats: (sb.beats ?? []).length, versions, files: files.map(f => describeFile(f, dir, ctx.out, ctx.media, ctx.fonts)).sort(byGroup), notesTo: 'engine',
    stage: stageInfo(clearframeStage(sb, versions.at(-1), openNotes), { openNotes }), brief: briefOf(dir),
    // Before the first render, scenes are seen as boards drawn from the storyboard.
    boards: versions.length ? [] : await boards(dir, sb, ctx), updatedAt: versions.at(-1)?.createdAt ?? fs.statSync(path.join(dir, 'storyboard.json')).mtime.toISOString() };
}

