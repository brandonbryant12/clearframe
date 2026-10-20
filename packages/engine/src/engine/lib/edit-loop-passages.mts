import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { renderRange, cutPassage, frameRange } from '../../film/render.mjs';
import { prepareProject } from '../../film/prepare.mjs';
import {
  materialize,
  revisionVideo,
  type ImpactReport,
  type LoadedRevision,
  type PreparedContext,
  type RevisionMeta,
  type Timeline,
} from './revisions.mjs';

import { putObject, reviewPath, writeJSONAtomic } from './store.mjs';
import { phase } from './runlog.mjs';

import type {
  PassageReceipt,
  PassagePair,
  Side,
  PassageRange,
} from './edit-loop-contracts.mjs';
/** A timeline shaped like a prepared job, so frameRange can measure passages on it. */
const asJob = (tl: Timeline) => ({
  fps: tl.fps,
  frames: tl.frames,
  beats: tl.beats.map((b) => ({
    id: b.id,
    start_frame: b.startFrame,
    frames: b.frames,
    transition: b.transition,
  })),
});

/** The "before" passage: from the stored video of `rev` when kept, else re-rendered from it. */
async function beforePassage(
  root: string,
  rev: RevisionMeta,
  timeline: Timeline,
  range: PassageRange,
  name: string,
): Promise<PassageReceipt> {
  const dir = reviewPath(root, 'previews');
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${name}.mp4`);
  const video = revisionVideo(root, rev);
  const file = video?.file;
  if (video && file) {
    const r: PassageReceipt = await phase('passage', () =>
      cutPassage(file, { fps: timeline.fps, a: range.a, b: range.b, out }),
    );
    const receipt: PassageReceipt = {
      kind: 'passage',
      revision: rev.id,
      from: 'the stored video of this revision (what was watched)',
      video: video.object,
      range: {
        frames: [range.a, range.b],
        seconds: [range.a / timeline.fps, range.b / timeline.fps],
        fps: timeline.fps,
      },
      beats: range.covered,
      ...r,
    };
    writeJSONAtomic(`${out}.json`, receipt);
    return receipt;
  }
  // The video was released: rebuild the revision's project from its stored inputs and render.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), `cf-${rev.id}-`));
  try {
    materialize(root, rev.id, tmp);
    const ctx: PreparedContext = await prepareProject(tmp, {
      draft: true,
      rough: true,
    });
    const r: PassageReceipt = await renderRange(tmp, {
      beats: range.beatIds,
      handles: range.handles,
      ctx,
      out,
      name,
      verify: false,
    });
    const receipt: PassageReceipt = {
      ...r,
      kind: 'passage',
      revision: rev.id,
      from: `re-rendered from the revision’s stored inputs (${(rev.videos ?? []).length ? 'its video was released to save space' : 'it was never rendered in full'})`,
      sameRenderer:
        ctx.manifest.rendererSourceHash === rev.renderer?.sourceHash,
    };
    writeJSONAtomic(`${out}.json`, receipt);
    return receipt;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

const keepObject = (root: string, file: unknown): string | null =>
  typeof file === 'string' && fs.existsSync(file)
    ? putObject(root, file).object
    : null;

function rangeOf(tl: Timeline, beats: string[], handles: number): PassageRange {
  const r = frameRange(asJob(tl), { beats, handles });
  return { ...r, handles, beatIds: beats };
}

interface PassageJob {
  A: LoadedRevision;
  B: Side;
  report: ImpactReport;
  handles: number;
  limit?: number;
  ctxB?: PreparedContext;
  tag: string;
}

async function afterPassage(
  root: string,
  j: PassageJob,
  beats: string[],
  name: string,
): Promise<PassageReceipt> {
  if (j.ctxB)
    return renderRange(root, { beats, handles: j.handles, ctx: j.ctxB, name });
  if (!j.B.meta)
    throw new Error(
      'The working copy needs its prepared project to render a passage.',
    );
  return beforePassage(
    root,
    j.B.meta,
    j.B.timeline,
    rangeOf(j.B.timeline, beats, j.handles),
    name,
  );
}

/** Before/after passages for an impact report between revision A (stored) and B (stored or working). */
export async function passages(
  root: string,
  j: PassageJob,
): Promise<PassagePair[]> {
  const { A, B, report, handles, limit = 4, tag } = j;
  const out: PassagePair[] = [];
  for (const [k, p] of report.passages.slice(0, limit).entries()) {
    const fromA = sourceBeats(j, p);
    const entry: PassagePair = { beats: p.beats, removed: p.removed };
    if (fromA.length)
      entry.before = await beforePassage(
        root,
        A.meta,
        A.timeline,
        rangeOf(A.timeline, fromA, handles),
        `${tag}-${A.meta.id}-p${k + 1}-before`,
      );
    if (p.beats.length)
      entry.after = await afterPassage(
        root,
        j,
        p.beats,
        `${tag}-${B.meta?.id ?? 'working'}-p${k + 1}-after`,
      );
    for (const side of [entry.before, entry.after])
      if (side) side.object = keepObject(root, side.output);
    out.push(entry);
  }
  return out;
}

function sourceBeats(
  j: PassageJob,
  p: ImpactReport['passages'][number],
): string[] {
  const { A, B } = j;
  const fromA = [
    ...new Set([
      ...p.beats.filter((id) => A.timeline.beats.some((b) => b.id === id)),
      ...p.removed,
    ]),
  ];
  for (const id of p.beats)
    for (const w of B.timeline.beats.find((b) => b.id === id)?.was ?? [])
      if (A.timeline.beats.some((b) => b.id === w)) fromA.push(w);
  return fromA;
}
