import type { CorrelationInput } from '../../correlation-data.mjs';

import type {
  CorrelationOptions,
  CorrelationGeometry,
} from '../scene-types.mjs';
import { correlationMatrix } from '../../correlation-data.mjs';

import { text } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { drawCorrelationHeader } from './draw-correlation-header.mjs';
import { drawCorrelationMatrix } from './draw-correlation-matrix.mjs';
import { drawCorrelationPair } from './draw-correlation-pair.mjs';

export function correlationScene(
  input: CorrelationInput,
  {
    width: w,
    height: h,
    id,
    selectedPair,
    view = 'matrix',
    reveal = false,
  }: CorrelationOptions,
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
  check(['matrix', 'pair'].includes(view), 'view must be matrix or pair');
  const model = correlationMatrix(input),
    p = model.plot,
    n = p.series.length,
    tall = h > w;
  check(
    Array.isArray(selectedPair) &&
      selectedPair.length === 2 &&
      selectedPair[0] !== selectedPair[1] &&
      selectedPair.every((s) => p.series.some((v) => v.id === s)),
    'select two distinct existing IDs',
  );
  const cell = required(
      model.cells.find(
        (c) => c.rowId === selectedPair[0] && c.columnId === selectedPair[1],
      ),
      'correlation scene: missing selected cell',
    ),
    elements: CanvasElement[] = [],
    geometry: CorrelationGeometry = { cells: [], points: [], segments: [] },
    margin = w * (tall ? 0.105 : 0.07),
    size = w * (tall ? 0.035 : 0.023),
    sourceId = id + '-source';
  const heading =
    view === 'matrix'
      ? p.title
      : `${
          required(
            p.series.find((s) => s.id === selectedPair[0]),
            'correlation scene: missing series observation',
          ).label
        } + ${
          required(
            p.series.find((s) => s.id === selectedPair[1]),
            'correlation scene: missing series observation',
          ).label
        }`;
  drawCorrelationHeader({ elements, id, heading, margin, h, tall, w, model });
  if (view === 'matrix') {
    drawCorrelationMatrix({
      w,
      tall,
      n,
      h,
      p,
      elements,
      id,
      size,
      margin,
      model,
      reveal,
      selectedPair,
      geometry,
    });
  } else {
    drawCorrelationPair({
      h,
      tall,
      w,
      margin,
      p,
      model,
      selectedPair,
      id,
      size,
      reveal,
      cell,
      geometry,
      elements,
    });
  }
  elements.push(
    text(
      sourceId,
      `${p.source} ${p.asOf}.`,
      margin,
      h * (tall ? 0.91 : 0.94),
      w * (tall ? 0.028 : 0.023),
      { width: w - 2 * margin, height: h * 0.055 },
    ),
  );
  return {
    model,
    selectedCell: cell,
    geometry,
    props: { view: [0, 0, w, h], sourceElement: sourceId, elements },
  };
}
