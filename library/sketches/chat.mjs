import { round } from '../../fframes/sketch-kit.mjs';

// A conversation on a phone, played out: a greeting arrives, a question is typed into the field
// and sent, the other side types (three dots), and the answer lands. The phone floats, turning
// gently in space. Drawn, not a screenshot: label it as an illustration of the exchange.
export default {
  name: 'chat',
  order: 24,
  summary:
    'A chat played out on a floating phone: a greeting arrives, a question is typed and sent, three dots, the answer lands and gets a heart.',
  use: 'A customer asking for something, a product answering, a support exchange, "what people actually ask". Replace HELLO, ASK and REPLY (each up to about 40 characters) with sketchText; cue the beats with keys or say on the copied elements.',
  build(w, h) {
    const tallFrame = h > w,
      pw = round(tallFrame ? w * 0.7 : h * 0.46),
      ph = round(pw * 1.9),
      px = round(w / 2 - pw / 2),
      py = round(h / 2 - ph / 2),
      pad = round(pw * 0.06),
      inner = pw - 2 * pad,
      bw = round(inner * 0.78),
      bh = round(pw * 0.2),
      font = round(pw * 0.052),
      fieldY = round(py + ph - pad - pw * 0.13),
      row = k => round(py + pw * 0.3 + k * (bh + pw * 0.06));
    const bubble = (x, y, fill, ink, text, extra) => ({
      type: 'group',
      enter: 'pop',
      origin: [x + bw / 2, y + bh / 2],
      ...extra,
      children: [
        { type: 'rect', x, y, w: bw, h: bh, r: round(bh * 0.32), fill },
        {
          type: 'text',
          text,
          x: round(x + bh * 0.3),
          y: round(y + bh * 0.42),
          size: font,
          width: round(bw - bh * 0.6),
          leading: 1.2,
          font: 'semibold',
          fill: ink,
          enter: 'none',
        },
      ],
    });
    const dot = k => ({
      type: 'circle',
      cx: round(px + pad + bh * 0.42 + k * bh * 0.32),
      cy: round(row(2) + bh * 0.3),
      r: round(bh * 0.09),
      fill: 'muted',
      enter: 'pop',
      at: 3.0 + k * 0.08,
      loop: { type: 'blink', period: 0.9 + k * 0.05, amount: 0.7 },
      exit: 'fade',
      exitAt: 4.0,
      exitDur: 0.15,
    });
    return {
      elements: [
        {
          type: 'group',
          enter: 'rise',
          at: 0,
          dur: 0.6,
          origin: [round(w / 2), round(h / 2)],
          tilt: [0, -10],
          loop: { type: 'rock', period: 5, amount: 7 },
          shadow: { blur: 40, dy: 34, opacity: 0.3 },
          children: [
            // The phone: body, screen, the clock line.
            { type: 'rect', x: px, y: py, w: pw, h: ph, r: round(pw * 0.14), fill: 'ink', enter: 'none' },
            {
              type: 'rect',
              x: px + round(pw * 0.025),
              y: py + round(pw * 0.025),
              w: round(pw * 0.95),
              h: round(ph - pw * 0.05),
              r: round(pw * 0.12),
              fill: 'surface',
              enter: 'none',
            },
            {
              type: 'text',
              text: 'Today 9:41',
              x: round(w / 2),
              y: round(py + pw * 0.17),
              size: round(font * 0.72),
              font: 'semibold',
              anchor: 'middle',
              fill: 'muted',
              enter: 'none',
            },
            bubble(px + pad, row(0), 'bg', 'ink', 'HELLO', { at: 0.3 }),
            // The message field: the question types in, then leaves as it is sent.
            {
              type: 'rect',
              x: px + pad,
              y: fieldY,
              w: inner,
              h: round(pw * 0.11),
              r: round(pw * 0.055),
              fill: 'none',
              stroke: 'muted',
              width: 2,
              enter: 'none',
            },
            {
              type: 'text',
              text: 'ASK',
              x: round(px + pad + pw * 0.05),
              y: round(fieldY + pw * 0.072),
              size: round(font * 0.9),
              width: round(inner - pw * 0.16),
              font: 'regular',
              fill: 'ink',
              enter: 'type',
              at: 0.8,
              exit: 'fade',
              exitAt: 2.45,
              exitDur: 0.12,
            },
            {
              type: 'circle',
              cx: round(px + pw - pad - pw * 0.06),
              cy: round(fieldY + pw * 0.055),
              r: round(pw * 0.04),
              fill: 'accent',
              enter: 'none',
            },
            bubble(px + pw - pad - bw, row(1), 'accent', 'bg', 'ASK', { at: 2.5, dur: 0.4 }),
            dot(0),
            dot(1),
            dot(2),
            bubble(px + pad, row(2), 'bg', 'ink', 'REPLY', { at: 4.05, dur: 0.4 }),
            // A reaction lands on the answer: the exchange ends on a gesture, not a still.
            {
              type: 'group',
              enter: 'pop',
              at: 4.8,
              dur: 0.35,
              origin: [round(px + pad + bw), round(row(2) + bh)],
              children: [
                {
                  type: 'circle',
                  cx: round(px + pad + bw),
                  cy: round(row(2) + bh),
                  r: round(bh * 0.26),
                  fill: 'surface',
                  stroke: 'line',
                  width: 2,
                },
                {
                  type: 'icon',
                  name: 'heart',
                  x: round(px + pad + bw),
                  y: round(row(2) + bh),
                  size: round(bh * 0.3),
                  stroke: 'accent',
                },
              ],
            },
          ],
        },
      ],
    };
  },
};
