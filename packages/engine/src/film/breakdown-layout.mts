import { plotLayout, titleShift } from './plots.mjs';
import { check, textWidth } from './breakdown-common.mjs';
import type { HelperFrame } from './types.mjs';
import type { BreakdownSpec, BreakdownLayout } from './breakdown-contracts.mjs';
/** Row geometry shared by every view of one breakdown in one frame, so text never rescales. */
export function layout(p: BreakdownSpec, frame: HelperFrame): BreakdownLayout {
  const { width: W, height: H } = frame,
    L = { ...plotLayout(frame) };
  const beside = W >= H;
  // A tall frame keeps type title-safe through the beat's slow push (as sketches do: 11.5% in).
  if (!beside) L.margin = Math.max(L.margin, Math.round(W * 0.115) + 4);
  const rows =
    Math.max(p.parts.length, ...p.parts.map((x) => x.parts?.length ?? 0)) + 1;
  const shift = titleShift(p.title, L, W - 2 * L.margin);
  const top = L.top + shift,
    bottom = L.bottom,
    slot = (bottom - top) / rows;
  // The largest type the rows allow, within a readable range for the frame.
  const font = Math.round(
    Math.min(
      beside ? 40 : 38,
      Math.max(beside ? 26 : 28, slot * (beside ? 0.5 : 0.3)),
    ),
  );
  const labels = [
    p.total.label,
    ...p.parts.flatMap((x) => [
      x.label,
      ...(x.parts ?? []).map((c) => c.label),
    ]),
  ];
  const values = [
    p.total.value,
    ...p.parts.flatMap((x) => [
      x.value,
      ...(x.parts ?? []).map((c) => c.value),
    ]),
  ].map(p.format);
  const valueW =
    Math.max(...values.map((v) => textWidth(v, font))) + font * 0.8;
  const labelW = beside
    ? Math.min(
        W * 0.32,
        Math.max(...labels.map((l) => textWidth(l, font))) + font,
      )
    : 0;
  const left = L.margin + labelW + (beside ? font * 0.6 : 0);
  const right = W - L.margin - (beside ? valueW : 0);
  check(
    right - left >= W * (beside ? 0.3 : 0.5),
    'names or values are too wide for this frame; shorten them',
  );
  // In a tall frame a long name wraps onto a second line above its bar instead of shrinking.
  const room = (right - left) * 0.66;
  const lines = (label: string): number => {
    let n = 1,
      line = 0;
    for (const w of label.split(/\s+/)) {
      const ww = textWidth(w, font);
      if (line && line + textWidth(' ', font) + ww > room) {
        n++;
        line = ww;
      } else line += (line ? textWidth(' ', font) : 0) + ww;
    }
    return n;
  };
  const wrap = beside ? 1 : Math.max(...labels.map(lines));
  check(
    wrap <= 2,
    'a name needs more than two lines in this frame; shorten it',
  );
  const thickness = beside
    ? Math.min(slot * 0.56, 70)
    : Math.min(slot - font * (0.6 + 1.1 * wrap), 56);
  check(
    thickness >= (beside ? font * 0.7 : font * 0.6),
    `too many rows for this frame (${rows}); open fewer parts at once`,
  );
  return {
    L,
    W,
    H,
    beside,
    rows,
    top,
    slot,
    font,
    left,
    right,
    labelW,
    thickness,
    shift,
    room,
    lines,
  };
}
