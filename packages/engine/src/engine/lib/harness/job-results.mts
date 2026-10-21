import fs from 'node:fs';
import path from 'node:path';
import type { HarnessJob } from './contracts.mjs';
import type { HarnessContext } from './job-state.mjs';
import { hashOf, inputPrint, KINDS, keyOf, required } from './job-inputs.mjs';
import { approvedSoundSpecs } from '../generate.mjs';
import { readJobReceipt } from './job-receipts.mjs';
export function pin(j: HarnessJob) {
  let hash = null;
  try {
    hash = hashOf(j.dir);
  } catch {}
  const print = KINDS[j.kind].cache ? inputPrint(j.dir) : null;
  if (hash !== j.hash || (KINDS[j.kind].cache && print !== j.print)) {
    j.requestedHash ??= j.hash;
    j.repinned = true;
  }
  j.hash = hash;
  j.print = print;
  if (KINDS[j.kind].cache) j.key = print ? keyOf(j) : null;
}

export function approvalMatches(j: HarnessJob): boolean {
  if (!j.paid) return true;
  let now = null;
  try {
    if (j.kind !== 'voice' && j.kind !== 'music')
      throw new Error('Sound approval requires a voice or music job');
    now = approvedSoundSpecs(j.dir, j.kind);
  } catch {}
  if (
    JSON.stringify(now) !== JSON.stringify(j.approval?.basis?.specs ?? null)
  ) {
    j.status = 'failed';
    j.finishedAt = new Date().toISOString();
    j.errors = [
      `The ${j.kind === 'voice' ? 'narration' : 'music'} changed after it was approved, so nothing was generated or charged. Review and approve it again.`,
    ];
    j.log += `${j.errors[0]}\n`;
    return false;
  }
  return true;
}

export function finish(j: HarnessJob, { base, cache, prune }: HarnessContext) {
  let now = null;
  try {
    now = hashOf(j.dir);
  } catch {}
  // A preview is known to show its pinned inputs only if they held still from its start (including
  // any wait for the gate) to its end; an edit and its undo meanwhile leaves it uncertain.
  j.matches = KINDS[j.kind].cache
    ? !!j.print && now === j.hash && inputPrint(j.dir) === j.print
    : now === j.hash;
  if (j.output) {
    if (!fs.existsSync(j.output ?? ''))
      throw new Error('The job finished without its output.');
    j.url =
      '/' +
      path
        .relative(base, j.output)
        .split(path.sep)
        .map(encodeURIComponent)
        .join('/');
    j.cached = !!(j.matches && j.key);
    if (j.cached) cache.set(required(j.key, 'cache key'), j);
    prune();
  }
  readJobReceipt(j, base);
}
