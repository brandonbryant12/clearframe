import fs from 'node:fs';
import path from 'node:path';
import { loadRevision, type Timeline } from './revisions.mjs';
import { checkId, nextId, reviewPath, withLock } from './store.mjs';

import {
  readDecisions,
  readNotes,
  type Decision,
  type DecisionPrint,
} from './notes-model.mjs';

export interface DecisionRequest {
  action: string;
  role: string;
  by?: unknown;
  said?: unknown;
  reason?: unknown;
  revision: string;
  scope?: {
    note?: string;
    beats?: string[];
    checkpoint?: string;
    keep?: string;
  };
}

function checkDecision({
  action,
  role,
  by,
  said,
  revision,
}: DecisionRequest): void {
  if (!['accept', 'reject', 'decide', 'override', 'restore'].includes(action))
    throw new Error(`Unknown decision ${action}`);
  checkId('revision', revision);
  if (['accept', 'reject', 'override'].includes(action)) {
    if (role !== 'human')
      throw new Error(
        `${action} records a person's decision: pass --by NAME and --said "their words". Agents use decide.`,
      );
    if (!by || !String(said ?? '').trim())
      throw new Error(
        `${action} needs --by NAME and --said "what they said", so the decision is attributable.`,
      );
  }
  if (action === 'decide' && role !== 'agent')
    throw new Error('decide records an agent decision.');
}

/**
 * accept/reject: a person's verdict on a revision (or one note's result, or some beats), with
 * their name and their words. decide: an agent's call in one-shot work, labelled as such.
 */
export function addDecision(root: string, request: DecisionRequest): Decision {
  checkDecision(request);
  const { action, role, by, said, reason, revision, scope = {} } = request;
  const { meta, timeline } = loadRevision(root, revision);
  const beats =
    scope.beats ??
    (scope.note
      ? (readNotes(root).find((n) => n.id === scope.note)?.anchor?.beats ??
        null)
      : null);
  if (scope.note) checkId('note', scope.note);
  const prints: Record<string, DecisionPrint> = Object.fromEntries(
    timeline.beats
      .filter((b) => !beats || beats.includes(b.id))
      .map((b): [string, DecisionPrint] => [
        b.id,
        {
          authored: b.prints.authored,
          rendered: b.prints.rendered,
          start: b.start,
        },
      ]),
  );
  return withLock(root, () => {
    const list = readDecisions(root);
    const d: Decision = {
      id: nextId(
        'd',
        list.map((x) => x.id),
      ),
      at: new Date().toISOString(),
      action,
      role,
      ...(by ? { by: String(by).slice(0, 80) } : {}),
      ...(said ? { said: String(said).slice(0, 1000) } : {}),
      ...(reason ? { reason: String(reason).slice(0, 1000) } : {}),
      revision,
      contentId: meta.contentId,
      // What was on screen when the decision was made: the revision's kept encodes.
      videos: (meta.videos ?? [])
        .filter((v) => v.retained !== false)
        .map((v) => ({ profile: v.profile, sha256: v.sha256 })),
      scope: { ...scope, ...(beats ? { beats } : {}) },
      film: timeline.film.look,
      prints,
    };
    const file = reviewPath(root, 'decisions.jsonl');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, JSON.stringify(d) + '\n');
    return d;
  });
}

export type AcceptanceState =
  | 'accepted'
  | 'moved'
  | 'looks-different'
  | 'changed';
export interface Acceptance {
  decision: string;
  revision: string;
  by?: string;
  state: AcceptanceState;
}

function acceptanceState(
  p: DecisionPrint,
  b: Timeline['beats'][number],
): AcceptanceState {
  if (p.authored !== b.prints.authored) return 'changed';
  if (p.rendered !== b.prints.rendered) return 'looks-different';
  return Math.abs(p.start - b.start) > 1e-3 ? 'moved' : 'accepted';
}

/**
 * Does a person's acceptance still hold for each beat of `timeline`? accepted (same content,
 * same place), moved (same content, new time: it stands), looks-different (a neighbour or the
 * film changed how it renders: quick look), changed (its own content changed: review again).
 */
export function acceptance(root: string, timeline: Timeline): AcceptanceLedger {
  const out: Record<string, Acceptance> = {};
  const verdicts = readDecisions(root).filter(
    (d) => ['accept', 'reject'].includes(d.action) && d.role === 'human',
  );
  for (const b of timeline.beats) {
    const d = [...verdicts]
      .reverse()
      .find((x) => x.action === 'accept' && x.prints?.[b.id]);
    const p = d?.prints?.[b.id];
    if (!d || !p) continue;
    // Rejecting the same revision afterwards takes the acceptance back for the beats it covered.
    if (
      verdicts.some(
        (x) =>
          x.action === 'reject' &&
          x.revision === d.revision &&
          x.prints?.[b.id] &&
          Date.parse(x.at) >= Date.parse(d.at),
      )
    )
      continue;
    out[b.id] = {
      decision: d.id,
      revision: d.revision,
      by: d.by,
      state: acceptanceState(p, b),
    };
  }
  return out;
}

export interface AcceptanceLedger {
  [beat: string]: Acceptance;
}
