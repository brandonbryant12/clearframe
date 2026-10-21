import { listRevisions } from './revisions.mjs';

import { readRunlog, runlogReport } from './runlog.mjs';

import type { ReviewContext } from './review-command-contracts.mjs';
import { ms, json } from './review-command-common.mjs';
export async function runlogCommand(ctx: ReviewContext): Promise<void> {
  const { dir, o } = ctx;

  const r = runlogReport(
    readRunlog(dir),
    listRevisions(dir).flatMap((r) =>
      r.createdAt ? [{ ...r, createdAt: r.createdAt }] : [],
    ),
  );

  if (o.json) return json(r);

  if (!r.commands || !r.firstAt || !r.lastAt)
    return console.log('No commands logged yet (review/runlog.jsonl).');

  const lines = [
    `${r.commands} command(s) from ${r.firstAt.replace('T', ' ').slice(0, 19)} to ${r.lastAt.replace('T', ' ').slice(0, 19)} (${ms(r.wallMs)} wall clock)`,
    `measured command time ${ms(r.measuredMs)}${r.failed ? ` (${r.failed} failed)` : ''}; between commands ${ms(r.gapMs)} — not measured: authoring, reading, review or waiting, the log cannot tell which`,
    '',
    ...r.runs.map((x, i) => {
      const gap = i
        ? Date.parse(x.startedAt) - Date.parse(r.runs[i - 1].endedAt)
        : 0;
      return `${x.startedAt.slice(11, 19)}  ${x.cmd.padEnd(12)} ${ms(x.ms ?? 0).padStart(10)}${x.status === 'failed' ? '  failed' : ''}${x.revision ? `  → ${x.revision}` : ''}${gap > 1000 ? `   (gap ${ms(gap)})` : ''}`;
    }),
    '',
    'Phases (measured, all commands):',
    ...Object.entries(r.phases)
      .sort((a, b) => b[1].ms - a[1].ms)
      .map(
        ([k, v]) => `  ${k.padEnd(16)} ${ms(v.ms).padStart(10)}  ×${v.count}`,
      ),
    '',
    ...Object.entries(r.milestones).map(([k, m]) =>
      m
        ? `${k}: ${m.revision}, ${ms(m.sinceFirstCommandMs)} after the first logged command (wall clock, includes gaps)`
        : `${k}: not yet`,
    ),
  ];

  return console.log(lines.join('\n'));
}
