import type { CanvasElement } from './types.mjs';
import type { GrowExtent } from './canvas-extent-contracts.mjs';
export function textExtent(
  el: CanvasElement,
  dx: number,
  dy: number,
  grow: GrowExtent,
): void {
  const n = (k: 'x' | 'y') => el[k] ?? 0;
  // Estimated advance: mono is wide, display faces about half an em per character.
  const size = el.size ?? 48,
    count = typeof el.count === 'object' ? el.count : null,
    chars = String(
      count
        ? `${count.prefix ?? ''}${count.to}${count.suffix ?? ''}`
        : (el.text ?? ''),
    ).length;
  // Native single-line fitting caps the advance. Do not report the unfitted title
  // outside its camera while the renderer correctly shrinks it into this width.
  const advance = chars * size * (el.font === 'mono' ? 0.62 : 0.54);
  const w =
    el.width ??
    Math.min(typeof el.fit === 'number' ? el.fit : Infinity, advance);
  const x0 = anchorX(el.anchor, n('x'), w);
  // Text with a width wraps: its lines stack down from the first baseline.
  const lines = el.width
    ? Math.max(1, Math.ceil(advance / Math.max(1, el.width)))
    : 1;
  grow(
    dx + x0,
    dy + n('y') - size * 0.8,
    dx + x0 + w,
    dy + n('y') + size * 0.25 + (lines - 1) * size * (el.leading ?? 1.15),
  );
}
function anchorX(anchor: string | undefined, x: number, w: number): number {
  if (anchor === 'middle') return x - w / 2;
  if (anchor === 'end') return x - w;
  return x;
}
