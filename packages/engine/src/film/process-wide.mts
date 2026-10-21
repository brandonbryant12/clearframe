import { show, fmt } from './process-common.mjs';
import type { ProcessScene } from './process-contracts.mjs';
export function drawWideProcess({
  p,
  L,
  W,
  n,
  font,
  top,
  bottom,
  rowsOfTokens,
  tokenSize,
  gap,
  out,
  capacity,
  pile,
  stepped,
  trend,
  states,
  runs,
  timed,
}: ProcessScene): void {
  const left = L.margin,
    right = W - L.margin,
    slots = n + 1,
    slot = (right - left) / slots;
  // The cards and the tallest pile sit together in the middle of the space under the heading.
  const cardW = Math.min(slot * 0.72, 300),
    cardH = 150,
    pileH = rowsOfTokens * (tokenSize + gap) + 70;
  const cardY = Math.round(top + (bottom - top - (pileH + cardH)) / 2 + pileH);
  for (const [i, s] of p.stages.entries()) {
    const cx = left + slot * (i + 0.5),
      x = cx - cardW / 2;
    out.push(
      {
        id: `pr-${p.id}-${s.id}-card`,
        type: 'rect',
        x,
        y: cardY,
        w: cardW,
        h: cardH,
        r: 14,
        fill: 'surface',
        stroke: 'line',
        width: 2,
        ...show,
      },
      {
        id: `pr-${p.id}-${s.id}-label`,
        type: 'text',
        text: s.label,
        x: cx,
        y: cardY + 58,
        size: font,
        anchor: 'middle',
        font: 'strong',
        fill: 'ink',
        fit: cardW - 24,
        ...show,
      },
    );
    capacity(
      i,
      {
        x: cx,
        y: cardY + 110,
        size: font * 0.85,
        anchor: 'middle',
        font: 'figures',
        fit: cardW - 24,
      },
      { fill: 'muted' },
    );
    // The capacity that changed is marked, once, as it changes.
    for (const [ri, r] of p.runs.entries())
      if (r.set?.[s.id] != null)
        out.push({
          id: timed(`pr-${p.id}-${s.id}-changed-${ri}`),
          type: 'rect',
          x: x - 6,
          y: cardY - 6,
          w: cardW + 12,
          h: cardH + 12,
          r: 18,
          fill: 'none',
          stroke: 'accent',
          width: 4,
          at: runs[ri].start,
          enter: 'draw',
          dur: 0.5,
        });
    // The queue waiting for this stage, a pile above the hand-off into it.
    const baseY = cardY - 70;
    pile(cx, baseY, i, 'up');
    stepped(
      `pr-${p.id}-${s.id}-queue`,
      trend(i),
      {
        x: cx,
        y: baseY + 44,
        size: font * 0.7,
        anchor: 'middle',
        font: 'figures',
        fit: slot * 0.96,
      },
      { fill: 'ink' },
    );
    if (i + 1 < n)
      out.push({
        id: `pr-${p.id}-${s.id}-to`,
        type: 'line',
        x1: x + cardW + 8,
        y1: cardY + cardH / 2,
        x2: cx + slot - cardW / 2 - 8,
        y2: cardY + cardH / 2,
        stroke: 'muted',
        width: 3,
        arrow: 'end',
        ...show,
      });
  }
  const dx = left + slot * (n + 0.5);
  out.push(
    {
      id: `pr-${p.id}-done-card`,
      type: 'rect',
      x: dx - cardW / 2,
      y: cardY,
      w: cardW,
      h: cardH,
      r: 14,
      fill: 'wash',
      ...show,
    },
    {
      id: `pr-${p.id}-done-label`,
      type: 'text',
      text: p.done,
      x: dx,
      y: cardY + 58,
      size: font,
      anchor: 'middle',
      font: 'strong',
      fill: 'ink',
      fit: cardW - 24,
      ...show,
    },
    {
      id: `pr-${p.id}-done-to`,
      type: 'line',
      x1: left + slot * (n - 0.5) + cardW / 2 + 8,
      y1: cardY + cardH / 2,
      x2: dx - cardW / 2 - 8,
      y2: cardY + cardH / 2,
      stroke: 'muted',
      width: 3,
      arrow: 'end',
      ...show,
    },
  );
  stepped(
    `pr-${p.id}-done-count`,
    states.map((st) => fmt(st.done)),
    {
      x: dx,
      y: cardY + 112,
      size: font * 1.05,
      anchor: 'middle',
      font: 'figures',
      fit: cardW - 24,
    },
    { fill: 'ink' },
  );
  stepped(
    `pr-${p.id}-clock`,
    states.map(
      (st) => `${p.period[0].toUpperCase()}${p.period.slice(1)} ${st.period}`,
    ),
    {
      x: right,
      y: L.titleY,
      size: font * 1.1,
      anchor: 'end',
      font: 'figures',
      fit: 300,
    },
    { fill: 'muted' },
  );
}
