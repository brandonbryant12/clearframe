import { plotLayout, titleText, titleShift } from './plots.mjs';
import { check, show } from './process-common.mjs';
import { processModel } from './process-model.mjs';
import { processSchedule } from './process-schedule.mjs';
import { processReadouts } from './process-readouts.mjs';
import { processPiles } from './process-piles.mjs';
import { processTrend } from './process-trend.mjs';
import { drawWideProcess } from './process-wide.mjs';
import { drawTallProcess } from './process-tall.mjs';
import type {
  ProcessSpec,
  ProcessWhen,
  ProcessDrawing,
  ProcessScene,
} from './process-contracts.mjs';
import type { CanvasElement, HelperFrame } from './types.mjs';
/** Canvas elements: stages, queues, the period clock and the done count, from the model's states. */
export function processElements(
  p: ProcessSpec,
  frame: HelperFrame,
  when: ProcessWhen = (r, fallback) => r.at ?? fallback,
) {
  const { width: W, height: H } = frame;
  const L = { ...plotLayout(frame) };
  const wide = W >= H;
  if (!wide) L.margin = Math.max(L.margin, Math.round(W * 0.115) + 4);
  const states = processModel(p),
    n = p.stages.length;
  // Stage cards, labels and connectors are the same objects in every beat; readouts and queue
  // squares are this beat's states, so their ids carry the beat's (no morph re-times them).
  const timed = (id: string) => (frame.beatId ? `${frame.beatId}-${id}` : id);
  const shift = titleShift(p.title, L, W - 2 * L.margin);
  const title = titleText(p.title, L, W - 2 * L.margin);
  title.id = `pr-${p.id}-title`;
  const font = 34;
  const assumption = `${p.arrivals} ${p.unit} arrive each ${p.period}; capacities are ${p.unit} per ${p.period}`;
  const out: CanvasElement[] = [
    title,
    {
      id: `pr-${p.id}-assumption`,
      type: 'text',
      text: assumption,
      x: L.margin,
      y: L.keyY + shift,
      size: Math.max(L.keyType, 26),
      fill: 'muted',
      font: 'semibold',
      fit: W - 2 * L.margin,
      ...show,
    },
  ];
  const { runs, time, clock } = processSchedule(p, states, when);
  // Layout: a row of stage cards (a column in a tall frame), each with its queue in front of it.
  const top = L.top + shift + (wide ? 60 : 40),
    bottom = L.bottom;
  const maxQueue = Math.max(...states.flatMap((s) => s.queues));
  const maxTokens = Math.ceil(maxQueue / p.token);
  const cols = wide ? 5 : 8,
    tokenSize = wide ? 26 : 26,
    gap = 6,
    rowsOfTokens = Math.ceil(maxTokens / cols);
  check(
    rowsOfTokens <= (wide ? 8 : 3),
    `a queue reaches ${maxQueue} ${p.unit}, too many tokens to draw; set token to stand for more ${p.unit} (e.g. ${Math.ceil(maxQueue / (wide ? 40 : 30))})`,
  );
  const drawing: ProcessDrawing = {
    p,
    frame,
    W,
    H,
    L,
    wide,
    shift,
    states,
    n,
    out,
    runs,
    time,
    clock,
    font,
    top,
    bottom,
    maxTokens,
    cols,
    tokenSize,
    gap,
    rowsOfTokens,
    timed,
  };
  const scene: ProcessScene = {
    ...drawing,
    ...processReadouts(drawing),
    pile: processPiles(drawing),
    trend: processTrend(drawing),
  };
  if (wide) drawWideProcess(scene);
  else drawTallProcess(scene);

  if (p.token > 1)
    out.push({
      id: `pr-${p.id}-token-key`,
      type: 'text',
      text: `Each full square is ${p.token} ${p.unit}`,
      x: L.margin,
      y: L.keyY + shift + (wide ? 44 : 40),
      size: Math.max(L.keyType * 0.9, 24),
      fill: 'muted',
      font: 'semibold',
      ...show,
    });
  return { elements: out, states, end: clock };
}
