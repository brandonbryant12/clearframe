import { show, fmt } from './process-common.mjs';
import type { ProcessScene } from './process-contracts.mjs';
export function drawTallProcess({
  p,
  L,
  W,
  n,
  font,
  top,
  bottom,
  out,
  capacity,
  pile,
  stepped,
  trend,
  states,
  runs,
  timed,
  shift,
}: ProcessScene): void {
  const left = L.margin,
    right = W - L.margin,
    slots = n + 1,
    slot = (bottom - top) / slots;
  const cardW = (right - left) * 0.5,
    cardH = Math.min(slot * 0.62, 140);
  const qx = left + cardW + 36;
  for (const [i, s] of p.stages.entries()) {
    const cy = top + slot * (i + 0.5),
      y = cy - cardH / 2;
    out.push(
      {
        id: `pr-${p.id}-${s.id}-card`,
        type: 'rect',
        x: left,
        y,
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
        x: left + 24,
        y: y + cardH * 0.44,
        size: font,
        font: 'strong',
        fill: 'ink',
        fit: cardW - 48,
        ...show,
      },
    );
    capacity(
      i,
      {
        x: left + 24,
        y: y + cardH * 0.8,
        size: font * 0.85,
        font: 'figures',
        fit: cardW - 48,
      },
      { fill: 'muted' },
    );
    for (const [ri, r] of p.runs.entries())
      if (r.set?.[s.id] != null)
        out.push({
          id: timed(`pr-${p.id}-${s.id}-changed-${ri}`),
          type: 'rect',
          x: left - 6,
          y: y - 6,
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
    // Its queue beside it: the count on top, one square per item underneath.
    stepped(
      `pr-${p.id}-${s.id}-queue`,
      trend(i),
      {
        x: qx,
        y: y + font * 0.9,
        size: font * 0.7,
        font: 'figures',
        fit: right - qx,
      },
      { fill: 'ink' },
    );
    pile(qx, y + font * 1.5, i, 'right');
    if (i + 1 < n)
      out.push({
        id: `pr-${p.id}-${s.id}-to`,
        type: 'line',
        x1: left + cardW / 2,
        y1: y + cardH + 6,
        x2: left + cardW / 2,
        y2: cy + slot - cardH / 2 - 6,
        stroke: 'muted',
        width: 3,
        arrow: 'end',
        ...show,
      });
  }
  const cy = top + slot * (n + 0.5),
    y = cy - cardH / 2;
  out.push(
    {
      id: `pr-${p.id}-done-card`,
      type: 'rect',
      x: left,
      y,
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
      x: left + 24,
      y: y + cardH * 0.44,
      size: font,
      font: 'strong',
      fill: 'ink',
      fit: cardW - 48,
      ...show,
    },
    {
      id: `pr-${p.id}-done-to`,
      type: 'line',
      x1: left + cardW / 2,
      y1: top + slot * (n - 0.5) + cardH / 2 + 6,
      x2: left + cardW / 2,
      y2: y - 6,
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
      x: left + 24,
      y: y + cardH * 0.84,
      size: font * 1.05,
      font: 'figures',
      fit: cardW - 48,
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
      y: L.keyY + shift + 70,
      size: font,
      anchor: 'end',
      font: 'figures',
      fit: 300,
    },
    { fill: 'muted' },
  );
}
