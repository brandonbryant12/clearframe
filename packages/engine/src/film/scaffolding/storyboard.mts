import type { PlaybookItem, PlaybookEnding } from '../types.mjs';
import type { Storyboard } from '../../engine/domain.mjs';
import { decodeStoryboard } from '../../engine/schemas.mjs';

import { palette } from '../catalog.mjs';

import { items } from '../library.mjs';

import type { ScaffoldOptions } from './contracts.mjs';
import { redrawBeat } from './sketches.mjs';

// Playbooks: starting story arcs, one JSON file each in library/playbooks (plus any in a
// project's library/). A beat that names a `sketch` is redrawn for the requested frame.
export const playbooks = () => items('playbooks');

/** A playbook's ending by name (or its first): the closing beats appended to its body. */
export function endingFor(
  book: PlaybookItem | undefined,
  name?: string,
): PlaybookEnding | null {
  if (!book?.endings?.length) return null;
  if (name == null) return book.endings[0];
  const found = book.endings.find((e) => e.name === name);
  if (!found)
    throw new Error(
      `${book.id} has no ending ${name} (its endings are ${book.endings.map((e) => e.name).join(', ')})`,
    );
  return found;
}

export function storyboardFor(
  id: string,
  { title, theme, vertical, seed, ending }: ScaffoldOptions = {},
): Storyboard {
  const book = playbooks().find((p) => p.id === id);
  if (!book) throw new Error(`Unknown playbook ${id}`);
  const close = endingFor(book, ending);
  const sb = {
    version: 2,
    title: title ?? book.title,
    logline: book.title,
    format: {
      preset: vertical ? 'vertical' : (book.format ?? 'landscape'),
      fps: 30,
    },
    theme: theme ?? book.theme ?? 'paper',
    motion: { preset: book.motion ?? 'gentle', intensity: 0.65 },
    transition: book.transition ?? 'cut',
    backdrop: book.backdrop ?? 'none',
    chrome: false,
    // Captions are on for every narrated film; a playbook that turns them off says so.
    ...(book.captions != null ? { captions: book.captions } : {}),
    // A produced film has a score and sound that follows the picture: a draft bed is free
    // (music --draft); the final bed is paid and runs only after plan and approval.
    music: book.music ?? {},
    sfx: book.sfx ?? 'subtle',
    ...playbookStyle(book),
    sources: structuredClone(
      book.sources ?? [
        {
          id: 'sample',
          title:
            'Hypothetical sample data and fictional quotations — replace before publishing',
        },
      ],
    ),
    continuity: {
      maxGeneratedShare: 0.2,
      treatment:
        'Restrained editorial graphics, generous space, no generated text',
      camera: 'Locked or a slow push',
      lighting: 'Soft, diffuse',
      motion: 'Slow left-to-right movement',
    },
    beats: structuredClone([...book.beats, ...(close?.beats ?? [])]),
  };
  // Sketch coordinates are frame pixels: re-draw them for the requested frame.
  // A sketch's own camera (view, truck, dolly, focus) travels with it. A canvas drawn in
  // landscape frame pixels is fitted whole into a tall frame rather than cropped off-centre.
  sb.beats.forEach((beat, index) =>
    redrawBeat(beat, book, { vertical, seed }, index),
  );
  const ids = new Map<string, number>();
  for (const [index, b] of sb.beats.entries()) {
    b.id ??= `beat-${index + 1}`;
    const n = (ids.get(b.id) ?? 0) + 1;
    ids.set(b.id, n);
    if (n > 1) b.id += `-${n}`;
  }
  palette(sb.theme);
  return decodeStoryboard(sb);
}

function playbookStyle(book: PlaybookItem) {
  return {
    ...(book.texture ? { texture: book.texture } : {}),
    ...(book.lens ? { lens: book.lens } : {}),
    ...(book.camera ? { camera: book.camera } : {}),
    ...(book.heading ? { heading: book.heading } : {}),
    ...(book.textMotion ? { textMotion: book.textMotion } : {}),
    ...(book.type ? { type: book.type } : {}),
    ...(book.sfx ? { sfx: book.sfx } : {}),
    ...(book.frame ? { frame: book.frame } : {}),
    ...(book.speakers ? { speakers: book.speakers } : {}),
    ...(book.voice ? { voice: book.voice } : {}),
  };
}
