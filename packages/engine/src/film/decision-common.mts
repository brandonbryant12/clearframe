import type { Timed } from './types.mjs';
import type {
  Answer,
  DecisionOutcome,
  DecisionSpec,
  DecisionCase,
  DecisionPoint,
} from './decision-contracts.mjs';
export function check(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error(`decision: ${message}`);
}
export const ID = /^[a-z][a-z0-9-]{0,23}$/;
export const show = { at: 0, enter: 'none' };
export function own(
  o: unknown,
  keys: string[],
  name: string,
): asserts o is Record<string, unknown> {
  check(
    o != null && typeof o === 'object' && !Array.isArray(o),
    `${name} must be an object`,
  );
  for (const k of Object.keys(o))
    check(
      keys.includes(k),
      `unknown ${name}.${k} (it takes ${keys.join(', ')})`,
    );
}
export const words = (v: unknown, name: string, max: number): string => {
  check(
    typeof v === 'string' && v.trim() && v.length <= max,
    `${name} needs text up to ${max} characters`,
  );
  return v;
};
export const timing = (v: Timed, name: string) => {
  check(
    (['say', 'cue', 'at'] as const).filter((k) => v[k] != null).length <= 1,
    `${name} takes one of say, cue or at`,
  );
  check(
    v.after == null || v.say != null || v.cue != null,
    `${name}.after needs say or cue`,
  );
};
export const TONES = ['positive', 'negative', 'accent', 'muted'];
export const HOP = 0.55;

export function answerAt(value: string | undefined, where: string): Answer {
  check(value === 'yes' || value === 'no', `${where} is "yes" or "no"`);
  return value;
}
export function outcomeOf(c: DecisionCase): string {
  const step = c.path.at(-1);
  check(step?.outcome, 'case must end at an outcome');
  return step.outcome;
}
export function outcomeAt(p: DecisionSpec, id: string): DecisionOutcome {
  const value = p.outcomes.find((o) => o.id === id);
  check(value, `missing outcome ${id}`);
  return value;
}
export function positionAt(
  positions: Map<string, DecisionPoint>,
  id: string,
): DecisionPoint {
  const pos = positions.get(id);
  check(pos, `missing position for ${id}`);
  return pos;
}
