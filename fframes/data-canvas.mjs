// Charts drawn as canvas shapes, so a chart can become the next one across a cut. Each value
// is a shape with a stable id (`chart-<key>`): consecutive canvas beats that share ids morph,
// so a number's bar becomes a segment of a stacked bar, and the segments stand up as bars.
// Geometry is computed from the values (heights and widths are proportional); every figure
// shown still needs a visible source, like any chart.

const slug = s =>
  String(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-|-$/g, '') || 'v';
const r = v => Math.round(v * 10) / 10;

function format(v, { prefix = '', suffix = '', decimals }) {
  const d = decimals ?? (Number.isInteger(v) ? 0 : 1);
  return `${prefix}${Number(v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}${suffix}`;
}

/** Validate a `chart` spec; `fail(message)` throws with the caller's context. */
export function chartSpec(spec, fail) {
  if (!spec || typeof spec !== 'object' || Array.isArray(spec)) fail('chart must be {kind, values, …}');
  if (!['bars', 'stack', 'number'].includes(spec.kind)) fail('chart.kind must be bars, stack or number');
  if (!Array.isArray(spec.values) || !spec.values.length || spec.values.length > 12)
    fail('chart.values must be 1–12 {label, value}');
  spec.values.forEach((v, i) => {
    if (!v || !Number.isFinite(v.value) || v.value < 0) fail(`chart.values[${i}].value must be a nonnegative number`);
    if (typeof v.label !== 'string' || !v.label.trim()) fail(`chart.values[${i}] needs a label`);
  });
  if (spec.box != null && !(Array.isArray(spec.box) && spec.box.length === 4 && spec.box.every(Number.isFinite)))
    fail('chart.box must be [x, y, w, h]');
  for (const k of Object.keys(spec))
    if (!['kind', 'values', 'box', 'max', 'prefix', 'suffix', 'decimals', 'id', 'at', 'stagger', 'note'].includes(k))
      fail(`chart: unsupported field ${k}`);
  if (spec.note != null) {
    const n = spec.note;
    if (!n || typeof n !== 'object' || typeof n.text !== 'string' || !n.text.trim())
      fail('chart.note must be {text, to?, say?|at?}: the narration-cued annotation that replaces a heading');
    for (const k of Object.keys(n))
      if (!['text', 'to', 'say', 'at'].includes(k)) fail(`chart.note: unsupported field ${k}`);
    if (n.to != null && !spec.values.some(v => v.label === n.to))
      fail(`chart.note.to must be one of the value labels (${spec.values.map(v => v.label).join(', ')})`);
  }
  return spec;
}

/** The chart as canvas elements in a `w`×`h` frame. */
export function chartElements(spec, { w, h }) {
  const id = spec.id ?? 'chart',
    at = spec.at ?? 0.2,
    stagger = spec.stagger ?? 0.12;
  const values = spec.values.map(v => ({ ...v, key: `${id}-${slug(v.id ?? v.label)}` }));
  const tall = h > w;
  const note = spec.note && {
    ...spec.note,
    target: values.find(v => v.label === spec.note.to) ?? values.find(v => v.highlight) ?? values[0],
  };
  const fill = v => (v.highlight ? 'accent' : 'muted');
  const out = [];
  if (spec.kind === 'bars') {
    // The finding fills the frame: no heading underneath, the narration names it.
    const [x, y, bw, bh] =
      spec.box ?? (tall ? [w * 0.1, h * 0.26, w * 0.8, h * 0.4] : [w * 0.1, h * 0.17, w * 0.8, h * 0.56]);
    const max = spec.max ?? Math.max(...values.map(v => v.value), 1);
    const n = values.length,
      col = bw / (n + (n - 1) * 0.45),
      base = y + bh;
    out.push({
      type: 'line',
      x1: r(x),
      y1: r(base),
      x2: r(x + bw),
      y2: r(base),
      stroke: 'line',
      width: 2,
      at,
      dur: 0.5,
      enter: 'draw',
    });
    values.forEach((v, i) => {
      const cx = x + i * col * 1.45,
        hv = (v.value / max) * bh,
        t = at + i * stagger;
      out.push(
        {
          type: 'rect',
          id: v.key,
          x: r(cx),
          y: r(base - hv),
          w: r(col),
          h: r(Math.max(hv, 1)),
          fill: fill(v),
          opacity: v.highlight ? 1 : 0.75,
          enter: 'grow-y',
          origin: [r(cx + col / 2), r(base)],
          at: r(t),
          dur: 0.7,
        },
        {
          type: 'text',
          of: v.key,
          text: format(v.value, spec),
          x: r(cx + col / 2),
          y: r(base - hv - 22),
          size: Math.round(Math.min(84, Math.max(40, col * 0.34))),
          font: 'figures',
          anchor: 'middle',
          fill: 'ink',
          at: r(t + 0.4),
          enter: 'rise',
          dur: 0.4,
        },
        {
          type: 'text',
          of: v.key,
          text: v.label,
          x: r(cx + col / 2),
          y: r(base + 56),
          size: 36,
          fit: r(col * 1.4),
          anchor: 'middle',
          fill: v.highlight ? 'ink' : 'muted',
          at: r(t + 0.2),
          enter: 'fade',
          dur: 0.4,
        },
      );
      if (note && note.target === v)
        out.push(...noteElements(note, cx + col / 2, base + 130, { left: x, right: x + bw, up: true }));
    });
  } else if (spec.kind === 'stack') {
    const [x, y, bw, bh] =
      spec.box ?? (tall ? [w * 0.08, h * 0.42, w * 0.84, h * 0.1] : [w * 0.06, h * 0.4, w * 0.88, h * 0.15]);
    const total = values.reduce((a, v) => a + v.value, 0) || 1;
    let cx = x;
    values.forEach((v, i) => {
      const sw = (v.value / total) * bw,
        t = at + i * stagger;
      out.push({
        type: 'rect',
        id: v.key,
        x: r(cx),
        y: r(y),
        w: r(Math.max(sw - 4, 1)),
        h: r(bh),
        fill: fill(v),
        opacity: v.highlight ? 1 : 0.75,
        enter: 'grow-x',
        origin: [r(cx), r(y + bh / 2)],
        at: r(t),
        dur: 0.6,
      });
      if (sw > 190)
        out.push(
          {
            type: 'text',
            of: v.key,
            text: v.label,
            x: r(cx),
            y: r(y - 30),
            size: 36,
            fit: r(sw - 16),
            fill: v.highlight ? 'ink' : 'muted',
            at: r(t + 0.3),
            enter: 'fade',
            dur: 0.4,
          },
          {
            type: 'text',
            of: v.key,
            text: format(v.value, spec),
            x: r(cx),
            y: r(y + bh + 78),
            size: 64,
            font: 'figures',
            fill: 'ink',
            at: r(t + 0.4),
            enter: 'rise',
            dur: 0.4,
          },
        );
      else
        // Too narrow for its own label: name it on a second row above, ending at its right
        // edge, with a tick down to the segment, so no segment is left unnamed.
        out.push(
          {
            type: 'line',
            of: v.key,
            x1: r(cx + sw / 2),
            y1: r(y - 62),
            x2: r(cx + sw / 2),
            y2: r(y - 6),
            stroke: 'muted',
            width: 2,
            at: r(t + 0.3),
            enter: 'draw',
            dur: 0.3,
          },
          {
            type: 'text',
            of: v.key,
            text: `${v.label} ${format(v.value, spec)}`,
            x: r(cx + sw / 2 + 10),
            y: r(y - 74),
            size: 32,
            anchor: 'end',
            fill: v.highlight ? 'ink' : 'muted',
            at: r(t + 0.3),
            enter: 'fade',
            dur: 0.4,
          },
        );
      if (note && note.target === v)
        out.push(...noteElements(note, cx + Math.min(sw, 120) / 2, y + bh + 170, { left: x, right: x + bw, up: true }));
      cx += sw;
    });
  } else {
    // number: the figure, large, over its own bar (which can become a bar or a segment next).
    const v = values.find(x => x.highlight) ?? values[0];
    const [x, y, bw, bh] = spec.box ?? [w * 0.15, h * 0.24, w * 0.7, h * 0.48];
    const max = spec.max ?? v.value,
      size = Math.round(Math.min(bh * 0.6, 300));
    out.push(
      {
        type: 'text',
        text: format(v.value, spec),
        x: r(x + bw / 2),
        y: r(y + bh * 0.55),
        size,
        fit: r(bw),
        font: 'figures',
        anchor: 'middle',
        fill: 'ink',
        at,
        enter: 'rise',
        dur: 0.6,
      },
      {
        type: 'text',
        text: v.label,
        x: r(x + bw / 2),
        // Below the figure's descenders.
        y: r(y + bh * 0.55 + size * 0.3 + 54),
        size: 44,
        fit: r(bw),
        anchor: 'middle',
        fill: 'muted',
        at: r(at + 0.3),
        enter: 'fade',
        dur: 0.5,
      },
      {
        type: 'rect',
        id: v.key,
        x: r(x),
        y: r(y + bh * 0.55 + size * 0.3 + 100),
        w: r((v.value / max) * bw),
        h: 18,
        fill: 'accent',
        enter: 'grow-x',
        origin: [r(x), r(y + bh * 0.55 + size * 0.3 + 109)],
        at: r(at + 0.5),
        dur: 0.7,
      },
    );
    if (note) out.push(...noteElements(note, x + bw / 2, y + bh * 0.55 + size * 0.3 + 150, { left: x, right: x + bw }));
  }
  // When the note lands, everything else steps back: the other values dim on the same word.
  if (note) {
    const cue = note.say ? { say: note.say } : { at: note.at ?? 1.2 };
    const target = note.target.key;
    for (const el of out) {
      const mine = el.id === target || el.of === target;
      if (!mine && !el.note && (el.type === 'rect' || el.type === 'text'))
        el.keys = [...(el.keys ?? []), { ...cue, opacity: 0.35, dur: 0.5 }];
    }
  }
  for (const el of out) {
    delete el.of;
    delete el.note;
  }
  return out;
}

/**
 * The annotation that replaces a chart heading: a short accent line under the value it is
 * about, arriving on the word the narration stresses (`say`) with a stroke pointing up at it.
 */
function noteElements(note, cx, y, { left, right, up = false }) {
  const size = 40,
    // Keep the line inside the chart's width: anchored at the near edge when the value sits
    // close to one side.
    est = note.text.length * size * 0.52,
    anchor = cx - est / 2 < left ? 'start' : cx + est / 2 > right ? 'end' : 'middle',
    tx = anchor === 'start' ? Math.max(left, cx - 24) : anchor === 'end' ? Math.min(right, cx + 24) : cx;
  const cue = note.say ? { say: note.say } : { at: note.at ?? 1.2 };
  return [
    ...(up
      ? [
          {
            type: 'line',
            x1: r(cx),
            y1: r(y - 10),
            x2: r(cx),
            y2: r(y - 44),
            stroke: 'accent',
            width: 3,
            arrow: 'end',
            head: 12,
            note: true,
            enter: 'draw',
            dur: 0.35,
            ...cue,
          },
        ]
      : []),
    {
      type: 'text',
      text: note.text,
      x: r(tx),
      y: r(y + size),
      size,
      font: 'bold',
      anchor,
      note: true,
      fill: 'accent',
      enter: 'rise',
      dur: 0.45,
      ...cue,
    },
  ];
}
