import { rankSeries } from './multiple-data.mjs';
import { axisLabel, type AxisValue } from './plot-data.mjs';
import type { CanvasElement } from './types.mjs';
import type {
  MultiplePoint,
  MultipleSceneOptions,
} from './multiple-scene-contracts.mjs';
import { check } from './multiple-scene-common.mjs';
import { multipleLayout } from './multiple-scene-layout.mjs';
export function multipleContext(
  input: unknown,
  {
    width,
    height,
    id,
    subtitle,
    expandedId = null,
    reveal = false,
  }: MultipleSceneOptions,
) {
  check(
    typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id),
    'scene id required',
  );
  check(
    typeof subtitle === 'string' && subtitle.length <= 110,
    'short subtitle required',
  );
  const model = rankSeries(input),
    p = model.plot,
    L = multipleLayout({ width, height, count: model.panels.length });
  check(
    expandedId === null || model.panels.some((s) => s.id === expandedId),
    'selected series must exist',
  );
  const F = L.type,
    tick = L.tick,
    local = {
      left: L.pw * 0.18,
      right: L.pw * 0.97,
      top: L.ph * 0.34,
      bottom: L.ph * 0.87,
    },
    elements: CanvasElement[] = [],
    geometry: MultiplePoint[] = [];
  const year = (v: AxisValue): string => String(v).slice(0, 4);
  const dateLabel = (value: AxisValue): string =>
    p.x.dateFormat === 'month' && year(p.x.domain[0]) === year(p.x.domain[1])
      ? axisLabel(value, p.x).slice(0, 3)
      : axisLabel(value, p.x);
  return {
    width,
    height,
    id,
    subtitle,
    expandedId,
    reveal,
    model,
    p,
    L,
    F,
    tick,
    local,
    elements,
    geometry,
    year,
    dateLabel,
  };
}
