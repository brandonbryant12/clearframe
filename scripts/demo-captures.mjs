#!/usr/bin/env node
// Capture real studio UI for the self-demo (examples/clearframe-self-demo): drives a running
// `clearframe viewer --serve` in Chrome over the DevTools Protocol (no extra dependencies), saves a
// 1920×1080 overview and 2× close-ups of each state, and writes captures.json with each control's
// measured position (normalised 0–1; each close-up also gets its crop and the pins inside it) so the
// agent can place pins and focus regions exactly; it cannot see the pictures. Read-only for films:
// it opens panels and dialogs, types into the composer without sending, and cancels the
// paid-approval dialog. Never sends, approves or edits.
//
//   node scripts/demo-captures.mjs --out DIR [--studio http://127.0.0.1:4317] [--cdp http://127.0.0.1:9333]
//          [--tour projects-why-the-tide-turns-twice] [--done projects-flash-then-rumble] [--only name,name]
//
// --cdp reuses a Chrome started with --remote-debugging-port; without it Chrome is launched headless
// (CHROME or the macOS default path). --tour is a film with review notes, sound and layers to open;
// --done is a film with a final render and a conversation.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chrome as launch, tab, sleep } from './demo-cdp.mjs';

const { values: o } = parseArgs({ options: { out: { type: 'string' }, studio: { type: 'string' }, cdp: { type: 'string' }, tour: { type: 'string' }, done: { type: 'string' }, only: { type: 'string' } } });
if (!o.out) { console.error('Usage: node scripts/demo-captures.mjs --out DIR [--studio URL] [--cdp URL] [--tour FILM] [--done FILM] [--only a,b]'); process.exit(2); }
const STUDIO = (o.studio ?? 'http://127.0.0.1:4317').replace(/\/$/, ''), OUT = path.resolve(o.out);
const TOUR = o.tour ?? 'projects-why-the-tide-turns-twice', DONE = o.done ?? 'projects-flash-then-rumble';
const only = o.only ? new Set(o.only.split(',')) : null;
fs.mkdirSync(OUT, { recursive: true });

// ------------------------------------------------------------------ the states
const W = 1920, H = 1080;
const until = (page, test, ms = 20000) => (async () => { const end = Date.now() + ms; while (Date.now() < end) { if (await page.evaluate(test)) return true; await sleep(250); } throw new Error(`timed out waiting for ${test}`); })();
async function open(page, hash) {
  await page.send('Page.navigate', { url: `${STUDIO}/build/viewer/index.html${hash}` });
  await sleep(1500);
  await page.evaluate(() => location.reload()); await sleep(2500);
}
const click = (page, selector) => page.evaluate(s => { const e = document.querySelector(s); if (!e) throw new Error(`no ${s}`); e.click(); return true; }, selector);
/** Normalised boxes of the elements a capture explains, measured on the page as captured. */
const measure = (page, items) => page.evaluate((items, W, H) => items.map(([label, selector, detail]) => {
  const e = document.querySelector(selector); if (!e) return { label, detail, missing: selector };
  if (e.getBoundingClientRect().bottom > H || e.getBoundingClientRect().top < 0) return { label, detail, offscreen: selector };
  const r = e.getBoundingClientRect(), f = n => Math.round(n * 1000) / 1000;
  return { label, detail, selector, x: f((r.left + r.width / 2) / W), y: f((r.top + r.height / 2) / H), box: { x: f(r.left / W), y: f(r.top / H), w: f(r.width / W), h: f(r.height / H) } };
}), items, W, H);
async function shoot(page, name, { clip = null, scale = 1 } = {}) {
  let c = null;
  if (clip) { c = await page.evaluate(s => { const r = document.querySelector(s)?.getBoundingClientRect(); return r && { x: Math.max(0, r.left - 12), y: Math.max(0, r.top - 12), width: r.width + 24, height: r.height + 24 }; }, clip); if (!c) throw new Error(`no ${clip}`); }
  const r = await page.send('Page.captureScreenshot', { format: 'png', ...(c ? { clip: { ...c, scale } } : {}) });
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(r.data, 'base64'));
  if (!c) return `${name}.png`;
  // A close-up keeps its crop of the full frame so its pins can be re-expressed within it.
  const f = n => Math.round(n * 1000) / 1000;
  return { file: `${name}.png`, crop: { x: f(c.x / W), y: f(c.y / H), w: f(c.width / W), h: f(c.height / H) } };
}
/** Pins whose box lies inside a close-up's crop, normalised to the close-up picture itself. */
function closeupPins(shot, pins) {
  const { crop } = shot, f = n => Math.round(n * 1000) / 1000, inside = b => b.x >= crop.x - 0.002 && b.y >= crop.y - 0.002 && b.x + b.w <= crop.x + crop.w + 0.002 && b.y + b.h <= crop.y + crop.h + 0.002;
  const at = (v, o, s) => f(Math.min(1, Math.max(0, (v - o) / s)));
  return { ...shot, pins: pins.filter(p => p.box && inside(p.box)).map(p => ({ ...p, x: at(p.x, crop.x, crop.w), y: at(p.y, crop.y, crop.h),
    box: { x: at(p.box.x, crop.x, crop.w), y: at(p.box.y, crop.y, crop.h), w: f(p.box.w / crop.w), h: f(p.box.h / crop.h) } })) };
}

const STATES = {
  async home(page) {
    await open(page, '#/films');
    await until(page, () => !!document.getElementById('nf-idea'));
    await page.evaluate(() => {
      const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
      set('nf-idea', 'A 75-second product demo of ClearFrame, made with ClearFrame: describe a film, choose how to collaborate, refine a precise part, review sound and costs, then export.');
      set('nf-title', 'ClearFrame, made with ClearFrame');
      document.querySelector('input[name="nf-mode"][value="oneshot"]').checked = true;
      window.scrollTo(0, 0);
    });
    const pins = await measure(page, [['Describe the film', '#nf-idea', 'An idea, or a report, script or notes'], ['Choose how to collaborate', '.home-mode', 'Make it for me, or Build it together'], ['Add sources and pictures', '#nf-add', 'Documents for the agent, pictures for the film'], ['Create and start building', '#nf-go', 'A project folder and its own conversation']]);
    return { file: await shoot(page, 'home'), closeups: [await shoot(page, 'home-modes', { clip: '.home-mode', scale: 2 })], pins, focus: pins[1].box };
  },
  async conversation(page) {
    await open(page, `#/film/${DONE}`);
    await until(page, () => !!document.getElementById('st-chat-log'));
    await sleep(2500);
    const pins = await measure(page, [['A persisted conversation', '#st-chat-log', 'Saved with the project; survives restarts'], ['Two ways to direct', '.st-modes', 'Switch at any time'], ['The film’s real state', '.st-progress', 'Rendered, current, Watch'], ['Write the next step', '#st-chat-input', 'Enter sends; queued while it works']]);
    return { file: await shoot(page, 'conversation'), closeups: [await shoot(page, 'conversation-column', { clip: '#st-chat', scale: 2 })], pins, focus: pins[0].box };
  },
  async scope(page) {
    await open(page, `#/film/${TOUR}`);
    await until(page, () => !!document.getElementById('st-chat-log'));
    await click(page, '[data-act="right"][data-tab="inspect"]').catch(() => {});
    await click(page, '[data-scene-row="curve"]'); await sleep(800);
    await click(page, '[data-act="right"][data-tab="inspect"]'); await sleep(500);
    await click(page, '.st-sel-actions [data-act="askScene"]'); await sleep(700);
    await page.evaluate(() => { const t = document.getElementById('st-chat-input'); t.value = 'Make this scene’s headline shorter.'; t.dispatchEvent(new Event('input', { bubbles: true })); });
    await sleep(500);
    const pins = await measure(page, [['Pick a scene', '[data-scene-row="curve"]', 'Or a layer, a range, a moment, a note, a file'], ['Ask about exactly this', '.st-sel-actions [data-act="askScene"]', 'Pins the scope to the message'], ['The scope travels with the message', '.st-compose-scope', 'Edits outside it are refused'], ['Manual controls stay live', '#st-right', 'Every field is one undoable step']]);
    return { file: await shoot(page, 'scope'), closeups: [await shoot(page, 'scope-composer', { clip: '.st-compose', scale: 2 })], pins, focus: pins[2].box };
  },
  async layer(page) {
    await open(page, `#/film/${TOUR}`);
    await until(page, () => !!document.getElementById('st-chat-log'));
    await click(page, '[data-scene-row="curve"]'); await sleep(800);
    await click(page, '[data-act="right"][data-tab="inspect"]'); await sleep(500);
    await click(page, '[data-act="element"][data-element="props.elements.0"]'); await sleep(900);
    const pins = await measure(page, [['One layer selected', '[data-act="askLayer"]', 'Picked on the picture or in the layer list'], ['Its own fields', '#st-right [data-path^="props.elements.0."]', 'Edit text, timing, colour by hand'], ['Or ask the agent about it', '[data-act="askLayer"]', 'Only this element may change']]);
    return { file: await shoot(page, 'layer'), closeups: [await shoot(page, 'layer-inspector', { clip: '#st-right', scale: 2 })], pins, focus: pins[0].box };
  },
  async review(page) {
    await open(page, `#/film/${TOUR}`);
    await until(page, () => !!document.getElementById('st-chat-log'));
    await click(page, '.st-layouts [data-layout="review"]'); await sleep(1500);
    const pins = await measure(page, [['Watch a rendered cut', '#st-monitor', 'Rough cuts and finals are saved revisions'], ['Notes on the picture', '.st-thread', 'Pinned to the moment you watched'], ['Hand a note to the agent', '[data-act="askNote"]', 'Its scene becomes the scope'], ['Undo, redo', '[data-act="undo"]', 'Every agent edit is one step']]);
    return { file: await shoot(page, 'review'), closeups: [await shoot(page, 'review-thread', { clip: '.st-thread', scale: 2 })], pins, focus: pins[1].box };
  },
  async sound(page) {
    await open(page, `#/film/${TOUR}`);
    await until(page, () => !!document.getElementById('st-chat-log'));
    await click(page, '[data-act="right"][data-tab="sound"]');
    await until(page, () => !!document.querySelector('[data-act="soundPaid"][data-kind="voice"]'));
    const pins = await measure(page, [['Free drafts or Google', '.st-sound-head', 'Draft audio costs nothing'], ['Voice and delivery', '[data-path="voice.voice"]', 'Gemini TTS voices'], ['Takes and players', '.st-takes', 'Only changed takes regenerate'], ['Music direction', '[data-path="music.prompt"]', 'Lyria, shaped to the edit']]);
    const file = await shoot(page, 'sound'), closeups = [await shoot(page, 'sound-panel', { clip: '#st-right', scale: 2 })];
    await click(page, '[data-act="soundPaid"][data-kind="voice"]');
    await until(page, () => !!document.getElementById('pay-by'));
    const dialog = await measure(page, [['Exactly what will be generated', '.st-dialog p', 'Bound to these words, voice and model'], ['Your name', '#pay-by', 'Recorded with the approval'], ['An explicit approval', '.st-dialog .st-check', 'Up to an amount; the film budget caps it']]);
    closeups.push(await shoot(page, 'sound-approval', { clip: '.st-dialog', scale: 2 }));
    const approval = await shoot(page, 'sound-approval-full');
    await click(page, '.st-dialog [data-act="close"]'); // cancelled: nothing is generated or charged
    return { file, closeups, pins, focus: pins[2].box, extra: { file: approval, pins: dialog } };
  },
  async deliver(page) {
    await open(page, `#/film/${DONE}`);
    await until(page, () => !!document.getElementById('st-chat-log'));
    await click(page, '.st-layouts [data-layout="deliver"]'); await sleep(1500);
    const pins = await measure(page, [['Readiness at a glance', '#st-right .st-sec', 'Checks, timing, placeholders, acceptance'], ['The rendered film', '#st-monitor', 'Final at full size'], ['Download', '#st-monitor [download], #st-monitor a[href$=".mp4"], [data-act="final"]', 'The MP4 from the saved revision']]);
    return { file: await shoot(page, 'deliver'), closeups: [await shoot(page, 'deliver-panel', { clip: '#st-right', scale: 2 })], pins, focus: pins[0].box };
  },
};

const c = await launch(o.cdp);
const page = await tab(c.base);
await page.send('Page.enable');
await page.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
const manifest = { capturedAt: new Date().toISOString(), studio: STUDIO, viewport: { width: W, height: H }, tour: TOUR, done: DONE, captures: {} };
try {
  for (const [name, run] of Object.entries(STATES)) {
    if (only && !only.has(name)) continue;
    process.stdout.write(`${name}… `);
    const shot = await run(page), pins = [...shot.pins, ...(shot.extra?.pins ?? [])];
    manifest.captures[name] = { ...shot, closeups: shot.closeups.map(x => closeupPins(x, pins)) };
    console.log('ok');
  }
} finally { await page.close(); c.stop(); }
const prior = fs.existsSync(path.join(OUT, 'captures.json')) ? JSON.parse(fs.readFileSync(path.join(OUT, 'captures.json'), 'utf8')) : null;
if (prior && only) manifest.captures = { ...prior.captures, ...manifest.captures };
fs.writeFileSync(path.join(OUT, 'captures.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`${Object.keys(manifest.captures).length} states → ${path.relative(process.cwd(), OUT)}/captures.json`);
