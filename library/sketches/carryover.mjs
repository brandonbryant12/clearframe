import { round } from '../../film/sketch-kit.mjs';

// What carries into next year and what does not: this year's elections in one column, next
// year's empty slots in the other, a dashed line between. On its word each card that carries over
// crosses the line and is ticked; a card that does not (an FSA election that resets) runs to the
// line, hits it (the line turns red there) and comes back, and what it becomes ("$0") lands in
// its empty slot. With `bookend` the board opens where that left it, and on FIX the card that
// stayed crosses too and is ticked: the close of a film that opened on the board.
// Moments: CARD1 … CARDn (each card's word) and RESET; with bookend, FIX (the reset clears) and
// CROSS (the card that stayed crosses).
const AT = { CARD1: 1.0, CARD2: 1.7, CARD3: 2.4, CARD4: 3.1, CARD5: 3.8, RESET: 4.6, FIX: 1.0, CROSS: 1.25 };

export default {
  name: 'carryover',
  keep: true,
  order: 96,
  summary:
    'What carries into next year and what does not: this year’s elections beside next year’s empty slots; each that carries over crosses the line on its word and is ticked, and one that does not hits the line and comes back while what it becomes ("$0") lands in its slot; with bookend the board opens where that left it and the card that stayed crosses too.',
  use: 'Open enrollment and plan-year rules: "do nothing and your medical, dental and vision carry over, but your FSA election resets to $0". Set sketchParams {count, stays, icons}: count cards (2–5), stays the 1-based numbers of the cards that do not carry over, icons optional icon names per card (see icons); replace BEFORE (e.g. "This year"), AFTER (e.g. "From January 1"), ITEM1 … ITEMn (e.g. "Medical") and RESET (what a card that stays becomes, a word or two, e.g. "$0" or "Lapses") with sketchText; land CARD1 … CARDn and RESET on words with sketchSay. The reset chips carry ids (carryover-reset-N) for an into. To close the film on the same board, give the closing beat the same params and words plus bookend: true: it opens with the cards where the hook left them, and on FIX (land it on the word that fixes it, "re-elect") the reset chip clears, and on CROSS (e.g. "all four") the card that stayed crosses and is ticked.',
  params: {
    count: { default: 4, min: 2, max: 5, integer: true, figure: false, about: 'how many elections (cards)' },
    stays: { default: [4], list: true, length: [1, 4], min: 1, max: 5, integer: true, figure: false, about: 'the 1-based numbers of the cards that do not carry over' },
    icons: { default: [], about: 'optional icon names, one per card (see icons)' },
    bookend: { default: false, about: 'true opens with the board decided (carried cards across, the reset chip in the slots of the cards that stayed); on FIX the chip clears and on CROSS those cards cross and are ticked' },
  },
  build(w, h, { params = {}, text: words = {} } = {}) {
    const { count = 4, stays = [4], icons = [], bookend = false } = params;
    if (stays.some(n => n > count)) throw new Error(`sketchParams.stays for carryover names a card past count (${count})`);
    if (stays.length >= count) throw new Error('sketchParams.stays for carryover leaves nothing that carries over; at least one card must cross');
    if (!Array.isArray(icons)) throw new Error('sketchParams.icons for carryover must be a list of icon names');
    const T = h > w * 1.1;
    const els = [];
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const still = { at: 0, enter: 'none' };
    // Two columns either side of the line, inside the title-safe area and above the captions.
    const side = T ? round(w * 0.115) + 4 : 160;
    const mid = round(w / 2);
    const lane = T ? 28 : 110;
    const colW = round(mid - side - lane);
    const [left, right] = [side, round(mid + lane)];
    const across = right - left;
    const top = round(h * (T ? 0.2 : 0.15));
    const head = 44;
    const gap = T ? 26 : 22;
    const room = h * (T ? 0.78 : 0.74) - top - head - 50;
    const cardH = round(Math.min(T ? 140 : 118, (room - (count - 1) * gap) / count));
    // One type size for every card, the largest the longest label fits at (about 0.58 em a letter
    // in the strong face), between the icon and the tick.
    const start = icons.length ? (T ? 92 : 100) : 34;
    const longest = Math.max(8, ...Array.from({ length: count }, (_, i) => String(words[`ITEM${i + 1}`] ?? '').length));
    const size = round(Math.max(32, Math.min(T ? 44 : 50, cardH * 0.42, (colW - start - 84) / (longest * 0.58))));
    const stackH = count * cardH + (count - 1) * gap;
    const y0 = round(top + head + 50 + Math.max(0, room - stackH) * 0.3);
    // The reset chip, as wide as its word (about 0.6 em a letter in the bold face), within its slot.
    const chipW = Math.round(Math.min(colW - 40, Math.max(150, String(words.RESET ?? '').length * 40 * 0.6 + 64)));
    els.push(text('BEFORE', left, top + head, head, 'strong', 'muted', still));
    els.push(text('AFTER', right, top + head, head, 'strong', 'accent', still));
    // Next year's slots, dashed until a card lands in one.
    for (let i = 0; i < count; i++)
      els.push({ type: 'rect', x: right, y: y0 + i * (cardH + gap), w: colW, h: cardH, r: 20, fill: 'none', stroke: 'line', width: 2, dash: [10, 10], ...still });
    els.push({ type: 'line', x1: mid, y1: top, x2: mid, y2: round(y0 + stackH + 24), stroke: 'line', width: 4, dash: [14, 12], cap: 'round', ...still });
    // A moment, `dt` seconds after its word (or after its default time when it has no word).
    const on = (c, dt) => ({ cue: c, at: round(AT[c] + dt), ...(dt ? { after: dt } : {}) });
    const tick = (y, when) => [
      { type: 'circle', cx: left + colW - 50, cy: round(y + cardH / 2), r: 24, fill: 'positive', ...(when ? { enter: 'pop', dur: 0.3, ...when(0.75) } : still) },
      {
        type: 'path',
        d: `M ${left + colW - 61} ${round(y + cardH / 2)} L ${left + colW - 53} ${round(y + cardH / 2 + 9)} L ${left + colW - 38} ${round(y + cardH / 2 - 9)}`,
        fill: 'none',
        stroke: 'bg',
        width: 5,
        cap: 'round',
        join: 'round',
        ...(when ? { enter: 'draw', dur: 0.2, ...when(0.85) } : still),
      },
    ];
    for (let i = 0; i < count; i++) {
      const cue = `CARD${i + 1}`;
      const y = y0 + i * (cardH + gap);
      const stay = stays.includes(i + 1);
      const icon = icons[i];
      // A card that carries over crosses to next year; one that stays runs to the line, hits it
      // and comes back. In a bookend the board opens decided, and FIX takes the cards that stayed
      // across once they are fixed.
      const keys = bookend
        ? stay
          ? [{ ...on('CROSS', 0), dur: 0.8, ease: 'inOut', x: across, sound: 'chime' }]
          : []
        : stay
          ? [
              { ...on(cue, 0), dur: 0.4, ease: 'in', x: round(mid - left - colW - 6) },
              { ...on(cue, 0.4), dur: 0.55, ease: 'out', x: 0 },
            ]
          : [{ ...on(cue, 0), dur: 0.8, ease: 'inOut', x: across }];
      els.push({
        type: 'group',
        id: `carryover-${i + 1}`,
        ...still,
        // In a bookend, the cards that carried over are already across.
        ...(bookend && !stay ? { x: across } : {}),
        ...(keys.length ? { keys } : {}),
        children: [
          { type: 'rect', x: left, y, w: colW, h: cardH, r: 20, fill: 'surface', stroke: 'line', width: 2, shadow: true },
          ...(icon ? [{ type: 'icon', name: icon, x: left + round(start / 2 + 2), y: round(y + cardH / 2), size: T ? 48 : 48, stroke: 'accent' }] : []),
          text(`ITEM${i + 1}`, left + start, round(y + cardH / 2 + size * 0.36), size, 'strong', 'ink', { fit: colW - start - 84 }),
          // The tick a card gets on the far side (in a bookend, the card that stayed gets it on FIX).
          ...(stay ? (bookend ? tick(y, dt => on('CROSS', dt)) : []) : tick(y, bookend ? null : dt => on(cue, dt))),
        ],
      });
      if (!stay) continue;
      // Where it hit, the line turns red (cleared on FIX); what it becomes lands in its empty slot.
      els.push({
        type: 'line', x1: mid, y1: y + 8, x2: mid, y2: y + cardH - 8, stroke: 'negative', width: 6, cap: 'round',
        ...(bookend ? { ...still, exit: 'fade', exitDur: 0.3, exitCue: 'FIX', exitAt: AT.FIX } : { enter: 'draw', dur: 0.15, sound: 'thud', ...on(cue, 0.38) }),
      });
      const cx = round(right + colW / 2);
      els.push({
        type: 'group',
        id: `carryover-reset-${i + 1}`,
        ...(bookend ? { ...still, exit: 'fade', exitDur: 0.2, exitCue: 'FIX', exitAt: AT.FIX } : { enter: 'pop', dur: 0.3, ...on('RESET', 0) }),
        children: [
          { type: 'rect', x: round(cx - chipW / 2), y: round(y + cardH / 2 - 32), w: chipW, h: 64, r: 32, fill: 'negative' },
          text('RESET', cx, round(y + cardH / 2 + 14), 40, 'bold', 'bg', { anchor: 'middle', fit: chipW - 32 }),
        ],
      });
    }
    return { elements: els };
  },
};
