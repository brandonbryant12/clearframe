import { isRecord } from '../../engine/lib/errors.mjs';
import { codeElement, codeRows } from '../code.mjs';
import type { CodeElement } from '../code.mjs';
import { fail, fieldsOf, items } from '../fields.mjs';
import type { Fields } from '../fields.mjs';
import { cueOr } from '../stage-kit.mjs';
import type { StageBuild } from '../stage-kit.mjs';

import type { CameraKey, PlanCamera, StageArea, Staged } from '../types.mjs';

/** A full-frame GPU material behind everything. */
export function compileGround(build: StageBuild, ground: unknown): void {
  if (!ground) return;
  const g = fieldsOf(ground),
    { frame } = build;
  build.out.under.push({
    type: 'shader',
    id: 'ground',
    x: -frame.width * 0.1,
    y: -frame.height * 0.1,
    w: frame.width * 1.2,
    h: frame.height * 1.2,
    material: {
      name: g.material ?? 'noise',
      ...(g.colors ? { colors: g.colors } : {}),
      scale: g.scale ?? 1.4,
      amount: g.amount ?? 0.5,
      speed: g.speed ?? 0.6,
      seed: g.seed ?? 3,
    },
    opacity: g.opacity ?? 0.35,
    enter: 'fade',
    at: 0,
    dur: 0.8,
    z: g.z ?? 4,
  });
}

/**
 * With no actors the code is the picture: by default it takes the stage area (wide, larger type,
 * an inline diff centred down it) instead of the corner an editor beside a diagram uses. A tall
 * frame's area is already inside its margins: there the editor takes all of its width, at a size
 * a phone reads, and long lines wrap (fitCode) rather than shrink.
 */
export function soloPlace(area: StageArea, code: Fields, tall: boolean) {
  const aw = area.right - area.left,
    ah = area.bottom - area.top,
    size = tall ? 34 : 36;
  const lines = Math.max(
    ...[code.before, code.after].map((t) =>
      typeof t === 'string' ? t.split('\n').length : 0,
    ),
  );
  const h = lines ? (lines + 2.2) * size * 1.55 : 0;
  return {
    x: area.left + (tall ? 0 : aw * 0.08),
    w: aw * (tall ? 1 : 0.84),
    size,
    y: lines ? area.top + Math.max(0, (ah - h) * 0.4) : area.top + ah * 0.1,
  };
}

export function compileCode(
  build: StageBuild,
  spec: Fields,
  { staged, root }: { staged?: Staged; root?: string },
): CodeElement[] {
  if (!spec.code) return [];
  const authored = fieldsOf(spec.code),
    { area } = build;
  const tall = build.frame.height > build.frame.width;
  const solo = items(spec.actors, build.where, 'actors').length
    ? null
    : soloPlace(area, authored, tall);
  const el = codeElement(
    { ...solo, ...authored },
    { cue: build.cue, where: `${build.where}.code`, staged, root, area },
  );
  // Code read from git has no line count until it is fitted: on a tall frame, centre the fitted
  // editor down the stage as inline code is, rather than leave it near the top.
  if (
    solo &&
    tall &&
    authored.y == null &&
    !authored.before &&
    !authored.after
  ) {
    const h =
      el.size *
      (codeRows(el) * (el.leading ?? 1.5) + (el.title ? 1.9 : 0) + 1.8);
    el.y = area.top + Math.max(0, (area.bottom - area.top - h) * 0.4);
  }
  return [el];
}

/** The authored camera with its keys on the layer clock, plus the keys camera events add. */
export function compileCamera(
  build: StageBuild,
  authored: unknown,
): PlanCamera | null {
  const { where } = build;
  const clone: unknown = authored ? structuredClone(authored) : {};
  const camera = isRecord(clone) ? clone : fail(where, 'camera is an object');
  const timed = (k: unknown): CameraKey => {
    const key = isRecord(k) ? k : fail(where, 'camera keys are objects');
    return { ...key, at: cueOr(build, key.say ?? key.at, 0), say: undefined };
  };
  let keys: CameraKey[] | undefined;
  if (camera.keys)
    camera.keys = keys = items(camera.keys, where, 'camera.keys').map(timed);
  const focus = camera.focus;
  if (isRecord(focus) && focus.keys)
    focus.keys = items(focus.keys, where, 'camera.focus.keys').map(timed);
  if (build.cameraKeys.length)
    camera.keys = [...(keys ?? []), ...build.cameraKeys].sort(
      (p, q) => p.at - q.at,
    );
  return Object.keys(camera).length ? camera : null;
}
