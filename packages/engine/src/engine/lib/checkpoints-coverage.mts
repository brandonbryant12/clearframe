import type { Beat } from '../domain.mjs';
import type { ChapterCoverage } from './checkpoints-contracts.mjs';

import { loadStoryboard } from './project.mjs';

import { listRevisions, loadRevision } from './revisions.mjs';
import { acceptance } from './notes.mjs';

/**
 * Progress by chapter, for showing a long film a chapter at a time while tracking the whole:
 * beats, declared placeholders, elements marked unfinished, beats with a picture beyond their
 * captions, and beats a person accepted (still accepted in the newest revision).
 */
export function coverage(root: string): ChapterCoverage[] {
  const sb = loadStoryboard(root);
  const latest = listRevisions(root).at(-1);
  const accepted = latest
    ? acceptance(root, loadRevision(root, latest.id).timeline)
    : {};
  const unfinished = (b: Beat) =>
    JSON.stringify([b.props?.elements ?? [], b.art ?? {}]).match(
      /"unfinished":/g,
    )?.length ?? 0;
  const out: ChapterCoverage[] = [];
  for (const b of sb.beats) {
    const name = b.chapter ?? 'Whole film';
    let c = out.find((x) => x.chapter === name);
    if (!c)
      out.push(
        (c = {
          chapter: name,
          beats: 0,
          placeholders: 0,
          unfinished: 0,
          pictured: 0,
          accepted: 0,
        }),
      );
    c.beats++;
    if (b.placeholder != null) c.placeholders++;
    c.unfinished += unfinished(b);
    if (b.placeholder == null && b.block && b.block !== 'kinetic') c.pictured++;
    if (['accepted', 'moved'].includes(accepted[b.id]?.state ?? ''))
      c.accepted++;
  }
  return out;
}
