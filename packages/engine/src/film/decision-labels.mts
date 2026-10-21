import type { CanvasElement } from './types.mjs';
export const fill = (tone?: string): string =>
  tone && ['positive', 'negative', 'accent', 'muted'].includes(tone)
    ? tone
    : 'ink';
// Lines a label needs at a size in a width (an estimate, about half an em per character; the
// native frame audit is what proves the result fits).
export function lines(text: string, room: number, size: number): number {
  let n = 1,
    line = 0;
  for (const w of String(text).split(/\s+/)) {
    const ww = w.length * size * 0.56,
      gap = size * 0.28;
    if (line && line + gap + ww > room) {
      n++;
      line = ww;
    } else line += (line ? gap : 0) + ww;
  }
  return n;
}
// A label inside a card: one line when it fits, otherwise two wrapped lines, never shrunk.
export function cardLabel(
  text: string,
  cx: number,
  cy: number,
  w: number,
  size: number,
  font: string,
): CanvasElement {
  const room = w - 36;
  if (lines(text, room, size) <= 1)
    return {
      type: 'text',
      text,
      x: cx,
      y: cy + size * 0.35,
      size,
      anchor: 'middle',
      font,
      fill: 'ink',
      fit: room,
    };
  return {
    type: 'text',
    text,
    x: cx,
    y: cy - size * 0.2,
    size,
    anchor: 'middle',
    font,
    fill: 'ink',
    width: room,
    leading: 1.08,
  };
}
