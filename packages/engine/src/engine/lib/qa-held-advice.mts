import type { Storyboard, TimedBeat } from '../domain.mjs';
import type { QaFinding, ReviewedBeat } from './qa-contracts.mjs';
import { clip, stillFix } from './qa-advice.mjs';
import { HELD } from './qa-pixels.mjs';
import { figuresIn, pictureFor } from './pictures.mjs';
import { spoken } from './word-align.mjs';

function chartFix(authored: ReviewedBeat, said: string): string | null {
  const chart = authored.props?.chart;
  if (!chart) return null;
  const charted = new Set(
    JSON.stringify(chart.values ?? []).match(/-?\d+(\.\d+)?/g) ?? [],
  );
  const missing = figuresIn(said, spoken).filter(
    (x) => !charted.has(String(x.value)),
  );
  if (!missing.length) return null;
  return `The voice says ${missing.map((x) => x.say).join(', ')} and the chart does not show ${missing.length > 1 ? 'them' : 'it'}: add ${missing.map((x) => `{"label": "…", "value": ${x.value}, "say": "${x.say}"}`).join(', ')} to the chart's \`values\`${chart.kind === 'number' ? ' (a number steps to each value on its word)' : ''}.`;
}
function nextPicture(said: string): string {
  const next = pictureFor(said);
  if (!next) return ' and a picture of its own';
  return ` with ${next.sketch ? `the \`${next.sketch}\` sketch` : next.use}`;
}
function finishedPicture(
  authored: ReviewedBeat,
  tb: TimedBeat | undefined,
  end: number,
  said: string,
): string | null {
  if (!tb || end < tb.end - 0.4 || !/[.!?]\s+\S+\s+\S/.test(said)) return null;
  if (
    !(authored.props?.sketch || authored.props?.chart || authored.props?.cast)
  )
    return null;
  return `Its picture has finished while the voice goes on: give "${clip(said, 70)}" a beat of its own${nextPicture(said)}, or cut those words. (A longer film needs more pictures, not more words over one.)`;
}
function advise(f: QaFinding, beats: TimedBeat[], sb: Storyboard): void {
  if (f.t == null || f.end == null) return;
  const from = f.t,
    until = f.end,
    tb = beats.find((b) => b.id === f.beat);
  const authored = (tb ? sb.beats[tb.index] : undefined) ?? {};
  const said = (tb?.vo?.words ?? [])
    .filter((w) => w.t0 >= from - 0.05 && w.t0 < until)
    .map((w) => w.w)
    .join(' ');
  let fix = stillFix(authored);
  if (f.faint)
    fix = `Something does change here, but it is too thin, small or pale to read as motion (its busiest area changes ${f.faint} where ${HELD.local} reads as motion): make that change bolder (a filled shape rather than a thin line, a larger figure, a solid chip rather than a glow), move the object it belongs to, or move the camera onto it.`;
  fix =
    chartFix(authored, said) ??
    finishedPicture(authored, tb, until, said) ??
    fix;
  Object.assign(f, {
    said,
    fix,
    message: `the picture sits still for ${f.seconds} s (${f.t}–${f.end} s) while the voice says "${clip(said, 120)}": a viewer sees a slide. ${fix}`,
  });
}
export function adviseHeld(
  findings: QaFinding[],
  beats: TimedBeat[],
  sb: Storyboard,
): void {
  for (const f of findings)
    if (f.kind === 'held' && f.level === 'warn' && f.beat) advise(f, beats, sb);
}
