import { body, round } from '../../film/sketch-kit.mjs';

// A rule's number changes: the old window drawn to scale from zero, then, on its word, the part
// that no longer counts falls away (or the new part grows on), the old end is struck and the new
// one lands. A claim deadline cut from 60 days to 30, a waiting period, a limit raised. Both
// numbers come from sketchParams and are drawn to scale. Moments: CHANGE (and NOTE when set).
const AT = { CHANGE: 1.4, NOTE: 3.0 };

export default {
  name: 'was-now',
  keep: true,
  order: 94,
  summary:
    'A rule\'s number changes: the old window drawn to scale, then the part that no longer counts falls away (or the new part grows on), the old end is struck and the new one lands. Was 60 days, now 30.',
  use: 'A policy change people must notice: "you now have 30 days to claim, not 60", a waiting period shortened, a limit raised. Set sketchParams {was, now, prefix, suffix, decimals, note}; replace WHAT (what the number is, e.g. "Time to submit an expense claim"), WASLABEL (e.g. "until now"), NOWLABEL (e.g. "from January 1") and, with note: true, NOTE (what happens in the part that changed, e.g. "After day 30, a director approves") with sketchText; land CHANGE (and NOTE) on words with sketchSay. Both numbers need a visible source.',
  params: {
    was: { default: 60, min: 0.01, max: 1e9, about: 'the old number (the old end of the window)' },
    now: { default: 30, min: 0.01, max: 1e9, about: 'the new number' },
    prefix: { default: '', about: 'printed before each number, e.g. "$"' },
    suffix: { default: ' days', about: 'printed after each number, e.g. " days"' },
    decimals: { default: 0, min: 0, max: 2, integer: true, about: 'decimals the source prints' },
    note: { default: false, about: 'draw NOTE in the part that changed' },
  },
  build(w, h, { params = {} } = {}) {
    const { was = 60, now = 30, prefix = '', suffix = ' days', decimals = 0, note = false } = params;
    if (was === now) throw new Error(`sketchParams for was-now: was and now are both ${was}; nothing changes`);
    const T = w < 1400;
    const b = body(w, h);
    const money = v => `${prefix}${v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const els = [];
    const shorter = now < was;
    // Zero to the larger number across the body, so both ends are drawn to one scale.
    const x0 = round(b.x),
      W = round(b.w);
    const X = v => round(x0 + (W * v) / Math.max(was, now));
    const [wasX, nowX] = [X(was), X(now)];
    // A phone reads these: the numbers at a figure's size, the labels well above the floor.
    const big = T ? 72 : 64,
      small = T ? 44 : 40,
      barH = T ? 84 : 72;
    const pair = big * 0.72 + small * 1.35;
    const titleY = round(b.y + (T ? 46 : 40));
    const ty = round(Math.max(titleY + 30 + pair + 28, b.y + b.h * (T ? 0.36 : 0.44)));
    // The old number stands above the bar at its end, the new one below at its own: they never
    // collide, however close the two ends are.
    const above = { amount: round(ty - 28 - small * 1.35), label: round(ty - 28) };
    const below = { amount: round(ty + barH + 28 + big * 0.72), label: round(ty + barH + 28 + big * 0.72 + small * 1.35) };

    els.push(text('WHAT', x0, titleY, T ? 50 : 52, 'strong', 'ink', { width: W, at: 0, enter: 'none' }));
    // The old window, on screen from the first frame. When it shortens it is two overlapping
    // pills of one opaque colour, seamless until the part beyond the new end falls away.
    const r = round(barH / 2);
    const pill = (from, to, extra = {}) => ({ type: 'rect', x: from, y: ty, w: Math.max(barH, to - from), h: barH, r, fill: 'wash', at: 0, enter: 'none', ...extra });
    if (shorter) {
      els.push(pill(x0, nowX));
      els.push(pill(nowX - barH, wasX, { exit: 'fall', exitCue: 'CHANGE', exitAt: AT.CHANGE }));
      // What was lost stays drawn as an outline, so the old reach is still seen.
      els.push({ type: 'rect', x: nowX + 8, y: ty, w: wasX - nowX - 8, h: barH, r, fill: 'none', stroke: 'negative', width: 4, dash: [14, 10], enter: 'draw', cue: 'CHANGE', at: AT.CHANGE + 0.6, dur: 0.6 });
    } else els.push(pill(x0, wasX));
    // The old end: a rule, its number and its label; struck on the change.
    els.push({ type: 'line', x1: wasX, y1: ty - 14, x2: wasX, y2: ty + barH + 14, stroke: 'muted', width: 4, cap: 'round', at: 0, enter: 'none' });
    els.push(
      text(money(was), wasX, above.amount, big, 'bold', 'ink', {
        anchor: 'end', at: 0, enter: 'none',
        keys: [{ cue: 'CHANGE', at: AT.CHANGE + 0.3, opacity: 0.55, dur: 0.4 }],
        marks: [{ words: money(was), style: 'strike', color: 'negative', cue: 'CHANGE', at: AT.CHANGE + 0.2, dur: 0.45 }],
      }),
    );
    els.push(text('WASLABEL', wasX, above.label, small, 'text', 'muted', { anchor: 'end', at: 0, enter: 'none' }));

    // CHANGE: the window that counts now sweeps in from zero to the new end, which is ruled and
    // named below the bar.
    els.push({
      type: 'rect', x: x0, y: ty, w: nowX - x0, h: barH, r, fill: 'accent', enter: 'none', origin: [x0, ty + barH / 2], cue: 'CHANGE', at: AT.CHANGE,
      keys: [{ cue: 'CHANGE', at: AT.CHANGE, dur: 0, scaleX: 0 }, { cue: 'CHANGE', at: AT.CHANGE + 0.25, dur: 0.9, ease: 'out', scaleX: 1 }],
    });
    els.push({ type: 'line', x1: nowX, y1: ty - 14, x2: nowX, y2: ty + barH + 14, stroke: 'ink', width: 5, cap: 'round', enter: 'draw', cue: 'CHANGE', at: AT.CHANGE + 1.0, dur: 0.3 });
    els.push(text(money(now), nowX, below.amount, big, 'bold', 'accent', { anchor: 'end', enter: 'rise', dist: 18, cue: 'CHANGE', at: AT.CHANGE + 1.05, dur: 0.45 }));
    els.push(text('NOWLABEL', nowX, below.label, small, 'strong', 'ink', { anchor: 'end', enter: 'fade', cue: 'CHANGE', at: AT.CHANGE + 1.3, dur: 0.4 }));

    // NOTE: what happens in the part that changed, set in that span (below the bar where it was
    // cut, above it where it grew), or on its own line when the span is too narrow to hold it.
    if (note) {
      const [from, to] = shorter ? [nowX, wasX] : [wasX, nowX];
      const room = to - from - 48;
      const inSpan = room >= (T ? 330 : 380);
      const y = inSpan ? (shorter ? below.amount - big * 0.3 : above.amount - big * 0.3) : below.label + small * 2.2;
      els.push(text('NOTE', inSpan ? from + 40 : x0, round(y), small, 'text', 'ink', { width: round(inSpan ? room : W), enter: 'rise', dist: 14, cue: 'NOTE', at: AT.NOTE, dur: 0.45 }));
      if (inSpan) els.push({ type: 'line', x1: from + 20, y1: round(y - small * 0.9), x2: from + 20, y2: round(y + small * 1.6), stroke: 'accent', width: 4, cap: 'round', enter: 'draw', cue: 'NOTE', at: AT.NOTE, dur: 0.3 });
    }
    return { elements: els };
  },
};
