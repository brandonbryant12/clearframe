import { spawnSync } from 'node:child_process';
import * as Schema from 'effect/Schema';

import { fail, numberOr, optNumber } from '../fields.mjs';

import { heldTail } from '../../film/constants.mjs';

import type { AssetRef, PlanElement } from '../types.mjs';
import type { PlanBuild, LayerInput } from './contracts.mjs';

/** The part of ffprobe's JSON a duration probe reads (ffprobe prints the duration as text). */
export const ProbeOutput = Schema.Struct({
  format: Schema.optionalKey(
    Schema.Struct({
      duration: Schema.optionalKey(
        Schema.Union([Schema.String, Schema.Number]),
      ),
    }),
  ),
});

export function probeDuration(file: string): number {
  const r = spawnSync(
    'ffprobe',
    ['-v', 'error', '-show_entries', 'format=duration', '-of', 'json', file],
    { encoding: 'utf8' },
  );
  if (r.status !== 0) throw new Error(`Cannot probe ${file}`);
  const raw: unknown = JSON.parse(r.stdout);
  return Number(Schema.decodeUnknownSync(ProbeOutput)(raw).format?.duration);
}

/**
 * Footage is shown from its entrance to its exit (or the stage's end). A wipe into the next beat
 * holds this beat's picture on screen ahead of its edge.
 */
export function stageFootage(
  b: PlanBuild,
  el: PlanElement,
  file: string,
  rel: string,
  layer: LayerInput,
): void {
  const { job } = b.ctx,
    { where, beat } = layer;
  const end = layer.frames / b.fps;
  const duration = probeDuration(file);
  const index = beat ? job.beats.findIndex((x) => x.id === beat) : -1;
  const tail = beat ? heldTail(job, index) : 0;
  const offset = numberOr(el.offset, 0, where, 'offset');
  const exitAt = numberOr(el.exitAt, end + tail, where, 'exitAt');
  const shown =
    Math.max(
      0,
      Math.min(exitAt, end + tail) - numberOr(el.at, 0, where, 'at'),
    ) * numberOr(el.rate, 1, where, 'rate');
  const need = offset + shown;
  if (!el.hold && need > duration + 1 / b.fps + 1e-6)
    fail(
      where,
      `footage ${rel} is ${duration.toFixed(2)} s but the stage shows ${need.toFixed(2)} s of it (offset ${offset} s); trim the shot or use a longer clip. Footage never loops, and freezes only with hold: true.`,
    );
  if (el.hold && need > duration + 1 / b.fps)
    b.warnings.push(
      `${where}: ${rel} holds its last frame for ${(need - duration).toFixed(2)} s (hold: true).`,
    );
  el.duration = duration;
  b.footage.push({
    beat: beat ?? layer.id,
    index,
    source: rel,
    offset,
    seconds: Math.min(shown, duration),
  });
}

/** Every element is cued inside the layer; images and footage are staged under their content hash. */
export function stageMedia(
  b: PlanBuild,
  el: PlanElement,
  layer: LayerInput,
): void {
  const { where } = layer;
  const end = layer.frames / b.fps;
  const at = optNumber(el.at, where, `${String(el.id ?? el.type)} at`);
  if (at != null && at > end - 1 / b.fps + 1e-7)
    fail(
      where,
      `${String(el.id ?? el.type)} is cued at ${at.toFixed(2)} s, after the stage ends at ${end.toFixed(2)} s; move the cue or extend the beat.`,
    );
  if (el.type !== 'image' && el.type !== 'video') return;
  const file = typeof el.file === 'string' ? el.file : undefined;
  const ref: AssetRef = {
    file,
    asset: el.asset ? String(el.asset) : undefined,
  };
  const mediaKind = el.type === 'video' ? 'clip' : 'image';
  const rel =
    el.asset || file?.includes('/') || file?.includes('.')
      ? b.ctx.assetFile(ref, mediaKind, where)
      : null;
  if (!rel)
    return fail(
      where,
      `${String(el.id ?? el.type)} needs asset (an asset id) or file (a project path)`,
    );
  const staged = b.ctx.stage(rel, where);
  el.file = staged.key;
  delete el.asset;
  if (el.type === 'video') stageFootage(b, el, staged.file, rel, layer);
}
