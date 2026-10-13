import { round, tall, body } from '../../film/sketch-kit.mjs';

// Look closely at a message: an email card arrives (sender, subject, two body lines, a link
// button and, if asked, an attachment), then up to three of its parts are marked in turn. Each
// mark rings the part, draws a connector out to a short label and the view leans in on it: the
// labels stand beside the card in wide frames and just under their part in narrow ones (the
// marks are known when the card is laid out, so the room for them is there from the start).
// Which part each mark points at is a param, so one drawing serves phishing tells, a receipt's
// must-haves or the clause to check. Moments: OPEN (the card arrives), then ONE, TWO, THREE.
const PARTS = ['sender', 'subject', 'body', 'link', 'attachment'];
const NAMES = ['ONE', 'TWO', 'THREE'];
const LABELS = ['MARKONE', 'MARKTWO', 'MARKTHREE'];
const ICON = { negative: 'alert', positive: 'check', accent: 'search', accent2: 'search' };
const AT = { OPEN: 0.3, ONE: 1.8, TWO: 3.5, THREE: 5.2 };

export default {
  name: 'inspect',
  order: 95,
  keep: true,
  summary:
    'Look closely at a message: an email card arrives, then up to three of its parts are ringed in turn, each with a connector out to a short label, and the view leans in on each mark.',
  use: 'Phishing tells (an urgent subject, an almost-right sender, an unexpected link), a receipt’s or payslip’s must-haves, the line in a notice to check. Replace FROM (the sender line, up to about 40 characters), SUBJECT (up to about 40), LINE1 and LINE2 (two short body lines), BUTTON (the link’s words), FILE (the attachment’s name, when drawn) and MARKONE, MARKTWO, MARKTHREE (the labels, two to four words each) with sketchText; land OPEN (the card arriving) and ONE, TWO, THREE (one per mark) on words with sketchSay. sketchParams: marks (which part each mark rings, in order: sender, subject, body, link or attachment), attachment (true draws the attachment chip) and color (negative for warning signs, positive for what to look for, accent for points of interest).',
  params: {
    marks: {
      default: ['subject', 'sender', 'link'],
      list: true,
      length: [1, 3],
      about: 'the part each mark rings, in order: sender, subject, body, link or attachment (1–3, each once)',
    },
    attachment: { default: false, about: 'true draws an attachment chip (fill FILE); marking "attachment" draws it too' },
    color: { default: 'negative', about: 'colour of the marks: negative (warning signs), positive (what to look for), accent or accent2' },
  },
  build(w, h, { params = {} } = {}) {
    const marks = params.marks ?? ['subject', 'sender', 'link'];
    const color = params.color ?? 'negative';
    if (!Array.isArray(marks) || !marks.length || marks.length > 3) throw new Error('sketchParams.marks for inspect takes 1–3 parts');
    for (const m of marks)
      if (!PARTS.includes(m)) throw new Error(`sketchParams.marks for inspect: "${m}" is not a part (use ${PARTS.join(', ')})`);
    if (new Set(marks).size !== marks.length) throw new Error('sketchParams.marks for inspect: each part can be marked once');
    if (!(color in ICON)) throw new Error(`sketchParams.color for inspect must be ${Object.keys(ICON).join(', ')}`);
    if (params.attachment != null && typeof params.attachment !== 'boolean')
      throw new Error('sketchParams.attachment for inspect must be true or false');
    const attach = params.attachment === true || marks.includes('attachment');

    const T = tall(w, h);
    const b = body(w, h);
    // Wide frames pull the labels out beside the card; narrow ones (tall, square) under each part.
    const side = w >= 1400;
    const compact = !side && h < 1500;
    const fs = side
      ? { from: 34, subject: 50, line: 34, button: 32, file: 30, label: 42 }
      : compact
        ? { from: 30, subject: 40, line: 30, button: 30, file: 28, label: 34 }
        : { from: 34, subject: 46, line: 34, button: 34, file: 30, label: 38 };
    const pad = side ? 52 : 44;
    const badge = side ? 28 : 22;
    const labelW = 520;
    const gap = 64;
    const cw = side ? Math.min(900, round(b.w * 0.54)) : w - 180;
    const cx0 = side ? round((w - (cw + gap + labelW)) / 2) : round((w - cw) / 2);
    const air = compact || (side && attach) ? 1 : side ? 1.25 : 1.4;
    const callout = compact ? 66 : 84;

    // Rows top to bottom (relative to the card's inner top). Under a marked part, a narrow frame
    // keeps room for its label.
    const rows = {};
    let cur = 0;
    const row = (part, height, extra = {}) => {
      rows[part] = { y: cur, h: height, ...extra };
      cur += height;
      if (!side && marks.includes(part)) cur += callout;
    };
    const avatar = side ? 64 : 60;
    row('sender', avatar);
    cur += round(28 * air);
    const divider = cur;
    cur += round(32 * air);
    row('subject', round(fs.subject * 1.1));
    cur += round(26 * air);
    row('body', round(fs.line * 2.55));
    cur += round(34 * air);
    const bw = side ? 340 : 340;
    const bh = side ? 80 : 72;
    row('link', bh, { w: bw });
    if (attach) {
      cur += round(26 * air);
      row('attachment', 64, { w: side ? 460 : cw - 2 * pad });
    }
    const ch = cur + 2 * pad;
    const cy0 = round(side ? Math.max(b.y - 10, b.y + (b.h - ch) / 2 - 10) : Math.max(T ? b.y - 120 : 170, b.y + (b.h - ch) / 2 - (T ? 40 : 0)));
    const card = { x: cx0, y: cy0, w: cw, h: ch };
    const inner = { x: card.x + pad, y: card.y + pad, w: cw - 2 * pad };
    const Y = r => round(inner.y + r.y);
    const lx = card.x + cw + gap;

    // What each mark rings: whole rows for text, the control itself for the button and the chip.
    const ringOf = part => {
      const r = rows[part];
      if (part === 'link' || part === 'attachment') return { x: inner.x - 10, y: Y(r) - 10, w: r.w + 20, h: r.h + 20 };
      return { x: inner.x - 18, y: Y(r) - 14, w: inner.w + 36, h: r.h + 28 };
    };

    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, enter: 'none', ...extra });
    const arrive = (i, children) => ({
      type: 'group',
      enter: 'rise',
      dist: 14,
      cue: 'OPEN',
      at: round(AT.OPEN + 0.25 + i * 0.08),
      after: round(0.25 + i * 0.08),
      dur: 0.45,
      children,
    });

    const sy = Y(rows.sender);
    const cardEls = [
      { type: 'rect', ...card, r: 28, fill: 'surface', stroke: 'line', width: 2, enter: 'none', shadow: { blur: 44, dy: 22, opacity: 0.16 } },
      arrive(0, [
        { type: 'circle', cx: inner.x + avatar / 2, cy: sy + avatar / 2, r: avatar / 2, fill: 'wash2', enter: 'none' },
        { type: 'icon', name: 'user', x: inner.x + avatar / 2, y: sy + avatar / 2, size: round(avatar * 0.56), stroke: 'accent2', enter: 'none' },
        text('FROM', inner.x + avatar + 22, round(sy + avatar / 2 + fs.from * 0.36), fs.from, 'semibold', 'ink', { fit: inner.w - avatar - 22 }),
      ]),
      { type: 'line', x1: card.x, y1: Y({ y: divider }), x2: card.x + cw, y2: Y({ y: divider }), stroke: 'line', width: 2, enter: 'none' },
      arrive(1, [text('SUBJECT', inner.x, round(Y(rows.subject) + fs.subject * 0.84), fs.subject, 'bold', 'ink', { fit: inner.w })]),
      arrive(2, [
        text('LINE1', inner.x, round(Y(rows.body) + fs.line * 0.86), fs.line, 'regular', 'ink', { fit: inner.w }),
        text('LINE2', inner.x, round(Y(rows.body) + fs.line * 2.36), fs.line, 'regular', 'ink', { fit: inner.w }),
      ]),
      arrive(3, [
        { type: 'rect', x: inner.x, y: Y(rows.link), w: bw, h: bh, r: bh / 2, fill: 'accent', enter: 'none' },
        text('BUTTON', round(inner.x + bw / 2), round(Y(rows.link) + bh / 2 + fs.button * 0.36), fs.button, 'semibold', 'bg', { anchor: 'middle', fit: bw - 48 }),
      ]),
      ...(attach
        ? [
            arrive(4, [
              { type: 'rect', x: inner.x, y: Y(rows.attachment), w: rows.attachment.w, h: 64, r: 16, fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
              { type: 'icon', name: 'file', x: inner.x + 36, y: Y(rows.attachment) + 32, size: 32, stroke: 'muted', enter: 'none' },
              text('FILE', inner.x + 66, round(Y(rows.attachment) + 32 + fs.file * 0.36), fs.file, 'semibold', 'ink', { fit: rows.attachment.w - 86 }),
            ]),
          ]
        : []),
    ];

    // The marks: a tinted band and a ring drawn round the part, then a connector out to a badge
    // and the label, in that order from the moment.
    const right = w - (side ? 120 : 60);
    const markEls = marks.flatMap((part, i) => {
      const cue = NAMES[i],
        at = AT[cue];
      const r = ringOf(part);
      const timed = (after, extra) => ({ cue, at: round(at + after), after, ...extra });
      // Where the connector leaves the ring, and where the badge sits.
      const [ax, ay] = side ? [r.x + r.w, round(r.y + r.h / 2)] : [inner.x + badge, r.y + r.h];
      const [bx, by] = side ? [lx + badge, ay] : [ax, round(ay + callout / 2 + 8)];
      const [ex, ey] = side ? [lx, ay] : [ax, by - badge];
      const tx = bx + badge + 18;
      return [
        { type: 'rect', ...r, r: 16, fill: color, opacity: 0.1, ...timed(0, { enter: 'fade', dur: 0.4 }) },
        { type: 'rect', ...r, r: 16, fill: 'none', stroke: color, width: 4, ...timed(0, { enter: 'draw', dur: 0.55 }) },
        { type: 'circle', cx: ax, cy: ay, r: 7, fill: color, ...timed(0.4, { enter: 'pop', dur: 0.25 }) },
        { type: 'line', x1: ax, y1: ay, x2: ex, y2: ey, stroke: color, width: 3, cap: 'round', ...timed(0.45, { enter: 'draw', dur: side ? 0.35 : 0.2 }) },
        {
          type: 'group',
          origin: [bx, by],
          ...timed(side ? 0.75 : 0.6, { enter: 'pop', dur: 0.35 }),
          children: [
            { type: 'circle', cx: bx, cy: by, r: badge, fill: color, enter: 'none' },
            { type: 'icon', name: ICON[color], x: bx, y: by, size: round(badge * 1.15), stroke: 'bg', enter: 'none' },
          ],
        },
        text(LABELS[i], tx, round(by + fs.label * 0.36), fs.label, 'bold', 'ink', {
          fit: (side ? right : card.x + cw - pad) - tx,
          ...timed(side ? 0.85 : 0.7, { enter: 'rise', dur: 0.4, dist: 16 }),
        }),
      ];
    });

    // The view leans in on each mark: a slight push about the annotation, kept inside the body.
    const O = [round(w / 2), round(card.y + ch / 2)];
    const box = { x1: card.x - 10, y1: card.y - 10, x2: side ? Math.min(right, lx + labelW) : card.x + cw + 10, y2: card.y + ch + 30 };
    const room = side
      ? { x1: 90, y1: 290, x2: w - 90, y2: h - 140 }
      : { x1: 24, y1: T ? b.y - 160 : 150, x2: w - 24, y2: T ? b.y + b.h + 80 : h - 110 };
    const scale = side ? 1.06 : 1.03;
    const clamp = (v, lo, hi) => (lo > hi ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, v)));
    const lean = (part, i) => {
      const r = ringOf(part);
      const F = side ? [(r.x + box.x2) / 2, r.y + r.h / 2] : [w / 2, r.y + r.h / 2 + callout / 2];
      const C = [w / 2, (room.y1 + room.y2) / 2];
      const after = (v, o) => o + scale * (v - o);
      const dx = clamp((1 - scale) * (F[0] - O[0]) + 0.12 * (C[0] - F[0]), room.x1 - after(box.x1, O[0]), room.x2 - after(box.x2, O[0]));
      const dy = clamp((1 - scale) * (F[1] - O[1]) + 0.12 * (C[1] - F[1]), room.y1 - after(box.y1, O[1]), room.y2 - after(box.y2, O[1]));
      return { cue: NAMES[i], at: AT[NAMES[i]], dur: 1.0, ease: 'inOut', scale, x: round(dx), y: round(dy) };
    };

    return {
      elements: [
        {
          type: 'group',
          enter: 'none',
          cue: 'OPEN',
          at: AT.OPEN,
          origin: O,
          keys: marks.map(lean),
          children: [
            { type: 'group', enter: 'rise', cue: 'OPEN', at: AT.OPEN, dur: 0.6, dist: 40, children: cardEls },
            ...markEls,
          ],
        },
      ],
    };
  },
};
