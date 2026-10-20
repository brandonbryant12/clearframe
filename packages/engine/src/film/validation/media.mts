import type { BlockProps, PropHelpers } from '../types.mjs';

import type { BlockValidator } from './contracts.mjs';
import { media } from './helpers.mjs';

export const validateImage: BlockValidator = (p: BlockProps, h: PropHelpers) =>
  media(p, h, { plate: true });

export const validateVideo: BlockValidator = (p: BlockProps, h: PropHelpers) =>
  media(p, h, { plate: true });

export const validateAnnotate: BlockValidator = (
  p: BlockProps,
  h: PropHelpers,
) => {
  media(p, h, { plate: false });
  h.list(p.pins, 'pins', 1, 6);
  p.pins.forEach((pin, i) => {
    h.keys(pin, ['x', 'y', 'label', 'detail', 'say'], `pins[${i}]`);
    h.unit(pin.x, `pins[${i}].x`);
    h.unit(pin.y, `pins[${i}].y`);
    h.text(pin.label, 'label', 40);
    h.text(pin.detail, 'detail', 80);
    h.required(pin.label, 'pins.label');
  });
  if (p.focus != null) {
    const f = p.focus;
    h.keys(f, ['x', 'y', 'w', 'h', 'say'], 'focus');
    h.unit(f.x, 'focus.x');
    h.unit(f.y, 'focus.y');
    h.unit(f.w, 'focus.w');
    h.unit(f.h, 'focus.h');
    if (!(f.w > 0 && f.h > 0) || f.x + f.w > 1 + 1e-9 || f.y + f.h > 1 + 1e-9)
      h.fail('focus must be a nonempty region inside the image');
  }
};
