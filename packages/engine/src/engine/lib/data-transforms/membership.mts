import { DATA_MODEL_VERSION } from './contracts.mjs';
import type {
  MembershipSummary,
  Member,
  Operator,
  MembershipGroup,
  MemberState,
} from './contracts.mjs';
import {
  object,
  dated,
  number,
  check,
  isOperator,
  id,
  label,
  sum,
} from './inputs.mjs';

/** Count share and weight share retain the full dated membership denominator.
 * Missing observations are a separate state, never silently dropped or treated as failures.
 */
export function summarizeMembership(input: unknown): MembershipSummary {
  object(
    input,
    ['membershipDate', 'metricAsOf', 'condition', 'members'],
    'membership',
  );
  const membershipDate = dated(input.membershipDate).date,
    metricAsOf = dated(input.metricAsOf).date;
  const condition = input.condition;
  object(condition, ['operator', 'threshold'], 'condition');
  const { operator } = condition,
    threshold = number(condition.threshold, 'threshold');
  check(isOperator(operator), 'operator must be gt, gte, lt or lte');
  const rows = input.members;
  check(
    Array.isArray(rows) && rows.length >= 1 && rows.length <= 100,
    'members needs 1–100 records',
  );
  const seen = new Set<string>(),
    members = rows.map((p: unknown, i: number): Member => {
      object(p, ['id', 'label', 'value', 'weight'], `members[${i}]`);
      const pid = id(p.id, `members[${i}].id`);
      check(!seen.has(pid), 'member identifiers must be unique');
      seen.add(pid);
      const name = label(p.label, `members[${i}].label`);
      const weight = number(p.weight, `members[${i}].weight`);
      check(weight >= 0, 'weights must be nonnegative');
      const value =
        p.value === null ? null : number(p.value, `members[${i}].value`);
      const tests: Record<Operator, (v: number) => boolean> = {
        gt: (v) => v > threshold,
        gte: (v) => v >= threshold,
        lt: (v) => v < threshold,
        lte: (v) => v <= threshold,
      };
      const meets = value === null ? null : tests[operator](value);
      return {
        id: pid,
        label: name,
        value,
        weight,
        state: memberState(meets),
      };
    });
  const totalWeight = sum(members.map((p) => p.weight));
  check(totalWeight > 0, 'membership needs a positive total weight');
  const groups = (['meets', 'other', 'missing'] as const).map(
    (state): MembershipGroup => {
      const rows = members.filter((p) => p.state === state),
        weight = sum(rows.map((p) => p.weight));
      return {
        state,
        count: rows.length,
        weight,
        countFraction: rows.length / members.length,
        weightFraction: weight / totalWeight,
      };
    },
  );
  return {
    modelVersion: DATA_MODEL_VERSION,
    method: 'full-membership-count-and-weight-shares',
    membershipDate,
    metricAsOf,
    condition: { operator, threshold },
    totalCount: members.length,
    totalWeight,
    observedCount: members.filter((p) => p.state !== 'missing').length,
    observedWeight: sum(
      members.filter((p) => p.state !== 'missing').map((p) => p.weight),
    ),
    groups,
    members: members.map((p) => ({
      ...p,
      weightFraction: p.weight / totalWeight,
    })),
  };
}

export function memberState(meets: boolean | null): MemberState {
  if (meets === null) return 'missing';
  return meets ? 'meets' : 'other';
}
