import { check, HOP } from './decision-common.mjs';
import type { DecisionSpec, DecisionWhen } from './decision-contracts.mjs';
export function decisionSchedule(p: DecisionSpec, when: DecisionWhen) {
  // The cases walk the rule.
  const starts: number[] = [];
  let clock = 0;
  p.cases.forEach((c, ci) => {
    const t0 = when(c, ci === 0 ? 0.8 : clock + 0.8);
    check(
      t0 >= clock - 1e-6,
      `cases[${ci}] starts at ${t0.toFixed(2)} s, before the case before it has finished (${clock.toFixed(2)} s)`,
    );
    starts.push(t0);
    clock = t0 + (c.path.length - 1) * HOP + 0.6;
  });
  const back = p.return ? when(p.return, clock + 0.6) : null;
  if (back != null)
    check(
      back >= clock - 1e-6,
      `return lands at ${back.toFixed(2)} s, before the counterfactual has finished (${clock.toFixed(2)} s)`,
    );
  return { starts, clock, back };
}
