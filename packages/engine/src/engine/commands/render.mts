import { reviewCommand as executeReview } from '../lib/review-cli.mjs';

import * as native from '../../film/production.mjs';
import type { CommandContext } from './options.mjs';
import type { RenderReport } from '../../film/rendering/contracts.mjs';

interface ReviewedRenderReport extends RenderReport {
  reviewPage?: string | null;
  motion?: { ready: boolean; still: number; words: number };
}

export async function doctorCommand() {
  const rows = native.doctor();
  console.table(rows);
  if (rows.some((r) => !r.ok)) process.exitCode = 1;
  return;
}

export async function buildCommand({ opts }: CommandContext) {
  return console.log(await native.buildScene(opts));
}

export async function reviewCommand({
  cmd,
  positionals,
  o,
  opts,
  dir,
}: CommandContext) {
  return executeReview(cmd, dir, o, opts, positionals);
}

export async function checkCommand({ opts, dir }: CommandContext) {
  const r = await native.checkProject(dir, opts);
  console.log(JSON.stringify(r, null, 2));
  if (r.errors.length) process.exitCode = 1;
  return;
}

export async function stillCommand({ opts, dir }: CommandContext) {
  return console.log(await native.stillProject(dir, opts));
}

export async function worldCommand({ opts, dir }: CommandContext) {
  return console.log(await native.worldMap(dir, { ...opts, draft: true }));
}

export async function sheetCommand({ opts, dir }: CommandContext) {
  return console.log(await native.sheetProject(dir, opts));
}

export async function looksCommand({ opts, dir }: CommandContext) {
  return console.log(await native.lookbookProject(dir, opts));
}

export async function review2Command({ opts, dir }: CommandContext) {
  const { reviewProject } = await import('../lib/review.mjs');
  return console.log(await reviewProject(dir, opts));
}

export async function previewCommand({
  positionals,
  o,
  opts,
  dir,
}: CommandContext) {
  return executeReview('range', dir, o, opts, positionals);
}

export async function renderCommand({ cmd, o, opts, dir }: CommandContext) {
  // One GPU render at a time on a shared machine: several agents rendering together exhausted
  // memory and failed with a bare exit code. Renders take seconds; queueing them is cheap.
  const { enterGate } = await import('../lib/resource-gate.mjs');
  if (await enterGate()) return;
  const report: ReviewedRenderReport = await native.renderProject(dir, {
    ...opts,
    draft: cmd === 'preview' || o.draft,
  });
  const { writeReviewPage } = await import('../lib/review-page.mjs');
  report.reviewPage = writeReviewPage(dir);
  // The motion verdict `draft` prints: agents who render directly never saw it and handed over
  // films that were all words. Stdout stays the JSON report; the verdict goes to stderr.
  let verdict = null;
  try {
    const { qaProject, motionVerdict } = await import('../lib/qa.mjs');
    verdict = motionVerdict(dir, await qaProject(dir, {}), {
      warnings: report.warnings ?? [],
    });
    report.motion = {
      ready: verdict.ready,
      still: verdict.share,
      words: verdict.typeShare,
    };
  } catch {}
  console.log(JSON.stringify(report, null, 2));
  if (verdict)
    console.error(
      `${verdict.lines.join('\n')}\n${verdict.ready ? 'READY' : 'NOT READY to hand over: fix what the motion verdict names, then render again.'}`,
    );
  return;
}
