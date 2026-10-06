// A project's link to its one OpenCode conversation, and the ledger of what the person sent.
// Kept in the project (review/agent.json) so the link travels with the film and survives restarts.
// It holds ids and the person's own words only: never endpoints, passwords or tokens.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { reviewPath } from '../store.mjs';

const KEEP = 200;
export const linkFile = dir => reviewPath(dir, 'agent.json');
const atomic = (file, data) => { fs.mkdirSync(path.dirname(file), { recursive: true }); const tmp = `${file}.${crypto.randomUUID()}.tmp`; fs.writeFileSync(tmp, data); fs.renameSync(tmp, file); };

export function readLink(dir) {
  try {
    const l = JSON.parse(fs.readFileSync(linkFile(dir), 'utf8'));
    return { sessionID: null, model: null, previous: [], submissions: [], ...l };
  } catch { return { sessionID: null, model: null, previous: [], submissions: [] }; }
}
/** Read, change and write the link in one synchronous step (the server is the only writer). */
export function updateLink(dir, fn) {
  const l = readLink(dir);
  const out = fn(l) ?? l;
  out.submissions = (out.submissions ?? []).slice(-KEEP);
  out.updatedAt = new Date().toISOString();
  atomic(linkFile(dir), JSON.stringify(out, null, 2) + '\n');
  return out;
}

/** OpenCode accepts a caller-chosen message id ("msg_…") and treats a repeat as the same prompt. */
export const SUBMISSION = /^msg_cf[a-z0-9]{20,40}$/;
export const checkSubmission = id => { if (typeof id !== 'string' || !SUBMISSION.test(id)) throw Object.assign(new Error('A message needs its submission id.'), { status: 400 }); return id; };

/** Every session id any project here links to, for resolving a tool call to its one project. */
export function sessionIndex(dirs) {
  const index = new Map();
  for (const dir of dirs) { const l = readLink(dir); if (l.sessionID) index.set(l.sessionID, dir); }
  return index;
}
