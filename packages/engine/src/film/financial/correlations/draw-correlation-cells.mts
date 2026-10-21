import type { CorrelationGeometry } from '../scene-types.mjs';
import type { correlationMatrix } from '../../correlation-data.mjs';

import { show, text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { correlationLabel } from './correlation-label.mjs';
import { cellReason } from './cell-reason.mjs';
import { correlationColor } from './correlation-color.mjs';

export function drawCorrelationCells({
  model,
  left,
  stepX,
  top,
  step,
  reveal,
  selectedPair,
  id,
  inset,
  elements,
  tall,
  geometry,
}: DrawCorrelationCellsContext) {
  for (const c of model.cells) {
    const x = left + c.column * stepX,
      y = top + c.row * step,
      at = reveal ? 0.4 + (c.row + c.column) * 0.13 : 0,
      selected =
        (c.rowId === selectedPair[0] && c.columnId === selectedPair[1]) ||
        (c.rowId === selectedPair[1] && c.columnId === selectedPair[0]),
      label = correlationLabel(c),
      reason = cellReason(c);
    const box = {
      id: `${id}-cell-${c.row}-${c.column}`,
      type: 'rect' as const,
      x: x + inset,
      y: y + inset,
      w: stepX - 2 * inset,
      h: step - 2 * inset,
      r: 5,
      fill: correlationColor(c.value),
      stroke: selected ? 'ink' : 'line',
      width: selected ? 3 : 1,
      ...show,
      at,
    };
    elements.push(
      box,
      text(
        box.id + '-value',
        label,
        x + stepX / 2,
        y + step * 0.48,
        step * (tall ? 0.25 : 0.3),
        { anchor: 'middle', font: 'figures', fit: stepX * 0.9, at },
      ),
      text(
        box.id + '-count',
        reason,
        x + stepX / 2,
        y + step * 0.76,
        step * (tall ? 0.17 : 0.21),
        { anchor: 'middle', font: 'figures', fit: stepX * 0.9, at },
      ),
    );
    geometry.cells.push({
      ...c,
      box: [x + inset, y + inset, stepX - 2 * inset, step - 2 * inset],
      fill: box.fill,
      label,
      detail: reason,
      at,
      selected,
    });
  }
}

export interface DrawCorrelationCellsContext {
  model: ReturnType<typeof correlationMatrix>;
  left: number;
  stepX: number;
  top: number;
  step: number;
  reveal: boolean;
  selectedPair: [string, string];
  id: string;
  inset: number;
  elements: CanvasElement[];
  tall: boolean;
  geometry: CorrelationGeometry;
}
