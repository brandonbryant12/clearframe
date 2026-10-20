import type { CritiqueContext } from './critique-contracts.mjs';
import { isRecord } from './errors.mjs';
interface ShownFigure {
  label: string;
  value: number;
  unit: unknown;
  id: string;
}
const records = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];
/** The same label should not claim different values in different scenes. */
export function checkDataset({ beats, add }: CritiqueContext): void {
  const shown = new Map<string, ShownFigure[]>();
  const record = (
    label: unknown,
    value: unknown,
    unit: unknown,
    id: string,
  ): void => {
    if (
      typeof label !== 'string' ||
      typeof value !== 'number' ||
      !Number.isFinite(value)
    )
      return;
    const key = label.trim().toLowerCase(),
      seen = shown.get(key) ?? [];
    seen.push({ label, value, unit: unit ?? '', id });
    shown.set(key, seen);
  };
  for (const b of beats) {
    const p = b.props ?? {},
      chart = p.chart;
    if (chart)
      for (const v of records(chart.values))
        record(v.label, v.value, chart.suffix ?? chart.prefix, b.id);
    for (const v of records(p.data))
      record(v.label, v.value, p.format ?? p.suffix, b.id);
    for (const v of records(p.items))
      record(v.label, v.value, p.format ?? v.suffix, b.id);
    if (Number.isFinite(p.value)) record(p.label, p.value, p.suffix, b.id);
  }
  for (const seen of shown.values()) {
    const distinct = [
      ...new Map(seen.map((x) => [`${x.value}${x.unit}`, x])).values(),
    ];
    if (distinct.length > 1)
      add(
        'warn',
        distinct.map((x) => x.id).join('…'),
        `"${seen[0].label}" shows ${distinct.map((x) => `${x.value}${x.unit} in ${x.id}`).join(' and ')}. One label, one value: the viewer reads a contradiction. Rename the label if these are different measures.`,
      );
  }
}
