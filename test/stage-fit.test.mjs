// Stages and code editors stay inside the frame they are shown in (regressions from a PR film whose
// landscape stage ran off a vertical frame and whose code lines overflowed the editor).
import test from 'node:test';
import assert from 'node:assert/strict';
import { fitCode, codeElement, CODE_MIN_SIZE } from '../scene/code.mjs';
import { compileStage, stageArea, fitStage } from '../scene/recipes.mjs';

const tall = { width: 1080, height: 1920 }, wide = { width: 1920, height: 1080 };
const cols = (el, l) => (l.indent ?? 0) + (l.spans ?? []).map(s => s.text).join('').length;
// The renderer's editor at `size`: 0.9 em padding each side, a three-digit gutter, 0.6 em per character.
const fits = el => el.lines.every(l => el.size * (1.8 + 2.44 + 0.6 * cols(el, l)) <= el.w + 1e-6);

test('a long line shrinks the type to fit, but never below a readable size; past that it wraps', () => {
  const long = 'return Some(((w[0].0 + (w[1].0 - w[0].0) * t, w[0].1 + (w[1].1 - w[0].1) * t), angle));';
  const el = codeElement({ before: 'let a = 1;\n', after: `let a = 1;\n    ${long}\n`, size: 30, x: 140, y: 250, w: 1640 }, { cue: () => 1, where: 't', area: stageArea(tall) });
  const area = stageArea(tall);
  assert.ok(el.x >= area.left && el.x + el.w <= area.right && el.y >= area.top, 'the editor sits inside the stage area, below the heading');
  assert.ok(el.size >= CODE_MIN_SIZE, `type stays readable (${el.size} px)`);
  assert.ok(fits(el), 'every line fits the editor');
  const pieces = el.lines.filter(l => l.id.startsWith(el.lines.find(l => l.number === 2).id));
  assert.ok(pieces.length > 1 && pieces.slice(1).every(p => p.number === 0 && p.indent > 4), 'continuations hang deeper and carry no line number');
  const after = el.steps.at(-1);
  assert.ok(pieces.every(p => after.show.includes(p.id) && after.add.includes(p.id)), 'every piece of the added line appears with it');
  assert.equal(pieces.map(p => p.spans.map(s => s.text).join('')).join('').replace(/\s+/g, ''), long.replace(/\s+/g, ''), 'wrapping loses no characters');
});

test('code that fits is left as authored', () => {
  const el = fitCode({ x: 120, y: 320, w: 1100, size: 26, gutter: true, lines: [{ id: 'a', indent: 0, spans: [{ text: 'let x = 1;', role: 'plain' }] }], steps: [{ at: 0, show: ['a'] }] }, stageArea(wide));
  assert.deepEqual([el.x, el.w, el.size, el.lines.length], [120, 1100, 26, 1]);
});

test('a stage drawn for a wide frame is laid down a tall frame in the same order, inside the area', () => {
  const spec = { actors: [{ id: 'cli', label: 'CLI', x: 420, y: 600 }, { id: 'daemon', label: 'Daemon', x: 960, y: 600 }, { id: 'child', label: 'Child process', x: 1500, y: 600 }],
    links: [{ from: 'cli', to: 'daemon' }, { from: 'daemon', to: 'child' }], events: [{ do: 'callout', actor: 'child', text: 'waits for the child to exit cleanly', side: 'right', at: 1 }] };
  const notes = [];
  const { elements } = compileStage(spec, { cue: v => v ?? 0, end: 6, where: 'flow', frame: tall, notes });
  assert.match(notes[0], /laid down the tall frame/);
  const groups = ['cli', 'daemon', 'child'].map(id => elements.find(e => e.id === id));
  assert.ok(groups[0].y < groups[1].y && groups[1].y < groups[2].y, 'left-to-right becomes top-to-bottom');
  const area = stageArea(tall);
  for (const g of groups) {
    const card = g.children.find(c => c.id.endsWith('.card'));
    assert.ok(g.x + card.x >= area.left - 1 && g.x + card.x + card.w <= area.right + 1 && g.y + card.y >= area.top && g.y + card.y + card.h <= area.bottom, `${g.id} stays inside the area`);
  }
  const callout = elements.find(e => e.type === 'group' && e.attach?.to === 'child'), box = callout.children[0], x = groups[2].x + callout.attach.dx;
  assert.ok(x + box.x >= area.left - 1 && x + box.x + box.w <= area.right + 1, 'the callout box is pulled back inside the frame');
  const already = { actors: [{ id: 'a', x: 540, y: 700 }, { id: 'b', x: 540, y: 1200 }] };
  assert.equal(fitStage(already, tall, area).spec, already, 'a stage authored for the frame is untouched');
});
