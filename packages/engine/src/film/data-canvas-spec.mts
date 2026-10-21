import type { Fail } from './types.mjs';
import type { ChartSpec } from './data-canvas-contracts.mjs';

import { decodeChartInput, fieldOf } from './data-canvas-schema.mjs';
/** Validate a `chart` spec; `fail(message)` throws with the caller's context. */
export function chartSpec(input: unknown, fail: Fail): ChartSpec {
  const spec = decodeChartInput(input, fail);
  // Each field is checked below.

  if (!['bars', 'stack', 'number'].includes(spec.kind))
    fail('chart.kind must be bars, stack or number');
  if (
    !Array.isArray(spec.values) ||
    !spec.values.length ||
    spec.values.length > 12
  )
    fail(
      `chart.values must be 1–12 {label, value}, like "values": [{"label": "Link expires after", "value": 7, "say": "seven"}]${[
        'rows',
        'data',
        'items',
        'bars',
        'series',
        'value',
        'number',
      ]
        .filter((k) => fieldOf(input, k) != null)
        .map((k) => ` (it has ${k}: the figures go in values)`)
        .join('')}`,
    );
  spec.values.forEach((v, i) => {
    if (!v || !Number.isFinite(v.value) || v.value < 0)
      fail(`chart.values[${i}].value must be a nonnegative number`);
    if (typeof v.label !== 'string' || !v.label.trim())
      fail(`chart.values[${i}] needs a label`);
    if (v.say != null && (typeof v.say !== 'string' || !v.say.trim()))
      fail(
        `chart.values[${i}].say must be a word of the narration: the value lands when it is spoken`,
      );
  });
  if (
    spec.box != null &&
    !(
      Array.isArray(spec.box) &&
      spec.box.length === 4 &&
      spec.box.every(Number.isFinite)
    )
  )
    fail('chart.box must be [x, y, w, h]');
  for (const k of Object.keys(spec))
    if (
      ![
        'kind',
        'values',
        'box',
        'max',
        'prefix',
        'suffix',
        'decimals',
        'id',
        'at',
        'stagger',
        'note',
      ].includes(k)
    )
      fail(`chart: unsupported field ${k}`);
  checkChartNote(spec, fail);
  return spec;
}

function checkChartNote(spec: ChartSpec, fail: Fail): void {
  if (spec.note != null) {
    const n = spec.note;
    if (
      !n ||
      typeof n !== 'object' ||
      typeof n.text !== 'string' ||
      !n.text.trim()
    )
      fail(
        'chart.note must be {text, to?, say?|at?}: the narration-cued annotation that replaces a heading',
      );
    for (const k of Object.keys(n))
      if (!['text', 'to', 'say', 'at'].includes(k))
        fail(`chart.note: unsupported field ${k}`);
    if (n.to != null && !spec.values.some((v) => v.label === n.to))
      fail(
        `chart.note.to must be one of the value labels (${spec.values.map((v) => v.label).join(', ')})`,
      );
  }
}
