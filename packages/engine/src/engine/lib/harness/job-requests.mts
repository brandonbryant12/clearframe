import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import * as Schema from 'effect/Schema';
import { checkId } from '../store.mjs';
import {
  SOUND_GRANT,
  isJobKind,
  type HarnessJob,
  type JobRequest,
  type SoundGrant,
} from './contracts.mjs';
import { hashOf, inputPrint, KINDS, keyOf, sha } from './job-inputs.mjs';
const jobStoryboard = Schema.Struct({
  beats: Schema.Array(
    Schema.Struct({
      id: Schema.String,
      placeholder: Schema.optionalKey(
        Schema.Union([
          Schema.Boolean,
          Schema.String,
          Schema.Struct({ text: Schema.String }),
        ]),
      ),
    }),
  ),
});
export function requestIdentity(body: JobRequest, grant: SoundGrant | null) {
  const { film, kind } = body;
  if (!isJobKind(kind)) throw new Error('Unknown studio job.');
  if (
    ['voice', 'music'].includes(kind) &&
    (!grant?.[SOUND_GRANT] || grant.kind !== kind)
  )
    throw Object.assign(
      new Error(
        'Narration and music are made through the sound endpoint, which checks approvals.',
      ),
      { status: 403 },
    );
  const requestKey =
    body.requestKey ?? (grant?.paid ? `sound:${grant.approval?.intent}` : null);
  // Derive retry identity from the caller's request before validating today's working copy.
  const requestFingerprint = sha(
    JSON.stringify([
      kind,
      film,
      body.hash ?? null,
      body.beat ?? null,
      body.pos ?? null,
      body.at ?? null,
      body.beats ?? null,
      body.handles ?? null,
      body.rough === true,
      body.draft !== false,
      body.note ?? null,
      body.revision ?? null,
      body.by ?? null,
      body.said ?? null,
      grant?.paid === true,
      grant?.force === true,
      grant?.budget ?? null,
      grant?.approval ?? null,
    ]),
  );
  return { requestKey, requestFingerprint };
}

type JobStoryboard = typeof jobStoryboard.Type;
function prepareStill(
  j: HarnessJob,
  body: JobRequest,
  sb: JobStoryboard,
  store: string,
) {
  if (body.beat != null) {
    if (!sb.beats.some((b) => b.id === body.beat))
      throw new Error('Choose a scene to preview.');
    j.beat = body.beat;
    j.pos = Math.min(0.98, Math.max(0, Number(body.pos ?? 0.6)));
  } else {
    j.at = Number(body.at);
    if (!(Number.isFinite(j.at) && j.at >= 0))
      throw new Error('Choose a moment to preview.');
  }
  j.key = j.print ? keyOf(j) : null;
  j.output = path.join(store, 'stills', `${j.id}.png`);
}

function prepareSection(
  j: HarnessJob,
  body: JobRequest,
  sb: JobStoryboard,
  store: string,
) {
  const beats = Array.isArray(body.beats) ? body.beats : [];
  if (!beats.length || beats.some((b) => !sb.beats.some((x) => x.id === b)))
    throw new Error('Choose the scenes to preview.');
  j.beats = beats;
  j.handles = Math.min(3, Math.max(0, Number(body.handles ?? 0.5)));
  j.key = j.print ? keyOf(j) : null;
  j.output = path.join(store, 'sections', `${j.id}.mp4`);
}

function prepareSound(j: HarnessJob, grant: SoundGrant | null) {
  if (!grant?.[SOUND_GRANT] || grant.kind !== j.kind)
    throw Object.assign(
      new Error(
        'Narration and music are made through the sound endpoint, which checks approvals.',
      ),
      { status: 403 },
    );
  j.paid = grant.paid === true;
  j.force = grant.force === true;
  if (j.paid) {
    // The gate checked a named approval covering today's estimate; the engine refuses past this budget.
    j.budget = Number(grant.budget);
    if (!(Number.isFinite(j.budget) && j.budget > 0 && j.budget <= 50))
      throw new Error(
        'A paid generation needs an approved budget between $0 and $50.',
      );
    j.approval = grant.approval;
  }
}

function prepareRejection(j: HarnessJob, body: JobRequest) {
  j.revision = checkId('revision', body.revision);
  if (body.note) j.note = checkId('note', body.note);
  j.by = String(body.by ?? '')
    .trim()
    .slice(0, 80);
  j.said = String(body.said ?? '')
    .trim()
    .slice(0, 1000);
  if (!j.by || !j.said)
    throw new Error('A rejection records who decided and what they said.');
}

export function prepareJob(
  dir: string,
  body: JobRequest,
  grant: SoundGrant | null,
  store: string,
): HarnessJob {
  const { film, kind } = body;
  const hash = hashOf(dir);
  if (body.hash != null && body.hash !== hash)
    throw Object.assign(
      new Error('Reload the changed working copy before rendering.'),
      { status: 409 },
    );
  const print = KINDS[kind].cache ? inputPrint(dir) : null;
  const sb = Schema.decodeUnknownSync(jobStoryboard)(
    JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')),
  );
  const rough = sb.beats.some((b) => b.placeholder) || body.rough === true;
  const id = crypto.randomUUID();
  const j: HarnessJob = {
    id,
    film,
    dir,
    kind,
    hash,
    print,
    rough,
    status: 'queued',
    log: '',
    createdAt: new Date().toISOString(),
  };
  switch (kind) {
    case 'still':
      prepareStill(j, body, sb, store);
      break;
    case 'section':
      prepareSection(j, body, sb, store);
      break;
    case 'voice':
    case 'music':
      prepareSound(j, grant);
      break;
    case 'captions':
      j.draft = body.draft !== false;
      break;
    case 'revise':
      j.note = checkId('note', body.note);
      break;
    case 'reject':
      prepareRejection(j, body);
      break;
  }
  j.label = KINDS[kind].label(j);
  return j;
}
