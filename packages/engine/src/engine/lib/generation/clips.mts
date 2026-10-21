import type { ResolvedStoryboard, Timing } from '../../domain.mjs';
import type { ProjectPaths } from '../project.mjs';
import type { GenerateOptions } from '../generate-model.mjs';
import { money, guardBudget, nonempty, assetMeta } from '../generate-model.mjs';

import fs from 'node:fs';

import path from 'node:path';

import { loadStoryboard, paths } from '../project.mjs';
import { computeTiming } from '../timing.mjs';
import { log, writeJSON, mediaDuration } from '../util.mjs';

import * as veo from '../../../skills/veo-video/scripts/veo.mjs';
import * as omni from '../../../skills/gemini-omni/scripts/omni.mjs';
import * as runway from '../../../skills/runway-video/scripts/runway.mjs';
import { clipSpec, footageProblems } from '../continuity.mjs';

/** The skill that serves a clip model: Gemini Omni, Veo or Runway (Seedance, Gen-4.5). */
export function clipProvider(model: string) {
  if (model === omni.MODEL) return omni;
  if (Object.hasOwn(veo.MODELS, model)) return veo;
  if (Object.hasOwn(runway.MODELS, model)) return runway;
  throw new Error(`Unsupported video model ${model}`);
}

export async function clips(
  root: string,
  { only, force = false, budget }: GenerateOptions = {},
) {
  const sb = loadStoryboard(root),
    P = paths(root);
  const list = sb.assets.filter(
    (a) => a.kind === 'clip' && !a.file && (!only || only.includes(a.id)),
  );
  const jobs = list.map((a) => ({ a, spec: clipSpec(root, sb, a) }));
  const todo = jobs.filter(
    ({ a, spec }) =>
      force ||
      assetMeta(P.clips, a.id)?.hash !== spec.hash ||
      !nonempty(path.join(P.clips, `${a.id}.mp4`)),
  );
  if (!todo.length) {
    log.ok('Clips are up to date.');
    return;
  }
  for (const { spec } of todo) clipProvider(spec.model);
  // Refuse to pay for footage that cannot cover its beats without looping or repeating.
  const making = new Set(todo.map(({ a }) => a.id));
  const asked = (id: string) => {
    const asset = sb.assets.find((a) => a.id === id);
    if (!asset) throw new Error(`Unknown footage asset ${id}`);
    return asset.seconds ?? 4;
  };
  const short = footageProblems(
    footageUses(sb, computeTiming(root), P)
      .filter((u) => making.has(u.source))
      .map((u) => ({ ...u, have: asked(u.source) })),
  ).errors;
  if (short.length) throw new Error(`Not generating: ${short.join(' ')}`);
  const estimate = todo.reduce(
    (n, { spec }) => n + clipProvider(spec.model).estimateCost(spec),
    0,
  );
  log.step(
    `${todo.length} generated insert(s), approximately ${money(estimate)}. Omni duration and final charges can vary; this is an estimate, not a billing cap.`,
  );
  guardBudget(estimate, budget ?? sb.budget);
  fs.mkdirSync(P.clips, { recursive: true });
  for (const { a, spec } of todo) {
    const out = path.join(P.clips, `${a.id}.mp4`),
      stage = path.join(P.clips, `${a.id}-${process.pid}.tmp.mp4`);
    let result: ClipGenerationResult | undefined;
    try {
      if (spec.model === omni.MODEL) {
        const generated = await omni.generateVideo(spec);
        fs.writeFileSync(stage, generated.data);
        result = generated;
      } else if (clipProvider(spec.model) === runway)
        // Two references are the opening and closing keyframes; one is the opening frame.
        result = await runway.generateVideo(
          { ...spec, images: spec.refs.slice(0, 2) },
          { out: stage, onPoll: () => process.stdout.write('.') },
        );
      else
        await veo.generateVideo(
          { ...spec, image: spec.refs[0] },
          { out: stage, onPoll: () => process.stdout.write('.') },
        );
      const seconds = await mediaDuration(stage);
      if (!(seconds > 0)) throw new Error('Generated clip is not playable');
      fs.renameSync(stage, out);
      const { refs: _refs, ...saved } = spec;
      writeJSON(path.join(P.clips, `${a.id}.json`), {
        ...saved,
        seconds,
        requestedSeconds: spec.seconds,
        interactionId: result?.interactionId ?? result?.taskId,
        usage: result?.usage,
        createdAt: new Date().toISOString(),
      });
      log.ok(
        `${a.id} → assets/clips/${a.id}.mp4 (${seconds.toFixed(2)}s; clip audio is excluded from the film mix)`,
      );
    } finally {
      fs.rmSync(stage, { force: true });
    }
  }
}

/** Where the film shows generated clips: one entry per beat that uses one (plate or video). */
export function footageUses(
  sb: ResolvedStoryboard,
  timing: Timing,
  P: ProjectPaths,
) {
  const uses = [];
  for (const b of timing.beats) {
    const src = sb.beats[b.index],
      ref = src.plate ?? (src.block === 'video' ? src.props : null);
    const a =
      ref?.asset != null
        ? sb.assets.find((x) => x.id === ref.asset && x.kind === 'clip')
        : null;
    if (!a || a.file) continue;
    // A made take's measured length wins over the length that was asked for.
    const made = assetMeta(P.clips, a.id)?.seconds;
    uses.push({
      beat: b.id,
      index: b.index,
      source: a.id,
      offset: ref?.offset ?? 0,
      seconds: b.end - b.start,
      have: made ?? a.seconds ?? 4,
      generated: true,
    });
  }
  return uses;
}

export interface ClipGenerationResult {
  interactionId?: string;
  taskId?: string;
  usage?: unknown;
}
