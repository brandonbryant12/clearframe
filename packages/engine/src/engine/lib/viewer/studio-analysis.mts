import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import { canonical } from '../store.mjs';
import { loadStoryboard } from '../project.mjs';
import { computeTiming, assetSrc } from '../timing.mjs';
import { isRecorded, decodeVoMeta } from '../recording-model.mjs';
import { listRevisions } from '../revisions.mjs';
import { createJob } from '../../../film/job.mjs';
import { compilePlan } from '../../../scene/compile.mjs';
import { textBox, elementText } from './clearframe.mjs';
import type {
  Beat,
  Storyboard,
  ResolvedStoryboard,
  Timing,
} from '../../domain.mjs';
import { decodeStoryboard } from '../../schemas.mjs';
import { errorMessage } from '../harness/contracts.mjs';
import type { StudioAnalysis, TextBox } from './studio-contracts.mjs';
import { PreparedJobSchema } from './schemas.mjs';
import { sha, stringify } from './studio-history.mjs';
const voMeta = (dir: string, id: string) => {
  try {
    return decodeVoMeta(
      JSON.parse(
        fs.readFileSync(path.join(dir, 'assets', 'vo', `${id}.json`), 'utf8'),
      ),
    );
  } catch {
    return null;
  }
};
/** How a beat's narration may be edited: master recordings by source cuts, per-beat imports not at all. */
export function narrationOf(dir: string, b: Beat) {
  const meta = b.vo ? voMeta(dir, b.id) : null;
  if (isRecorded(meta))
    return {
      kind: 'recording',
      editable: false,
      cuts: (meta.source.removed ?? [])
        .filter((r) => r.id !== 'gap')
        .map((r) => ({ id: r.id, words: r.words, seconds: r.to - r.from })),
    };
  if (meta?.provider === 'imported')
    return { kind: 'imported', editable: false };
  if (!b.vo) return { kind: 'none', editable: true };
  return {
    kind: meta ? 'voice' : 'script',
    editable: true,
    provider: meta?.provider ?? null,
    measured: meta?.alignment?.kind === 'measured',
  };
}

// ------------------------------------------------------------------ validation and analysis

/** Assets and plates a stage or block names, resolved the way prepare does (no copying). */
function stageCallbacks(dir: string, sb: ResolvedStoryboard) {
  const assetFile = (
    ref: { file?: string; asset?: string },
    kind: string,
    where: string,
  ) => {
    if (ref.file) return ref.file;
    const a = (sb.assets ?? []).find((x) => x.id === ref.asset);
    const rel = a && assetSrc(dir, a);
    if (!rel) throw new Error(`${where}: asset ${ref.asset} is missing`);
    return rel;
  };
  const stage = (rel: string, where: string) => {
    const file = path.resolve(dir, rel);
    if (!file.startsWith(dir + path.sep) || !fs.existsSync(file))
      throw new Error(`${where}: ${rel} must exist inside the project`);
    return { file, key: rel };
  };
  return { assetFile, stage };
}

const analyses = new Map<string, StudioAnalysis>();
/** Timing, the engine's job checks and pickable text boxes for a storyboard (cached by content). */
/** Narration files change without the storyboard changing (a draft voice, an alignment): they key the analysis too. */
function voStamp(dir: string) {
  const vo = path.join(dir, 'assets', 'vo');
  try {
    return fs
      .readdirSync(vo)
      .filter((f) => f.endsWith('.json'))
      .map((f) => fs.statSync(path.join(vo, f)).mtimeMs)
      .reduce((a, b) => Math.max(a, b), 0);
  } catch {
    return 0;
  }
}
const hasStages = (sb: Storyboard) =>
  sb.beats.some((b) => b.block === 'stage' || b.stage) || !!sb.stages;
function pickableBoxes(
  sb: Storyboard,
  job: ReturnType<typeof createJob>['job'] | undefined,
): StudioAnalysis['boxes'] {
  const boxes: StudioAnalysis['boxes'] = {};
  // Text the picture can be picked by: canvas text elements, mapped back to their authored element.
  for (const jb of job
    ? (Schema.decodeUnknownSync(PreparedJobSchema)(job).beats ?? [])
    : []) {
    const authored =
      sb.beats.find((b) => b.id === jb.id)?.props?.elements ?? [];
    const list: TextBox[] = [];
    (jb.props?.elements ?? []).forEach((el, i) => {
      if (el.type !== 'text' || !elementText(el).trim()) return;
      let k = el.id != null ? authored.findIndex((a) => a.id === el.id) : -1;
      if (
        k < 0 &&
        authored.length === (jb.props?.elements?.length ?? 0) &&
        authored[i]?.type === 'text'
      )
        k = i;
      list.push({
        text: elementText(el),
        box: textBox(el).map(Math.round),
        at: el.at ?? 0,
        path: k >= 0 ? `props.elements.${k}` : null,
      });
    });
    if (list.length) boxes[jb.id] = list;
  }
  return boxes;
}

export function analyse(
  dir: string,
  sb: Storyboard,
  raw = stringify(sb),
): StudioAnalysis {
  const key = `${dir}\0${sha(raw)}\0${voStamp(dir)}`;
  const previous = analyses.get(key);
  if (previous) return previous;
  const out: StudioAnalysis = {
    errors: [],
    warnings: [],
    timing: null,
    boxes: {},
  };
  let timing: Timing | undefined,
    loaded: ResolvedStoryboard | undefined,
    job: ReturnType<typeof createJob>['job'] | undefined;
  try {
    loaded = loadStoryboard(dir, sb);
    timing = computeTiming(dir, { storyboard: sb });
  } catch (e) {
    out.errors.push(errorMessage(e));
  }
  if (timing && loaded) {
    out.timing = {
      duration: timing.duration,
      fps: timing.fps,
      width: timing.width,
      height: timing.height,
      frames: timing.frames,
      estimated: timing.estimated,
      beats: timing.beats.map((b) => ({
        id: b.id,
        start: b.start,
        end: b.end,
        dur: b.dur,
        chapter: b.chapter,
        vo: b.vo && {
          start: b.vo.start,
          end: b.vo.end,
          estimated: b.vo.estimated,
          wordTiming: b.vo.wordTiming,
          provider: b.vo.provider,
          stale: b.vo.stale ?? null,
          words: b.vo.words.map((w, k) => ({ w: w.w, t0: w.t0, t1: w.t1, k })),
        },
      })),
    };
    try {
      ({
        job,
        errors: out.errors,
        warnings: out.warnings,
      } = createJob(loaded, timing, { draft: true }));
    } catch (e) {
      out.errors.push(errorMessage(e));
    }
  }
  if (job && timing && loaded && !out.errors.length && hasStages(sb)) {
    try {
      out.warnings.push(
        ...compilePlan(
          {
            root: dir,
            sb: loaded,
            timing,
            job,
            ...stageCallbacks(dir, loaded),
          },
          { rough: true },
        ).warnings,
      );
    } catch (e) {
      out.errors.push(errorMessage(e));
    }
  }
  out.boxes = pickableBoxes(sb, job);
  analyses.set(key, out);
  while (analyses.size > 24) {
    const key = analyses.keys().next().value;
    if (key === undefined) break;
    analyses.delete(key);
  }
  return out;
}

/** Errors a candidate adds that the working copy did not already have. */
export function newErrors(dir: string, before: Storyboard, after: Storyboard) {
  const was = new Set(analyse(dir, before).errors);
  return analyse(dir, after).errors.filter((e) => !was.has(e));
}

/** What changed since the newest watchable revision: beats, order and film-wide settings. */
export function changesSince(dir: string, sb: Storyboard) {
  const r = listRevisions(dir)
    .filter((x) => (x.videos ?? []).some((v) => v.retained !== false))
    .at(-1);
  if (!r?.inputs?.['storyboard.json']) return null;
  let old;
  try {
    old = decodeStoryboard(
      JSON.parse(
        fs.readFileSync(path.join(dir, r.inputs['storyboard.json']), 'utf8'),
      ),
    );
  } catch {
    return null;
  }
  const film = (s: Storyboard) =>
    canonical({ ...s, beats: undefined, title: undefined });
  const before = new Map(old.beats.map((b) => [b.id, canonical(b)]));
  const ids = sb.beats.map((b) => b.id),
    oldIds = old.beats.map((b) => b.id).filter((id) => ids.includes(id));
  return {
    revision: r.id,
    film: film(old) !== film(sb),
    added: ids.filter((id) => !before.has(id)),
    removed: old.beats.map((b) => b.id).filter((id) => !ids.includes(id)),
    edited: sb.beats
      .filter((b) => before.has(b.id) && before.get(b.id) !== canonical(b))
      .map((b) => b.id),
    reordered:
      canonical(oldIds) !== canonical(ids.filter((id) => before.has(id))),
  };
}
