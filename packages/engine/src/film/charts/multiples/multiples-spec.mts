import { plotSpec, utcDay } from '../../plot-data.mjs';

import type { MultiplesSpec } from './contracts.mjs';
import { own } from './own.mjs';
import { check } from './check.mjs';

export function multiplesSpec(
  input: unknown,
  source?: string | null,
): MultiplesSpec {
  // Its fields are checked below (each panel by plotSpec).
  own<MultiplesSpec>(
    input,
    [
      'title',
      'unit',
      'x',
      'y',
      'series',
      'highlight',
      'asOf',
      'source',
      'motion',
    ],
    'multiples',
  );
  const p = structuredClone(input);
  check(
    p.source == null || source == null || p.source === source,
    'source conflicts with props.source',
  );
  p.source ??= source ?? undefined;
  check(
    typeof p.unit === 'string' && p.unit.trim() && p.unit.length <= 60,
    'unit names the measure and scale, up to 60 characters',
  );
  check(
    Array.isArray(p.series) && p.series.length >= 2 && p.series.length <= 9,
    'series needs 2–9 panels',
  );
  utcDay(p.asOf);
  // Every panel is validated as a one-series plot on the shared axes.
  p.panels = p.series.map((s) =>
    plotSpec({
      title: p.title,
      x: p.x,
      y: p.y,
      series: [s],
      asOf: p.asOf,
      source: p.source,
      ...(p.motion !== undefined ? { motion: p.motion } : {}),
    }),
  );
  const ids = new Set(p.series.map((s) => s.id));
  check(ids.size === p.series.length, 'series ids must be unique');
  check(
    p.highlight == null || ids.has(p.highlight),
    'highlight must name a series id',
  );
  p.x = p.panels[0].x;
  p.y = p.panels[0].y;
  p.motion = p.panels[0].motion;
  return p;
}
