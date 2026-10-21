import { retired } from './constants.mjs';

import type { CanvasElement, Fail } from './types.mjs';

import { ENTERS, EXITS } from './canvas-catalog.mjs';

export function checkEntrance(el: CanvasElement, at: string, fail: Fail): void {
  if (el.enter != null && !ENTERS.includes(el.enter))
    fail(
      retired('enter', el.enter)
        ? `${at}: ${retired('enter', el.enter)}`
        : `${at}.enter must be one of ${ENTERS.join(', ')}`,
    );

  if (
    el.drawEase != null &&
    (el.enter !== 'draw' || !['out', 'linear'].includes(el.drawEase))
  )
    fail(`${at}.drawEase needs enter draw and must be out or linear`);

  if (el.exit != null && !EXITS.includes(el.exit))
    fail(
      retired('exit', el.exit)
        ? `${at}: ${retired('exit', el.exit)}`
        : `${at}.exit must be one of ${EXITS.join(', ')}`,
    );

  if (
    (el.exitAt != null || el.exitSay != null || el.exitCue != null) &&
    el.exit == null
  )
    el.exit = 'fade';
}
