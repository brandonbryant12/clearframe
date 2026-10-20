import type { TimedBeat } from '../domain.mjs';
import type { FrameAnalysis, QaFinding } from './qa-contracts.mjs';
import { pictureExtent, r2 } from './qa-pixels.mjs';
import { emptyFix, sizeFix, TYPE_BLOCKS } from './qa-advice.mjs';

function emptyStretch(c: FrameAnalysis, from: number, to: number): QaFinding[] {
  const seconds = (to - from) / c.fps;
  const b = c.beats.find(
    (x) => from / c.fps >= x.start && from / c.fps < x.end,
  );
  const voiced = c.beats.some(
    (x) => x.vo && x.vo.start < to / c.fps && x.vo.end > from / c.fps,
  );
  if (seconds < 1.5 || !voiced || !b || c.holds.has(b.id)) return [];
  const fix = emptyFix(c.sb.beats[b.index]);
  return [
    {
      level: 'warn',
      kind: 'empty',
      t: r2(from / c.fps),
      end: r2(to / c.fps),
      frame: from,
      beat: b.id,
      seconds: r2(seconds),
      fix,
      message: `next to nothing on screen for ${r2(seconds)} s (${r2(from / c.fps)}–${r2(to / c.fps)} s) while the voice talks: ${fix}`,
    },
  ];
}
function emptyFrames(c: FrameAnalysis): QaFinding[] {
  const findings: QaFinding[] = [],
    step = Math.max(1, Math.round(c.fps / 2)),
    band = Math.round(c.h * 0.12);
  let from: number | null = null;
  const close = (to: number) => {
    if (from == null) return;
    findings.push(...emptyStretch(c, from, to));
    from = null;
  };
  for (let i = 0; i < c.film.frames; i += step) {
    const e = pictureExtent(c.film.at(i), c.w, c.h, band);
    if (e.w * e.h < 0.02) from ??= i;
    else close(i);
  }
  close(c.film.frames);
  return findings;
}
function cornerOf(cx: number, cy: number): string {
  if (Math.abs(cx - 0.5) <= 0.22 && Math.abs(cy - 0.5) <= 0.22) return '';
  const words: string[] = [];
  if (cy < 0.35) words.push('top');
  else if (cy > 0.65) words.push('bottom');
  if (cx < 0.35) words.push('left');
  else if (cx > 0.65) words.push('right');
  return words.join(' ');
}
function smallPicture(c: FrameAnalysis, b: TimedBeat): QaFinding[] {
  if (TYPE_BLOCKS.includes(c.sb.beats[b.index]?.block ?? '')) return [];
  const i = Math.min(
    c.film.frames - 1,
    Math.round(
      (b.start + Math.max(0.5, Math.min(b.dur * 0.85, b.dur - 0.3))) * c.fps,
    ),
  );
  const e = pictureExtent(c.film.at(i), c.w, c.h, Math.round(c.h * 0.12));
  if (e.w === 0 || !((e.w < 0.5 && e.h < 0.5) || e.w * e.h < 0.12)) return [];
  const corner = cornerOf(e.cx, e.cy),
    fix = sizeFix(c.sb.beats[b.index] ?? {});
  return [
    {
      level: 'warn',
      kind: 'small',
      t: r2(i / c.fps),
      frame: i,
      beat: b.id,
      fill: { w: r2(e.w), h: r2(e.h) },
      fix,
      message: `the picture fills ${Math.round(e.w * 100)}% of the width and ${Math.round(e.h * 100)}% of the height${corner ? `, in the ${corner}` : ''}: a small thing in an empty frame, smaller still on a phone. ${fix}`,
    },
  ];
}
export function frameFindings(c: FrameAnalysis): QaFinding[] {
  return [...emptyFrames(c), ...c.beats.flatMap((b) => smallPicture(c, b))];
}
