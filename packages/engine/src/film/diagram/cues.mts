import type { DiagramCue, DiagramOptions, Status } from './contracts.mjs';
import { check, STATUSES } from './shared.mjs';
export function diagramClock(resolve: DiagramOptions['resolve']) {
  const time = (v: number | string | null | undefined): number | null => {
    if (v == null) return null;
    if (resolve) return resolve(v);
    return typeof v === 'number' ? v : 0;
  };
  const cueOf = (v: DiagramCue, where: string) => {
    check(v.at == null || v.say == null, `${where}: use at or say, not both`);
    check(
      v.exitAt == null || v.exitSay == null,
      `${where}: use exitAt or exitSay, not both`,
    );
    for (const k of ['at', 'exitAt', 'dur', 'exitDur'] as const)
      check(
        v[k] == null || (Number.isFinite(v[k]) && v[k] >= 0),
        `${where}.${k} must be a nonnegative number`,
      );
    for (const k of ['say', 'exitSay'] as const)
      check(
        v[k] == null || (typeof v[k] === 'string' && v[k].trim()),
        `${where}.${k} must be a spoken word or phrase`,
      );
    return { at: time(v.at ?? v.say), exitAt: time(v.exitAt ?? v.exitSay) };
  };
  return { time, cueOf };
}
export const statusOk = (s: Status | undefined, where: string) =>
  check(
    s == null || STATUSES.includes(s),
    `${where}: status must be ${STATUSES.join(', ')}`,
  );
