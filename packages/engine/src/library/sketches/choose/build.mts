import type { CanvasElement } from '../../../film/contracts/canvas.mjs';
import type { SketchDrawing } from '../../../film/contracts/library.mjs';
import { round } from '../../../film/sketch-kit.mjs';
import { WINS, LABELS, NAMES } from './model.mjs';
import type { BuildOptions } from './model.mjs';
import { choiceLayout } from './layout.mjs';
import { createChoiceMark } from './marks.mjs';
import { createChoiceCard } from './cards.mjs';

export function buildSketch(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
): SketchDrawing {
  const rows = params.rows ?? ['a', 'b', 'a'];
  const pick = params.pick ?? 'a';
  if (!Array.isArray(rows) || !rows.length || rows.length > 4)
    throw new Error('sketchParams.rows for choose takes 1–4 rows');
  for (const r of rows)
    if (!WINS.includes(r))
      throw new Error(
        `sketchParams.rows for choose: "${r}" must be ${WINS.join(', ')}`,
      );
  if (!['a', 'b', 'none'].includes(pick))
    throw new Error('sketchParams.pick for choose must be a, b or none');
  const {
    AT,
    stacked,
    colors,
    sides,
    wins,
    text,
    cards,
    rowY,
    labelX,
    labelW,
    labelSize,
    narrowCards,
    head,
    rh,
  } = choiceLayout(rows, w, h);
  const mark = createChoiceMark({ wins, rows, sides, AT, stacked, colors });

  const card = createChoiceCard({
    cards,
    stacked,
    pick,
    sides,
    AT,
    text,
    head,
    narrowCards,
    colors,
    rows,
    rh,
    wins,
    rowY,
    mark,
  });

  return {
    elements: [
      // Side by side, the rules between rows run on across the label column, so the three
      // columns read as one table.
      ...(stacked
        ? []
        : rows.slice(1).map(
            (_, i): CanvasElement =>
              ({
                type: 'line',
                x1: cards[0].x + cards[0].w + 24,
                y1: round(cards[0].y + head + rh * (i + 1)),
                x2: cards[1].x - 24,
                y2: round(cards[0].y + head + rh * (i + 1)),
                stroke: 'line',
                width: 2,
                enter: 'fade',
                at: round(0.4 + 0.05 * i),
                dur: 0.5,
              }) satisfies CanvasElement,
          )),
      // Side by side, the row names stand between the cards, level with their marks.
      ...(stacked
        ? []
        : rows.map((_, i) =>
            text(
              LABELS[i],
              labelX,
              round(rowY(0, i) + labelSize * 0.36),
              labelSize,
              'semibold',
              'ink',
              {
                anchor: 'middle',
                fit: labelW,
                enter: 'rise',
                dist: 14,
                dur: 0.4,
                cue: NAMES[i],
                at: AT[NAMES[i]],
              },
            ),
          )),
      card(0),
      card(1),
    ],
  };
}
