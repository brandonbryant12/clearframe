import { ids, MORPH, partAt, barAt } from './breakdown-common.mjs';
import { view } from './breakdown-view.mjs';

import type {
  BreakdownScene,
  BreakdownElement,
  BreakdownOpen,
  BreakdownRow,
} from './breakdown-contracts.mjs';
export function openBreakdown(
  { p, G, when }: BreakdownScene,
  els: BreakdownElement[],
  open: BreakdownOpen,
): void {
  // Opened in this beat on its word: the whole steps away, the part's bar breaks into its parts,
  // which travel to their rows on the part's own scale; the part's name and value become its header.
  const t = when(open, 1);
  const part = partAt(p, open.part);
  const opened = view(p, G, part.id);
  const header = opened[0];
  moveWholeAway(p, els, part.id, header, t);
  const src = barAt(els, ids(p, part.id, 'bar'));
  els.push({
    id: ids(p, part.id, 'frame'),
    type: 'rect',
    ...header.bar,
    r: 4,
    fill: 'none',
    stroke: 'muted',
    width: 2,
    at: t + MORPH,
    enter: 'fade',
    dur: 0.4,
  });
  let run = 0;
  for (const [i, r] of opened.slice(1).entries()) {
    // Each part starts as its slice of the part's bar and travels to its own row.
    const slice = {
      x: src.x + src.w * (run / part.value),
      w: src.w * (r.amount / part.value),
    };
    run += r.amount;
    const fill =
      r.kind === 'residual'
        ? { fill: 'none', stroke: 'muted', width: 2.5, dash: [10, 8] }
        : { fill: r.fill };
    els.push(
      {
        id: ids(p, ...r.key, 'bar'),
        type: 'rect',
        ...r.bar,
        r: 4,
        ...fill,
        at: t,
        enter: 'none',
        origin: [r.bar.x, r.cy],
        keys: [
          {
            at: t,
            dur: 0,
            x: slice.x - r.bar.x,
            y: src.y + src.h / 2 - r.cy,
            scaleX: slice.w / r.bar.w,
            scaleY: src.h / r.bar.h,
          },
          {
            at: t + 0.02,
            dur: MORPH,
            ease: 'inOut',
            x: 0,
            y: 0,
            scaleX: 1,
            scaleY: 1,
          },
        ],
      },
      {
        id: ids(p, ...r.key, 'label'),
        ...r.label,
        at: t + MORPH + i * 0.12,
        enter: 'fade',
        dur: 0.4,
      },
      {
        id: ids(p, ...r.key, 'value'),
        ...r.value,
        at: t + MORPH + i * 0.12,
        enter: 'fade',
        dur: 0.4,
      },
      ...(r.marker
        ? [
            {
              id: ids(p, ...r.key, 'marker'),
              ...r.marker,
              stroke: r.kind === 'part' ? r.fill : 'muted',
              at: t + MORPH + i * 0.12,
              enter: 'fade',
              dur: 0.4,
            },
          ]
        : []),
    );
  }
}

function moveWholeAway(
  p: BreakdownScene['p'],
  els: BreakdownElement[],
  partId: string,
  header: BreakdownRow,
  t: number,
): void {
  for (const el of els) {
    const mine =
      el.id === ids(p, partId, 'label') || el.id === ids(p, partId, 'value');
    if (el.id === ids(p, partId, 'bar'))
      Object.assign(el, { exit: 'none', exitAt: t });
    else if (mine) {
      const to = el.id.endsWith('-label') ? header.label : header.value;
      el.keys = [
        {
          at: t,
          dur: MORPH,
          ease: 'inOut',
          x: to.x - (el.x ?? 0),
          y: to.y - (el.y ?? 0),
        },
      ];
    } else Object.assign(el, { exit: 'fade', exitAt: t, exitDur: 0.4 });
  }
}
