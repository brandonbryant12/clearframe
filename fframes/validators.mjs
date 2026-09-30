// Prop validation and normalization for each native block. `normalizeProps` (catalog.mjs)
// runs the checks every block shares, then the block's validator here. A validator may fill
// defaults (decimals, scales, orientation) so the renderer never guesses.
import { ICONS } from './icons.mjs';
import { normalizeElements, roughSpec, applyRough, mosaicSpec, applyMosaic, depthKeys } from './canvas.mjs';

/** Validation helpers bound to one block's props and error prefix. */
export function helpers(p, fail, { findPhrase, precision }) {
  const text = (v, field, max = 160) => {
    if (v != null && (typeof v !== 'string' || v.length > max)) fail(`${field} must be text up to ${max} characters`);
  };
  const num = (n, key) => {
    if (!Number.isFinite(n)) fail(`${key} must be a finite number`);
  };
  const h = {
    fail,
    text,
    num,
    findPhrase,
    precision,
    icon: (value, field) => {
      if (value != null && !ICONS.includes(value)) fail(`${field}: unknown icon ${value}; run clearframe icons`);
    },
    unit: (value, field) => {
      if (!Number.isFinite(value) || value < 0 || value > 1) fail(`${field} must be a number from 0 to 1`);
    },
    keys: (obj, allowed, field) => {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) fail(`${field} must be an object`);
      for (const k of Object.keys(obj)) if (!allowed.includes(k)) fail(`unsupported ${field}.${k}`);
    },
    list: (items, key, min, max) => {
      if (!Array.isArray(items) || items.length < min || items.length > max) fail(`${key} needs ${min}–${max} items`);
    },
    required: (v, key) => {
      if (typeof v !== 'string' || !v.trim()) fail(`${key} is required text`);
    },
    /** A counted figure: finite value (and from), decimals 0–8, short prefix/suffix. */
    numeric: (obj, key) => {
      num(obj.value, `${key}.value`);
      if (obj.from != null) num(obj.from, `${key}.from`);
      obj.decimals ??= precision(obj.value);
      if (!Number.isInteger(obj.decimals) || obj.decimals < 0 || obj.decimals > 8) fail(`${key}.decimals must be 0–8`);
      text(obj.prefix, `${key}.prefix`, 12);
      text(obj.suffix, `${key}.suffix`, 16);
    },
    /** Chart value format: {prefix, suffix, decimals} or a unit string; decimals default to the data's precision. */
    format: values => {
      if (typeof p.format === 'string') p.format = { suffix: p.format };
      p.format ??= {};
      if (!p.format || typeof p.format !== 'object' || Array.isArray(p.format))
        fail('format must be an object or unit string');
      for (const k of Object.keys(p.format))
        if (!['prefix', 'suffix', 'decimals'].includes(k)) fail(`unsupported format.${k}`);
      if (
        p.format.decimals != null &&
        (!Number.isInteger(p.format.decimals) || p.format.decimals < 0 || p.format.decimals > 8)
      )
        fail('format.decimals must be 0–8');
      text(p.format.prefix, 'format.prefix', 12);
      text(p.format.suffix, 'format.suffix', 16);
      if (values) p.format.decimals ??= Math.max(...values.map(v => precision(v)));
    },
  };
  return h;
}

/** steps, timeline, list and funnel: 2–5 ordered items that arrive one by one. */
function sequence(allowed, required) {
  return (p, h) => {
    h.list(p.items, 'items', 2, 5);
    p.items = p.items.map(it => (typeof it === 'string' ? { text: it } : it));
    p.items.forEach(it => {
      h.keys(it, allowed, 'items');
      for (const k of ['text', 'title', 'label', 'detail']) h.text(it[k], k, k === 'detail' ? 85 : 65);
    });
    if (required) p.items.forEach(d => h.required(d[required], `items.${required}`));
  };
}

/** icon-grid, flow and cycle: labelled nodes with licensed icons. */
function nodes(key, min, max, allowed, { iconRequired = false, stagger = true } = {}) {
  return (p, h) => {
    h.list(p[key], key, min, max);
    p[key].forEach((it, i) => {
      h.keys(it, allowed, `${key}[${i}]`);
      h.text(it.label, 'label', 40);
      if (!it.label?.trim()) h.fail('every node needs a label');
      h.text(it.detail, 'detail', 70);
      if ((iconRequired || it.icon != null) && !ICONS.includes(it.icon))
        h.fail(`unknown icon ${it.icon}; run clearframe icons`);
    });
    if (stagger) {
      p.stagger ??= 0.45;
      if (!Number.isFinite(p.stagger) || p.stagger < 0 || p.stagger > 2) h.fail('stagger must be 0–2 seconds');
    }
  };
}

function media(p, h, { plate }) {
  if (!p.asset && !p.file) h.fail('asset or file is required');
  if (p.offset != null && (!Number.isFinite(p.offset) || p.offset < 0)) h.fail('offset must be nonnegative');
  if (plate) {
    if (p.fit != null && !['contain', 'cover'].includes(p.fit)) h.fail('fit must be contain or cover');
    if (p.drift != null && typeof p.drift !== 'boolean') h.fail('drift must be true or false');
  }
}

const headline = (p, h) => h.required(p.text ?? p.title, 'text/title');

export const VALIDATORS = {
  title: headline,
  statement: headline,
  endcard: headline,
  quote: headline,
  callout: (p, h) => {
    h.icon(p.icon, 'icon');
    headline(p, h);
  },
  chapter: (p, h) => h.required(p.title, 'title'),
  highlight: (p, h) => {
    h.list(p.phrases, 'phrases', 1, 4);
    p.phrases = p.phrases.map((ph, i) => {
      const o = typeof ph === 'string' ? { text: ph } : ph;
      h.keys(o, ['text', 'say'], `phrases[${i}]`);
      h.text(o.text, 'phrase', 60);
      if (h.findPhrase(p.text, o.text) < 0) h.fail(`phrase "${o.text}" must be whole words from the text`);
      return o;
    });
    headline(p, h);
  },
  stat: (p, h) => {
    h.numeric(p, 'stat');
    h.required(p.label, 'label');
  },
  kpis: (p, h) => {
    h.list(p.items, 'items', 2, 4);
    p.items.forEach((it, i) => {
      h.keys(it, ['value', 'label', 'prefix', 'suffix', 'decimals', 'from', 'say'], `items[${i}]`);
      h.numeric(it, `items[${i}]`);
      h.text(it.label, 'label', 40);
      h.required(it.label, 'items.label');
    });
  },
  bars: (p, h, { vertical }) => {
    h.list(p.data, 'data', 2, 8);
    p.data.forEach(d => {
      h.keys(d, ['label', 'value'], 'data');
      h.text(d.label, 'label', 65);
      h.num(d.value, 'value');
      if (d.value < 0) h.fail('bars require a zero-based nonnegative scale');
      h.required(d.label, 'data.label');
    });
    if (!['none', 'desc', undefined].includes(p.sort)) h.fail('sort must be none or desc');
    if (p.sort === 'desc') p.data.sort((a, b) => b.value - a.value);
    const largest = Math.max(...p.data.map(d => d.value));
    p.max ??= largest * 1.08 || 1;
    if (!Number.isFinite(p.max) || p.max <= 0 || p.max < largest) h.fail('max must be positive and cover every value');
    p.orientation ??= 'auto';
    if (p.orientation === 'auto')
      p.orientation =
        vertical || p.data.some(d => d.label.length > 12) || p.data.length > 5 ? 'horizontal' : 'vertical';
    if (!['horizontal', 'vertical'].includes(p.orientation)) h.fail('unknown orientation');
    h.format(p.data.map(d => d.value));
    if (p.focus) {
      const f = p.focus;
      h.keys(f, ['label', 'index', 'say', 'dim', 'dur', 'note'], 'focus');
      h.text(f.note, 'focus.note', 100);
      f.index ??= p.data.findIndex(d => d.label === f.label);
      if (!Number.isInteger(f.index) || !p.data[f.index]) h.fail('focus must select an existing label/index');
      f.dim ??= 0.28;
      f.dur ??= 0.5;
      if (!Number.isFinite(f.dim) || f.dim < 0 || f.dim > 1 || !Number.isFinite(f.dur) || f.dur < 0)
        h.fail('focus dim must be 0–1 and dur nonnegative');
    }
  },
  line: (p, h) => {
    h.list(p.series, 'series', 2, 40);
    p.series = p.series.map((d, i) => (typeof d === 'number' ? { x: i, y: d } : d));
    p.series.forEach((d, i) => {
      h.keys(d, ['x', 'y'], 'series');
      h.num(d.x, 'series.x');
      h.num(d.y, 'series.y');
      if (i && d.x <= p.series[i - 1].x) h.fail('x coordinates must increase');
    });
    p.min ??= Math.min(0, ...p.series.map(d => d.y));
    p.max ??= Math.max(0, ...p.series.map(d => d.y)) * 1.1 || 1;
    if (
      !Number.isFinite(p.min) ||
      !Number.isFinite(p.max) ||
      p.max <= p.min ||
      p.series.some(d => d.y < p.min || d.y > p.max)
    )
      h.fail('line scale must cover the data');
    if (p.labels) {
      h.list(p.labels, 'labels', 2, 40);
      if (p.labels.length !== p.series.length) h.fail('provide one label per point');
      p.labels.forEach(x => h.text(x, 'label', 24));
    }
    h.format(p.series.map(d => d.y));
  },
  waffle: (p, h) => {
    p.total ??= 100;
    h.num(p.value, 'value');
    if (!Number.isFinite(p.total) || p.total <= 0 || p.value < 0 || p.value > p.total)
      h.fail('value must lie between zero and total/max');
    if (!Number.isInteger(p.total) || p.total > 100 || !Number.isInteger(p.value))
      h.fail('waffle counts must be integers up to 100');
    p.cols ??= 10;
    if (!Number.isInteger(p.cols) || p.cols < 1 || p.cols > 10) h.fail('cols must be 1–10');
    p.decimals ??= 0;
    h.icon(p.icon, 'icon');
  },
  ring: (p, h) => {
    p.max ??= 100;
    h.num(p.value, 'value');
    if (!Number.isFinite(p.max) || p.max <= 0 || p.value < 0 || p.value > p.max)
      h.fail('value must lie between zero and total/max');
    p.decimals ??= 0;
  },
  delta: (p, h) => {
    if (!p.from || !p.to) h.fail('from and to are required');
    h.keys(p.from, ['value', 'label'], 'from');
    h.keys(p.to, ['value', 'label'], 'to');
    h.text(p.from.label, 'from.label', 40);
    h.text(p.to.label, 'to.label', 40);
    h.text(p.prefix, 'prefix', 12);
    h.text(p.suffix, 'suffix', 16);
    h.text(p.change, 'change', 100);
    h.num(p.from.value, 'from.value');
    h.num(p.to.value, 'to.value');
    p.decimals ??= Math.max(h.precision(p.from.value), h.precision(p.to.value));
    const d = p.to.value - p.from.value;
    p.change ??=
      d === 0
        ? 'No change'
        : p.from.value === 0
          ? 'From zero'
          : `${d > 0 ? '+' : '−'}${Math.abs((100 * d) / Math.abs(p.from.value)).toFixed(1)}%`;
    if (p.better != null && !['up', 'down'].includes(p.better)) h.fail('better must be up or down');
  },
  compare: (p, h) => {
    for (const key of ['left', 'right']) {
      if (!p[key]) h.fail(`${key} is required`);
      h.keys(p[key], ['title', 'items'], key);
      h.text(p[key].title, key, 48);
      h.list(p[key].items, `${key}.items`, 1, 4);
      p[key].items.forEach(x => h.text(x, 'item', 75));
    }
  },
  steps: sequence(['title', 'detail', 'label', 'say'], 'title'),
  timeline: sequence(['title', 'detail', 'label', 'say'], 'title'),
  list: sequence(['text', 'say'], 'text'),
  funnel: (p, h) => {
    sequence(['label', 'value', 'say'], 'label')(p, h);
    p.items.forEach((it, i) => {
      h.num(it.value, 'value');
      if (it.value < 0 || (i && it.value > p.items[i - 1].value))
        h.fail('funnel values must be nonnegative and decrease');
    });
    if (!p.items[0].value) h.fail('first funnel value must be positive');
    h.format(p.items.map(it => it.value));
    p.rates ??= true;
    if (typeof p.rates !== 'boolean') h.fail('rates must be true or false');
  },
  matrix: (p, h) => {
    h.list(p.columns, 'columns', 2, 3);
    h.list(p.rows, 'rows', 2, 4);
    p.columns.forEach(x => h.text(x, 'column', 24));
    p.rows.forEach(r => {
      h.keys(r, ['label', 'values'], 'rows');
      h.text(r.label, 'row label', 32);
      h.list(r.values, 'row values', p.columns.length, p.columns.length);
      r.values.forEach(x => h.text(x, 'cell', 30));
    });
    if (p.highlight != null && (!Number.isInteger(p.highlight) || p.highlight < 0 || p.highlight >= p.columns.length))
      h.fail('highlight must be a column index');
  },
  equation: (p, h) => h.required(p.expression, 'expression'),
  kinetic: (p, h) => {
    p.mode ??= 'highlight';
    p.align ??= p.mode === 'stack' ? 'center' : 'left';
    p.maxWords ??= 6;
    p.maxGap ??= 0.6;
    p.maxDuration ??= 4;
    if (
      !['highlight', 'reveal', 'word', 'stack'].includes(p.mode) ||
      !['left', 'center'].includes(p.align) ||
      !Number.isInteger(p.maxWords) ||
      p.maxWords < 1 ||
      p.maxWords > 10
    )
      h.fail('invalid kinetic mode, align or maxWords');
    if (p.emphasis != null) {
      if (p.mode !== 'stack') h.fail('kinetic emphasis applies to stack mode');
      if (!Array.isArray(p.emphasis) || p.emphasis.length < 1 || p.emphasis.length > 8)
        h.fail('emphasis needs 1–8 words or phrases');
      p.emphasis.forEach(e => h.text(e, 'emphasis', 60));
    }
    if (p.emphasisStyle != null && !['bold', 'serif'].includes(p.emphasisStyle))
      h.fail('kinetic emphasisStyle must be bold or serif');
    if (p.upper != null && typeof p.upper !== 'boolean') h.fail('upper must be true or false');
    if (
      !Number.isFinite(p.maxGap) ||
      p.maxGap < 0 ||
      p.maxGap > 5 ||
      !Number.isFinite(p.maxDuration) ||
      p.maxDuration < 0.5 ||
      p.maxDuration > 15
    )
      h.fail('kinetic maxGap must be 0–5 and maxDuration 0.5–15 seconds');
  },
  'icon-grid': (p, h) => {
    nodes('items', 1, 8, ['icon', 'label', 'detail', 'say'], { iconRequired: true })(p, h);
    if (p.columns != null && (!Number.isInteger(p.columns) || p.columns < 1 || p.columns > 4))
      h.fail('columns must be 1–4');
  },
  flow: (p, h, { vertical }) => {
    nodes('nodes', 2, 6, ['icon', 'label', 'detail', 'say'])(p, h);
    p.orientation ??= 'auto';
    if (!['auto', 'horizontal', 'vertical'].includes(p.orientation)) h.fail('invalid orientation');
    if (vertical) p.orientation = 'vertical';
  },
  cycle: (p, h) => {
    nodes('nodes', 3, 6, ['icon', 'label'], { stagger: false })(p, h);
    p.period ??= 8;
    p.clockwise ??= true;
    if (!Number.isFinite(p.period) || p.period < 2 || p.period > 60) h.fail('period must be 2–60 seconds');
    if (typeof p.clockwise !== 'boolean') h.fail('clockwise must be boolean');
  },
  breathing: (p, h) => {
    h.list(p.phases, 'phases', 2, 6);
    p.phases.forEach((phase, i) => {
      h.keys(phase, ['label', 'seconds', 'scale'], `phases[${i}]`);
      h.text(phase.label, 'phase label', 40);
      if (!phase.label?.trim()) h.fail('every phase needs a label');
      if (!Number.isFinite(phase.seconds) || phase.seconds < 0.25 || phase.seconds > 30)
        h.fail('phase seconds must be 0.25–30');
      if (phase.scale == null && p.phases.length === 2) phase.scale = i ? 'contract' : 'expand';
      if (!['expand', 'hold', 'contract'].includes(phase.scale))
        h.fail('each phase needs scale expand, hold or contract');
    });
    p.minScale ??= 0.55;
    p.maxScale ??= 1;
    p.ring ??= true;
    if (
      !Number.isFinite(p.minScale) ||
      !Number.isFinite(p.maxScale) ||
      p.minScale < 0.2 ||
      p.maxScale > 1 ||
      p.minScale >= p.maxScale
    )
      h.fail('scales require 0.2 ≤ minScale < maxScale ≤ 1');
    if (typeof p.ring !== 'boolean') h.fail('ring must be boolean');
  },
  image: (p, h) => media(p, h, { plate: true }),
  video: (p, h) => media(p, h, { plate: true }),
  annotate: (p, h) => {
    media(p, h, { plate: false });
    h.list(p.pins, 'pins', 1, 6);
    p.pins.forEach((pin, i) => {
      h.keys(pin, ['x', 'y', 'label', 'detail', 'say'], `pins[${i}]`);
      h.unit(pin.x, `pins[${i}].x`);
      h.unit(pin.y, `pins[${i}].y`);
      h.text(pin.label, 'label', 40);
      h.text(pin.detail, 'detail', 80);
      h.required(pin.label, 'pins.label');
    });
    if (p.focus != null) {
      const f = p.focus;
      h.keys(f, ['x', 'y', 'w', 'h', 'say'], 'focus');
      for (const k of ['x', 'y', 'w', 'h']) h.unit(f[k], `focus.${k}`);
      if (!(f.w > 0 && f.h > 0) || f.x + f.w > 1 + 1e-9 || f.y + f.h > 1 + 1e-9)
        h.fail('focus must be a nonempty region inside the image');
    }
  },
  donut: (p, h) => {
    h.list(p.segments, 'segments', 2, 6);
    p.segments.forEach((seg, i) => {
      h.keys(seg, ['label', 'value'], `segments[${i}]`);
      h.text(seg.label, 'label', 40);
      h.num(seg.value, 'value');
      if (seg.value < 0) h.fail('segment values must be nonnegative');
      h.required(seg.label, 'segments.label');
    });
    if (!(p.segments.reduce((a, seg) => a + seg.value, 0) > 0)) h.fail('segments need a positive total');
    h.format(p.segments.map(seg => seg.value));
  },
  magnitude: (p, h) => {
    h.list(p.items, 'items', 2, 4);
    p.items.forEach((it, i) => {
      h.keys(it, ['label', 'value', 'say'], `items[${i}]`);
      h.text(it.label, 'label', 40);
      h.num(it.value, 'value');
      if (!(it.value > 0)) h.fail('magnitude values must be positive; area cannot show zero or negative amounts');
      h.required(it.label, 'items.label');
    });
    h.format(p.items.map(it => it.value));
  },
  checklist: (p, h) => {
    h.list(p.items, 'items', 2, 6);
    p.items = p.items.map(it => (typeof it === 'string' ? { text: it } : it));
    p.items.forEach((it, i) => {
      h.keys(it, ['text', 'detail', 'say'], `items[${i}]`);
      h.text(it.text, 'text', 65);
      h.text(it.detail, 'detail', 85);
      h.required(it.text, 'items.text');
    });
  },
  canvas: (p, h) => {
    if (p.support != null) h.fail('canvas draws only its elements; add a text element instead of support');
    const camera = v => Array.isArray(v) && v.length === 4 && v.every(Number.isFinite) && v[2] >= 16 && v[3] >= 16;
    if (
      p.view != null &&
      p.view !== 'auto' &&
      !camera(p.view) &&
      (!Array.isArray(p.view) || p.view.length !== 2 || p.view.some(v => !Number.isFinite(v) || v < 16))
    )
      h.fail('view must be "auto", [width, height] or a camera rect [x, y, width, height]');
    if (p.viewFrom != null && !camera(p.viewFrom)) h.fail('viewFrom must be a camera rect [x, y, width, height]');
    if (p.viewTall != null && !camera(p.viewTall))
      h.fail('viewTall must be a camera rect [x, y, width, height] (used in tall frames)');
    if (p.viewDrift != null && !(Number.isFinite(p.viewDrift) && p.viewDrift >= 0 && p.viewDrift <= 0.2))
      h.fail('viewDrift must be 0–0.2 (the fraction the camera eases in during a hold)');
    if (p.viewDur != null && !(Number.isFinite(p.viewDur) && p.viewDur > 0 && p.viewDur <= 10))
      h.fail('viewDur must be 0–10 seconds');
    if (p.world != null && (typeof p.world !== 'string' || !camera(p.view)))
      h.fail('world must be a name, with view set to a camera rect [x, y, width, height]');
    if (p.stagger != null && (!Number.isFinite(p.stagger) || p.stagger < 0 || p.stagger > 3))
      h.fail('stagger must be 0–3 seconds');
    // A world beat may only move the camera: it inherits everything drawn before it.
    if (!Array.isArray(p.elements) || (!p.elements.length && !p.world)) h.fail('elements needs at least one element');
    p.elements = normalizeElements(p.elements, 'elements', h.fail);
    // Depth: the camera flies through z (dolly) and a focus plane sets the depth of field.
    if (p.dolly != null) p.dolly = depthKeys(p.dolly, 'dolly', h.fail);
    if (p.focus != null) {
      const f = p.focus;
      if (!f || typeof f !== 'object' || Array.isArray(f)) h.fail('focus must be {z, aperture, keys}');
      for (const k of Object.keys(f))
        if (!['z', 'aperture', 'keys'].includes(k)) h.fail(`focus: unsupported field ${k}`);
      if (f.z != null && (!Number.isFinite(f.z) || f.z <= -0.9 || f.z > 50))
        h.fail('focus.z must be above -0.9 and at most 50');
      if (f.aperture != null && !(Number.isFinite(f.aperture) && f.aperture >= 0 && f.aperture <= 3))
        h.fail('focus.aperture must be 0–3 (1 is a natural depth of field)');
      if (f.keys != null) f.keys = depthKeys(f.keys, 'focus.keys', h.fail);
    }
    if (p.rough != null && p.rough !== false) applyRough(p.elements, roughSpec(p.rough, 'rough', h.fail));
    delete p.rough;
    if (p.mosaic != null && p.mosaic !== false) applyMosaic(p.elements, mosaicSpec(p.mosaic, 'mosaic', h.fail));
    delete p.mosaic;
  },
};
