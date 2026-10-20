import { titleText } from './plots.mjs';
import { ids, show, rowPart } from './breakdown-common.mjs';
import { layout } from './breakdown-layout.mjs';
import { view } from './breakdown-view.mjs';
import { draw } from './breakdown-draw.mjs';
import { arrival, frameOf } from './breakdown-arrival.mjs';
import { focusBreakdown } from './breakdown-focus.mjs';
import { gatherBreakdown } from './breakdown-gather.mjs';
import { openBreakdown } from './breakdown-open.mjs';
import type {
  BreakdownSpec,
  BreakdownWhen,
  BreakdownScene,
} from './breakdown-contracts.mjs';
import type { HelperFrame, CanvasElement } from './types.mjs';
/** Canvas elements for one beat of a breakdown. `when(item, fallback)` resolves say/cue/at. */
export function breakdownElements(
  p: BreakdownSpec,
  frame: HelperFrame,
  when: BreakdownWhen = (item, fallback) => item.at ?? fallback,
): CanvasElement[] {
  const G = layout(p, frame);
  const still = p.motion === 'none';
  const title = titleText(p.title, G.L, G.W - 2 * G.L.margin);
  title.id = ids(p, 'title');
  const unit: CanvasElement = {
    id: ids(p, 'unit'),
    type: 'text',
    text: p.unit,
    x: G.L.margin,
    y: G.L.keyY + G.shift,
    size: Math.max(G.L.keyType, G.font * 0.8),
    fill: 'muted',
    font: 'semibold',
    fit: G.W - 2 * G.L.margin,
    ...show,
  };
  const arrive = arrival(still, when);
  const scene: BreakdownScene = { p, G, frame, when, arrive, title, unit };
  if (p.focus != null) return focusBreakdown(scene, p.focus);
  const rows = view(p, G, null);
  const els = draw(p, G, rows, {
    header: show,
    partTime: (r, i) =>
      arrive(rowPart(r), 0.35 + (i - 1) * 0.35, frameOf(r).grow),
    labelTime: (r, i) =>
      arrive(rowPart(r), 0.35 + (i - 1) * 0.35, { enter: 'fade', dur: 0.4 }),
  });
  if (p.gather != null) gatherBreakdown(scene, els, p.gather);
  if (p.open != null) openBreakdown(scene, els, p.open);
  return [title, unit, ...els];
}
