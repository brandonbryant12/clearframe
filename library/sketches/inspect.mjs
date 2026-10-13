import { crisp, round, tall, body } from '../../film/sketch-kit.mjs';

// Look closely at a message: an email card arrives (sender, subject, two body lines, a link
// button and, if asked, an attachment), then up to three of its parts are marked in turn. Each
// mark rings the part, draws a connector out to a short label and the view leans in on it: the
// labels stand beside the card in wide frames and just under their part in narrow ones (the
// marks are known when the card is laid out, so the room for them is there from the start).
// Which part each mark points at is a param, so one drawing serves phishing tells, a receipt's
// must-haves or the clause to check. Moments: OPEN (the card arrives), then ONE, TWO, THREE.
// With `report`, the same message carries a Report phish button in a toolbar along its top from
// the first frame, and a last moment, REPORT, does the habit on it: the view settles, the pointer
// reaches the button, which lights solid and is pressed; the marks fade, a shield pops up and the
// whole message shrinks into it, the shield pulses and a confirmation pops up under it. Every step
// is a solid change over a large part of the frame, so it reads on a phone and in a pale palette.
// With `choices`, the two wrong moves come first, on the same card: on CLICK the pointer reaches
// the link, the card is tugged and a no sign lands on the button; on DELETE it reaches a bin in
// the toolbar, the card starts to fold into it and a no sign lands on the bin; then REPORT.
// One card across two beats: the first ends after the marks (`end: "marked"`: the toolbar is
// drawn, the later moments are left out) and the second opens on the card as it stands then
// (`start: "marked"`), so only CLICK, DELETE and REPORT remain to cue.
const PARTS = ['sender', 'subject', 'body', 'link', 'attachment'];
const NAMES = ['ONE', 'TWO', 'THREE'];
const LABELS = ['MARKONE', 'MARKTWO', 'MARKTHREE'];
const ICON = { negative: 'alert', positive: 'check', accent: 'search', accent2: 'search' };
const AT = { OPEN: 0.3, ONE: 1.8, TWO: 3.5, THREE: 5.2 };
// REPORT's default second: this long after the last mark (its label has landed by then).
const REPORT_AFTER = 1.9;
// With choices, CLICK takes REPORT's place and DELETE and REPORT follow this far apart.
const CHOICE_GAP = 1.5;
// CLICK and DELETE, in seconds after the moment: the pointer reaches the control and presses it
// as the card reacts, then the no sign lands (quick: "don't just delete it. Report it" leaves
// under a second between the words).
const CHOICE = { reach: 0.4, sign: 0.5 };
// In a beat that opens on the marked card, the first moment left comes this soon after the cut.
const RESUME_AT = 0.5;
// The moments a marked card has had, and the ones that follow them.
const SHOWN = new Set(['OPEN', ...NAMES]);
const LATER = new Set(['CLICK', 'DELETE', 'REPORT']);
const cursorPath = (x, y, k) =>
  `M ${x} ${y} L ${x} ${round(y + 40 * k)} L ${round(x + 10 * k)} ${round(y + 31 * k)} L ${round(x + 17 * k)} ${round(y + 47 * k)} L ${round(x + 25 * k)} ${round(y + 44 * k)} L ${round(x + 18 * k)} ${round(y + 28 * k)} L ${round(x + 31 * k)} ${round(y + 28 * k)} Z`;

export default {
  name: 'inspect',
  order: 95,
  keep: true,
  summary:
    'Look closely at a message: an email card arrives, then up to three of its parts are ringed in turn, each with a connector out to a short label, and the view leans in on each mark; optionally the same message is then reported, its Report phish button pressed and the message shrinking into a security shield with a confirmation (after a refused click and a refused delete, with choices), in the same beat or in a second beat on the same card.',
  use: 'Phishing tells (an urgent subject, an almost-right sender, an unexpected link), a receipt’s or payslip’s must-haves, the line in a notice to check. Replace FROM (the sender line, up to about 40 characters), SUBJECT (up to about 40), LINE1 and LINE2 (two short body lines), BUTTON (the link’s words), FILE (the attachment’s name, when drawn) and MARKONE, MARKTWO, MARKTHREE (the labels, two to four words each) with sketchText; land OPEN (the card arriving) and ONE, TWO, THREE (one per mark) on words with sketchSay. sketchParams: marks (which part each mark rings, in order: sender, subject, body, link or attachment), attachment (true draws the attachment chip), color (negative for warning signs, positive for what to look for, accent for points of interest) and report. For phishing training, report true makes the action the same email instead of a slide: the message carries a Report phish button in its toolbar from the first frame (fill REPORTBUTTON, one or two words, e.g. "Report phish") and a last moment, REPORT, comes after THREE (the order is OPEN, ONE, TWO, THREE, REPORT): on it the pointer presses the button, which lights; the marks fade, the message shrinks into a security shield and a confirmation pops up (fill REPORTED, up to about 30 characters, e.g. "Reported to Security. Thanks."). Land REPORT on the word that says the action ("report"). For "don’t click, don’t just delete, report", choices true (with report) adds a bin to the toolbar and two moments between THREE and REPORT (the order is OPEN, ONE, TWO, THREE, CLICK, DELETE, REPORT): on CLICK the pointer presses the link, the card is tugged and a no sign lands on the button; on DELETE it presses the bin, the card starts to fold into it and a no sign lands on the bin. Land them on "click" and "delete". To give the signs and the habit a beat each on one card, give both beats the same sketchParams plus end "marked" on the first (it stops after THREE, toolbar already drawn) and start "marked" on the second (it opens on the marked card, so its moments are only CLICK, DELETE and REPORT), transition "cut" on the second and camera "none" on the first (the default slow push would leave the card larger than the second beat opens on it).',
  params: {
    marks: {
      default: ['subject', 'sender', 'link'],
      list: true,
      length: [1, 3],
      about: 'the part each mark rings, in order: sender, subject, body, link or attachment (1–3, each once)',
    },
    attachment: { default: false, about: 'true draws an attachment chip (fill FILE); marking "attachment" draws it too' },
    color: { default: 'negative', about: 'colour of the marks: negative (warning signs), positive (what to look for), accent or accent2' },
    report: {
      default: false,
      about:
        'true adds the Report phish step: a REPORTBUTTON button in the message’s toolbar from the first frame, and a last moment, REPORT, after the marks (order OPEN → ONE → TWO → THREE → REPORT), on which the pointer presses the button, the marks fade, the message shrinks into a security shield and a confirmation (REPORTED) pops up',
    },
    choices: {
      default: false,
      about:
        'true (with report) does "don’t click, don’t just delete, report" on the same email: a bin joins the toolbar and two moments come before REPORT (order OPEN → ONE → TWO → THREE → CLICK → DELETE → REPORT): on CLICK the pointer reaches the link, the card is tugged and a no sign lands on the button; on DELETE it reaches the bin, the card starts to fold into it and a no sign lands on the bin',
    },
    start: {
      default: 'open',
      oneOf: ['open', 'marked'],
      about:
        'open (the default): the card arrives on OPEN. marked (with report): a second beat on the same card: it stands from the first frame with its marks and labels drawn and the view leaning in as after THREE, so only CLICK, DELETE (with choices) and REPORT remain to cue (order CLICK → DELETE → REPORT). Give the beat before it the same sketchParams with end "marked" and camera "none", and cut between them',
    },
    end: {
      default: 'last',
      oneOf: ['last', 'marked'],
      about:
        'last (the default): the beat runs to its last moment. marked (with report): the beat ends after THREE with the report toolbar (and the bin, with choices) already drawn, leaving CLICK, DELETE and REPORT to the next beat (start "marked", the same sketchParams otherwise), so the card is the same on both sides of the cut; give this beat camera "none" so the default push does not enlarge it',
    },
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
    if (params.report != null && typeof params.report !== 'boolean') throw new Error('sketchParams.report for inspect must be true or false');
    if (params.choices != null && typeof params.choices !== 'boolean') throw new Error('sketchParams.choices for inspect must be true or false');
    if (params.start != null && !['open', 'marked'].includes(params.start)) throw new Error('sketchParams.start for inspect must be "open" or "marked"');
    if (params.end != null && !['last', 'marked'].includes(params.end)) throw new Error('sketchParams.end for inspect must be "last" or "marked"');
    const attach = params.attachment === true || marks.includes('attachment');
    const report = params.report === true;
    const choices = params.choices === true;
    // A beat that opens on the marked card (start) or stops at it (end) shares the card with a
    // beat that reports it.
    const standing = params.start === 'marked',
      stopping = params.end === 'marked';
    if (choices && !report) throw new Error('sketchParams.choices for inspect needs report: true (CLICK and DELETE come before REPORT)');
    if ((standing || stopping) && !report)
      throw new Error(
        `sketchParams.${standing ? 'start' : 'end'} "marked" for inspect needs report: true: it splits the marks and the report step (CLICK, DELETE with choices, REPORT) into two beats on one card`,
      );
    if (standing && stopping) throw new Error('sketchParams for inspect: start "marked" with end "marked" leaves no moment; use one on each of two beats');

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
    // With report, a toolbar runs along the card's top (the Report phish button at its right).
    const bar = report ? (side ? 84 : compact ? 72 : 92) : 0;

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
    const ch = cur + 2 * pad + bar;
    // The toolbar may lift the card into the room a title would take (these beats have none).
    const cy0 = round(side ? Math.max(b.y - 10 - bar, b.y + (b.h - ch) / 2 - 10) : Math.max(T ? b.y - 120 : 170, b.y + (b.h - ch) / 2 - (T ? 40 : 0) - (compact ? bar / 2 : 0)));
    const card = { x: cx0, y: cy0, w: cw, h: ch };
    const inner = { x: card.x + pad, y: card.y + bar + pad, w: cw - 2 * pad };
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

    // REPORT's default second and its steps (seconds after the moment): the view settles and the
    // pointer travels, the button lights and is pressed, the marks fade, the shield pops up, the
    // message shrinks into it, the shield pulses as it lands and the confirmation pops up.
    const STEP = { light: 0.4, fade: 0.5, shield: 0.7, fly: 0.85, land: 1.5, toast: 1.6 };
    // The first moment after the marks (CLICK with choices, else REPORT): after the last label
    // has landed, or just after the cut on a card that opens marked.
    const resume = standing ? RESUME_AT : round(AT[NAMES[marks.length - 1]] + REPORT_AFTER);
    const momentAt = { CLICK: resume, DELETE: round(resume + CHOICE_GAP), REPORT: choices ? round(resume + 2 * CHOICE_GAP) : resume };
    const timedOn = (cue, dt = 0, extra = {}) => ({ cue, at: round(momentAt[cue] + dt), ...(dt ? { after: round(dt) } : {}), ...extra });
    const cued = (dt, extra = {}) => timedOn('REPORT', dt, extra);

    // The toolbar: a strip along the card's top (back, move and mark-unread chrome at the left) with
    // the Report phish button at its right, outlined until REPORT lights it solid.
    const btn = report ? { w: side ? 300 : compact ? 276 : 330, h: side ? 58 : compact ? 52 : 64 } : null;
    if (btn) Object.assign(btn, { x: card.x + cw - (side ? 22 : 18) - btn.w, y: round(card.y + (bar - btn.h) / 2) });
    const btnC = btn && [round(btn.x + btn.w / 2), round(btn.y + btn.h / 2)];
    const btnFs = side ? 28 : compact ? 27 : 31;
    const btnFace = (ink, icon) => {
      const ix = round(btn.x + btn.h * 0.52),
        tx = round((btn.x + btn.h * 0.86 + btn.x + btn.w - 14) / 2);
      return [
        { type: 'icon', name: 'hook', x: ix, y: btnC[1], size: round(btn.h * 0.52), stroke: icon, enter: 'none' },
        text('REPORTBUTTON', tx, round(btnC[1] + btnFs * 0.36), btnFs, 'semibold', ink, { anchor: 'middle', fit: round(btn.x + btn.w - 14 - (btn.x + btn.h * 0.86)) }),
      ];
    };
    const chrome = round(bar * 0.36);
    // With choices, a bin (delete) follows the folder and mail icons, drawn in their line weight
    // (the icon set has no bin).
    const binC = [round(card.x + pad + chrome * 6.5), round(card.y + bar / 2)];
    const binEls = () => {
      const [x, y] = binC,
        s = chrome,
        P = (dx, dy) => `${round(x + dx * s)} ${round(y + dy * s)}`;
      const ink = { fill: 'none', stroke: 'muted', width: 3, cap: 'round', join: 'round', enter: 'none' };
      return [
        { type: 'path', d: `M ${P(-0.42, -0.26)} L ${P(0.42, -0.26)} M ${P(-0.13, -0.26)} L ${P(-0.13, -0.41)} L ${P(0.13, -0.41)} L ${P(0.13, -0.26)}`, ...ink },
        { type: 'path', d: `M ${P(-0.31, -0.13)} L ${P(-0.25, 0.42)} L ${P(0.25, 0.42)} L ${P(0.31, -0.13)} M ${P(-0.09, -0.02)} L ${P(-0.09, 0.28)} M ${P(0.09, -0.02)} L ${P(0.09, 0.28)}`, ...ink },
      ];
    };
    const toolbar = report
      ? [
          { type: 'rect', x: card.x + 1, y: card.y + 1, w: cw - 2, h: bar - 1, r: 27, fill: 'bg', enter: 'none' },
          { type: 'rect', x: card.x + 1, y: card.y + bar - 28, w: cw - 2, h: 28, fill: 'bg', enter: 'none' },
          { type: 'line', x1: card.x, y1: card.y + bar, x2: card.x + cw, y2: card.y + bar, stroke: 'line', width: 2, enter: 'none' },
          {
            type: 'path',
            d: `M ${round(card.x + pad + chrome * 0.3)} ${round(card.y + bar / 2 - chrome * 0.5)} L ${round(card.x + pad - chrome * 0.25)} ${round(card.y + bar / 2)} L ${round(card.x + pad + chrome * 0.3)} ${round(card.y + bar / 2 + chrome * 0.5)}`,
            fill: 'none',
            stroke: 'muted',
            width: 3,
            cap: 'round',
            join: 'round',
            enter: 'none',
          },
          ...['folder', 'mail'].map((name, i) => ({ type: 'icon', name, x: round(card.x + pad + chrome * (2.4 + 1.9 * i)), y: round(card.y + bar / 2), size: chrome, stroke: 'muted', enter: 'none' })),
          ...(choices ? binEls() : []),
          {
            type: 'group',
            enter: 'none',
            origin: btnC,
            keys: [cued(STEP.light, { dur: 0.3, ease: 'thereAndBack', scale: 0.92 })],
            children: [
              { type: 'rect', ...btn, r: round(btn.h / 2), fill: 'surface', stroke: 'line', width: 2, enter: 'none' },
              ...btnFace('ink', 'positive'),
              {
                type: 'group',
                enter: 'fade',
                dur: 0.2,
                ...cued(STEP.light),
                children: [{ type: 'rect', ...btn, r: round(btn.h / 2), fill: 'positive', enter: 'none', glow: { blur: 26, opacity: 0.45 } }, ...btnFace('bg', 'bg')],
              },
            ],
          },
        ]
      : [];

    const sy = Y(rows.sender);
    const cardEls = [
      { type: 'rect', ...card, r: 28, fill: 'surface', stroke: 'line', width: 2, enter: 'none', shadow: { blur: 44, dy: 22, opacity: 0.16 } },
      ...toolbar,
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
      {
        ...arrive(3, [
          { type: 'rect', x: inner.x, y: Y(rows.link), w: bw, h: bh, r: bh / 2, fill: 'accent', enter: 'none' },
          text('BUTTON', round(inner.x + bw / 2), round(Y(rows.link) + bh / 2 + fs.button * 0.36), fs.button, 'semibold', 'bg', { anchor: 'middle', fit: bw - 48 }),
        ]),
        // With choices, the link greys out as its no sign lands on CLICK.
        ...(choices ? { keys: [timedOn('CLICK', CHOICE.sign, { dur: 0.3, opacity: 0.4 })] } : {}),
      },
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

    const cardGroup = { type: 'group', enter: 'rise', cue: 'OPEN', at: AT.OPEN, dur: 0.6, dist: 40, children: cardEls };
    if (!report)
      return {
        elements: crisp([
          {
            type: 'group',
            enter: 'none',
            cue: 'OPEN',
            at: AT.OPEN,
            origin: O,
            keys: marks.map(lean),
            children: [cardGroup, ...markEls],
          },
        ]),
      };

    // REPORT. The view settles back square (so the steps below are drawn where they land) and the
    // marks fade; a shield pops up clear of the message (where the labels stood in a wide frame,
    // above the card in a narrow one), and the message, toolbar and all, travels into it and
    // shrinks to nothing. In a wide frame the shield pulses and a confirmation pops up in the
    // message's place beside it; in a narrow one the shield settles to the middle and the
    // confirmation pops up under it.
    const R = side ? 116 : compact ? 84 : 124;
    const C = [round(card.x + cw / 2), round(card.y + ch / 2)];
    const D = side ? [round(Math.min(lx + labelW / 2, w - 120 - R)), C[1]] : [round(w / 2), round(Math.max(R + 40, card.y - (compact ? 36 : 56) - R))];
    const toast = { w: side ? 780 : Math.min(cw - 40, compact ? 820 : 880), h: side ? 100 : compact ? 92 : 110 };
    const toastFs = side ? 37 : compact ? 34 : 40;
    const gapT = compact ? 40 : 52;
    const F = side ? D : [D[0], round(C[1] - (2 * R + gapT + toast.h) / 2 + R)];
    Object.assign(toast, { x: round((side ? C[0] : w / 2) - toast.w / 2), y: side ? round(C[1] - toast.h / 2) : F[1] + R + gapT });
    const tcy = round(toast.y + toast.h / 2);
    // The message leaves about the view's own origin O (which shares the card's centre line):
    // scaled to almost nothing, its centre lands on the shield's.
    const fly = 0.05;
    const leave = [
      cued(STEP.fly, { dur: round(STEP.land - STEP.fly), ease: 'inOut', scale: fly, x: round(D[0] - O[0] - fly * (C[0] - O[0])), y: round(D[1] - O[1] - fly * (C[1] - O[1])) }),
      cued(STEP.land - 0.12, { dur: 0.12, opacity: 0 }),
    ];
    // A ring that spreads from a point and fades: the press, and the message landing (in the shield).
    const ripple = (at, r, dt, stroke) => ({
      type: 'circle',
      cx: at[0],
      cy: at[1],
      r,
      ...(stroke ? { fill: 'none', stroke: 'positive', width: 6 } : { fill: 'positive' }),
      enter: 'none',
      at: 0,
      origin: at,
      keys: [{ at: 0, dur: 0, opacity: 0 }, cued(dt, { dur: 0, opacity: stroke ? 0.6 : 0.35, scale: stroke ? 1 : 0.3 }), cued(dt, { dur: 0.55, ease: 'out', opacity: 0, scale: stroke ? 1.7 : 1.5 })],
    });
    const shield = {
      type: 'group',
      enter: 'pop',
      dur: 0.35,
      ...cued(STEP.shield),
      origin: D,
      keys: side
        ? [cued(STEP.land, { dur: 0.4, ease: 'thereAndBack', scale: 1.14 })]
        : [cued(STEP.land + 0.05, { dur: 0.45, ease: 'inOut', x: F[0] - D[0], y: F[1] - D[1] })],
      children: [
        { type: 'circle', cx: D[0], cy: D[1], r: R, fill: 'positive', enter: 'none', glow: { blur: 36, opacity: 0.4 }, shadow: { blur: 30, dy: 12, opacity: 0.18 } },
        { type: 'icon', name: 'shield', x: D[0], y: D[1], size: round(R * 1.08), stroke: 'bg', enter: 'none' },
        // The ring travels with the shield as it settles.
        ripple(D, R, STEP.land, true),
      ],
    };
    const done = {
      type: 'group',
      enter: 'pop',
      dur: 0.4,
      origin: [round(toast.x + toast.w / 2), tcy],
      ...cued(side ? STEP.toast : STEP.land + 0.35),
      children: [
        { type: 'rect', ...toast, r: round(toast.h / 2), fill: 'ink', enter: 'none', shadow: { blur: 24, dy: 10, opacity: 0.18 } },
        { type: 'circle', cx: toast.x + round(toast.h / 2), cy: tcy, r: round(toastFs * 0.75), fill: 'positive', enter: 'none' },
        { type: 'icon', name: 'check', x: toast.x + round(toast.h / 2), y: tcy, size: round(toastFs * 0.95), stroke: 'bg', enter: 'none' },
        text('REPORTED', toast.x + toast.h + 4, round(tcy + toastFs * 0.36), toastFs, 'semibold', 'bg', { fit: toast.w - toast.h - 4 - 36 }),
      ],
    };
    // The pointer comes in from below the button, presses it, and steps aside as the marks fade.
    const k = side ? 1.2 : compact ? 1.25 : 1.4;
    const start = [Math.min(w - round(60 * k), btnC[0] + (side ? 170 : 70)), btnC[1] + (side ? 300 : 280)];
    const tip = [btnC[0] + 6 - start[0], btnC[1] + 8 - start[1]];
    const pointer = {
      type: 'path',
      d: cursorPath(start[0], start[1], k),
      fill: 'ink',
      stroke: 'surface',
      width: 3,
      join: 'round',
      enter: 'fade',
      dur: 0.15,
      ...cued(0),
      keys: [cued(0, { dur: STEP.light, ease: 'inOut', x: tip[0], y: tip[1] }), cued(STEP.light + 0.35, { dur: 0.3, ease: 'in', x: tip[0] + 40, y: tip[1] + 60, opacity: 0 })],
    };

    // CHOICES (choices: true): the two wrong moves, each refused on the card itself. On CLICK the
    // view settles square, the pointer comes in from below the link and presses it, the card is
    // tugged up (the pointer with it), the link greys and a no sign lands on it. On DELETE the
    // pointer moves up to the bin and presses it, the card shrinks toward the bin (about the bin
    // itself, so it stays under the pointer), holds and springs back, and a no sign lands on the
    // bin. The no signs fade with the marks on REPORT, and the same pointer goes on from the bin to
    // Report phish.
    const linkC = [round(inner.x + bw / 2), round(Y(rows.link) + bh / 2)];
    const noSign = (c, r, cue, dt) => {
      const wN = side ? 10 : 9,
        d = round(r * 0.7);
      return {
        type: 'group',
        origin: c,
        enter: 'pop',
        dur: 0.3,
        ...timedOn(cue, dt),
        children: [
          { type: 'circle', cx: c[0], cy: c[1], r, fill: 'bg', opacity: 0.55, enter: 'none' },
          { type: 'circle', cx: c[0], cy: c[1], r, fill: 'none', stroke: 'negative', width: wN, enter: 'none' },
          { type: 'line', x1: c[0] - d, y1: c[1] - d, x2: c[0] + d, y2: c[1] + d, stroke: 'negative', width: wN, cap: 'round', enter: 'none' },
        ],
      };
    };
    const refused = choices ? [noSign(linkC, round(bh * 0.72), 'CLICK', CHOICE.sign), noSign(binC, round(bar * 0.44), 'DELETE', CHOICE.sign)] : [];
    const fold = 0.84,
      tug = side ? -46 : -56;
    const choiceKeys = choices
      ? [
          timedOn('CLICK', 0, { dur: CHOICE.reach, ease: 'inOut', scale: 1, x: 0, y: 0 }),
          timedOn('CLICK', CHOICE.reach, { dur: 0.5, ease: 'thereAndBack', y: tug, rotate: side ? -1.5 : -1 }),
          timedOn('DELETE', CHOICE.reach, { dur: 0.75, ease: 'thereAndBackPause', scale: fold, x: round((1 - fold) * (binC[0] - O[0])), y: round((1 - fold) * (binC[1] - O[1])) }),
        ]
      : [];
    const p0 = [Math.min(w - round(60 * k), linkC[0] + (side ? 240 : 190)), Math.min(h - round(90 * k), linkC[1] + (side ? 220 : 260))];
    const toTip = c => ({ x: round(c[0] + 6 - p0[0]), y: round(c[1] + 8 - p0[1]) });
    // The pointer presses the link on its right half, clear of the no sign and of a label under it.
    const linkHit = [round(linkC[0] + bw * 0.24), round(linkC[1] - bh * 0.2)];
    const press = cue => timedOn(cue, CHOICE.reach, { dur: 0.25, ease: 'thereAndBack', scale: 0.82 });
    const guide = choices && {
      type: 'path',
      d: cursorPath(p0[0], p0[1], k),
      fill: 'ink',
      stroke: 'surface',
      width: 3,
      join: 'round',
      enter: 'fade',
      dur: 0.15,
      origin: p0,
      ...timedOn('CLICK'),
      keys: [
        timedOn('CLICK', 0, { dur: CHOICE.reach, ease: 'inOut', ...toTip(linkHit) }),
        press('CLICK'),
        // Caught: the pointer is yanked up with the card, and let go.
        timedOn('CLICK', CHOICE.reach, { dur: 0.5, ease: 'thereAndBack', y: toTip(linkHit).y + tug }),
        timedOn('DELETE', 0, { dur: CHOICE.reach, ease: 'inOut', ...toTip(binC) }),
        press('DELETE'),
        cued(0, { dur: STEP.light, ease: 'inOut', ...toTip(btnC) }),
        cued(STEP.light + 0.35, { dur: 0.3, ease: 'in', x: toTip(btnC).x + 40, y: toTip(btnC).y + 60, opacity: 0 }),
      ],
    };

    // A card that opens marked stands from the first frame as THREE left it: its entrances done
    // and the view held in the last lean.
    const stand = list =>
      list.map(el => {
        const out = { ...el };
        if (SHOWN.has(out.cue)) {
          for (const key of ['cue', 'at', 'after', 'dur', 'dist']) delete out[key];
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
    const prune = list =>
      list.flatMap(el => {
        if (LATER.has(el.cue)) return [];
        const out = { ...el };
        if (out.keys) {
          out.keys = out.keys.filter(key => !LATER.has(key.cue));
          if (!out.keys.length) delete out.keys;
        }
        if (out.children) out.children = prune(out.children);
        return [out];
      });
    const marksGroup = { type: 'group', enter: 'none', keys: [cued(STEP.fade, { dur: 0.3, opacity: 0 })], children: [...markEls, ...refused] };
    const view = {
      type: 'group',
      enter: 'none',
      ...(standing ? { at: 0 } : { cue: 'OPEN', at: AT.OPEN }),
      origin: O,
      keys: [...(standing ? leaned() : marks.map(lean)), ...choiceKeys, cued(0, { dur: STEP.light, ease: 'inOut', scale: 1, x: 0, y: 0 }), ...leave],
      children: standing ? stand([cardGroup, marksGroup]) : [cardGroup, marksGroup],
    };
    if (stopping) return { elements: crisp(prune([view])) };
    return {
      elements: crisp([view, ripple(btnC, round(btn.h * 0.8), STEP.light), shield, done, guide || pointer]),
    };
  },
};
