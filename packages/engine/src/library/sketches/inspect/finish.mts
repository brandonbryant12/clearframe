import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { crisp, round } from '../../../film/sketch-kit.mjs';
import { AT, SHOWN, LATER } from './common.mjs';
import type { inspectChoices } from './choices.mjs';

export function inspectFinish(
  context: ReturnType<typeof inspectChoices>,
): SketchDrawing {
  const {
    marks,
    standing,
    stopping,
    STEP,
    cued,
    btn,
    btnC,
    markEls,
    O,
    lean,
    cardGroup,
    leave,
    ripple,
    shield,
    done,
    pointer,
    refused,
    choiceKeys,
    guide,
  } = context;

  // A card that opens marked stands from the first frame as THREE left it: its entrances done
  // and the view held in the last lean.
  const stand = (list: CanvasElement[]): CanvasElement[] =>
    list.map((el) => {
      const out = { ...el };
      if (SHOWN.has(out.cue ?? '')) {
        for (const key of ['cue', 'at', 'after', 'dur', 'dist'] as const)
          delete out[key];
        out.enter = 'none';
      }
      if (out.children) out.children = stand(out.children);
      return out;
    });

  const leaned = () => {
    const { scale: s, x, y } = lean(marks.at(-1), marks.length - 1);
    return [{ at: 0, dur: 0, scale: s, x, y }];
  };

  // A card that stops marked keeps everything the later moments would change, as it stood.
  const prune = (list: CanvasElement[]): CanvasElement[] =>
    list.flatMap((el) => {
      if (LATER.has(el.cue ?? '')) return [];
      const out = { ...el };
      if (out.keys) {
        out.keys = out.keys.filter((key) => !LATER.has(key.cue ?? ''));
        if (!out.keys.length) delete out.keys;
      }
      if (out.children) out.children = prune(out.children);
      return [out];
    });

  const marksGroup = {
    type: 'group',
    enter: 'none',
    keys: [cued(STEP.fade, { dur: 0.3, opacity: 0 })],
    children: [...markEls, ...refused],
  } satisfies CanvasElement;

  const view = {
    type: 'group',
    enter: 'none',
    ...(standing ? { at: 0 } : { cue: 'OPEN', at: AT.OPEN }),
    origin: O,
    keys: [
      ...(standing ? leaned() : marks.map(lean)),
      ...choiceKeys,
      cued(0, { dur: STEP.light, ease: 'inOut', scale: 1, x: 0, y: 0 }),
      ...leave,
    ],
    children: standing
      ? stand([cardGroup, marksGroup])
      : [cardGroup, marksGroup],
  } satisfies CanvasElement;

  if (stopping) return { elements: crisp(prune([view])) };

  return {
    elements: crisp([
      view,
      ripple(btnC, round(btn.h * 0.8), STEP.light),
      shield,
      done,
      guide || pointer,
    ]),
  };
}
