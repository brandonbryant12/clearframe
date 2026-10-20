import type { Point } from '../types.mjs';
import type { Box, Label, LabelCandidate } from './contracts.mjs';
import { r2 } from './shared.mjs';

interface LabelOptions {
  font: number;
  width: number;
  prefer?: number;
}
interface SegmentMetrics {
  length: number;
  x: number;
  y: number;
}

function horizontalSpots(
  { length, x, y }: SegmentMetrics,
  { font, width, prefer = 0 }: LabelOptions,
): LabelCandidate[] {
  if (length - 24 < width) return [];
  return [false, true].map((below) => {
    const baseline = below ? y + font * 1.45 : y - font * 0.7;
    return {
      x,
      y: baseline,
      anchor: 'middle',
      fit: Math.max(60, length - 24),
      box: {
        l: x - width / 2,
        r: x + width / 2,
        t: baseline - font * 0.8,
        b: baseline + font * 0.25,
      },
      bias: Number(below !== prefer > 0) - length / 1e4,
    };
  });
}

function verticalSpots(
  { length, x, y }: SegmentMetrics,
  { font, width, prefer = 0 }: LabelOptions,
): LabelCandidate[] {
  if (length <= font * 2) return [];
  return [false, true].map((left) => {
    const anchorX = left ? x - font * 0.6 : x + font * 0.6;
    const baseline = y + font * 0.3;
    return {
      x: anchorX,
      y: baseline,
      anchor: left ? 'end' : 'start',
      fit: font * 12,
      box: {
        l: left ? anchorX - width : anchorX,
        r: left ? anchorX : anchorX + width,
        t: baseline - font * 0.8,
        b: baseline + font * 0.25,
      },
      bias: 2 + Number(left !== prefer < 0) * 0.5 - length / 1e4,
    };
  });
}

function fallbackSpot(
  points: Point[],
  { font, width }: LabelOptions,
): LabelCandidate {
  const p = points[0],
    q = points[points.length - 1];
  const x = (p[0] + q[0]) / 2,
    y = (p[1] + q[1]) / 2 - font * 0.7;
  return {
    x,
    y,
    anchor: 'middle',
    fit: Math.max(60, Math.abs(q[0] - p[0]) - 24),
    box: {
      l: x - width / 2,
      r: x + width / 2,
      t: y - font * 0.8,
      b: y + font * 0.25,
    },
    bias: 0,
  };
}

/** Pick a readable connector label position with the fewest collisions. */
export function labelSpot(
  points: Point[],
  options: LabelOptions,
  clash: (box: Box) => number,
): Label & { box: Box } {
  const spots = points.slice(1).flatMap((q, i) => {
    const p = points[i];
    const metrics = {
      length: Math.hypot(q[0] - p[0], q[1] - p[1]),
      x: (p[0] + q[0]) / 2,
      y: (p[1] + q[1]) / 2,
    };
    return Math.abs(q[1] - p[1]) < 1
      ? horizontalSpots(metrics, options)
      : verticalSpots(metrics, options);
  });
  if (!spots.length) spots.push(fallbackSpot(points, options));
  const best = spots
    .map((spot) => ({ spot, cost: clash(spot.box) + spot.bias }))
    .sort((a, b) => a.cost - b.cost)[0].spot;
  return {
    x: r2(best.x),
    y: r2(best.y),
    anchor: best.anchor,
    fit: r2(best.fit),
    box: best.box,
  };
}
