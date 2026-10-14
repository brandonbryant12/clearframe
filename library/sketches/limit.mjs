import { body, round } from '../../film/sketch-kit.mjs';

// How much of a yearly limit is used, and how much room is left: a track drawn to scale from
// zero to the limit; the used share fills it on its word while its amount counts up; the limit
// lands at the end; the room left is bracketed and named. A deductible met so far, an
// out-of-pocket maximum, a contribution limit, an allowance. The amounts come from
// sketchParams and are drawn to scale, never estimated from the picture. Moments: FILL, LIMIT, LEFT.
const AT = { FILL: 1.0, LIMIT: 2.6, LEFT: 4.0 };

export default {
  name: 'limit',
  keep: true,
  order: 93,
  summary:
    'How much of a yearly limit is used and how much room is left: a track to scale from zero to the limit, the used share filling it as its amount counts up, the limit landing at the end, the room left bracketed. Amounts come from the plan.',
  use: 'A deductible met so far, an out-of-pocket maximum, a 401(k) or HSA contribution limit, a spending allowance: "you have saved $15,000 of the $23,500 you are allowed; you can still add $8,500". Set sketchParams {limit, used, prefix, suffix, decimals}; replace WHAT (what the limit is for, e.g. "Your 401(k) contributions, 2027"), USED (e.g. "saved so far"), LIMITLABEL (e.g. "yearly limit") and LEFTLABEL (e.g. "you can still add") with sketchText; land FILL, LIMIT and LEFT on words with sketchSay. The amounts need a visible source like any figure.',
  params: {
    limit: { default: 23500, min: 1, max: 1e9, about: 'the limit, in the amount printed (the end of the track)' },
    used: { default: 15000, min: 0, max: 1e9, about: 'how much of it is used so far (no more than the limit)' },
    prefix: { default: '$', about: 'printed before each amount, e.g. "$"' },
    suffix: { default: '', about: 'printed after each amount, e.g. " days"' },
    decimals: { default: 0, min: 0, max: 2, integer: true, about: 'decimals the source prints' },
  },
  build(w, h, { params = {} } = {}) {
    const { limit = 23500, used = 15000, prefix = '$', suffix = '', decimals = 0 } = params;
    if (used > limit) throw new Error(`sketchParams.used (${used}) is more than the limit (${limit}) for limit: the track is drawn to scale`);
    const T = w < 1400;
    const b = body(w, h);
    const money = v => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
    const els = [];
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    // One pill from zero to the limit, labelled inside its own segments (the stacked-bar
    // convention): what is used inside the fill, what is left inside the room, the axis below.
    const x0 = round(b.x),
      x1 = round(b.x + b.w);
    const trackH = T ? 156 : 136;
    const ty = round(b.y + b.h * (T ? 0.42 : 0.47) - trackH / 2);
    const W = x1 - x0;
    const fillEnd = round(x0 + (W * used) / limit);
    const fillW = round(fillEnd - x0);
    const big = T ? 60 : 58,
      small = T ? 32 : 30;
    const pad = round(trackH * 0.3);
    // Roughly how wide a label of this many characters is, to choose inside or beside.
    const span = (chars, size) => chars * size * 0.56;
    const row1 = round(ty + trackH / 2 + big * 0.12),
      row2 = round(row1 + small * 1.3);

    els.push(text('WHAT', x0, round(b.y + (T ? 46 : 40)), T ? 50 : 52, 'strong', 'ink', { width: round(b.w), at: 0, enter: 'none' }));
    // The track: the whole limit, drawn from zero, on screen from the first frame.
    els.push({ type: 'rect', x: x0, y: ty, w: W, h: trackH, r: round(trackH / 2), fill: 'wash', at: 0, enter: 'none' });
    const axis = round(ty + trackH + small * 1.6);
    els.push(text('0', x0, axis, small, 'figures', 'muted', { at: 0, enter: 'none' }));

    // FILL: the used share grows from zero while its amount counts up.
    const usedChars = Math.max(money(used).length, 4);
    const usedInside = fillW > span(usedChars, big) + pad * 2;
    if (fillW > 0)
      els.push({
        type: 'rect', x: x0, y: ty, w: fillW, h: trackH, r: round(Math.min(trackH / 2, fillW / 2)), fill: 'accent', enter: 'none',
        origin: [x0, ty + trackH / 2], cue: 'FILL', at: AT.FILL,
        keys: [{ cue: 'FILL', at: AT.FILL, dur: 0, scaleX: 0 }, { cue: 'FILL', at: AT.FILL, dur: 1.2, ease: 'out', scaleX: 1 }],
      });
    // Inside the fill, set from its right end; when the fill is too short, just above its start.
    const used0 = usedInside ? { x: round(fillEnd - pad), y: row1, anchor: 'end', ink: 'bg', label: 'bg' } : { x: x0, y: round(ty - small * 1.9), anchor: 'start', ink: 'ink', label: 'muted' };
    els.push(text(null, used0.x, used0.y, big, 'bold', used0.ink, {
      text: undefined, count: { from: 0, to: used, prefix, suffix, decimals, dur: 1.2 }, anchor: used0.anchor, enter: 'fade', dur: 0.3, cue: 'FILL', at: round(AT.FILL + 0.15),
    }));
    els.push(text('USED', used0.x, usedInside ? row2 : round(used0.y + small * 1.3), small, 'strong', used0.label, { anchor: used0.anchor, opacity: usedInside ? 0.85 : 1, enter: 'fade', cue: 'FILL', at: round(AT.FILL + 0.5), dur: 0.4 }));

    // LIMIT: a rule at the end of the track and the limit at the end of the axis.
    els.push({ type: 'line', x1, y1: round(ty - 18), x2: x1, y2: round(ty + trackH + 18), stroke: 'ink', width: 4, cap: 'round', enter: 'draw', cue: 'LIMIT', at: AT.LIMIT, dur: 0.35 });
    els.push(text(money(limit), x1, round(axis + big * 0.62), big, 'bold', 'ink', { anchor: 'end', enter: 'rise', cue: 'LIMIT', at: round(AT.LIMIT + 0.1), dur: 0.45 }));
    els.push(text('LIMITLABEL', x1, round(axis + big * 0.62 + small * 1.3), small, 'text', 'muted', { anchor: 'end', enter: 'fade', cue: 'LIMIT', at: round(AT.LIMIT + 0.3), dur: 0.4 }));

    // LEFT: the room between the fill and the limit, outlined, with its amount inside it (or
    // just above its end when the room is too narrow to hold it).
    const left = limit - used;
    if (left > 0) {
      const gw = round(x1 - fillEnd);
      els.push({ type: 'rect', x: fillEnd, y: ty, w: gw, h: trackH, r: round(Math.min(trackH / 2, gw / 2)), fill: 'none', stroke: 'accent2', width: 5, dash: [16, 11], enter: 'draw', cue: 'LEFT', at: AT.LEFT, dur: 0.6 });
      const inside = gw > span(money(left).length + 1, big) + pad * 2;
      const at = inside ? { x: round((fillEnd + x1) / 2), y: row1, anchor: 'middle' } : { x: x1, y: round(ty - small * 1.9), anchor: 'end' };
      els.push(text(money(left), at.x, at.y, big, 'bold', 'accent2', { anchor: at.anchor, enter: 'rise', dist: 18, cue: 'LEFT', at: round(AT.LEFT + 0.3), dur: 0.45 }));
      els.push(text('LEFTLABEL', at.x, inside ? row2 : round(at.y + small * 1.3), small, 'strong', 'muted', { anchor: at.anchor, enter: 'fade', cue: 'LEFT', at: round(AT.LEFT + 0.5), dur: 0.4 }));
    }
    return { elements: els };
  },
};
