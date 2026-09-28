import test, { before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { launch } from '../engine/lib/browser.mjs';
import { serve } from '../engine/lib/server.mjs';

let browser, server, page, dir;
before(async () => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-runtime-'));
  fs.writeFileSync(path.join(dir, 'index.html'), `<!doctype html><style>
    :root { --u: 1; --ink: #222; --ink-2: #555; --dim: #888; --accent: #d65; }
    * { box-sizing: border-box; } body { margin: 0; font: 30px Arial; }
  </style><script src="/_cf/vendor/gsap/gsap.min.js"></script>
  <script>window.framesToPaint=[]; window.CF={tl:gsap.timeline({paused:true}),
    onFrame:fn=>framesToPaint.push(fn), time:t=>t};
    window.seek=t=>{CF.tl.seek(t);framesToPaint.forEach(fn=>fn(t,Math.round(t*30)));};
  </script><script src="/_cf/cf-kit.js"></script><script src="/_cf/cf-kit-plus.js"></script>`);
  server = await serve(dir);
  browser = await launch();
  page = await browser.newPage();
  await page.setViewport({ width: 1920, height: 1080 });
});
after(async () => {
  await browser?.close();
  await server?.close();
  if (dir) fs.rmSync(dir, { recursive: true, force: true });
});
beforeEach(async () => { await page.goto(server.url); });

const close = (a, b, label) => assert.ok(Math.abs(a - b) < 1, `${label}: ${a} vs ${b}`);

for (const [orientation, width] of [['horizontal', 1600], ['horizontal', 720], ['vertical', 640]]) {
  test(`bars share a baseline and scale: ${orientation}, ${width}px`, async () => {
    const rows = await page.evaluate(({ orientation, width }) => {
      const host = document.createElement('div');
      Object.assign(host.style, { width: `${width}px`, height: '500px' });
      document.body.append(host);
      const chart = CF.kit.bars(host, { orientation, max: 1000, data: [
        { label: 'A', value: 100 }, { label: 'A considerably longer category label', value: 1000 },
        { label: 'Medium label', value: 500 },
      ] });
      chart.grow(0.5);
      seek(4);
      return chart.bars.map(({ bar, label }) => {
        const r = bar.getBoundingClientRect(), l = label.getBoundingClientRect();
        return { x: r.x, bottom: r.bottom, width: r.width, height: r.height, labelTop: l.top };
      });
    }, { orientation, width });
    for (const r of rows) close(orientation === 'vertical' ? r.bottom : r.x, orientation === 'vertical' ? rows[0].bottom : rows[0].x, 'baseline');
    const dimension = orientation === 'vertical' ? 'height' : 'width';
    close(rows[0][dimension] * 10, rows[1][dimension], '100:1000 scale');
    close(rows[2][dimension] * 2, rows[1][dimension], '500:1000 scale');
  });
}

test('stat and KPI counters keep long suffixes through forward and backward seeks', async () => {
  const samples = await page.evaluate(async () => {
    const samples = [];
    for (const name of ['stat', 'kpis']) {
      const mod = await import(`/_cf/blocks/${name}.js`);
      const props = { ...mod.meta.defaults, style: 'counter', value: 4.2, suffix: ' days',
        items: [{ value: 4.2, suffix: ' days', say: 1 }] };
      const el = document.createElement('section');
      el.innerHTML = mod.html(props, { format: 'landscape' });
      document.body.append(el);
      const b = { start: 0, end: 5, at: n => n * 5 };
      mod.default({ el, b, props, kit: CF.kit, sound() {}, cue: () => 1 });
      for (const t of [0, 1.4, 3, 1.4, 0, 3]) {
        seek(t);
        const n = el.querySelector(name === 'stat' ? '.n' : '.v');
        samples.push({ name, t, text: n.textContent, suffixes: n.querySelectorAll('.sfx').length });
      }
    }
    return samples;
  });
  for (const s of samples) {
    assert.match(s.text, / days$/, `${s.name} at ${s.t}: ${s.text}`);
    assert.equal(s.suffixes, 1);
    if (s.t === 3) assert.equal(s.text, '4.2 days');
  }
});

test('bars block forwards configurable focus opacity including zero', async () => {
  const values = await page.evaluate(async () => {
    const mod = await import('/_cf/blocks/bars.js');
    const calls = [];
    for (const dim of [0, 0.65, 1]) {
      const props = { ...mod.meta.defaults, data: [{ label: 'A', value: 1 }], focus: { index: 0, dim } };
      const el = document.createElement('section'); el.innerHTML = mod.html(props);
      const kit = { ...CF.kit, bars: () => ({ grow() {}, focus: (...args) => calls.push(args) }) };
      mod.default({ el, props, kit, b: { start: 0, end: 5, at: () => 0 }, cue: () => 1, sound() {} });
    }
    return calls.map(c => c[2]?.dim);
  });
  assert.deepEqual(values, [0, 0.65, 1]);
});

test('bar focus can move, restores the selected bar, and is repeatable when seeking backward', async () => {
  const result = await page.evaluate(() => {
    const host = document.createElement('div');
    Object.assign(host.style, { width: '1600px', height: '500px' }); document.body.append(host);
    const chart = CF.kit.bars(host, { data: [{ label: 'A', value: 1 }, { label: 'B', value: 2 }] });
    chart.grow(0.1).focus(0, 2, { dim: 0.65 }).focus(1, 4, { dim: 0 });
    const samples = [3, 5, 3, 0, 5].map(t => {
      seek(t);
      return { t, bars: chart.bars.map(r => ({ opacity: +getComputedStyle(r.bar).opacity, color: getComputedStyle(r.bar).backgroundColor })) };
    });
    const errors = [];
    for (const [i, dim] of [[-1, 0.5], [2, 0.5], [0, -0.1], [0, 1.1]]) {
      try { chart.focus(i, 1, { dim }); } catch (e) { errors.push(e.message); }
    }
    return { samples, errors };
  });
  const { samples } = result;
  assert.deepEqual(samples[0].bars.map(b => b.opacity), [1, 0.65]);
  assert.deepEqual(samples[1].bars.map(b => b.opacity), [0, 1]);
  assert.deepEqual(samples[0].bars, samples[2].bars);
  assert.deepEqual(samples[1].bars, samples[4].bars);
  assert.equal(samples[1].bars[0].color, 'rgb(85, 85, 85)');
  assert.equal(samples[1].bars[1].color, 'rgb(221, 102, 85)');
  assert.equal(result.errors.length, 4);
});

test('all-zero bars have zero size; invalid data and an undersized max fail clearly', async () => {
  const result = await page.evaluate(() => {
    const sizes = [], errors = [];
    for (const orientation of ['horizontal', 'vertical']) {
      const host = document.createElement('div');
      Object.assign(host.style, { width: '1600px', height: '500px' }); document.body.append(host);
      const bars = CF.kit.bars(host, { orientation, data: [{ label: 'None', value: 0 }] });
      const r = bars.bars[0].bar.getBoundingClientRect(); sizes.push(orientation === 'vertical' ? r.height : r.width);
    }
    for (const opts of [{ data: [] }, { data: [{ value: -1 }] }, { data: [{ value: NaN }] },
      { data: [{ value: Infinity }] }, { data: [{ value: 2 }], max: 1 }, { data: [{ value: 0 }], max: 0 }]) {
      try { CF.kit.bars(document.createElement('div'), opts); } catch (e) { errors.push(e.message); }
    }
    return { sizes, errors };
  });
  assert.deepEqual(result.sizes, [0, 0]); assert.equal(result.errors.length, 6);
});
