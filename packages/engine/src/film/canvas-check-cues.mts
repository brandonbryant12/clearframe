import type { CanvasElement, Fail } from './types.mjs';

export function checkCues(el: CanvasElement, at: string, fail: Fail): void {
  for (const key of ['cue', 'exitCue'] as const) {
    const v = el[key];
    if (v != null && (typeof v !== 'string' || !v.trim()))
      fail(`${at}.${key} must name one of the beat's moments (props.moments)`);
  }

  if (el.cue != null && (el.say != null || el.at != null))
    fail(`${at} takes one of say, at or cue`);

  if (el.enter === 'type' && el.type !== 'text')
    fail(`${at}: enter "${el.enter}" is for text elements`);
}
