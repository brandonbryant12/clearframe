import type { PlotSpec } from './contracts.mjs';
import { own } from './own.mjs';
import { text, finite } from './primitives.mjs';
import { utcDay } from './utc-day.mjs';
import { check } from './check.mjs';
import { axisSpec } from './axis-spec.mjs';
import { validatePlotSeries } from './validate-plot-series.mjs';
import { validatePlotBands } from './validate-plot-bands.mjs';
import { validatePlotAnnotation } from './validate-plot-annotation.mjs';

export function plotSpec(input: unknown, source?: string | null): PlotSpec {
  // Its fields are checked below.
  own<PlotSpec>(
    input,
    [
      'title',
      'x',
      'y',
      'series',
      'asOf',
      'source',
      'motion',
      'annotation',
      'bands',
      'area',
    ],
    'plot',
  );
  const p = structuredClone(input);
  text(p.title, 'title', 70);
  utcDay(p.asOf);
  check(
    p.source == null || source == null || p.source === source,
    'source conflicts with props.source',
  );
  p.source = text(p.source ?? source, 'source', 110);
  p.x = axisSpec(p.x, 'x');
  p.y = axisSpec(p.y, 'y');
  const x = p.x,
    y = p.y;
  check(
    Array.isArray(p.series) && p.series.length >= 1 && p.series.length <= 4,
    'series needs 1–4 comparable series',
  );
  validatePlotSeries(p, x, y);
  if (p.motion === undefined) p.motion = { at: 0.5, duration: 3 };
  if (p.motion !== 'none') {
    own(p.motion, ['at', 'duration'], 'motion');
    check(
      finite(p.motion.at) && p.motion.at >= 0 && p.motion.at <= 10,
      'motion.at must be 0–10 seconds',
    );
    check(
      finite(p.motion.duration) &&
        p.motion.duration >= 0.2 &&
        p.motion.duration <= 20,
      'motion.duration must be 0.2–20 seconds',
    );
  }
  validatePlotBands(p, x);
  check(
    p.area == null || typeof p.area === 'boolean',
    'area must be true or false',
  );
  validatePlotAnnotation(p);
  return p;
}
