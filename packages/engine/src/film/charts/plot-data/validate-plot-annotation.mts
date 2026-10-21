import type { PlotSpec } from './contracts.mjs';
import { own } from './own.mjs';
import { text, finite } from './primitives.mjs';
import { check } from './check.mjs';

export function validatePlotAnnotation(p: PlotSpec) {
  if (p.annotation != null) {
    const a = p.annotation;
    own(a, ['seriesId', 'x', 'label', 'dx', 'dy'], 'annotation');
    text(a.label, 'annotation.label', 45);
    const s = p.series.find((s) => s.id === a.seriesId);
    check(
      s?.values.some((v) => v.x === a.x && v.y !== null),
      'annotation must point to an actual nonmissing observation',
    );
    for (const k of ['dx', 'dy'] as const)
      check(
        finite(a[k]) && Math.abs(a[k]) <= 0.5,
        `annotation.${k} must be a plot-relative offset in [-0.5,0.5]`,
      );
  }
}
