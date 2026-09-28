// Seeing the work: stills, contact sheets and automated QA. These are the agent's eyes.
import fs from 'node:fs';
import path from 'node:path';
import { captureAt, launch, openComposition, seek } from './browser.mjs';
import { loadStoryboard, paths } from './project.mjs';
import { serve } from './server.mjs';
import { computeTiming, tokenize } from './timing.mjs';
import { log, round } from './util.mjs';

async function withPage(root, fn, { scale = 1 } = {}) {
  const timing = computeTiming(root);
  const server = await serve(root);
  const browser = await launch({ scale });
  try {
    const ctx = await openComposition(browser, server.url, { width: timing.width, height: timing.height, scale });
    return await fn({ ...ctx, timing, browser });
  } finally {
    await browser.close();
    await server.close();
  }
}

/** Resolve --at / --beat into seconds. */
export function resolveTime(timing, { at, beat, pos = 0.6 }) {
  if (beat) {
    const b = timing.beats.find((x) => x.id === beat);
    if (!b) throw new Error(`No beat "${beat}"`);
    return b.start + b.dur * pos;
  }
  return Math.min(parseFloat(at ?? 0), timing.duration - 1 / timing.fps);
}

/** Full-resolution PNG of one moment. */
export async function still(root, { at, beat, pos, out } = {}) {
  return withPage(root, async ({ page, cdp, timing }) => {
    const t = resolveTime(timing, { at, beat, pos });
    const file = out ?? path.join(paths(root).build, `still-${t.toFixed(2)}s.png`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, await captureAt(page, cdp, t, { width: timing.width, height: timing.height, shot: { format: 'png' } }));
    log.ok(`Still @ ${t.toFixed(2)}s → ${path.relative(process.cwd(), file)}`);
    return file;
  });
}

/**
 * Contact sheet: `per` frames per beat (default 3: entering, settled, leaving), one row per beat.
 * Read the PNG to review the whole film at once.
 */
export async function sheet(root, { per = 3, thumb = 480, out, times } = {}) {
  return withPage(root, async ({ page, cdp, timing, browser }) => {
    const positions = per === 1 ? [0.6] : per === 2 ? [0.35, 0.85] : [0.18, 0.55, 0.92];
    const rows = times
      ? [{ id: 'custom', cells: times.map((t) => ({ t })) }]
      : timing.beats.map((b) => ({ id: b.id, b, cells: positions.map((p) => ({ t: b.start + b.dur * p })) }));
    const scale = thumb / timing.width;
    for (const r of rows) for (const c of r.cells) {
      const shot = { format: 'jpeg', quality: 80, clip: { x: 0, y: 0, width: timing.width, height: timing.height, scale } };
      const img = await captureAt(page, cdp, c.t, { width: timing.width, height: timing.height, shot });
      c.src = `data:image/jpeg;base64,${img.toString('base64')}`;
    }
    const cols = rows[0].cells.length;
    const esc = (s) => String(s ?? '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
    const html = `<!doctype html><meta charset="utf-8"><style>
      body{margin:0;background:#0b0c0e;color:#d8dadd;font:14px/1.35 -apple-system,Inter,sans-serif;padding:20px;width:${cols * (thumb + 14) + 300}px}
      h1{font-size:18px;margin:0 0 4px} .meta{color:#8a9097;margin-bottom:16px}
      .row{display:grid;grid-template-columns:280px repeat(${cols},${thumb}px);gap:14px;margin-bottom:14px;align-items:start}
      .beat b{display:block;color:#f0b44c;font:600 13px ui-monospace,monospace} .vo{color:#b9bdc2;margin-top:6px} .vis{color:#7d838a;margin-top:6px;font-style:italic}
      figure{margin:0} img{display:block;width:${thumb}px;border-radius:4px;outline:1px solid #25282d} figcaption{color:#7d838a;font:12px ui-monospace,monospace;margin-top:4px}
      .est{color:#e0a458}</style>
      <h1>${esc(timing.title)}</h1><div class="meta">${timing.width}×${timing.height} · ${timing.fps}fps · ${timing.duration.toFixed(2)}s · ${timing.beats.length} beats${timing.estimated ? ' · <span class="est">timing estimated (no voice yet)</span>' : ''}</div>
      ${rows.map((r) => `<div class="row"><div class="beat"><b>${esc(r.id)} ${r.b ? `· ${r.b.start.toFixed(2)}–${r.b.end.toFixed(2)}s` : ''}</b>${r.b?.vo ? `<div class="vo">“${esc(r.b.vo.text)}”</div>` : ''}${r.b?.visual ? `<div class="vis">${esc(r.b.visual)}</div>` : ''}</div>
        ${r.cells.map((c) => `<figure><img src="${c.src}"><figcaption>${c.t.toFixed(2)}s</figcaption></figure>`).join('')}</div>`).join('')}`;
    const sp = await browser.newPage();
    await sp.setViewport({ width: cols * (thumb + 14) + 340, height: 800 });
    await sp.setContent(html, { waitUntil: 'load' });
    const file = out ?? path.join(paths(root).build, 'sheet.png');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await sp.screenshot({ path: file, fullPage: true });
    log.ok(`Contact sheet (${rows.length} rows × ${cols}) → ${path.relative(process.cwd(), file)}`);
    return file;
  }, { scale: 1 });
}

// ------------------------------------------------------------------ check
function pageAudit() {
  const stage = document.getElementById('stage');
  const probe = document.createElement('div');
  probe.style.cssText = 'position:absolute;inset:var(--safe-top) var(--safe-x) var(--safe-bottom);pointer-events:none;visibility:hidden';
  stage.appendChild(probe);
  const safe = probe.getBoundingClientRect();
  probe.remove();
  const S = stage.getBoundingClientRect();
  const u = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--u')) || 1;
  const out = [];
  const walker = document.createTreeWalker(stage, NodeFilter.SHOW_TEXT);
  const seen = new Set();
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n.textContent.trim();
    if (!text) continue;
    const el = n.parentElement;
    if (!el || seen.has(el) || el.closest('.cf-player,.cf-safe-overlay,svg defs')) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.visibility !== 'visible' || cs.display === 'none') continue;
    let op = 1;
    for (let a = el; a && a !== document.body; a = a.parentElement) op *= parseFloat(getComputedStyle(a).opacity);
    if (op < 0.2) continue;
    const range = document.createRange();
    range.selectNodeContents(n);
    let r = range.getBoundingClientRect();
    if (cs.display !== 'inline') { // line box, not the font's taller content area
      const e = el.getBoundingClientRect();
      const top = Math.max(r.top, e.top), bottom = Math.min(r.bottom, e.bottom);
      if (bottom > top) r = { left: r.left, right: r.right, width: r.width, top, bottom, height: bottom - top };
    }
    if (r.width < 1 || r.height < 1) continue;
    // Skip text fully clipped by an overflow:hidden ancestor (e.g. masked reveals not yet in).
    let clipped = false;
    for (let a = el.parentElement; a && a !== stage; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if ([acs.overflow, acs.overflowX, acs.overflowY].some((o) => o === 'hidden' || o === 'clip')) {
        const ar = a.getBoundingClientRect();
        if (r.right <= ar.left || r.left >= ar.right || r.bottom <= ar.top || r.top >= ar.bottom) { clipped = true; break; }
      }
    }
    if (clipped) continue;
    out.push({
      text: text.slice(0, 60), words: text.split(/\s+/).length,
      x: r.left - S.left, y: r.top - S.top, w: r.width, h: r.height,
      font: parseFloat(cs.fontSize),
      margin: !!el.closest('.cf-source,.cf-footnote,.cf-captions,[data-safe="margin"]'),
      ignore: !!el.closest('[data-safe="ignore"]'),
      overflow: el.scrollWidth > el.clientWidth + 2 && ['hidden', 'clip'].includes(cs.overflowX) && !el.closest('[class*="mask"]'),
    });
  }
  return { safe: { x: safe.left - S.left, y: safe.top - S.top, w: safe.width, h: safe.height }, W: S.width, H: S.height, u, items: out };
}

/** Fingerprint of everything animated on stage, ignoring ambient layers (grain, grid, [data-ambient]). */
function stateSignature() {
  const stage = document.getElementById('stage');
  const skip = '.cf-grain,.cf-gridlines,.cf-vignette,[data-ambient],.cf-safe-overlay';
  const attrs = ['r', 'width', 'height', 'd', 'transform', 'opacity', 'stroke-dashoffset', 'fill', 'cx', 'cy', 'x2', 'y2'];
  let h = 2166136261;
  const mix = (str) => { for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } };
  const walk = (el) => {
    if (el.matches?.(skip)) return;
    const st = el.getAttribute?.('style');
    if (st) mix(st);
    if (el instanceof SVGElement) for (const a of attrs) { const v = el.getAttribute(a); if (v) mix(v); }
    for (const c of el.childNodes) {
      if (c.nodeType === 3) mix(c.textContent);
      else if (c.nodeType === 1) walk(c);
    }
  };
  walk(stage);
  return h >>> 0;
}

/** Automated QA: storyboard sanity, pacing, sources, and per-frame layout checks. Returns { errors, warnings }. */
export async function check(root, { samples = [0.5, 0.9] } = {}) {
  const errors = [], warnings = [], notes = [];
  const frameFindings = new Map(); // same finding at several moments → one line
  const at = (list, beat, t, msg) => {
    const key = `${list === errors ? 'E' : 'W'}|${msg}`;
    if (!frameFindings.has(key)) frameFindings.set(key, { list, msg, beats: new Set(), times: [] });
    const f = frameFindings.get(key);
    f.beats.add(beat); f.times.push(t);
  };
  const sb = loadStoryboard(root);
  const timing = computeTiming(root);

  // --- pacing & narration
  for (const b of timing.beats) {
    if (b.vo) {
      const words = tokenize(b.vo.text).length;
      const wpm = (words / b.vo.dur) * 60;
      if (!b.vo.estimated && b.vo.provider !== 'local' && wpm > 180) warnings.push(`[${b.id}] narration is fast (${Math.round(wpm)} wpm). Aim 140–165 for clarity; split the line or slow the style.`);
      if (b.vo.stale) warnings.push(`[${b.id}] voice take is stale: ${b.vo.stale}. Re-run \`clearframe voice\`.`);
      if (words > 45) warnings.push(`[${b.id}] ${words} words in one beat — one idea per beat; split it.`);
    }
    if (b.dur > 12) warnings.push(`[${b.id}] beat lasts ${b.dur.toFixed(1)}s — long holds lose attention; split or add a visual turn.`);
    if (b.dur < 1.0) warnings.push(`[${b.id}] beat is only ${b.dur.toFixed(2)}s — too short to register.`);
  }
  if (timing.estimated) notes.push('timing is estimated for beats without a recorded voice (`clearframe voice --draft` gives real timing for free).');
  const hook = timing.beats[0];
  if (hook && hook.dur > 5) warnings.push(`[${hook.id}] the first beat is ${hook.dur.toFixed(1)}s — the hook should land within ~3s.`);

  // --- claims & sources
  const numeric = timing.beats.filter((b) => /\d/.test(b.vo?.text ?? ''));
  if (numeric.length && !sb.sources.length) warnings.push(`${numeric.length} beat(s) state numbers but storyboard.sources is empty. Every figure needs a source (or a "hypothetical" label).`);

  // --- assets
  for (const a of timing.assets) if (!a.src) warnings.push(`asset "${a.id}" (${a.kind}) has no file yet — generate it or remove it.`);
  if (sb.music && !timing.music?.src) notes.push('no music bed yet (`clearframe music` or `music --draft`).');

  // --- page audit
  await withPage(root, async ({ page, info, issues }) => {
    info.warnings.forEach((w) => warnings.push(`runtime: ${w}`));
    for (const b of timing.beats) {
      for (const p of samples) {
        const t = b.start + b.dur * p;
        await seek(page, t);
        const a = await page.evaluate(pageAudit);
        const minFont = 22 * a.u;
        const add = (list, msg) => at(list, b.id, t, msg);
        let words = 0;
        const boxes = [];
        for (const it of a.items) {
          if (it.ignore) continue;
          words += it.margin ? 0 : it.words;
          const inFrame = it.x >= -1 && it.y >= -1 && it.x + it.w <= a.W + 1 && it.y + it.h <= a.H + 1;
          const inSafe = it.x >= a.safe.x - 1 && it.y >= a.safe.y - 1 && it.x + it.w <= a.safe.x + a.safe.w + 1 && it.y + it.h <= a.safe.y + a.safe.h + 1;
          if (!inFrame) add(errors, `text cut off by the frame edge: "${it.text}"`);
          else if (!inSafe && !it.margin) add(warnings, `text outside the safe area: "${it.text}" (mark deliberate margin text with data-safe="margin")`);
          if (it.overflow) add(errors, `text overflows its box: "${it.text}"`);
          if (it.font < minFont && !it.margin) add(warnings, `text is ${Math.round(it.font)}px (< ${Math.round(minFont)}px) — unreadable on a phone: "${it.text}"`);
          if (!it.margin) boxes.push(it);
        }
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const A = boxes[i], B = boxes[j];
          const ix = Math.max(0, Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x));
          const iy = Math.max(0, Math.min(A.y + A.h, B.y + B.h) - Math.max(A.y, B.y));
          if (ix * iy > 0.25 * Math.min(A.w * A.h, B.w * B.h)) add(warnings, `overlapping text: "${A.text}" × "${B.text}"`);
        }
        if (words > 32) add(warnings, `${words} words on screen — that's reading, not watching. Cut to the key phrase.`);
      }
    }
    for (const f of frameFindings.values()) {
      const times = f.times.slice(0, 4).map((x) => `${x.toFixed(1)}s`).join(', ') + (f.times.length > 4 ? ` +${f.times.length - 4}` : '');
      f.list.push(`[${[...f.beats].join(', ')} @ ${times}] ${f.msg}`);
    }
    issues.errors.forEach((e) => errors.push(`page error: ${e}`));
    issues.failed.forEach((f) => errors.push(`missing file: ${f}`));
  });

  // --- motion: stretches where nothing (except ambient texture) changes = dead air
  await withPage(root, async ({ page }) => {
    const step = 0.2;
    let last = null, stillFrom = 0;
    const report = (from, to) => {
      if (to - from >= 4) warnings.push(`nothing moves for ${(to - from).toFixed(1)}s (${from.toFixed(1)}s → ${to.toFixed(1)}s) — add a slow drift, a build, or cut sooner.`);
    };
    for (let t = 0; t <= timing.duration + 1e-6; t += step) {
      await seek(page, t);
      const sig = await page.evaluate(stateSignature);
      if (sig !== last) { if (last !== null) report(stillFrom, t - step); stillFrom = t; last = sig; }
    }
    report(stillFrom, timing.duration);
  });

  const dedupe = (arr) => [...new Set(arr)];
  return { errors: dedupe(errors), warnings: dedupe(warnings), notes, duration: round(timing.duration) };
}
