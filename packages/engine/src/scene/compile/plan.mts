import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

import type { CompiledPlan, PlanContext, ScenePlan } from '../types.mjs';
import { PLAN_KIND, PLAN_VERSION } from './contracts.mjs';
import type { PlanBuild } from './contracts.mjs';
import { beatLayers } from './layers.mjs';
import { filmStages } from './stages.mjs';

export const sha256 = (b: string) =>
  crypto.createHash('sha256').update(b).digest('hex');

/**
 * Compile the plan. `ctx`: {root, sb, timing, job, stage(rel, where) → {file, key}, assetFile(ref, kind, where) → rel}.
 * Returns {plan, warnings, footage, provenance, settle, hash}. A rough cut compiles the same plan.
 */
export function compilePlan(
  ctx: PlanContext,
  _options: { rough?: boolean } = {},
): CompiledPlan {
  const { job, timing } = ctx;
  const fps = job.fps;
  const scale = 1080 / Math.min(timing.width, timing.height);
  const b: PlanBuild = {
    ctx,
    fps,
    frame: { width: timing.width * scale, height: timing.height * scale },
    warnings: [],
    footage: [],
    provenance: [],
    layers: [],
    settle: {},
  };
  beatLayers(b);
  filmStages(b);
  const plan: ScenePlan = {
    kind: PLAN_KIND,
    version: PLAN_VERSION,
    format: { width: job.width, height: job.height, fps, frames: job.frames },
    job: 'job.json',
    media: 'media',
    layers: b.layers,
    inputs: {
      provenance: b.provenance,
      footage: b.footage.map((f) => ({
        source: f.source,
        offset: f.offset,
        seconds: f.seconds,
      })),
    },
  };
  return {
    plan,
    warnings: b.warnings,
    footage: b.footage,
    provenance: b.provenance,
    settle: b.settle,
    hash: sha256(JSON.stringify(plan)),
  };
}

export function writePlan(dir: string, plan: ScenePlan): string {
  const file = path.join(dir, 'plan.json');
  fs.writeFileSync(file, JSON.stringify(plan) + '\n');
  return file;
}
