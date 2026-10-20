// A project's link to its one OpenCode conversation, and the ledger of what the person sent.
// Kept in the project (review/agent.json) so the link travels with the film and survives restarts.
// It holds ids and the person's own words only: never endpoints, passwords or tokens.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { reviewPath } from '../store.mjs';
import * as Schema from 'effect/Schema';
import { ScopeSchema, type ConversationLink } from './contracts.mjs';
import { errorMessage, errorCode } from '../harness/contracts.mjs';
const modelSchema = Schema.Struct({
  providerID: Schema.String,
  id: Schema.String,
});
const submissionSchema = Schema.Struct({
  id: Schema.String,
  text: Schema.String,
  scope: ScopeSchema,
  delivery: Schema.Literals(['steer', 'queue']),
  hash: Schema.NullOr(Schema.String),
  revision: Schema.NullOr(Schema.String),
  t: Schema.NullOr(Schema.Number),
  at: Schema.String,
  state: Schema.Literals(['sending', 'sent', 'failed']),
  error: Schema.optionalKey(Schema.String),
});
const spendSchema = Schema.Struct({
  id: Schema.String,
  kind: Schema.Literals(['voice', 'music']),
  estimate: Schema.Number,
  detail: Schema.optionalKey(Schema.String),
  reason: Schema.String,
  at: Schema.String,
  state: Schema.Literals(['pending', 'approved', 'declined']),
  job: Schema.optionalKey(Schema.String),
  approved: Schema.optionalKey(Schema.Number),
  by: Schema.optionalKey(Schema.String),
  answeredAt: Schema.optionalKey(Schema.String),
});
const linkSchema = Schema.Struct({
  sessionID: Schema.optionalKey(Schema.NullOr(Schema.String)),
  model: Schema.optionalKey(Schema.NullOr(modelSchema)),
  previous: Schema.optionalKey(
    Schema.Array(
      Schema.Struct({
        sessionID: Schema.NullOr(Schema.String),
        lostAt: Schema.String,
      }),
    ),
  ),
  submissions: Schema.optionalKey(Schema.Array(submissionSchema)),
  spend: Schema.optionalKey(Schema.Array(spendSchema)),
  mode: Schema.optionalKey(Schema.Literals(['oneshot', 'together'])),
  createdBy: Schema.optionalKey(Schema.String),
  createdAt: Schema.optionalKey(Schema.String),
  updatedAt: Schema.optionalKey(Schema.String),
});

const KEEP = 200;
export const linkFile = (dir: string) => reviewPath(dir, 'agent.json');
const atomic = (file: string, data: string) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, file);
};

export function readLink(dir: string): ConversationLink {
  let text;
  try {
    text = fs.readFileSync(linkFile(dir), 'utf8');
  } catch (error) {
    if (errorCode(error) !== 'ENOENT') throw error;
    return { sessionID: null, model: null, previous: [], submissions: [] };
  }
  let l;
  try {
    l = Schema.decodeUnknownSync(linkSchema)(JSON.parse(text));
  } catch (error) {
    throw new Error(
      `Cannot read the saved conversation at ${linkFile(dir)}: ${errorMessage(error)}. Restore or repair it before continuing; it has not been overwritten.`,
      { cause: error },
    );
  }
  return {
    ...l,
    sessionID: l.sessionID ?? null,
    model: l.model ?? null,
    previous: [...(l.previous ?? [])],
    submissions: [...(l.submissions ?? [])],
    spend: l.spend ? [...l.spend] : undefined,
  };
}
/** Read, change and write the link in one synchronous step (the server is the only writer). */
export function updateLink(
  dir: string,
  fn: (link: ConversationLink) => ConversationLink | void,
) {
  const l = readLink(dir);
  const out = fn(l) ?? l;
  out.submissions = (out.submissions ?? []).slice(-KEEP);
  out.updatedAt = new Date().toISOString();
  atomic(linkFile(dir), JSON.stringify(out, null, 2) + '\n');
  return out;
}

/** OpenCode accepts a caller-chosen message id ("msg_…") and treats a repeat as the same prompt. */
export const SUBMISSION = /^msg_cf[a-z0-9]{20,40}$/;
export const checkSubmission = (id: unknown): string => {
  if (typeof id !== 'string' || !SUBMISSION.test(id))
    throw Object.assign(new Error('A message needs its submission id.'), {
      status: 400,
    });
  return id;
};

/** Every session id any project here links to, for resolving a tool call to its one project. */
export function sessionIndex(dirs: readonly string[]) {
  const index = new Map<string, string>();
  for (const dir of dirs) {
    const l = readLink(dir);
    if (l.sessionID) index.set(l.sessionID, dir);
  }
  return index;
}
