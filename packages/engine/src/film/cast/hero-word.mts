import type { CastStage, CastStep, CastPose } from './contracts.mjs';
import type { CanvasElement } from '../types.mjs';
import { objectAt } from './common.mjs';
import { objectExtent } from './draw.mjs';
export function heroWord(
  stage: CastStage,
  step: CastStep,
  targets: Map<string, CastPose>,
): void {
  const { spec, frame, size, u, words, notes } = stage;
  const { f, k, t, dur } = step;

  const lbl = objectAt(spec.objects, f.hero)?.label;
  if (lbl && lbl.trim().toLowerCase() === String(f.word).trim().toLowerCase())
    notes.push(
      `hero ${f.hero}: its word "${f.word}" repeats its label; the word is for what this moment says about it ("Snap this one", "Yours after 3 years")`,
    );
  // Below the hero as drawn: its own size (not the cast's), its shape's height and its label.
  const h = objectAt(targets, f.hero),
    ho = objectAt(spec.objects, f.hero),
    s0 = ho?.size ?? size,
    hs = f.scale ?? 2.3,
    wordSize = u * (spec.look === 'drawn' ? 0.1 : 0.085),
    below = ho?.label
      ? (0.84 * s0 + Math.max(22, s0 * 0.2) * 0.6) * hs + wordSize
      : Math.max(0.95 * s0, objectExtent(ho ?? {}, size)[1] + 0.3 * s0) * hs;
  words.push({
    type: 'text',
    id: `cast-word-${k}`,
    text: f.word,
    x: h.x,
    y: Math.min(h.y + below, frame.height - wordSize * 0.6),
    size: wordSize,
    font: { tiles: 'display', drawn: 'hand', print: 'poster' }[spec.look],
    fill: 'ink',
    anchor: 'middle',
    at: t + dur * 0.6,
    enter: 'type',
    fit: frame.width * 0.8,
    // With nothing to replace it, the word leaves before the cut rather than on it.
    ...wordExit(stage, step),
  });
}

function wordExit(
  stage: CastStage,
  { k, t, dur }: CastStep,
): Pick<CanvasElement, 'exitAt' | 'exit'> {
  const next = stage.until(k);
  if (next != null) return { exitAt: next, exit: 'fade' };
  if ((stage.frame.duration ?? 0) > t + dur + 1.2)
    return { exitAt: (stage.frame.duration ?? 0) - 0.4, exit: 'fade' };
  return {};
}
