import type {
  AllocationRoute,
  Point,
  Card,
  TokenTrack,
  RouteLeg,
} from '../scene-types.mjs';
import type { allocationClock } from '../../allocation-data.mjs';

import { required } from '../validation.mjs';

import { check } from './check.mjs';
import { hits } from './hits.mjs';

export function layoutAllocationRoutes({
  clock,
  slot,
  cardById,
  tall,
  w,
  size,
  positions,
  h,
  trackById,
  routes,
}: LayoutAllocationRoutesContext) {
  for (const e of clock.events) {
    const from = slot(e.from, e.fromSlot),
      to = slot(e.to, e.toSlot),
      a = required(
        cardById.get(e.from),
        'allocation scene: unknown source bucket',
      ),
      b = required(
        cardById.get(e.to),
        'allocation scene: unknown destination bucket',
      ),
      raw: Point[] = tall
        ? [
            from,
            [from[0], a.corridorY],
            [w * 0.865 - size / 2, a.corridorY],
            [w * 0.865 - size / 2, b.corridorY],
            [to[0], b.corridorY],
            to,
          ]
        : [from, [from[0], a.corridorY], [to[0], b.corridorY], to];
    const points = raw.filter(
        (p, i) => !i || p.some((v, k) => v !== raw[i - 1][k]),
      ),
      lengths = points
        .slice(1)
        .map(
          (p, i) =>
            Math.abs(p[0] - points[i][0]) + Math.abs(p[1] - points[i][1]),
        ),
      length = lengths.reduce((s, v) => s + v, 0);
    check(
      required(
        positions.get(e.token),
        'allocation scene: missing token position',
      ).every((v, k) => v === from[k]),
      'token source slot mismatch',
    );
    for (const p of points)
      check(
        p[0] >= w * 0.08 &&
          p[0] + size <= w * 0.92 &&
          p[1] >= h * 0.28 &&
          p[1] + size <= h * 0.8,
        'token route leaves reserved bounds',
      );
    checkRouteClearance(positions, e.token, points, size);
    const track = required(
        trackById.get(e.token),
        'allocation scene: missing token track',
      ),
      legs: RouteLeg[] = [];
    let elapsed = 0;
    for (let i = 1; i < points.length; i++) {
      const duration = ((e.end - e.start) * lengths[i - 1]) / length,
        start = e.start + elapsed;
      track.keys.push({
        at: start,
        dur: duration,
        ease: 'linear',
        x: points[i][0] - track.initial[0],
        y: points[i][1] - track.initial[1],
      });
      legs.push({
        from: points[i - 1],
        to: points[i],
        start,
        end: start + duration,
      });
      elapsed += duration;
    }
    positions.set(e.token, [...to]);
    routes.push({ ...e, points, legs });
  }
}

export interface LayoutAllocationRoutesContext {
  clock: ReturnType<typeof allocationClock>;
  slot: (bucket: string, index: number) => Point;
  cardById: Map<string, Card>;
  tall: boolean;
  w: number;
  size: number;
  positions: Map<string, Point>;
  h: number;
  trackById: Map<string, TokenTrack>;
  routes: AllocationRoute[];
}

function checkRouteClearance(
  positions: Map<string, Point>,
  token: string,
  points: Point[],
  size: number,
): void {
  for (const [id, p] of positions)
    if (id !== token)
      for (let i = 1; i < points.length; i++)
        check(
          !hits(points[i - 1], points[i], p, size),
          `route overlaps stationary token ${id}`,
        );
}
