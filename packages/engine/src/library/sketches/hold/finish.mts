import { keptPlacement } from './kept-placement.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';

import type { holdTags } from './tags.mjs';

export function holdFinish(
  context: ReturnType<typeof holdTags>,
): SketchDrawing {
  const {
    rise,
    falls,
    fmt,
    wide,
    fs,
    text,
    cued,
    els,
    iB,
    phases,
    tip,
    iu,
    id,
  } = context;

  // What the lock keeps: the gap's size and its words, set inside the shaded gap where it is
  // roomy enough (else just under the lock line), once the climb has shaded it.
  if (iu != null && id != null) {
    const kw = wide ? 380 : 330,
      kh = round(fs.kept + fs.label + 14),
      pad = 14;
    const end = falls ? Math.min(id, iB) : id;
    const place = keptPlacement(context, iu, id, end, kw, kh, pad);
    const at = tip(end);
    const timing = falls
      ? cued('RISE', round(phases[1].dur + 0.1))
      : cued(at.cue, round(at.dt + 0.1));
    els.push({
      type: 'group',
      enter: 'rise',
      dist: 16,
      dur: 0.45,
      ...timing,
      children: [
        text(
          fmt(rise),
          place.cx,
          round(place.top + fs.kept * 0.8),
          fs.kept,
          'bold',
          'accent',
          { anchor: 'middle', fit: kw, enter: 'none' },
        ),
        text(
          'KEPT',
          place.cx,
          round(place.top + fs.kept * 0.8 + fs.label + 12),
          fs.label,
          'semibold',
          'ink',
          { anchor: 'middle', fit: kw, enter: 'none' },
        ),
      ],
    } satisfies CanvasElement);
  }

  return { elements: els };
}
