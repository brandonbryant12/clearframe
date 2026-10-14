import { body, round } from '../../film/sketch-kit.mjs';

// Ownership that unlocks over time: a timeline of steps (years, quarters), each with a padlock
// and a column. As time reaches a step, the timeline fills to it, the padlock springs open and
// the column grows to the share owned by then; the big figure beside it counts up to the same
// share. A step that adds nothing (a cliff year) keeps its lock shut and gives it a shake. The
// shares come from sketchParams, never from the drawing. Moments: ONE, TWO, THREE … SIX, one per step.
const NAMES = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
const FIRST = 1.0,
  GAP = 1.8;

/**
 * A padlock centred on (x, y) at scale s. The shackle is drawn first, its right leg running down
 * into the body (hidden by it), so lifting it frees the short left leg: the lock is open.
 */
function padlock(x, y, s, fill) {
  const bw = round(30 * s),
    bh = round(23 * s),
    by = round(y - 2 * s),
    leg = round(9 * s),
    top = round(by - 8 * s);
  return {
    shackle: {
      type: 'path',
      d: `M ${round(x - leg)} ${by} L ${round(x - leg)} ${top} A ${leg} ${leg} 0 0 1 ${round(x + leg)} ${top} L ${round(x + leg)} ${round(by + bh * 0.6)}`,
      fill: 'none',
      stroke: fill,
      width: round(4.5 * s),
      cap: 'round',
      enter: 'none',
    },
    body: { type: 'rect', x: round(x - bw / 2), y: by, w: bw, h: bh, r: round(5 * s), fill, enter: 'none' },
    keyhole: { type: 'circle', cx: x, cy: round(by + bh * 0.45), r: round(3.2 * s), enter: 'none' },
  };
}

export default {
  name: 'vesting',
  keep: true,
  order: 92,
  summary:
    'Ownership that unlocks over time: a timeline of steps, each with a padlock and a column. As each step arrives its lock springs open, its column grows to the share owned by then and a big figure counts up to it. Shares come from the real schedule.',
  use: 'Vesting of a company match, stock awards or a pension: "after one year you own a third, after three it is all yours", including cliffs (a step that adds nothing keeps its lock shut). Set the shares with sketchParams {steps: [33, 66, 100]} (1–6 cumulative percentages, rising); replace WHAT (what vests, e.g. "of the company match is yours") and STEP1, STEP2 … one per step (e.g. "Year 1") with sketchText; land ONE, TWO, THREE … (one per step) on words with sketchSay. The shares need a visible source like any figure.',
  params: {
    steps: {
      default: [33, 66, 100],
      list: true,
      length: [1, 6],
      min: 0,
      max: 100,
      about: 'share owned after each step, in percent: 1–6 values, each at least the one before (e.g. [0, 0, 100] for a three-year cliff)',
    },
  },
  build(w, h, { params = {} } = {}) {
    const steps = params.steps ?? [33, 66, 100];
    steps.forEach((v, i) => {
      if (i && v < steps[i - 1]) throw new Error(`sketchParams.steps for vesting must not fall from one step to the next (got ${steps.join(', ')})`);
    });
    const n = steps.length;
    // Wide frames put the figure beside the columns; narrower ones stack it above them.
    const T = w < 1400;
    const b = body(w, h);
    const at = i => round(FIRST + i * GAP);
    // Frame: the figure and what vests (left in landscape, on top in tall frames), then the
    // columns standing on the timeline.
    const y = k => round(b.y + b.h * k);
    // A short frame (square, portrait) sets what vests beside a smaller figure, to leave the
    // columns their height.
    const short = T && b.h < 900;
    const figSize = short ? 110 : T ? 190 : 180;
    const fig = short
      ? { x: 130, y: b.y + 92, size: figSize, width: round(figSize * 2.9) }
      : T
        ? { x: 130, y: y(0.192), size: figSize, width: w - 260 }
        : { x: 150, y: y(0.517), size: figSize, width: round(w * 0.27) };
    const what = short
      ? { x: round(fig.x + figSize * 2.95), y: fig.y - 50, size: 38, width: round(w - fig.x - figSize * 2.95 - 96) }
      : { x: fig.x, y: fig.y + 86, size: T ? 46 : 42, width: fig.width };
    const chart = short
      ? { x0: 110, x1: w - 110, top: fig.y + 100, label: b.y + b.h - 10 }
      : T
        ? { x0: 110, x1: w - 110, top: y(0.41), label: y(0.894) }
        : { x0: round(w * 0.396), x1: w - 120, top: y(0.17), label: y(0.98) };
    chart.line = round(chart.label - (T ? 92 : 88));
    chart.bottom = round(chart.line - (T ? 98 : 88));
    const span = (chart.x1 - chart.x0) / n;
    const cx = i => round(chart.x0 + span * (i + 0.5));
    const cw = round(Math.min(T ? 150 : 140, span * 0.52));
    const H = round(chart.bottom - chart.top);
    const node = T ? 40 : 38;
    const lockScale = node / 30;
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x, y, size, font, fill, ...extra });
    const els = [];

    // The timeline: a hairline across, a start dot, and progress that fills to each step in turn.
    els.push({ type: 'line', x1: chart.x0, y1: chart.line, x2: chart.x1, y2: chart.line, stroke: 'line', width: 4, cap: 'round', enter: 'draw', at: 0, dur: 0.7 });
    els.push({ type: 'circle', cx: chart.x0, cy: chart.line, r: 9, fill: 'accent', enter: 'pop', at: 0.1, dur: 0.35 });
    steps.forEach((_, i) =>
      els.push({
        type: 'line',
        x1: i ? cx(i - 1) : chart.x0,
        y1: chart.line,
        x2: cx(i),
        y2: chart.line,
        stroke: 'accent',
        width: 6,
        cap: 'round',
        enter: 'draw',
        drawEase: 'out',
        cue: NAMES[i],
        at: at(i),
        dur: 0.4,
      }),
    );

    steps.forEach((pct, i) => {
      const x = cx(i);
      const hgt = round((H * pct) / 100);
      const opens = pct > (i ? steps[i - 1] : 0);
      const cue = NAMES[i];
      const t0 = at(i);
      const after = (dt, extra = {}) => ({ cue, at: round(t0 + dt), after: dt, ...extra });
      // The column: a pale track for the whole, the owned share growing up from the base.
      els.push({ type: 'rect', x: round(x - cw / 2), y: chart.top, w: cw, h: H, r: round(Math.min(22, cw / 2)), fill: 'wash', enter: 'rise', dist: 30, at: round(0.15 + i * 0.07), dur: 0.5 });
      if (hgt > 0)
        els.push({
          type: 'rect',
          x: round(x - cw / 2),
          y: round(chart.bottom - hgt),
          w: cw,
          h: hgt,
          r: round(Math.min(22, cw / 2, hgt / 2)),
          fill: 'accent',
          enter: 'none',
          origin: [x, chart.bottom],
          ...after(0.2),
          keys: [after(0.2, { dur: 0, scaleY: 0 }), after(0.2, { dur: 0.9, ease: 'out', scaleY: 1 })],
        });
      // The share, riding the top of the column as it grows.
      els.push(
        text(null, x, round(chart.bottom - 22), T ? 46 : 44, 'bold', 'ink', {
          text: undefined,
          count: { from: 0, to: pct, suffix: '%', dur: 0.9 },
          anchor: 'middle',
          fit: round(span - 14),
          enter: 'fade',
          dur: 0.3,
          ...after(0.2),
          keys: [after(0.2, { dur: 0.9, ease: 'out', y: -hgt })],
        }),
      );
      // The step on the timeline: a node with its padlock.
      els.push({ type: 'circle', id: `vesting-step-${i + 1}`, cx: x, cy: chart.line, r: node, fill: 'surface', stroke: 'line', width: 3, enter: 'pop', at: round(0.25 + i * 0.07), dur: 0.4 });
      const shut = padlock(x, chart.line, lockScale, 'muted');
      const shutLock = {
        type: 'group',
        enter: 'fade',
        at: round(0.35 + i * 0.07),
        dur: 0.3,
        origin: [x, chart.line],
        children: [shut.shackle, shut.body, { ...shut.keyhole, fill: 'surface' }],
      };
      // (Leaving by keys, not exits, so a moment retimed early can never come before an entrance.)
      if (opens) shutLock.keys = [after(0.1, { dur: 0.12, opacity: 0 })];
      // A cliff: time passes, the lock stays shut and shakes.
      else shutLock.keys = [after(0.25, { dur: 0.6, ease: 'wiggle', rotate: 9 })];
      els.push(shutLock);
      if (opens) {
        const open = padlock(x, chart.line, lockScale, 'bg');
        els.push({ type: 'circle', cx: x, cy: chart.line, r: node + 2, fill: 'accent', enter: 'pop', dur: 0.35, ...after(0.1) });
        els.push({
          type: 'group',
          enter: 'fade',
          dur: 0.15,
          ...after(0.12),
          children: [
            // The shackle springs up, freeing its left leg.
            { ...open.shackle, keys: [after(0.16, { dur: 0.5, ease: 'overshoot', y: round(-8 * lockScale) })] },
            open.body,
            { ...open.keyhole, fill: 'accent' },
          ],
        });
      }
      // The most recent step breathes until the next one arrives.
      const halo = {
        type: 'circle',
        cx: x,
        cy: chart.line,
        r: node + 12,
        fill: 'none',
        stroke: opens ? 'accent' : 'line',
        width: 3,
        opacity: 0.55,
        enter: 'pop',
        dur: 0.4,
        origin: [x, chart.line],
        loop: { type: 'pulse', period: 2.4, amount: 0.06 },
        ...after(0.45),
      };
      if (i < n - 1) halo.keys = [{ cue: NAMES[i + 1], at: at(i + 1), dur: 0.25, opacity: 0 }];
      els.push(halo);
      els.push(text(`STEP${i + 1}`, x, chart.label, 34, 'semibold', 'muted', { anchor: 'middle', fit: round(span - 16), enter: 'fade', at: round(0.4 + i * 0.07), dur: 0.4 }));
      // The big figure: the share owned now. It rises in on the first step; at each later step
      // it hands over, on the same frame, to a figure counting on from where it stood.
      const figure = text(null, fig.x, fig.y, fig.size, 'bold', 'accent', {
        text: undefined,
        count: { from: i ? steps[i - 1] : 0, to: pct, suffix: '%', dur: 0.9 },
        fit: fig.width,
        enter: i ? 'none' : 'rise',
        dist: 40,
        dur: i ? 0 : 0.4,
        ...after(0.2),
      });
      if (i < n - 1) figure.keys = [{ cue: NAMES[i + 1], at: round(at(i + 1) + 0.2), after: 0.2, dur: 0, opacity: 0 }];
      els.push(figure);
    });
    // What the share is a share of, under the figure.
    els.push(text('WHAT', what.x, what.y, what.size, 'semibold', 'ink', { width: what.width, leading: 1.18, enter: 'fade', at: 0.3, dur: 0.5 }));
    // Count-only figures carry no text.
    for (const el of els) if (el.type === 'text' && el.text == null) delete el.text;
    return { elements: els };
  },
};
