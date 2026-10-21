import type { CanvasElement } from '../../../film/contracts/canvas.mjs';

import { round } from '../../../film/sketch-kit.mjs';

import type { composeWindow } from './window.mjs';

export function composeFields(context: ReturnType<typeof composeWindow>) {
  const { phone, text, s, win, inner, toRow, subRow, body, ui } = context;

  // To and Subject: a label column, the values beside it, a rule under each row.
  const valueX = inner.x + round(s.label * (phone ? 4.2 : 4.6));

  const avatar = round(s.value * 0.62);

  const toY = round(toRow.y + toRow.h / 2);

  ui.push(
    text('To', inner.x, toY + s.label * 0.36, s.label, 'regular', 'muted'),
  );

  ui.push({
    type: 'circle',
    cx: valueX + avatar,
    cy: toY,
    r: avatar,
    fill: 'wash2',
    enter: 'none',
  } satisfies CanvasElement);

  ui.push({
    type: 'icon',
    name: 'user',
    x: valueX + avatar,
    y: toY,
    size: round(avatar * 1.15),
    stroke: 'accent2',
    enter: 'none',
  } satisfies CanvasElement);

  ui.push(
    text(
      'RECIPIENT',
      valueX + 2 * avatar + 16,
      toY + s.value * 0.36,
      s.value,
      'regular',
      'ink',
      { fit: inner.r - (valueX + 2 * avatar + 16) },
    ),
  );

  const subY = round(subRow.y + subRow.h / 2);

  ui.push(
    text(
      'Subject',
      inner.x,
      subY + s.label * 0.36,
      s.label,
      'regular',
      'muted',
    ),
  );

  ui.push(
    text(
      'SUBJECT',
      valueX,
      subY + s.subject * 0.36,
      s.subject,
      'semibold',
      'ink',
      { fit: inner.r - valueX },
    ),
  );

  for (const r of [toRow, subRow])
    ui.push({
      type: 'line',
      x1: inner.x,
      y1: r.y + r.h,
      x2: phone ? inner.r : win.x + win.w,
      y2: r.y + r.h,
      stroke: 'line',
      width: 2,
      enter: 'none',
    } satisfies CanvasElement);

  // One line of the message (two when it wraps).
  ui.push(
    text('BODY', inner.x, body.y + s.body * 0.92, s.body, 'regular', 'ink', {
      width: inner.w,
      height: body.h,
      leading: 1.32,
    }),
  );
  return { ...context, phone, text, s, win, ui };
}
