import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import type { DrawElectionCardsContext } from './contracts.mjs';
import { crossingKeys, cardTick } from './timing.mjs';
import { drawResetElectionCard } from './reset.mjs';

export function drawElectionCards(context: DrawElectionCardsContext) {
  for (let i = 0; i < context.count; i++) drawElectionCard(context, i);
}

function drawElectionCard(context: DrawElectionCardsContext, i: number) {
  const {
    y0,
    cardH,
    gap,
    stays,
    icons,
    bookend,
    on,
    across,
    mid,
    left,
    colW,
    els,
    still,
    above,
    text,
    start,
    size,
    tick,
  } = context;
  const cue = (['CARD1', 'CARD2', 'CARD3', 'CARD4', 'CARD5'] as const)[i];
  const y = y0 + i * (cardH + gap);
  const stay = stays.includes(i + 1);
  const icon = icons[i];
  // A card that carries over crosses to next year; one that stays runs to the line, hits it
  // and comes back. In a bookend the board opens decided, and FIX takes the cards that stayed
  // across once they are fixed.
  const keys = crossingKeys(bookend, stay, on, across, cue, mid, left, colW);
  els.push({
    type: 'group',
    id: `carryover-${i + 1}`,
    ...still,
    // In a bookend, the cards that carried over are already across.
    ...(bookend && !stay ? { x: across } : {}),
    ...(keys.length ? { keys } : {}),
    children: [
      {
        type: 'rect',
        x: left,
        y,
        w: colW,
        h: cardH,
        r: 20,
        fill: 'surface',
        stroke: 'line',
        width: 2,
        shadow: true,
      } satisfies CanvasElement,
      ...(icon
        ? [
            {
              type: 'icon',
              name: icon,
              x: above ? left + 56 : left + 52,
              y: above ? y + 40 : round(y + cardH / 2),
              size: above ? 40 : 48,
              stroke: 'accent',
            } satisfies CanvasElement,
          ]
        : []),
      text(
        `ITEM${i + 1}`,
        left + start,
        above ? round(y + cardH - 28) : round(y + cardH / 2 + size * 0.36),
        size,
        'strong',
        'ink',
        { fit: colW - start - 84 },
      ),
      // The tick a card gets on the far side (in a bookend, the card that stayed gets it on FIX).
      ...cardTick(stay, bookend, tick, y, on, cue),
    ],
  } satisfies CanvasElement);
  if (stay) drawResetElectionCard(context, i, y, cue);
}
