import type {
  CorrelationCell,
  correlationMatrix,
} from '../../correlation-data.mjs';
import type { PlotSpec } from '../../plot-data.mjs';
import type { CorrelationGeometry } from '../scene-types.mjs';

import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { drawCorrelationPanels } from './draw-correlation-panels.mjs';
import { pairReason } from './pair-reason.mjs';
import { correlationLabel } from './correlation-label.mjs';

export function drawCorrelationPair({
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
}: DrawCorrelationPairContext) {
  const top = h * (tall ? 0.3 : 0.34),
    pw = tall ? w - 2 * margin : (w - 2 * margin - w * 0.065) / 2,
    ph = h * (tall ? 0.205 : 0.39),
    gap = tall ? h * 0.08 : w * 0.065,
    local = {
      left: pw * 0.14,
      right: pw * 0.96,
      top: ph * 0.23,
      bottom: ph * 0.82,
    },
    xAxis = {
      ...p.x,
      domain: [model.window.start, model.window.end],
      ticks: [model.window.start, model.window.end],
    };
  check(model.months.length >= 2, 'pair chart needs two distinct months');
  drawCorrelationPanels({
    selectedPair,
    p,
    margin,
    tall,
    pw,
    gap,
    top,
    ph,
    local,
    xAxis,
    id,
    size,
    model,
    reveal,
    cell,
    geometry,
    w,
    elements,
  });
  const reason = pairReason(cell);
  elements.push(
    text(
      id + '-coefficient',
      `r = ${correlationLabel(cell)} · n = ${cell.n} · ${reason}`,
      margin,
      h * (tall ? 0.84 : 0.81),
      w * (tall ? 0.032 : 0.027),
      { font: 'figures', fit: w - 2 * margin },
    ),
    text(
      id + '-limit',
      'Hollow = unpaired observation · correlation is not causation',
      margin,
      h * (tall ? 0.875 : 0.87),
      w * (tall ? 0.026 : 0.021),
      { fit: w - 2 * margin },
    ),
  );
}

export interface DrawCorrelationPairContext {
  h: number;
  tall: boolean;
  w: number;
  margin: number;
  p: PlotSpec;
  model: ReturnType<typeof correlationMatrix>;
  selectedPair: [string, string];
  id: string;
  size: number;
  reveal: boolean;
  cell: CorrelationCell;
  geometry: CorrelationGeometry;
  elements: CanvasElement[];
}
