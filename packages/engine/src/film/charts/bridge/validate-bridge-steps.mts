import { own } from './own.mjs';
import { words, spoken, finite } from './primitives.mjs';
import { check } from './check.mjs';
import type { BridgeSpec } from './contracts.mjs';

export function validateBridgeSteps({
  p,
  labels,
  level,
  tolerance,
  fmt,
  inside,
}: ValidateBridgeStepsContext) {
  for (const [i, s] of p.steps.entries()) {
    own(s, ['label', 'value', 'total', 'say'], `steps[${i}]`);
    words(s.label, `steps[${i}].label`, 28);
    check(!labels.has(s.label), 'labels must be unique');
    labels.add(s.label);
    spoken(s.say, `steps[${i}]`);
    if (s.total != null) {
      check(s.total === true, `steps[${i}].total is true for a subtotal`);
      check(i > 0, 'a subtotal follows at least one driver');
      check(
        s.value == null ||
          (finite(s.value) && Math.abs(s.value - level) <= tolerance),
        `steps[${i}] (${s.label}) says ${fmt(s.value)} but the drivers before it reach ${fmt(level)}`,
      );
      s.value = level;
    } else {
      check(
        finite(s.value) && s.value !== 0,
        `steps[${i}].value must be a nonzero number (drop a driver that did not move)`,
      );
      level += s.value;
    }
    inside(level, `the running total after steps[${i}] (${s.label})`);
  }
  return level;
}

export interface ValidateBridgeStepsContext {
  p: BridgeSpec;
  labels: Set<string>;
  level: number;
  tolerance: number;
  fmt: (v: number) => string;
  inside: (v: number, name: string) => void;
}
