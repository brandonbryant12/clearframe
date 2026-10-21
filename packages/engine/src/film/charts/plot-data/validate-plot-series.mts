import type { PlotSpec, Axis } from './contracts.mjs';
import { own } from './own.mjs';
import { check } from './check.mjs';
import { text } from './primitives.mjs';
import { axisValue } from './axis-value.mjs';
import { axisPosition } from './axis-position.mjs';

export function validatePlotSeries(p: PlotSpec, x: Axis, y: Axis) {
  const ids = new Set<string>(),
    labels = new Set<string>();
  let total = 0;
  for (const [i, s] of p.series.entries()) {
    own(s, ['id', 'label', 'values'], `series[${i}]`);
    check(
      typeof s.id === 'string' &&
        /^[a-z][a-z0-9-]{0,31}$/.test(s.id) &&
        !ids.has(s.id),
      'series ids must be unique slugs',
    );
    ids.add(s.id);
    text(s.label, 'series label', 30);
    check(!labels.has(s.label), 'series labels must be unique');
    labels.add(s.label);
    check(
      Array.isArray(s.values) && s.values.length >= 1,
      'each series needs explicit observations',
    );
    total += s.values.length;
    check(
      total <= 240,
      'at most 240 observations per picture; aggregate explicitly for a film',
    );
    let previous = -Infinity,
      observed = 0;
    for (const point of s.values) {
      own(point, ['x', 'y'], 'observation');
      const px = axisValue(point.x, x.type);
      axisPosition(point.x, x);
      check(
        px > previous,
        'observations must be strictly ordered without duplicate x values',
      );
      previous = px;
      if (point.y !== null) {
        axisPosition(point.y, y);
        observed++;
      }
    }
    check(observed > 0, 'an all-missing series has no drawable evidence');
  }
}
