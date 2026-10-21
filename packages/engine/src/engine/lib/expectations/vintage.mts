import { utcDay } from '../../../film/plot-data.mjs';

import { EXPECTATIONS_VERSION } from './contracts.mjs';
import type {
  VintageSnapshot,
  Vintage,
  Release,
  Actual,
} from './contracts.mjs';
import {
  object,
  dated,
  list,
  label,
  check,
  datedValues,
  nullable,
} from './inputs.mjs';

/** Returns only information released by asOf. A null revision is a withdrawal,
 * not permission to resurrect an older value. Forecasts must target today or later.
 */
export function vintageSnapshot(input: unknown): VintageSnapshot {
  object(input, ['asOf', 'vintages', 'releases'], 'vintage snapshot');
  const { date: asOf, day: cutoff } = dated(input.asOf);
  const vintageRows = input.vintages,
    releaseRows = input.releases;
  list(vintageRows, 1, 100, 'vintages');
  list(releaseRows, 0, 12000, 'releases');
  const seen = new Set<string>();
  let last = -Infinity;
  const vintages = vintageRows.map((v): Vintage => {
    object(v, ['id', 'issuedAt', 'values'], 'vintage');
    const id = label(v.id, 'vintage id');
    check(!seen.has(id), 'duplicate vintage id');
    seen.add(id);
    const { date: issuedAt, day: issued } = dated(v.issuedAt);
    check(issued > last, 'vintage issue dates must strictly increase');
    last = issued;
    const values = datedValues(v.values, 'targetDate').map((p) => ({
      targetDate: p.date,
      value: p.value,
    }));
    for (const p of values)
      check(
        utcDay(p.targetDate) >= issued,
        'forecast target must not precede its issue date',
      );
    return { id, issuedAt, values };
  });
  const revisions = new Set<string>(),
    releases = releaseRows.map((r): Release => {
      object(r, ['targetDate', 'releasedAt', 'value'], 'release');
      const { date: targetDate, day: target } = dated(r.targetDate),
        { date: releasedAt, day: released } = dated(r.releasedAt);
      check(
        released >= target,
        'actual release must not precede its observation date',
      );
      const identity = `${targetDate}/${releasedAt}`;
      check(!revisions.has(identity), 'ambiguous duplicate release');
      revisions.add(identity);
      return {
        targetDate,
        releasedAt,
        value: nullable(r.value, 'released value'),
      };
    });
  const available = vintages.filter((v) => utcDay(v.issuedAt) <= cutoff),
    known = releases.filter((r) => utcDay(r.releasedAt) <= cutoff);
  // Hidden future vintages/releases must not even leak their target dates into this view.
  const targets = [
    ...new Set([
      ...available.flatMap((v) => v.values.map((p) => p.targetDate)),
      ...known.map((r) => r.targetDate),
    ]),
  ].sort();
  const actuals = targets.map((targetDate): Actual => {
    const rows = known
        .filter((r) => r.targetDate === targetDate)
        .sort((a, b) => a.releasedAt.localeCompare(b.releasedAt)),
      r = rows.at(-1);
    return {
      targetDate,
      value: r?.value ?? null,
      releasedAt: r?.releasedAt ?? null,
      state: releaseState(r),
      revisionCount: rows.length,
    };
  });
  return {
    modelVersion: EXPECTATIONS_VERSION,
    asOf,
    method: 'latest-available-release-per-observation',
    vintages: available,
    actuals,
  };
}

export function releaseState(release: Release | undefined): Actual['state'] {
  if (!release) return 'not-released';
  return release.value === null ? 'withdrawn' : 'released';
}
