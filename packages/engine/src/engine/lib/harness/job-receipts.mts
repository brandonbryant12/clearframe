import fs from 'node:fs';
import path from 'node:path';
import * as Schema from 'effect/Schema';
import type { HarnessJob } from './contracts.mjs';
import { probeMedia } from './job-inputs.mjs';

const text = Schema.optionalKey(Schema.String);
const list = Schema.optionalKey(Schema.mutable(Schema.Array(Schema.Unknown)));
const output = Schema.optionalKey(Schema.Struct({ output: text }));
const SectionReceipt = Schema.Struct({
  range: Schema.Struct({
    seconds: Schema.mutable(Schema.Array(Schema.Number)),
  }),
  verified: list,
  audio: Schema.optionalKey(Schema.Unknown),
});
const CheckReceipt = Schema.Struct({
  errors: list,
  warnings: list,
  craft: list,
});
const RevisionReceipt = Schema.Struct({
  revision: text,
  page: text,
  passages: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        beats: Schema.optionalKey(Schema.mutable(Schema.Array(Schema.String))),
        before: output,
        after: output,
      }),
    ),
  ),
});
const RejectionReceipt = Schema.Struct({
  restored: list,
  conflicts: list,
  now: Schema.optionalKey(Schema.Unknown),
  restorePoint: Schema.optionalKey(Schema.Unknown),
});
const RenderReceipt = Schema.Struct({
  duration: Schema.optionalKey(Schema.Number),
  videos: Schema.optionalKey(Schema.Array(Schema.Struct({ object: text }))),
});
const mediaUrl = (base: string, file: string | null | undefined) =>
  file
    ? '/' +
      path
        .relative(base, path.resolve(base, file))
        .split(path.sep)
        .map(encodeURIComponent)
        .join('/')
    : null;
const loggedReceipt = (job: HarnessJob): unknown =>
  JSON.parse(job.log.slice(job.log.indexOf('{'), job.log.lastIndexOf('}') + 1));

function sectionResult(job: HarnessJob) {
  const receipt = Schema.decodeUnknownSync(SectionReceipt)(
    JSON.parse(fs.readFileSync(`${job.output}.json`, 'utf8')),
  );
  job.range = receipt.range.seconds;
  job.verified = !!receipt.verified?.length;
  job.hasAudio = !!receipt.audio;
}
function checkResult(job: HarnessJob) {
  const receipt = Schema.decodeUnknownSync(CheckReceipt)(loggedReceipt(job));
  job.result = {
    errors: receipt.errors ?? [],
    warnings: receipt.warnings ?? [],
    craft: receipt.craft ?? [],
  };
}
function revisionResult(job: HarnessJob, base: string) {
  const receipt = Schema.decodeUnknownSync(RevisionReceipt)(loggedReceipt(job));
  job.result = {
    revision: receipt.revision,
    page: mediaUrl(base, receipt.page),
    passages: (receipt.passages ?? []).map((p) => ({
      beats: p.beats,
      before: mediaUrl(base, p.before?.output),
      after: mediaUrl(base, p.after?.output),
    })),
  };
  job.revision = receipt.revision ?? null;
}
function rejectionResult(job: HarnessJob) {
  const receipt = Schema.decodeUnknownSync(RejectionReceipt)(
    loggedReceipt(job),
  );
  job.result = {
    restored: receipt.restored ?? [],
    conflicts: receipt.conflicts ?? [],
    now: receipt.now ?? null,
    restorePoint: receipt.restorePoint ?? null,
  };
}
function renderResult(job: HarnessJob, base: string) {
  job.revision = /revision"?:? "?(r\d{3,})/.exec(job.log)?.[1] ?? null;
  if (job.kind === 'final')
    job.url = mediaUrl(base, path.join(job.dir, 'build/video.mp4'));
  if (!job.revision) return;
  const receipt = Schema.decodeUnknownSync(RenderReceipt)(
    JSON.parse(
      fs.readFileSync(
        path.join(
          job.dir,
          'review',
          'revisions',
          job.revision,
          'revision.json',
        ),
        'utf8',
      ),
    ),
  );
  const video = receipt.videos?.at(-1);
  if (!video?.object) return;
  job.media = probeMedia(path.join(job.dir, video.object));
  if (job.media) job.media.authored = receipt.duration ?? null;
  job.url ??= mediaUrl(base, path.join(job.dir, video.object));
}

/** Optional command receipts enrich a completed job; missing older receipts keep the job usable. */
export function readJobReceipt(job: HarnessJob, base: string): void {
  try {
    switch (job.kind) {
      case 'section':
        sectionResult(job);
        break;
      case 'check':
        checkResult(job);
        break;
      case 'revise':
        revisionResult(job, base);
        break;
      case 'reject':
        rejectionResult(job);
        break;
      case 'draft':
      case 'final':
        renderResult(job, base);
        break;
    }
  } catch {
    /* A CLI version may omit optional receipts. */
  }
}
