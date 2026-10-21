import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import type { DrawElectionCardsContext, CarryoverCue } from './contracts.mjs';
import { AT } from './timing.mjs';
export function drawResetElectionCard(
  context: DrawElectionCardsContext,
  i: number,
  y: number,
  cue: CarryoverCue,
) {
  const { mid, cardH, bookend, still, on, right, colW, els, chipW, text } =
    context;

  // Where it hit, the line turns red (cleared on FIX); what it becomes lands in its empty slot.
  els.push({
    type: 'line',
    x1: mid,
    y1: y + 8,
    x2: mid,
    y2: y + cardH - 8,
    stroke: 'negative',
    width: 6,
    cap: 'round',
    ...(bookend
      ? {
          ...still,
          exit: 'fade',
          exitDur: 0.3,
          exitCue: 'FIX',
          exitAt: AT.FIX,
        }
      : { enter: 'draw', dur: 0.15, sound: 'thud', ...on(cue, 0.38) }),
  } satisfies CanvasElement);
  const cx = round(right + colW / 2);
  els.push({
    type: 'group',
    id: `carryover-reset-${i + 1}`,
    ...(bookend
      ? {
          ...still,
          exit: 'fade',
          exitDur: 0.2,
          exitCue: 'FIX',
          exitAt: AT.FIX,
        }
      : { enter: 'pop', dur: 0.3, ...on('RESET', 0) }),
    children: [
      {
        type: 'rect',
        x: round(cx - chipW / 2),
        y: round(y + cardH / 2 - 32),
        w: chipW,
        h: 64,
        r: 32,
        fill: 'negative',
      } satisfies CanvasElement,
      text('RESET', cx, round(y + cardH / 2 + 14), 40, 'bold', 'bg', {
        anchor: 'middle',
        fit: chipW - 32,
      }),
    ],
  } satisfies CanvasElement);
}
