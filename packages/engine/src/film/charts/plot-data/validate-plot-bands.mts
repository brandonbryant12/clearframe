import type { PlotSpec, Axis } from './contracts.mjs';
import { check } from './check.mjs';
import { own } from './own.mjs';
import { axisValue } from './axis-value.mjs';
import { axisPosition } from './axis-position.mjs';
import { text } from './primitives.mjs';

export function validatePlotBands(p: PlotSpec, x: Axis) {
  if (p.bands != null) {
    check(
      Array.isArray(p.bands) && p.bands.length >= 1 && p.bands.length <= 8,
      'bands needs 1–8 x ranges',
    );
    let previous = -Infinity;
    for (const [i, b] of p.bands.entries()) {
      own(b, ['from', 'to', 'label'], `bands[${i}]`);
      const from = axisValue(b.from, x.type),
        to = axisValue(b.to, x.type);
      axisPosition(b.from, x);
      axisPosition(b.to, x);
      check(
        from < to && from >= previous,
        'bands must be increasing, non-overlapping x ranges',
      );
      previous = to;
      if (b.label != null) text(b.label, `bands[${i}].label`, 24);
    }
  }
}
