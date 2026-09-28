// The block library and recipes stay complete, valid and renderable.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listBlocks, searchIcons, writeGallery } from '../engine/lib/catalog.mjs';
import { check } from '../engine/lib/inspect.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { blockTail } from '../engine/lib/timing.mjs';
import { require } from '../engine/lib/util.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = path.join(path.dirname(require.resolve('lucide-static/package.json')), 'icons');
const iconsIn = (obj) => JSON.stringify(obj).match(/"icon":"([a-z0-9-]+)"/g)?.map((m) => m.slice(8, -1)) ?? [];

test('every block has complete meta and a working example', async () => {
  const blocks = await listBlocks();
  assert.ok(blocks.length >= 30, `only ${blocks.length} blocks`);
  for (const b of blocks) {
    assert.ok(b.summary && b.use, `${b.name}: summary/use`);
    assert.ok(b.props && Object.keys(b.props).length, `${b.name}: props`);
    assert.ok(b.example?.props, `${b.name}: example.props`);
    assert.ok(typeof b.tail === 'number' && blockTail(b.name) === b.tail, `${b.name}: tail readable by timing`);
    for (const icon of iconsIn(b.example)) assert.ok(fs.existsSync(path.join(iconDir, `${icon}.svg`)), `${b.name}: unknown icon ${icon}`);
  }
});

test('every recipe validates and references real blocks and icons', async () => {
  const names = new Set((await listBlocks()).map((b) => b.name));
  const dir = path.join(ROOT, 'recipes');
  const recipes = fs.readdirSync(dir).filter((f) => fs.existsSync(path.join(dir, f, 'storyboard.json')));
  assert.ok(recipes.length >= 5);
  for (const r of recipes) {
    const sb = loadStoryboard(path.join(dir, r));
    for (const beat of sb.beats) if (beat.block) assert.ok(names.has(beat.block), `${r}/${beat.id}: unknown block ${beat.block}`);
    for (const icon of iconsIn(sb)) assert.ok(fs.existsSync(path.join(iconDir, `${icon}.svg`)), `${r}: unknown icon ${icon}`);
  }
});

test('icon search finds sensible names', () => {
  assert.ok(searchIcons('shield').some((i) => i.name === 'shield-check'));
});

for (const format of ['landscape', 'vertical']) {
  test(`blocks render cleanly in ${format} (QA check: no errors)`, { timeout: 240_000 }, async () => {
    const dir = path.join(ROOT, 'build', `test-gallery-${format}`);
    fs.rmSync(dir, { recursive: true, force: true });
    await writeGallery(dir, { format, only: ['stat', 'bars', 'flow', 'chat', 'timeline', 'code', 'compare', 'waffle'] });
    const r = await check(dir);
    assert.deepEqual(r.errors, [], r.errors.join('\n'));
    const overruns = r.warnings.filter((w) => /past the beat|cut off|overflows/.test(w));
    assert.deepEqual(overruns, []);
    fs.rmSync(dir, { recursive: true, force: true });
  });
}
