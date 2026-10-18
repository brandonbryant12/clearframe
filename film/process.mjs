// Where work waits: a serial flow of stages, each with a stated capacity per period, fed by a
// stated arrival rate. A deterministic, mass-conserving model steps it period by period — every
// item that arrives is waiting before a stage or done — and the picture shows the computed state:
// the elapsed periods, each queue as one token per item (or per `token` items) with its exact
// count and its change per period, and what is done. An intervention (`set` a capacity) starts a
// new run from the state the last one left: raising a capacity drains an existing queue at the
// computed rate, it never makes it vanish. The model is an illustration of stated assumptions, not
// a forecast of any real organisation's throughput; its numbers are labelled as such.
import { plotLayout, titleText, titleShift } from './plots.mjs';

const check = (ok, message) => { if (!ok) throw new Error(`process: ${message}`); };
const count = v => Number.isInteger(v) && v >= 0 && v <= 1e6;
const show = { at: 0, enter: 'none' };
const textWidth = (value, size) => String(value).length * size * 0.56;
const own = (o, keys, name) => {
  check(o && typeof o === 'object' && !Array.isArray(o), `${name} must be an object`);
  for (const k of Object.keys(o)) check(keys.includes(k), `unknown ${name}.${k} (it takes ${keys.join(', ')})`);
};
const words = (v, name, max) => { check(typeof v === 'string' && v.trim() && v.length <= max, `${name} needs text up to ${max} characters`); return v; };
const ID = /^[a-z][a-z0-9-]{0,23}$/;

/** Validate a process. Capacities and arrivals are whole items per period. */
export function processSpec(input) {
  own(input, ['id', 'title', 'unit', 'period', 'arrivals', 'stages', 'start', 'runs', 'token', 'done', 'source', 'asOf'], 'process');
  const p = { id: 'process', unit: 'items', period: 'day', token: 1, done: 'Done', ...structuredClone(input) };
  check(typeof p.id === 'string' && ID.test(p.id), 'id is a short lowercase name');
  words(p.title, 'title', 70);
  words(p.unit, 'unit (what flows, plural, e.g. "requests")', 24);
  words(p.period, 'period (e.g. "day")', 12);
  words(p.done, 'done (the label for finished work)', 20);
  // The figures are a model of stated assumptions: the source line says so unless it names a real source.
  p.source = words(p.source ?? 'Illustrative model of stated rates', 'source', 110);
  check(count(p.arrivals) && p.arrivals > 0, `arrivals must be a whole number of ${p.unit} per ${p.period} (more than 0)`);
  check(Number.isInteger(p.token) && p.token >= 1 && p.token <= 1000, 'token is how many items one token stands for (a whole number, 1 by default)');
  check(Array.isArray(p.stages) && p.stages.length >= 2 && p.stages.length <= 5,
    'stages needs 2–5 stages in order (a serial flow: every item passes through each stage once; branching flows are not modelled)');
  const ids = new Set();
  p.stages.forEach((s, i) => {
    own(s, ['id', 'label', 'capacity'], `stages[${i}]`);
    check(typeof s.id === 'string' && ID.test(s.id) && !ids.has(s.id), `stages[${i}].id is a unique short lowercase name`);
    ids.add(s.id);
    words(s.label, `stages[${i}].label`, 24);
    check(count(s.capacity) && s.capacity > 0, `stages[${i}].capacity must be a whole number of ${p.unit} per ${p.period} (more than 0)`);
  });
  if (p.start != null) {
    own(p.start, [...ids], 'start');
    for (const [k, v] of Object.entries(p.start)) check(count(v), `start.${k} is the ${p.unit} already waiting before ${k} (a whole number)`);
  }
  check(Array.isArray(p.runs) && p.runs.length >= 1 && p.runs.length <= 4, 'runs needs 1–4 stretches of model time: {periods, say|cue|at, dur, set?}');
  p.runs.forEach((r, i) => {
    own(r, ['periods', 'say', 'cue', 'at', 'after', 'dur', 'set'], `runs[${i}]`);
    check(Number.isInteger(r.periods) && r.periods >= 1 && r.periods <= 30, `runs[${i}].periods is 1–30 ${p.period}s of model time`);
    check(typeof r.dur === 'number' && r.dur >= 0.4 * r.periods && r.dur <= 20, `runs[${i}].dur is the seconds those ${r.periods} ${p.period}s take on screen (at least 0.4 s each, so every count can be read)`);
    check(['say', 'cue', 'at'].filter(k => r[k] != null).length <= 1, `runs[${i}] takes one of say, cue or at`);
    if (r.set != null) {
      own(r.set, [...ids], `runs[${i}].set`);
      for (const [k, v] of Object.entries(r.set)) check(count(v) && v > 0, `runs[${i}].set.${k} is the new capacity (a whole number more than 0)`);
    }
  });
  check(p.runs[0].set == null, 'the first run uses the stated capacities; change one in a later run');
  check(p.runs.reduce((a, r) => a + r.periods, 0) <= 40, 'at most 40 periods of model time in one beat');
  return p;
}

/**
 * The model, period by period. Each period: `arrivals` join the first queue; then, in order, each
 * stage takes up to its capacity from its queue and hands it to the next stage's queue (a hand-off
 * within the period), and the last stage's output is done. Returns every period's state; throws if
 * an item is ever created or lost (sum of queues + done must equal everything that arrived).
 */
export function processModel(p) {
  const n = p.stages.length;
  let queues = p.stages.map(s => p.start?.[s.id] ?? 0);
  const startQueued = queues.reduce((a, v) => a + v, 0);
  let caps = p.stages.map(s => s.capacity), done = 0, arrived = 0, period = 0;
  const states = [{ period, queues: [...queues], done, caps: [...caps], moved: Array(n).fill(0), run: -1 }];
  p.runs.forEach((r, ri) => {
    if (r.set) caps = p.stages.map((s, i) => r.set[s.id] ?? caps[i]);
    for (let k = 0; k < r.periods; k++) {
      period++;
      queues[0] += p.arrivals;
      arrived += p.arrivals;
      const moved = [];
      for (let i = 0; i < n; i++) {
        const take = Math.min(queues[i], caps[i]);
        queues[i] -= take;
        moved.push(take);
        if (i + 1 < n) queues[i + 1] += take;
        else done += take;
      }
      const total = queues.reduce((a, v) => a + v, 0) + done;
      check(total === arrived + startQueued, `model lost or created items in ${p.period} ${period}`);
      states.push({ period, queues: [...queues], done, caps: [...caps], moved, run: ri });
    }
  });
  return states;
}

/** Canvas elements: stages, queues, the period clock and the done count, from the model's states. */
export function processElements(p, frame, when = (r, fallback) => r?.at ?? fallback) {
  const { width: W, height: H } = frame;
  const L = { ...plotLayout(frame) };
  const wide = W >= H;
  if (!wide) L.margin = Math.max(L.margin, Math.round(W * 0.115) + 4);
  const states = processModel(p), n = p.stages.length;
  // Stage cards, labels and connectors are the same objects in every beat; readouts and queue
  // squares are this beat's states, so their ids carry the beat's (no morph re-times them).
  const timed = id => (frame.beatId ? `${frame.beatId}-${id}` : id);
  const shift = titleShift(p.title, L, W - 2 * L.margin);
  const title = titleText(p.title, L, W - 2 * L.margin);
  title.id = `pr-${p.id}-title`;
  const font = 34;
  const assumption = `${p.arrivals} ${p.unit} arrive each ${p.period}; capacities are ${p.unit} per ${p.period}`;
  const out = [title, { id: `pr-${p.id}-assumption`, type: 'text', text: assumption, x: L.margin, y: L.keyY + shift, size: Math.max(L.keyType, 26), fill: 'muted', font: 'semibold', fit: W - 2 * L.margin, ...show }];
  // Run times: each run starts on its word, moment or seconds, after the one before it ends.
  const runs = [];
  let clock = 0;
  for (const [i, r] of p.runs.entries()) {
    const start = when(r, i === 0 ? 0.6 : clock + 0.6);
    check(start >= clock - 1e-6, `runs[${i}] starts at ${start.toFixed(2)} s, before runs[${i - 1}] ends (${clock.toFixed(2)} s); cue it later or shorten the run before`);
    runs.push({ start, step: r.dur / r.periods });
    clock = start + r.dur;
  }
  // The time each period's state appears.
  const time = states.map(s => (s.run < 0 ? 0 : runs[s.run].start + runs[s.run].step * (s.period - states.findIndex(x => x.run === s.run) + 1)));
  // Values that change: one text per stretch it holds, swapped at the change (a stepped readout).
  // A readout that changes: one text per stretch it holds, swapped at the change. `times[k]` is
  // when `values[k]` takes over.
  const scheduled = (id, values, times, place, style = {}) => {
    let k = 0;
    while (k < values.length) {
      let j = k;
      while (j + 1 < values.length && values[j + 1] === values[k]) j++;
      const enter = k === 0 ? 0 : times[k], leave = j + 1 < values.length ? times[j + 1] : null;
      out.push({ id: timed(`${id}-${k}`), type: 'text', text: values[k], ...place, ...style, at: enter, enter: 'none', ...(leave != null ? { exit: 'none', exitAt: leave } : {}) });
      k = j + 1;
    }
  };
  // Queues, the clock and the done count are period-end states; a capacity is an assumption that
  // changes when its run starts (the intervention), before that run's first period has elapsed.
  const stepped = (id, values, place, style) => scheduled(id, values, time, place, style);
  const capacity = (i, place, style) => scheduled(`pr-${p.id}-${p.stages[i].id}-cap`,
    [states[0].caps[i], ...p.runs.map((r, ri) => states.find(s => s.run === ri).caps[i])].map(c => `${fmt(c)} a ${p.period}`),
    [0, ...runs.map(r => r.start)], place, style);
  // Layout: a row of stage cards (a column in a tall frame), each with its queue in front of it.
  const top = L.top + shift + (wide ? 60 : 40), bottom = L.bottom;
  const maxQueue = Math.max(...states.flatMap(s => s.queues));
  const maxTokens = Math.ceil(maxQueue / p.token);
  const cols = wide ? 5 : 8, tokenSize = wide ? 26 : 26, gap = 6, rowsOfTokens = Math.ceil(maxTokens / cols);
  check(rowsOfTokens <= (wide ? 8 : 3), `a queue reaches ${maxQueue} ${p.unit}, too many tokens to draw; set token to stand for more ${p.unit} (e.g. ${Math.ceil(maxQueue / (wide ? 40 : 30))})`);
  const pile = (cx, baseY, i, dir) => {
    // The final token can be a fraction of a group. Dropping it would make a
    // nonempty queue look empty whenever its count is smaller than `token`.
    for (let k = 1; k <= maxTokens; k++) {
      const amounts = states.map(s => Math.min(1, Math.max(0, (s.queues[i] - (k - 1) * p.token) / p.token)));
      let a = 0;
      while (a < amounts.length) {
        if (!amounts[a]) { a++; continue; }
        let b = a;
        while (b + 1 < amounts.length && amounts[b + 1] === amounts[a]) b++;
        const col = (k - 1) % cols, row = Math.floor((k - 1) / cols);
        const x = dir === 'up' ? cx - (cols * (tokenSize + gap) - gap) / 2 + col * (tokenSize + gap) : cx + (k - 1) * (tokenSize + gap) - Math.floor((k - 1) / cols) * cols * (tokenSize + gap);
        const y = dir === 'up' ? baseY - (row + 1) * (tokenSize + gap) : baseY + row * (tokenSize + gap);
        const timing = { at: a === 0 ? 0 : time[a], ...(b + 1 < amounts.length ? { exit: 'none', exitAt: time[b + 1] } : {}) };
        if (amounts[a] < 1)
          out.push({ id: timed(`pr-${p.id}-${p.stages[i].id}-slot${k}-${a}`), type: 'rect', x, y, w: tokenSize, h: tokenSize, r: 4,
            fill: 'none', stroke: 'muted', width: 1.5, opacity: 0.5, enter: 'none', ...timing });
        out.push({ id: timed(`pr-${p.id}-${p.stages[i].id}-q${k}-${a}`), type: 'rect', x, y, w: tokenSize * amounts[a], h: tokenSize, r: 4, fill: 'accent', opacity: 0.85,
          enter: a === 0 ? 'none' : 'pop', dur: 0.2, ...timing });
        a = b + 1;
      }
    }
  };
  const fmt = v => v.toLocaleString('en-US');
  const trend = i => states.map((s, k) => {
    const q = s.queues[i];
    if (k === 0) return q ? `${fmt(q)} waiting` : 'none waiting';
    const d = q - states[k - 1].queues[i];
    return `${fmt(q)} waiting${d > 0 ? ` · +${fmt(d)} a ${p.period}` : d < 0 ? ` · −${fmt(-d)} a ${p.period}` : ''}`;
  });
  if (wide) {
    const left = L.margin, right = W - L.margin, slots = n + 1, slot = (right - left) / slots;
    // The cards and the tallest pile sit together in the middle of the space under the heading.
    const cardW = Math.min(slot * 0.72, 300), cardH = 150, pileH = rowsOfTokens * (tokenSize + gap) + 70;
    const cardY = Math.round(top + (bottom - top - (pileH + cardH)) / 2 + pileH);
    for (const [i, s] of p.stages.entries()) {
      const cx = left + slot * (i + 0.5), x = cx - cardW / 2;
      out.push({ id: `pr-${p.id}-${s.id}-card`, type: 'rect', x, y: cardY, w: cardW, h: cardH, r: 14, fill: 'surface', stroke: 'line', width: 2, ...show },
        { id: `pr-${p.id}-${s.id}-label`, type: 'text', text: s.label, x: cx, y: cardY + 58, size: font, anchor: 'middle', font: 'strong', fill: 'ink', fit: cardW - 24, ...show });
      capacity(i, { x: cx, y: cardY + 110, size: font * 0.85, anchor: 'middle', font: 'figures', fit: cardW - 24 }, { fill: 'muted' });
      // The capacity that changed is marked, once, as it changes.
      for (const [ri, r] of p.runs.entries())
        if (r.set?.[s.id] != null)
          out.push({ id: timed(`pr-${p.id}-${s.id}-changed-${ri}`), type: 'rect', x: x - 6, y: cardY - 6, w: cardW + 12, h: cardH + 12, r: 18, fill: 'none', stroke: 'accent', width: 4, at: runs[ri].start, enter: 'draw', dur: 0.5 });
      // The queue waiting for this stage, a pile above the hand-off into it.
      const baseY = cardY - 70;
      pile(cx, baseY, i, 'up');
      stepped(`pr-${p.id}-${s.id}-queue`, trend(i), { x: cx, y: baseY + 44, size: font * 0.7, anchor: 'middle', font: 'figures', fit: slot * 0.96 }, { fill: 'ink' });
      if (i + 1 < n) out.push({ id: `pr-${p.id}-${s.id}-to`, type: 'line', x1: x + cardW + 8, y1: cardY + cardH / 2, x2: cx + slot - cardW / 2 - 8, y2: cardY + cardH / 2, stroke: 'muted', width: 3, arrow: 'end', ...show });
    }
    const dx = left + slot * (n + 0.5);
    out.push({ id: `pr-${p.id}-done-card`, type: 'rect', x: dx - cardW / 2, y: cardY, w: cardW, h: cardH, r: 14, fill: 'wash', ...show },
      { id: `pr-${p.id}-done-label`, type: 'text', text: p.done, x: dx, y: cardY + 58, size: font, anchor: 'middle', font: 'strong', fill: 'ink', fit: cardW - 24, ...show },
      { id: `pr-${p.id}-done-to`, type: 'line', x1: left + slot * (n - 0.5) + cardW / 2 + 8, y1: cardY + cardH / 2, x2: dx - cardW / 2 - 8, y2: cardY + cardH / 2, stroke: 'muted', width: 3, arrow: 'end', ...show });
    stepped(`pr-${p.id}-done-count`, states.map(st => fmt(st.done)), { x: dx, y: cardY + 112, size: font * 1.05, anchor: 'middle', font: 'figures', fit: cardW - 24 }, { fill: 'ink' });
    stepped(`pr-${p.id}-clock`, states.map(st => `${p.period[0].toUpperCase()}${p.period.slice(1)} ${st.period}`), { x: right, y: L.titleY, size: font * 1.1, anchor: 'end', font: 'figures', fit: 300 }, { fill: 'muted' });
  } else {
    const left = L.margin, right = W - L.margin, slots = n + 1, slot = (bottom - top) / slots;
    const cardW = (right - left) * 0.5, cardH = Math.min(slot * 0.62, 140);
    const qx = left + cardW + 36;
    for (const [i, s] of p.stages.entries()) {
      const cy = top + slot * (i + 0.5), y = cy - cardH / 2;
      out.push({ id: `pr-${p.id}-${s.id}-card`, type: 'rect', x: left, y, w: cardW, h: cardH, r: 14, fill: 'surface', stroke: 'line', width: 2, ...show },
        { id: `pr-${p.id}-${s.id}-label`, type: 'text', text: s.label, x: left + 24, y: y + cardH * 0.44, size: font, font: 'strong', fill: 'ink', fit: cardW - 48, ...show });
      capacity(i, { x: left + 24, y: y + cardH * 0.8, size: font * 0.85, font: 'figures', fit: cardW - 48 }, { fill: 'muted' });
      for (const [ri, r] of p.runs.entries())
        if (r.set?.[s.id] != null)
          out.push({ id: timed(`pr-${p.id}-${s.id}-changed-${ri}`), type: 'rect', x: left - 6, y: y - 6, w: cardW + 12, h: cardH + 12, r: 18, fill: 'none', stroke: 'accent', width: 4, at: runs[ri].start, enter: 'draw', dur: 0.5 });
      // Its queue beside it: the count on top, one square per item underneath.
      stepped(`pr-${p.id}-${s.id}-queue`, trend(i), { x: qx, y: y + font * 0.9, size: font * 0.7, font: 'figures', fit: right - qx }, { fill: 'ink' });
      pile(qx, y + font * 1.5, i, 'right');
      if (i + 1 < n) out.push({ id: `pr-${p.id}-${s.id}-to`, type: 'line', x1: left + cardW / 2, y1: y + cardH + 6, x2: left + cardW / 2, y2: cy + slot - cardH / 2 - 6, stroke: 'muted', width: 3, arrow: 'end', ...show });
    }
    const cy = top + slot * (n + 0.5), y = cy - cardH / 2;
    out.push({ id: `pr-${p.id}-done-card`, type: 'rect', x: left, y, w: cardW, h: cardH, r: 14, fill: 'wash', ...show },
      { id: `pr-${p.id}-done-label`, type: 'text', text: p.done, x: left + 24, y: y + cardH * 0.44, size: font, font: 'strong', fill: 'ink', fit: cardW - 48, ...show },
      { id: `pr-${p.id}-done-to`, type: 'line', x1: left + cardW / 2, y1: top + slot * (n - 0.5) + cardH / 2 + 6, x2: left + cardW / 2, y2: y - 6, stroke: 'muted', width: 3, arrow: 'end', ...show });
    stepped(`pr-${p.id}-done-count`, states.map(st => fmt(st.done)), { x: left + 24, y: y + cardH * 0.84, size: font * 1.05, font: 'figures', fit: cardW - 48 }, { fill: 'ink' });
    stepped(`pr-${p.id}-clock`, states.map(st => `${p.period[0].toUpperCase()}${p.period.slice(1)} ${st.period}`), { x: right, y: L.keyY + shift + 70, size: font, anchor: 'end', font: 'figures', fit: 300 }, { fill: 'muted' });
  }
  if (p.token > 1)
    out.push({ id: `pr-${p.id}-token-key`, type: 'text', text: `Each full square is ${p.token} ${p.unit}`, x: L.margin, y: L.keyY + shift + (wide ? 44 : 40), size: Math.max(L.keyType * 0.9, 24), fill: 'muted', font: 'semibold', ...show });
  return { elements: out, states, end: clock };
}

export function expandProcessProps(input, frame) {
  if (input?.process == null) return input;
  const { process, ...rest } = structuredClone(input);
  for (const key of ['plot', 'bars', 'bridge', 'breakdown', 'decision', 'stat', 'distribution', 'multiples', 'kpi', 'teaching', 'chart', 'sketch', 'plates', 'world', 'title', 'diagram'])
    check(rest[key] == null, `cannot combine process with ${key}`);
  const p = processSpec(process);
  check(rest.source == null || rest.source === p.source, 'the process names its source (or says it is an illustrative model) in process.source');
  const when = frame.when ? (r, fallback) => (r.say != null || r.cue != null || r.at != null ? frame.when(r, fallback, 'process run') : fallback) : (r, fallback) => r?.at ?? fallback;
  const { elements, end } = processElements(p, frame, when);
  if (frame.duration != null) check(end <= frame.duration, `the model runs until ${end.toFixed(2)} s, after the beat ends at ${frame.duration.toFixed(2)} s; shorten the runs or lengthen the beat`);
  return { ...rest, source: `${p.source}${p.asOf ? ` · ${p.asOf}` : ''}`, view: rest.view ?? [0, 0, frame.width, frame.height], elements: [...elements, ...(rest.elements ?? [])] };
}
