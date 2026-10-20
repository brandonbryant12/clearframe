// Paid generation needs a person's explicit approval of an amount. The approval is checked against
// the current estimate, passed to the engine as its budget (which refuses anything costlier), and
// logged in review/spend.jsonl with who approved it. An agent can only ask (a spend request); the
// request waits in the conversation until the person approves or declines it.
import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
import { reviewPath } from '../store.mjs';
import {
  estimate,
  providers,
  soundState,
  basisOf,
  sameBasis,
} from './sound.mjs';
import { SOUND_GRANT } from './studio-jobs.mjs';
import { readLink, updateLink } from '../agent/links.mjs';
import * as Schema from 'effect/Schema';
import { readIntents, writeIntent, IntentSchema } from './spend-ledger.mjs';
import type { JobHarness, SoundGrant } from '../harness/jobs.mjs';
import type { SoundKind, JobView } from '../harness/contracts.mjs';
import { decodeStoryboard } from '../../schemas.mjs';
export interface SoundRequest {
  kind?: string;
  paid?: boolean;
  intent?: string;
  by?: string;
  basis?: unknown;
  force?: boolean;
  approve?: number;
}
export interface SoundStart {
  id: string;
  duplicate?: boolean;
  cached?: boolean;
  estimate?: number;
  approved?: number;
  job?: JobView;
}
const soundKind = (kind: unknown): SoundKind => {
  if (kind !== 'voice' && kind !== 'music')
    throw fail('Choose narration or music.');
  return kind;
};

const fail = (message: string, status = 400) =>
  Object.assign(new Error(message), { status });
const cents = (n: number) => Math.ceil(n * 100 - 1e-9) / 100;

export const INTENT = /^(intent|spend)-[a-z0-9-]{8,64}$/;
const grant = (
  kind: SoundKind,
  extra: Partial<SoundGrant> = {},
): SoundGrant => ({
  [SOUND_GRANT]: true,
  kind,
  paid: false,
  force: false,
  ...extra,
});

function spendBudget(dir: string, cost: number, approved: number): number {
  // The film budget (the storyboard's `budget`, set by a person) is a ceiling on every run, on top of each approval.
  const raw = decodeStoryboard(
      JSON.parse(fs.readFileSync(path.join(dir, 'storyboard.json'), 'utf8')),
    ),
    cap = raw.budget;
  if (cap != null && Number.isFinite(cap)) {
    if (cap <= 0)
      throw fail(
        'This film’s budget is $0, so paid generation is off. Raise the film budget (clearframe studio DIR set budget N) to allow it.',
        409,
      );
    if (cost > cap)
      throw fail(
        `The estimate ($${cents(cost).toFixed(2)}) is over this film’s budget ($${cap.toFixed(2)}). Raise the film budget to allow it.`,
        409,
      );
  }
  return cap != null && Number.isFinite(cap)
    ? Math.min(approved, cap)
    : approved;
}
function generationPrice(
  dir: string,
  kind: SoundKind,
  body: SoundRequest,
  now: ReturnType<typeof soundState>,
) {
  const e = estimate(dir, kind);
  const force = kind === 'music' && body.force === true;
  const price = providers()
    .music.find((p) => p.id === 'google')
    ?.models?.find(
      (m) => m.id === (!now.music.off ? now.music.model : null),
    )?.price;
  const cost = force && e.cost === 0 ? (price ?? 0) : e.cost;
  if (cost <= 0)
    throw fail(
      kind === 'voice'
        ? 'The Google narration already matches every line: nothing to generate.'
        : 'The Google music bed already matches this film. Choose “Generate a new bed” to replace it.',
      409,
    );
  return { force, cost };
}
function approveGeneration(dir: string, kind: SoundKind, body: SoundRequest) {
  const google = providers()[kind === 'voice' ? 'speech' : 'music'].find(
    (p) => p.id === 'google',
  );
  if (!google?.ready)
    throw fail(google?.needs ?? 'Google generation is not configured.', 409);
  const by = String(body.by ?? '')
    .trim()
    .slice(0, 80);
  if (!by)
    throw fail('A paid generation records who approved it: enter your name.');
  const now = soundState(dir),
    basis = basisOf(dir, kind, now);
  if (!sameBasis(body.basis, basis))
    throw fail(
      'The film or its sound settings changed since you opened this approval. Review it again.',
      409,
    );
  const { force, cost } = generationPrice(dir, kind, body, now);
  const approved = Number(body.approve);
  if (!(Number.isFinite(approved) && approved >= cents(cost) && approved <= 50))
    throw fail(
      `The estimate is now $${cents(cost).toFixed(2)}; approve at least that amount.`,
      409,
    );
  const budget = spendBudget(dir, cost, approved);
  if (!basis.specs?.length)
    throw fail(
      'Could not work out exactly what would be generated; nothing was started.',
      409,
    );
  return { by, basis, force, cost, approved, budget };
}

/**
 * The one gate for narration and music. Free drafts start at once. Google generation needs:
 * a durable intent id (from the approval dialog, or the agent's request id), the person's name, the
 * basis they were shown (working copy, voice/style or direction, model, estimate) still matching
 * now, an approved amount covering today's price, and no other Google job of that kind running.
 * The intent is consumed once: a retry, double-click or lost reply returns the job it already
 * started. Everything here is synchronous, so two requests in this server never interleave.
 */
export function startSound(
  dir: string,
  film: string | undefined,
  jobs: JobHarness,
  body: SoundRequest,
): SoundStart {
  const kind = soundKind(body.kind);
  if (!['voice', 'music'].includes(kind))
    throw fail('Choose narration or music.');
  if (!body.paid) {
    // A free draft never replaces Google work (the engine keeps unchanged Google takes and beds); a
    // second click while one is queued or running follows that one.
    estimate(dir, kind);
    const twin = jobs
      .list(film)
      .find(
        (j) =>
          j.kind === kind &&
          !j.paid &&
          ['queued', 'waiting', 'running'].includes(j.status),
      );
    return twin
      ? { id: twin.id, duplicate: true }
      : jobs.start(dir, { film, kind }, grant(kind));
  }
  const intent =
    typeof body.intent === 'string' && INTENT.test(body.intent)
      ? body.intent
      : null;
  if (!intent)
    throw fail(
      'A paid generation needs the approval it belongs to; open the approval again.',
    );
  const seen = readIntents(dir)[intent];
  if (seen) {
    if (seen.kind !== kind)
      throw fail('That approval was for something else.', 409);
    return {
      id: seen.job,
      duplicate: true,
      estimate: seen.estimate,
      approved: seen.approved,
    };
  }
  const { by, basis, force, cost, approved, budget } = approveGeneration(
    dir,
    kind,
    body,
  );
  if (
    jobs
      .list(film)
      .some(
        (j) =>
          j.kind === kind &&
          j.paid &&
          ['queued', 'waiting', 'running'].includes(j.status),
      )
  )
    throw fail(
      `Google ${kind === 'voice' ? 'narration' : 'music'} is already being generated for this film.`,
      409,
    );
  const approval = { intent, by, approved, budget, estimate: cost, basis };
  const r = jobs.start(
    dir,
    { film, kind },
    grant(kind, { paid: true, budget, force, approval }),
  );
  writeIntent(dir, intent, {
    kind,
    job: r.id,
    by,
    approved,
    estimate: cost,
    basis,
    at: new Date().toISOString(),
  });
  fs.appendFileSync(
    reviewPath(dir, 'spend.jsonl'),
    JSON.stringify({
      at: new Date().toISOString(),
      kind,
      provider: 'google',
      estimate: cost,
      approved,
      by,
      job: r.id,
      intent,
      request: intent.startsWith('spend-') ? intent : null,
      basis,
    }) + '\n',
  );
  return { ...r, estimate: cost, approved };
}

export function spendLog(dir: string) {
  try {
    return fs
      .readFileSync(reviewPath(dir, 'spend.jsonl'), 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((l) => Schema.decodeUnknownSync(IntentSchema)(JSON.parse(l)));
  } catch {
    return [];
  }
}

/** An agent's request to spend: recorded with today's estimate; nothing runs until a person approves it. */
export function requestSpend(
  dir: string,
  { kind: inputKind, reason }: { kind?: string; reason?: string },
) {
  const kind = soundKind(inputKind),
    e = estimate(dir, kind);
  if (e.cost <= 0)
    return {
      id: null,
      estimate: 0,
      note: 'Nothing to generate: it is already up to date.',
    };
  const id = `spend-${crypto.randomUUID().slice(0, 13)}`;
  updateLink(dir, (l) => {
    l.spend = [
      ...(l.spend ?? []).filter((s) =>
        s.state === 'pending' ? s.kind !== kind : true,
      ),
      {
        id,
        kind,
        estimate: e.cost,
        detail: e.detail,
        reason: String(reason ?? '').slice(0, 400),
        at: new Date().toISOString(),
        state: 'pending' as const,
      },
    ].slice(-30);
  });
  return { id, estimate: e.cost, detail: e.detail };
}
export const spendRequests = (dir: string) => readLink(dir).spend ?? [];

/** The person's answer to an agent's request. Approval starts the paid job through startSound. */
export function answerSpend(
  dir: string,
  film: string | undefined,
  jobs: JobHarness,
  {
    id,
    decision,
    by,
    approve,
    basis,
  }: {
    id: string;
    decision: string;
    by?: string;
    approve?: number;
    basis?: unknown;
  },
) {
  const req = spendRequests(dir).find((s) => s.id === id);
  if (req?.state === 'approved' && decision === 'approve')
    return { id: req.job, duplicate: true, approved: req.approved };
  if (!req || req.state !== 'pending')
    throw fail('That request was already answered.', 409);
  if (decision === 'decline') {
    updateLink(dir, (l) => {
      const s = l.spend?.find((x) => x.id === id);
      if (!s) throw fail('That request no longer exists.', 409);
      s.state = 'declined';
      s.by = String(by ?? '').slice(0, 80);
      s.answeredAt = new Date().toISOString();
    });
    return { ok: true };
  }
  if (decision !== 'approve') throw fail('Approve or decline.');
  const r = startSound(dir, film, jobs, {
    kind: req.kind,
    paid: true,
    by,
    approve,
    intent: id,
    basis,
  });
  updateLink(dir, (l) => {
    const s = l.spend?.find((x) => x.id === id);
    if (!s) throw fail('That request no longer exists.', 409);
    s.state = 'approved';
    s.by = String(by).slice(0, 80);
    s.job = r.id;
    s.approved = r.approved;
    s.answeredAt = new Date().toISOString();
  });
  return r;
}
