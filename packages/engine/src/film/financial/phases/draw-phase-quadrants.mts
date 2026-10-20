import type { Quadrant, phaseTrail } from '../../phase-data.mjs';
import type {
  PhaseGeometry,
  PhaseDrawingPoint,
  Point,
  Box,
} from '../scene-types.mjs';
import { text } from '../drawing.mjs';

import type { CanvasElement } from '../../types.mjs';
import { check } from './check.mjs';
import { crosses } from './crosses.mjs';

export function drawPhaseQuadrants({
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
}: DrawPhaseQuadrantsContext) {
  const paths: [Point, Point][] = m.segments.map((s) => [
    located(points[s.from]),
    located(points[s.to]),
  ]);
  const quadrantBoxes: Record<Quadrant, Box> = {
    NW: [left, top, rx, ry],
    NE: [rx, top, right, ry],
    SW: [left, ry, rx, bottom],
    SE: [rx, ry, right, bottom],
  };
  const quadrantKeys: Quadrant[] = ['NW', 'NE', 'SW', 'SE'];
  for (const q of quadrantKeys) {
    const box = quadrantBoxes[q];
    const rows = m.quadrants[q].split('/').map((s) => s.trim());
    check(
      rows.length <= 2 && rows.every(Boolean),
      'quadrant labels need one line or two slash-separated lines',
    );
    const size = Math.max(28, small * 0.84),
      bw = Math.max(...rows.map((s) => s.length)) * size * 0.62 + 12,
      bh = rows.length * size * 1.2 + 8,
      pad = small * 0.25,
      [l, t, rr, bb] = box;
    check(
      bw + 2 * pad < rr - l && bh + 2 * pad < bb - t,
      'quadrant copy does not fit; shorten labels or move references away from the edge',
    );
    const candidates = [t + pad, bb - pad - bh, (t + bb - bh) / 2].flatMap(
        (y) => [l + pad, rr - pad - bw, (l + rr - bw) / 2].map((x) => [x, y]),
      ),
      clearance = r * 1.6 + 4;
    const placed = candidates.find(([x, y]) => {
      const b: Box = [
        x - clearance,
        y - clearance,
        x + bw + clearance,
        y + bh + clearance,
      ];
      return (
        points
          .filter((p) => p.valid)
          .every((p) => !crosses(located(p), located(p), b)) &&
        paths.every(([a, c]) => !crosses(a, c, b))
      );
    });
    check(
      placed,
      `no clear copy zone in ${q}; shorten quadrant labels or use a different declared window`,
    );
    const [x, y] = placed;
    rows.forEach((s, i) =>
      elements.push(
        text(
          `${id}-quadrant-${q}-${i}`,
          s,
          x,
          y + size * (0.95 + i * 1.2),
          size,
          { fill: 'muted' },
        ),
      ),
    );
    geometry.labels.push({ quadrant: q, box: [x, y, bw, bh], rows });
  }
}

export interface DrawPhaseQuadrantsContext {
  m: ReturnType<typeof phaseTrail>;
  located: (p: PhaseDrawingPoint) => Point;
  points: PhaseDrawingPoint[];
  left: number;
  top: number;
  rx: number;
  ry: number;
  right: number;
  bottom: number;
  small: number;
  r: number;
  elements: CanvasElement[];
  id: string;
  geometry: PhaseGeometry;
}
