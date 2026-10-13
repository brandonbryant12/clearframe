import { round, tall, body } from '../../film/sketch-kit.mjs';

// Two options compared row by row: two cards stand side by side (stacked in tall frames), the
// rows arrive one at a time and each row ticks the option that wins it; at the end one card is
// chosen and lifts forward while the other recedes. Who wins each row and which card is chosen
// are params, so the picture says exactly what the narration does. Moments: ONE, TWO, THREE,
// FOUR (one per row) and PICK.
const NAMES = ['ONE', 'TWO', 'THREE', 'FOUR'];
const LABELS = ['ROWONE', 'ROWTWO', 'ROWTHREE', 'ROWFOUR'];
const WINS = ['a', 'b', 'both', 'neither'];
const ROW0 = 1.3,
  STEP = 1.2;

export default {
  name: 'choose',
  order: 96,
  keep: true,
  summary:
    'Two options compared row by row: two cards side by side (stacked in tall frames), each row ticks the option that wins it, and at the end the chosen card lifts forward while the other recedes.',
  use: 'Two plans, two funds, two ways to pay, two policies: "the HSA saves on tax, the PPO costs less to visit, so for you…". Replace AOPTION and BOPTION (the two names) and ROWONE…ROWFOUR (what each row compares, two to four words; one per row) with sketchText; land ONE…FOUR (each row) and PICK (the choice) on words with sketchSay. sketchParams: rows (who wins each row, in order: a, b, both or neither; 1–4 rows) and pick (a, b, or none to leave the choice open).',
  params: {
    rows: { default: ['a', 'b', 'a'], list: true, length: [1, 4], about: 'who wins each row, in order: a, b, both or neither (1–4 rows)' },
    pick: { default: 'a', about: 'the option chosen at the end: a, b, or none (no choice; PICK is then not a moment)' },
  },
  build(w, h, { params = {} } = {}) {
    const rows = params.rows ?? ['a', 'b', 'a'];
    const pick = params.pick ?? 'a';
    if (!Array.isArray(rows) || !rows.length || rows.length > 4) throw new Error('sketchParams.rows for choose takes 1–4 rows');
    for (const r of rows) if (!WINS.includes(r)) throw new Error(`sketchParams.rows for choose: "${r}" must be ${WINS.join(', ')}`);
    if (!['a', 'b', 'none'].includes(pick)) throw new Error('sketchParams.pick for choose must be a, b or none');
    const n = rows.length;
    const AT = Object.fromEntries(NAMES.slice(0, n).map((k, i) => [k, round(ROW0 + i * STEP)]));
    AT.PICK = round(ROW0 + (n - 1) * STEP + 1.6);

    const T = tall(w, h);
    const b = body(w, h);
    // Stacked cards need the height of a full vertical frame; anything shorter sits side by side.
    const stacked = T && h >= 1600;
    const colors = ['accent', 'accent2'];
    const sides = ['a', 'b'];
    const wins = (row, s) => row === 'both' || row === s;
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, enter: 'none', ...extra });

    // Layout: card rects, row centres and (side by side) a label column between the cards.
    let cards, rowY, labelX, labelW, labelSize, narrowCards = false;
    const head = stacked ? 124 : 150;
    const rh = stacked ? 94 : n > 3 ? 106 : n > 2 ? 124 : 132;
    const foot = stacked ? 22 : 34;
    const ch = head + n * rh + foot;
    if (stacked) {
      const cw = w - 180,
        gap = 56;
      const y0 = round(b.y + (b.h - (2 * ch + gap)) / 2 - 30);
      cards = [0, 1].map(i => ({ x: round((w - cw) / 2), y: round(y0 + i * (ch + gap)), w: cw, h: ch }));
      rowY = (c, i) => round(cards[c].y + head + rh * (i + 0.5));
    } else {
      const unit = Math.min(1, b.w / 1600);
      const cw = round(480 * unit),
        gap = round(40 * unit);
      labelW = round(560 * unit);
      const x0 = round((w - (2 * cw + labelW + 2 * gap)) / 2);
      const y0 = round(Math.max(b.y - 20, b.y + (b.h - ch) / 2 - 10));
      cards = [0, 1].map(i => ({ x: round(x0 + i * (cw + labelW + 2 * gap)), y: y0, w: cw, h: ch }));
      labelX = round(w / 2);
      labelSize = round(42 * Math.max(unit, 0.76));
      narrowCards = unit < 0.8;
      rowY = (c, i) => round(y0 + head + rh * (i + 0.5));
    }

    // A row's mark: a tick in a filled disc for the winner, a quiet dash for the other.
    const mark = (c, i, cx, cy) => {
      const cue = NAMES[i],
        win = wins(rows[i], sides[c]);
      const after = round(0.15 + c * 0.08);
      const timed = { cue, at: round(AT[cue] + after), after };
      return win
        ? {
            type: 'group',
            origin: [cx, cy],
            enter: 'pop',
            dur: 0.4,
            ...timed,
            children: [
              { type: 'circle', cx, cy, r: stacked ? 31 : 34, fill: colors[c], enter: 'none' },
              { type: 'icon', name: 'check', x: cx, y: cy, size: stacked ? 38 : 42, stroke: 'bg', enter: 'none' },
            ],
          }
        : { type: 'line', x1: cx - 16, y1: cy, x2: cx + 16, y2: cy, stroke: 'muted', width: 5, cap: 'round', opacity: 0.55, enter: 'grow-x', dur: 0.3, ...timed };
    };

    const card = c => {
      const r = cards[c];
      const pad = stacked ? 44 : 32;
      const chosen = pick === sides[c],
        other = pick !== 'none' && !chosen;
      const centre = [round(r.x + r.w / 2), round(r.y + r.h / 2)];
      const markX = stacked ? r.x + pad + 28 : centre[0];
      return {
        type: 'group',
        enter: 'rise',
        at: round(0.2 + c * 0.15),
        dur: 0.6,
        dist: 40,
        origin: centre,
        keys: pick === 'none' ? [] : [{ cue: 'PICK', at: AT.PICK, dur: 0.8, ease: 'inOut', ...(chosen ? { scale: 1.05, y: stacked ? 0 : -10 } : { scale: 0.96, opacity: 0.45 }) }],
        children: [
          { type: 'rect', ...r, r: 28, fill: 'surface', stroke: 'line', width: 2, enter: 'none', shadow: { blur: 40, dy: 20, opacity: 0.14 } },
          // The header: the option's name over a short bar in its colour.
          stacked
            ? text(sides[c] === 'a' ? 'AOPTION' : 'BOPTION', r.x + pad + 26, round(r.y + head / 2 + 16), 46, 'bold', 'ink', { fit: r.w - 2 * pad - 26 })
            : narrowCards
              ? // Narrow cards (square, portrait) let a long name take two lines.
                text(sides[c] === 'a' ? 'AOPTION' : 'BOPTION', centre[0], round(r.y + 56), 36, 'bold', 'ink', { anchor: 'middle', width: r.w - 2 * pad + 16, height: 80, leading: 1.05 })
              : text(sides[c] === 'a' ? 'AOPTION' : 'BOPTION', centre[0], round(r.y + 82), 50, 'bold', 'ink', { anchor: 'middle', fit: r.w - 2 * pad }),
          stacked
            ? { type: 'rect', x: r.x + pad, y: round(r.y + head / 2 - 22), w: 8, h: 44, r: 4, fill: colors[c], enter: 'none' }
            : { type: 'rect', x: centre[0] - 32, y: r.y + (narrowCards ? 116 : 108), w: 64, h: 8, r: 4, fill: colors[c], enter: 'none' },
          ...rows.map((_, i) => ({
            type: 'line',
            x1: r.x + pad,
            y1: round(r.y + head + rh * i),
            x2: r.x + r.w - pad,
            y2: round(r.y + head + rh * i),
            stroke: 'line',
            width: 2,
            enter: 'none',
          })),
          ...rows.map((_, i) => mark(c, i, markX, rowY(c, i))),
          // Stacked cards carry the row names themselves, quieter where the option loses.
          ...(stacked
            ? rows.map((row, i) =>
                text(LABELS[i], markX + 52, round(rowY(c, i) + 13), 36, 'semibold', wins(row, sides[c]) ? 'ink' : 'muted', {
                  fit: r.w - 2 * pad - 80,
                  enter: 'rise',
                  dist: 12,
                  dur: 0.4,
                  cue: NAMES[i],
                  at: AT[NAMES[i]],
                }),
              )
            : []),
          // The choice: a ring in the option's colour and a badge on its corner.
          ...(chosen
            ? [
                { type: 'rect', ...r, r: 28, fill: 'none', stroke: colors[c], width: 5, enter: 'fade', dur: 0.4, cue: 'PICK', at: round(AT.PICK + 0.2), after: 0.2 },
                {
                  type: 'group',
                  origin: [r.x + r.w - 14, r.y + 8],
                  enter: 'pop',
                  dur: 0.4,
                  cue: 'PICK',
                  at: round(AT.PICK + 0.45),
                  after: 0.45,
                  children: [
                    { type: 'circle', cx: r.x + r.w - 14, cy: r.y + 8, r: 34, fill: colors[c], stroke: 'bg', width: 5, enter: 'none' },
                    { type: 'icon', name: 'star', x: r.x + r.w - 14, y: r.y + 8, size: 36, stroke: 'bg', enter: 'none' },
                  ],
                },
              ]
            : []),
        ],
      };
    };

    return {
      elements: [
        // Side by side, the rules between rows run on across the label column, so the three
        // columns read as one table.
        ...(stacked
          ? []
          : rows.slice(1).map((_, i) => ({
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
            }))),
        // Side by side, the row names stand between the cards, level with their marks.
        ...(stacked
          ? []
          : rows.map((_, i) =>
              text(LABELS[i], labelX, round(rowY(0, i) + labelSize * 0.36), labelSize, 'semibold', 'ink', {
                anchor: 'middle',
                fit: labelW,
                enter: 'rise',
                dist: 14,
                dur: 0.4,
                cue: NAMES[i],
                at: AT[NAMES[i]],
              }),
            )),
        card(0),
        card(1),
      ],
    };
  },
};
