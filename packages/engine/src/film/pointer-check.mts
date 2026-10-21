import type { CanvasElement, Fail, PointerStep } from './types.mjs';

import { STEP_FIELDS, isPoint } from './pointer-common.mjs';
/** Validate a pointer element in place; `fail(message)` throws with the caller's context. */
export function checkPointer(el: CanvasElement, at: string, fail: Fail): void {
  const steps: PointerStep[] = el.steps ?? [
    { to: el.to, say: el.say, at: el.at, press: el.press, point: el.point },
  ];
  if (el.steps != null && el.to != null)
    fail(
      `${at}: a pointer takes either to (one target) or steps (several), not both`,
    );
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 8)
    fail(`${at}.steps must be 1–8 steps: {to: an element id, say|at, press}`);
  steps.forEach((s, i) =>
    checkStep(s, el.steps ? `${at}.steps[${i}]` : at, fail),
  );
  if (el.from != null && !isPoint(el.from))
    fail(`${at}.from must be [x, y] frame pixels`);
  if (el.style != null && !['arrow', 'touch'].includes(el.style))
    fail(`${at}.style must be arrow (a mouse pointer) or touch (a fingertip)`);
  if (
    el.size != null &&
    !(Number.isFinite(el.size) && el.size >= 16 && el.size <= 160)
  )
    fail(`${at}.size must be 16–160 px`);
  if (el.leave != null && typeof el.leave !== 'boolean')
    fail(`${at}.leave must be true or false`);
  if (el.sound != null && el.sound !== false && typeof el.sound !== 'string')
    fail(`${at}.sound must be false or a sound name`);
}

function checkStep(s: PointerStep, where: string, fail: Fail): void {
  if (!s || typeof s !== 'object') fail(`${where} must be an object`);
  for (const [key, value] of Object.entries(s))
    if (value !== undefined && !STEP_FIELDS.includes(key))
      fail(`${where}: unsupported step field ${key}`);
  if (!(typeof s.to === 'string' && s.to.trim()) && !isPoint(s.to))
    fail(
      `${where}.to must name the id of the element to point at (a button, a field, a card), or be [x, y]`,
    );
  if (s.say == null && s.at == null)
    fail(`${where} needs say (the word it presses on) or at`);
  if (
    s.point != null &&
    !(isPoint(s.point) && s.point.every((v) => v >= 0 && v <= 1))
  )
    fail(
      `${where}.point must be [x, y] fractions of the target's box (default [0.66, 0.68])`,
    );
  if (s.press != null && typeof s.press !== 'boolean')
    fail(`${where}.press must be true or false`);
}
