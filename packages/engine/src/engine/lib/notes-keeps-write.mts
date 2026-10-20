import { listRevisions, loadRevision, type Timeline } from './revisions.mjs';
import { checkId, nextId, withLock } from './store.mjs';

import {
  KEEPS,
  readKeeps,
  writeKeeps,
  type Author,
  type BeatBaseline,
  type Keep,
} from './notes-model.mjs';
import { keysOf } from './notes-locate.mjs';

import type { KeepRequest } from './notes-keeps-contracts.mjs';

/** What a keep holds still, read from the revision it was made against. */
export function baselineOf(
  timeline: Timeline,
  what: string,
  beats: string[] | null,
): Keep['baseline'] {
  if (what === 'look') return { look: timeline.film.look };
  const out: Record<string, BeatBaseline> = {};
  for (const b of timeline.beats.filter((x) => !beats || beats.includes(x.id)))
    out[b.id] = {
      voice: b.prints.voice,
      audio: b.prints.audio,
      words: keysOf(b.vo?.text ?? '').join(' '),
      facts: b.prints.facts,
      picture: b.prints.picture,
      removals: (b.source?.removed ?? []).map((r) => r.id),
    };
  return out;
}

export function addKeep(
  root: string,
  { what, beats, film, revision, by, said, note }: KeepRequest,
): Keep {
  if (!KEEPS.includes(what))
    throw new Error(`keep must be ${KEEPS.join(', ')}`);
  if (!by?.role) throw new Error('A keep records who asked for it.');
  const author = by;
  const rev = revision ?? listRevisions(root).at(-1)?.id;
  if (!rev)
    throw new Error('No revision yet: render a draft or run snapshot first.');
  const { timeline } = loadRevision(root, rev);
  const scopeBeats = what === 'look' || film ? null : (beats ?? null);
  if (scopeBeats)
    for (const id of scopeBeats)
      if (!timeline.beats.some((b) => b.id === id))
        throw new Error(`No beat ${id} in ${rev}.`);
  return withLock(root, () => {
    const keeps = readKeeps(root);
    const keep: Keep = {
      id: nextId(
        'k',
        keeps.map((k) => k.id),
      ),
      what,
      scope: scopeBeats ? { beats: scopeBeats } : { film: true },
      revision: rev,
      by: author,
      ...(said ? { said: String(said).slice(0, 500) } : {}),
      ...(note ? { note } : {}),
      createdAt: new Date().toISOString(),
      active: true,
      baseline: baselineOf(timeline, what, scopeBeats),
    };
    keeps.push(keep);
    writeKeeps(root, keeps);
    return keep;
  });
}

export function releaseKeep(
  root: string,
  id: string,
  { by, said }: { by?: Author | null; said?: string },
): Keep {
  checkId('keep', id);
  if (by?.role !== 'human')
    throw new Error(
      'Only the person who can ask for a keep can release it: pass --by NAME.',
    );
  const releasedBy = by;
  return withLock(root, () => {
    const keeps = readKeeps(root);
    const k = keeps.find((x) => x.id === id);
    if (!k) throw new Error(`No keep ${id}.`);
    Object.assign(k, {
      active: false,
      releasedAt: new Date().toISOString(),
      releasedBy,
      ...(said ? { releaseSaid: said } : {}),
    });
    writeKeeps(root, keeps);
    return k;
  });
}
