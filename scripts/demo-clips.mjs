#!/usr/bin/env node
// Short screen recordings of real studio interactions for the self-demo (examples/clearframe-self-demo):
// what a still cannot show, such as a mode switching, a scope pinned, a hand edit undone and redone,
// a running reply stopped, and the Google approval opened and cancelled. Each clip drives a running
// `clearframe viewer --serve` over the DevTools Protocol with real mouse and keyboard events and a
// drawn cursor, and records a tight 16:9 region around the controls involved at 2× (about 500 CSS
// px wide, so UI text still reads on a phone), as an H.264 MP4 at 30 fps.
//
//   node scripts/demo-clips.mjs --out DIR [--studio http://127.0.0.1:4317] [--cdp http://127.0.0.1:9333]
//          [--film projects-why-the-tide-turns-twice] [--scene title] [--field props.elements.1.text]
//          [--min 10] [--only name,name]
//
// --film must be a film you own for demos: the edit clip changes one title and undoes it, and the
// stop clip sends one message to its agent (the free model) and stops it. Nothing is approved or
// generated: the approval dialog is cancelled. clips.json records what each clip exercised.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { chrome, tab, sleep } from './demo-cdp.mjs';

const { values: o } = parseArgs({ options: { out: { type: 'string' }, studio: { type: 'string' }, cdp: { type: 'string' }, film: { type: 'string' }, scene: { type: 'string' }, field: { type: 'string' }, text: { type: 'string' }, min: { type: 'string' }, only: { type: 'string' } } });
if (!o.out) { console.error('Usage: node scripts/demo-clips.mjs --out DIR [--studio URL] [--cdp URL] [--film FILM] [--scene ID] [--field PATH] [--text TEXT] [--min S] [--only a,b]'); process.exit(2); }
const STUDIO = (o.studio ?? 'http://127.0.0.1:4317').replace(/\/$/, ''), OUT = path.resolve(o.out);
const FILM = o.film ?? 'projects-why-the-tide-turns-twice', SCENE = o.scene ?? 'title', FIELD = o.field ?? 'props.elements.1.text';
const NEW_TEXT = o.text ?? 'Why does the sea turn around twice a day?';
const only = o.only ? new Set(o.only.split(',')) : null;
const W = 1600, H = 900, SCALE = 2, MAX_W = 520, MIN = Number(o.min ?? 10);
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ page helpers
const until = async (page, test, ms = 20000, ...args) => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(test, ...args)) return true; await sleep(200); } throw new Error(`timed out waiting for ${test}`); };
const api = (page, url, body) => page.evaluate((url, body) => fetch(url, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}).then(r => r.json()), url, body ?? null);
async function open(page, hash) {
  await page.send('Page.navigate', { url: `${STUDIO}/build/viewer/index.html${hash}` });
  await sleep(1200); await page.evaluate(() => location.reload()); await sleep(2200);
}
const rect = (page, selector) => page.evaluate(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && r.width ? { x: r.left, y: r.top, w: r.width, h: r.height } : null; }, selector);
/** The smallest 16:9 box (at most MAX_W wide) around these rects, padded and kept on the page. */
function frame(rects, maxW = MAX_W) {
  const rs = rects.filter(Boolean); if (!rs.length) throw new Error('nothing to frame');
  const x0 = Math.min(...rs.map(r => r.x)) - 14, y0 = Math.min(...rs.map(r => r.y)) - 14, x1 = Math.max(...rs.map(r => r.x + r.w)) + 14, y1 = Math.max(...rs.map(r => r.y + r.h)) + 14;
  let w = Math.max(x1 - x0, ((y1 - y0) * 16) / 9, 320); w = Math.min(w, maxW); const h = (w * 9) / 16;
  const x = Math.min(Math.max(0, (x0 + x1) / 2 - w / 2), W - w), y = Math.min(Math.max(0, (y0 + y1) / 2 - h / 2), H - h);
  return { x: Math.round(x), y: Math.round(y), width: Math.round(w), height: Math.round(h) };
}

// A drawn cursor (the screenshot has none) that glides to targets and pulses on a click.
const CURSOR = () => {
  if (document.getElementById('demo-cursor')) return;
  const c = document.createElement('div'); c.id = 'demo-cursor';
  c.innerHTML = '<svg width="22" height="30" viewBox="0 0 22 30"><path d="M2 2 L2 24 L8 18.5 L12.5 28 L16 26.4 L11.6 17 L19.5 17 Z" fill="#fff" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/></svg><i></i>';
  c.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;transition:transform .55s cubic-bezier(.3,.7,.2,1);transform:translate(800px,450px);filter:drop-shadow(0 2px 3px rgba(0,0,0,.45))';
  const s = document.createElement('style'); s.textContent = '#demo-cursor i{position:absolute;left:-14px;top:-14px;width:28px;height:28px;border-radius:50%;border:2px solid #9db4ff;opacity:0}#demo-cursor.tap i{animation:demotap .45s ease-out}@keyframes demotap{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.4)}}';
  document.head.append(s); document.body.append(c);
};
async function point(page, selector) {
  const r = await rect(page, selector); if (!r) throw new Error(`no ${selector}`);
  const x = r.x + Math.min(r.w / 2, 40), y = r.y + r.h / 2;
  await page.evaluate((x, y) => { document.getElementById('demo-cursor').style.transform = `translate(${x}px,${y}px)`; }, x, y);
  await sleep(650); return { x, y };
}
async function click(page, selector) {
  const { x, y } = await point(page, selector);
  await page.evaluate(() => { const c = document.getElementById('demo-cursor'); c.classList.remove('tap'); void c.offsetWidth; c.classList.add('tap'); });
  for (const type of ['mousePressed', 'mouseReleased']) await page.send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: 1 });
  await sleep(350);
}
/** A keycap at the foot of the recorded box, for shortcuts the cursor cannot show. */
const keycap = (page, label, clip) => page.evaluate((label, c) => {
  let k = document.getElementById('demo-key');
  if (!k) { k = document.createElement('div'); k.id = 'demo-key'; document.body.append(k); }
  k.textContent = label; k.style.cssText = `position:fixed;z-index:2147483647;pointer-events:none;left:${c.x + c.width / 2}px;top:${c.y + c.height - 46}px;transform:translateX(-50%);padding:5px 12px;border-radius:8px;background:rgba(20,22,34,.92);color:#fff;font:600 15px/1.3 system-ui;border:1px solid rgba(157,180,255,.7);transition:opacity .3s;opacity:1`;
  clearTimeout(k._t); k._t = setTimeout(() => { k.style.opacity = '0'; }, 1300);
}, label, clip);
async function type(page, text, ms = 38) { for (const ch of text) { await page.send('Input.insertText', { text: ch }); await sleep(ms); } }
async function key(page, k, code, modifiers = 0) { for (const type of ['keyDown', 'keyUp']) await page.send('Input.dispatchKeyEvent', { type, key: k, code, modifiers, windowsVirtualKeyCode: k.length === 1 ? k.toUpperCase().charCodeAt(0) : k === 'Enter' ? 13 : 0 }); }

/** Record `clip` (a 16:9 page box) at 2× while `act` runs; returns the MP4's name and length. */
async function record(page, name, clip, act) {
  const dir = path.join(OUT, `.${name}-frames`); fs.rmSync(dir, { recursive: true, force: true }); fs.mkdirSync(dir);
  const frames = []; let on = true;
  const loop = (async () => { while (on) { const r = await page.send('Page.captureScreenshot', { format: 'jpeg', quality: 92, clip: { ...clip, scale: SCALE } }); const f = path.join(dir, `f${String(frames.length).padStart(5, '0')}.jpg`); fs.writeFileSync(f, Buffer.from(r.data, 'base64')); frames.push({ f, t: Date.now() }); } })();
  try { await act(); } finally { on = false; await loop; }
  const end = frames.at(-1).t + 400;
  fs.writeFileSync(path.join(dir, 'list.txt'), frames.map((x, i) => `file '${x.f}'\nduration ${(((frames[i + 1]?.t ?? end) - x.t) / 1000).toFixed(4)}`).join('\n') + `\nfile '${frames.at(-1).f}'\n`);
  const out = path.join(OUT, `${name}.mp4`);
  const r = spawnSync('ffmpeg', ['-loglevel', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(dir, 'list.txt'), '-vf', `fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,tpad=stop_mode=clone:stop_duration=${Math.max(0, MIN - (end - frames[0].t) / 1000).toFixed(2)},format=yuv420p`, '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', '-movflags', '+faststart', '-an', out], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(r.stderr);
  fs.rmSync(dir, { recursive: true, force: true });
  // Footage never loops in a film, so a short clip holds its last frame (the screen at rest) to --min seconds.
  return { file: `${name}.mp4`, seconds: Math.max(MIN, Math.round((end - frames[0].t) / 100) / 10), action: Math.round((end - frames[0].t) / 100) / 10, frames: frames.length, region: clip, scale: SCALE };
}
const clearComposer = () => {
  document.querySelector('.st-compose [data-act="scope"]')?.click();
  const t = document.getElementById('st-chat-input'); if (t) { t.value = ''; t.dispatchEvent(new Event('input', { bubbles: true })); }
};
const filmState = page => api(page, `${STUDIO}/api/studio/state?film=${FILM}`);

// ------------------------------------------------------------------ the clips
const CLIPS = {
  async modes(page) {
    await open(page, '#/films'); await until(page, () => !!document.querySelector('.home-mode label'));
    await page.evaluate(CURSOR);
    const clip = frame([await rect(page, '.home-mode label:nth-of-type(1)'), await rect(page, '.home-mode label:nth-of-type(2)')], 720); // both cards side by side
    const r = await record(page, 'modes', clip, async () => {
      await sleep(500); await click(page, '.home-mode label:nth-of-type(2)'); await sleep(1300); await click(page, '.home-mode label:nth-of-type(1)'); await sleep(1100);
    });
    return { ...r, exercised: 'Switched the new-film form from Make it for me to Build it together and back (nothing created).' };
  },
  async scope(page) {
    await open(page, `#/film/${FILM}`); await until(page, () => !!document.getElementById('st-chat-log'));
    await page.evaluate(clearComposer); // start unscoped, with no draft left in the composer
    await page.evaluate(s => document.querySelector(`[data-scene-row="${s}"]`)?.click(), SCENE); await sleep(700);
    await page.evaluate(() => document.querySelector('[data-act="right"][data-tab="inspect"]')?.click()); await sleep(500);
    await page.evaluate(CURSOR);
    const clip = frame([await rect(page, '.st-compose'), await rect(page, '.st-sel-actions [data-act="askScene"]')]);
    const r = await record(page, 'scope', clip, async () => {
      await sleep(400); await click(page, '.st-sel-actions [data-act="askScene"]'); await sleep(900);
      await type(page, 'Make this headline shorter.'); await sleep(1400);
    });
    await page.evaluate(clearComposer);
    return { ...r, exercised: 'Ask the agent on a selected scene pinned it as the scope; a message was typed and not sent.' };
  },
  async undo(page) {
    await open(page, `#/film/${FILM}`); await until(page, () => !!document.getElementById('st-chat-log'));
    await page.evaluate(() => document.querySelector('.st-layouts [data-layout="design"]')?.click()); await sleep(600);
    await page.evaluate(s => document.querySelector(`[data-scene-row="${s}"]`)?.click(), SCENE); await sleep(700);
    await page.evaluate(() => document.querySelector('[data-act="right"][data-tab="inspect"]')?.click()); await sleep(800);
    const field = `#st-right [data-path="${FIELD}"]`;
    await until(page, s => !!document.querySelector(s), 8000, field).catch(() => {});
    if (!(await rect(page, field))) throw new Error(`no field ${FIELD} for scene ${SCENE}`);
    await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), field); await sleep(300);
    const before = await filmState(page), title = await page.evaluate(s => document.querySelector(s).value, field);
    await page.evaluate(CURSOR);
    const clip = frame([await rect(page, field)]);
    const r = await record(page, 'undo', clip, async () => {
      await sleep(400); await click(page, field); await page.evaluate(s => document.querySelector(s).select(), field); await sleep(250);
      await type(page, NEW_TEXT, 45); await key(page, 'Enter', 'Enter', 4); // ⌘Enter commits a field
      await sleep(1800); await keycap(page, '⌘Z  Undo', clip); await key(page, 'z', 'KeyZ', 4); await sleep(1800);
      await keycap(page, '⇧⌘Z  Redo', clip); await key(page, 'Z', 'KeyZ', 12); await sleep(1800);
    });
    await page.evaluate(() => document.querySelector('[data-act="undo"]')?.click()); await sleep(1500); // leave the film as it was
    const after = await filmState(page);
    return { ...r, exercised: `Replaced a text layer by hand, ⌘Z restored "${title}", ⇧⌘Z re-applied it; the film was then undone to its starting state (${after.hash === before.hash ? 'verified by hash' : 'NOT back: check the film'}).`, restored: after.hash === before.hash };
  },
  async stop(page) {
    await open(page, `#/film/${FILM}`); await until(page, () => !!document.getElementById('st-chat-log'));
    await page.evaluate(() => document.querySelector('[data-act="mode"][data-mode="oneshot"]')?.click()); await sleep(600);
    await page.evaluate(clearComposer); await sleep(300);
    const before = await filmState(page);
    await page.evaluate(CURSOR);
    const clip = frame([await rect(page, '.st-compose')]);
    const r = await record(page, 'stop', clip, async () => {
      await sleep(400); await click(page, '#st-chat-input'); await type(page, 'Tighten every line of narration by a few words.'); await sleep(300); await key(page, 'Enter', 'Enter');
      await until(page, () => !!document.querySelector('[data-act="stop"]'), 15000); await sleep(1800);
      await click(page, '[data-act="stop"]'); await until(page, () => !document.querySelector('[data-act="stop"]'), 20000).catch(() => {}); await sleep(1500);
    });
    await sleep(3000);
    const after = await filmState(page);
    return { ...r, exercised: `Sent a request in Make it for me and pressed Stop while the agent was working; ${after.hash === before.hash ? 'the film was unchanged' : 'the film CHANGED before the stop: undo it'}.`, unchanged: after.hash === before.hash };
  },
  async approval(page) {
    await open(page, `#/film/${FILM}`); await until(page, () => !!document.getElementById('st-chat-log'));
    await page.evaluate(() => document.querySelector('[data-act="right"][data-tab="sound"]')?.click());
    await until(page, () => !!document.querySelector('[data-act="soundPaid"][data-kind="voice"]:not([disabled])'), 15000);
    const button = '[data-act="soundPaid"][data-kind="voice"]';
    await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), button); await sleep(300);
    // Measure the dialog once off camera, then close it, so the recording can frame it.
    await page.evaluate(s => document.querySelector(s).click(), button); await until(page, () => !!document.getElementById('pay-by'));
    const parts = [await rect(page, '.st-dialog .st-check'), await rect(page, '.st-dialog [data-act="close"]'), await rect(page, '.st-dialog p')];
    await page.evaluate(() => document.querySelector('.st-dialog [data-act="close"]').click()); await sleep(600);
    await page.evaluate(CURSOR);
    const clip = frame(parts, 600);
    const r = await record(page, 'approval', clip, async () => {
      await sleep(300); await page.evaluate(s => document.querySelector(s).click(), button); await sleep(1600);
      await point(page, '.st-dialog .st-check'); await sleep(900); await click(page, '.st-dialog [data-act="close"]'); await sleep(900);
    });
    return { ...r, exercised: 'Opened Generate with Google… for narration, showing the estimate and the approval it needs, then Cancel: nothing generated or charged.' };
  },
};

const c = await chrome(o.cdp);
const page = await tab(c.base);
await page.send('Page.enable');
await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const prior = fs.existsSync(path.join(OUT, 'clips.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'clips.json'), 'utf8')).clips : {};
const manifest = { recordedAt: new Date().toISOString(), studio: STUDIO, film: FILM, viewport: { width: W, height: H }, clips: { ...prior } };
try {
  for (const [name, run] of Object.entries(CLIPS)) {
    if (only && !only.has(name)) continue;
    process.stdout.write(`${name}… `);
    manifest.clips[name] = await run(page);
    console.log(`${manifest.clips[name].seconds}s`);
  }
} finally { await page.close(); c.stop(); fs.writeFileSync(path.join(OUT, 'clips.json'), JSON.stringify(manifest, null, 2) + '\n'); }
console.log(`${Object.keys(manifest.clips).length} clips → ${path.relative(process.cwd(), OUT)}/clips.json`);
