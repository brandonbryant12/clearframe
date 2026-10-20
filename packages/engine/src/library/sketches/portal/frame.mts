import { round, tall } from '../../../film/sketch-kit.mjs';
import type { BuildOptions } from './common.mjs';
import { windowLayout } from './common.mjs';

export function portalFrame(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
) {
  // A browser window in a 9:16 frame is cropped and tiny; a tall frame gets the phone unless asked.
  const phone =
    params.device === 'phone' || (params.device !== 'desktop' && h > w * 1.2);

  // Tabs instead of a side menu on tall frames and in a phone, which is a tall frame of its own.
  const T = tall(w, h) || phone;

  // Window, chrome and the two regions: a side menu (landscape) or tabs (tall frames).
  // Each stays above the caption band (the bottom quarter of a wide frame, fifth of a tall one).
  const win = windowLayout(phone, w, h, T);

  const corner = phone ? 64 : 24;

  const bar = 68;

  const nav = T
    ? { x: win.x, y: win.y + bar, w: win.w, h: 92 }
    : { x: win.x, y: win.y + bar, w: 300, h: win.h - bar };

  const main = T
    ? { x: win.x + 50, y: nav.y + nav.h + 40, w: win.w - 100 }
    : { x: nav.x + nav.w + 56, y: win.y + bar + 56, w: win.w - nav.w - 112 };

  const items = ['Home', 'STEP1', 'Pay', 'Documents'].slice(0, T ? 3 : 4);

  const item = (i: number) =>
    T
      ? {
          x: round(nav.x + 24 + (i * (nav.w - 48)) / items.length),
          y: nav.y + 18,
          w: round((nav.w - 48) / items.length - 12),
          h: 56,
        }
      : { x: nav.x + 20, y: nav.y + 36 + i * 72, w: nav.w - 40, h: 56 };

  const centre = (r: {
    x: number;
    y: number;
    w: number;
    h: number;
  }): [number, number] => [round(r.x + r.w / 2), round(r.y + r.h / 2)];

  const label = 30;
  return {
    w,
    h,
    phone,
    T,
    win,
    corner,
    bar,
    nav,
    main,
    items,
    item,
    centre,
    label,
  };
}
