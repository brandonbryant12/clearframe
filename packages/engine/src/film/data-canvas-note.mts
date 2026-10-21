import type { CanvasElement } from './types.mjs';
import type { ChartNote } from './data-canvas-contracts.mjs';
import { r } from './data-canvas-common.mjs';
/**
 * The annotation that replaces a chart heading: a short accent line under the value it is
 * about, arriving on the word the narration stresses (`say`) with a stroke pointing up at it.
 */
export function noteElements(
  note: ChartNote,
  cx: number,
  y: number,
  { left, right, up = false }: { left: number; right: number; up?: boolean },
): CanvasElement[] {
  const size = 40,
    // Keep the line inside the chart's width: anchored at the near edge when the value sits
    // close to one side.
    est = note.text.length * size * 0.52,
    anchor = noteAnchor(cx, est, left, right);
  let tx = cx;
  if (anchor === 'start') tx = Math.max(left, cx - 24);
  if (anchor === 'end') tx = Math.min(right, cx + 24);
  const cue = note.say ? { say: note.say } : { at: note.at ?? 1.2 };
  return [
    ...(up
      ? [
          {
            type: 'line' as const,
            x1: r(cx),
            y1: r(y - 10),
            x2: r(cx),
            y2: r(y - 44),
            stroke: 'accent',
            width: 3,
            arrow: 'end',
            head: 12,
            note: true,
            enter: 'draw',
            dur: 0.35,
            ...cue,
          },
        ]
      : []),
    {
      type: 'text',
      text: note.text,
      x: r(tx),
      y: r(y + size),
      size,
      font: 'bold',
      anchor,
      note: true,
      fill: 'accent',
      enter: 'rise',
      dur: 0.45,
      ...cue,
    },
  ];
}

function noteAnchor(
  cx: number,
  est: number,
  left: number,
  right: number,
): string {
  if (cx - est / 2 < left) return 'start';
  if (cx + est / 2 > right) return 'end';
  return 'middle';
}
