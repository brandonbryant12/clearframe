// The scene engine's JavaScript side: engine choice, command mapping, stage recipes, commit-
// grounded code and the plan the engine reads. Rendering itself is covered by the Rust tests
// (scene/native) and by scripts/engine-parity.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { engineFor, sceneArgs } from '../scene/engine.mjs';
import { compileStage } from '../scene/recipes.mjs';
import { codeElement, diffLines, highlight, gitSides } from '../scene/code.mjs';
import { prepareProjectSync } from '../fframes/prepare.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

const frame = { width: 1920, height: 1080 };
const stage = (spec, end = 6) => compileStage(spec, { cue: v => (typeof v === 'number' ? v : 1), end, where: 'b', frame });

test('the scene engine is the default; fframes stays selectable and nothing else is', t => {
  const saved = process.env.CLEARFRAME_ENGINE;
  t.after(() => (saved == null ? delete process.env.CLEARFRAME_ENGINE : (process.env.CLEARFRAME_ENGINE = saved)));
  delete process.env.CLEARFRAME_ENGINE;
  assert.equal(engineFor({}), 'scene');
  assert.equal(engineFor({ engine: 'fframes' }), 'fframes');
  process.env.CLEARFRAME_ENGINE = 'scene';
  assert.equal(engineFor({ engine: 'fframes' }), 'scene', 'the environment wins');
  process.env.CLEARFRAME_ENGINE = 'browser';
  assert.throws(() => engineFor({}), /scene or fframes/);
});

test('FFFrames command words map onto the scene engine with draft and scale as globals', () => {
  assert.deepEqual(sceneArgs('p.json', 'render', ['10..20', '--draft', '--scale', '1', '-o', 'raw.mp4']), [
    '--plan', 'p.json', '--draft', '--scale', '1', 'render', '10..20', '-o', 'raw.mp4',
  ]);
  assert.deepEqual(sceneArgs('p.json', '--audit', ['a.json']), ['--plan', 'p.json', 'audit', 'a.json']);
  assert.deepEqual(sceneArgs('p.json', 'frame', ['1.5s,3s', '-o', 'dir']), ['--plan', 'p.json', 'frame', '1.5s,3s', '-o', 'dir']);
});

test('actors, links and events compile to elements with stable identities and ordered keys', () => {
  const { elements, camera } = stage({
    actors: [
      { id: 'cli', label: 'CLI', kind: 'client', x: 400, y: 500 },
      { id: 'daemon', label: 'Daemon', x: 1400, y: 500 },
    ],
    links: [{ from: 'cli', to: 'daemon', label: 'stop' }],
    events: [
      { do: 'state', actor: 'daemon', status: 'error', at: 3 },
      { do: 'send', from: 'daemon', to: 'cli', at: 1.2, label: 'ack', burst: true },
      { do: 'callout', actor: 'daemon', text: 'waits for exit', at: 2, untilSay: 'x' },
      { do: 'camera', follow: 'daemon', zoom: 1.2, at: 4 },
    ],
  });
  const ids = elements.map(e => e.id);
  for (const id of ['cli', 'daemon', 'cli-daemon', 'cli-daemon.label', 'send-2', 'send-2.label', 'send-2.burst', 'callout-3', 'callout-3.leader'])
    assert.ok(ids.includes(id), `missing ${id}`);
  const packet = elements.find(e => e.id === 'send-2');
  assert.deepEqual([packet.along.path, packet.along.from, packet.along.to], ['cli-daemon', 1, 0], 'a reply travels the link backwards');
  assert.equal(packet.exitAt, 1.2 + 1.0);
  assert.ok(ids.indexOf('callout-3') < ids.indexOf('callout-3.leader'), 'a leader follows its callout');
  const card = elements.find(e => e.id === 'daemon').children.find(c => c.id === 'daemon.card');
  assert.deepEqual(card.keys.map(k => k.stroke), ['negative']);
  const daemon = elements.find(e => e.id === 'daemon');
  assert.deepEqual(daemon.keys.map(k => k.at), [...daemon.keys.map(k => k.at)].sort((a, b) => a - b));
  assert.deepEqual(camera.keys[0], { at: 4, x: 1400, y: 500, zoom: 1.2, dur: 1.4, ease: 'inOut' });
});

test('stage recipes refuse what they cannot honour', () => {
  assert.throws(() => stage({ actors: [{ id: 'a', x: 1, y: 1 }], events: [{ do: 'send', from: 'a', to: 'b', at: 1 }] }), /no actor b/);
  assert.throws(() => stage({ actors: [{ id: 'a', x: 1, y: 1 }, { id: 'b', x: 9, y: 9 }], events: [{ do: 'send', from: 'a', to: 'b', at: 1 }] }), /no link/);
  assert.throws(() => stage({ actors: [{ id: 'a', x: 1, y: 1 }], events: [{ do: 'pulse', actor: 'a', at: 9 }] }), /after the stage ends/);
  assert.throws(() => stage({ events: [{ do: 'explode', at: 1 }] }), /do is send/);
  assert.throws(() => stage({ actors: [{ id: 'a', x: 1, y: 1, kind: 'robot' }] }), /kind is/);
  assert.throws(() => stage({ wobble: true }), /unknown stage key/);
});

test('code edits keep line identity, highlight tokens and refuse unreadable sizes', () => {
  const ops = diffLines(['a', 'b', 'c'], ['a', 'x', 'c']);
  assert.deepEqual(ops.map(o => o.op), ['keep', 'del', 'add', 'keep']);
  assert.deepEqual(highlight('let n = 42; // why').map(s => s.role), ['keyword', 'plain', 'punctuation', 'plain', 'number', 'punctuation', 'plain', 'comment']);
  const el = codeElement({ before: 'fn a() {\n    old();\n}', after: 'fn a() {\n    new();\n    more();\n}', at: 2 }, { cue: v => v, where: 'c' });
  const [first, second] = el.steps;
  assert.equal(first.show.length, 3);
  assert.equal(second.show.length, 4);
  assert.equal(second.add.length, 2);
  assert.equal(second.remove.length, 1);
  assert.equal(second.at, 2);
  assert.ok(first.show.filter(id => second.show.includes(id)).length === 2, 'kept lines keep their ids');
  assert.equal(el.lines.find(l => l.id === second.add[0]).indent, 4);
  const many = Array.from({ length: 50 }, (_, i) => `line ${i}`);
  assert.throws(() => codeElement({ before: many.join('\n'), after: [...many.slice(0, 25), 'changed', ...many.slice(26)].join('\n'), context: 20, h: 400 }, { cue: v => v, where: 'c' }), /readable size/);
});

test('code from git names the exact commit and blobs it shows', () => {
  const repo = path.resolve(import.meta.dirname, '..');
  let sides;
  try {
    sides = gitSides({ repo, commit: '5a2650e', file: 'package.json' });
  } catch {
    return; // a shallow or exported checkout has no history to read
  }
  assert.match(sides.commit, /^5a2650e[0-9a-f]{33}$/);
  assert.match(sides.newBlob, /^[0-9a-f]{40}$/);
  const seen = [];
  const el = codeElement({ commit: '18d26ed', base: '0de5258', file: 'CHANGELOG.md', repo: '.', window: [1, 12] }, { cue: v => v, where: 'c', root: repo, staged: p => seen.push(p) });
  assert.match(el.title, /^CHANGELOG\.md @ 18d26ed/);
  assert.match(seen[0].commit, /^18d26ed/);
  assert.match(seen[0].blobs.after, /^[0-9a-f]{40}$/);
});

test('a stage beat compiles into the plan; its block layer keeps only the heading; fframes refuses it', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-stage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), {
    title: 'Stage', music: false, captions: false,
    sources: [{ id: 's', title: 'Test' }],
    beats: [
      {
        id: 'flow', block: 'stage', duration: 4,
        props: {
          title: 'A request travels', source: 'Test',
          actors: [{ id: 'a', label: 'A', x: 500, y: 600 }, { id: 'b', label: 'B', x: 1400, y: 600 }],
          links: [{ from: 'a', to: 'b' }],
          events: [{ do: 'send', from: 'a', to: 'b', at: 1.5 }],
          shutter: 0.5,
        },
      },
    ],
    stages: [{ id: 'glow', from: 'flow', z: 'over', elements: [{ type: 'particles', kind: 'field', x: 0, y: 0, w: 1920, h: 1080, count: 600 }] }],
  });
  const saved = process.env.CLEARFRAME_ENGINE;
  t.after(() => (saved == null ? delete process.env.CLEARFRAME_ENGINE : (process.env.CLEARFRAME_ENGINE = saved)));
  delete process.env.CLEARFRAME_ENGINE;
  const ctx = prepareProjectSync(dir, { draft: true });
  const plan = JSON.parse(fs.readFileSync(path.join(ctx.dir, 'plan.json'), 'utf8'));
  assert.equal(plan.kind, 'clearframe.scene');
  assert.deepEqual(plan.layers.map(l => [l.id, l.z, l.beat ?? null]), [['flow/stage', 'under', 'flow'], ['stage:glow', 'over', null]]);
  assert.equal(plan.layers[0].samples, 8);
  assert.deepEqual(Object.keys(ctx.job.beats[0].props).sort(), ['source', 'title']);
  assert.ok(ctx.job.beats[0].settle_seconds >= 2.5, 'the packet arrives before the exit may start');
  assert.equal(ctx.manifest.renderer, 'scene');
  assert.match(ctx.manifest.planSha256, /^[0-9a-f]{64}$/);
  process.env.CLEARFRAME_ENGINE = 'fframes';
  assert.throws(() => prepareProjectSync(dir, { draft: true }), /only the scene engine draws them/);
});

test('native stages refuse canvas-only features by name instead of dropping them', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-stage-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), {
    title: 'Stage', music: false,
    beats: [{ id: 'x', block: 'statement', duration: 3, props: { text: 'Hello' }, stage: { elements: [{ type: 'rect', id: 'box', w: 10, h: 10, rough: true }] } }],
  });
  const saved = process.env.CLEARFRAME_ENGINE;
  t.after(() => (saved == null ? delete process.env.CLEARFRAME_ENGINE : (process.env.CLEARFRAME_ENGINE = saved)));
  delete process.env.CLEARFRAME_ENGINE;
  assert.throws(() => prepareProjectSync(dir, { draft: true }), /box uses rough, which the canvas block draws/);
});
