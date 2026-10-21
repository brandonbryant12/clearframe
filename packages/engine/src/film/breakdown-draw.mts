import { ids, show } from './breakdown-common.mjs';
import type {
  BreakdownSpec,
  BreakdownLayout,
  BreakdownRow,
  BreakdownDrawTimes,
  BreakdownElement,
} from './breakdown-contracts.mjs';
/** The elements of a view; `times(item, i)` gives each part's arrival. */
export function draw(
  p: BreakdownSpec,
  _G: BreakdownLayout,
  rows: BreakdownRow[],
  { header, partTime, labelTime }: BreakdownDrawTimes,
): BreakdownElement[] {
  const out: BreakdownElement[] = [];
  rows.forEach((r, i) => {
    const id = (k: string): string => ids(p, ...r.key, k);
    const t = i === 0 ? header : partTime(r, i);
    if (r.kind === 'total')
      out.push({
        id: id('bar'),
        type: 'rect',
        ...r.bar,
        r: 4,
        fill: 'muted',
        opacity: 0.55,
        ...show,
      });
    else if (r.kind === 'header')
      // The opened part: an outline its parts fill, on its own scale.
      out.push({
        id: id('frame'),
        type: 'rect',
        ...r.bar,
        r: 4,
        fill: 'none',
        stroke: 'muted',
        width: 2,
        ...labelTime(r, i),
      });
    else if (r.kind === 'residual')
      out.push({
        id: id('bar'),
        type: 'rect',
        ...r.bar,
        r: 4,
        fill: 'none',
        stroke: 'muted',
        width: 2.5,
        dash: [10, 8],
        ...t,
      });
    else
      out.push({
        id: id('bar'),
        type: 'rect',
        ...r.bar,
        r: 4,
        fill: r.fill,
        ...t,
      });
    if (r.marker)
      out.push({
        id: id('marker'),
        ...r.marker,
        stroke: r.kind === 'part' ? r.fill : 'muted',
        ...(i === 0 ? header : labelTime(r, i)),
      });
    out.push({
      id: id('label'),
      ...r.label,
      ...(i === 0 ? header : labelTime(r, i)),
    });
    out.push({
      id: id('value'),
      ...r.value,
      ...(i === 0 ? header : labelTime(r, i)),
    });
  });
  return out;
}
