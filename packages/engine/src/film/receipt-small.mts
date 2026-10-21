import { finite } from './guards.mjs';
import type { CanvasElement } from './types.mjs';
import type { ReceiptScene } from './receipt-contracts.mjs';
import { round } from './receipt-common.mjs';
export function receiptSmall(scene: ReceiptScene): void {
  const { at, fail, s, marks, rest, w, pad, els, mono } = scene;
  // Drawn smaller than type can be read (a photo in an upload slot, a thumbnail on a phone): its
  // lines print as bars of their length, the way a thumbnail shows them.
  const scale = finite(rest.scale) ? rest.scale : 1;
  if (scale * s < 18) {
    if (marks != null)
      fail(
        `${at}.marks: at scale ${scale} its type is ${Math.round(scale * s)} px, too small to mark; mark a receipt drawn at reading size`,
      );
    // Each line was set by `text` above, with its size and position.
    const bar = (t: CanvasElement): CanvasElement => {
      const size = t.size ?? s,
        tx = t.x ?? 0;
      const bw = Math.min(mono(t.text, size), w - pad * 2),
        bh = Math.max(4, size * 0.42);
      let left = tx;
      if (t.anchor === 'middle') left = tx - bw / 2;
      if (t.anchor === 'end') left = tx - bw;
      return {
        type: 'rect',
        x: round(left),
        y: round((t.y ?? 0) - size * 0.5),
        w: round(bw),
        h: round(bh),
        r: round(bh / 2),
        fill: t.fill === 'muted' ? 'muted' : 'ink',
        opacity: t.fill === 'muted' ? 0.35 : 0.55,
        ...(t.id ? { id: t.id } : {}),
      };
    };
    const bars = (list: CanvasElement[]): CanvasElement[] =>
      list.map((el) => {
        if (el.type === 'text') return bar(el);
        if (el.children) return { ...el, children: bars(el.children) };
        return el;
      });
    els.splice(0, els.length, ...bars(els));
  }
}
