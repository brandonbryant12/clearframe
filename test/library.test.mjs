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
