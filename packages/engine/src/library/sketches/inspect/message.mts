import { required } from '.././drawing/contracts.mjs';
import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';
import { CHOICE } from './common.mjs';
import type { inspectToolbar } from './toolbar.mjs';

export function inspectMessage(context: ReturnType<typeof inspectToolbar>) {
  const {
    attach,
    choices,
    fs,
    cw,
    rows,
    avatar,
    divider,
    bw,
    bh,
    card,
    inner,
    Y,
    text,
    arrive,
    timedOn,
    toolbar,
  } = context;

  const sy = Y(rows.sender);

  const cardEls: CanvasElement[] = [
    {
      type: 'rect',
      ...card,
      r: 28,
      fill: 'surface',
      stroke: 'line',
      width: 2,
      enter: 'none',
      shadow: { blur: 44, dy: 22, opacity: 0.16 },
    } satisfies CanvasElement,
    ...toolbar,
    arrive(0, [
      {
        type: 'circle',
        cx: inner.x + avatar / 2,
        cy: sy + avatar / 2,
        r: avatar / 2,
        fill: 'wash2',
        enter: 'none',
      } satisfies CanvasElement,
      {
        type: 'icon',
        name: 'user',
        x: inner.x + avatar / 2,
        y: sy + avatar / 2,
        size: round(avatar * 0.56),
        stroke: 'accent2',
        enter: 'none',
      } satisfies CanvasElement,
      text(
        'FROM',
        inner.x + avatar + 22,
        round(sy + avatar / 2 + fs.from * 0.36),
        fs.from,
        'semibold',
        'ink',
        { fit: inner.w - avatar - 22 },
      ),
    ]),
    {
      type: 'line',
      x1: card.x,
      y1: Y({ y: divider }),
      x2: card.x + cw,
      y2: Y({ y: divider }),
      stroke: 'line',
      width: 2,
      enter: 'none',
    } satisfies CanvasElement,
    arrive(1, [
      text(
        'SUBJECT',
        inner.x,
        round(Y(rows.subject) + fs.subject * 0.84),
        fs.subject,
        'bold',
        'ink',
        { fit: inner.w },
      ),
    ]),
    arrive(2, [
      text(
        'LINE1',
        inner.x,
        round(Y(rows.body) + fs.line * 0.86),
        fs.line,
        'regular',
        'ink',
        { fit: inner.w },
      ),
      text(
        'LINE2',
        inner.x,
        round(Y(rows.body) + fs.line * 2.36),
        fs.line,
        'regular',
        'ink',
        { fit: inner.w },
      ),
    ]),
    {
      ...arrive(3, [
        {
          type: 'rect',
          x: inner.x,
          y: Y(rows.link),
          w: bw,
          h: bh,
          r: bh / 2,
          fill: 'accent',
          enter: 'none',
        } satisfies CanvasElement,
        text(
          'BUTTON',
          round(inner.x + bw / 2),
          round(Y(rows.link) + bh / 2 + fs.button * 0.36),
          fs.button,
          'semibold',
          'bg',
          { anchor: 'middle', fit: bw - 48 },
        ),
      ]),
      // With choices, the link greys out as its no sign lands on CLICK.
      ...(choices
        ? {
            keys: [timedOn('CLICK', CHOICE.sign, { dur: 0.3, opacity: 0.4 })],
          }
        : {}),
    },
    ...(attach
      ? [
          arrive(4, [
            {
              type: 'rect',
              x: inner.x,
              y: Y(rows.attachment),
              w: required(rows.attachment.w, 'attachment width'),
              h: 64,
              r: 16,
              fill: 'bg',
              stroke: 'line',
              width: 2,
              enter: 'none',
            } satisfies CanvasElement,
            {
              type: 'icon',
              name: 'file',
              x: inner.x + 36,
              y: Y(rows.attachment) + 32,
              size: 32,
              stroke: 'muted',
              enter: 'none',
            } satisfies CanvasElement,
            text(
              'FILE',
              inner.x + 66,
              round(Y(rows.attachment) + 32 + fs.file * 0.36),
              fs.file,
              'semibold',
              'ink',
              { fit: required(rows.attachment.w, 'attachment width') - 86 },
            ),
          ]),
        ]
      : []),
  ];
  return {
    ...context,
    choices,
    fs,
    cw,
    rows,
    bw,
    bh,
    card,
    inner,
    Y,
    text,
    timedOn,
    cardEls,
  };
}
