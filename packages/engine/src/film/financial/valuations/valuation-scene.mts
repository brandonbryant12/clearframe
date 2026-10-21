import type { ValuationInput } from '../../valuation-data.mjs';
import type { ValuationOptions, ValuationGeometry } from '../scene-types.mjs';
import { valuationGrid } from '../../valuation-data.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { valuationLabel } from './valuation-label.mjs';
import { drawValuationHeader } from './draw-valuation-header.mjs';
import { drawValuationGrid } from './draw-valuation-grid.mjs';
import { drawValuationSlice } from './draw-valuation-slice.mjs';

export function valuationScene(
  input: ValuationInput,
  { width: w, height: h, id, view = 'grid', reveal = false }: ValuationOptions,
) {
  check(
    Number.isFinite(w) &&
      Number.isFinite(h) &&
      w >= 640 &&
      h >= 640 &&
      w <= 4096 &&
      h <= 4096,
    'frame dimensions must be 640–4096',
  );
  check(
    typeof id === 'string' && /^[a-z][a-z0-9-]*$/.test(id),
    'scene id required',
  );
  check(['grid', 'slice'].includes(view), 'view must be grid or slice');
  check(typeof reveal === 'boolean', 'reveal must be boolean');
  const model = valuationGrid(input),
    m = model,
    tall = h > w,
    margin = w * (tall ? 0.105 : 0.07),
    size = w * (tall ? 0.03 : 0.023),
    elements: CanvasElement[] = [],
    geometry: ValuationGeometry = { cells: [], points: [], segments: [] },
    sourceId = id + '-source',
    rate = (v: number) => v.toFixed(m.rateDecimals) + '%',
    fixed =
      m.slice.vary === 'discount'
        ? `Growth fixed at ${rate(m.selected.growth)}`
        : `Discount fixed at ${rate(m.selected.discount)}`,
    value = (v: number | null) => valuationLabel(v, m.scale.decimals);
  const terminal =
    m.terminal.kind === 'none'
      ? `${m.terminal.periods} year-end payments · no terminal value`
      : 'Year-end payments · perpetual growth';
  drawValuationHeader({
    elements,
    id,
    m,
    margin,
    h,
    tall,
    w,
    terminal,
    fixed,
    value,
  });
  if (view === 'grid') {
    drawValuationGrid({
      m,
      w,
      tall,
      h,
      elements,
      id,
      size,
      margin,
      rate,
      reveal,
      value,
      geometry,
    });
  } else {
    drawValuationSlice({
      w,
      h,
      tall,
      m,
      elements,
      id,
      margin,
      size,
      rate,
      reveal,
      geometry,
    });
  }
  elements.push(
    text(
      sourceId,
      `${m.source} ${m.asOf}.`,
      margin,
      h * (tall ? 0.915 : 0.935),
      w * (tall ? 0.028 : 0.022),
      { width: w - 2 * margin, height: h * 0.055 },
    ),
  );
  return {
    model,
    geometry,
    props: { view: [0, 0, w, h], sourceElement: sourceId, elements },
  };
}
