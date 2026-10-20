import {
  show,
  ids,
  MORPH,
  partAt,
  rowPart,
  barAt,
} from './breakdown-common.mjs';
import { view } from './breakdown-view.mjs';
import { draw } from './breakdown-draw.mjs';
import { frameOf, spoken } from './breakdown-arrival.mjs';
import type { BreakdownScene } from './breakdown-contracts.mjs';
export function focusBreakdown(
  { p, G, arrive, title, unit }: BreakdownScene,
  focus: string,
) {
  // Opened: the part's parts come out of its bar (morphFrom partitions it) when the beat before
  // drew it; otherwise they grow on their words like any bars.
  const rows = view(p, G, focus);
  let run = 0;
  const els = draw(p, G, rows, {
    header: show,
    partTime: (r, i) =>
      arrive(rowPart(r), 0.3 + (i - 1) * 0.3, frameOf(r).grow),
    labelTime: (r, i) => {
      if (i === 0) return arrive({}, MORPH, { enter: 'fade', dur: 0.4 });
      const item = rowPart(r);
      const cue = spoken(item) ? { ...item, after: item.after ?? 0 } : {};
      return arrive(cue, MORPH + (i - 1) * 0.15, { enter: 'fade', dur: 0.4 });
    },
  });
  const parent = partAt(p, focus);
  const kids = rows.slice(1);
  for (const [k, r] of kids.entries()) {
    const bar = barAt(els, ids(p, ...r.key, 'bar'));
    // The parts reconcile exactly with the part (breakdownSpec), so the last slice ends at its end.
    bar.morphFrom = {
      id: ids(p, focus, 'bar'),
      slice: [
        run / parent.value,
        k === kids.length - 1 ? 1 : (run + r.amount) / parent.value,
      ],
    };
    run += r.amount;
  }
  return [title, unit, ...els];
}
