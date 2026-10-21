import type { ValuationGeometry } from '../scene-types.mjs';
import type { valuationGrid } from '../../valuation-data.mjs';
import { show, text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { valuationColor } from './valuation-color.mjs';
import { check } from './check.mjs';
import { cellStroke } from './cell-stroke.mjs';

export function drawValuationCells({
  m,
  px,
  xEdges,
  py,
  yEdges,
  reveal,
  elements,
  id,
  value,
  geometry,
}: DrawValuationCellsContext) {
  for (const c of m.cells) {
    const x = px(xEdges[c.column]) + 3,
      y = py(yEdges[c.row]) + 3,
      cw = px(xEdges[c.column + 1]) - x - 3,
      ch = py(yEdges[c.row + 1]) - y - 3,
      at = reveal ? 0.4 + (c.row + c.column) * 0.13 : 0,
      selected =
        c.growth === m.selected.growth && c.discount === m.selected.discount,
      onSlice =
        m.slice.vary === 'discount'
          ? c.growth === m.selected.growth
          : c.discount === m.selected.discount,
      fill = valuationColor(c.value, m.scale),
      font = Math.min(cw * 0.245, ch * 0.3);
    check(
      font >= 28 && cw > 0 && ch > 0,
      'grid too dense; reduce rates or enlarge the frame',
    );
    elements.push(
      {
        id: `${id}-cell-${c.row}-${c.column}`,
        type: 'rect',
        x,
        y,
        w: cw,
        h: ch,
        r: 3,
        fill,
        stroke: onSlice ? 'ink' : 'line',
        width: cellStroke(selected, onSlice),
        ...show,
        at,
      },
      text(
        `${id}-value-${c.row}-${c.column}`,
        value(c.value),
        x + cw / 2,
        y + ch * 0.57,
        font,
        { anchor: 'middle', font: 'figures', fit: cw * 0.91, at },
      ),
    );
    geometry.cells.push({
      ...c,
      box: [x, y, cw, ch],
      center: [px(c.discount), py(c.growth)],
      fill,
      label: value(c.value),
      at,
      selected,
      onSlice,
    });
  }
}

export interface DrawValuationCellsContext {
  m: ReturnType<typeof valuationGrid>;
  px: (v: number) => number;
  xEdges: number[];
  py: (v: number) => number;
  yEdges: number[];
  reveal: boolean;
  elements: CanvasElement[];
  id: string;
  value: (v: number | null) => string;
  geometry: ValuationGeometry;
}
