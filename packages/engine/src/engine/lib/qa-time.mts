import type { TimedBeat } from '../domain.mjs';
import type { TimeAnalysis, QaFinding } from './qa-contracts.mjs';
import { r2, median, HELD } from './qa-pixels.mjs';

interface TimeContext extends Required<TimeAnalysis> {
  joins: Set<number>;
}
function beatAt(c: TimeContext, t: number): TimedBeat | undefined {
  return c.beats.find((b) => t >= b.start && t < b.end) ?? c.beats.at(-1);
}
function where(c: TimeContext, i: number) {
  const t = i / c.fps,
    b = beatAt(c, t);
  return {
    t: r2(t),
    frame: i,
    beat: b?.id ?? null,
    local: b ? r2(t - b.start) : null,
  };
}
function joinFrames(c: TimeContext): Set<number> {
  const joins = new Set<number>();
  for (const b of c.beats.slice(1)) {
    const f = Math.round(b.start * c.fps),
      [before, after] = c.covers[b.id] ?? [0, 0];
    for (
      let k = -2 - Math.ceil(before * c.fps);
      k <= 2 + Math.ceil(after * c.fps);
      k++
    )
      joins.add(f + k);
  }
  return joins;
}
function pops(c: TimeContext): QaFinding[] {
  const findings: QaFinding[] = [];
  for (let i = 1; i < c.d.length - 1; i++) {
    const lo = Math.min(c.d[i], c.d[i + 1]);
    if (lo > Math.max(1.5, 3 * c.skip[i]))
      findings.push({
        level: 'error',
        kind: 'pop',
        ...where(c, i),
        message: `one-frame pop: frame ${i} differs from both neighbours (${r2(lo)} vs ${r2(c.skip[i])} between them)`,
      });
  }
  return findings;
}
function seams(c: TimeContext): QaFinding[] {
  const findings: QaFinding[] = [];
  for (const b of c.beats.slice(1)) {
    const prev = c.beats[c.beats.indexOf(b) - 1],
      w = c.worlds[b.id];
    if (
      !w ||
      c.worlds[prev.id] !== w ||
      (b.transition && b.transition !== 'cut')
    )
      continue;
    const f = Math.round(b.start * c.fps);
    if (f <= 0 || f >= c.d.length) continue;
    const around = median(
      c.d.slice(Math.max(1, f - 15), f - 1).concat(c.d.slice(f + 2, f + 17)),
    );
    if (c.d[f] > Math.max(6, 4 * around))
      findings.push({
        level: 'warn',
        kind: 'seam',
        ...where(c, f),
        message: `world "${w}" seam jumps between ${prev.id} and ${b.id} (${r2(c.d[f])} against ${r2(around)} around it)`,
      });
  }
  return findings;
}
function jumps(c: TimeContext): QaFinding[] {
  const findings: QaFinding[] = [];
  for (let i = 1; i < c.d.length; i++) {
    if (!(c.d[i] > 12) || c.joins.has(i)) continue;
    let j = i;
    while (j + 1 < c.d.length && c.d[j + 1] > 12 && !c.joins.has(j + 1)) j++;
    const peak = Math.max(...c.d.slice(i, j + 1));
    findings.push({
      level: 'note',
      kind: 'jump',
      ...where(c, i),
      message: `hard change inside the beat${j > i ? ` over ${j - i + 1} frames` : ''} (${r2(peak)})`,
    });
    i = j;
  }
  return findings;
}
function heldMasks(c: TimeContext) {
  const F = Math.round(c.fps),
    held = new Uint8Array(c.d.length),
    still = new Uint8Array(c.d.length);
  for (let i = F; i < c.d.length; i++) {
    if (beatAt(c, i / c.fps) !== beatAt(c, (i - F) / c.fps)) continue;
    if (!(c.second[i] < HELD.change) || !((c.local[i] ?? 0) < HELD.local))
      continue;
    held.fill(1, i - F, i + 1);
    still[i] = 1;
  }
  return { held, still };
}
function heldMessage(
  seconds: number,
  from: number,
  to: number,
  deliberate: boolean,
  voiced: boolean,
): string {
  if (deliberate)
    return `the picture holds for ${r2(seconds)} s (${from}–${to} s): a declared reading hold (pace: "hold")`;
  if (voiced)
    return `the picture sits still for ${r2(seconds)} s (${from}–${to} s) while the voice talks: a viewer sees a slide. Change something on a later word (a cue, a key, a camera move, a cast formation), shorten the beat, or declare a reading hold with pace: "hold"`;
  return `the picture sits still for ${r2(seconds)} s (${from}–${to} s) with no voice: fine for a breath or a title, long for anything else`;
}
function heldFinding(
  c: TimeContext,
  still: Uint8Array,
  i: number,
  j: number,
): QaFinding {
  const seconds = (j - i + 1) / c.fps,
    s = where(c, i),
    e = where(c, j);
  const voiced = c.beats.some(
    (x) => x.vo && x.vo.start < e.t && x.vo.end > s.t,
  );
  const deliberate = s.beat != null && c.holds.has(s.beat);
  let peak = 0;
  for (let k = i; k <= j; k++)
    if (still[k] && Number.isFinite(c.local[k]))
      peak = Math.max(peak, c.local[k]);
  return {
    level: voiced && !deliberate ? 'warn' : 'note',
    kind: 'held',
    ...s,
    end: e.t,
    seconds: r2(seconds),
    ...(peak >= 3.5 ? { faint: r2(peak) } : {}),
    ...(deliberate ? { deliberate: true } : {}),
    message: heldMessage(seconds, s.t, e.t, deliberate, voiced),
  };
}
function holds(c: TimeContext): QaFinding[] {
  const findings: QaFinding[] = [],
    { held, still } = heldMasks(c);
  for (let i = 0; i < c.d.length; i++) {
    if (!held[i]) continue;
    let j = i;
    while (
      j + 1 < c.d.length &&
      held[j + 1] &&
      beatAt(c, (j + 1) / c.fps) === beatAt(c, i / c.fps)
    )
      j++;
    if ((j - i + 1) / c.fps >= HELD.seconds)
      findings.push(heldFinding(c, still, i, j));
    i = j;
  }
  return findings;
}
/** Analyse frame differences without decoding a video. */
export function timeFindings(input: TimeAnalysis): QaFinding[] {
  const c: TimeContext = {
    local: [],
    beats: [],
    worlds: {},
    covers: {},
    holds: new Set(),
    ...input,
    joins: new Set(),
  };
  c.joins = joinFrames(c);
  return [...pops(c), ...seams(c), ...jumps(c), ...holds(c)];
}
