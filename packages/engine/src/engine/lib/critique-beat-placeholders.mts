import {
  sketchMoments,
  sketchWords,
  sketchByName,
} from '../../film/sketches.mjs';

import type { BeatCheckContext } from './critique-contracts.mjs';
export function beatPlaceholders(ctx: BeatCheckContext): void {
  const { add, b, authored } = ctx;
  // Placeholder words left in a filled sketch draw as themselves ("STEP4" on screen), usually
  // because sketchParams added a step after sketchText was written.
  if (!authored?.sketch || !sketchByName(authored.sketch)?.keep) return;
  {
    const filled = authored.sketchText ?? {};
    const words = sketchWords(authored.sketch, authored.sketchParams),
      left = words.filter((w) => !(w in filled)),
      stray = Object.keys(filled).filter(
        (k) =>
          !words.includes(k) &&
          !(sketchByName(authored.sketch ?? '')?.keepText ?? []).includes(k),
      );
    if (left.length)
      add(
        'warn',
        b.id,
        `${
          Object.keys(filled).length
            ? `sketchText fills ${
                Object.keys(filled)
                  .filter((k) => words.includes(k))
                  .join(', ') || 'nothing it draws'
              } but not`
            : 'No sketchText: the sketch draws'
        } ${left.join(', ')}: ${left.length > 1 ? 'those draw' : 'it draws'} on screen as the placeholder word. Fill every one, or change sketchParams so the sketch draws fewer.`,
      );
    const moments = new Set(
        sketchMoments(authored.sketch, authored.sketchParams),
      ),
      cued = stray.filter((k) => moments.has(k)),
      other = stray.filter((k) => !moments.has(k));
    if (cued.length)
      add(
        'warn',
        b.id,
        `sketchText names ${cued.join(', ')}, which ${cued.length > 1 ? 'are moments' : 'is a moment'}: put the spoken word in sketchSay ({"${cued[0]}": "a word from the narration"}) so the picture moves on it.`,
      );
    if (other.length)
      add(
        'warn',
        b.id,
        `sketchText names ${other.join(', ')}, which ${authored.sketch} does not draw with these sketchParams (its words are ${words.join(', ')}): misspelt, or a step the params removed.`,
      );
  }
}
