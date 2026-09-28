/*! ClearFrame kit — a small, opinionated motion vocabulary for calm, precise explainers.
 * Every helper adds tweens to the master timeline (CF.tl) or registers a CF.onFrame
 * function, so everything is seekable and deterministic.
 *
 * Time arguments (`at`) accept seconds or CF.time specs: "beatId", "beatId+0.4", "beatId@0.5", "beatId:end".
 * Tip: land emphasis on the spoken word with b.say('seventy').
 */
(() => {
  'use strict';
  const K = {};
  const tl = () => CF.tl;
  const T = (at) => (typeof at === 'number' ? at : CF.time(at));
  const one = (x, root = document) => (typeof x === 'string' ? root.querySelector(x) : x);
  const many = (x, root = document) => (typeof x === 'string' ? [...root.querySelectorAll(x)] : x instanceof Element ? [x] : [...x]);
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(svgNS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };
  let uid = 0;
  const id = (p) => `cf-${p}-${++uid}`;
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const u = () => parseFloat(cssVar('--u')) || 1;
  /** GSAP can't interpolate var(--x); resolve theme tokens to concrete colors before tweening. */
  const col = (c) => { const m = /^var\((--[\w-]+)\)$/.exec(String(c).trim()); return m ? cssVar(m[1]) || c : c; };
  const fmtNum = (v, { decimals = 0, prefix = '', suffix = '', grouping = true, locale = 'en-US' } = {}) =>
    prefix + new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: grouping }).format(v) + suffix;

  /**
   * Motion tokens — one easing family for the whole film.
   * Entrances settle (power3.out, ~0.5s, 16–24px rise). Exits are quicker and quieter (power2.in, ~0.3s).
   * `snap` (expo.out) is for the one or two moments that deserve punch — a key number landing.
   */
  K.tokens = {
    fast: 0.3, base: 0.5, slow: 1.0,
    stagger: { chars: 0.02, words: 0.05, lines: 0.1, items: 0.1 },
    ease: { in: 'power3.out', out: 'power2.in', move: 'power3.inOut', snap: 'expo.out', settle: 'back.out(1.2)', linear: 'none' },
  };
  K.fmt = fmtNum;
  /** Resolve a theme token ('--accent' or 'var(--accent)') to a concrete color for tweening. */
  K.color = (c) => col(String(c).startsWith('--') ? `var(${c})` : c);

  // ------------------------------------------------------------------ text
  /** Split text into words / chars / lines (GSAP SplitText; fonts are loaded before build). */
  K.split = (target, by = 'words', { mask = false } = {}) => {
    const node = one(target);
    const type = by === 'lines' ? 'lines' : by === 'chars' ? 'words,chars' : 'words';
    if (window.SplitText) {
      const s = SplitText.create(node, { type, wordsClass: 'cf-word', charsClass: 'cf-char', linesClass: 'cf-line', mask: mask ? (by === 'chars' ? 'words' : by) : undefined, aria: 'auto' });
      return by === 'lines' ? s.lines : by === 'chars' ? s.chars : s.words;
    }
    const words = node.textContent.trim().split(/\s+/);
    node.innerHTML = words.map((w) => `<span class="cf-word">${w}</span>`).join(' ');
    return [...node.querySelectorAll('.cf-word')];
  };

  /**
   * Reveal text. by: 'words' (default) | 'chars' | 'lines' | 'block'.
   * mask: slide up from behind a clean edge (editorial). blur: px of focus-pull.
   */
  K.reveal = (target, at, { by = 'words', mask = false, dur, stagger, y = '0.35em', blur = 0, ease = K.tokens.ease.in, scale = 1 } = {}) => {
    const t = T(at);
    const parts = by === 'block' ? many(target) : K.split(target, by, { mask });
    stagger ??= K.tokens.stagger[by] ?? 0;
    dur ??= by === 'chars' ? 0.55 : by === 'lines' ? 0.8 : 0.6;
    const from = mask ? { yPercent: 110 } : { y, opacity: 0 };
    if (blur) from.filter = `blur(${blur}px)`;
    if (scale !== 1) from.scale = scale;
    tl().from(parts, { ...from, duration: dur, ease, stagger }, t);
    return { parts, end: t + dur + stagger * (parts.length - 1) };
  };

  /** Quiet exit. Keep exits shorter than entrances. */
  K.exit = (target, at, { dur = K.tokens.fast, y = '-0.25em', blur = 0, stagger = 0 } = {}) => {
    const to = { opacity: 0, y, duration: dur, ease: K.tokens.ease.out, stagger };
    if (blur) to.filter = `blur(${blur}px)`;
    tl().to(many(target), to, T(at));
  };

  /** Fade/slide a block in. */
  K.enter = (target, at, { dur = K.tokens.base, y = 20, x = 0, scale = 1, blur = 0, stagger = 0, ease = K.tokens.ease.in } = {}) => {
    const from = { opacity: 0, y: y * u(), x: x * u() };
    if (scale !== 1) from.scale = scale;
    if (blur) from.filter = `blur(${blur}px)`;
    tl().from(many(target), { ...from, duration: dur, ease, stagger }, T(at));
  };

  /** A small emphasis hit on a spoken word: scale up a touch, settle back. */
  K.hit = (target, at, { scale = 1.035, dur = 0.5, color } = {}) => {
    const t = T(at);
    tl().to(many(target), { scale, duration: dur * 0.35, ease: 'power2.out', ...(color ? { color: col(color) } : {}) }, t)
      .to(many(target), { scale: 1, duration: dur * 0.65, ease: 'power3.out' }, t + dur * 0.35);
  };

  /** Highlighter / underline / strike through an inline element. kind: 'highlight' | 'underline' | 'strike'. */
  K.mark = (target, at, { kind = 'highlight', color, dur = 0.55, ease = 'power3.inOut' } = {}) => {
    const node = one(target);
    node.classList.add('cf-mark');
    const bar = document.createElement('span');
    bar.className = kind === 'highlight' ? 'cf-mark-bg' : 'cf-mark-line';
    if (kind === 'underline') Object.assign(bar.style, { bottom: '-0.04em' });
    if (kind === 'strike') Object.assign(bar.style, { top: '52%' });
    if (color) bar.style.background = color;
    node.appendChild(bar);
    tl().to(bar, { scaleX: 1, duration: dur, ease }, T(at));
    return bar;
  };

  /** Animate a number. Returns a handle; chain .to(value, at, dur) for escalating numbers. */
  K.counter = (target, at, { from = 0, to, dur = 1.2, ease = 'power3.out', decimals = 0, prefix = '', suffix = '', format, grouping = true } = {}) => {
    const node = one(target);
    node.classList.add('cf-num');
    const fmt = format ?? ((v) => fmtNum(v, { decimals, prefix, suffix, grouping }));
    const proxy = { v: from };
    let last = null;
    const paint = () => { const s = fmt(proxy.v); if (s !== last) { node.textContent = s; last = s; } };
    CF.onFrame(paint);
    paint();
    const handle = {
      to(value, when, d = dur, e = ease) { tl().to(proxy, { v: value, duration: d, ease: e }, T(when)); return handle; },
      proxy,
    };
    if (to != null) tl().fromTo(proxy, { v: from }, { v: to, duration: dur, ease, immediateRender: false }, T(at));
    return handle;
  };

  /** Deterministic scramble-to-text (seeded). */
  K.scramble = (target, at, { dur = 0.9, chars = '0123456789ABCDEF%$#', seed = 7 } = {}) => {
    const node = one(target);
    const final = node.textContent;
    const proxy = { p: 0 };
    tl().fromTo(proxy, { p: 0 }, { p: 1, duration: dur, ease: 'none', immediateRender: false }, T(at));
    CF.onFrame((t, frame) => {
      if (proxy.p >= 1) { if (node.textContent !== final) node.textContent = final; return; }
      if (proxy.p <= 0) { node.textContent = final.replace(/\S/g, ' '); return; }
      const r = CF.rand(`${seed}:${frame}`);
      const n = Math.floor(proxy.p * final.length);
      node.textContent = final.slice(0, n) + [...final.slice(n)].map((c) => (c === ' ' ? ' ' : r.pick(chars))).join('');
    });
  };

  /** Typewriter at `cps` characters/second, with optional caret. */
  K.type = (target, at, { cps = 30, caret = true } = {}) => {
    const node = one(target);
    const text = node.textContent;
    const dur = text.length / cps;
    const proxy = { n: 0 };
    tl().fromTo(proxy, { n: 0 }, { n: text.length, duration: dur, ease: 'none', immediateRender: false }, T(at));
    CF.onFrame((t) => {
      const n = Math.round(proxy.n);
      const blink = caret && (n < text.length || Math.floor(t * 2) % 2 === 0) ? '▍' : '';
      node.textContent = text.slice(0, n) + (caret ? blink : '');
    });
    return { end: T(at) + dur };
  };

  /** Shrink a text element's font-size until it fits its box (prevents overflow). */
  K.fit = (target, { min = 12 } = {}) => {
    for (const node of many(target)) {
      let size = parseFloat(getComputedStyle(node).fontSize);
      let guard = 60;
      while (guard-- > 0 && size > min && (node.scrollWidth > node.clientWidth + 1 || node.scrollHeight > node.clientHeight + 1)) {
        size *= 0.95;
        node.style.fontSize = `${size}px`;
      }
    }
  };

  // ------------------------------------------------------------------ camera & scene
  /** Slow push / drift across an interval — no frame should be perfectly still for long. */
  K.drift = (target, from, to, { scale = 1.03, x = 0, y = 0, rotate = 0 } = {}) => {
    const a = T(from), b = T(to);
    tl().fromTo(many(target), { scale: 1, x: 0, y: 0, rotate: 0 }, { scale, x: x * u(), y: y * u(), rotate, duration: Math.max(0.01, b - a), ease: 'none', immediateRender: false }, a);
  };

  /**
   * Transition between two scene elements at `at` (usually the boundary: "nextBeat").
   * kind: 'fade' | 'push' | 'rise' | 'wipe' | 'blur' | 'zoom' | 'dip'.
   * Keeps the outgoing scene visible for `dur` so the two can overlap.
   */
  K.transition = (kind, from, to, at, { dur = 0.5, ease = K.tokens.ease.move } = {}) => {
    const A = one(from), B = one(to), t = T(at);
    const W = parseFloat(cssVar('--w')) || 1920;
    if (A) A.dataset.out = String(Math.max(parseFloat(A.dataset.out ?? 0), dur));
    const o = { duration: dur, ease, immediateRender: false };
    switch (kind) {
      case 'fade':
        A && tl().fromTo(A, { opacity: 1 }, { opacity: 0, ...o }, t);
        B && tl().fromTo(B, { opacity: 0 }, { opacity: 1, ...o }, t);
        break;
      case 'dip':
        A && tl().fromTo(A, { opacity: 1 }, { opacity: 0, ...o, duration: dur / 2, ease: 'power2.in' }, t);
        B && tl().fromTo(B, { opacity: 0 }, { opacity: 1, ...o, duration: dur / 2, ease: 'power2.out' }, t + dur / 2);
        break;
      case 'push':
        A && tl().fromTo(A, { x: 0 }, { x: -W, ...o }, t);
        B && tl().fromTo(B, { x: W }, { x: 0, ...o }, t);
        break;
      case 'rise':
        A && tl().fromTo(A, { yPercent: 0, opacity: 1 }, { yPercent: -18, opacity: 0, ...o }, t);
        B && tl().fromTo(B, { yPercent: 18, opacity: 0 }, { yPercent: 0, opacity: 1, ...o }, t);
        break;
      case 'wipe':
        B && tl().fromTo(B, { clipPath: 'inset(0% 100% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', ...o }, t);
        break;
      case 'blur':
        A && tl().fromTo(A, { filter: 'blur(0px)', opacity: 1 }, { filter: 'blur(24px)', opacity: 0, ...o }, t);
        B && tl().fromTo(B, { filter: 'blur(24px)', opacity: 0, scale: 1.03 }, { filter: 'blur(0px)', opacity: 1, scale: 1, ...o }, t);
        break;
      case 'zoom':
        A && tl().fromTo(A, { scale: 1, opacity: 1 }, { scale: 1.18, opacity: 0, ...o }, t);
        B && tl().fromTo(B, { scale: 0.92, opacity: 0 }, { scale: 1, opacity: 1, ...o }, t);
        break;
      default:
        throw new Error(`Unknown transition "${kind}"`);
    }
  };

  // ------------------------------------------------------------------ texture layers
  /** Film grain: seeded noise tiles swapped at `fps` (default 12) — organic, deterministic. */
  K.grain = (parent = '#stage', { opacity, fps = 12, tile = 256, seed = 3 } = {}) => {
    const host = one(parent);
    const canvas = document.createElement('canvas');
    canvas.className = 'cf-grain';
    if (opacity != null) canvas.style.opacity = opacity;
    const W = host.offsetWidth, H = host.offsetHeight;
    canvas.width = Math.ceil(W / 2); canvas.height = Math.ceil(H / 2);
    Object.assign(canvas.style, { width: `${W}px`, height: `${H}px` });
    host.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const tiles = Array.from({ length: 6 }, (_, i) => {
      const c = document.createElement('canvas'); c.width = c.height = tile;
      const g = c.getContext('2d'); const img = g.createImageData(tile, tile); const r = CF.rand(`${seed}:grain:${i}`);
      for (let p = 0; p < img.data.length; p += 4) { const v = 128 + (r() - 0.5) * 255; img.data[p] = img.data[p + 1] = img.data[p + 2] = v; img.data[p + 3] = 255; }
      g.putImageData(img, 0, 0);
      return ctx.createPattern(c, 'repeat');
    });
    let lastIdx = -1;
    CF.onFrame((t) => {
      const idx = Math.floor(t * fps);
      if (idx === lastIdx) return;
      lastIdx = idx;
      const r = CF.rand(`${seed}:${idx}`);
      ctx.save();
      ctx.translate(-r() * tile, -r() * tile);
      ctx.fillStyle = tiles[idx % tiles.length];
      ctx.fillRect(0, 0, canvas.width + tile, canvas.height + tile);
      ctx.restore();
    });
    return canvas;
  };

  K.vignette = (parent = '#stage') => {
    const v = document.createElement('div'); v.className = 'cf-vignette'; one(parent).appendChild(v); return v;
  };

  /** Faint engineering grid that drifts slowly. dots: true for a dot grid. */
  K.gridlines = (parent = '#stage', { size = 96, drift = [6, 3], opacity = 0.5, dots = false, fade = true } = {}) => {
    const g = document.createElement('div');
    g.className = 'cf-gridlines';
    const s = size * u();
    g.style.backgroundImage = dots
      ? `radial-gradient(circle, var(--line) ${1.6 * u()}px, transparent ${1.8 * u()}px)`
      : `linear-gradient(var(--line) 1px, transparent 1px), linear-gradient(90deg, var(--line) 1px, transparent 1px)`;
    g.style.backgroundSize = `${s}px ${s}px`;
    g.style.opacity = opacity;
    if (fade) g.style.maskImage = g.style.webkitMaskImage = 'radial-gradient(ellipse 75% 70% at 50% 50%, #000 30%, transparent 100%)';
    const host = one(parent);
    host.insertBefore(g, host.firstChild);
    CF.onFrame((t) => { g.style.backgroundPosition = `${(t * drift[0] * u()).toFixed(2)}px ${(t * drift[1] * u()).toFixed(2)}px`; });
    return g;
  };

  /** Horizontal marquee (ticker) moving at `speed` px/s, seamless. */
  K.marquee = (target, items, { speed = 70, gap = 64, separator = '·' } = {}) => {
    const host = one(target);
    host.style.overflow = 'hidden'; host.style.whiteSpace = 'nowrap';
    const track = document.createElement('div');
    track.style.display = 'inline-flex'; track.style.gap = `${gap * u()}px`;
    const unit = items.map((it) => `<span>${it}</span><span class="cf-dim">${separator}</span>`).join('');
    track.innerHTML = unit + unit + unit;
    host.appendChild(track);
    const width = () => track.scrollWidth / 3;
    let w = 0;
    CF.onFrame((t) => { w ||= width(); track.style.transform = `translateX(${-((t * speed * u()) % w)}px)`; });
    return track;
  };

  // ------------------------------------------------------------------ captions
  /**
   * Word-synced captions built from the narration timing. mode: 'karaoke' (active word lights up) | 'phrase'.
   * Timing is phrase-aligned to the real audio (or estimated until voice exists).
   */
  K.captions = (parent = '#stage', { maxWords = 6, maxChars = 34, mode = 'karaoke', hold = 0.15, beats } = {}) => {
    const layer = document.createElement('div');
    layer.className = 'cf-captions';
    one(parent).appendChild(layer);
    const list = (beats ?? CF.timing.beats).filter((b) => b.vo?.words?.length);
    for (const b of list) {
      const chunks = [];
      let cur = [];
      for (const w of b.vo.words) {
        cur.push(w);
        const chars = cur.map((x) => x.w).join(' ').length;
        if (cur.length >= maxWords || chars >= maxChars || /[.!?;:,—]$/.test(w.w)) { chunks.push(cur); cur = []; }
      }
      if (cur.length) chunks.push(cur);
      chunks.forEach((c, i) => {
        const cap = document.createElement('div');
        cap.className = 'cf-cap';
        cap.innerHTML = c.map((w) => `<span class="cf-cw">${w.w.replace(/</g, '&lt;')}</span>`).join(' ');
        layer.appendChild(cap);
        const next = chunks[i + 1]?.[0]?.t0 ?? c.at(-1).t1 + hold;
        tl().set(cap, { opacity: 1 }, c[0].t0).set(cap, { opacity: 0 }, Math.min(next, c.at(-1).t1 + 0.6));
        if (mode === 'karaoke') [...cap.children].forEach((span, j) => tl().set(span, { opacity: 1 }, c[j].t0));
        else [...cap.children].forEach((span) => (span.style.opacity = 1));
      });
    }
    return layer;
  };

  // ------------------------------------------------------------------ data viz helpers
  function niceTicks(min, max, count = 4) {
    const span = max - min || 1;
    const raw = span / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= count) ?? 10 * mag;
    const ticks = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) ticks.push(+v.toFixed(10));
    return ticks;
  }
  K.niceTicks = niceTicks;

  function monotonePath(p) {
    const n = p.length;
    if (n < 2) return n ? `M${p[0].x},${p[0].y}` : '';
    const dx = [], m = [], t = [];
    for (let i = 0; i < n - 1; i++) { dx[i] = p[i + 1].x - p[i].x; m[i] = (p[i + 1].y - p[i].y) / (dx[i] || 1e-9); }
    t[0] = m[0]; t[n - 1] = m[n - 2];
    for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (m[i] === 0) { t[i] = t[i + 1] = 0; continue; }
      const a = t[i] / m[i], b = t[i + 1] / m[i], s = a * a + b * b;
      if (s > 9) { const k = 3 / Math.sqrt(s); t[i] = k * a * m[i]; t[i + 1] = k * b * m[i]; }
    }
    let d = `M${p[0].x.toFixed(2)},${p[0].y.toFixed(2)}`;
    for (let i = 0; i < n - 1; i++) {
      const h = dx[i] / 3;
      d += ` C${(p[i].x + h).toFixed(2)},${(p[i].y + t[i] * h).toFixed(2)} ${(p[i + 1].x - h).toFixed(2)},${(p[i + 1].y - t[i + 1] * h).toFixed(2)} ${p[i + 1].x.toFixed(2)},${p[i + 1].y.toFixed(2)}`;
    }
    return d;
  }

  /**
   * Line chart that draws itself. data: numbers or {x?, y, label?}.
   * Returns { axes(at), draw(at, opts), mark(i, at, opts), band(i0, i1, at, opts), point(i), svg }.
   * Honest defaults: y-axis includes zero unless you pass min; monotone curve never overshoots data.
   */
  K.lineChart = (target, { data, width, height, pad, min, max, color = 'var(--accent)', strokeWidth = 5, area = true, grid = true,
    yTicks = 4, yFormat = (v) => fmtNum(v), xLabels, smooth = true, tip = true, tipFormat } = {}) => {
    const host = one(target);
    const W = width ?? host.offsetWidth, H = height ?? host.offsetHeight;
    const P = { top: 30, right: 150, bottom: 56, left: 90, ...(pad ?? {}) };
    Object.keys(P).forEach((k) => (P[k] *= u()));
    const pts = data.map((d, i) => (typeof d === 'number' ? { x: i, y: d } : { x: d.x ?? i, ...d }));
    const ys = pts.map((d) => d.y);
    const lo = min ?? Math.min(0, ...ys), hi = max ?? Math.max(...ys) * 1.05;
    const x0 = pts[0].x, x1 = pts.at(-1).x;
    const sx = (x) => P.left + ((x - x0) / (x1 - x0 || 1)) * (W - P.left - P.right);
    const sy = (y) => H - P.bottom - ((y - lo) / (hi - lo || 1)) * (H - P.top - P.bottom);
    const xy = pts.map((d) => ({ x: sx(d.x), y: sy(d.y) }));

    const root = svg('svg', { class: 'cf-chart', width: W, height: H, viewBox: `0 0 ${W} ${H}`, overflow: 'visible' });
    host.appendChild(root);
    const gGrid = svg('g', { class: 'cf-grid' }, root);
    const ticks = grid ? niceTicks(lo, hi, yTicks) : [];
    const tickEls = ticks.map((v) => {
      const g = svg('g', {}, gGrid);
      svg('line', { x1: P.left, x2: W - P.right, y1: sy(v), y2: sy(v), stroke: 'var(--line)', 'stroke-width': 1.5 }, g);
      const tx = svg('text', { x: P.left - 18 * u(), y: sy(v) + 8 * u(), 'text-anchor': 'end' }, g);
      tx.textContent = yFormat(v);
      return g;
    });
    const xEls = (xLabels ?? []).map(([i, label]) => {
      const tx = svg('text', { x: xy[i].x, y: H - P.bottom + 42 * u(), 'text-anchor': 'middle' }, gGrid);
      tx.textContent = label;
      return tx;
    });

    const clipId = id('clip'), gradId = id('grad');
    const defs = svg('defs', {}, root);
    const clipRect = svg('rect', { x: 0, y: 0, width: 0, height: H }, svg('clipPath', { id: clipId }, defs));
    const grad = svg('linearGradient', { id: gradId, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svg('stop', { offset: '0%', 'stop-color': color, 'stop-opacity': 0.28 }, grad);
    svg('stop', { offset: '100%', 'stop-color': color, 'stop-opacity': 0 }, grad);

    const d = smooth ? monotonePath(xy) : `M${xy.map((p) => `${p.x},${p.y}`).join(' L')}`;
    const areaPath = area ? svg('path', { d: `${d} L${xy.at(-1).x},${sy(lo)} L${xy[0].x},${sy(lo)} Z`, fill: `url(#${gradId})`, 'clip-path': `url(#${clipId})` }, root) : null;
    const line = svg('path', { d, fill: 'none', stroke: color, 'stroke-width': strokeWidth * u(), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, root);
    const len = line.getTotalLength();
    line.style.strokeDasharray = `${len} ${len}`;
    line.style.strokeDashoffset = len;

    const tipOuter = svg('g', {}, root); // GSAP fades this; onFrame drives tipG (never tween what onFrame writes)
    const tipG = svg('g', { opacity: 0 }, tipOuter);
    svg('circle', { r: 16 * u(), fill: color, opacity: 0.18 }, tipG);
    svg('circle', { r: 8 * u(), fill: color }, tipG);
    const tipText = svg('text', { x: 22 * u(), y: 9 * u(), class: 'cf-tip', style: `fill: var(--ink); font-family: var(--cf-sans); font-weight: 650; font-size: ${34 * u()}px; font-variant-numeric: tabular-nums` }, tipG);
    const valueAtX = (x) => {
      for (let i = 0; i < xy.length - 1; i++) if (x <= xy[i + 1].x) { const f = (x - xy[i].x) / (xy[i + 1].x - xy[i].x || 1); return pts[i].y + f * (pts[i + 1].y - pts[i].y); }
      return pts.at(-1).y;
    };
    const proxy = { p: 0 };
    let lastP = -1;
    CF.onFrame(() => {
      if (proxy.p === lastP) return;
      lastP = proxy.p;
      line.style.strokeDashoffset = len * (1 - proxy.p);
      const pt = line.getPointAtLength(len * proxy.p);
      clipRect.setAttribute('width', pt.x);
      if (tip) {
        tipG.setAttribute('transform', `translate(${pt.x},${pt.y})`);
        tipG.setAttribute('opacity', proxy.p > 0.001 ? 1 : 0);
        tipText.textContent = (tipFormat ?? yFormat)(valueAtX(pt.x));
      }
    });

    const api = {
      svg: root, line, points: xy, sx, sy,
      point: (i) => xy[i],
      axes(at, { dur = 0.6, stagger = 0.06 } = {}) {
        tl().from([...tickEls, ...xEls], { opacity: 0, duration: dur, stagger, ease: 'power2.out' }, T(at));
        return api;
      },
      draw(at, { dur = 1.6, ease = 'power2.inOut', to = 1 } = {}) {
        tl().to(proxy, { p: to, duration: dur, ease }, T(at));
        return api;
      },
      hideTip(at, { dur = 0.3 } = {}) { tl().fromTo(tipOuter, { opacity: 1 }, { opacity: 0, duration: dur, immediateRender: false }, T(at)); return api; },
      /** Pop a marker + label at data index i. */
      mark(i, at, { label, color: c = color, dy = -34, align = 'middle' } = {}) {
        const g = svg('g', { transform: `translate(${xy[i].x},${xy[i].y})` }, root);
        const dot = svg('circle', { r: 9 * u(), fill: 'var(--bg)', stroke: c, 'stroke-width': 4 * u() }, g);
        let tx = null;
        if (label) {
          tx = svg('text', { y: dy * u(), 'text-anchor': align, style: `fill: var(--ink); font-family: var(--cf-sans); font-weight: 600; font-size: ${30 * u()}px` }, g);
          tx.textContent = label;
        }
        tl().from(dot, { attr: { r: 0 }, duration: 0.5, ease: 'back.out(2)' }, T(at));
        if (tx) tl().from(tx, { opacity: 0, y: (dy + 12) * u(), duration: 0.6, ease: K.tokens.ease.in }, T(at) + 0.08);
        return g;
      },
      /** Shade the region between two data indices (e.g. a period worth calling out). */
      band(i0, i1, at, { label, fill = 'var(--ink)', opacity = 0.07 } = {}) {
        const r = svg('rect', { x: xy[i0].x, y: P.top, width: xy[i1].x - xy[i0].x, height: H - P.top - P.bottom, fill, opacity }, root);
        root.insertBefore(r, root.firstChild.nextSibling);
        tl().from(r, { attr: { width: 0 }, duration: 0.8, ease: K.tokens.ease.move }, T(at));
        if (label) {
          const tx = svg('text', { x: xy[i0].x + 14 * u(), y: P.top + 34 * u() }, root);
          tx.textContent = label;
          tl().from(tx, { opacity: 0, duration: 0.5 }, T(at) + 0.3);
        }
        return r;
      },
    };
    return api;
  };

  /**
   * Bars (DOM-based, easy to style). data: [{label, value, color?, note?}].
   * Returns { grow(at, opts), focus(i, at), bars }.
   */
  K.bars = (target, { data, max, format = (v) => fmtNum(v), orientation = 'vertical', gap = 28, color = 'var(--ink-2)', accent = 'var(--accent)', highlight, labelSize } = {}) => {
    const host = one(target);
    const vertical = orientation === 'vertical';
    const hi = max ?? Math.max(...data.map((d) => d.value)) * 1.08;
    host.style.display = 'flex';
    host.style.flexDirection = vertical ? 'row' : 'column';
    host.style.alignItems = vertical ? 'flex-end' : 'stretch';
    host.style.gap = `${gap * u()}px`;
    const fs = labelSize ?? 30 * u();
    const rows = data.map((d, i) => {
      const row = document.createElement('div');
      Object.assign(row.style, vertical
        ? { flex: '1', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'stretch', gap: `${12 * u()}px` }
        : { display: 'grid', gridTemplateColumns: `minmax(${220 * u()}px, auto) 1fr`, alignItems: 'center', gap: `${24 * u()}px` });
      const isHi = highlight === i || highlight === d.label;
      const value = document.createElement('div');
      value.className = 'cf-num';
      Object.assign(value.style, { fontSize: `${fs * 1.35}px`, color: isHi ? 'var(--ink)' : 'var(--ink-2)', textAlign: vertical ? 'center' : 'left' });
      const bar = document.createElement('div');
      const barColor = d.color ?? (isHi ? accent : color);
      Object.assign(bar.style, vertical
        ? { height: `${(d.value / hi) * 78}%`, background: barColor, borderRadius: `${6 * u()}px ${6 * u()}px 0 0`, transformOrigin: '50% 100%' }
        : { height: `${fs * 1.6}px`, width: `${(d.value / hi) * 100}%`, background: barColor, borderRadius: `0 ${6 * u()}px ${6 * u()}px 0`, transformOrigin: '0 50%', display: 'flex', alignItems: 'center', justifyContent: 'flex-end' });
      const label = document.createElement('div');
      label.className = 'cf-label';
      label.textContent = d.label;
      Object.assign(label.style, { fontSize: `${fs}px`, textAlign: vertical ? 'center' : 'left', color: isHi ? 'var(--ink)' : 'var(--dim)' });
      if (vertical) { row.append(value, bar, label); } else {
        const track = document.createElement('div');
        Object.assign(track.style, { display: 'flex', alignItems: 'center', gap: `${18 * u()}px` });
        track.append(bar, value);
        row.append(label, track);
      }
      host.appendChild(row);
      return { row, bar, value, label, d };
    });
    const api = {
      bars: rows,
      grow(at, { dur = 1.0, stagger = K.tokens.stagger.items, ease = 'power3.out' } = {}) {
        const t = T(at);
        rows.forEach((r, i) => {
          const s = t + i * stagger;
          tl().from(r.bar, { [vertical ? 'scaleY' : 'scaleX']: 0, duration: dur, ease }, s);
          tl().from([r.label, r.value], { opacity: 0, duration: 0.4 }, s);
          K.counter(r.value, s, { from: 0, to: r.d.value, dur, ease, format });
        });
        return api;
      },
      /** Dim everything except bar i — one focal point. */
      focus(i, at, { dim = 0.28, dur = 0.5 } = {}) {
        rows.forEach((r, j) => { if (j !== i) tl().to([r.bar, r.value, r.label], { opacity: dim, duration: dur, ease: 'power2.out' }, T(at)); });
        tl().to(rows[i].bar, { backgroundColor: col(accent), duration: dur }, T(at));
        return api;
      },
    };
    return api;
  };

  /**
   * Unit (waffle) chart — the clearest way to show a probability or share: "7 in 10".
   * Returns { show(at), fill(n, at, opts), dots }.
   */
  K.waffle = (target, { total = 100, cols = 10, size, gap, shape = 'circle', color = 'var(--line)', seed = 11 } = {}) => {
    const host = one(target);
    const rows = Math.ceil(total / cols);
    const cell = size ?? Math.floor(Math.min(host.offsetWidth / cols, host.offsetHeight / rows));
    const g = gap ?? cell * 0.22;
    const d = cell - g;
    host.style.display = 'grid';
    host.style.gridTemplateColumns = `repeat(${cols}, ${d}px)`;
    host.style.gap = `${g}px`;
    host.style.justifyContent = 'center';
    host.style.alignContent = 'center';
    const dots = Array.from({ length: total }, () => {
      const el = document.createElement('div');
      Object.assign(el.style, { width: `${d}px`, height: `${d}px`, backgroundColor: col(color), borderRadius: shape === 'circle' ? '50%' : `${d * 0.18}px` });
      host.appendChild(el);
      return el;
    });
    const order = (kind) => {
      const idx = dots.map((_, i) => i);
      if (kind === 'random') return CF.rand(seed).shuffle(idx);
      if (kind === 'center') { const cx = (cols - 1) / 2, cy = (rows - 1) / 2; return idx.sort((a, b) => Math.hypot(a % cols - cx, Math.floor(a / cols) - cy) - Math.hypot(b % cols - cx, Math.floor(b / cols) - cy)); }
      return idx;
    };
    const api = {
      dots,
      show(at, { dur = 0.5, from = 'center', each = 0.006 } = {}) {
        tl().from(order(from).map((i) => dots[i]), { scale: 0, opacity: 0, duration: dur, ease: 'back.out(1.6)', stagger: each }, T(at));
        return api;
      },
      /** Color n dots. order: 'rows' | 'random' | 'center'. */
      fill(n, at, { color: c = 'var(--accent)', order: o = 'rows', each = 0.012, dur = 0.35, start = 0 } = {}) {
        const list = order(o).slice(start, start + n).map((i) => dots[i]);
        tl().to(list, { backgroundColor: col(c), scale: 1, duration: dur, ease: 'power2.out', stagger: each }, T(at));
        return api;
      },
      pulse(n, at, { start = 0 } = {}) {
        const list = dots.slice(start, start + n);
        tl().to(list, { scale: 1.25, duration: 0.18, ease: 'power2.out', stagger: 0.004, yoyo: true, repeat: 1 }, T(at));
        return api;
      },
    };
    return api;
  };

  /** Donut / ring gauge. Returns { sweep(at, {to, dur}), svg }. value is 0..1. */
  K.donut = (target, { size, thickness = 0.12, color = 'var(--accent)', track = 'var(--line)', rounded = true } = {}) => {
    const host = one(target);
    const S = size ?? Math.min(host.offsetWidth, host.offsetHeight);
    const sw = S * thickness, r = (S - sw) / 2, c = 2 * Math.PI * r;
    const root = svg('svg', { width: S, height: S, viewBox: `0 0 ${S} ${S}`, style: 'transform: rotate(-90deg)' }, host);
    svg('circle', { cx: S / 2, cy: S / 2, r, fill: 'none', stroke: track, 'stroke-width': sw }, root);
    const arc = svg('circle', { cx: S / 2, cy: S / 2, r, fill: 'none', stroke: color, 'stroke-width': sw, 'stroke-linecap': rounded ? 'round' : 'butt', 'stroke-dasharray': `${c} ${c}`, 'stroke-dashoffset': c }, root);
    const proxy = { v: 0 };
    CF.onFrame(() => arc.setAttribute('stroke-dashoffset', c * (1 - proxy.v)));
    const api = {
      svg: root, arc,
      sweep(at, { to = 1, dur = 1.2, ease = 'power3.out' } = {}) { tl().to(proxy, { v: to, duration: dur, ease }, T(at)); return api; },
    };
    return api;
  };

  /** Horizontal meter with a counter: good for a single percentage. */
  K.meter = (target, { value, color = 'var(--accent)', height = 22, format = (v) => `${Math.round(v * 100)}%`, label } = {}) => {
    const host = one(target);
    host.innerHTML = `<div class="cf-row" style="justify-content:space-between;margin-bottom:${14 * u()}px"><span class="cf-label">${label ?? ''}</span><span class="cf-num" style="font-size:${48 * u()}px"></span></div>
      <div style="height:${height * u()}px;background:var(--line);border-radius:${height * u()}px;overflow:hidden"><div style="height:100%;width:100%;background:${color};transform-origin:0 50%;transform:scaleX(0);border-radius:inherit"></div></div>`;
    const num = host.querySelector('.cf-num'), fill = host.querySelector('[style*="scaleX"]');
    const api = {
      fill(at, { dur = 1.2, ease = 'power3.out' } = {}) {
        tl().to(fill, { scaleX: value, duration: dur, ease }, T(at));
        K.counter(num, at, { from: 0, to: value, dur, ease, format });
        return api;
      },
    };
    num.textContent = format(0);
    return api;
  };

  /** Draw any SVG stroke (path, line, polyline, circle) on. */
  K.draw = (target, at, { dur = 0.9, ease = 'power2.inOut', from = 0 } = {}) => {
    for (const p of many(target)) {
      const len = p.getTotalLength();
      p.style.strokeDasharray = `${len} ${len}`;
      tl().fromTo(p, { strokeDashoffset: len * (1 - from) }, { strokeDashoffset: 0, duration: dur, ease, immediateRender: true }, T(at));
    }
  };

  /** Annotation arrow between two points (px, in `parent` coordinates). Returns { draw(at) }. */
  K.arrow = (parent, from, to, { curve = 0.25, color = 'var(--ink-2)', width = 3, head = 16 } = {}) => {
    const host = one(parent);
    const root = svg('svg', { style: 'position:absolute;inset:0;overflow:visible;pointer-events:none', width: host.offsetWidth, height: host.offsetHeight }, host);
    const mx = (from.x + to.x) / 2 - (to.y - from.y) * curve, my = (from.y + to.y) / 2 + (to.x - from.x) * curve;
    const path = svg('path', { d: `M${from.x},${from.y} Q${mx},${my} ${to.x},${to.y}`, fill: 'none', stroke: color, 'stroke-width': width * u(), 'stroke-linecap': 'round' }, root);
    const ang = Math.atan2(to.y - my, to.x - mx), h = head * u();
    const tip = svg('path', { d: `M${to.x - h * Math.cos(ang - 0.45)},${to.y - h * Math.sin(ang - 0.45)} L${to.x},${to.y} L${to.x - h * Math.cos(ang + 0.45)},${to.y - h * Math.sin(ang + 0.45)}`, fill: 'none', stroke: color, 'stroke-width': width * u(), 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }, root);
    return { draw(at, { dur = 0.7 } = {}) { K.draw(path, at, { dur }); tl().from(tip, { opacity: 0, duration: 0.2 }, T(at) + dur * 0.85); } };
  };

  /**
   * Milestones along a line: [{label, sub?}]. Returns { play(at, {step}), focus(i, at) }.
   */
  K.milestones = (target, { items, color = 'var(--accent)' } = {}) => {
    const host = one(target);
    host.style.position = 'relative';
    const W = host.offsetWidth, H = host.offsetHeight;
    const y = H * 0.5;
    const root = svg('svg', { width: W, height: H, style: 'position:absolute;inset:0;overflow:visible' }, host);
    const base = svg('line', { x1: 0, x2: W, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 3 * u() }, root);
    const prog = svg('line', { x1: 0, x2: W, y1: y, y2: y, stroke: color, 'stroke-width': 3 * u() }, root);
    const xs = items.map((_, i) => (items.length === 1 ? W / 2 : (i / (items.length - 1)) * (W - 80 * u()) + 40 * u()));
    const nodes = items.map((it, i) => {
      const dot = svg('circle', { cx: xs[i], cy: y, r: 11 * u(), fill: 'var(--bg)', stroke: color, 'stroke-width': 4 * u() }, root);
      const lab = document.createElement('div');
      lab.innerHTML = `<div class="cf-h3" style="font-size:${40 * u()}px">${it.label}</div>${it.sub ? `<div class="cf-label" style="margin-top:${8 * u()}px">${it.sub}</div>` : ''}`;
      Object.assign(lab.style, { position: 'absolute', left: `${xs[i]}px`, transform: 'translateX(-50%)', textAlign: 'center', width: `${Math.min(420 * u(), W / items.length)}px` });
      if (i % 2 === 0) lab.style.bottom = `${H - y + 34 * u()}px`; // even labels above the line, odd below
      else lab.style.top = `${y + 34 * u()}px`;
      host.appendChild(lab);
      return { dot, lab };
    });
    prog.style.strokeDasharray = `${W} ${W}`;
    prog.style.strokeDashoffset = W;
    const api = {
      nodes,
      play(at, { step = 0.6 } = {}) {
        const t = T(at);
        tl().from(base, { opacity: 0, duration: 0.4 }, t);
        nodes.forEach((n, i) => {
          const s = t + i * step;
          tl().to(prog, { strokeDashoffset: W - xs[i], duration: step * 0.9, ease: 'power2.inOut' }, Math.max(t, s - step * 0.9));
          tl().from(n.dot, { attr: { r: 0 }, duration: 0.45, ease: 'back.out(2)' }, s);
          tl().from(n.lab, { opacity: 0, y: (i % 2 ? -16 : 16) * u(), duration: 0.6, ease: K.tokens.ease.in }, s + 0.05);
        });
        return api;
      },
      focus(i, at, { dim = 0.3 } = {}) {
        nodes.forEach((n, j) => j !== i && tl().to(n.lab, { opacity: dim, duration: 0.4 }, T(at)));
        tl().to(nodes[i].dot, { attr: { fill: col(color) }, duration: 0.3 }, T(at));
        return api;
      },
    };
    return api;
  };

  /**
   * Process steps: boxes joined by connectors. items: [{label, sub?}]. Returns { play(at, {step}), focus(i, at) }.
   */
  K.steps = (target, { items, vertical = false } = {}) => {
    const host = one(target);
    Object.assign(host.style, { display: 'flex', flexDirection: vertical ? 'column' : 'row', alignItems: 'center', justifyContent: 'center', gap: '0px' });
    const els = [];
    items.forEach((it, i) => {
      if (i > 0) {
        const c = document.createElement('div');
        Object.assign(c.style, vertical ? { width: `${3 * u()}px`, height: `${56 * u()}px` } : { height: `${3 * u()}px`, width: `${72 * u()}px` });
        c.style.background = 'var(--line)';
        c.style.transformOrigin = vertical ? '50% 0' : '0 50%';
        host.appendChild(c);
        els.push({ connector: c });
      }
      const box = document.createElement('div');
      Object.assign(box.style, { border: `${2 * u()}px solid var(--line)`, borderRadius: `${18 * u()}px`, padding: `${26 * u()}px ${34 * u()}px`, background: 'var(--surface)', textAlign: 'center', minWidth: `${220 * u()}px` });
      box.innerHTML = `<div class="cf-kicker" style="margin-bottom:${10 * u()}px">${String(i + 1).padStart(2, '0')}</div><div class="cf-h3" style="font-size:${40 * u()}px">${it.label}</div>${it.sub ? `<div class="cf-label" style="margin-top:${8 * u()}px;font-size:${26 * u()}px">${it.sub}</div>` : ''}`;
      host.appendChild(box);
      els.push({ box });
    });
    const boxes = els.filter((e) => e.box).map((e) => e.box);
    const api = {
      boxes,
      play(at, { step = 0.5 } = {}) {
        let s = T(at);
        for (const e of els) {
          if (e.connector) { tl().from(e.connector, { [vertical ? 'scaleY' : 'scaleX']: 0, duration: step * 0.6, ease: 'power2.inOut' }, s); s += step * 0.4; }
          else { tl().from(e.box, { opacity: 0, y: 24 * u(), duration: 0.7, ease: K.tokens.ease.in }, s); s += step; }
        }
        return api;
      },
      focus(i, at, { dim = 0.35 } = {}) {
        boxes.forEach((b, j) => tl().to(b, j === i ? { borderColor: col('var(--accent)'), opacity: 1, duration: 0.4 } : { opacity: dim, duration: 0.4 }, T(at)));
        return api;
      },
    };
    return api;
  };

  /** Small source line — every number on screen should have one. */
  K.source = (parent, text, at, { position = 'bottom-left' } = {}) => {
    const el = document.createElement('div');
    el.className = 'cf-kicker cf-source';
    el.textContent = text;
    const [v, h] = position.split('-');
    Object.assign(el.style, { position: 'absolute', [v]: `calc(var(--safe-${v === 'top' ? 'top' : 'bottom'}) * 0.55)`, [h]: 'var(--safe-x)', letterSpacing: '0.06em', textTransform: 'none', opacity: 0.85 });
    one(parent).appendChild(el);
    tl().from(el, { opacity: 0, duration: 0.6 }, T(at));
    return el;
  };

  /** Footnote / disclosure. Returns the minimum hold (s) for comfortable reading. */
  K.footnote = (parent, text, at, opts = {}) => {
    const el = K.source(parent, text, at, opts);
    el.classList.add('cf-footnote');
    const words = text.split(/\s+/).length;
    return Math.max(2.5, words / 3 + 1);
  };

  window.CF.kit = K;
})();
