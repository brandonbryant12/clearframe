// The creative library: built-in files plus shared and project layers, validated on load.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { items, item, palettes, useProject, libraryDirs } from '../fframes/library.mjs';
import { palette } from '../fframes/catalog.mjs';
import { sketch } from '../fframes/sketches.mjs';
import { normalizeElements } from '../fframes/canvas.mjs';
import { treatmentById } from '../fframes/treatments.mjs';
import { scaffold } from '../fframes/playbooks.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';

const write = (root, rel, value) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), typeof value === 'string' ? value : JSON.stringify(value));
};
const acme = {
  bg: '#0b1f33',
  surface: '#14304d',
  ink: '#f5f7fa',
  muted: '#a9b8c9',
  accent: '#ffb000',
  accent2: '#4fd1c5',
  positive: '#6ee7a8',
  negative: '#ff8a80',
};

test('every built-in kind loads from library/ in order', () => {
  for (const kind of ['palettes', 'treatments', 'sketches', 'playbooks']) assert.ok(items(kind).length >= 8, kind);
  assert.equal(items('palettes')[0].id, 'paper');
  assert.equal(items('sketches')[0].id, 'route');
  assert.equal(item('treatments', 'noir').film.theme, 'noir');
});

test('a project library adds and overrides items by id, JSON only', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-library-'));
  try {
    write(root, 'library/palettes/acme.json', { title: 'Acme', notes: 'House colours.', colors: acme });
    write(root, 'library/palettes/noir.json', { notes: 'Brand noir.', colors: { ...acme, bg: '#000000' } });
    write(root, 'library/treatments/acme.json', { title: 'Acme house', when: 'Brand films.', film: { theme: 'acme' } });
    write(root, 'library/sketches/logo-orbit.json', {
      summary: 'Logo with orbiting marks',
      use: 'brand openers',
      formats: {
        landscape: { elements: [{ id: 'l', type: 'circle' }] },
        vertical: { elements: [{ id: 'v', type: 'circle' }] },
      },
    });
    write(root, 'library/playbooks/acme-launch.json', {
      title: 'Acme launch',
      audience: 'customers',
      inputs: 'one product',
      theme: 'acme',
      beats: [{ block: 'title', props: { title: 'Acme' } }],
    });
    write(root, 'storyboard.json', { theme: 'acme', beats: [{ id: 'a', block: 'title', props: { title: 'Acme' } }] });
    loadStoryboard(root);
    assert.equal(palettes().acme.accent, '#ffb000');
    assert.equal(palette('noir').bg, '#000000', 'the project wins over the built-in');
    assert.equal(palette({ base: 'acme', accent: '#ffffff' }).accent, '#ffffff');
    assert.equal(treatmentById('acme').film.theme, 'acme');
    assert.equal(sketch('logo-orbit', 'vertical').elements[0].id, 'v');
    assert.equal(sketch('logo-orbit', 'landscape').elements[0].id, 'l');
    assert.ok(libraryDirs().at(-1).startsWith(root));
    const made = path.join(root, 'made');
    assert.equal(scaffold(made, { playbook: 'acme-launch', treatment: 'acme' }).theme, 'acme');
    assert.ok(fs.existsSync(path.join(made, 'library/palettes/acme.json')), 'shared palettes travel with the project');
    assert.ok(fs.existsSync(path.join(made, 'library/treatments/acme.json')));

    write(root, 'library/sketches/evil.mjs', 'export default {}');
    useProject(null);
    assert.throws(() => useProject(root), /must be JSON/);
    fs.rmSync(path.join(root, 'library/sketches/evil.mjs'));
    write(root, 'library/palettes/dim.json', { colors: { ...acme, muted: '#1a2a3a' } });
    assert.throws(() => useProject(root), /muted has .* contrast/);
  } finally {
    useProject(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
  assert.equal(palettes().acme, undefined, 'clearing the project drops its items');
  assert.notEqual(palette('noir').bg, '#000000');
});

test('a creative seed is reproducible, varies the look and the set pieces, and briefs the director', async t => {
  const { muse } = await import('../fframes/muse.mjs');
  assert.deepEqual(muse(42), muse(42));
  const draws = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => JSON.stringify([muse(s).palette, muse(s).twist])));
  assert.ok(draws.size >= 6, 'different seeds start somewhere different');
  // The October 2026 set: every frame shape builds and validates as canvas elements.
  for (const name of ['sunburst', 'chat', 'device', 'marquee'])
    for (const preset of ['landscape', 'vertical', 'square', 'portrait']) {
      const els = sketch(name, preset).elements;
      assert.ok(els.length > 0, `${name} ${preset}`);
      normalizeElements(els, `${name}.${preset}`, m => {
        throw new Error(m);
      });
    }
  const a = sketch('skyline', 'landscape', { seed: 1 }).elements,
    b = sketch('skyline', 'landscape', { seed: 2 }).elements;
  assert.notDeepEqual(
    a.map(e => e.h),
    b.map(e => e.h),
    'seeded sketches vary their layout',
  );
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-seed-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sb = scaffold(path.join(dir, 'film'), { playbook: 'trailer', seed: 42 });
  assert.equal(sb.theme, muse(42).palette);
  assert.match(fs.readFileSync(path.join(dir, 'film', 'DIRECTION.md'), 'utf8'), /Creative seed 42/);
});

test('material art is reproducible, palette-driven and valid in all four frame shapes', async () => {
  const { expandArt } = await import('../fframes/sketches.mjs');
  const names = ['lightwell','contour-field','paper-fold','glass-orbits','bubble-cluster','ribbon-wave','petal-burst','inflated-loop','arena-grid','prism-shards'];
  for (const name of names) for (const preset of ['landscape','vertical','square','portrait']) {
    const a = sketch(name, preset, { seed: 17 });
    assert.deepEqual(a, sketch(name, preset, { seed: 17 }), `${name} must be reproducible`);
    normalizeElements(a.elements, `${name}.${preset}`, m => { throw new Error(m); });
    assert.doesNotMatch(JSON.stringify(a.elements), /#[0-9a-f]{6}|"file"|"asset"|"text"/i, 'materials use palette paints, with no raster or baked text');
  }
  const authored = { type: 'circle', r: 8, fill: 'accent2' };
  const input = { sketch: 'glass-orbits', seed: 7, opacity: 0.6, under: [authored], over: [authored] };
  const a = expandArt(input, { width: 1080, height: 1920 });
  assert.equal(a.under[0].opacity, 0.6);
  assert.deepEqual(a.under[0].children, sketch('glass-orbits', 'vertical', { seed: 7 }).elements);
  assert.deepEqual(a.under.at(-1), authored);
  assert.deepEqual(a.over, [authored]);
  assert.equal(input.sketch, 'glass-orbits', 'expansion does not mutate authoring data');
  assert.deepEqual(expandArt({ sketch: 'paper-fold' }, { width: 1280, height: 720 }).under[0].children, item('sketches', 'paper-fold').build(1280, 720).elements, 'custom frame dimensions are respected');
  assert.throws(() => expandArt({ sketch: 'tunnel' }), /not a background layer/);
  assert.throws(() => expandArt({ sketch: 'missing' }), /Unknown sketch/);
  assert.throws(() => expandArt({ sketch: 'paper-fold', opacity: 2 }), /opacity/);
});

test('material seeds vary the layout without pushing the art into the copy region', async () => {
  const { elementsExtent } = await import('../fframes/canvas.mjs');
  const names = ['lightwell','contour-field','paper-fold','glass-orbits','bubble-cluster','ribbon-wave','petal-burst','inflated-loop','arena-grid','prism-shards'];
  // The subject only: soft washes, floor lines, dust and full-bleed planes are atmosphere.
  const subject = els => els.filter(e => !e.fill?.fade && !['line', 'particles'].includes(e.type) && !(e.points ?? []).some(p => p[1] > 2000));
  for (const name of names) {
    assert.notDeepEqual(sketch(name, 'landscape', { seed: 3 }), sketch(name, 'landscape', { seed: 8 }), `${name}: the seed varies the layout`);
    for (const [preset, w, h] of [['landscape', 1920, 1080], ['vertical', 1080, 1920], ['square', 1080, 1080], ['portrait', 1080, 1350]]) {
      const edge = seed => {
        const e = elementsExtent(subject(sketch(name, preset, { seed }).elements));
        return h > w * 1.1 ? e.top : e.left;
      };
      const reference = edge(undefined), side = h > w * 1.1 ? h : w;
      for (let seed = 0; seed < 40; seed++)
        assert.ok(reference - edge(seed) < side * 0.035, `${name} ${preset} seed ${seed} reaches into the copy region`);
    }
  }
});

test('art drift pushes the sketch in over the beat from frame-based keys and never holds the beat', async () => {
  const { expandArt } = await import('../fframes/sketches.mjs');
  const still = expandArt({ sketch: 'prism-shards', seed: 4 }, { width: 1920, height: 1080, duration: 6 }).under[0];
  assert.equal(still.keys, undefined, 'no drift unless asked');
  const [left, right] = [3, 4].map(seed => expandArt({ sketch: 'prism-shards', seed, drift: 1 }, { width: 1920, height: 1080, duration: 6 }).under[0]);
  assert.deepEqual(right.origin, [960, 540]);
  assert.equal(right.keys[0].at, 0);
  assert.equal(right.keys[0].dur, 6, 'the push spans the beat');
  assert.ok(right.keys[0].scale > 1 && right.keys[0].hold === false);
  assert.equal(Math.sign(left.keys[0].x), -Math.sign(right.keys[0].x), 'the seed chooses the direction of travel');
  assert.throws(() => expandArt({ sketch: 'prism-shards', drift: 2 }), /drift/);
});
