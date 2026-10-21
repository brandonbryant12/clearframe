import { plotLayout, titleText, titleShift } from './plots.mjs';
import { check, shown } from './table-common.mjs';
import type {
  TableSpec,
  TableShow,
  TableInterval,
  TableColumnPosition,
} from './table-contracts.mjs';
import type { CanvasElement, ElementFields, HelperFrame } from './types.mjs';
export function tableElements(
  p: TableSpec,
  frame: HelperFrame,
  when: (s: TableShow) => number | undefined = (s) => s.at,
) {
  const { W, L, width, shift, u, font, pad, top, headerH, rowH, columns } =
    tableGeometry(p, frame);
  const intervals = audienceIntervals(p, frame, when);
  const title = titleText(p.title, L, width);
  title.id = `tbl-${p.id}-title`;
  const elements: CanvasElement[] = [title];
  // Only the grid carries across cuts. Timed text/redactions belong to this beat;
  // generic id morphing otherwise pulls a later reveal back to time zero.
  const timingId = frame.beatId ?? 'standalone';
  const window = (i: number): ElementFields => ({
    at: intervals[i].at,
    enter: 'none',
    ...(i + 1 < intervals.length
      ? { exit: 'none', exitAt: intervals[i + 1].at }
      : {}),
  });
  for (const [i, s] of intervals.entries())
    elements.push({
      id: `tbl-${p.id}-audience-${timingId}-${i}`,
      type: 'text',
      text: s.view.label,
      x: L.margin,
      y: L.keyY + shift,
      size: Math.max(L.keyType, font),
      fill: 'accent',
      font: 'semibold',
      fit: width,
      ...window(i),
    });
  elements.push({
    id: `tbl-${p.id}-header`,
    type: 'rect',
    x: L.margin,
    y: top,
    w: width,
    h: headerH,
    fill: 'surface',
    ...shown,
  });
  const text = (
    id: string,
    value: string,
    c: TableColumnPosition,
    y: number,
    h: number,
    extra: ElementFields = {},
  ): CanvasElement => {
    const room = c.w - 2 * pad;
    // A conservative authoring guard, not font measurement. Native shaping/audit verifies fit.
    const estimate = value.length * font * 0.56;
    const lines = Math.max(1, Math.ceil(estimate / room));
    check(
      room >= font * 2.2 &&
        lines <= (c.align === 'right' ? 1 : 2) &&
        lines * font * 1.2 <= h - pad,
      `${id} is too long for its cell; shorten it, increase the column weight or split the table`,
    );
    return {
      id,
      type: 'text',
      text: value,
      x: c.align === 'right' ? c.x + c.w - pad : c.x + pad,
      y: y + h / 2 + font * 0.34,
      size: font,
      fill: 'ink',
      font: c.align === 'right' ? 'figures' : 'text',
      ...(lines > 1 && c.align === 'left'
        ? { y: y + pad / 2, width: room, height: h - pad }
        : { anchor: c.align === 'right' ? 'end' : 'start', fit: room }),
      ...extra,
    };
  };
  for (const c of columns)
    elements.push(
      text(
        `tbl-${p.id}-head-${c.id}`,
        c.label,
        { ...c, align: 'left' },
        top,
        headerH,
        { ...shown, font: 'semibold' },
      ),
    );
  p.rows.forEach((r, ri) => {
    const y = top + headerH + ri * rowH;
    for (const c of columns) {
      const id = `tbl-${p.id}-${r.id}-${c.id}`;
      // Stable target rectangles are real cell geometry for on/reveal, including hidden cells.
      elements.push({
        id,
        type: 'rect',
        x: c.x,
        y,
        w: c.w,
        h: rowH,
        fill: ri % 2 ? 'surface' : 'none',
        ...shown,
      });
      for (const [i, s] of intervals.entries()) {
        if (s.view.hide.includes(c.id)) {
          elements.push({
            id: `${id}-redaction-${timingId}-${i}`,
            type: 'rect',
            x: c.x + pad,
            y: y + rowH * 0.4,
            w: Math.min(c.w - 2 * pad, 100 * u),
            h: 10 * u,
            r: 5 * u,
            fill: 'muted',
            ...window(i),
          });
        } else
          elements.push(
            text(
              `${id}-text-${timingId}-${i}`,
              r.cells[c.id],
              c,
              y,
              rowH,
              window(i),
            ),
          );
      }
    }
    elements.push({
      id: `tbl-${p.id}-rule-${r.id}`,
      type: 'line',
      x1: L.margin,
      y1: y + rowH,
      x2: W - L.margin,
      y2: y + rowH,
      stroke: 'line',
      width: 1.2 * u,
      ...shown,
    });
  });
  return { elements, intervals };
}

function tableGeometry(p: TableSpec, frame: HelperFrame) {
  const { width: W, height: H } = frame,
    L = { ...plotLayout(frame) },
    tall = H > W;
  if (tall) L.margin = Math.max(L.margin, W * 0.115 + 4);
  check(
    !tall || p.columns.length <= 3,
    'portrait tables take at most 3 columns; choose a smaller table or a landscape shot',
  );
  const width = W - 2 * L.margin,
    shift = titleShift(p.title, L, width),
    u = Math.min(W, H) / 1080;
  const font = (p.columns.length > 4 ? 28 : 40) * u,
    pad = 16 * u;
  let top = L.keyY + shift + (tall ? 85 : 65) * u;
  const bottom = L.bottom;
  const headerH = font * 2.3,
    rowH = Math.min((bottom - top - headerH) / p.rows.length, font * 3.5);
  if (tall)
    top += Math.max(0, (bottom - top - headerH - rowH * p.rows.length) / 2);
  check(
    rowH >= font * 1.65,
    'too many rows below this title; shorten the title or split the table',
  );
  const totalWeight = p.columns.reduce((a, c) => a + c.weight, 0);
  let x = L.margin;
  const columns = p.columns.map((c) => {
    const w = (width * c.weight) / totalWeight;
    const out = { ...c, x, w };
    x += w;
    return out;
  });
  return { W, L, width, shift, u, font, pad, top, headerH, rowH, columns };
}

function audienceIntervals(
  p: TableSpec,
  frame: HelperFrame,
  when: (s: TableShow) => number | undefined,
): TableInterval[] {
  const intervals: TableInterval[] = [{ at: 0, view: p.views[0] }];
  for (const s of p.show) {
    const at = when(s);
    check(
      typeof at === 'number' &&
        Number.isFinite(at) &&
        at >= 0 &&
        (frame.duration == null || at < frame.duration),
      `view ${s.view} must start inside the beat`,
    );
    check(
      at > intervals[intervals.length - 1].at ||
        (at === 0 && intervals.length === 1),
      'audience changes must be in increasing time order',
    );
    const view = p.views.find((v) => v.id === s.view);
    check(view, `unknown view ${s.view}`);
    const value = { at, view };
    if (at === 0) intervals[0] = value;
    else intervals.push(value);
  }
  return intervals;
}
