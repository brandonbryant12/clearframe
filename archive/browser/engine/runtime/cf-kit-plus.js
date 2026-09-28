/*! ClearFrame kit+ — icons, odometers, backdrops, camera, spotlight, cursor, orientation chrome,
 * cue helpers and the default "look" composition. Same rules as cf-kit.js: everything lives on CF.tl
 * or in CF.onFrame, so it is seekable and deterministic.
 */
(() => {
  'use strict';
  const K = CF.kit;
  const tl = () => CF.tl;
  const T = (at) => (typeof at === 'number' ? at : CF.time(at));
  const one = (x, root = document) => (typeof x === 'string' ? root.querySelector(x) : x);
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const u = () => parseFloat(cssVar('--u')) || 1;
  const NS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) if (v != null) n.setAttribute(k, v);
    if (parent) parent.appendChild(n);
    return n;
  };

  // ------------------------------------------------------------------ text helpers
  K.esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  /** Tiny markup for props text: *emphasis* → accent <em>, **strong** → <strong>, line breaks with \n. */
  K.md = (s) => K.esc(s)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  /** Plain text of spoken narration (tags and backchannels removed). */
  K.spoken = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\|[^|]*\|/g, ' ').replace(/\s+/g, ' ').trim();

  // ------------------------------------------------------------------ cue helpers (for blocks & scenes)
  /**
   * cue(spec, fallback) → absolute seconds. spec: number (s after beat start) | "word" (lands 0.12 s before the
   * spoken word) | { say, nth, lead } | { at } | "+1.5" (s after beat start). fallback: seconds or () => seconds.
   */
  K.cueFor = (b) => (spec, fallback = 0.2) => {
    const fb = () => (typeof fallback === 'function' ? fallback() : b.at(fallback));
    if (spec == null || spec === '') return fb();
    if (typeof spec === 'number') return b.at(spec);
    if (typeof spec === 'string') return /^[+-]?\d/.test(spec) ? b.at(parseFloat(spec)) : b.say(spec) - 0.12;
    if (spec.say) return b.say(spec.say, spec) - (spec.lead ?? 0.12);
    if (spec.at != null) return b.at(spec.at);
    return fb();
  };
  /** Evenly spread item i of n across the narration (or the beat if silent). */
  K.spread = (b, i, n, { from = 0.05, to = 0.85 } = {}) => {
    const a = b.vo ? b.vo.start : b.start + 0.3;
    const z = b.vo ? b.vo.end : b.end - 0.8;
    const span = Math.max(0.2, z - a);
    return a + span * (from + (to - from) * (n <= 1 ? 0 : i / (n - 1)));
  };

  // ------------------------------------------------------------------ icons (Lucide, ISC)
  const iconCache = new Map();
  /**
   * Insert a Lucide icon (https://lucide.dev — 2,000+ names; search with `clearframe icons <query>`).
   * Returns the <svg>. Stroke-only, inherits `color`. Use K.drawIcon to draw it on.
   */
  K.icon = async (parent, name, { size = 64, stroke = 1.75, color } = {}) => {
    if (!iconCache.has(name)) {
      iconCache.set(name, fetch(`/_cf/icons/${name}.svg`).then((r) => {
        if (!r.ok) throw new Error(`Unknown icon "${name}" — search with: clearframe icons <query>`);
        return r.text();
      }));
    }
    const text = (await iconCache.get(name)).replace(/<!--[\s\S]*?-->/g, '');
    const wrap = document.createElement('span');
    wrap.innerHTML = text;
    const svg = wrap.querySelector('svg');
    const px = size * u();
    svg.setAttribute('width', px); svg.setAttribute('height', px);
    svg.setAttribute('stroke-width', stroke);
    svg.classList.add('cf-icon');
    if (color) svg.style.color = color;
    one(parent).appendChild(svg);
    return svg;
  };
  /** Draw an icon's strokes on, part by part. */
  K.drawIcon = (svg, at, { dur = 0.8, stagger = 0.08 } = {}) => {
    const parts = [...svg.querySelectorAll('path,circle,line,rect,polyline,polygon,ellipse')];
    parts.forEach((p, i) => K.draw(p, T(at) + i * stagger, { dur }));
    return T(at) + dur + stagger * (parts.length - 1);
  };

  // ------------------------------------------------------------------ odometer
  /** Rolling-digit counter (mechanical odometer feel). Returns { to(value, at, dur) }. */
  K.odometer = (target, at, { from = 0, to, dur = 1.4, decimals = 0, prefix = '', suffix = '', grouping = true, ease = 'power3.out' } = {}) => {
    const el = one(target);
    el.classList.add('cf-num', 'cf-odo');
    const fmt = (v) => K.fmt(v, { decimals, grouping });
    const sample = fmt(Math.max(Math.abs(from), Math.abs(to ?? from)));
    el.innerHTML = '';
    if (prefix) el.insertAdjacentHTML('beforeend', `<span>${K.esc(prefix)}</span>`);
    const cols = [];
    let place = sample.replace(/[^0-9]/g, '').length - 1 - decimals;
    for (const ch of sample) {
      if (/\d/.test(ch)) {
        const col = document.createElement('span');
        col.className = 'cf-odo-col';
        col.innerHTML = `<span class="cf-odo-strip">${[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<span>${d}</span>`).join('')}</span>`;
        el.appendChild(col);
        cols.push({ strip: col.firstChild, place: place-- });
      } else el.insertAdjacentHTML('beforeend', `<span class="cf-odo-sep">${K.esc(ch)}</span>`);
    }
    if (suffix) el.insertAdjacentHTML('beforeend', `<span>${K.esc(suffix)}</span>`);
    const proxy = { v: from };
    let last = null;
    CF.onFrame(() => {
      if (proxy.v === last) return;
      last = proxy.v;
      const v = Math.abs(proxy.v) * 10 ** decimals;
      for (const c of cols) {
        const p = 10 ** (c.place + decimals);
        let pos;
        if (p === 1) pos = v % 10;
        else {
          const r = (v % p) / p;
          pos = (Math.floor(v / p) % 10) + Math.max(0, (r - 0.9) / 0.1);
        }
        c.strip.style.transform = `translateY(${(-pos * 100) / 11}%)`;
      }
    });
    const api = { to(value, when, d = dur, e = ease) { tl().to(proxy, { v: value, duration: d, ease: e }, T(when)); return api; }, proxy };
    if (to != null) tl().fromTo(proxy, { v: from }, { v: to, duration: dur, ease, immediateRender: false }, T(at));
    return api;
  };

  // ------------------------------------------------------------------ delta chip
  /** A small "+12% vs last year" pill. dir: 'up' | 'down' | 'flat'; good: which direction is good ('up' default). */
  K.chip = (parent, text, { dir = 'up', good = 'up', label = '' } = {}) => {
    const el = document.createElement('span');
    const tone = dir === 'flat' ? 'flat' : dir === good ? 'good' : 'bad';
    el.className = `cf-chip cf-chip-${tone}`;
    const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
    el.innerHTML = `<b>${arrow} ${K.esc(text)}</b>${label ? `<span>${K.esc(label)}</span>` : ''}`;
    one(parent).appendChild(el);
    return el;
  };

  // ------------------------------------------------------------------ backdrops
  function valueNoise(seed) {
    const r = CF.rand(seed);
    const g = Array.from({ length: 64 * 64 }, () => r());
    const at = (x, y) => g[((y & 63) << 6) | (x & 63)];
    const sm = (t) => t * t * (3 - 2 * t);
    return (x, y) => {
      const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
      const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
      return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
    };
  }
  /** Topographic contour lines (marching squares over seeded fractal noise). Slow drift. */
  function topo(host, { seed = 5, levels = 11, opacity = 0.55, scale = 5.5, drift = [3, 1.5] } = {}) {
    const W = host.offsetWidth * 1.12, H = host.offsetHeight * 1.12;
    const n = valueNoise(seed), n2 = valueNoise(seed + 1);
    const cols = 96, rows = Math.round((cols * H) / W);
    const f = (i, j) => 0.65 * n((i / cols) * scale, (j / rows) * scale * (H / W)) + 0.35 * n2((i / cols) * scale * 2.3, (j / rows) * scale * 2.3 * (H / W));
    const v = []; for (let j = 0; j <= rows; j++) { v[j] = []; for (let i = 0; i <= cols; i++) v[j][i] = f(i, j); }
    const sx = W / cols, sy = H / rows;
    const svg = svgEl('svg', { class: 'cf-backdrop cf-topo', width: W, height: H, viewBox: `0 0 ${W} ${H}` });
    for (let k = 1; k < levels; k++) {
      const lv = 0.15 + (0.7 * k) / levels;
      let d = '';
      for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
        const a = v[j][i], b = v[j][i + 1], c = v[j + 1][i + 1], e = v[j + 1][i];
        const idx = (a > lv) | ((b > lv) << 1) | ((c > lv) << 2) | ((e > lv) << 3);
        if (idx === 0 || idx === 15) continue;
        const L = (p, q) => (lv - p) / (q - p || 1e-9);
        const top = [(i + L(a, b)) * sx, j * sy], right = [(i + 1) * sx, (j + L(b, c)) * sy];
        const bottom = [(i + L(e, c)) * sx, (j + 1) * sy], left = [i * sx, (j + L(a, e)) * sy];
        const seg = { 1: [left, top], 2: [top, right], 3: [left, right], 4: [right, bottom], 5: [left, top, right, bottom], 6: [top, bottom], 7: [left, bottom],
          8: [bottom, left], 9: [top, bottom], 10: [top, right, bottom, left], 11: [right, bottom], 12: [right, left], 13: [top, right], 14: [left, top] }[idx];
        for (let s = 0; s < seg.length; s += 2) d += `M${seg[s][0].toFixed(1)},${seg[s][1].toFixed(1)}L${seg[s + 1][0].toFixed(1)},${seg[s + 1][1].toFixed(1)}`;
      }
      svgEl('path', { d, fill: 'none', stroke: 'var(--line)', 'stroke-width': k % 4 === 0 ? 1.6 : 1, 'stroke-linecap': 'round' }, svg);
    }
    Object.assign(svg.style, { position: 'absolute', left: `${-W * 0.05}px`, top: `${-H * 0.05}px`, opacity, pointerEvents: 'none',
      maskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, #000 35%, transparent 100%)', webkitMaskImage: 'radial-gradient(ellipse 70% 70% at 50% 50%, #000 35%, transparent 100%)' });
    host.insertBefore(svg, host.firstChild);
    CF.onFrame((t) => { svg.style.transform = `translate(${(-t * drift[0] * u()).toFixed(2)}px, ${(-t * drift[1] * u()).toFixed(2)}px)`; });
    return svg;
  }
  /** Very soft drifting light fields in theme colors. Use sparingly — it is the closest thing to a "gradient background". */
  function aurora(host, { seed = 9, opacity = 0.5 } = {}) {
    const layer = document.createElement('div');
    layer.className = 'cf-backdrop cf-aurora';
    Object.assign(layer.style, { position: 'absolute', inset: 0, pointerEvents: 'none', opacity, overflow: 'hidden' });
    const r = CF.rand(seed);
    const blobs = ['--accent-soft', '--bg-2', '--accent-soft'].map((c, i) => {
      const d = document.createElement('div');
      const s = (0.55 + r() * 0.3) * host.offsetWidth;
      Object.assign(d.style, { position: 'absolute', width: `${s}px`, height: `${s}px`, borderRadius: '50%', background: `radial-gradient(circle, var(${c}) 0%, transparent 65%)`, left: `${r() * 70 - 10}%`, top: `${r() * 60 - 20}%` });
      layer.appendChild(d);
      return { d, ph: r() * 6.28, sp: 0.05 + r() * 0.05, amp: 40 + r() * 60 };
    });
    host.insertBefore(layer, host.firstChild);
    CF.onFrame((t) => { for (const b of blobs) b.d.style.transform = `translate(${(Math.sin(t * b.sp + b.ph) * b.amp * u()).toFixed(1)}px, ${(Math.cos(t * b.sp * 0.8 + b.ph) * b.amp * 0.6 * u()).toFixed(1)}px)`; });
    return layer;
  }
  /** Horizontal ruled lines (notebook / ledger feel). */
  function ruled(host, { gap = 64, opacity = 0.55, drift = 4 } = {}) {
    const g = document.createElement('div');
    g.className = 'cf-backdrop cf-gridlines';
    Object.assign(g.style, { position: 'absolute', inset: 0, pointerEvents: 'none', opacity,
      backgroundImage: 'linear-gradient(var(--line) 1px, transparent 1px)', backgroundSize: `100% ${gap * u()}px`,
      maskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)', webkitMaskImage: 'linear-gradient(90deg, transparent, #000 15%, #000 85%, transparent)' });
    host.insertBefore(g, host.firstChild);
    CF.onFrame((t) => { g.style.backgroundPosition = `0 ${(t * drift * u()).toFixed(2)}px`; });
    return g;
  }
  /** Ambient backdrop. kind: 'dots' | 'grid' | 'ruled' | 'topo' | 'aurora' | 'none'. */
  K.backdrop = (parent = '#stage', kind = 'dots', opts = {}) => {
    const host = one(parent);
    switch (kind) {
      case 'dots': return K.gridlines(host, { dots: true, size: 56, opacity: 0.55, drift: [4, 2], ...opts });
      case 'grid': return K.gridlines(host, { size: 96, opacity: 0.45, drift: [5, 2.5], ...opts });
      case 'ruled': return ruled(host, opts);
      case 'topo': return topo(host, opts);
      case 'aurora': return aurora(host, opts);
      case 'none': case false: return null;
      default: throw new Error(`Unknown backdrop "${kind}" (dots | grid | ruled | topo | aurora | none)`);
    }
  };

  // ------------------------------------------------------------------ orientation chrome
  /** Chapter label (top-left), "02 / 05" (top-right) and a hairline progress rail. Ambient + margin-safe. */
  K.chrome = (parent = '#stage', { chapter = true, count = true, progress = true } = {}) => {
    const host = one(parent);
    const c = document.createElement('div');
    c.className = 'cf-chrome';
    c.dataset.ambient = ''; c.dataset.safe = 'margin';
    c.innerHTML = `${progress ? '<div class="cf-rail"><i></i></div>' : ''}${chapter ? '<div class="cf-kicker cf-chapter"></div>' : ''}${count ? '<div class="cf-kicker cf-count"></div>' : ''}`;
    host.appendChild(c);
    const beats = CF.timing.beats;
    const chapters = [...new Set(beats.map((b) => b.chapter).filter(Boolean))];
    const ch = c.querySelector('.cf-chapter'), ct = c.querySelector('.cf-count'), rail = c.querySelector('.cf-rail i');
    CF.onFrame((t) => {
      const b = beats.find((x) => t >= x.start && t < x.end) ?? beats.at(-1);
      if (ch && ch.textContent !== (b.chapter ?? '')) ch.textContent = b.chapter ?? '';
      if (ct) {
        const i = chapters.indexOf(b.chapter);
        const s = i < 0 ? '' : `${String(i + 1).padStart(2, '0')} / ${String(chapters.length).padStart(2, '0')}`;
        if (ct.textContent !== s) ct.textContent = s;
      }
      if (rail) rail.style.transform = `scaleX(${(t / CF.timing.duration).toFixed(5)})`;
    });
    tl().from(c, { opacity: 0, duration: 0.8 }, 0.2);
    return c;
  };

  // ------------------------------------------------------------------ the default look
  /**
   * The default composition used by storyboard-only projects (no index.html). Reads storyboard look settings:
   * backdrop, grain, vignette, chrome ('auto'|true|false), captions ('auto'|true|false), transition ('auto'|'fade'|'rise'|'push'|'wipe'|'blur'|'zoom'|'cut').
   */
  K.look = (ctx, overrides = {}) => {
    const L = { ...(ctx.look ?? {}), ...overrides };
    const { stage, beats, format } = ctx;
    if (L.backdrop && L.backdrop !== 'none') K.backdrop(stage, L.backdrop);
    if (L.grain !== false) K.grain(stage, typeof L.grain === 'number' ? { opacity: L.grain } : {});
    if (L.vignette !== false) K.vignette(stage);
    const chapters = new Set(beats.map((b) => b.chapter).filter(Boolean));
    if (L.chrome === true || (L.chrome === 'auto' && chapters.size > 1)) K.chrome(stage, typeof L.chrome === 'object' ? L.chrome : {});
    if (L.captions === true || (L.captions === 'auto' && format === 'vertical')) K.captions(stage, format === 'vertical' ? { maxWords: 4, maxChars: 22 } : {});
    K.autoTransitions(ctx, L.transition ?? 'auto');
  };

  /** Transition between consecutive scene sections. 'auto' = rise across chapters, fade within one. */
  K.autoTransitions = (ctx, kind = 'auto', { dur = 0.5 } = {}) => {
    const host = document.getElementById('scenes') ?? ctx.stage;
    const secs = [...host.querySelectorAll(':scope > [data-beat]')].map((el) => {
      const b = CF.beat(el.dataset.beat);
      const until = el.dataset.until ? CF.beat(el.dataset.until) : b;
      return { el, b, start: b.start, end: until.end };
    }).sort((a, c) => a.start - c.start);
    for (let i = 1; i < secs.length; i++) {
      const A = secs[i - 1], B = secs[i];
      if (Math.abs(A.end - B.start) > 0.05) continue;
      let k = B.b.transition ?? kind;
      if (k === 'auto') k = A.b.chapter && B.b.chapter && A.b.chapter !== B.b.chapter ? 'rise' : 'fade';
      if (k === 'cut' || k === 'none') continue;
      K.transition(k, A.el, B.el, B.start, { dur: k === 'rise' ? dur + 0.1 : dur });
      if (ctx.look?.sfx && k === 'rise') CF.sfx('whoosh', B.start - 0.1, { volume: 0.25 });
    }
  };

  // ------------------------------------------------------------------ camera
  /** Rect of `el` in the (untransformed) coordinates of `container`. */
  K.rectIn = (el, container) => {
    const c = one(container).getBoundingClientRect(), r = one(el).getBoundingClientRect();
    const s = c.width / (one(container).offsetWidth || c.width) || 1;
    return { x: (r.left - c.left) / s, y: (r.top - c.top) / s, w: r.width / s, h: r.height / s };
  };
  /**
   * Camera on a wrapper element: `const cam = kit.camera(el.querySelector('.cam'))`, then
   * cam.zoomTo(target, at, { pad, dur, max }) · cam.reset(at) · cam.push(from, to, { scale }).
   * Measure targets before zooming (rects are computed at build time).
   */
  K.camera = (wrapper) => {
    const cam = one(wrapper);
    cam.style.transformOrigin = '0 0';
    const W = cam.offsetWidth, H = cam.offsetHeight;
    return {
      el: cam,
      zoomTo(target, at, { pad = 60, dur = 1.1, max = 3, ease = 'power3.inOut' } = {}) {
        const r = K.rectIn(target, cam);
        const s = Math.min(max, W / (r.w + 2 * pad * u()), H / (r.h + 2 * pad * u()));
        const x = W / 2 - s * (r.x + r.w / 2), y = H / 2 - s * (r.y + r.h / 2);
        tl().to(cam, { x, y, scale: s, duration: dur, ease }, T(at));
        return this;
      },
      reset(at, { dur = 0.9, ease = 'power3.inOut' } = {}) { tl().to(cam, { x: 0, y: 0, scale: 1, duration: dur, ease }, T(at)); return this; },
      push(from, to, { scale = 1.04 } = {}) { tl().fromTo(cam, { scale: 1 }, { scale, duration: T(to) - T(from), ease: 'none', immediateRender: false, transformOrigin: '50% 50%', data: 'cf-ambient' }, T(from)); return this; },
    };
  };

  // ------------------------------------------------------------------ spotlight
  /** Dim everything except a region; move it with .to(target, at). target: element or {x,y,w,h} in parent coords. */
  K.spotlight = (parent, { dim = 0.62, pad = 18, radius = 16 } = {}) => {
    const host = one(parent);
    const spot = document.createElement('div');
    spot.className = 'cf-spot';
    Object.assign(spot.style, { position: 'absolute', left: 0, top: 0, width: 0, height: 0, borderRadius: `${radius * u()}px`, opacity: 0, pointerEvents: 'none', zIndex: 20,
      boxShadow: `0 0 0 9999px color-mix(in oklab, var(--bg) ${Math.round(dim * 100)}%, transparent), 0 0 0 ${2 * u()}px var(--accent)` });
    host.appendChild(spot);
    const box = (t) => { const r = t instanceof Element ? K.rectIn(t, host) : t; const p = pad * u(); return { x: r.x - p, y: r.y - p, width: r.w + 2 * p, height: r.h + 2 * p }; };
    let shown = false;
    const api = {
      el: spot,
      to(target, at, { dur = 0.7 } = {}) {
        const b = box(target);
        if (!shown) { tl().set(spot, b, T(at)).to(spot, { opacity: 1, duration: 0.4 }, T(at)); shown = true; }
        else tl().to(spot, { ...b, duration: dur, ease: 'power3.inOut' }, T(at));
        return api;
      },
      off(at) { tl().to(spot, { opacity: 0, duration: 0.35 }, T(at)); shown = false; return api; },
    };
    return api;
  };

  // ------------------------------------------------------------------ cursor
  /** An arrow pointer that glides and clicks. .moveTo(target|{x,y}, at, {dur}) · .click(at). */
  K.cursor = (parent, { size = 34 } = {}) => {
    const host = one(parent);
    const c = document.createElement('div');
    c.className = 'cf-cursor';
    const s = size * u();
    c.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 24 24"><path d="M4 2.5 L4 19 L8.6 14.8 L11.6 21.2 L14.4 19.9 L11.5 13.7 L17.8 13.4 Z" fill="var(--ink)" stroke="var(--bg)" stroke-width="1.4" stroke-linejoin="round"/></svg><i class="cf-ripple"></i>`;
    Object.assign(c.style, { position: 'absolute', left: 0, top: 0, zIndex: 30, opacity: 0, pointerEvents: 'none' });
    host.appendChild(c);
    const ripple = c.querySelector('.cf-ripple');
    const pt = (t) => { if (t instanceof Element) { const r = K.rectIn(t, host); return { x: r.x + r.w * 0.55, y: r.y + r.h * 0.55 }; } return t; };
    let first = true;
    const api = {
      el: c,
      moveTo(target, at, { dur = 0.8 } = {}) {
        const p = pt(target);
        if (first) { tl().set(c, { x: p.x + 160 * u(), y: p.y + 120 * u() }, T(at)).to(c, { opacity: 1, duration: 0.25 }, T(at)); first = false; }
        tl().to(c, { x: p.x, y: p.y, duration: dur, ease: 'power3.inOut' }, T(at));
        return api;
      },
      click(at, { sound = true } = {}) {
        tl().to(c.firstChild, { scale: 0.85, duration: 0.08, transformOrigin: '20% 10%' }, T(at)).to(c.firstChild, { scale: 1, duration: 0.18 }, T(at) + 0.08);
        tl().fromTo(ripple, { scale: 0, opacity: 0.6 }, { scale: 1, opacity: 0, duration: 0.5, ease: 'power2.out', immediateRender: false }, T(at));
        if (sound && CF.timing.look?.sfx) CF.sfx('click', T(at), { volume: 0.4 });
        return api;
      },
      hide(at) { tl().to(c, { opacity: 0, duration: 0.25 }, T(at)); return api; },
    };
    return api;
  };

  // ------------------------------------------------------------------ list helper
  /** Reveal a list of elements, each on its own cue (or spread across the narration). */
  K.sequence = (els, b, cues = [], { enter = { y: 16 }, sound } = {}) => {
    const cue = K.cueFor(b);
    return els.map((el, i) => {
      const t = cue(cues[i], () => K.spread(b, i, els.length));
      K.enter(el, t, enter);
      if (sound && CF.timing.look?.sfx) CF.sfx(sound, t + 0.05, { volume: 0.3 });
      return t;
    });
  };
})();
