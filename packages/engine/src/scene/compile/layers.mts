import { compileStage } from '../recipes.mjs';
import { eachElement, resolveTimes, settleOf } from '../plan-elements.mjs';
import { fail, fieldsOf, numberOr } from '../fields.mjs';
import type { Fields } from '../fields.mjs';
import { isRecord } from '../../engine/lib/errors.mjs';
import { findWord } from '../../engine/lib/timing.mjs';
import { ENTRANCE } from '../../film/constants.mjs';
import type { JobBeat } from '../../film/types.mjs';
import type { LayerCue, PlanSourceBeat, PlanTimingBeat } from '../types.mjs';
import { STAGE_HEADING } from './contracts.mjs';
import type { PlanBuild, LayerInput } from './contracts.mjs';
import { stageMedia } from './media.mjs';

export function addLayer(b: PlanBuild, layer: LayerInput): void {
  const { id, spec, where, cue, beat, motion } = layer;
  const end = layer.frames / b.fps;
  const notes: string[] = [];
  const compiled = compileStage(spec, {
    cue,
    end,
    where,
    frame: b.frame,
    root: b.ctx.root,
    heading: layer.heading,
    notes,
    staged: (p) => b.provenance.push({ layer: id, ...p }),
  });
  b.warnings.push(...notes);
  const elements = resolveTimes(compiled.elements, cue, where);
  eachElement(elements, (el) => stageMedia(b, el, layer));
  // compileStage refused anything but an object.
  const fields = fieldsOf(spec);
  const shutter = numberOr(fields.shutter, 0, where, 'shutter');
  b.layers.push({
    id,
    start: layer.start,
    frames: layer.frames,
    ...(beat ? { beat } : {}),
    z: layer.z,
    fade: layer.fade,
    ...(compiled.camera ? { camera: compiled.camera } : {}),
    shutter,
    samples: shutter > 0 ? numberOr(fields.samples, 8, where, 'samples') : 0,
    motion,
    elements,
  });
  if (beat)
    b.settle[beat] = Math.max(
      b.settle[beat] ?? 0,
      settleOf(elements, ENTRANCE[motion?.preset ?? 'gentle']),
    );
}

/** A beat's clock: seconds inside the beat, or a word of its narration. */
export const beatCue =
  (tb: PlanTimingBeat): LayerCue =>
  (value, fallback = 0) => {
    if (value == null) return fallback;
    if (typeof value === 'number') {
      if (!Number.isFinite(value) || value < 0 || value >= tb.dur)
        throw new Error(
          `cue ${value} s lies outside the beat (0–${tb.dur.toFixed(2)} s)`,
        );
      return value;
    }
    const t = findWord(tb.vo?.words ?? [], String(value));
    if (t == null)
      throw new Error(
        `spoken cue "${String(value)}" is not in ${tb.id}'s narration`,
      );
    return Math.max(0, t - tb.start);
  };

/** Fade a beat's native layer with the beat's own entrance and exit (a wipe's edge reveals it). */
export function fadeFor(jb: JobBeat): [number, number] {
  const entrance = ENTRANCE[jb.motion?.preset ?? 'gentle'];
  return [
    ['fade', 'rise', 'zoom', 'push'].includes(jb.transition) ? entrance : 0,
    ['fade', 'zoom', 'push'].includes(jb.exit) ? 0.32 : 0,
  ];
}

/** A beat with a title or kicker draws a heading; stage content starts below it. */
export const hasText = (v: unknown) => typeof v === 'string' && v.trim() !== '';

export const hasHeading = (b: PlanSourceBeat | undefined) =>
  hasText(b?.props?.title) || hasText(b?.props?.kicker);

export const stageList = (stage: unknown): readonly unknown[] => {
  if (stage == null) return [];
  return Array.isArray(stage) ? stage : [stage];
};

/** A `stage` block's picture and each beat's own `stage` layers. */
export function beatLayers(b: PlanBuild): void {
  const { sb, timing, job } = b.ctx;
  for (const tb of timing.beats) {
    const jb = job.beats.find((x) => x.id === tb.id);
    if (!jb) continue;
    const source =
      sb.beats.find((x) => x.id === tb.id) ??
      fail(tb.id, 'is not in the storyboard');
    const where = tb.id;
    const common = {
      start: jb.start_frame,
      frames: jb.frames,
      beat: tb.id,
      cue: beatCue(tb),
      fade: fadeFor(jb),
      heading: hasHeading(source),
      motion: jb.motion,
    };
    if (tb.block === 'stage') {
      const props: Array<[string, unknown]> = Object.entries(
        source.props ?? {},
      );
      const spec: Fields = Object.fromEntries(
        props.filter(([k]) => !STAGE_HEADING.includes(k)),
      );
      addLayer(b, {
        ...common,
        id: `${tb.id}/stage`,
        spec,
        z: spec.z ?? 'under',
        where: `${where}.props`,
      });
    }
    stageList(source.stage).forEach((spec, i) => {
      const z = isRecord(spec) ? spec.z : undefined;
      if (z !== 'under' && z !== 'over' && z !== undefined)
        fail(`${where}.stage`, 'z is under or over');
      addLayer(b, {
        ...common,
        id: `${tb.id}/stage-${i}`,
        spec,
        z: z ?? 'over',
        where: `${where}.stage`,
      });
    });
  }
}
