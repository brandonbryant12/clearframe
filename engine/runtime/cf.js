/*! ClearFrame runtime — every frame is a pure function of t.
 *
 * A composition calls CF.compose(build). The runtime:
 *   1. loads /_cf/timing.json (voice-first beat timing computed by the engine),
 *   2. builds ONE paused GSAP master timeline (CF.tl) and mounts scene modules,
 *   3. shows [data-beat] scenes only during their beat,
 *   4. exposes window.__CF.seek(t) for the renderer (deterministic frame capture),
 *   5. in a normal browser tab, adds a preview player with synced voice + music.
 */
(() => {
  'use strict';
  const qs = new URLSearchParams(location.search);
  const RENDER = qs.has('render');
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const FONT_FAMILIES = ['Inter Variable', 'Instrument Serif', 'JetBrains Mono Variable', 'Fraunces Variable'];

  const state = { timing: null, tl: null, frameFns: [], time: 0, playing: false, beats: new Map(), warnings: [], cues: [], ctx: null };

  // ---------------------------------------------------------------- utilities
  function hashSeed(seed) {
    if (typeof seed === 'number') return seed >>> 0;
    let h = 2166136261;
    for (const ch of String(seed)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  /** Seeded PRNG (mulberry32). Never use Math.random in a composition. */
  function rand(seed = 1) {
    let a = hashSeed(seed);
    const next = () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    next.range = (lo, hi) => lo + next() * (hi - lo);
    next.int = (lo, hi) => Math.floor(lo + next() * (hi - lo + 1));
    next.pick = (arr) => arr[Math.floor(next() * arr.length)];
    next.shuffle = (arr) => { const a2 = [...arr]; for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
    return next;
  }

  const norm = (w) => String(w).toLowerCase().replace(/[^a-z0-9%$]/g, '');
  function warn(msg) { state.warnings.push(msg); console.warn(`[ClearFrame] ${msg}`); }

  // ---------------------------------------------------------------- beats
  function makeBeat(b) {
    const beat = {
      ...b,
      /** absolute time `s` seconds after the beat starts */
      at: (s = 0) => b.start + s,
      /** absolute time `s` seconds before the beat ends */
      before: (s = 0) => b.end - s,
      /** absolute time at fraction f (0..1) of the beat */
      p: (f) => b.start + b.dur * f,
      get voStart() { return b.vo?.start ?? b.start; },
      get voEnd() { return b.vo?.end ?? b.end; },
      /** absolute time the narrator starts saying `words` (fuzzy, case-insensitive). Use to land visuals on the spoken word. */
      say(words, { nth = 0, edge = 'start', offset = 0 } = {}) {
        const list = b.vo?.words ?? [];
        const q = String(words).split(/\s+/).map(norm).filter(Boolean);
        let seen = 0;
        for (let i = 0; i + q.length <= list.length; i++) {
          if (q.every((part, j) => norm(list[i + j].w).startsWith(part))) {
            if (seen++ === nth) return (edge === 'end' ? list[i + q.length - 1].t1 : list[i].t0) + offset;
          }
        }
        warn(`beat "${b.id}": narration has no word "${words}" — using voice start`);
        return (b.vo?.start ?? b.start) + offset;
      },
    };
    return beat;
  }

  function beat(id) {
    const b = state.beats.get(id);
    if (!b) throw new Error(`Unknown beat "${id}". Known: ${[...state.beats.keys()].join(', ')}`);
    return b;
  }

  /** Resolve a time spec: number (seconds), "beatId", "beatId+0.4", "beatId@0.5" (fraction), "beatId:end". */
  function time(spec) {
    if (typeof spec === 'number') return spec;
    const m = String(spec).match(/^([\w-]+)(?::(end))?(?:@([\d.]+))?(?:([+-][\d.]+))?$/);
    if (!m) throw new Error(`Bad time spec "${spec}"`);
    const b = beat(m[1]);
    let t = m[2] ? b.end : m[3] ? b.p(parseFloat(m[3])) : b.start;
    if (m[4]) t += parseFloat(m[4]);
    return t;
  }

  // ---------------------------------------------------------------- compose
  async function compose(build, opts = {}) {
    try {
      const res = await fetch('/_cf/timing.json', { cache: 'no-store' });
      if (!res.ok) throw new Error(`timing.json: ${await res.text()}`);
      const timing = await res.json();
      state.timing = timing;
      for (const b of timing.beats) state.beats.set(b.id, makeBeat(b));

      const root = document.documentElement;
      root.dataset.theme = opts.theme ?? root.dataset.theme ?? timing.theme ?? 'paper';
      const fmt = timing.width > timing.height ? 'landscape' : timing.width < timing.height ? 'vertical' : 'square';
      root.dataset.format = fmt;
      root.style.setProperty('--w', `${timing.width}px`);
      root.style.setProperty('--h', `${timing.height}px`);
      root.style.setProperty('--u', String(Math.min(timing.width, timing.height) / 1080));
      root.classList.add(RENDER ? 'cf-render' : 'cf-preview');

      let stage = document.getElementById('stage');
      if (!stage) { stage = document.createElement('div'); stage.id = 'stage'; document.body.prepend(stage); }
      Object.assign(stage.style, { width: `${timing.width}px`, height: `${timing.height}px` });

      if (window.gsap) {
        const plugins = ['SplitText', 'DrawSVGPlugin', 'CustomEase', 'MotionPathPlugin'].map((n) => window[n]).filter(Boolean);
        if (plugins.length) gsap.registerPlugin(...plugins);
      } else throw new Error('GSAP not loaded. Add <script src="/_cf/vendor/gsap/gsap.min.js"></script> before cf.js');

      // One paused master timeline. The global clock is frozen so nothing animates in wall-clock time.
      const tl = gsap.timeline({ paused: true, defaults: { duration: 0.5, ease: 'power3.out' } });
      state.tl = tl;
      gsap.ticker.lagSmoothing(0);
      gsap.globalTimeline.pause();

      await loadFonts(); // before build, so text splitting and fitting measure real glyphs
      // Optional data.json: figures come from data, never typed from memory.
      const data = await fetch('/_cf/data.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      state.data = data;
      const ctx = { tl, beat, beats: [...state.beats.values()], time, timing, stage, rand, data, format: fmt, look: timing.look ?? {}, kit: CF.kit, CF };
      state.ctx = ctx;

      // Scene modules ("scene": "scenes/x.js") and library blocks ("block": "stat") each get a <section data-beat>.
      const scenesHost = document.getElementById('scenes') ?? stage;
      for (const b of ctx.beats) {
        if (!b.scene && !b.block) continue;
        let el = scenesHost.querySelector(`:scope > [data-beat="${b.id}"]`);
        if (!el) {
          el = document.createElement('section');
          el.className = 'cf-scene';
          el.dataset.beat = b.id;
          scenesHost.appendChild(el);
        }
        if (b.block) { await mount(b.block, el, b.props ?? {}, b); continue; }
        const mod = await import(new URL(b.scene, location.href).href);
        await mountModule(mod, b.scene, el, b.props ?? {}, b);
      }

      if (build) await build(ctx);
      applySceneVisibility(tl);
      tl.set({}, {}, timing.duration); // timeline spans the whole video

      await loadMedia();
      // Warm-up pass: render every tween once, in order, so start values are recorded canonically.
      tl.seek(tl.duration(), false);
      tl.seek(0, false);

      reportOverruns(tl);
      const straySources = gsap.globalTimeline.getChildren(false, true, true).filter((c) => c !== tl);
      if (straySources.length) warn(`${straySources.length} tween(s) live outside CF.tl — they will not render. Add them to the master timeline.`);

      window.__CF = {
        ready: true, duration: timing.duration, fps: timing.fps, width: timing.width, height: timing.height,
        frames: timing.frames, seek, warnings: state.warnings, timing, cues: state.cues,
      };
      const start = qs.has('t') ? parseFloat(qs.get('t')) : restoreTime();
      await seek(start || 0);
      if (!RENDER) mountPlayer();
      window.__CF_READY = true;
    } catch (err) {
      console.error(err);
      window.__CF_ERROR = String(err?.stack ?? err);
      showError(err);
    }
  }

  const injected = new Set();
  function injectCss(key, css) {
    if (injected.has(key)) return;
    injected.add(key);
    const st = document.createElement('style');
    st.textContent = css;
    document.head.appendChild(st);
  }

  /**
   * Mount a library block (engine/runtime/blocks/<name>.js) into `el`, timed to beat `b`.
   * Usable from custom scenes too: `await CF.mount('stat', someEl, { value: 42 }, b)`.
   */
  async function mount(name, el, props = {}, b) {
    const mod = await import(`/_cf/blocks/${name}.js`).catch((e) => { throw new Error(`Unknown block "${name}" (${e.message}). List them with: clearframe blocks`); });
    el.classList.add('cf-block', `cf-block-${name}`);
    return mountModule(mod, `block:${name}`, el, props, b, name);
  }

  /** Shared mount path for library blocks and custom scene modules (same ctx, so a block can be forked into scenes/). */
  async function mountModule(mod, key, el, props = {}, b, name = null) {
    const meta = mod.meta ?? {};
    const p = { ...(meta.defaults ?? {}), ...props };
    if (mod.css) injectCss(key, typeof mod.css === 'function' ? mod.css() : mod.css);
    const beatObj = typeof b === 'string' ? beat(b) : b;
    if (p.until) el.dataset.until = p.until;
    const ctx = { ...state.ctx, el, b: beatObj, props: p, name };
    ctx.cue = CF.kit.cueFor ? CF.kit.cueFor(beatObj) : (s) => beatObj.at(typeof s === 'number' ? s : 0);
    ctx.sound = (cueName, t, opts) => { if (state.timing.look?.sfx && p.sfx !== false) sfx(cueName, t, opts); };
    if (mod.html) el.innerHTML = typeof mod.html === 'function' ? mod.html(p, ctx) : mod.html;
    if (typeof mod.default === 'function') await mod.default(ctx);
    return el;
  }

  /** Register a sound cue: a built-in name (tick, tock, pop, click, type, whoosh, chime, thud, rise) or a project path. */
  function sfx(name, t, { volume = 0.5 } = {}) {
    const at = Math.max(0, Math.round(t * 1000) / 1000);
    if (!state.cues.some((c) => c.name === name && Math.abs(c.t - at) < 0.03)) state.cues.push({ name, t: at, volume });
  }

  /** Warn when a scene's animation is still running after its beat ends (the payoff would be cut off). */
  function reportOverruns(tl) {
    const late = new Map();
    for (const tw of tl.getChildren(true, true, false)) {
      if (tw.data === 'cf-ambient' || tw.data === 'cf-transition') continue; // camera drift and scene transitions may overlap the cut by design
      const end = tw.startTime() + tw.duration() * (tw.repeat() + 1);
      for (const t of tw.targets()) {
        const sec = t instanceof Element ? t.closest('[data-beat]') : null;
        if (!sec) continue;
        late.set(sec, Math.max(late.get(sec) ?? 0, end));
      }
    }
    for (const [sec, end] of late) {
      const b = state.beats.get(sec.dataset.beat);
      const until = sec.dataset.until ? state.beats.get(sec.dataset.until) : b;
      if (!b || !until) continue;
      const over = end - (until.end + parseFloat(sec.dataset.out ?? 0));
      if (over > 0.15 && end < state.timing.duration - 0.05) warn(`beat "${until.id}": animation runs ${over.toFixed(1)}s past the beat — its payoff gets cut. Add "tail": ${(1 + over).toFixed(1)} (or land it earlier).`);
    }
  }

  function applySceneVisibility(tl) {
    for (const el of $$('[data-beat]')) {
      const b = state.beats.get(el.dataset.beat);
      if (!b) { warn(`element [data-beat="${el.dataset.beat}"] has no matching beat`); continue; }
      const until = el.dataset.until ? beat(el.dataset.until) : b;
      const on = Math.max(0, b.start + parseFloat(el.dataset.in ?? 0));
      const off = until.end + parseFloat(el.dataset.out ?? 0);
      tl.set(el, { visibility: 'visible' }, on);
      if (off < state.timing.duration - 1e-6) tl.set(el, { visibility: 'hidden' }, off);
    }
  }

  async function loadFonts() {
    const fonts = FONT_FAMILIES.flatMap((f) => [`400 48px "${f}"`, `italic 400 48px "${f}"`]);
    await Promise.allSettled(fonts.map((f) => document.fonts.load(f)));
    await document.fonts.ready;
  }

  async function loadMedia() {
    await document.fonts.ready;
    await Promise.allSettled($$('img').map((img) => (img.complete ? img.decode?.() : new Promise((r) => { img.onload = img.onerror = r; }))));
    await Promise.allSettled($$('video').map((v) => {
      v.muted = true; v.playsInline = true; v.preload = 'auto';
      if (v.readyState >= 2) return null;
      return new Promise((r) => { v.addEventListener('loadeddata', r, { once: true }); v.addEventListener('error', r, { once: true }); setTimeout(r, 8000); });
    }));
  }

  // ---------------------------------------------------------------- seek
  function onceEvent(el, ev, ms) {
    return new Promise((r) => { const t = setTimeout(r, ms); el.addEventListener(ev, () => { clearTimeout(t); r(); }, { once: true }); });
  }

  async function syncMedia(t) {
    const vids = $$('video[data-start]');
    if (!vids.length) return;
    let waited = false;
    for (const v of vids) {
      const start = time(v.dataset.start);
      const rate = parseFloat(v.dataset.rate ?? 1);
      let local = (t - start) * rate + parseFloat(v.dataset.offset ?? 0);
      const d = v.duration || Infinity;
      local = v.hasAttribute('loop') && isFinite(d) ? ((local % d) + d) % d : clamp(local, 0, d - 0.001);
      if (!RENDER && state.playing) {
        if (t >= start && v.paused) v.play().catch(() => {});
        if (Math.abs(v.currentTime - local) > 0.25) v.currentTime = local;
        continue;
      }
      if (!v.paused) v.pause();
      if (Math.abs(v.currentTime - local) > 0.0005) {
        v.currentTime = local;
        await onceEvent(v, 'seeked', 3000);
        waited = true;
      }
    }
    if (waited) await new Promise((r) => requestAnimationFrame(() => r()));
  }

  /** Render the composition at time t (seconds). Deterministic. */
  async function seek(t) {
    const dur = state.timing.duration;
    t = clamp(t, 0, dur);
    state.time = t;
    state.tl.seek(t, false);
    const frame = Math.round(t * state.timing.fps);
    for (const fn of state.frameFns) fn(t, frame);
    for (const a of document.getAnimations()) { // CSS @keyframes follow the playhead too
      if (a.playState !== 'paused') a.pause();
      a.currentTime = t * 1000;
    }
    await syncMedia(t);
    if (!RENDER) updatePlayer();
  }

  /** Register a function called on every frame with (t, frame). For canvas / derived drawing. */
  function onFrame(fn) { state.frameFns.push(fn); return fn; }

  // ---------------------------------------------------------------- preview player
  let ui;
  const audio = { ctx: null, buffers: new Map(), live: [], muted: false, loading: null };

  function restoreTime() { try { return parseFloat(sessionStorage.getItem(`cf:t:${location.pathname}`)) || 0; } catch { return 0; } }
  function storeTime(t) { try { sessionStorage.setItem(`cf:t:${location.pathname}`, String(t)); } catch {} }

  function fitStage() {
    const stage = document.getElementById('stage');
    const barH = 64;
    const s = Math.min(innerWidth / state.timing.width, (innerHeight - barH) / state.timing.height);
    const x = (innerWidth - state.timing.width * s) / 2;
    const y = (innerHeight - barH - state.timing.height * s) / 2;
    stage.style.transform = `translate(${x}px, ${y}px) scale(${s})`;
  }

  function fmtTime(t) {
    const m = Math.floor(t / 60), s = t - m * 60;
    return `${m}:${s.toFixed(2).padStart(5, '0')}`;
  }

  function mountPlayer() {
    const T = state.timing;
    const bar = document.createElement('div');
    bar.className = 'cf-player';
    bar.innerHTML = `
      <button class="cf-btn cf-play" title="Play / pause (space)">▶</button>
      <div class="cf-time"><span class="cf-now">0:00.00</span> / ${fmtTime(T.duration)}</div>
      <div class="cf-track"><div class="cf-beats"></div><div class="cf-head"></div></div>
      <div class="cf-beatname"></div>
      <button class="cf-btn cf-safe" title="Safe areas (S)">▢</button>
      <button class="cf-btn cf-mute" title="Mute (M)">♪</button>`;
    document.body.appendChild(bar);
    const beatsEl = bar.querySelector('.cf-beats');
    for (const b of T.beats) {
      const seg = document.createElement('div');
      seg.className = 'cf-seg' + (b.vo?.estimated ? ' cf-est' : '');
      seg.style.left = `${(b.start / T.duration) * 100}%`;
      seg.style.width = `${(b.dur / T.duration) * 100}%`;
      seg.title = `${b.id} · ${b.start.toFixed(2)}s → ${b.end.toFixed(2)}s${b.vo?.estimated ? ' · estimated timing (no voice yet)' : ''}\n${b.vo?.text ?? b.visual ?? ''}`;
      seg.innerHTML = `<span>${b.id}</span>`;
      beatsEl.appendChild(seg);
    }
    const safe = document.createElement('div');
    safe.className = 'cf-safe-overlay';
    safe.innerHTML = '<div class="cf-safe-title"></div><div class="cf-safe-ui"></div>';
    document.getElementById('stage').appendChild(safe);

    ui = { bar, now: bar.querySelector('.cf-now'), head: bar.querySelector('.cf-head'), name: bar.querySelector('.cf-beatname'), play: bar.querySelector('.cf-play'), track: bar.querySelector('.cf-track') };

    ui.play.onclick = togglePlay;
    bar.querySelector('.cf-safe').onclick = () => document.documentElement.classList.toggle('cf-show-safe');
    bar.querySelector('.cf-mute').onclick = (e) => { audio.muted = !audio.muted; e.currentTarget.style.opacity = audio.muted ? 0.4 : 1; if (state.playing) { stopAudio(); startAudio(state.time); } };
    let dragging = false;
    const scrub = (e) => { const r = ui.track.getBoundingClientRect(); const t = clamp((e.clientX - r.left) / r.width, 0, 1) * T.duration; jump(t); };
    ui.track.addEventListener('pointerdown', (e) => { dragging = true; ui.track.setPointerCapture(e.pointerId); scrub(e); });
    ui.track.addEventListener('pointermove', (e) => dragging && scrub(e));
    ui.track.addEventListener('pointerup', () => { dragging = false; });

    addEventListener('keydown', (e) => {
      const step = 1 / T.fps;
      const cur = beatAt(state.time);
      const keys = {
        ' ': togglePlay,
        ArrowRight: () => jump(state.time + (e.shiftKey ? 1 : step)),
        ArrowLeft: () => jump(state.time - (e.shiftKey ? 1 : step)),
        ']': () => { const n = T.beats[(cur?.index ?? -1) + 1]; if (n) jump(n.start); },
        '[': () => { const p = cur && state.time - cur.start < 0.3 ? T.beats[cur.index - 1] : cur; if (p) jump(p.start); },
        Home: () => jump(0), End: () => jump(T.duration),
        s: () => document.documentElement.classList.toggle('cf-show-safe'),
        m: () => bar.querySelector('.cf-mute').click(),
      };
      const fn = keys[e.key];
      if (fn) { e.preventDefault(); fn(); }
    });
    addEventListener('resize', fitStage);
    fitStage();
    updatePlayer();

    try {
      const es = new EventSource('/_cf/events');
      es.onmessage = (m) => { if (m.data.startsWith('reload')) { storeTime(state.time); location.reload(); } };
    } catch {}
  }

  function beatAt(t) { return state.timing.beats.find((b) => t >= b.start && t < b.end) ?? state.timing.beats.at(-1); }

  function updatePlayer() {
    if (!ui) return;
    const T = state.timing;
    ui.now.textContent = fmtTime(state.time);
    ui.head.style.left = `${(state.time / T.duration) * 100}%`;
    const b = beatAt(state.time);
    ui.name.textContent = b ? `${b.id}${b.vo?.estimated ? ' · est.' : ''}` : '';
    ui.play.textContent = state.playing ? '❚❚' : '▶';
  }

  function jump(t) {
    const wasPlaying = state.playing;
    if (wasPlaying) pause();
    seek(clamp(t, 0, state.timing.duration));
    storeTime(state.time);
    if (wasPlaying) play();
  }

  let clock = null;
  function play() {
    if (state.playing) return;
    if (state.time >= state.timing.duration - 0.01) seek(0);
    state.playing = true;
    clock = { t0: state.time, wall: performance.now() };
    startAudio(state.time);
    const tick = () => {
      if (!state.playing) return;
      const t = clock.t0 + (performance.now() - clock.wall) / 1000;
      if (t >= state.timing.duration) { seek(state.timing.duration); pause(); return; }
      seek(t);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    updatePlayer();
  }
  function pause() {
    state.playing = false;
    stopAudio();
    for (const v of $$('video[data-start]')) v.pause();
    storeTime(state.time);
    updatePlayer();
  }
  function togglePlay() { state.playing ? pause() : play(); }

  async function loadAudio() {
    const T = state.timing;
    audio.ctx ??= new AudioContext();
    const srcs = new Set([...T.beats.flatMap((b) => [b.vo?.src, ...(b.sfx ?? []).map((s) => s.src)]), T.music?.src, ...state.cues.map(cueSrc)].filter(Boolean));
    await Promise.all([...srcs].filter((s) => !audio.buffers.has(s)).map(async (src) => {
      try { audio.buffers.set(src, await audio.ctx.decodeAudioData(await (await fetch(src)).arrayBuffer())); } catch { warn(`could not load audio ${src}`); }
    }));
  }

  async function startAudio(t) {
    if (audio.muted) return;
    audio.loading ??= loadAudio();
    await audio.loading;
    audio.loading = null;
    if (!state.playing) return;
    const ctx = audio.ctx;
    await ctx.resume();
    const now = ctx.currentTime + 0.02;
    const T = state.timing;
    const at = (src, when, vol = 1, dest = ctx.destination) => {
      const buf = audio.buffers.get(src);
      if (!buf || when + buf.duration <= t) return null;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      const g = ctx.createGain(); g.gain.value = vol;
      node.connect(g).connect(dest);
      node.start(now + Math.max(0, when - t), Math.max(0, t - when));
      audio.live.push(node);
      return g;
    };
    for (const b of T.beats) {
      if (b.vo?.src) at(b.vo.src, b.vo.start, 1);
      for (const s of b.sfx ?? []) at(s.src, s.t, s.volume);
    }
    for (const c of state.cues) at(cueSrc(c), c.t, c.volume);
    if (T.music?.src) {
      const g = at(T.music.src, -(T.music.offset ?? 0), T.music.volume);
      if (g && T.music.duck) {
        const v = T.music.volume;
        for (const b of T.beats) {
          if (!b.vo) continue;
          const a = now + (b.vo.start - t), z = now + (b.vo.end - t);
          if (z < now) continue;
          g.gain.setTargetAtTime(v * 0.5, Math.max(now, a - 0.15), 0.08);
          g.gain.setTargetAtTime(v, Math.max(now, z + 0.1), 0.25);
        }
      }
    }
  }
  function cueSrc(c) { return /[/.]/.test(c.name) ? c.name : `/_cf/sfx/${c.name}.wav`; }
  function stopAudio() { for (const n of audio.live) { try { n.stop(); } catch {} } audio.live = []; }

  function showError(err) {
    const box = document.createElement('pre');
    box.className = 'cf-error';
    box.textContent = `ClearFrame build error\n\n${err?.stack ?? err}`;
    document.body.appendChild(box);
  }

  const CF = { compose, seek, onFrame, rand, beat, time, warn, mount, sfx, get tl() { return state.tl; }, get timing() { return state.timing; }, get data() { return state.data; }, get t() { return state.time; }, get cues() { return state.cues; }, RENDER, kit: {} };
  window.CF = CF;
})();
