import path from 'node:path';
import { phase } from '../../engine/lib/runlog.mjs';
import { readJSON } from '../../engine/lib/util.mjs';
import { errorMessage } from '../../engine/lib/errors.mjs';
import type { NativeJob } from '../types.mjs';
import { prepareProject, nativeCommand } from '../prepare.mjs';
import { classifyAudit } from './audit.mjs';
import type { PrepareOptions, CheckResult } from './contracts.mjs';
import { profileOf } from './contracts.mjs';
export async function checkProject(
  root: string,
  options: PrepareOptions = {},
): Promise<CheckResult> {
  let ctx;
  const profile = profileOf(options);
  try {
    ctx = await phase('prepare', () => prepareProject(root, options));
  } catch (e) {
    return {
      profile,
      errors: [errorMessage(e)],
      warnings: [],
      notes: [],
      craft: [],
      placeholders: [],
    };
  }
  const errors: string[] = [],
    notes: string[] = [],
    craft: string[] = [];
  const warnings = [...ctx.warnings];
  try {
    notes.push(
      withoutCameraCuts(
        await phase('inspect', () =>
          nativeCommand(ctx, 'inspect', ['--fail-on', 'error'], true),
        ),
        ctx.job,
      ),
    );
  } catch (e) {
    errors.push(errorMessage(e));
  }
  // The frame audit: held type cut by the frame, printed over other type or
  // the subject, or too small to read. A director would send any of these back. A rough cut
  // relaxes only what is declared unfinished (see classifyAudit); everything else still fails.
  try {
    const file = path.join(ctx.dir, 'audit.json');
    await phase('audit', () => nativeCommand(ctx, '--audit', [file], true));
    const sorted = classifyAudit(readJSON(file), {
      rough: options.rough,
      allowed: ctx.allowed,
      job: ctx.job,
    });
    errors.push(...sorted.errors);
    warnings.push(...sorted.warnings);
    craft.push(...sorted.craft);
  } catch (e) {
    errors.push(`frame audit failed: ${errorMessage(e)}`);
  }
  return {
    profile,
    errors,
    warnings,
    notes,
    craft,
    placeholders: ctx.placeholders,
    unfinished: ctx.unfinished,
    duration: ctx.timing.duration,
    inputId: ctx.manifest.inputId,
  };
}

/** Drop "cut off by the canvas edge" notes inside moves that carry type past the edge on
 * purpose: a world camera travelling, a push, and the camera going into an element. */
function withoutCameraCuts(report: string, job: NativeJob): string {
  const moving = ['push', 'into'],
    edge = Math.ceil(0.8 * job.fps);
  const moves = job.beats.flatMap((b) => {
    const out: [number, number][] = [];
    // A camera rect frames part of a larger drawing; cropping what lies outside is the point.
    // job.mjs checks the beat's own text against its view instead.
    if (
      b.block === 'canvas' &&
      Array.isArray(b.props.view) &&
      b.props.view.length === 4
    )
      out.push([b.start_frame, b.start_frame + b.frames]);
    if (moving.includes(b.transition))
      out.push([b.start_frame, b.start_frame + edge]);
    if (moving.includes(b.exit))
      out.push([b.start_frame + b.frames - edge, b.start_frame + b.frames]);
    return out;
  });
  const kept = String(report)
    .split('\n')
    .filter((line) => {
      const m = / \(frames (\d+)\.\.(\d+),.*cut off by the canvas edge/.exec(
        line,
      );
      // The renderer merges one text's sightings across beats; judge the range by its ends.
      const inside = (f: number) => moves.some(([a, b]) => f >= a && f <= b);
      return !m || !(inside(+m[1]) && inside(+m[2]));
    })
    .join('\n');
  // The count describes what is left after the filter, not what the renderer first saw.
  const left = kept
    .split('\n')
    .filter((l) => /^(Error|Warning|Info) /.test(l)).length;
  return kept.replace(/(checked \d+ frames: )\d+ findings?/, (_, head) =>
    left ? `${head}${left} findings` : `${head}no problems found`,
  );
}
