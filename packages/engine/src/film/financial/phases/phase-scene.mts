import type { PhaseInput } from '../../phase-data.mjs';
import type {
  PhaseOptions,
  PhaseGeometry,
  PhaseDrawingPoint,
} from '../scene-types.mjs';
import { phaseTrail } from '../../phase-data.mjs';
import { show, text } from '../drawing.mjs';
import { required } from '../validation.mjs';
import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { drawPhaseHeader } from './draw-phase-header.mjs';
import { drawPhaseAxes } from './draw-phase-axes.mjs';
import { drawPhaseQuadrants } from './draw-phase-quadrants.mjs';
import { drawPhaseSegments } from './draw-phase-segments.mjs';
import { drawPhaseMarkers } from './draw-phase-markers.mjs';
import { drawPhaseReadout } from './draw-phase-readout.mjs';
import { drawPhaseTimeline } from './draw-phase-timeline.mjs';
import { drawPhaseSummary } from './draw-phase-summary.mjs';

export function phaseScene(
  input: PhaseInput,
  { width: w, height: h, id, view = 'trail', reveal = false }: PhaseOptions,
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
  check(['trail', 'focus'].includes(view), 'view must be trail or focus');
  check(typeof reveal === 'boolean', 'reveal must be boolean');
  const m = phaseTrail(input);
  check(
    m.points.length <= 24,
    'at most 24 dated rows per picture; select and declare a shorter window',
  );
  const tall = h > w,
    margin = w * (tall ? 0.105 : 0.07),
    font = w * (tall ? 0.031 : 0.022),
    small = w * (tall ? 0.028 : 0.02),
    left = w * (tall ? 0.2 : 0.41),
    right = w * (tall ? 0.89 : 0.93),
    top = h * (tall ? 0.3 : 0.235),
    bottom = h * (tall ? 0.665 : 0.72),
    r = w * 0.006,
    px = (v: number) =>
      left +
      ((v - m.x.domain[0]) / (m.x.domain[1] - m.x.domain[0])) * (right - left),
    py = (v: number) =>
      bottom -
      ((v - m.y.domain[0]) / (m.y.domain[1] - m.y.domain[0])) * (bottom - top),
    rx = px(m.x.reference),
    ry = py(m.y.reference),
    sourceId = id + '-source',
    elements: CanvasElement[] = [],
    geometry: PhaseGeometry = {
      box: [left, top, right, bottom],
      reference: [rx, ry],
      points: [],
      segments: [],
      labels: [],
      timeline: [],
    },
    points: PhaseDrawingPoint[] = m.points.map((p) => ({
      ...p,
      point: p.x !== null && p.y !== null ? [px(p.x), py(p.y)] : null,
      at: reveal && view === 'trail' ? 1 + 12 * p.time : 0,
    }));
  const copyWidth = tall ? w - 2 * margin : left - margin - small * 2.8;
  const yLabelWidth = tall ? left - margin - small * 0.6 : small * 2.1;
  drawPhaseHeader({
    elements,
    id,
    m,
    margin,
    h,
    tall,
    w,
    font,
    copyWidth,
    small,
  });
  drawPhaseAxes({
    m,
    px,
    small,
    py,
    left,
    right,
    yLabelWidth,
    elements,
    id,
    top,
    bottom,
    tall,
    margin,
    w,
  });
  const located = (p: PhaseDrawingPoint) =>
    required(p.point, 'phase scene: complete observation has no point');
  drawPhaseQuadrants({
    m,
    located,
    points,
    left,
    top,
    rx,
    ry,
    right,
    bottom,
    small,
    r,
    elements,
    id,
    geometry,
  });
  drawPhaseSegments({
    m,
    points,
    elements,
    id,
    located,
    view,
    w,
    reveal,
    geometry,
  });
  // All observed markers paint over the connecting guides. No marker travels
  // through unobserved intermediate states, and null has no invented location.
  drawPhaseMarkers({ points, geometry, elements, id, located, r, view, m });
  const focus = points[m.focus.index];
  if (view === 'focus' && focus.valid)
    elements.push({
      id: id + '-selected',
      type: 'circle',
      cx: located(focus)[0],
      cy: located(focus)[1],
      r: r * 1.65,
      fill: 'none',
      stroke: 'ink',
      width: 3,
      ...show,
    });
  drawPhaseReadout({
    h,
    tall,
    left,
    margin,
    right,
    copyWidth,
    view,
    points,
    reveal,
    elements,
    id,
    small,
    located,
    r,
  });
  drawPhaseTimeline({
    h,
    tall,
    left,
    right,
    small,
    points,
    r,
    elements,
    id,
    m,
    view,
    geometry,
  });
  drawPhaseSummary({
    h,
    tall,
    focus,
    m,
    copyWidth,
    view,
    elements,
    id,
    margin,
    small,
  });
  elements.push(
    text(
      sourceId,
      `${m.source} · as of ${m.asOf}`,
      margin,
      h * (tall ? 0.925 : 0.935),
      Math.max(28, small),
      { width: w - 2 * margin, height: h * 0.045 },
    ),
  );
  return {
    model: m,
    geometry,
    props: { view: [0, 0, w, h], sourceElement: sourceId, elements },
  };
}
