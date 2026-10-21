import { inspectMetrics } from './metrics.mjs';
import type { Point } from '../../../film/contracts/primitives.mjs';

import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { inspectComponents } from './components.mjs';

export function inspectButton(context: ReturnType<typeof inspectComponents>) {
  const { side, compact, pad, cw, bar, card, text } = context;

  const metrics = inspectMetrics(side, compact);

  // The toolbar: a strip along the card's top (back, move and mark-unread chrome at the left) with
  // the Report phish button at its right, outlined until REPORT lights it solid.
  const btn = {
    x: 0,
    y: 0,
    w: metrics.buttonWidth,
    h: metrics.buttonHeight,
  };

  Object.assign(btn, {
    x: card.x + cw - (side ? 22 : 18) - btn.w,
    y: round(card.y + (bar - btn.h) / 2),
  });

  const btnC: Point = [round(btn.x + btn.w / 2), round(btn.y + btn.h / 2)];

  const btnFs = metrics.buttonFont;

  const btnFace = (ink: string, icon: string) => {
    const ix = round(btn.x + btn.h * 0.52),
      tx = round((btn.x + btn.h * 0.86 + btn.x + btn.w - 14) / 2);
    return [
      {
        type: 'icon',
        name: 'hook',
        x: ix,
        y: btnC[1],
        size: round(btn.h * 0.52),
        stroke: icon,
        enter: 'none',
      } satisfies CanvasElement,
      text(
        'REPORTBUTTON',
        tx,
        round(btnC[1] + btnFs * 0.36),
        btnFs,
        'semibold',
        ink,
        {
          anchor: 'middle',
          fit: round(btn.x + btn.w - 14 - (btn.x + btn.h * 0.86)),
        },
      ),
    ];
  };

  const chrome = round(bar * 0.36);

  // With choices, a bin (delete) follows the folder and mail icons, drawn in their line weight
  // (the icon set has no bin).
  const binC: Point = [
    round(card.x + pad + chrome * 6.5),
    round(card.y + bar / 2),
  ];

  const binEls = () => {
    const [x, y] = binC,
      s = chrome,
      P = (dx: number, dy: number) =>
        `${round(x + dx * s)} ${round(y + dy * s)}`;
    const ink = {
      fill: 'none',
      stroke: 'muted',
      width: 3,
      cap: 'round',
      join: 'round',
      enter: 'none',
    };
    return [
      {
        type: 'path',
        d: `M ${P(-0.42, -0.26)} L ${P(0.42, -0.26)} M ${P(-0.13, -0.26)} L ${P(-0.13, -0.41)} L ${P(0.13, -0.41)} L ${P(0.13, -0.26)}`,
        ...ink,
      } satisfies CanvasElement,
      {
        type: 'path',
        d: `M ${P(-0.31, -0.13)} L ${P(-0.25, 0.42)} L ${P(0.25, 0.42)} L ${P(0.31, -0.13)} M ${P(-0.09, -0.02)} L ${P(-0.09, 0.28)} M ${P(0.09, -0.02)} L ${P(0.09, 0.28)}`,
        ...ink,
      } satisfies CanvasElement,
    ];
  };
  return {
    ...context,
    side,
    compact,
    pad,
    cw,
    bar,
    card,
    text,
    btn,
    btnC,
    btnFace,
    chrome,
    binC,
    binEls,
  };
}
