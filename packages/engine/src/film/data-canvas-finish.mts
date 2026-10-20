import type { ChartContext } from './data-canvas-contracts.mjs';

export function finishChart(ctx: ChartContext): void {
  const { note, out } = ctx;
  // When the note lands, everything else steps back: the other values dim on the same word.
  if (note) {
    const cue = note.say ? { say: note.say } : { at: note.at ?? 1.2 };
    const target = note.target.key;
    for (const el of out) {
      const mine = el.id === target || el.of === target;
      if (!mine && !el.note && (el.type === 'rect' || el.type === 'text'))
        el.keys = [...(el.keys ?? []), { ...cue, opacity: 0.35, dur: 0.5 }];
    }
  }
  for (const el of out) {
    delete el.of;
    delete el.note;
  }
}
