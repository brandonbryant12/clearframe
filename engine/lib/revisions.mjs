// Review revisions: immutable records of what a person could watch. A revision keeps the
// authored storyboard, every input file (content-addressed in review/objects), the prepared
// job, a review timeline (beats, words, source mapping, fingerprints) and the receipts of
// what was rendered from it. Diffs between revisions say what changed in content, what only
// looks different because of a neighbour or a film setting, and what merely moved in time.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { prepareProject, prepareProjectSync } from '../../fframes/prepare.mjs';
import { planTakes } from './takes.mjs';
import { loadStoryboard } from './project.mjs';
import { isRecorded, sourceSegments, readEdits } from './recording.mjs';
import {
  ID,
  canonical,
  checkId,
  fingerprint,
  nextId,
  objectFile,
  putObject,
  readJSONFile,
  restoreObject,
  reviewPath,
  sha256,
  sha256File,
  withLock,
  writeAtomic,
  writeJSONAtomic,
} from './store.mjs';

const round = (n, d = 3) => Math.round(n * 10 ** d) / 10 ** d;
export const PRINT_SCHEME = 2;
const revDir = (root, id) => reviewPath(root, 'revisions', checkId('revision', id));

// Keys of a beat that make its picture (a "keep picture" covers these and the media they use).
const PICTURE_KEYS = [
  'block',
  'props',
  'art',
  'plate',
  'camera',
  'tone',
  'transition',
  'exit',
  'motion',
  'textMotion',
  'heading',
  'label',
  'lens',
  'transitionColor',
  'transitionOrigin',
  'placeholder',
];
// Film settings that make the look (a "keep look" covers these).
const LOOK_KEYS = ['format', 'theme', 'motion', 'transition', 'backdrop', 'chrome', 'captions', 'treatment', 'frame', 'heading', 'textMotion', 'texture', 'lens', 'speakers'];
const SOUND_KEYS = ['music', 'mix', 'sfx'];
// What a "keep facts" protects: everything a beat shows as information (figures, category
// labels, units and formats, qualifiers, titles, scale limits, attribution) and the sources it
// cites. Excluded, by key, is only what places, styles, times or identifies things, plus
// purely decorative elements. Relevance is never inferred from the presence of digits.
const NOT_FACT = new Set(
  `x y w h r cx cy rx ry x1 y1 x2 y2 size width height points d box view viewFrom viewAt viewDur viewDrift viewTall
   viewNext depth z rotate origin tilt fit leading tracking stagger dash arrow head anchor align columns cols orientation
   layout gap padding radius minScale maxScale offset closed spin perspective shade marks arcs bars step
   fill stroke color opacity blend cap join font upper material glow shadow blur rough mosaic echo shine treatment side
   drift emphasisStyle mode preset ease tone emphasis highlight phrases sort dim style kind shape
   at dur dist say exitSay land growSay drawSay enter exit exitAt exitDur keys loop along morphDur fps period speed seed
   maxWords maxGap maxDuration intensity amount dolly focus
   id type asset file sketch world plates subject behind icon name carried note`
    .split(/\s+/)
    .filter(Boolean),
);
const DECORATIVE = new Set(['particles', 'solid', 'spotlight', 'meter']);
export function factsOf(value, key = '') {
  if (value == null || typeof value === 'boolean') return [];
  if (typeof value === 'number' || typeof value === 'string') return NOT_FACT.has(key) ? [] : [[key, value]];
  if (Array.isArray(value)) return value.flatMap(v => factsOf(v, key));
  if (typeof value === 'object') {
    if (DECORATIVE.has(value.type)) return [];
    // A canvas element's `note` is an author's comment; a chart's `note` is shown on screen.
    return Object.keys(value)
      .sort()
      .flatMap(k => (NOT_FACT.has(k) && !(k === 'note' && value[k] && typeof value[k] === 'object') ? [] : factsOf(value[k], k)));
  }
  return [];
}
/** A beat's facts as one fingerprint: what it shows as information, and the sources it cites. */
export const factsPrint = (beat, sources = []) =>
  fingerprint({ shown: factsOf({ props: beat.props, art: beat.art }), sources: citedSources(beat, sources) });

/** The film's source entries a beat's attribution names (by title, id or URL). */
export function citedSources(beat, sources = []) {
  const said = [beat.props?.source, beat.props?.chart?.source]
    .filter(s => typeof s === 'string')
    .join(' ')
    .toLowerCase();
  if (!said.trim()) return [];
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return sources.filter(
    s =>
      (s.title && said.includes(String(s.title).toLowerCase())) ||
      (s.url && said.includes(String(s.url).toLowerCase())) ||
      (s.id && new RegExp(`(^|[^\\w])${esc(String(s.id).toLowerCase())}($|[^\\w])`).test(said)),
  );
}

function elementIds(beat) {
  const ids = [];
  const walk = list =>
    (list ?? []).forEach(el => {
      if (el && typeof el === 'object') {
        if (typeof el.id === 'string') ids.push(el.id);
        walk(el.children);
      }
    });
  walk(beat.props?.elements);
  walk(beat.art?.under);
  walk(beat.art?.over);
  return [...new Set(ids)];
}

/** Staged media keys (content hashes) a prepared job beat draws. */
function mediaKeys(jb) {
  const keys = new Set();
  const walk = v => {
    if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object')
      for (const [k, x] of Object.entries(v)) {
        if (k === 'file' && typeof x === 'string' && /^[0-9a-f]{16}\.[a-z0-9]+$/.test(x)) keys.add(x);
        else walk(x);
      }
  };
  walk(jb);
  return [...keys].sort();
}

const pick = (obj, keys) => Object.fromEntries(keys.filter(k => obj?.[k] !== undefined).map(k => [k, obj[k]]));
/**
 * A prepared beat's times are relative, but they come from absolute times rounded to the
 * millisecond, so the same beat at a new position differs by fractions of a millisecond.
 * Fingerprints round to 10 ms to classify "moved" honestly; a moved beat is still reported
 * as moved (and re-checked), never as unchanged or reusable.
 */
const settle = v =>
  Array.isArray(v)
    ? v.map(settle)
    : v && typeof v === 'object'
      ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, settle(x)]))
      : typeof v === 'number' && !Number.isInteger(v)
        ? Math.round(v * 100) / 100
        : v;

/**
 * The review timeline of a prepared project: per beat its place, words (film clock), source
 * mapping and fingerprints. Fingerprints never include a beat's absolute start, so a beat that
 * only moved keeps them; `rendered` folds in the previous beat when a transition draws it.
 */
export function reviewTimeline(ctx) {
  const { root, job, timing, manifest } = ctx;
  const raw = readJSONFile(path.join(root, 'storyboard.json'));
  const rawById = new Map(raw.beats.map(b => [b.id, b]));
  const transcript = readJSONFile(path.join(root, 'source', 'words.json'), null);
  const sourceSha = fs.existsSync(path.join(root, 'source', 'recording.wav'))
    ? (readJSONFile(path.join(root, 'source', 'recording.json'), null)?.sha256 ?? sha256File(path.join(root, 'source', 'recording.wav')))
    : null;
  const { beats: _b, ...filmRaw } = raw;
  const jobFilm = pick(job, ['width', 'height', 'fps', 'theme', 'motion', 'backdrop', 'chrome', 'captions', 'caption_style', 'texture', 'text_motion', 'frame']);
  const film = {
    look: fingerprint({ raw: pick(filmRaw, LOOK_KEYS), job: jobFilm }),
    sound: fingerprint({ raw: pick(filmRaw, SOUND_KEYS), music: timing.music?.src ? manifest.hashes[timing.music.src] ?? null : null }),
    voice: fingerprint(filmRaw.voice ?? null),
    data: fingerprint({ sources: filmRaw.sources ?? [], assets: filmRaw.assets ?? [] }),
    renderer: fingerprint({ renderer: manifest.rendererSourceHash, fonts: manifest.fontHashes, revision: manifest.revision }),
  };
  const planned = new Map();
  try {
    for (const t of planTakes(loadStoryboard(root))) for (const b of t.beats) planned.set(b.id, t.id);
  } catch {}
  let prevOwn = null;
  const beats = job.beats.map((jb, i) => {
    const tb = timing.beats[i],
      b = rawById.get(jb.id) ?? {};
    const meta = b.vo ? readJSONFile(path.join(root, 'assets', 'vo', `${jb.id}.json`), null) : null;
    const wav = manifest.hashes[`assets/vo/${jb.id}.wav`] ?? null;
    const recorded = isRecorded(meta) && transcript;
    const media = mediaKeys(jb);
    // Voice levels are drawn from the beat's audio (in `audio` below), sampled from an
    // absolute offset; they are identified by that audio rather than by their jittered values.
    const { start_frame, levels, ...placeless } = jb;
    const audio = wav ? fingerprint({ wav, lead: tb.vo ? round(tb.vo.start - tb.start, 2) : null }) : null;
    const own = fingerprint({ beat: settle(placeless), film: jobFilm, levels: levels ? audio : null });
    const prints = {
      authored: fingerprint({ beat: b, wav, words: meta?.words ?? null, media }),
      own,
      rendered: fingerprint({ own, renderer: film.renderer, prev: jb.transition !== 'cut' ? prevOwn : null }),
      picture: fingerprint({ beat: pick(b, PICTURE_KEYS), media }),
      words: fingerprint({ vo: b.vo ?? null, speaker: b.speaker ?? null }),
      audio,
      voice: b.vo
        ? fingerprint(
            recorded
              ? { recording: sourceSha }
              : meta?.provider
                ? { provider: meta.provider, take: meta.take?.hash ?? meta.hash ?? wav }
                : { unrecorded: true },
          )
        : null,
      facts: factsPrint(b, filmRaw.sources ?? []),
    };
    prevOwn = own;
    let source = null;
    if (recorded && tb.vo) {
      const segments = sourceSegments(meta, { rate: transcript.rate, fps: timing.fps });
      source = {
        file: meta.source.file,
        offset: meta.source.offset ?? transcript.offset ?? 0,
        segments: segments.map(s => ({
          film: [round(tb.vo.start + s.at, 4), round(tb.vo.start + s.at + (s.to - s.from), 4)],
          source: [round(s.from, 4), round(s.to, 4)],
        })),
        removed: (meta.source.removed ?? []).map(r => ({ id: r.id, kind: r.kind, words: r.words, from: r.from, to: r.to, ...(r.note ? { note: r.note } : {}) })),
      };
    }
    return {
      id: jb.id,
      index: i,
      chapter: tb.chapter ?? null,
      block: b.block ?? null,
      speaker: b.speaker ?? null,
      start: tb.start,
      end: tb.end,
      startFrame: start_frame,
      frames: jb.frames,
      transition: jb.transition,
      exit: jb.exit,
      world: jb.block === 'canvas' ? (jb.props?.world ?? null) : null,
      placeholder: ctx.placeholders?.find(p => p.beat === jb.id)?.reason ?? null,
      visual: b.visual ?? null,
      vo: tb.vo
        ? {
            text: tb.vo.text,
            start: tb.vo.start,
            end: tb.vo.end,
            timing: tb.vo.wordTiming,
            estimated: !!tb.vo.estimated,
            provider: tb.vo.provider ?? null,
            take: meta?.take?.id ?? null,
            plannedTake: recorded ? null : (planned.get(jb.id) ?? null),
          }
        : null,
      words: (tb.vo?.words ?? []).map(w => ({ w: w.w, t0: w.t0, t1: w.t1 })),
      source,
      elements: elementIds(b),
      was: Array.isArray(b.was) ? b.was : null,
      // What a neighbour decides about this beat, so a report can say why it looks different.
      coupling: {
        exit: jb.exit,
        continues: jb.speaker?.continues ?? null,
        handoff: !!(jb.props?.viewNext || jb.props?.viewFrom),
        morph: JSON.stringify(jb.props?.elements ?? []).includes('"morph"'),
        carried: (jb.props?.elements ?? []).some(el => el.carried),
      },
      prints,
    };
  });
  return {
    version: 1,
    // Fingerprints from different schemes are not comparable; impact() says so.
    printScheme: PRINT_SCHEME,
    title: timing.title,
    fps: timing.fps,
    frames: timing.frames,
    duration: timing.duration,
    width: timing.width,
    height: timing.height,
    music: timing.music?.src ? { src: timing.music.src, offset: timing.music.offset ?? 0 } : null,
    film,
    beats,
  };
}

// ------------------------------------------------------------------ revisions on disk

export function listRevisions(root) {
  const dir = reviewPath(root, 'revisions');
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter(d => ID.revision.test(d) && fs.existsSync(path.join(dir, d, 'revision.json')))
    .map(d => readJSONFile(path.join(dir, d, 'revision.json')))
    .sort((a, b) => Number(a.id.slice(1)) - Number(b.id.slice(1)));
}
export function loadRevision(root, id) {
  const dir = revDir(root, id);
  if (!fs.existsSync(path.join(dir, 'revision.json'))) throw new Error(`No revision ${id}. Run revisions DIR to list them.`);
  return { meta: readJSONFile(path.join(dir, 'revision.json')), timeline: readJSONFile(path.join(dir, 'timeline.json')) };
}
export const latestRevision = (root, test = () => true) => listRevisions(root).filter(test).at(-1) ?? null;
/** The newest revision a person could have watched (one with a full video). */
export const latestWatchable = root => latestRevision(root, r => (r.videos ?? []).some(v => v.retained !== false));

// Inputs that are not named by the prepared job but are read by the loader or by later edits:
// the recording and its transcript, the music bed's pointer, generated-voice takes, project
// sound files and the project library (which overrides palettes, treatments and sketches).
export const TRACKED_FILES = ['source/recording.wav', 'source/words.json', 'source/recording.json', 'assets/music/bed.json'];
export const TRACKED_DIRS = ['assets/vo/takes', 'assets/sfx', 'library'];

/** Files in the tracked locations as they are now: [relative path…]. */
export function trackedFiles(root) {
  const out = TRACKED_FILES.filter(rel => {
    const f = path.join(root, rel);
    return fs.existsSync(f) && fs.statSync(f).isFile();
  });
  for (const dir of TRACKED_DIRS) {
    const abs = path.join(root, dir);
    if (!fs.existsSync(abs)) continue;
    const walk = d =>
      fs.readdirSync(d, { withFileTypes: true }).forEach(e => {
        const p = path.join(d, e.name);
        if (e.isDirectory()) walk(p);
        else if (e.isFile()) out.push(path.relative(root, p).split(path.sep).join('/'));
      });
    walk(abs);
  }
  return out;
}

/** Every file a render of the project reads, plus what a restore needs (sources, takes, library). */
function collectInputs(root, ctx) {
  const inputs = { ...ctx.manifest.hashes };
  const add = rel => {
    const file = path.join(root, rel);
    if (fs.existsSync(file) && fs.statSync(file).isFile()) inputs[rel] ??= sha256File(file);
  };
  for (const rel of trackedFiles(root)) add(rel);
  for (const b of ctx.timing.beats)
    if (b.vo) {
      add(`assets/vo/${b.id}.wav`);
      add(`assets/vo/${b.id}.json`);
    }
  return Object.fromEntries(Object.entries(inputs).sort(([a], [b]) => a.localeCompare(b)));
}

/** A state's identity: its inputs, the renderer and the fonts. Same id, same film. */
const contentIdOf = (inputs, manifest) =>
  fingerprint({ inputs, renderer: manifest.rendererSourceHash, fonts: manifest.fontHashes });

/**
 * The working copy's identity, synchronously (no native work): prepared like a rough draft so
 * placeholders don't stop it. A final revision is current only if its contentId equals this.
 */
export function workingContent(root) {
  const ctx = prepareProjectSync(root, { draft: true, rough: true });
  const inputs = collectInputs(root, ctx);
  return { ctx, inputs, contentId: contentIdOf(inputs, ctx.manifest) };
}

/** What changed in the beat list between two timelines: ids added (and from what) or removed. */
export function lineageOf(prev, next, edits = []) {
  if (!prev) return null;
  const before = new Set(prev.beats.map(b => b.id)),
    after = new Set(next.beats.map(b => b.id));
  const added = {},
    removed = {},
    merged = {};
  for (const b of next.beats) {
    const from = (b.was ?? []).filter(id => before.has(id) && id !== b.id);
    if (!before.has(b.id)) added[b.id] = { from };
    else if (from.length) merged[b.id] = { from };
  }
  for (const b of prev.beats)
    if (!after.has(b.id)) {
      const into = next.beats.filter(n => (n.was ?? []).includes(b.id)).map(n => n.id);
      const cut = [...edits].reverse().find(e => e.op === 'cut' && e.beats?.some(p => p.beat === b.id && p.deleted));
      removed[b.id] = into.length
        ? { into }
        : { deleted: true, ...(cut ? { by: cut.id, words: cut.words } : {}), text: b.vo?.text ?? null };
    }
  return { added, removed, merged };
}

/**
 * Save the project's current state as a revision (or return the latest one when nothing
 * changed). Inputs are preserved by content; the job and timeline are written beside it.
 */
export async function snapshot(root, { ctx, kind = 'snapshot', label, reason, notes = [], by, force = false } = {}) {
  ctx ??= await prepareProject(root, { draft: true, rough: true });
  const timeline = reviewTimeline(ctx);
  const inputs = collectInputs(root, ctx);
  const contentId = contentIdOf(inputs, ctx.manifest);
  return withLock(root, () => {
    const list = listRevisions(root),
      latest = list.at(-1);
    if (latest && latest.contentId === contentId && !force) return { revision: latest, timeline: loadRevision(root, latest.id).timeline, created: false };
    const id = nextId('r', list.map(r => r.id));
    const objects = {};
    for (const [rel, sha] of Object.entries(inputs)) objects[rel] = putObject(root, path.join(root, rel), { sha }).object;
    const jobText = canonical(ctx.job);
    const jobFile = path.join(os.tmpdir(), `cf-job-${process.pid}-${Date.now()}.json`);
    fs.writeFileSync(jobFile, jobText);
    let job;
    try {
      job = putObject(root, jobFile, { sha: sha256(jobText), ext: '.json' }).object;
    } finally {
      fs.rmSync(jobFile, { force: true });
    }
    const edits = readEdits(root);
    const prev = latest ? loadRevision(root, latest.id).timeline : null;
    const meta = {
      id,
      parent: latest?.id ?? null,
      createdAt: new Date().toISOString(),
      kind,
      ...(label ? { label } : {}),
      ...(reason ? { reason } : {}),
      ...(by ? { by } : {}),
      contentId,
      inputId: ctx.manifest.inputId,
      renderer: { sourceHash: ctx.manifest.rendererSourceHash, revision: ctx.manifest.revision, fonts: fingerprint(ctx.manifest.fontHashes) },
      frames: timeline.frames,
      fps: timeline.fps,
      duration: timeline.duration,
      beats: timeline.beats.length,
      placeholders: ctx.placeholders ?? [],
      unfinished: ctx.unfinished ?? [],
      estimatedTiming: timeline.beats.filter(b => b.vo && b.vo.timing !== 'measured').map(b => b.id),
      notes,
      lastEdit: edits.at(-1)?.id ?? null,
      lineage: lineageOf(prev, timeline, edits.filter(e => !latest?.lastEdit || edits.findIndex(x => x.id === e.id) > edits.findIndex(x => x.id === latest.lastEdit))),
      inputs: objects,
      job,
      videos: [],
      previews: [],
    };
    const dir = revDir(root, id);
    writeJSONAtomic(path.join(dir, 'timeline.json'), timeline);
    writeAtomic(path.join(dir, 'storyboard.json'), fs.readFileSync(path.join(root, 'storyboard.json')));
    writeJSONAtomic(path.join(dir, 'revision.json'), meta);
    return { revision: meta, timeline, created: true };
  });
}

/** Record a change to a revision's receipts (videos, previews, notes); content never changes. */
export function updateRevision(root, id, fn) {
  return withLock(root, () => {
    const file = path.join(revDir(root, id), 'revision.json');
    const meta = readJSONFile(file);
    fn(meta);
    writeJSONAtomic(file, meta);
    return meta;
  });
}

/**
 * Attach a rendered video to its revision. Review videos are kept for the newest `keep`
 * revisions plus any a person accepted; older ones are released (the record stays, marked).
 */
export function attachVideo(root, id, { file, receipt, profile, keep = 3 }) {
  const { object, sha256: sha } = putObject(root, file, { sha: receipt.outputSha256, ext: '.mp4' });
  const receiptText = JSON.stringify(receipt, null, 2) + '\n';
  const receiptFile = path.join(os.tmpdir(), `cf-receipt-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(receiptFile, receiptText);
  let receiptObject;
  try {
    receiptObject = putObject(root, receiptFile, { sha: sha256(receiptText), ext: '.json' }).object;
  } finally {
    fs.rmSync(receiptFile, { force: true });
  }
  const meta = updateRevision(root, id, m => {
    m.videos = [
      ...(m.videos ?? []).filter(v => v.sha256 !== sha),
      { profile, object, sha256: sha, receipt: receiptObject, frames: receipt.frames, encoder: receipt.encoder, renderedAt: new Date().toISOString(), retained: true },
    ];
  });
  pruneVideos(root, keep);
  return meta;
}

/**
 * Release the videos of all but the newest `keep` revisions that have one (a person's accepted
 * revisions are always kept). A released video's object is deleted unless something else still
 * names it: another kept video, any revision's inputs, job or receipts, or a preview.
 */
export function pruneVideos(root, keep = 3) {
  return withLock(root, () => {
    const accepted = new Set(
      readDecisionsLight(root)
        .filter(d => d.action === 'accept' && d.role === 'human')
        .map(d => d.revision),
    );
    const revs = listRevisions(root);
    const withVideo = revs.filter(r => (r.videos ?? []).some(v => v.retained));
    const release = new Set(
      withVideo
        .slice(0, Math.max(0, withVideo.length - keep))
        .filter(r => !accepted.has(r.id))
        .map(r => r.id),
    );
    if (!release.size) return [];
    const needed = new Set();
    for (const r of revs) {
      for (const o of Object.values(r.inputs ?? {})) needed.add(o);
      if (r.job) needed.add(r.job);
      for (const v of r.videos ?? []) {
        if (v.receipt) needed.add(v.receipt);
        if (v.retained && !release.has(r.id)) needed.add(v.object);
      }
      for (const p of r.previews ?? []) for (const side of [p.before, p.after]) if (side?.object) needed.add(side.object);
    }
    const freed = [];
    for (const id of release)
      updateRevision(root, id, m => {
        for (const v of m.videos ?? [])
          if (v.retained) {
            if (!needed.has(v.object)) {
              fs.rmSync(path.join(root, ...v.object.split('/')), { force: true });
              freed.push(v.object);
            }
            v.retained = false;
            v.releasedAt = new Date().toISOString();
          }
      });
    return freed;
  });
}
function readDecisionsLight(root) {
  const file = reviewPath(root, 'decisions.jsonl');
  return fs.existsSync(file)
    ? fs
        .readFileSync(file, 'utf8')
        .split('\n')
        .filter(Boolean)
        .map(l => JSON.parse(l))
    : [];
}

/** Path of a revision's retained video, or null. */
export function revisionVideo(root, meta, profile) {
  const v = [...(meta.videos ?? [])].reverse().find(x => x.retained !== false && (!profile || x.profile === profile));
  return v ? { ...v, file: objectFile(root, v.object, { verify: false }) } : null;
}

/**
 * Rebuild a revision's project in `dir` from stored objects (verified by hash). Rendering it
 * uses today's renderer and fonts; the receipt says when those differ from the original.
 */
export function materialize(root, id, dir) {
  const { meta } = loadRevision(root, id);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, object] of Object.entries(meta.inputs)) {
    const dest = path.resolve(dir, rel);
    if (!dest.startsWith(path.resolve(dir) + path.sep)) throw new Error(`Revision ${id} names a file outside the project: ${rel}`);
    restoreObject(root, object, dest);
  }
  return meta;
}

// ------------------------------------------------------------------ impact

const sameRange = (a, b) => a && b && a.startFrame === b.startFrame && a.frames === b.frames;

/**
 * What changed from timeline A to B, in plain terms: beats whose own content changed, beats
 * that only look different (a neighbour's transition, a world they share, a film setting, the
 * renderer), beats that only moved in time, and beats added or removed. Conservative: a
 * shifted beat is never called unchanged, and nothing is assumed reusable.
 */
export function impact(A, B, { lineage, from = 'A', to = 'B' } = {}) {
  const before = new Map(A.beats.map(b => [b.id, b]));
  const after = new Map(B.beats.map(b => [b.id, b]));
  const film = Object.fromEntries(Object.keys(B.film).map(k => [k, A.film[k] === B.film[k] ? 'same' : 'changed']));
  // Revisions fingerprinted by another version of ClearFrame: assume every frame may differ.
  if ((A.printScheme ?? 0) !== (B.printScheme ?? 0)) film.renderer = 'changed';
  const global = ['look', 'renderer'].filter(k => film[k] === 'changed');
  const beats = [];
  const worldsChanged = new Set();
  for (const b of B.beats) {
    const a = before.get(b.id);
    if (!a) {
      const was = (b.was ?? lineage?.added?.[b.id]?.from ?? []).filter(id => before.has(id));
      beats.push({ id: b.id, status: 'added', from: was, reasons: [was.length ? `made from ${was.join(' + ')}` : 'new beat'] });
      if (b.world) worldsChanged.add(b.world);
      continue;
    }
    const kinds = ['picture', 'words', 'audio', 'facts', 'voice'].filter(k => a.prints[k] !== b.prints[k]);
    const merged = (b.was ?? []).filter(id => id !== b.id && before.has(id) && !after.has(id));
    if (a.prints.authored !== b.prints.authored || merged.length) {
      beats.push({
        id: b.id,
        status: 'content',
        changed: kinds,
        reasons: [kinds.length ? `${kinds.join(', ')} changed` : 'authored settings changed', ...(merged.length ? [`absorbed ${merged.join(', ')}`] : [])],
        shift: round(b.start - a.start),
        durationDelta: round(b.end - b.start - (a.end - a.start)),
      });
      if (b.world) worldsChanged.add(b.world);
      continue;
    }
    if (a.prints.rendered !== b.prints.rendered) {
      const reasons = [];
      if (global.includes('look')) reasons.push('film look changed');
      if (global.includes('renderer')) reasons.push((A.printScheme ?? 0) !== (B.printScheme ?? 0) ? 'recorded by another ClearFrame version; look again' : 'renderer or fonts changed');
      const prevB = B.beats[b.index - 1];
      const prevA = prevB && before.get(prevB.id);
      if (b.transition !== 'cut' && prevB && (!prevA || prevA.prints.own !== prevB.prints.own))
        reasons.push(`its ${b.transition} entrance draws ${prevB.id}, which changed`);
      if (b.world && worldsChanged.has(b.world)) reasons.push(`it shares world “${b.world}” with a changed beat`);
      const ca = a.coupling ?? {},
        cb = b.coupling ?? {};
      if (ca.exit !== cb.exit) reasons.push(`its exit is now ${cb.exit} (it mirrors the next beat’s entrance)`);
      if (ca.continues !== cb.continues) reasons.push(cb.continues ? 'its speaker tag now continues from the beat before' : 'its speaker tag now introduces the speaker');
      if (ca.handoff !== cb.handoff || (cb.handoff && a.prints.own !== b.prints.own && !reasons.length)) reasons.push('the camera hand-off with a neighbouring world beat changed');
      if (ca.morph !== cb.morph) reasons.push('a morph from the beat before changed');
      if (a.prints.own !== b.prints.own && !reasons.length) reasons.push('its prepared scene changed (timing-derived cues or a neighbour’s influence)');
      beats.push({ id: b.id, status: 'appearance', reasons, shift: round(b.start - a.start) });
      if (b.world) worldsChanged.add(b.world);
      continue;
    }
    if (!sameRange(a, b)) {
      beats.push({ id: b.id, status: 'shifted', shift: round(b.start - a.start), reasons: [`moved ${fmtShift(b.start - a.start)}`] });
      continue;
    }
    beats.push({ id: b.id, status: 'unchanged' });
  }
  const removed = A.beats
    .filter(a => !after.has(a.id))
    .map(a => {
      const l = lineage?.removed?.[a.id];
      const into = l?.into ?? B.beats.filter(b => (b.was ?? []).includes(a.id)).map(b => b.id);
      return {
        id: a.id,
        status: 'removed',
        into,
        reasons: [into.length ? `became ${into.join(' + ')}` : l?.by ? `cut by ${l.by} (“${clip(l.words, 60)}”)` : 'removed'],
        text: a.vo?.text ?? null,
      };
    });
  const firstShift = beats.find(x => x.shift && Math.abs(x.shift) > 1e-6);
  const durationDelta = round(B.duration - A.duration);
  // Narration that changed under a generated take re-records the whole take.
  const takes = [];
  for (const x of beats.filter(x => x.status === 'content' && x.changed?.includes('words'))) {
    const b = after.get(x.id);
    const take = b.vo?.plannedTake;
    if (!take || b.source) continue;
    let t = takes.find(t => t.take === take);
    if (!t) takes.push((t = { take, beats: B.beats.filter(y => y.vo?.plannedTake === take).map(y => y.id), because: [] }));
    t.because.push(x.id);
  }
  const counts = {};
  for (const x of [...beats, ...removed]) counts[x.status] = (counts[x.status] ?? 0) + 1;
  const passages = affectedPassages(A, B, [...beats, ...removed]);
  const summary = [];
  const list = s => {
    const ids = [...beats, ...removed].filter(x => x.status === s).map(x => x.id);
    return ids.length > 6 ? `${ids.slice(0, 6).join(', ')} and ${ids.length - 6} more` : ids.join(', ');
  };
  if (global.length)
    summary.push(`Film-wide: ${global.map(k => (k === 'look' ? 'the look (palette, motion, captions or framing)' : 'the renderer or fonts')).join(' and ')} changed, so any frame may differ.`);
  if (film.sound === 'changed') summary.push('The music or mix settings changed: listen to the whole film again.');
  if (film.data === 'changed') summary.push('Sources or asset declarations changed.');
  if (counts.content) summary.push(`${counts.content} beat(s) changed in content: ${list('content')}.`);
  if (counts.added) summary.push(`${counts.added} beat(s) added: ${list('added')}.`);
  if (counts.removed) summary.push(`${counts.removed} beat(s) removed: ${list('removed')}.`);
  if (counts.appearance) summary.push(`${counts.appearance} beat(s) look different without being edited: ${list('appearance')} (see reasons).`);
  if (durationDelta)
    summary.push(
      `The film is ${Math.abs(durationDelta).toFixed(2)} s ${durationDelta < 0 ? 'shorter' : 'longer'}${firstShift ? `; from ${firstShift.id} on, beats move ${fmtShift(firstShift.shift)}` : ''}${B.music ? ', and the music bed (timed to the film clock) now sits differently under every later picture' : ''}.`,
    );
  else if (counts.shifted) summary.push(`${counts.shifted} beat(s) moved in time without other changes.`);
  for (const t of takes)
    summary.push(`Narration changed in ${t.because.join(', ')}: its take ${t.take} (${t.beats.length} beats) must be re-recorded; every beat in it gets new audio and may move.`);
  if (!summary.length) summary.push('No differences: the same content renders on the same frames.');
  summary.push(`${counts.unchanged ?? 0} beat(s) unchanged.`);
  return { from, to, film, durationDelta, beats: [...beats, ...removed], counts, takes, passages, summary };
}
const fmtShift = s => `${s < 0 ? 'earlier' : 'later'} by ${Math.abs(s).toFixed(2)} s`;
const clip = (s, n) => (String(s ?? '').length > n ? String(s).slice(0, n - 1) + '…' : String(s ?? ''));

/**
 * Stretches of film to look at: consecutive beats that changed (content, appearance, added,
 * removed), as frame ranges in both timelines. Removed beats widen the "before" range.
 */
export function affectedPassages(A, B, changes) {
  const flagged = new Set(changes.filter(c => !['unchanged', 'shifted'].includes(c.status)).map(c => c.id));
  const passages = [];
  let cur = null;
  for (const b of B.beats) {
    if (flagged.has(b.id)) {
      cur ??= { beats: [], before: [] };
      cur.beats.push(b.id);
    } else if (cur) {
      passages.push(cur);
      cur = null;
    }
  }
  if (cur) passages.push(cur);
  // A removed beat joins the passage around where it used to be.
  const removed = changes.filter(c => c.status === 'removed').map(c => c.id);
  for (const id of removed) {
    const i = A.beats.findIndex(b => b.id === id);
    const neighbour = [...A.beats.slice(0, i).reverse(), ...A.beats.slice(i + 1)].find(b => B.beats.some(x => x.id === b.id));
    let p = passages.find(p => neighbour && p.beats.includes(neighbour.id));
    if (!p) {
      p = { beats: neighbour ? [neighbour.id] : [], before: [] };
      passages.push(p);
    }
    p.before.push(id);
  }
  // Stretches that touch in the new timeline are one passage (a cut and the beat after it).
  const at = id => B.beats.findIndex(b => b.id === id);
  const order = p => Math.min(...p.beats.map(at).filter(i => i >= 0), Infinity);
  passages.sort((x, y) => order(x) - order(y));
  for (let i = 1; i < passages.length; i++) {
    const prev = passages[i - 1],
      cur = passages[i];
    const end = Math.max(...prev.beats.map(at), -Infinity);
    if (cur.beats.length && prev.beats.length && order(cur) <= end + 1) {
      prev.beats = [...new Set([...prev.beats, ...cur.beats])].sort((x, y) => at(x) - at(y));
      prev.before.push(...cur.before);
      passages.splice(i--, 1);
    }
  }
  const range = (T, ids) => {
    const bs = T.beats.filter(b => ids.includes(b.id));
    return bs.length ? [Math.min(...bs.map(b => b.startFrame)), Math.max(...bs.map(b => b.startFrame + b.frames))] : null;
  };
  return passages
    .map(p => {
      const inA = [...p.beats.filter(id => A.beats.some(b => b.id === id)), ...p.before];
      const fromA = new Set(inA);
      for (const id of p.beats) for (const w of B.beats.find(b => b.id === id)?.was ?? []) fromA.add(w);
      return { beats: p.beats, removed: p.before, before: range(A, [...fromA]), after: range(B, p.beats) };
    })
    .sort((x, y) => (x.after?.[0] ?? x.before?.[0] ?? 0) - (y.after?.[0] ?? y.before?.[0] ?? 0));
}

/** The working copy's timeline (prepared like a rough draft; no native work). */
export async function workingTimeline(root) {
  const ctx = await prepareProject(root, { draft: true, rough: true });
  return { ctx, timeline: reviewTimeline(ctx) };
}

export { sha256File };
