import { round, tall } from '../../film/sketch-kit.mjs';

// A task done in an app, step by step: the cursor opens a section, picks a card, changes one
// value and saves; a confirmation lands and the view leans in on the new value. Every click is
// a named moment (CLICK1, CLICK2, CHANGE, SAVE), so each lands on the word that names it, and
// the cursor travels to its next target while the voice gets there. Drawn, not a screenshot:
// it shows where to go, so it carries a product's words but never its figures.
const AT = { CLICK1: 1.4, CLICK2: 3.2, CHANGE: 5.0, SAVE: 6.8 };

const cursorPath = (x, y) =>
  `M ${x} ${y} L ${x} ${y + 40} L ${x + 10} ${y + 31} L ${x + 17} ${y + 47} L ${x + 25} ${y + 44} L ${x + 18} ${y + 28} L ${x + 31} ${y + 28} Z`;

export default {
  name: 'portal',
  order: 90,
  summary:
    'A task done in an app: the cursor opens a section, picks a card, changes one value and saves; a confirmation lands and the view leans in on the new value.',
  use: 'Benefits portals, HR and expense apps, banking and settings: "log in, go to Retirement, change your rate", the step a film asks people to take. Replace APP, STEP1 (the section), STEP2 (the card), OTHER (a second card), FIELD, OLD and NEW (its value before and after) and DONE with sketchText (also Home, Pay, Documents, Welcome back, Save); land CLICK1, CLICK2, CHANGE and SAVE on words with sketchSay.',
  build(w, h) {
    const T = tall(w, h);
    // Window, chrome and the two regions: a side menu (landscape) or tabs (tall frames).
    const win = T ? { x: 70, y: 430, w: 940, h: 1160 } : { x: 300, y: 150, w: 1320, h: 780 };
    const bar = 68;
    const nav = T
      ? { x: win.x, y: win.y + bar, w: win.w, h: 92 }
      : { x: win.x, y: win.y + bar, w: 300, h: win.h - bar };
    const main = T
      ? { x: win.x + 50, y: nav.y + nav.h + 40, w: win.w - 100 }
      : { x: nav.x + nav.w + 56, y: win.y + bar + 56, w: win.w - nav.w - 112 };
    const items = ['Home', 'STEP1', 'Pay', 'Documents'].slice(0, T ? 3 : 4);
    const item = i =>
      T
        ? { x: round(nav.x + 24 + (i * (nav.w - 48)) / items.length), y: nav.y + 18, w: round((nav.w - 48) / items.length - 12), h: 56 }
        : { x: nav.x + 20, y: nav.y + 36 + i * 72, w: nav.w - 40, h: 56 };
    const centre = r => [round(r.x + r.w / 2), round(r.y + r.h / 2)];
    const label = 30;
    // Section page: a header and two cards. Form: a field, its value box and a save button.
    const head = { x: main.x, y: main.y + 34 };
    const cardW = T ? main.w : round((main.w - 32) / 2);
    const card = i =>
      T ? { x: main.x, y: main.y + 90 + i * 220, w: cardW, h: 190 } : { x: main.x + i * (cardW + 32), y: main.y + 92, w: cardW, h: 200 };
    const fieldY = main.y + 120;
    const box = { x: main.x, y: fieldY + 28, w: T ? main.w : 420, h: 110 };
    const save = { x: main.x, y: box.y + box.h + 48, w: 220, h: 76 };
    const toast = T
      ? { x: win.x + 120, y: win.y + win.h - 150, w: win.w - 240, h: 92 }
      : { x: win.x + win.w - 640, y: win.y + win.h - 132, w: 600, h: 92 };
    const [vx, vy] = centre(box);
    // The cursor starts low in the window and visits each target before its click.
    const start = T ? [win.x + win.w - 160, win.y + win.h - 260] : [win.x + win.w - 220, win.y + win.h - 200];
    const targets = [centre(item(1)), centre(card(0)), [vx, vy], centre(save)];
    const move = (i, cue, at) => ({
      ...(cue ? { cue, after: 0.45 } : {}),
      at,
      dur: 0.85,
      ease: 'inOut',
      x: round(targets[i][0] - start[0] + 4),
      y: round(targets[i][1] - start[1] + 6),
    });
    const ripple = (i, cue) => ({
      type: 'circle',
      cx: targets[i][0],
      cy: targets[i][1],
      r: 46,
      fill: 'accent',
      opacity: 0,
      enter: 'none',
      at: 0,
      origin: targets[i],
      keys: [
        { cue, at: AT[cue], dur: 0, opacity: 0.35, scale: 0.3 },
        { cue, at: AT[cue], dur: 0.55, ease: 'out', opacity: 0, scale: 1.5 },
      ],
    });
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    return {
      elements: [
        {
          type: 'group',
          enter: 'rise',
          at: 0,
          dur: 0.6,
          origin: [vx, vy],
          shadow: { blur: 48, dy: 26, opacity: 0.22 },
          // The enlarged result: the whole window leans in on the saved value.
          // It also drifts toward the middle of the frame, so the new value ends up near the centre.
          keys: [
            {
              cue: 'SAVE',
              at: AT.SAVE + 0.9,
              after: 0.9,
              dur: 1.3,
              ease: 'inOut',
              scale: T ? 1.18 : 1.3,
              x: round((w / 2 - vx) * 0.55),
              y: round((h / 2 - vy) * 0.55),
            },
          ],
          children: [
            { type: 'rect', ...win, r: 24, fill: 'surface', stroke: 'line', width: 2, enter: 'none' },
            { type: 'rect', x: win.x, y: win.y, w: win.w, h: bar, r: 24, fill: 'bg', enter: 'none' },
            { type: 'rect', x: win.x, y: win.y + bar - 24, w: win.w, h: 24, fill: 'bg', enter: 'none' },
            { type: 'line', x1: win.x, y1: win.y + bar, x2: win.x + win.w, y2: win.y + bar, stroke: 'line', width: 2, enter: 'none' },
            ...[0, 1, 2].map(i => ({ type: 'circle', cx: win.x + 36 + i * 26, cy: win.y + bar / 2, r: 8, fill: 'line', enter: 'none' })),
            text('APP', round(win.x + win.w / 2), win.y + bar / 2 + 10, 28, 'semibold', 'muted', { anchor: 'middle', enter: 'none' }),
            T
              ? { type: 'line', x1: nav.x, y1: nav.y + nav.h, x2: nav.x + nav.w, y2: nav.y + nav.h, stroke: 'line', width: 2, enter: 'none' }
              : { type: 'rect', x: nav.x, y: nav.y, w: nav.w, h: nav.h - 24, fill: 'bg', enter: 'none' },
            // The menu: the section's row lights up on the first click.
            { type: 'rect', ...item(0), r: 14, fill: 'wash', enter: 'none', exit: 'fade', exitCue: 'CLICK1', exitAt: AT.CLICK1, exitDur: 0.2 },
            { type: 'rect', ...item(1), r: 14, fill: 'wash', enter: 'fade', cue: 'CLICK1', at: AT.CLICK1, dur: 0.25 },
            ...items.map((t, i) => {
              const r = item(i);
              return text(t, T ? round(r.x + r.w / 2) : r.x + 22, round(r.y + r.h / 2 + label * 0.36), label, 'semibold', 'ink', {
                anchor: T ? 'middle' : 'start',
                fit: r.w - 30,
                enter: 'none',
              });
            }),
            // Home: a greeting and quiet placeholder rows, gone when the section opens.
            {
              type: 'group',
              enter: 'none',
              at: 0,
              exit: 'fade',
              exitCue: 'CLICK1',
              exitAt: AT.CLICK1,
              exitDur: 0.25,
              children: [
                text('Welcome back', head.x, head.y, 46, 'bold', 'ink', { enter: 'none' }),
                ...[0, 1, 2].map(i => ({ type: 'rect', x: main.x, y: main.y + 100 + i * 70, w: round(main.w * (0.9 - i * 0.2)), h: 30, r: 15, fill: 'wash', enter: 'none' })),
              ],
            },
            // The section: its header and two cards, one of which is the next click.
            {
              type: 'group',
              enter: 'none',
              exit: 'fade',
              exitCue: 'CLICK2',
              exitAt: AT.CLICK2,
              exitDur: 0.3,
              children: [
                text('STEP1', head.x, head.y, 46, 'bold', 'ink', { enter: 'rise', cue: 'CLICK1', at: AT.CLICK1 + 0.1, after: 0.1, dur: 0.4, fit: main.w }),
                ...[0, 1].map(i => {
                  const r = card(i);
                  return {
                    type: 'group',
                    enter: 'rise',
                    cue: 'CLICK1',
                    at: AT.CLICK1 + 0.2 + i * 0.12,
                    after: 0.2 + i * 0.12,
                    dur: 0.45,
                    children: [
                      { type: 'rect', ...r, r: 20, fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
                      { type: 'circle', cx: r.x + 58, cy: r.y + 62, r: 28, fill: i ? 'wash2' : 'wash', enter: 'none' },
                      text(i ? 'OTHER' : 'STEP2', r.x + 32, r.y + r.h - 44, 36, 'bold', 'ink', { fit: r.w - 64, enter: 'none' }),
                    ],
                  };
                }),
                { type: 'rect', ...card(0), r: 20, fill: 'none', stroke: 'accent', width: 4, enter: 'fade', cue: 'CLICK2', at: AT.CLICK2 - 0.15, dur: 0.15 },
              ],
            },
            // The form: one field, its old value replaced by the new one, and a save button.
            {
              type: 'group',
              enter: 'rise',
              cue: 'CLICK2',
              at: AT.CLICK2 + 0.25,
              after: 0.25,
              dur: 0.45,
              children: [
                text('STEP2', head.x, head.y, 46, 'bold', 'ink', { enter: 'none', fit: main.w }),
                text('FIELD', main.x, fieldY, 30, 'semibold', 'muted', { enter: 'none', fit: main.w }),
                { type: 'rect', ...box, r: 16, fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
                { type: 'rect', ...box, r: 16, fill: 'none', stroke: 'accent', width: 5, enter: 'fade', cue: 'CHANGE', at: AT.CHANGE, dur: 0.2 },
                text('OLD', box.x + 36, round(box.y + box.h / 2 + 22), 64, 'bold', 'muted', {
                  enter: 'none',
                  exit: 'fade',
                  exitCue: 'CHANGE',
                  exitAt: AT.CHANGE,
                  exitDur: 0.15,
                }),
                text('NEW', box.x + 36, round(box.y + box.h / 2 + 22), 64, 'bold', 'accent', { enter: 'type', cue: 'CHANGE', at: AT.CHANGE + 0.2, after: 0.2, dur: 0.4 }),
                {
                  type: 'group',
                  enter: 'none',
                  origin: centre(save),
                  keys: [{ cue: 'SAVE', at: AT.SAVE, dur: 0.3, ease: 'thereAndBack', scale: 0.92 }],
                  children: [
                    { type: 'rect', ...save, r: 38, fill: 'accent', enter: 'none' },
                    text('Save', centre(save)[0], centre(save)[1] + 11, 32, 'bold', 'bg', { anchor: 'middle', enter: 'none' }),
                  ],
                },
              ],
            },
            // The confirmation.
            {
              type: 'group',
              enter: 'pop',
              cue: 'SAVE',
              at: AT.SAVE + 0.35,
              after: 0.35,
              dur: 0.4,
              origin: centre(toast),
              children: [
                { type: 'rect', ...toast, r: 46, fill: 'ink', enter: 'none' },
                { type: 'circle', cx: toast.x + 48, cy: centre(toast)[1], r: 22, fill: 'positive', enter: 'none' },
                { type: 'path', d: `M ${toast.x + 37} ${centre(toast)[1]} L ${toast.x + 45} ${centre(toast)[1] + 9} L ${toast.x + 60} ${centre(toast)[1] - 8}`, fill: 'none', stroke: 'bg', width: 5, cap: 'round', join: 'round', enter: 'none' },
                text('DONE', toast.x + 90, centre(toast)[1] + 11, 32, 'semibold', 'bg', { fit: toast.w - 120, enter: 'none' }),
              ],
            },
          ],
        },
        ripple(0, 'CLICK1'),
        ripple(1, 'CLICK2'),
        ripple(2, 'CHANGE'),
        ripple(3, 'SAVE'),
        // The cursor: on its way to the first target as the scene opens, then to each next one
        // just after a click; it leaves once the work is saved.
        {
          type: 'path',
          d: cursorPath(start[0], start[1]),
          fill: 'ink',
          stroke: 'surface',
          width: 3,
          join: 'round',
          enter: 'fade',
          at: 0.2,
          dur: 0.3,
          keys: [
            move(0, null, 0.45),
            move(1, 'CLICK1', AT.CLICK1 + 0.45),
            move(2, 'CLICK2', AT.CLICK2 + 0.45),
            move(3, 'CHANGE', AT.CHANGE + 0.45),
            { cue: 'SAVE', at: AT.SAVE + 0.7, after: 0.7, dur: 0.3, opacity: 0 },
          ],
        },
      ],
    };
  },
};
