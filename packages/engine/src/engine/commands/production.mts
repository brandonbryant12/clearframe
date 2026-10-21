import { findingIcon } from './messages.mjs';

import path from 'node:path';

import * as native from '../../film/production.mjs';
import type { CommandContext } from './options.mjs';

import { errorMessage } from '../lib/errors.mjs';

export async function pipelineCommand({ o, opts, dir }: CommandContext) {
  if (o.json) process.env.CLEARFRAME_PROGRESS_STDERR = '1';
  const { enterGate } = await import('../lib/resource-gate.mjs');
  if (await enterGate()) return;
  const { runPipeline } = await import('../lib/pipeline.mjs');
  const report = await runPipeline(dir, {
    draft: o.draft,
    scale: opts.scale,
    noRender: o['no-render'],
  });
  if (o.json) return console.log(JSON.stringify(report, null, 2));
  return console.log(
    `${report.status}: ${path.join(report.dir, 'REPORT.md')}\n${report.seconds?.toFixed(1) ?? '—'} s · ${report.reviewQueue.length} review items${report.artifacts.video ? `\nVideo: ${report.artifacts.video}` : ''}`,
  );
}

export async function draftCommand({ o, opts, dir }: CommandContext) {
  // Everything a review round needs, inside a single gate entry, with a compact report.
  const t0 = performance.now(),
    rel = (f: string) => path.relative(process.cwd(), f),
    lines = [];
  const { critique } = await import('../lib/critique.mjs');
  const c = critique(dir);
  lines.push(
    `critique (structure, before rendering): film ${c.summary.film}/100, ${c.summary.warnings} warning(s), ${c.summary.ideas} idea(s)`,
    ...c.findings
      .slice(0, 8)
      .map(
        (f) => `  ${f.level === 'warn' ? '!' : '·'} ${f.where}: ${f.message}`,
      ),
  );
  const g = await import('../lib/generate.mjs');
  const { phase } = await import('../lib/runlog.mjs');
  await phase('voice', () => g.voice(dir, { draft: true }));
  // --rough: the first full-length look. Declared placeholders render as slates; only audit
  // findings about declared stand-ins become craft; every other check still blocks.
  const rough = !!o.rough;
  let notReady = false;
  const r = await native.checkProject(dir, { draft: true, rough });
  lines.push(
    `check${rough ? ' (rough)' : ''}: ${r.errors.length} error(s), ${r.warnings.length} warning(s)${rough ? `, ${r.craft.length} craft finding(s) left for later, ${r.placeholders.length} placeholder(s)` : ''}`,
    ...r.errors.map((e) => `  ✗ ${e}`),
    ...r.craft.slice(0, 6).map((e) => `  ~ ${e}`),
    ...r.warnings.slice(0, 6).map((w) => `  ! ${w}`),
  );
  if (r.errors.length) {
    process.exitCode = 1;
    return console.log(lines.join('\n'));
  }
  const findings = (r.notes.join('\n').match(/^Warning .*$/gm) ?? []).slice(
    0,
    6,
  );
  if (findings.length) lines.push('native:', ...findings.map((f) => `  ${f}`));
  // A long film's rough cut is judged in motion; one frame per beat is enough of a sheet.
  lines.push(
    `sheet: ${rel(await native.sheetProject(dir, { draft: true, rough, ...(rough ? { per: 1, columns: 6 } : {}) }))}`,
  );
  if (!o['no-render']) {
    const v = await native.renderProject(dir, {
      draft: true,
      rough,
      scale: opts.scale,
      check: r,
      label: o.label ?? (rough ? 'Rough cut' : undefined),
    });
    lines.push(
      `video: ${rel(path.join(dir, 'build/video.mp4'))} (${v.frames} frames, ${v.seconds.toFixed(1)} s to render)${v.revision ? ` · revision ${v.revision}` : ''}`,
    );
    const { writeReviewPage } = await import('../lib/review-page.mjs');
    appendReviewPage(lines, writeReviewPage(dir));
    // The picture in motion, measured on the encoded film: the honest test of "narrated slides".
    // critique reads the storyboard's structure; this reads what the viewer actually sees.
    try {
      const { qaProject, motionVerdict } = await import('../lib/qa.mjs');
      const q = await qaProject(dir, {});
      const v = motionVerdict(dir, q, { warnings: r.warnings });
      notReady = !v.ready;
      lines.push(
        ...v.lines,
        `  qa: ${rel(path.join(q.dir, 'phone.png'))} (read it as a phone would)`,
      );
    } catch (e) {
      lines.push(`motion: qa did not run (${errorMessage(e).split('\n')[0]})`);
    }
  }
  lines.push(
    `done in ${((performance.now() - t0) / 1000).toFixed(1)} s. ${notReady ? 'NOT READY to hand over: fix what the motion verdict names, then draft again.' : 'Open the sheet before anything else.'}`,
  );
  // Exit 2 (not 1: the render worked) so a NOT READY film reads as unfinished to whoever ran it.
  // A rough cut is a first look and may be unfinished.
  if (notReady && !rough) process.exitCode = 2;
  return console.log(lines.join('\n'));
}

function appendReviewPage(lines: string[], file: string | null): void {
  if (file) lines.push(`review page: ${path.relative(process.cwd(), file)}`);
}

export async function checkpointsCommand({ o, dir }: CommandContext) {
  const { checkpoints, coverage } = await import('../lib/checkpoints.mjs');
  const guided = (o.mode ?? 'guided') !== 'one-shot';
  const list = checkpoints(dir, { mode: guided ? 'guided' : 'one-shot' });
  const chapters = coverage(dir);
  if (o.json)
    return console.log(
      JSON.stringify(
        {
          mode: guided ? 'guided' : 'one-shot',
          checkpoints: list,
          coverage: chapters,
        },
        null,
        2,
      ),
    );
  const next = list.find((c) => !c.done);
  if (chapters.length > 1)
    console.log(
      [
        'Coverage by chapter:',
        ...chapters.map(
          (c) =>
            `  ${c.chapter.slice(0, 24).padEnd(24)} ${String(c.beats).padStart(3)} beats · ${c.pictured} with a picture · ${c.placeholders} placeholder(s)${c.unfinished ? ` · ${c.unfinished} unfinished element(s)` : ''} · ${c.accepted} accepted`,
        ),
        '',
      ].join('\n'),
    );
  const action =
    guided || next?.id === 'spend'
      ? `Ask: "${next?.question}"`
      : 'Decide, then log what you chose and why.';
  return console.log(
    [
      `${guided ? 'Guided: stop and ask the person at each open checkpoint.' : 'One-shot: decide each open checkpoint yourself, log it under "## Decisions" in DIRECTION.md (rough cut and final: decide DIR rNNN), and publish the review page; spend still needs a budget.'}`,
      ...list.map(
        (c) => `${c.done ? '✓' : '○'} ${c.name.padEnd(15)} ${c.detail}`,
      ),
      next
        ? `\nNext: ${next.name}. ${action}`
        : '\nEvery checkpoint is closed.',
    ].join('\n'),
  );
}

export async function critiqueCommand({ o, dir }: CommandContext) {
  const { critique } = await import('../lib/critique.mjs');
  const r = critique(dir);
  if (o.json) return console.log(JSON.stringify(r, null, 2));
  const s = r.summary;
  console.log(
    `film ${s.film}/100 · ${s.beats} beats · ${s.seconds}s · ${s.families} scene families · ${s.drawn} drawn · ${s.imaged} with imagery · ${s.graphicTransitions} graphic transitions · ${s.tones} colour blocks`,
  );
  return console.log(
    r.findings.length
      ? r.findings
          .map(
            (f) => `${findingIcon(f.level)} ${f.where.padEnd(18)} ${f.message}`,
          )
          .join('\n')
      : 'No findings. Now look at the sheet.',
  );
}
