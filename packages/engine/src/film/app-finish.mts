import type { CanvasElement } from './types.mjs';
import type { AppScene } from './app-contracts.mjs';
import { round } from './app-common.mjs';
export function appFinish(scene: AppScene, heightValue: number): CanvasElement {
  const { phone, height, w, rest, id, x, y, els } = scene;
  let h = heightValue;
  // A phone stands upright however little its screens hold; a window is as tall as they are.
  if (phone && height == null) h = Math.max(h, Math.round(w * 1.45));
  // The device: a window with a soft shadow, or a phone's body round its screen.
  const frame: CanvasElement[] = phone
    ? [
        {
          type: 'rect',
          x: -18,
          y: -18,
          w: w + 36,
          h: h + 36,
          r: 70,
          fill: 'ink',
          shadow: true,
        },
        { type: 'rect', x: 0, y: 0, w, h, r: 54, fill: 'paper' },
        {
          type: 'rect',
          x: round(w / 2 - 70),
          y: 22,
          w: 140,
          h: 30,
          r: 15,
          fill: 'ink',
        },
      ]
    : [{ type: 'rect', x: 0, y: 0, w, h, r: 30, fill: 'paper', shadow: true }];
  // Parts wait for the screen unless they have a word of their own.
  const still = (list: CanvasElement[]): CanvasElement[] =>
    list.map((el) => ({
      ...el,
      ...(el.say == null && el.at == null ? { enter: 'none' } : {}),
      ...(el.children ? { children: still(el.children) } : {}),
    }));
  return {
    type: 'group',
    ...rest,
    id,
    x,
    y,
    children: still([...frame, ...els]),
  };
}
