import type { CanvasElement } from './types.mjs';
import type { MultiplePanel } from './multiple-scene-contracts.mjs';
import { show } from './multiple-scene-common.mjs';

export function multipleFocus(panel: MultiplePanel): void {
  const { ctx } = panel;
  const { expandedId, L, elements } = ctx;
  const { s, box, children, prefix } = panel;
  const group: CanvasElement = {
    id: `${prefix}-panel`,
    type: 'group',
    x: box[0],
    y: box[1],
    children,
    ...show,
  };
  if (expandedId) {
    if (s.id === expandedId) {
      group.origin = [box[0], box[1]];
      group.keys = [
        { at: 0, dur: 0, x: 0, y: 0, scale: 1 },
        {
          at: 0.6,
          dur: 1.4,
          ease: 'inOut',
          x: L.expanded[0] - box[0],
          y: L.expanded[1] - box[1],
          scale: L.scale,
        },
      ];
    } else group.keys = [{ at: 0, dur: 0.35, opacity: 0, ease: 'linear' }];
  }
  elements.push(group);
}
