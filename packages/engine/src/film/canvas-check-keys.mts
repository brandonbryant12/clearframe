import { finite } from './guards.mjs';
import type { CanvasElement, Fail, ElementKey } from './types.mjs';

import { EASES } from './canvas-catalog.mjs';
import { checkSound } from './canvas-sound.mjs';

export function checkKeys(el: CanvasElement, at: string, fail: Fail): void {
  if (el.keys != null) {
    if (!Array.isArray(el.keys) || el.keys.length > 24)
      fail(`${at}.keys must be up to 24 keyframes`);
    el.keys.forEach((k, j) => {
      if (!k || typeof k !== 'object')
        fail(`${at}.keys[${j}] must be an object`);
      for (const key of Object.keys(k))
        if (
          ![
            'at',
            'say',
            'after',
            'dur',
            'ease',
            'x',
            'y',
            'scale',
            'scaleX',
            'scaleY',
            'rotate',
            'opacity',
            'blur',
            'hold',
            'tiltX',
            'tiltY',
            'sound',
            'cue',
          ].includes(key)
        )
          fail(`${at}.keys[${j}]: unsupported field ${key}`);
      if (k.sound != null) checkSound(k.sound, `${at}.keys[${j}].sound`, fail);
      checkKeyTiming(k, at, j, fail);
      checkKeyStyle(k, at, j, fail);
    });
  }
}

function checkKeyTiming(
  k: ElementKey,
  at: string,
  j: number,
  fail: Fail,
): void {
  if (k.at == null && k.say == null && k.cue == null)
    fail(
      `${at}.keys[${j}] needs at (seconds) or say (spoken cue), or cue (a moment)`,
    );
  if (
    k.after != null &&
    (!finite(k.after) ||
      (k.say != null && k.after < 0) ||
      (k.say == null && k.cue == null))
  )
    fail(
      `${at}.keys[${j}].after is seconds after its say cue (0 or more) or its moment`,
    );
  if (k.blur != null && (!finite(k.blur) || k.blur < 0 || k.blur > 60))
    fail(`${at}.keys[${j}].blur must be 0–60 px`);
}
function checkKeyStyle(k: ElementKey, at: string, j: number, fail: Fail): void {
  for (const key of [
    'at',
    'dur',
    'x',
    'y',
    'scale',
    'scaleX',
    'scaleY',
    'rotate',
    'opacity',
    'tiltX',
    'tiltY',
  ] as const) {
    const v = k[key];
    if (v != null && !finite(v))
      fail(`${at}.keys[${j}].${key} must be a number`);
  }
  if (k.ease != null && !EASES.includes(k.ease))
    fail(`${at}.keys[${j}].ease must be one of ${EASES.join(', ')}`);
  if (k.opacity != null && (k.opacity < 0 || k.opacity > 1))
    fail(`${at}.keys[${j}].opacity must be 0–1`);
  if (k.hold != null && typeof k.hold !== 'boolean')
    fail(
      `${at}.keys[${j}].hold must be false for ambient motion that runs past the cut`,
    );
}
