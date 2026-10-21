import type { Asset, ResolvedStoryboard, Timing } from '../../domain.mjs';
import type { ProjectPaths } from '../project.mjs';

import { nonempty, assetMeta, lineMeta, narrated } from '../generate-model.mjs';
import { voiceSpec, musicSpec } from '../generate-specs.mjs';

import { planTakes, takeSpec } from '../takes.mjs';

import path from 'node:path';

import { loadStoryboard, paths } from '../project.mjs';
import { computeTiming, estimateDuration } from '../timing.mjs';
import { hashOf } from '../util.mjs';
import { findMusicBed, readMusicBedMeta } from '../music-files.mjs';
import * as tts from '../../../skills/gemini-tts/scripts/tts.mjs';
import * as image from '../../../skills/gemini-image/scripts/image.mjs';
import * as music from '../../../skills/lyria-music/scripts/music.mjs';

import { clipSpec, footageProblems } from '../continuity.mjs';

import { footageUses, clipProvider } from './clips.mjs';
import { imageHash } from './images.mjs';

// ------------------------------------------------------------------ plan
/** What would we pay for, and what is already cached? */
export function plan(root: string) {
  const sb = loadStoryboard(root);
  const P = paths(root);
  const timing = computeTiming(root);
  const rows: GenerationPlanRow[] = [];
  // Continuous takes: a beat is recorded when its take's current spec matches what was made.
  voicePlan(sb, P, rows);
  if (sb.music) {
    musicPlan(root, sb, timing, rows);
  }
  for (const a of sb.assets.filter((a) => !a.file)) {
    assetPlan({ a, P, sb, rows, root });
  }
  const clipSecs = sb.assets
    .filter((a) => a.kind === 'clip')
    .reduce((s, a) => s + (a.seconds ?? 4), 0);
  const footage = footageProblems(footageUses(sb, timing, P));
  return {
    footage,
    rows,
    total: rows.reduce((s, r) => s + r.cost, 0),
    duration: timing.duration,
    clipShare: clipSecs / timing.duration,
  };
}

export function assetPlan({ a, P, sb, rows, root }: AssetPlanContext) {
  if (a.kind === 'image') {
    const done =
      assetMeta(P.img, a.id)?.hash === imageHash(sb, a) &&
      nonempty(path.join(P.img, `${a.id}.${a.cutout ? 'png' : 'jpg'}`));
    rows.push({
      kind: 'image',
      id: a.id,
      detail: `${a.size ?? '2K'} ${a.model ?? 'gemini-3.1-flash-image'}`,
      cost: done
        ? 0
        : image.estimateCost({ model: a.model, size: a.size ?? '2K' }),
      status: done ? 'cached' : 'todo',
    });
  }
  if (a.kind === 'clip') {
    const spec = clipSpec(root, sb, a, { allowMissing: true }),
      done =
        assetMeta(P.clips, a.id)?.hash === spec.hash &&
        nonempty(path.join(P.clips, `${a.id}.mp4`));
    rows.push({
      kind: 'clip',
      id: a.id,
      detail: `~${spec.seconds}s ${spec.resolution} ${spec.model}`,
      cost: done ? 0 : clipProvider(spec.model).estimateCost(spec),
      status: done ? 'cached' : 'todo',
    });
  }
}

export function musicPlan(
  root: string,
  sb: ResolvedStoryboard,
  timing: Timing,
  rows: GenerationPlanRow[],
) {
  if (!sb.music) return;
  const meta = readMusicBedMeta(root);
  const model = sb.music.model ?? 'lyria-3.5';
  const done =
    meta?.provider !== 'local' &&
    meta?.hash === hashOf(musicSpec(sb, timing)) &&
    !!findMusicBed(root, meta);
  rows.push({
    kind: 'music',
    id: 'bed',
    detail: `${Math.ceil(timing.duration + 2)}s ${model}`,
    cost:
      done || model === 'lyria-realtime' ? 0 : music.estimateCost({ model }),
    status: planStatus(done, meta?.provider),
  });
}

export function voicePlan(
  sb: ResolvedStoryboard,
  P: ProjectPaths,
  rows: GenerationPlanRow[],
) {
  const takeHash = new Map<string, string>();
  for (const take of planTakes(sb)) {
    const h = hashOf(takeSpec(sb, take, sb.voice.provider));
    for (const b of take.beats) takeHash.set(b.id, h);
  }
  for (const b of sb.beats.filter(narrated)) {
    const meta = lineMeta(path.join(P.vo, `${b.id}.json`));
    const done =
      ((meta?.provider === 'gemini' &&
        (meta.take
          ? meta.take.hash === takeHash.get(b.id)
          : meta.hash === hashOf(voiceSpec(sb, b, 'gemini')))) ||
        (meta?.provider === 'imported' && meta.textHash === hashOf(b.vo))) &&
      nonempty(path.join(P.vo, `${b.id}.wav`));
    const secs = estimateDuration(b.vo, sb.voice.wpm);
    rows.push({
      kind: 'voice',
      id: b.id,
      detail: `${secs.toFixed(1)}s speech`,
      cost: done
        ? 0
        : tts.estimateCost({ seconds: secs, model: sb.voice.model }),
      status: planStatus(done, meta?.provider),
    });
  }
}

export interface AssetPlanContext {
  a: Asset;
  P: ProjectPaths;
  sb: ResolvedStoryboard;
  rows: GenerationPlanRow[];
  root: string;
}

export interface GenerationPlanRow {
  kind: 'voice' | 'music' | 'image' | 'clip';
  id: string;
  detail: string;
  cost: number;
  status: 'cached' | 'draft only' | 'todo';
}

export function planStatus(
  done: boolean,
  provider: string | null | undefined,
): GenerationPlanRow['status'] {
  if (done) return 'cached';
  return provider === 'local' ? 'draft only' : 'todo';
}
