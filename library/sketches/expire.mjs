import { body, round } from '../../film/sketch-kit.mjs';

// Use it or lose it: a glass jar fills with this year's coins, one per unit. At year end a
// carry-over line cuts across the jar; the coins above it turn and lift away, leaving a dashed
// outline of what was lost, and the coins below it stay with you. Brackets beside the jar name
// both parts with their amounts. Every count comes from sketchParams, never from the drawing.
// Moments: FILL, YEAREND, KEEP.
const AT = { FILL: 0.6, YEAREND: 3.0, KEEP: 5.0 };

export default {
  name: 'expire',
  keep: true,
  order: 94,
  summary:
    'Use it or lose it: a glass jar fills with this year’s coins; at year end a carry-over line cuts across it, the coins above the line lift away and the ones below stay. One coin per unit, counted from the real figures.',
  use: 'Paid time off that partly carries over, an FSA or HSA rollover limit, unused credits or allowances, benefits that reset each year: "you get 8 days, you can carry 3 into next year". Not for access that ends (a shared link that expires after 7 days: that is compose with expires: true). Set the counts with sketchParams {total, keep} (one coin each) and, for printed amounts, {each, prefix, suffix} (e.g. each 100, prefix "$"); replace KEEP (e.g. "days carry into next year"), LOSE (e.g. "days are gone") and YEAREND (a short date, e.g. "Dec 31") with sketchText; land FILL, YEAREND and KEEP on words with sketchSay. The figures need a visible source like any number.',
  params: {
    total: { default: 8, min: 1, max: 12, integer: true, about: 'coins in the jar this year, one per unit', hint: 'It counts coins, not money. For $3,300 with $660 carrying over: total 5, keep 1, each 660, prefix "$" (5 coins of $660).' },
    keep: { default: 3, min: 0, max: 12, integer: true, about: 'coins that carry over (no more than total); the rest are lost at year end', hint: 'It counts coins, not money. For $3,300 with $660 carrying over: total 5, keep 1, each 660, prefix "$" (5 coins of $660).' },
    each: { default: 1, min: 0.01, max: 1000000, about: 'what one coin is worth in the printed amounts, e.g. 100 for $100 coins' },
    prefix: { default: '', about: 'printed before each amount, e.g. "$"' },
    suffix: { default: '', about: 'printed after each amount, e.g. "%" or " days" (or "" for none)' },
  },
  build(w, h, { params = {} } = {}) {
    const { total = 8, keep = 3, each = 1, prefix = '', suffix = '' } = params;
    if (keep > total) throw new Error(`sketchParams.keep for expire must be no more than total (got keep ${keep}, total ${total})`);
    const lost = total - keep;
    const amount = n => `${prefix}${(n * each).toLocaleString('en-US', { maximumFractionDigits: 2 })}${suffix}`;
    const T = h > w * 1.1;
    const short = !T && w < 1400;
    const b = body(w, h);
    // The jar: centred left of the frame's middle, labels to its right; the year-end tag sits on
    // the line to its left in wide frames and above the rim in narrow ones.
    const jw = T ? 380 : short ? 260 : 380;
    const cx = T ? 300 : short ? 280 : round(w * 0.48);
    const L = cx - jw / 2,
      R = cx + jw / 2,
      ry = round(jw * 0.085);
    const rx = round(jw / 2 - 34),
      cry = round(rx * 0.27);
    // The jar is as tall as its coins need (at least six), centred in the room the frame gives it.
    const room = T ? { y0: b.y + 150, y1: b.y + b.h - 50 } : short ? { y0: 390, y1: 900 } : { y0: 400, y1: 890 };
    const slots = Math.max(total, 6);
    const step = round(Math.min(46, (room.y1 - room.y0 - 82 - 2 * cry) / slots));
    const jarH = slots * step + 82 + 2 * cry;
    const top = round(room.y0 + Math.max(0, (room.y1 - room.y0 - jarH) / 2)),
      bottom = round(top + jarH);
    const t = round(step * 0.74);
    const base = round(bottom - t - cry - 12);
    const coinY = i => round(base - i * step);
    const label = { x: R + 76, width: round(w * (T ? 0.9 : 0.92) - (R + 76)) };
    const els = [];
    const text = (s, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: s, x, y, size, font, fill, ...extra });
    // One coin: its side, its faces, a rim on top (after the match sketch).
    const coin = (y, fill) => [
      { type: 'ellipse', cx, cy: y + t, rx, ry: cry, fill, enter: 'none' },
      { type: 'rect', x: cx - rx, y, w: 2 * rx, h: t, fill, enter: 'none' },
      // The side in shade: the coin's colour multiplied by itself, darker on light and dark palettes alike.
      { type: 'ellipse', cx, cy: y + t, rx, ry: cry, fill, blend: 'multiply', opacity: 0.6, enter: 'none' },
      { type: 'rect', x: cx - rx, y, w: 2 * rx, h: t, fill, blend: 'multiply', opacity: 0.6, enter: 'none' },
      { type: 'ellipse', cx, cy: y, rx, ry: cry, fill, stroke: 'bg', width: 2, enter: 'none' },
      { type: 'ellipse', cx, cy: y, rx: round(rx * 0.68), ry: round(cry * 0.68), fill: 'none', stroke: 'bg', width: 3, opacity: 0.5, enter: 'none' },
    ];

    // The glass: its back, tinted; a shadow under it. On screen from the first frame: the film
    // opens on the jar, and only the coins arrive.
    els.push({ type: 'ellipse', cx, cy: bottom + 6, rx: round(jw * 0.68), ry: round(ry * 1.5), fill: 'wash', opacity: 0.8, enter: 'none', at: 0 });
    els.push({
      type: 'path',
      d: `M ${L} ${top} L ${L} ${bottom - 30} Q ${L} ${bottom} ${L + 30} ${bottom + 4} Q ${cx} ${round(bottom + ry * 1.2)} ${R - 30} ${bottom + 4} Q ${R} ${bottom} ${R} ${bottom - 30} L ${R} ${top}`,
      fill: 'surface',
      opacity: 0.85,
      stroke: 'line',
      width: 4,
      join: 'round',
      enter: 'none',
      at: 0,
    });
    els.push({ type: 'ellipse', cx, cy: top, rx: jw / 2, ry, fill: 'bg', stroke: 'line', width: 4, enter: 'none', at: 0 });

    // The carry-over level: the plane of the top face of the last coin kept, drawn as a ring
    // round the glass in the coins' own perspective.
    const lineY = keep > 0 ? coinY(keep - 1) : base + t;
    const ringRy = round(((jw / 2) * cry) / rx);
    const level = { stroke: 'ink', width: 4, dash: [16, 10], cap: 'round', fill: 'none', loop: { type: 'dash', period: 6 }, cue: 'YEAREND', at: AT.YEAREND, after: 0 };
    // (Its far side shows faintly through the glass, behind the coins.)
    els.push({ type: 'path', d: `M ${R} ${lineY} A ${jw / 2} ${ringRy} 0 0 0 ${L} ${lineY}`, opacity: 0.35, enter: 'fade', dur: 0.4, ...level });

    // What was lost: a dashed outline where those coins stood (behind the coins, so the top
    // coin kept covers its foot).
    if (lost > 0) {
      const yTop = coinY(total - 1) - cry;
      els.push({
        type: 'rect',
        x: cx - rx,
        y: yTop,
        w: 2 * rx,
        h: round(lineY - yTop),
        r: 26,
        fill: 'none',
        stroke: 'negative',
        width: 3,
        dash: [10, 9],
        opacity: 0.85,
        enter: 'fade',
        dur: 0.5,
        cue: 'YEAREND',
        at: round(AT.YEAREND + 1.1 + lost * 0.07),
        after: round(1.1 + lost * 0.07),
      });
    }
    // This year's coins drop in, one per unit.
    for (let i = 0; i < total; i++) {
      const fall = i >= keep;
      const k = total - 1 - i; // lost coins leave from the top down
      const at = round(AT.FILL + i * 0.12);
      els.push({
        type: 'group',
        enter: 'drop',
        dist: round(Math.min(320, coinY(i) - top + 140)),
        dur: 0.42,
        cue: 'FILL',
        at,
        after: round(i * 0.12),
        origin: [cx, coinY(i)],
        keys: fall
          ? [{ cue: 'YEAREND', at: round(AT.YEAREND + 0.55 + k * 0.07), after: round(0.55 + k * 0.07), dur: 0.7, ease: 'in', y: -150, opacity: 0, scale: 0.92 }]
          : // The coins you keep give a small hop, bottom to top, when they are named.
            [{ cue: 'KEEP', at: round(AT.KEEP + 0.1 + i * 0.06), after: round(0.1 + i * 0.06), dur: 0.45, ease: 'thereAndBack', y: -12 }],
        children: [
          ...coin(coinY(i), 'accent'),
          // Coins over the line turn before they go.
          ...(fall ? [{ type: 'group', enter: 'fade', dur: 0.25, cue: 'YEAREND', at: round(AT.YEAREND + 0.3 + k * 0.03), after: round(0.3 + k * 0.03), children: coin(coinY(i), 'negative') }] : []),
        ],
      });
    }
    // The front of the glass: a highlight down its left side.
    els.push({ type: 'rect', x: L + 14, y: top + ry + 18, w: 12, h: bottom - top - ry - 70, r: 6, fill: 'bg', opacity: 0.45, enter: 'none', at: 0 });
    els.push({
      type: 'path',
      d: `M ${L} ${top} A ${jw / 2} ${ry} 0 0 0 ${R} ${top}`,
      fill: 'none',
      stroke: 'line',
      width: 4,
      enter: 'none',
      at: 0,
    });

    // The carry-over line, drawn across at year end and kept moving.
    const lx0 = T || short ? L - 24 : round(L - 150),
      lx1 = R + 24;
    els.push({ type: 'path', d: `M ${lx0} ${lineY} L ${L} ${lineY} A ${jw / 2} ${ringRy} 0 0 0 ${R} ${lineY} L ${lx1} ${lineY}`, enter: 'draw', dur: 0.6, ...level });
    // The year-end tag: at the line's end in wide frames, above the rim in narrow ones.
    const tag = T || short ? { x: cx, y: top - ry - 64, anchor: 'middle' } : { x: lx0 - 20, y: lineY, anchor: 'end' };
    const tagW = 250,
      tagH = 64;
    const tagX = tag.anchor === 'end' ? tag.x - tagW : tag.x - tagW / 2;
    els.push({
      type: 'group',
      enter: 'pop',
      dur: 0.4,
      cue: 'YEAREND',
      at: AT.YEAREND,
      origin: [tagX + tagW / 2, tag.y],
      children: [
        { type: 'rect', x: tagX, y: round(tag.y - tagH / 2), w: tagW, h: tagH, r: tagH / 2, fill: 'ink', enter: 'none' },
        { type: 'icon', name: 'calendar', x: tagX + 40, y: tag.y, size: 32, stroke: 'bg', enter: 'none' },
        text('YEAREND', tagX + 70, round(tag.y + 11), 30, 'semibold', 'bg', { fit: tagW - 90, enter: 'none' }),
      ],
    });

    // Brackets and amounts beside the jar: what goes (at year end) and what stays (on KEEP).
    const bx = R + 36;
    const lostMid = lost > 0 ? round((coinY(total - 1) - cry + lineY) / 2) : null;
    const keepMid = round((lineY + base + t + cry) / 2);
    // Keep the two labels clear of each other when either part is thin.
    let [lostY, keepY] = [lostMid, keepMid];
    if (lostY != null && keepY - lostY < 150) {
      const mid = (keepY + lostY) / 2;
      [lostY, keepY] = [round(mid - 75), round(mid + 75)];
    }
    const bracket = (y0, y1, stroke, cue, dt) => ({
      type: 'path',
      d: `M ${bx} ${round(y0 + 4)} L ${bx + 16} ${round(y0 + 4)} L ${bx + 16} ${round(y1 - 4)} L ${bx} ${round(y1 - 4)}`,
      fill: 'none',
      stroke,
      width: 4,
      cap: 'round',
      join: 'round',
      enter: 'draw',
      dur: 0.45,
      cue,
      at: round(AT[cue] + dt),
      after: dt,
    });
    const amountLabel = (y, figure, fill, words, cue, dt) => ({
      type: 'group',
      enter: 'right',
      dist: 30,
      dur: 0.45,
      cue,
      at: round(AT[cue] + dt),
      after: dt,
      children: [
        text(figure, label.x, round(y + 6), T ? 72 : 80, 'bold', fill, { fit: label.width, enter: 'none' }),
        text(words, label.x, round(y + 52), T ? 34 : 36, 'semibold', 'ink', { width: label.width, leading: 1.15, enter: 'none' }),
      ],
    });
    if (lost > 0) {
      els.push(bracket(coinY(total - 1) - cry, lineY, 'negative', 'YEAREND', 0.4));
      els.push(amountLabel(lostY, `−${amount(lost)}`, 'negative', 'LOSE', 'YEAREND', 0.9));
    }
    els.push(bracket(lineY, base + t + cry, 'accent', 'KEEP', 0));
    els.push(amountLabel(keepY, amount(keep), 'accent', 'KEEP', 'KEEP', 0.15));
    return { elements: els };
  },
};
