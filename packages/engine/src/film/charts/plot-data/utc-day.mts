import { check } from './check.mjs';

export function utcDay(value: unknown): number {
  check(
    typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value),
    'dates must be YYYY-MM-DD',
  );
  const time = Date.parse(`${value}T00:00:00.000Z`);
  check(
    Number.isFinite(time) &&
      new Date(time).toISOString().slice(0, 10) === value,
    `invalid calendar date ${value}`,
  );
  return time / 86400000;
}
