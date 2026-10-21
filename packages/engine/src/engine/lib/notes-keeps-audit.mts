import { protectedSource } from './targets.mjs';

import { readJSONFile, reviewPath } from './store.mjs';
import { decodeStoryboard } from '../schemas.mjs';

import { readKeeps, type Keep } from './notes-model.mjs';

import type { Timeline } from './revisions.mjs';

import type { Storyboard } from '../domain.mjs';
import type { KeepViolation } from './notes-keeps-contracts.mjs';
import { KeepCheck } from './notes-keeps-check.mjs';

export function keepStoryboard(root: string, k: Keep): Storyboard | null {
  if (k.what !== 'facts') return null;
  const raw = readJSONFile(
    reviewPath(root, 'revisions', k.revision, 'storyboard.json'),
    null,
  );
  return raw == null ? null : decodeStoryboard(raw);
}

/**
 * Keeps broken by going from the keep's revision to `timeline` (a candidate or the working
 * copy). For beats of an imported recording, `voice` and `words` are judged by what the keep's
 * revision played (transcript words and recording spans), whatever those beats are called now
 * after splits or merges: `words` breaks when any protected word no longer plays; `voice` when
 * any protected recording no longer plays, unless the person had it cut, and when the audio
 * itself is not that recording: the master must be the file the keep's revision played (and
 * match its record), and every beat playing protected recording must hold exactly the samples
 * its metadata declares from it. Other keeps, and narration that is not a recording, follow
 * the beats through lineage.
 */
export function checkKeeps(
  root: string,
  timeline: Timeline,
  { overrides = [] }: { overrides?: string[] } = {},
): KeepViolation[] {
  const check = new KeepCheck(root, timeline);
  for (const k of readKeeps(root).filter(
    (x) => x.active && !overrides.includes(x.id),
  )) {
    // Facts are re-read from the keep's own revision with today's rule, so a keep made under an
    // older fingerprint scheme is still judged on what the beat showed.
    const sbK = keepStoryboard(root, k);
    if (k.what === 'look') {
      check.look(k);
      continue;
    }
    const scopeBeats = k.scope.film ? null : (k.scope.beats ?? null);
    const prot = ['voice', 'words'].includes(k.what)
      ? protectedSource(root, k.revision, scopeBeats)
      : {};
    if (Object.keys(prot).length && k.what === 'words') check.words(k, prot);
    else if (Object.keys(prot).length) check.voice(k, prot);
    check.beats(k, prot, sbK);
  }
  return check.violations;
}
