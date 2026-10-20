import { sketchMoments, sketchByName } from '../../film/sketches.mjs';

import type { BeatCheckContext } from './critique-contracts.mjs';
export function beatCues(ctx: BeatCheckContext): void {
  const { sb, add, b, i, authored } = ctx;
  // A sketch whose moments are only partly landed on words: the rest keep their default
  // seconds and can land before the ones that were moved.
  if (
    authored?.sketch &&
    authored.sketchSay &&
    Object.keys(authored.sketchSay).length
  ) {
    const say = authored.sketchSay;
    const left = sketchMoments(authored.sketch, authored.sketchParams).filter(
      (m) => !(m in say),
    );
    if (left.length)
      add(
        'warn',
        b.id,
        `sketchSay lands ${Object.keys(authored.sketchSay).join(', ')} on words but not ${left.join(', ')}: those keep their default seconds and can land out of order. Give every moment a word.`,
      );
    // Moments happen in a fixed order (coins before their total, the bar before its split): words
    // given out of that order make a sketch run backwards.
    const free = sketchByName(authored.sketch)?.freeMoments ?? [],
      order = sketchMoments(authored.sketch, authored.sketchParams).filter(
        (m) => !free.includes(m),
      ),
      spoken = String(sb.beats[i]?.vo ?? '').toLowerCase(),
      heard = order
        .filter((m) => m in say)
        .map((m) => ({
          m,
          w: say[m],
          at: spoken.search(
            new RegExp(
              `\\b${String(say[m])
                .toLowerCase()
                .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`,
            ),
          ),
        }));
    const late = heard.findIndex(
      (h, k) => k > 0 && h.at >= 0 && heard[k - 1].at > h.at,
    );
    if (late > 0)
      add(
        'warn',
        b.id,
        `sketchSay puts ${heard[late].m} on "${heard[late].w}", which is said before "${heard[late - 1].w}" (${heard[late - 1].m}), but ${authored.sketch} shows ${heard[late - 1].m} first: give its moments words in this order: ${order.join(', ')}.`,
      );
  }
}
