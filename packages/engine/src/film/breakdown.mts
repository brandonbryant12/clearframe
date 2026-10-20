import { plotLayout } from './plots.mjs';
import { check } from './breakdown-common.mjs';
import { breakdownSpec } from './breakdown-spec.mjs';
import { breakdownElements } from './breakdown-elements.mjs';
import type { BlockProps as AuthoredProps } from '../engine/domain.mjs';
import type { HelperFrame, CanvasElement } from './types.mjs';
import type { BreakdownWhen } from './breakdown-contracts.mjs';
export { breakdownSpec, breakdownElements };
export { RESIDUAL_ID, MORPH } from './breakdown-common.mjs';
/** The last arrival of a breakdown's elements (its reading hold starts there). */
export const breakdownSettle = (elements: CanvasElement[]): number =>
  Math.max(
    0,
    ...elements
      .filter((e) => /^bd-/.test(e.id ?? ''))
      .map(
        (e) =>
          (e.at ?? 0) +
          (e.dur ?? 0.6) +
          Math.max(
            0,
            ...(e.keys ?? []).map(
              (k) => (k.at ?? 0) + (k.dur ?? 0) - (e.at ?? 0),
            ),
          ),
      ),
  );

export function expandBreakdownProps(
  input: AuthoredProps,
  frame: HelperFrame,
): AuthoredProps {
  if (input?.breakdown == null) return input;
  const { breakdown, ...rest } = structuredClone(input);
  for (const key of [
    'plot',
    'bars',
    'bridge',
    'stat',
    'distribution',
    'multiples',
    'kpi',
    'teaching',
    'chart',
    'sketch',
    'plates',
    'world',
    'dolly',
    'focus',
    'viewDrift',
    'title',
    'diagram',
    'process',
    'decision',
  ] as const)
    check(rest[key] == null, `cannot combine breakdown with ${key}`);
  const p = breakdownSpec(breakdown, rest.source);
  const resolve = frame.when;
  const when: BreakdownWhen = resolve
    ? (item, fallback) =>
        item.say != null || item.cue != null || item.at != null
          ? resolve(item, fallback, 'breakdown')
          : fallback
    : (item, fallback) => item.at ?? fallback;
  const elements = breakdownElements(p, frame, when);
  const settle = breakdownSettle(elements);
  if (frame.duration != null)
    check(
      settle <= frame.duration,
      `the breakdown finishes at ${settle.toFixed(2)} s, after the beat ends; cue the parts earlier or lengthen the beat`,
    );
  const L = plotLayout(frame);
  return {
    ...rest,
    sourceSize: Math.max(30, L.type * 0.95),
    source: `${p.source} · ${p.asOf}`,
    view: rest.view ?? [0, 0, frame.width, frame.height],
    elements: [...elements, ...(rest.elements ?? [])],
  };
}
