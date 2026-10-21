import type { BlockProps, PropHelpers } from '../types.mjs';

import type { BlockValidator } from './contracts.mjs';

export const validateBars: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
  { vertical },
) => {
  h.list(p.data, 'data', 2, 8);
  p.data.forEach((d) => {
    h.keys(d, ['label', 'value'], 'data');
    h.text(d.label, 'label', 65);
    h.num(d.value, 'value');
    if (d.value < 0) h.fail('bars require a zero-based nonnegative scale');
    h.required(d.label, 'data.label');
  });
  if (!['none', 'desc', undefined].includes(p.sort))
    h.fail('sort must be none or desc');
  if (p.sort === 'desc') p.data.sort((a, b) => b.value - a.value);
  const largest = Math.max(...p.data.map((d) => d.value));
  p.max ??= largest * 1.08 || 1;
  if (!Number.isFinite(p.max) || p.max <= 0 || p.max < largest)
    h.fail('max must be positive and cover every value');
  p.orientation ??= 'auto';
  if (p.orientation === 'auto')
    p.orientation =
      vertical || p.data.some((d) => d.label.length > 12) || p.data.length > 5
        ? 'horizontal'
        : 'vertical';
  if (!['horizontal', 'vertical'].includes(p.orientation))
    h.fail('unknown orientation');
  h.format(p.data.map((d) => d.value));
  if (p.focus) {
    const f = p.focus;
    h.keys(f, ['label', 'index', 'say', 'dim', 'dur', 'note'], 'focus');
    h.text(f.note, 'focus.note', 100);
    f.index ??= p.data.findIndex((d) => d.label === f.label);
    if (!Number.isInteger(f.index) || !p.data[f.index])
      h.fail('focus must select an existing label/index');
    f.dim ??= 0.28;
    f.dur ??= 0.5;
    if (
      !Number.isFinite(f.dim) ||
      f.dim < 0 ||
      f.dim > 1 ||
      !Number.isFinite(f.dur) ||
      f.dur < 0
    )
      h.fail('focus dim must be 0–1 and dur nonnegative');
  }
};

export const validateLine: BlockValidator = (p: BlockProps, h: PropHelpers) => {
  h.list(p.series, 'series', 2, 40);
  const series = p.series.map((d, i) =>
    typeof d === 'number' ? { x: i, y: d } : d,
  );
  p.series = series;
  series.forEach((d, i) => {
    h.keys(d, ['x', 'y'], 'series');
    h.num(d.x, 'series.x');
    h.num(d.y, 'series.y');
    if (i && d.x <= series[i - 1].x) h.fail('x coordinates must increase');
  });
  p.min ??= Math.min(0, ...series.map((d) => d.y));
  p.max ??= Math.max(0, ...series.map((d) => d.y)) * 1.1 || 1;
  const { min, max } = p;
  if (
    !Number.isFinite(p.min) ||
    !Number.isFinite(p.max) ||
    p.max <= p.min ||
    series.some((d) => d.y < min || d.y > max)
  )
    h.fail('line scale must cover the data');
  if (p.labels) {
    h.list(p.labels, 'labels', 2, 40);
    if (p.labels.length !== series.length)
      h.fail('provide one label per point');
    p.labels.forEach((x) => h.text(x, 'label', 24));
  }
  h.format(series.map((d) => d.y));
};

export const validateWaffle: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  p.total ??= 100;
  h.num(p.value, 'value');
  if (
    !Number.isFinite(p.total) ||
    p.total <= 0 ||
    p.value < 0 ||
    p.value > p.total
  )
    h.fail('value must lie between zero and total/max');
  if (!Number.isInteger(p.total) || p.total > 100 || !Number.isInteger(p.value))
    h.fail('waffle counts must be integers up to 100');
  p.cols ??= 10;
  if (!Number.isInteger(p.cols) || p.cols < 1 || p.cols > 10)
    h.fail('cols must be 1–10');
  p.decimals ??= 0;
  h.icon(p.icon, 'icon');
};

export const validateRing: BlockValidator = (p: BlockProps, h: PropHelpers) => {
  p.max ??= 100;
  h.num(p.value, 'value');
  if (!Number.isFinite(p.max) || p.max <= 0 || p.value < 0 || p.value > p.max)
    h.fail('value must lie between zero and total/max');
  p.decimals ??= 0;
};

export const validateDonut: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  h.list(p.segments, 'segments', 2, 6);
  p.segments.forEach((seg, i) => {
    h.keys(seg, ['label', 'value'], `segments[${i}]`);
    h.text(seg.label, 'label', 40);
    h.num(seg.value, 'value');
    if (seg.value < 0) h.fail('segment values must be nonnegative');
    h.required(seg.label, 'segments.label');
  });
  if (!(p.segments.reduce((a, seg) => a + seg.value, 0) > 0))
    h.fail('segments need a positive total');
  h.format(p.segments.map((seg) => seg.value));
};
