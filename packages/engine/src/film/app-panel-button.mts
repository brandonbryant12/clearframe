import type { ElementFields } from './types.mjs';

import type { AppPanelState, AppButton, When } from './app-contracts.mjs';
import { round, when } from './app-common.mjs';
export function appPanelButton(state: AppPanelState): void {
  const { scene, spec, where, page, panel, py } = state;
  const { s, pad, inner, phone, w, id, pill, uid, fail } = scene;
  const { button } = spec;
  // The button, and what it becomes once pressed.
  state.bottom = py + pad;
  if (button != null) {
    checkButton(button, where, fail);
    const bh = round(s * 2.8);
    const bw = phone
      ? inner
      : Math.max(
          s * 9,
          button.label.length * s * 0.62 + s * 3,
          (button.done ?? '').length * s * 0.62 + s * 3,
        );
    const b = { x: w - pad - bw, y: py + s * 0.4, w: bw, h: bh };
    const pressed = when(button, 0.3);
    panel.push({
      ...pill(uid(`${id}-button`, page), b.x, b.y, b.w, b.h, button.label, {
        fill: 'accent',
        ink: 'bg',
      }),
      ...buttonExit(button, pressed),
    });
    if (button.done != null) {
      if (typeof button.done !== 'string' || button.done.length > 18)
        fail(
          `${where}.button.done must be what the button becomes, up to 18 characters`,
        );
      if (!pressed)
        fail(
          `${where}.button: a button with done needs say (the word it is pressed on) or at`,
        );
      panel.push({
        ...pill(uid(`${id}-done`, page), b.x, b.y, b.w, b.h, button.done, {
          fill: 'positive',
          ink: 'bg',
        }),
        ...pressed,
        enter: 'pop',
        dur: 0.3,
      });
    }
    state.bottom = b.y + bh + pad;
  }
}

function checkButton(
  button: AppButton,
  where: string,
  fail: (message: string) => never,
): void {
  if (
    typeof button !== 'object' ||
    typeof button.label !== 'string' ||
    !button.label.trim() ||
    button.label.length > 18
  )
    fail(
      `${where}.button must be {label, done, say|at}: the button's words and, pressed on its word, what it becomes ("Claim sent")`,
    );
  for (const key of Object.keys(button))
    if (!['label', 'done', 'say', 'at', 'after'].includes(key))
      fail(`${where}.button: unsupported field ${key}`);
}
function buttonExit(button: AppButton, pressed: When | null): ElementFields {
  if (button.done == null || !pressed) return {};
  const exitCue =
    pressed.say != null
      ? { exitSay: pressed.say, exitAfter: pressed.after }
      : { exitAt: pressed.at };
  return { ...exitCue, exit: 'fade' };
}
