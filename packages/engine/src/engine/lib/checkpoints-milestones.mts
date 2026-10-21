import type { Decision } from './notes-model.mjs';
import type { Milestone } from './checkpoints-contracts.mjs';
import { errorMessage } from './errors.mjs';
import fs from 'node:fs';
import path from 'node:path';

import { listRevisions, workingContent } from './revisions.mjs';
import { readDecisions, readNotes } from './notes.mjs';
import { sha256File } from './store.mjs';

// A decision about a whole cut (not one note's result or some beats), for this checkpoint.
const wholeCut = (d: Decision, checkpoint: string): boolean =>
  !d.scope?.note &&
  !d.scope?.beats &&
  (!d.scope?.checkpoint || d.scope.checkpoint === checkpoint);
const newest = (list: Decision[]): Decision | null =>
  [...list].sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1) ?? null;

/**
 * The rough-cut look happened when the person steered a rough or draft cut: their notes on it,
 * or their acceptance of the whole cut (a later rejection of it takes that back). In one-shot
 * work an agent decision for this checkpoint stands in, labelled as such.
 */
export function roughMilestone(root: string, { mode }: { mode: string }) {
  const watched = listRevisions(root).filter((r) =>
    (r.videos ?? []).some((v) => ['rough', 'draft'].includes(v.profile ?? '')),
  );
  const ids = new Set(watched.map((r) => r.id));
  const ds = readDecisions(root).filter((d) => ids.has(d.revision));
  const verdict = newest(
    ds.filter(
      (d) =>
        d.role === 'human' &&
        ['accept', 'reject'].includes(d.action) &&
        wholeCut(d, 'rough'),
    ),
  );
  const agent = newest(
    ds.filter(
      (d) =>
        d.role === 'agent' &&
        d.action === 'decide' &&
        d.scope?.checkpoint === 'rough',
    ),
  );
  const notes = readNotes(root).filter(
    (n) => n.author?.role === 'human' && ids.has(n.revision),
  );
  const human = verdict?.action === 'accept' ? verdict : null;
  const closed =
    !!human ||
    notes.length > 0 ||
    (mode === 'one-shot' && !!agent && verdict?.action !== 'reject');
  return {
    latest: watched.at(-1) ?? null,
    human,
    agent,
    verdict,
    notes,
    closed,
  };
}

/**
 * Final is closed only for the film as it is now: a final encode of exactly the current content
 * (same inputs, renderer and fonts as the working copy, so an audio-only change reopens it),
 * that encode being build/video.mp4, and a decision about that whole cut and that encode — a
 * person's acceptance (a later rejection reopens it), or in one-shot work an agent decision for
 * the final. Acceptance of an earlier cut, of one note's result or of some beats never counts.
 */
export function finalMilestone(
  root: string,
  { mode = 'guided' }: { mode?: string } = {},
): Milestone {
  const finals = listRevisions(root).filter((r) =>
    (r.videos ?? []).some((v) => v.profile === 'final'),
  );
  if (!finals.length)
    return { state: 'none', closed: false, detail: 'not rendered' };
  let working;
  try {
    working = workingContent(root);
  } catch (e) {
    return {
      state: 'broken',
      closed: false,
      detail: `the working copy does not prepare (${errorMessage(e).split('\n')[0]})`,
    };
  }
  const rev = [...finals]
    .reverse()
    .find((r) => r.contentId === working.contentId);
  if (!rev)
    return {
      state: 'stale',
      closed: false,
      detail: `the film changed since the last final render (${finals.at(-1)?.id})`,
    };
  const video = [...(rev.videos ?? [])]
    .reverse()
    .find((v) => v.profile === 'final');
  if (!video) return { state: 'none', closed: false, detail: 'not rendered' };
  const file = path.join(root, 'build', 'video.mp4');
  if (!(fs.existsSync(file) && sha256File(file) === video.sha256))
    return {
      state: 'output',
      closed: false,
      revision: rev.id,
      detail: `build/video.mp4 is not ${rev.id}'s final encode (render the final again)`,
    };
  const ds = readDecisions(root).filter(
    (d) => d.revision === rev.id || d.contentId === rev.contentId,
  );
  // A decision recorded before decisions named their encode counts only if it came after it.
  const sawIt = (d: Decision) =>
    d.videos
      ? d.videos.some((v) => v.sha256 === video.sha256)
      : Date.parse(d.at) >= Date.parse(video.renderedAt ?? '');
  const verdict = newest(
    ds.filter(
      (d) =>
        d.role === 'human' &&
        ['accept', 'reject'].includes(d.action) &&
        wholeCut(d, 'final') &&
        sawIt(d),
    ),
  );
  const agent = newest(
    ds.filter(
      (d) =>
        d.role === 'agent' &&
        d.action === 'decide' &&
        d.scope?.checkpoint === 'final' &&
        sawIt(d),
    ),
  );
  const human = verdict?.action === 'accept' ? verdict : null;
  const closed =
    !!human || (mode === 'one-shot' && !!agent && verdict?.action !== 'reject');
  const detail = finalDetail(rev.id, mode, verdict, human, agent);
  return {
    state: 'current',
    closed,
    revision: rev.id,
    video: video.sha256,
    human,
    agent,
    verdict,
    detail,
  };
}

function finalDetail(
  id: string,
  mode: string,
  verdict: Decision | null,
  human: Decision | null,
  agent: Decision | null,
): string {
  if (verdict?.action === 'reject')
    return `final ${id} was rejected by ${verdict.by} (${verdict.id})`;
  if (human)
    return `final ${id} is current; accepted by ${human.by} (${human.id})`;
  if (agent)
    return `final ${id} is current; decided by the agent (${agent.id}), not a person's acceptance${mode === 'one-shot' ? '' : ' (guided work needs the person)'}`;
  return `final ${id} is current; not accepted yet (applied is not accepted)`;
}
