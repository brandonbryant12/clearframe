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
    if (!['kind', 'values', 'box', 'max', 'prefix', 'suffix', 'decimals', 'id', 'at', 'stagger'].includes(k))
      fail(`chart: unsupported field ${k}`);
  return spec;
}

/** The chart as canvas elements in a `w`×`h` frame. */
export function chartElements(spec, { w, h }) {
  const id = spec.id ?? 'chart',
    at = spec.at ?? 0.2,
    stagger = spec.stagger ?? 0.12;
  const values = spec.values.map(v => ({ ...v, key: `${id}-${slug(v.id ?? v.label)}` }));
  const fill = v => (v.highlight ? 'accent' : 'muted');
  const out = [];
  if (spec.kind === 'bars') {
    const [x, y, bw, bh] = spec.box ?? [w * 0.14, h * 0.15, w * 0.72, h * 0.43];
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
          text: format(v.value, spec),
          x: r(cx + col / 2),
          y: r(base - hv - 18),
          size: Math.round(Math.min(56, Math.max(26, col * 0.3))),
          font: 'figures',
          anchor: 'middle',
          fill: 'ink',
          at: r(t + 0.4),
          enter: 'rise',
          dur: 0.4,
        },
        {
          type: 'text',
          text: v.label,
          x: r(cx + col / 2),
          y: r(base + 44),
          size: 30,
          anchor: 'middle',
          fill: v.highlight ? 'ink' : 'muted',
          at: r(t + 0.2),
          enter: 'fade',
          dur: 0.4,
        },
      );
    });
  } else if (spec.kind === 'stack') {
    const [x, y, bw, bh] = spec.box ?? [w * 0.12, h * 0.44, w * 0.76, h * 0.09];
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
      if (sw > 150)
        out.push(
          {
            type: 'text',
            text: v.label,
            x: r(cx),
            y: r(y - 26),
            size: 30,
            fill: v.highlight ? 'ink' : 'muted',
            at: r(t + 0.3),
            enter: 'fade',
            dur: 0.4,
          },
          {
            type: 'text',
            text: format(v.value, spec),
            x: r(cx),
            y: r(y + bh + 52),
            size: 40,
            font: 'figures',
            fill: 'ink',
            at: r(t + 0.4),
            enter: 'rise',
            dur: 0.4,
          },
        );
      cx += sw;
    });
  } else {
    // number: the figure, large, over its own bar (which can become a bar or a segment next).
    const v = values.find(x => x.highlight) ?? values[0];
    const [x, y, bw, bh] = spec.box ?? [w * 0.2, h * 0.3, w * 0.6, h * 0.4];
    const max = spec.max ?? v.value;
    out.push(
      {
        type: 'text',
        text: format(v.value, spec),
        x: r(x + bw / 2),
        y: r(y + bh * 0.55),
        size: Math.round(Math.min(bh * 0.55, 260)),
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
        y: r(y + bh * 0.55 + 70),
        size: 36,
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
        y: r(y + bh * 0.9),
        w: r((v.value / max) * bw),
        h: 18,
        fill: 'accent',
        enter: 'grow-x',
        origin: [r(x), r(y + bh * 0.9 + 9)],
        at: r(at + 0.5),
        dur: 0.7,
      },
    );
  }
  return out;
}
