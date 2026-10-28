import type * as Types from 'effect/Types';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import {
  errorMessage,
  isJobKind,
  type JobRequest,
  type JobView,
} from '../harness/contracts.mjs';
import { renderedFile, lookImage } from './tool-media.mjs';
const timelineSchema = Schema.Struct({
  beats: Schema.mutable(
    Schema.Array(
      Schema.Struct({
        id: Schema.String,
        start: Schema.Number,
        end: Schema.Number,
      }),
    ),
  ),
});
import type { ToolOptions, ToolHandlers, ToolInput } from './contracts.mjs';
import { fail, clip, sec, TERMINAL } from './tool-common.mjs';

function pickJobs(
  jobs: ToolOptions['jobs'],
  film: string | undefined,
  id: string | undefined,
): JobView[] {
  if (!id) return jobs.list(film).slice(-5);
  if (!jobs.get) return jobs.list(film).filter((job) => job.id === id);
  const job = jobs.get(id);
  return job && job.film === film ? [job] : [];
}
function outputLine(job: JobView): string | null {
  if (job.status !== 'complete') return null;
  const stale =
    job.matches === false
      ? ' — the film changed while or since it rendered; it may not match'
      : '';
  const revision = job.revision ? `; saved revision ${job.revision}` : '';
  return `  output: ${job.url ?? 'none'} (look at it yourself with clearframe_look; the person views it in the studio)${stale}${revision}`;
}
function mediaLine(job: JobView): string | null {
  const media = job.media;
  if (!media) return null;
  const authored = media.authored
    ? ` (the film itself is ${sec(media.authored)}; the file rounds up to whole frames and audio)`
    : '';
  const sound = media.audio ? 'with sound' : 'silent';
  const draft =
    job.kind === 'draft'
      ? ' (a half-size rough cut, not the project size; its narration and music are what the Sound status says was actually made)'
      : '';
  return `  actual video: ${media.width}×${media.height}, ${sec(media.duration)} as encoded${authored}, ${sound}${draft}`;
}
function checkLine(job: JobView): string | null {
  if (!job.result?.errors) return null;
  const errors = job.result.errors,
    detail = errors.length ? `: ${errors.slice(0, 6).join('; ')}` : '';
  return `  check: ${errors.length} errors, ${job.result.warnings?.length ?? 0} warnings${detail}`;
}
function jobDescription(job: JobView, verdict: string | undefined): string {
  const progress =
    job.progress != null && job.status === 'running'
      ? ` ${Math.round(job.progress * 100)}%`
      : '';
  return [
    `${job.label} (job ${job.id}): ${job.status}${progress}`,
    outputLine(job),
    mediaLine(job),
    job.errors?.length ? `  engine errors: ${job.errors.join('; ')}` : null,
    job.status === 'failed' && !job.errors?.length
      ? `  log: ${clip(job.log?.slice(-1200), 1200)}`
      : null,
    checkLine(job),
    verdict ?? null,
  ]
    .filter(Boolean)
    .join('\n');
}
function lookDescription(
  job: JobView,
  shot: Awaited<ReturnType<typeof lookImage>>,
  scope: string,
  phone: boolean,
): string {
  const device = phone ? ', drawn 360 px wide as a phone shows it' : '';
  if (!shot.times)
    return `${job.label} (job ${job.id}), ${shot.size.join('×')}${device}.`;
  const times = shot.times.map((time) => `${time}s`).join(', ');
  return `A motion sheet of ${job.label} (job ${job.id}), ${scope}: ${shot.times.length} frames in reading order (left to right, then down), each the first frame at or after ${times} of that video${device}.`;
}

const videoSeconds = (v: unknown) => {
  if (v == null) return null;
  const x = Number(v);
  if (!Number.isFinite(x)) throw fail('from and to are video seconds.');
  return x;
};
function lookRange(
  input: ToolInput,
  made: NonNullable<ReturnType<typeof renderedFile>>,
) {
  let from = videoSeconds(input.from),
    to = videoSeconds(input.to),
    scope = 'the whole render';
  if (input.beat) {
    // The scene's seconds in the video come from the timeline that render was made from, never the
    // working copy (which may have changed since).
    let beats: typeof timelineSchema.Type.beats | null = null;
    try {
      beats = made.timeline
        ? Schema.decodeUnknownSync(timelineSchema)(
            JSON.parse(fs.readFileSync(made.timeline, 'utf8')),
          ).beats
        : null;
    } catch {}
    if (!beats)
      throw fail(
        "beat works on a saved rough cut or final (it reads that render's own timeline); for a still or section, look at the whole render.",
      );
    const bt = beats.find((x) => x.id === input.beat);
    if (!bt)
      throw fail(
        `That render has no scene ${input.beat}. Its scenes: ${beats.map((x) => x.id).join(', ')}.`,
      );
    [from, to, scope] = [
      bt.start,
      bt.end,
      `scene ${input.beat} (${bt.start.toFixed(2)}–${bt.end.toFixed(2)} s in that render)`,
    ];
  } else if (from != null || to != null)
    scope = `${from ?? 0}–${to ?? 'end'} s`;
  return { from, to, scope };
}

export function createRenderTools({
  base,
  jobs,
  filmOf,
}: ToolOptions): ToolHandlers {
  const filmId = (dir: string) => filmOf(dir)?.id;
  const verdicts = new Map<string, string>();
  return {
    render({ dir, input }) {
      if (
        !input.kind ||
        !isJobKind(input.kind) ||
        !['still', 'section', 'check', 'draft', 'captions'].includes(
          input.kind ?? '',
        )
      )
        throw fail('Render a still, section, check, draft or captions.');
      const body: Types.Mutable<JobRequest> = {
        film: filmId(dir),
        kind: input.kind,
      };
      if (input.requestKey != null) body.requestKey = input.requestKey;
      if (input.kind === 'still')
        Object.assign(
          body,
          input.beat
            ? { beat: input.beat, pos: input.pos ?? 0.6 }
            : { at: input.at },
        );
      if (input.kind === 'section')
        Object.assign(body, { beats: input.beats, handles: 0.5 });
      if (input.kind === 'captions') body.draft = true;
      // A rough cut is the first look: declared placeholders render as labelled slates (draft --rough).
      if (input.kind === 'draft') body.rough = true;
      const r = jobs.start(dir, body);
      const j = r.job ?? jobs.list(body.film).find((x) => x.id === r.id);
      let status = r.duplicate
        ? `Existing job (${j?.status ?? 'saved'})`
        : 'Queued';
      if (r.cached) status = 'Already rendered for this exact version';
      return {
        content: `${status}: ${j?.label ?? input.kind} (job ${r.id}). The person can watch or cancel it in the studio; follow it with clearframe_job.`,
        metadata: {
          summary: `${j?.label ?? input.kind}${r.cached ? ' (cached)' : ''}`,
          job: r.id,
        },
      };
    },

    async job({ dir, input }) {
      const film = filmId(dir),
        until =
          Date.now() +
          Math.min(90, Math.max(0, Number(input.wait) || 0)) * 1000;
      const pick = () => pickJobs(jobs, film, input.id);
      let list = pick();
      if (input.id && !list.length) throw fail('No such job for this film.');
      while (input.id && Date.now() < until && !TERMINAL.has(list[0].status)) {
        await new Promise((r) => setTimeout(r, 1000));
        list = pick();
      }
      // Without the verdict, the in-page agent saw "complete" and handed over a film that sat
      // still under the voice for more than half its length.
      for (const j of list)
        if (
          j.kind === 'draft' &&
          j.status === 'complete' &&
          j.matches !== false &&
          !verdicts.has(j.id)
        ) {
          try {
            const made = renderedFile(j, { base, dir });
            if (made) {
              const { qaProject, motionVerdict } = await import('../qa.mjs');
              verdicts.set(
                j.id,
                motionVerdict(
                  dir,
                  await qaProject(dir, { video: made.file }),
                ).lines.join('\n'),
              );
            }
          } catch (e) {
            verdicts.set(
              j.id,
              `motion: not measured (${errorMessage(e).split('\n')[0]})`,
            );
          }
        }
      return {
        content:
          list
            .map((job) => jobDescription(job, verdicts.get(job.id)))
            .join('\n') || 'No render jobs yet for this film.',
        metadata: {
          summary:
            list.length === 1
              ? `${list[0].label}: ${list[0].status}`
              : `${list.length} jobs`,
          job: input.id ?? null,
        },
      };
    },

    // A bounded look at a finished render, so the agent judges the picture itself: one image per call.
    async look({ dir, input }) {
      const film = filmId(dir);
      const done = jobs
        .list(film)
        .filter(
          (j) =>
            j.status === 'complete' &&
            ['still', 'section', 'draft', 'final'].includes(j.kind),
        );
      const j = input.job ? done.find((x) => x.id === input.job) : done.at(-1);
      if (!j)
        throw fail(
          input.job
            ? `No finished still, section or draft with job id ${input.job}.`
            : 'Nothing rendered to look at yet: queue a still, section or draft with clearframe_render and follow it with clearframe_job.',
        );
      const made = renderedFile(j, { base, dir });
      if (!made)
        throw fail(
          `Job ${j.id} has no render of this film on disk (it was cleared, or it is not this film's); render it again.`,
        );
      const { from, to, scope } = lookRange(input, made);
      const phone = !!input.phone,
        frames = Number(input.frames) || 8;
      const key = crypto
        .createHash('sha1')
        .update(
          JSON.stringify([
            j.id,
            made.file,
            fs.statSync(made.file).mtimeMs,
            from,
            to,
            phone,
            frames,
          ]),
        )
        .digest('hex')
        .slice(0, 16);
      let shot;
      try {
        shot = await lookImage(made.file, {
          dir,
          key,
          frames,
          from,
          to,
          phone,
        });
      } catch (e) {
        throw fail(
          `Could not make a picture of job ${j.id}: ${clip(errorMessage(e), 300)}`,
        );
      }
      const bytes = fs.readFileSync(shot.out);
      if (bytes.length > 900_000)
        throw fail(
          'That picture is too large to send; look at fewer frames or one scene.',
        );
      const what = lookDescription(j, shot, scope, phone);
      return {
        content: [
          what,
          j.matches === false
            ? 'It was rendered from an earlier version of the film: re-render before judging recent edits.'
            : null,
          'The image is attached. Judge what the engine cannot: the hierarchy of type and shapes, where the eye goes, whether the motion carries the idea from frame to frame, and whether words read at this size. If your model cannot see attached images, say so and rely on clearframe_render check.',
        ]
          .filter(Boolean)
          .join('\n'),
        images: [
          {
            mime: 'image/jpeg',
            name: `look-${j.id}.jpg`,
            data: bytes.toString('base64'),
          },
        ],
        metadata: {
          summary: `Looked at ${j.label}${shot.times ? ` (${shot.times.length} frames)` : ''}`,
          job: j.id,
        },
      };
    },
  };
}
