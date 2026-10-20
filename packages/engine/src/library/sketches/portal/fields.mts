import { round } from '../../../film/sketch-kit.mjs';

import type { portalFrame } from './frame.mjs';

export function portalFields(context: ReturnType<typeof portalFrame>) {
  const { T, main, centre } = context;

  // Section page: a header and two cards. Form: a field, its value box and a save button.
  const head = { x: main.x, y: main.y + 34 };

  const cardW = T ? main.w : round((main.w - 32) / 2);

  const card = (i: number) =>
    T
      ? { x: main.x, y: main.y + 90 + i * 220, w: cardW, h: 190 }
      : { x: main.x + i * (cardW + 32), y: main.y + 92, w: cardW, h: 200 };

  const fieldY = main.y + 120;

  const box = { x: main.x, y: fieldY + 28, w: T ? main.w : 420, h: 110 };

  const save = { x: main.x, y: box.y + box.h + 48, w: 220, h: 76 };

  // The confirmation lands under the button, so the lean-in on the new value keeps it in frame.
  const toast = {
    x: main.x,
    y: save.y + save.h + 36,
    w: Math.min(main.w, T ? main.w : 640),
    h: 92,
  };

  const [vx, vy] = centre(box);
  return {
    ...context,
    T,
    main,
    centre,
    head,
    card,
    fieldY,
    box,
    save,
    toast,
    vx,
    vy,
  };
}
