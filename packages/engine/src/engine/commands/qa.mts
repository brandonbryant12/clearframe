import { findingIcon, findingLocation } from './messages.mjs';

import path from 'node:path';

import type { CommandContext } from './options.mjs';

export async function qaCommand({ o, dir }: CommandContext) {
  const { qaProject } = await import('../lib/qa.mjs');
  const { verdictOutcome } = await import('../lib/qa.mjs');
  const r = await qaProject(dir, { video: o.video, loop: o.loop });
  // An error (a broken receipt, a one-frame pop) fails the command in either output mode:
  // automation reads --json and the exit status, not the printed lines.
  if (r.findings.some((f) => f.level === 'error')) process.exitCode = 1;
  // The motion verdict and what it assessed, or the reason it could not be measured.
  const motion = verdictOutcome(dir, r);
  if (o.json) return console.log(JSON.stringify({ ...r, motion }, null, 2));
  const s = r.summary,
    rel = (f: string) => path.relative(process.cwd(), f);
  // The verdict first: agents quote the first line ("held 4%") as the result.
  const verdict = motion.status === 'measured' ? motion.verdict : null;
  if (motion.status === 'unavailable')
    console.log(
      `motion: NOT MEASURED (${motion.reason}): no readiness verdict for this film.`,
    );
  else console.log(motion.verdict.lines[0]);
  const audioFallback = s.audio ? 'sound NOT MEASURED' : 'no audio';
  const audioSummary = s.loudness
    ? `${s.loudness.integrated} LUFS, peak ${s.loudness.peak}`
    : audioFallback;
  console.log(
    `${s.seconds}s · change ${s.changePerSecond}/s (viral references 8–42; under 2 reads as held) · held ${s.heldSeconds}s · ${s.pops} pop(s) · ${audioSummary} · ${s.color}`,
  );
  // Which film these numbers are about: bound to its receipt, or this file alone.
  const { evidenceLine } = await import('../lib/evidence.mjs');
  console.log(evidenceLine(r.evidence));
  for (const f of r.findings)
    console.log(
      `${findingIcon(f.level)} ${findingLocation({ ...f, beat: f.beat ?? undefined }).padEnd(22)} ${f.message}`,
    );
  console.log(
    `${rel(path.join(r.dir, 'timeline.png'))} (one frame per second) · ${rel(path.join(r.dir, 'phone.png'))} (360 px: read it as a phone would)`,
  );
  // And the whole verdict last, with each edit.
  if (verdict) console.log(verdict.lines.join('\n'));
  return;
}
