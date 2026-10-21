import { bundled, buildScenes } from './scenes.mjs';
export {
  FONT_FILES,
  bundled,
  elementFont,
  elementText,
  textBox,
  describeBeat,
  beatMedia,
} from './scenes.mjs';
import type { Storyboard } from '../../domain.mjs';
import { decodeStoryboard } from '../../schemas.mjs';

import type {
  BuildContext,
  VersionContext,
  ViewerVersion,
  ViewerFilm,
  ViewerPreparedJob,
  ViewerTimeline,
} from './contracts.mjs';
import {
  PinsSchema,
  BedSchema,
  CuesSchema,
  PreparedJobSchema,
} from './schemas.mjs';

// Films made with ClearFrame: versions from the review record, scenes and lens boxes from the prepared job.
import fs from 'node:fs';
import path from 'node:path';
import type { RevisionMeta } from '../revisions.mjs';
import { listRevisions, revisionVideo, loadRevision } from '../revisions.mjs';
import { readNotes, readDecisions } from '../notes.mjs';
import { faceSet } from '../../../film/type.mjs';
import {
  readJSON,
  readSchema,
  filmId,
  rel,
  fileHash,
  duration,
  frameSize,
  frameAt,
} from './media.mjs';
import { describeFile, walkFiles, fileType, byGroup } from './files.mjs';
import { noteView } from './notes.mjs';
import { clearframeStage, stageInfo } from './stages.mjs';
import { boards, briefOf } from './boards.mjs';

const qualityLabel = (profile: string | undefined) => {
  if (profile === 'final') return 'Final';
  return profile === 'rough' ? 'Rough cut' : 'Draft';
};

export function clearframeVersion(
  dir: string,
  sb: Storyboard,
  r: RevisionMeta,
  i: number,
  ctx: VersionContext,
): ViewerVersion | null {
  const { out, media, fonts, notes, decisions, pins, film } = ctx;
  const v = revisionVideo(dir, r);
  if (!v?.file || !fs.existsSync(v.file)) return null;
  let timeline: ViewerTimeline | null = null;
  try {
    timeline = loadRevision(dir, r.id).timeline;
  } catch {}
  let vsb = sb;
  try {
    vsb = decodeStoryboard(
      readJSON(path.join(dir, r.inputs?.['storyboard.json'] ?? '')),
    );
  } catch {}
  const job: ViewerPreparedJob | null = r.job
    ? readSchema(path.join(dir, r.job), PreparedJobSchema, {})
    : null;
  const fps = job?.fps ?? timeline?.fps ?? 30,
    prefix = `${film}-${r.id}-${(v.sha256 ?? fileHash(v.file)).slice(0, 8)}`;
  const theme = job?.theme ?? {};
  const voice = job?.type ?? null,
    faces = faceSet(voice?.display ?? 'inter') ?? faceSet('inter');
  if (!faces) throw new Error('Bundled Inter display face is missing');
  const used = new Map<string, string[]>(),
    use = (file: string, role: string) => {
      const f = bundled(fonts, file);
      if (f) {
        used.set(f.id, [...new Set([...(used.get(f.id) ?? []), role])]);
        f.uses.add(role);
      }
      return f;
    };
  use('Inter-Regular.ttf', 'Body text, labels and sources');
  const { narration, sceneList } = buildScenes({
    sb: vsb,
    job,
    timeline,
    fps,
    video: v.file,
    media,
    prefix,
    out,
    dir,
    faces,
    theme,
    use,
  });
  if (voice?.emphasis === 'weight' && faces.light)
    use(faces.light, 'Headline emphasis');
  if (voice?.emphasis === 'serif')
    use('InstrumentSerif-Italic.ttf', 'Headline emphasis');
  for (const id of used.keys()) fonts.fonts.get(id)?.films.add(ctx.title);
  const seconds = r.duration ?? duration(v.file);
  const bed = readSchema(
    path.join(dir, 'assets/music/bed.json'),
    BedSchema,
    {},
  );
  const music =
    vsb.music && bed?.file && fs.existsSync(path.join(dir, bed.file))
      ? [
          {
            start: 0,
            end: seconds,
            name: `Music bed (${bed.provider === 'local' ? 'draft' : (bed.provider ?? 'generated')})`,
            asset: bed.file,
          },
        ]
      : [];
  const mark = (seconds ?? 0) * 0.35,
    settled =
      sceneList.find((s) => s.start <= mark && s.end > mark) ?? sceneList[0];
  const approved = decisions.find(
    (d) => d.action === 'accept' && d.revision === r.id,
  );
  return {
    // A version's number is its revision's own (r005 → Version 5): it never shifts when older
    // videos are pruned, so notes pinned to a revision keep matching the label people see.
    id: r.id,
    number: Number(/^r(\d+)$/.exec(r.id)?.[1]) || i + 1,
    profile: v.profile ?? 'draft',
    placeholders: r.placeholders ?? [],
    label: r.label ?? null,
    createdAt: r.createdAt ?? fs.statSync(v.file).mtime.toISOString(),
    seconds,
    quality: qualityLabel(v.profile),
    approved: approved
      ? { by: approved.by ?? null, said: approved.said ?? null }
      : null,
    notes: notes
      .filter((n) => n.revision === r.id)
      .map((n) => noteView(n, { pins, engine: true })),
    video: rel(out, v.file),
    poster: ((p) => p && rel(out, p))(
      frameAt(
        v.file,
        media,
        `${prefix}-poster`,
        settled ? settled.end - 0.35 : mark,
      ),
    ),
    frame: { width: job?.width ?? 1920, height: job?.height ?? 1080 },
    colors: Object.fromEntries(
      Object.entries(theme).filter(([k]) => k !== 'base'),
    ),
    scenes: sceneList,
    lanes: { narration, music, sfx: [] },
    fonts: [...used].map(([font, roles]) => ({ font, roles })),
    look: {
      palette: theme.base ?? vsb.theme ?? 'paper',
      type: voice?.id ?? 'inter',
      format: vsb.format?.preset ?? 'landscape',
      fps,
    },
  };
}

export async function clearframeFilm(
  dir: string,
  ctx: BuildContext,
): Promise<ViewerFilm> {
  const sb = decodeStoryboard(readJSON(path.join(dir, 'storyboard.json')));
  const id = filmId(dir),
    title = sb.title ?? path.basename(dir);
  const fctx: VersionContext = {
    ...ctx,
    notes: readNotes(dir),
    decisions: readDecisions(dir).filter((d) => d.role === 'human'),
    pins: readSchema(path.join(dir, 'review/viewer-pins.json'), PinsSchema, {}),
    film: id,
    title,
  };
  const versions = listRevisions(dir)
    .map((r: RevisionMeta, i: number) => clearframeVersion(dir, sb, r, i, fctx))
    .filter((v): v is ViewerVersion => v !== null);
  // Notes on a revision whose video is no longer kept stay reachable: listed with the latest version,
  // labelled with their own revision, with no seek or picture pin (that picture is gone).
  const playable = new Set(versions.map((v) => v.id));
  const orphans = fctx.notes.filter(
    (n) => n.revision && !playable.has(n.revision),
  );
  if (versions.length && orphans.length)
    versions[versions.length - 1].notes.push(
      ...orphans.map((n) => ({
        ...noteView(n, { pins: fctx.pins, engine: true }),
        earlier: n.revision,
        earlierAt: n.anchor?.at ?? null,
        at: null,
        pin: null,
        element: null,
      })),
    );
  // Sound cues describe the latest build only.
  const cues = readSchema(path.join(dir, 'build/cues.json'), CuesSchema, []);
  if (versions.length && Array.isArray(cues))
    versions[versions.length - 1].lanes.sfx = cues.map((c) => ({
      t: c.t,
      name: c.name,
    }));
  const loose = path.join(dir, 'build/video.mp4');
  if (!versions.length && fs.existsSync(loose)) {
    const seconds = duration(loose),
      stat = fs.statSync(loose);
    versions.push({
      id: 'latest',
      number: 1,
      label: null,
      createdAt: stat.mtime.toISOString(),
      seconds,
      quality: 'Draft',
      approved: null,
      notes: [],
      video: rel(ctx.out, loose),
      poster: ((p) => p && rel(ctx.out, p))(
        frameAt(
          loose,
          ctx.media,
          `${id}-latest-${fileHash(loose)}`,
          (seconds ?? 0) * 0.35,
        ),
      ),
      frame: frameSize(loose) ?? { width: 1920, height: 1080 },
      colors: {},
      scenes: [],
      lanes: { narration: [], music: [], sfx: [] },
      fonts: [],
      look: {},
    });
  }
  const files = ['assets', 'source', 'media']
    .flatMap((s) => walkFiles(path.join(dir, s)))
    .filter(
      (f) =>
        (!/\.tmp\./.test(f) && fileType(f) !== 'text') ||
        /\.(md|txt|srt|vtt)$/.test(f),
    );
  const preset = sb.format?.preset ?? 'landscape';
  const openNotes =
    versions.at(-1)?.notes.filter((n) => !n.resolved).length ?? 0;
  return {
    id,
    kind: 'clearframe',
    title,
    folder: path.relative(process.cwd(), dir),
    shape: preset === 'vertical' || preset === 'portrait' ? 'tall' : 'wide',
    beats: (sb.beats ?? []).length,
    versions,
    files: files
      .map((f) => describeFile(f, dir, ctx.out, ctx.media, ctx.fonts))
      .sort(byGroup),
    notesTo: 'engine',
    stage: stageInfo(clearframeStage(sb, versions.at(-1), openNotes), {
      openNotes,
    }),
    brief: briefOf(dir),
    // Before the first render, scenes are seen as boards drawn from the storyboard.
    boards: versions.length ? [] : await boards(dir, sb, ctx),
    updatedAt:
      versions.at(-1)?.createdAt ??
      fs.statSync(path.join(dir, 'storyboard.json')).mtime.toISOString(),
  };
}
