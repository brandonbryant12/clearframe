import { body, crisp, rng, round, smoothPath } from '../../film/sketch-kit.mjs';

// A value held while the market moves: a time axis spans the window (a rate lock's 45 days), a
// locked level line runs across it from a padlock tag, and a market line wanders off from the
// same start. On RISE the market climbs above the lock and the gap between them shades in behind
// its tip: what the lock keeps, measured and labelled. With a fall the market then drops below
// the lock; with a float-down the locked line steps down once to meet it. On END the window
// closes. The market's path is seeded and smooth; its peak and low are exactly the levels in
// sketchParams, and every printed value comes from sketchParams. Moments: LOCK, RISE, FALL (only
// when fall > 0), END.
const SAMPLES = 100;

/** A smooth curve through (t, v) keys that never overshoots them (Fritsch–Carlson). */
function monotone(keys) {
  const n = keys.length,
    xs = keys.map(k => k[0]),
    ys = keys.map(k => k[1]);
  const d = xs.slice(0, -1).map((x, i) => (ys[i + 1] - ys[i]) / (xs[i + 1] - x));
  const m = ys.map((_, i) => (i === 0 ? d[0] : i === n - 1 ? d[n - 2] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = m[i + 1] = 0;
      continue;
    }
    const a = m[i] / d[i],
      b = m[i + 1] / d[i],
      s = a * a + b * b;
    if (s > 9) [m[i], m[i + 1]] = [(3 * a * d[i]) / Math.sqrt(s), (3 * b * d[i]) / Math.sqrt(s)];
  }
  return t => {
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i],
      u = Math.min(1, Math.max(0, (t - xs[i]) / h)),
      u2 = u * u,
      u3 = u2 * u;
    return (2 * u3 - 3 * u2 + 1) * ys[i] + (u3 - 2 * u2 + u) * h * m[i] + (-2 * u3 + 3 * u2) * ys[i + 1] + (u3 - u2) * h * m[i + 1];
  };
}

/** A padlock centred on (x, y) at scale s; its shackle can be lifted (open) by a key. */
function padlock(x, y, s, fill, hole) {
  const bw = round(30 * s),
    bh = round(23 * s),
    by = round(y - 6 * s),
    leg = round(9 * s),
    top = round(by - 7 * s);
  return {
    shackle: {
      type: 'path',
      d: `M ${round(x - leg)} ${round(by + 2)} L ${round(x - leg)} ${top} A ${leg} ${leg} 0 0 1 ${round(x + leg)} ${top} L ${round(x + leg)} ${round(by + bh * 0.6)}`,
      fill: 'none',
      stroke: fill,
      width: round(4.5 * s),
      cap: 'round',
      enter: 'none',
    },
    body: { type: 'rect', x: round(x - bw / 2), y: by, w: bw, h: bh, r: round(5 * s), fill, enter: 'none' },
    keyhole: { type: 'circle', cx: x, cy: round(by + bh * 0.45), r: round(3.2 * s), fill: hole, enter: 'none' },
  };
}

/** Day ticks at a round step, at most six of them, the last always the window's end. */
function dayTicks(days) {
  const step = [1, 2, 5, 7, 10, 15, 30, 60, 90, 180, 365].find(s => days / s <= 5) ?? Math.ceil(days / 5);
  const ticks = [];
  for (let d = 0; d < days - step * 0.55; d += step) ticks.push(d);
  return [...ticks, days];
}

export default {
  name: 'hold',
  keep: true,
  order: 98,
  summary:
    'A value held while the market moves: a locked level line with a padlock and its value runs across a time window; the market wanders off from the same start and climbs above it, and the gap shades in as what the lock keeps. Optional fall below the lock, with a float-down step.',
  use: 'A mortgage rate lock, a price lock, a fixed rate against a variable one, a guaranteed rate or premium: "your rate is locked at 6.25% for 45 days; if rates rise to 6.85%, you keep 6.25%". Set the figures with sketchParams {lock, rise, fall, floatDown, days, prefix, suffix, decimals}: rise and fall are distances from the lock in the same units (a market at 6.85% against a 6.25% lock is rise 0.6), fall 0 draws no fall, floatDown true steps the lock down to the market\'s low. Replace LOCKED (the lock line, e.g. "Your locked rate"), MARKET (the moving line, e.g. "Market rate"), WINDOW (under the day axis, e.g. "Days since you lock") and KEPT (words after the gap, up to about 24 characters, e.g. "below the market") with sketchText; land LOCK, RISE, FALL (with a fall) and END (the window closes) on words with sketchSay. The figures need a visible source like any number.',
  params: {
    lock: { default: 6.25, min: 0, max: 1000000, about: 'the locked value, in the printed units (6.25 for a 6.25% rate)' },
    rise: {
      default: 0.6,
      min: 0.01,
      max: 1000000,
      about: 'how far the market climbs above the lock, in the same units',
      hint: 'A distance above the lock, not the new level: for a market at 6.85% against a 6.25% lock, rise is 0.6 (not 6.85).',
    },
    fall: {
      default: 0,
      min: 0,
      max: 1000000,
      about: 'then how far the market drops below the lock, in the same units (0 for no fall)',
      hint: 'A distance below the lock, not the new level: for a market at 5.9% against a 6.25% lock, fall is 0.35 (not 5.9).',
    },
    floatDown: { default: false, about: 'true: when the market falls, the locked line steps down once to meet its low (a float-down option)' },
    days: { default: 45, min: 2, max: 730, integer: true, about: 'length of the window, in days' },
    prefix: { default: '', about: 'printed before each value, e.g. "$" for a price lock (or "" for none)' },
    suffix: { default: '%', about: 'printed after each value, e.g. "%" (or "" for none)' },
    decimals: { default: 2, min: 0, max: 4, integer: true, about: 'decimal places in the printed values (2 for 6.25%)' },
  },
  build(w, h, { seed = 7, params = {} } = {}) {
    const { lock = 6.25, rise = 0.6, fall = 0, floatDown = false, days = 45, prefix = '', suffix = '%', decimals = 2 } = params;
    const falls = fall > 0;
    const steps = falls && floatDown;
    const fmt = v => {
      const s = Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
      return `${v < 0 && Number(s.replace(/,/g, '')) !== 0 ? '−' : ''}${prefix}${s}${suffix}`;
    };
    const peak = lock + rise,
      low = lock - fall;
    // Moments: the market's fall gets its own beat between the climb and the close.
    const AT = falls ? { LOCK: 0.6, RISE: 2.2, FALL: 4.4, END: 6.6 } : { LOCK: 0.6, RISE: 2.2, END: 4.6 };

    // The market, in values: a short wander just under the lock, a climb to the peak, and (with
    // a fall) a slide to the low; seeded ripples ride on it, never past the peak or the low.
    const S = rise + fall;
    const T = falls ? { A: 0.2, peak: 0.46, B: 0.6, low: 0.84 } : { A: 0.2, peak: 1, B: 1 };
    // Small pullbacks on the way (a monotone curve turns flat at each key, so they ripple).
    const trend = monotone(
      falls
        ? [[0, lock], [0.08, lock - 0.06 * S], [T.A, lock], [0.31, lock + 0.55 * rise], [0.36, lock + 0.5 * rise], [T.peak, peak], [0.53, peak - 0.14 * S], [T.B, peak - 0.08 * S], [0.72, lock - 0.45 * fall], [0.77, lock - 0.35 * fall], [T.low, low], [1, low + 0.08 * S]]
        : [[0, lock], [0.08, lock - 0.06 * S], [T.A, lock], [0.36, lock + 0.4 * rise], [0.42, lock + 0.36 * rise], [0.6, lock + 0.78 * rise], [0.7, lock + 0.74 * rise], [0.86, lock + 0.92 * rise], [1, peak]],
    );
    const rand = rng(seed);
    const waves = [
      [2.6 + rand(), 0.55],
      [5.5 + 1.5 * rand(), 0.3],
      [10 + 2 * rand(), 0.15],
    ].map(([f, a]) => [f, a, rand() * Math.PI * 2]);
    const amp = 0.06 * S;
    const value = t => {
      const v = trend(t);
      // Room to ripple: never above the lock before the climb, never past the peak or the low.
      const ceil = t <= T.A ? lock : peak,
        floor = falls && t > T.A ? low : lock - 0.12 * S;
      const room = Math.max(0, Math.min(ceil - v, v - floor)) / 1.15;
      const ramp = Math.min(1, t / 0.06);
      const n = waves.reduce((s, [f, a, p]) => s + a * Math.sin(2 * Math.PI * f * t + p), 0);
      return v + Math.min(amp, room) * ramp * ramp * n;
    };
    const vals = Array.from({ length: SAMPLES + 1 }, (_, i) => value(i / SAMPLES));
    const vmin = Math.min(...vals),
      vmax = peak;

    // Layout: the lock's tag hangs in a gutter left of the window, where both lines start, with
    // its words over it; narrow frames make the gutter just wide enough for the tag.
    const wide = w >= 1400;
    const b = body(w, h);
    const fs = wide ? { tag: 46, label: 34, value: 46, tick: 30, kept: 54 } : { tag: 38, label: 32, value: 44, tick: 30, kept: 50 };
    // Type stays inside the title-safe width (in narrow frames even after the beat's slow push).
    const L = wide ? 200 : round(w * 0.115 + 6),
      R = w - L;
    const tagH = wide ? 76 : 66;
    const tagW = v => round(Math.min(wide ? 380 : 330, (wide ? 96 : 80) + fmt(v).length * fs.tag * 0.6));
    const gap = wide ? 30 : 22;
    const x0 = wide ? 580 : round(L + tagW(lock) + gap),
      x1 = wide ? 1640 : round(R - 22);
    // The lowest level drawn sits clear of the axis: room under the low's label or the
    // float-down's tag. A tall frame keeps the lines no taller than the window is wide (so a
    // ripple stays a ripple) and centres the picture in the room it leaves.
    const under = steps ? 124 : falls ? 92 : 40;
    let top = b.y + (wide ? 80 : 120),
      axisY = b.y + b.h - (wide ? 64 : 120);
    const slack = wide ? 0 : Math.max(0, axisY - under - top - 0.8 * (x1 - x0));
    top = round(top + slack / 2);
    axisY = round(axisY - slack / 2);
    const bottom = round(axisY - under);
    const yOf = v => round(bottom - ((v - vmin) / (vmax - vmin)) * (bottom - top));
    const xOf = t => round(x0 + t * (x1 - x0));
    const lockY = yOf(lock),
      lowY = yOf(low),
      peakY = yOf(peak);
    const pts = vals.map((v, i) => [xOf(i / SAMPLES), yOf(v)]);
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const cued = (cue, dt, extra = {}) => ({ cue, at: round(AT[cue] + dt), after: round(dt), ...extra });
    const els = [];

    // The market is drawn in phases, each on its own moment: the wander (just after LOCK), the
    // climb (RISE) and the slide (FALL). `tip(i)` is when the line's tip reaches sample i.
    const iA = Math.round(T.A * SAMPLES),
      iB = Math.round(T.B * SAMPLES);
    const phases = [
      { cue: 'LOCK', from: 0, to: iA, delay: 0.35, dur: 0.95 },
      { cue: 'RISE', from: iA, to: iB, delay: 0, dur: falls ? 1.5 : 1.8 },
      ...(falls ? [{ cue: 'FALL', from: iB, to: SAMPLES, delay: 0, dur: 1.5 }] : []),
    ];
    for (const p of phases) {
      p.len = [0];
      for (let i = p.from + 1; i <= p.to; i++) p.len.push(p.len.at(-1) + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    }
    const phaseOf = i => phases.find(p => i > p.from && i <= p.to) ?? phases[0];
    const tip = i => {
      const p = phaseOf(i);
      return { cue: p.cue, dt: round(p.delay + (p.dur * p.len[i - p.from]) / p.len.at(-1)) };
    };
    // (Keys are made fresh for each element: filling a sketch rewrites them in place.)
    const recede = (opacity = 0.4) => ({ cue: 'END', at: round(AT.END + 0.2), after: 0.2, dur: 0.6, opacity });

    // The window: a quiet panel, the day axis with its ticks, the start and end of the window.
    // (Fills that carry type or a quantity stay flat in a drawn film: crisp.)
    els.push(...crisp([{ type: 'rect', x: x0, y: top - 40, w: x1 - x0, h: axisY - top + 40, r: 18, fill: 'surface', opacity: 0.55, enter: 'none', at: 0 }]));
    els.push({ type: 'line', x1: x0, y1: axisY, x2: x1, y2: axisY, stroke: 'line', width: 3, cap: 'round', enter: 'none', at: 0 });
    const ticks = dayTicks(days);
    ticks.forEach((d, k) => {
      const x = round(x0 + (d / days) * (x1 - x0));
      const last = k === ticks.length - 1;
      els.push({ type: 'line', x1: x, y1: axisY, x2: x, y2: axisY + 12, stroke: 'line', width: 3, enter: 'none', at: 0 });
      els.push(text(String(d), x, axisY + 48, fs.tick, last ? 'bold' : 'semibold', last ? 'ink' : 'muted', { anchor: 'middle', enter: 'none', at: 0 }));
    });
    // What the axis counts: on the tick row in the gutter (wide frames), under the ticks in narrow ones.
    els.push(
      wide
        ? text('WINDOW', x0 - 40, axisY + 48, fs.label, 'semibold', 'ink', { anchor: 'end', fit: x0 - 40 - L, enter: 'none', at: 0 })
        : text('WINDOW', round((x0 + x1) / 2), axisY + 96, fs.label, 'semibold', 'ink', { anchor: 'middle', fit: x1 - x0 - 40, enter: 'none', at: 0 }),
    );
    // The window's end: dashed from the first frame, drawn solid when it closes.
    els.push({ type: 'line', x1, y1: top - 40, x2: x1, y2: axisY, stroke: 'line', width: 3, dash: [8, 8], enter: 'none', at: 0 });

    // The lock line, drawn across the window on LOCK (with a float-down, up to the market's low:
    // its tail is drawn below, so it can step down).
    const iL = steps ? Math.round(T.low * SAMPLES) : null;
    const xs = steps ? pts[iL][0] : x1;
    const lockDraw = 0.9,
      share = (xs - x0) / (x1 - x0);
    const lockLine = { stroke: 'accent', width: 7, cap: 'round', enter: 'draw', drawEase: 'linear' };
    els.push({ type: 'line', x1: x0, y1: lockY, x2: xs, y2: lockY, ...lockLine, dur: round(lockDraw * share), ...cued('LOCK', 0.15) });

    // What the lock keeps: the gap between the market above it and the lock, shaded in slices
    // just behind the market's tip (down to the top of the lock line's stroke, over it).
    const shadeY = round(lockY - 3);
    const above = [];
    for (let i = iA; i <= SAMPLES; i++) if (vals[i] > lock) above.push(i);
    const crossing = (i, j) => {
      const [a, b2] = [pts[i], pts[j]];
      const k = (shadeY - a[1]) / (b2[1] - a[1]);
      return [round(a[0] + (b2[0] - a[0]) * k), shadeY];
    };
    let iu = null,
      id = null;
    if (above.length) {
      iu = above[0];
      id = above[0];
      while (vals[id + 1] > lock && id + 1 <= SAMPLES) id++;
      const SL = 5;
      for (let a = iu; a < id; a += SL) {
        const z = Math.min(id, a + SL + 1);
        const edge = [];
        if (a === iu && iu > 0) edge.push(crossing(iu - 1, iu));
        for (let i = a; i <= z; i++) edge.push(pts[i]);
        if (z === id && id < SAMPLES) edge.push(crossing(id, id + 1));
        const { cue, dt } = tip(z);
        els.push({
          type: 'poly',
          rough: false,
          points: [...edge, [edge.at(-1)[0], shadeY], [edge[0][0], shadeY]],
          closed: true,
          fill: 'wash',
          enter: 'fade',
          dur: 0.3,
          ...cued(cue, round(dt + 0.05)),
        });
      }
    }

    // The float-down: the lock's tail steps down to the low, over a trace of the old level.
    if (steps) {
      const { dt } = tip(iL);
      const drop = { cue: 'FALL', at: round(AT.FALL + dt + 0.15), after: round(dt + 0.15), dur: 0.55, ease: 'inOut', y: round(lowY - lockY) };
      els.push({ type: 'line', x1: xs, y1: lockY, x2: x1, y2: lockY, stroke: 'accent', width: 3, dash: [10, 10], opacity: 0.45, enter: 'fade', dur: 0.3, ...cued('FALL', round(dt + 0.15)) });
      els.push({ type: 'line', x1: xs, y1: lockY, x2: xs, y2: lowY, stroke: 'accent', width: 7, cap: 'round', enter: 'draw', drawEase: 'linear', dur: 0.55, ...cued('FALL', round(dt + 0.15)) });
      els.push({ type: 'line', x1: xs, y1: lockY, x2: x1, y2: lockY, ...lockLine, dur: round(lockDraw * (1 - share)), ...cued('LOCK', round(0.15 + lockDraw * share)), keys: [drop] });
    }

    // The market: one stroke per phase, with a dot riding each tip; the last dot stays at the end.
    phases.forEach((p, k) => {
      const seg = pts.slice(p.from, p.to + 1);
      const d = smoothPath(seg);
      els.push({ type: 'path', d, fill: 'none', stroke: 'accent2', width: 5, cap: 'butt', join: 'round', enter: 'draw', drawEase: 'linear', dur: p.dur, ...cued(p.cue, p.delay), keys: [recede()] });
      const next = phases[k + 1];
      els.push({
        type: 'circle',
        cx: seg[0][0],
        cy: seg[0][1],
        r: 10,
        fill: 'accent2',
        stroke: 'bg',
        width: 3,
        enter: 'fade',
        dur: 0.15,
        ...cued(p.cue, p.delay),
        along: { d, ease: 'linear', dur: p.dur, ...cued(p.cue, p.delay) },
        keys: next ? [{ cue: next.cue, at: AT[next.cue], dur: 0.15, opacity: 0 }] : [recede()],
      });
    });
    // The window closes: its end drawn solid.
    els.push({ type: 'line', x1, y1: top - 40, x2: x1, y2: axisY, stroke: 'ink', width: 4, cap: 'round', enter: 'draw', dur: 0.6, ...cued('END', 0) });
    // Both lines start from one point.
    els.push({ type: 'circle', cx: x0, cy: lockY, r: 11, fill: 'ink', stroke: 'bg', width: 3, enter: 'none', at: 0 });

    // The market's peak: a ring and its level above it, the line's name beside the level (wide
    // frames) or over it (narrow ones).
    const iP = Math.round(T.peak * SAMPLES);
    const peakAt = tip(iP);
    const labelW = wide ? 300 : 260;
    const valueW = round(fmt(peak).length * fs.value * 0.6);
    const right = R;
    const px = wide
      ? round(Math.min(Math.max(pts[iP][0], x0 + valueW / 2 + 220), right - valueW / 2))
      : round(Math.min(Math.max(pts[iP][0], x0 + labelW / 2), right - labelW / 2));
    els.push({ type: 'circle', cx: pts[iP][0], cy: peakY, r: 15, fill: 'none', stroke: 'accent2', width: 4, enter: 'pop', dur: 0.35, ...cued(peakAt.cue, peakAt.dt), keys: [recede()] });
    els.push({
      type: 'group',
      enter: 'rise',
      dist: 16,
      dur: 0.4,
      ...cued(peakAt.cue, round(peakAt.dt + 0.1)),
      keys: [recede(0.6)],
      children: wide
        ? [
            text('MARKET', round(px - valueW / 2 - 16), peakY - 34, fs.label - 2, 'semibold', 'muted', { anchor: 'end', fit: 280, enter: 'none' }),
            text(fmt(peak), px, peakY - 34, fs.value, 'bold', 'accent2', { anchor: 'middle', fit: labelW, enter: 'none' }),
          ]
        : [
            text('MARKET', px, peakY - 82, fs.label - 2, 'semibold', 'muted', { anchor: 'middle', fit: labelW, enter: 'none' }),
            text(fmt(peak), px, peakY - 32, fs.value, 'bold', 'accent2', { anchor: 'middle', fit: labelW, enter: 'none' }),
          ],
    });
    // The market's low (with a fall): its level under it, unless the lock steps down to it.
    if (falls && !steps) {
      const iLow = Math.round(T.low * SAMPLES);
      const at = tip(iLow);
      const lowW = round(fmt(low).length * fs.value * 0.6);
      const lx = round(Math.min(Math.max(pts[iLow][0], x0 + lowW / 2), right - lowW / 2));
      els.push({ type: 'circle', cx: pts[iLow][0], cy: lowY, r: 15, fill: 'none', stroke: 'accent2', width: 4, enter: 'pop', dur: 0.35, ...cued(at.cue, at.dt), keys: [recede()] });
      els.push(text(fmt(low), lx, lowY + 66, fs.value, 'bold', 'accent2', { anchor: 'middle', fit: labelW, enter: 'rise', dist: 16, dur: 0.4, ...cued(at.cue, round(at.dt + 0.1)), keys: [recede(0.6)] }));
    }

    // The tag: a padlock and the locked value, hanging at the start of the lock line; a
    // float-down hangs a second one under the step.
    const tag = (x, y, v, anchor, timing, extra = {}) => {
      const tw = tagW(v);
      const tx = anchor === 'end' ? x - tw : x;
      const lockScale = wide ? 1.25 : 1.1;
      const pl = padlock(round(tx + tagH * 0.6), round(y), lockScale, 'bg', 'accent');
      return crisp([{
        type: 'group',
        enter: 'pop',
        dur: 0.4,
        origin: [round(tx + tw / 2), round(y)],
        ...timing,
        ...extra,
        children: [
          { type: 'rect', x: tx, y: round(y - tagH / 2), w: tw, h: tagH, r: tagH / 2, fill: 'accent', enter: 'none' },
          // The shackle starts open and snaps shut once the tag has landed.
          { ...pl.shackle, keys: [{ at: 0, dur: 0, y: -9 }, { ...timing, at: round(timing.at + 0.3), ...(timing.after != null ? { after: round(timing.after + 0.3) } : {}), dur: 0.22, ease: 'in', y: 0 }] },
          pl.body,
          pl.keyhole,
          text(fmt(v), round(tx + tagH * 1.08), round(y + fs.tag * 0.36), fs.tag, 'bold', 'bg', { fit: round(tw - tagH * 1.08 - 22), enter: 'none' }),
        ],
      }])[0];
    };
    const lockTag = { x: x0 - gap, y: lockY, anchor: 'end' };
    const pulse = () => ({ cue: 'END', at: round(AT.END + 0.3), after: 0.3, dur: 0.6, ease: 'thereAndBack', scale: 1.08 });
    els.push(tag(lockTag.x, lockTag.y, lock, lockTag.anchor, cued('LOCK', 0), { keys: [steps ? recede(0.55) : pulse()] }));
    els.push(
      // (Narrow frames let the words run on over the start of the window, where the market
      // still sits under the lock.)
      text('LOCKED', wide ? lockTag.x : L, round(lockTag.y - tagH / 2 - 16), fs.label, 'semibold', 'ink', {
        anchor: wide ? 'end' : 'start',
        fit: wide ? x0 - gap - L : round(x0 - L + (x1 - x0) * 0.12),
        enter: 'rise',
        dist: 14,
        dur: 0.4,
        ...cued('LOCK', 0.3),
      }),
    );
    if (steps) {
      const { dt } = tip(iL);
      const sx = round(Math.min(xs + 26, x1 - tagW(low)));
      els.push(tag(sx, round(lowY + 34 + tagH / 2), low, 'start', cued('FALL', round(dt + 0.6)), { keys: [pulse()] }));
    }
    // The end of the lock line, once the window has closed.
    els.push({ type: 'circle', cx: x1, cy: steps ? lowY : lockY, r: 11, fill: 'accent', stroke: 'bg', width: 3, enter: 'pop', dur: 0.35, ...cued('END', 0.45) });

    // What the lock keeps: the gap's size and its words, set inside the shaded gap where it is
    // roomy enough (else just under the lock line), once the climb has shaded it.
    if (iu != null) {
      const kw = wide ? 380 : 330,
        kh = round(fs.kept + fs.label + 14),
        pad = 14;
      const end = falls ? Math.min(id, iB) : id;
      const xa = pts[iu][0],
        xb = pts[end][0];
      let best = null;
      for (let cx = xa + kw / 2 + pad; cx <= xb - kw / 2 - pad; cx += 8) {
        const span = pts.filter(([x]) => x >= cx - kw / 2 - pad && x <= cx + kw / 2 + pad);
        const lowest = Math.max(...span.map(p => p[1]));
        const room = lockY - lowest;
        if (room >= kh + 2 * pad && (!best || room > best.room + 4)) best = { cx, room, top: round(lowest + (room - kh) / 2) };
      }
      let place = best;
      if (!place) {
        // Under the lock line, beneath the shaded gap, clear of the lock's own tag.
        let cx = round((xa + xb) / 2);
        if (falls) cx = Math.min(cx, round(pts[id][0] - kw / 2 - 20));
        cx = Math.min(Math.max(cx, x0 + kw / 2), x1 - kw / 2);
        place = { cx, top: lockY + 26 };
      }
      const at = tip(end);
      const timing = falls ? cued('RISE', round(phases[1].dur + 0.1)) : cued(at.cue, round(at.dt + 0.1));
      els.push({
        type: 'group',
        enter: 'rise',
        dist: 16,
        dur: 0.45,
        ...timing,
        children: [
          text(fmt(rise), place.cx, round(place.top + fs.kept * 0.8), fs.kept, 'bold', 'accent', { anchor: 'middle', fit: kw, enter: 'none' }),
          text('KEPT', place.cx, round(place.top + fs.kept * 0.8 + fs.label + 12), fs.label, 'semibold', 'ink', { anchor: 'middle', fit: kw, enter: 'none' }),
        ],
      });
    }
    return { elements: els };
  },
};
