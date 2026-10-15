import { round } from '../../film/sketch-kit.mjs';

// Money the employer puts in: the month it lands, and an account card per tier (single, family)
// that lists the deposit on its word and then shows the new balance, with a bar beneath drawn to
// scale across the tiers. An HSA seed, a grant, an allowance credited on a
// date. Balances land; they never count up through figures the source does not state.
// Moments: WHEN (the month), DEPOSIT (the first card), TIER2 (the second card, when there is one).
const AT = { WHEN: 0.4, DEPOSIT: 1.4, TIER2: 2.6 };

export default {
  name: 'deposit',
  keep: true,
  order: 97,
  summary:
    'Money the employer puts in: the month it lands, and an account card per tier (single, family) that lists the deposit on its word and then shows the new balance, with bars drawn to scale across the tiers.',
  use: 'An employer deposit into an account on a date: "in January, Kestrel puts $750 into your HSA, $1,500 for families", a grant, an allowance or a bonus paid in a month. Set sketchParams {amounts, prefix, decimals}: amounts one or two figures (one per tier, as the source states them); replace WHO (who pays, e.g. "From Kestrel"), WHEN (the month, e.g. "January"), ACCOUNT (e.g. "Your HSA") and TIER1, TIER2 (e.g. "Just you", "Your family") with sketchText; land WHEN, DEPOSIT and TIER2 on words with sketchSay. Every amount needs a visible source.',
  params: {
    amounts: { default: [750, 1500], list: true, length: [1, 2], min: 0.01, max: 1e9, about: 'the deposit for each tier, as the source states it (one or two figures)' },
    prefix: { default: '$', about: 'printed before each amount' },
    decimals: { default: 0, min: 0, max: 2, integer: true, figure: false, about: 'decimals the source prints' },
  },
  build(w, h, { params = {} } = {}) {
    const { amounts = [750, 1500], prefix = '$', decimals = 0 } = params;
    const T = h > w * 1.1;
    const money = v => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const still = { at: 0, enter: 'none' };
    const on = (cue, dt = 0) => ({ cue, at: round(AT[cue] + dt), ...(dt ? { after: dt } : {}) });
    const els = [];
    const n = amounts.length,
      max = Math.max(...amounts);
    // Where the month stands, and where the cards stand: side by side on a wide frame, the month
    // above the cards on a tall one. Everything sits above the caption band.
    const side = T ? round(w * 0.115) + 4 : 160;
    const chip = T ? { x: side, y: round(h * 0.17), w: 330, h: 120 } : { x: side, y: round(h * 0.3), w: 360, h: 128 };
    const cardH = 290,
      gap = T ? 40 : 36;
    const area = T
      ? { x: side, y: chip.y + chip.h + 120, w: w - side * 2 }
      : { x: 720, y: round(h * 0.42 - (n * cardH + (n - 1) * gap) / 2), w: w - 720 - side };
    // WHO and the month it lands.
    els.push(text('WHO', chip.x, chip.y - 32, 40, 'strong', 'muted', still));
    els.push({
      type: 'group',
      id: 'deposit-when',
      enter: 'pop',
      dur: 0.35,
      ...on('WHEN'),
      children: [
        { type: 'rect', x: chip.x, y: chip.y, w: chip.w, h: chip.h, r: 24, fill: 'accent', shadow: true },
        { type: 'icon', name: 'calendar', x: chip.x + 62, y: round(chip.y + chip.h / 2), size: 56, stroke: 'bg' },
        text('WHEN', chip.x + 118, round(chip.y + chip.h / 2 + 17), 48, 'bold', 'bg', { fit: chip.w - 140 }),
      ],
    });
    amounts.forEach((amount, i) => {
      const cue = i ? 'TIER2' : 'DEPOSIT';
      const y = area.y + i * (cardH + gap);
      const pad = 40;
      const track = { x: area.x + pad, y: y + cardH - pad - 20, w: area.w - pad * 2, h: 20 };
      const right = area.x + area.w - pad;
      const big = T ? 76 : 72;
      els.push({
        type: 'group',
        id: `deposit-${i + 1}`,
        ...still,
        children: [
          { type: 'rect', x: area.x, y, w: area.w, h: cardH, r: 28, fill: 'paper', stroke: 'line', width: 2, shadow: true },
          text(`TIER${i + 1}`, area.x + pad, y + 58, 34, 'text', 'muted', { fit: area.w * 0.5 }),
          text('ACCOUNT', area.x + pad, y + 112, 46, 'strong', 'ink', { fit: area.w * 0.5 }),
          // The balance before the deposit clears first, then the new one lands: never both at once.
          text(money(0), right, y + 112, big, 'bold', 'muted', { anchor: 'end', ...still, exit: 'fade', exitDur: 0.12, exitCue: cue, exitAt: round(AT[cue] + 0.45) }),
          text(money(amount), right, y + 112, big, 'bold', 'ink', { anchor: 'end', enter: 'rise', dist: 16, dur: 0.3, ...on(cue, 0.6) }),
          // The deposit as the account lists it: who paid, and how much.
          { type: 'line', x1: area.x + pad, y1: y + 142, x2: right, y2: y + 142, stroke: 'line', width: 2, ...still },
          text('WHO', area.x + pad, y + 190, 32, 'text', 'muted', { fit: area.w * 0.55, enter: 'rise', dist: 12, dur: 0.3, ...on(cue), sound: 'tick' }),
          text(`+${money(amount)}`, right, y + 190, 36, 'bold', 'positive', { anchor: 'end', enter: 'rise', dist: 12, dur: 0.3, ...on(cue) }),
          { type: 'rect', ...track, r: 10, fill: 'wash', ...still },
          { type: 'rect', x: track.x, y: track.y, w: round((track.w * amount) / max), h: track.h, r: 10, fill: 'accent', enter: 'grow-x', dur: 0.7, ...on(cue, 0.6) },
        ],
      });
    });
    return { elements: els };
  },
};
