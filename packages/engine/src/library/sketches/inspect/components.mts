import { cueWriter } from '.././drawing/cues.mjs';
import type { ElementKey } from '../../../film/contracts/canvas-effects.mjs';

import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { NAMES, AT, REPORT_AFTER, CHOICE_GAP, RESUME_AT } from './common.mjs';
import type { inspectLayout } from './layout.mjs';

export function inspectComponents(context: ReturnType<typeof inspectLayout>) {
  const { marks, choices, standing } = context;

  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement =>
    ({
      type: 'text',
      text: t,
      x,
      y,
      size,
      font,
      fill,
      enter: 'none',
      ...extra,
    }) satisfies CanvasElement;

  const arrive = (i: number, children: CanvasElement[]) =>
    ({
      type: 'group',
      enter: 'rise',
      dist: 14,
      cue: 'OPEN',
      at: round(AT.OPEN + 0.25 + i * 0.08),
      after: round(0.25 + i * 0.08),
      dur: 0.45,
      children,
    }) satisfies CanvasElement;

  // REPORT's default second and its steps (seconds after the moment): the view settles and the
  // pointer travels, the button lights and is pressed, the marks fade, the shield pops up, the
  // message shrinks into it, the shield pulses as it lands and the confirmation pops up.
  const STEP = {
    light: 0.4,
    fade: 0.5,
    shield: 0.7,
    fly: 0.85,
    land: 1.5,
    toast: 1.6,
  };

  // The first moment after the marks (CLICK with choices, else REPORT): after the last label
  // has landed, or just after the cut on a card that opens marked.
  const resume = standing
    ? RESUME_AT
    : round(AT[NAMES[marks.length - 1]] + REPORT_AFTER);

  const momentAt = {
    CLICK: resume,
    DELETE: round(resume + CHOICE_GAP),
    REPORT: choices ? round(resume + 2 * CHOICE_GAP) : resume,
  };

  const timedOn = cueWriter(momentAt);

  const cued = (dt: number | undefined, extra: ElementKey = {}) =>
    timedOn('REPORT', dt, extra);
  return {
    ...context,
    marks,
    choices,
    standing,
    text,
    arrive,
    STEP,
    timedOn,
    cued,
  };
}
