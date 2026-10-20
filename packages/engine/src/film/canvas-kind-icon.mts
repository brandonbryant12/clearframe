import { iconAlias, iconHint } from './icons.mjs';

import type { CanvasElement, Fail } from './types.mjs';

export function checkIcon(el: CanvasElement, at: string, fail: Fail): void {
  const icon = iconAlias(el.name);

  if (!icon) fail(`${at}: ${iconHint(el.name)}`);

  el.name = icon;
}
