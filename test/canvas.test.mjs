// Canvas elements, beat layers (art, plate, camera, tone), film texture and graphic transitions.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { normalizeProps, THEMES } from '../film/catalog.mjs';
import { normalizeElements, scheduleElements, reframeView, elementsExtent } from '../film/canvas.mjs';
import { createJob, COVER } from '../film/production.mjs';
import { storyboardFor } from '../film/playbooks.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

function project(t, sb) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-canvas-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeJSON(path.join(dir, 'storyboard.json'), sb);
  return dir;
}
const fail = m => {
  throw new Error(m);
};
const job = (t, sb) => {
  const root = project(t, sb);
  return createJob(loadStoryboard(root), computeTiming(root), { draft: true });
};
const base = () => {
  const sb = storyboardFor('concept-explainer');
  sb.beats = [];
  return sb;
};

test('canvas elements reject unknown types, fields, colors, effects and malformed paths with their location', () => {
  const ok = normalizeElements([{ type: 'circle', cx: 1, cy: 2, r: 3, fill: 'accent' }], 'elements', fail);
  assert.equal(ok[0].fill, 'accent');
  for (const [bad, message] of [
    [{ type: 'blob' }, /type must be one of/],
    [{ type: 'rect', w: 1, h: 1, colour: 'red' }, /unsupported rect field colour/],
    [{ type: 'rect', w: 1, h: 1, fill: 'red' }, /palette token/],
    [{ type: 'rect', w: 1, h: 1, enter: 'explode' }, /enter must be one of/],
    [{ type: 'path', d: 'M 0 0 <script>' }, /plain SVG path data/],
    [{ type: 'path', d: 'L 0 0' }, /starting with M/],
    [{ type: 'icon', name: '../evil.svg' }, /unknown icon/],
    [{ type: 'circle', r: 5, loop: { type: 'dash' } }, /dash loop needs a dash pattern/],
    [{ type: 'rect', w: 1, h: 1, keys: [{ x: 4 }] }, /needs at \(seconds\) or say/],
    [{ type: 'text', text: 'Hi', enter: 'type', count: { to: 'many' } }, /count needs a numeric to/],
    [{ type: 'circle', r: 3, enter: 'type' }, /enter "type" is for text/],
    [{ type: 'rect', w: 1, h: 1, tilt: [10] }, /tilt must be \[x, y\]/],
    [{ type: 'text', text: 'PRO', material: 'plasma' }, /material must be one of/],
    [{ type: 'text', text: 'PRO', material: { map: ['accent'] } }, /map must be a preset name or 2–8 colours/],
  ])
    assert.throws(() => normalizeElements([bad], 'elements', fail), message, JSON.stringify(bad));
  assert.throws(
    () =>
      normalizeElements(
        Array.from({ length: 601 }, () => ({ type: 'circle', r: 1 })),
        'elements',
        fail,
      ),
    /at most 600/,
  );
  const nested = normalizeElements(
    [
      {
        type: 'group',
        children: [
          {
            type: 'group',
            children: [{ type: 'rect', w: 1, h: 1, fill: { gradient: ['accent', '#112233'], angle: 30 } }],
          },
        ],
      },
    ],
    'elements',
    fail,
  );
  assert.equal(nested[0].children[0].children[0].fill.gradient[1], '#112233');
  // A plane turned in space, rocking; type painted by a material.
  const turned = normalizeElements(
    [
      {
        type: 'group',
        tilt: [12, -20],
        loop: { type: 'rock', amount: 6 },
        keys: [{ at: 0, tiltY: 70, dur: 0 }],
        children: [{ type: 'text', text: 'PRO', material: { map: 'chrome', flow: 40, grain: 0.1 } }],
      },
    ],
    'elements',
    fail,
  );
  assert.deepEqual(turned[0].tilt, [12, -20]);
  assert.equal(turned[0].children[0].material.map, 'chrome');
});

test('canvas scheduling resolves spoken cues, staggers groups and reports when everything has settled', () => {
  const words = { 'the river': 1.5, then: 2.25 };
  const list = normalizeElements(
    [
      { type: 'path', d: 'M 0 0 L 100 0', say: 'the river' },
      {
        type: 'group',
        at: 0.5,
        stagger: 0.2,
        children: [
          { type: 'circle', r: 5 },
          { type: 'circle', r: 5 },
        ],
      },
      { type: 'text', text: 'Counted', count: { to: 42, dur: 2 }, at: 0.3 },
      { type: 'circle', r: 5, at: 0.1, keys: [{ say: 'then', x: 40, dur: 0.5 }], exitSay: 'then' },
    ],
    'elements',
    fail,
  );
  const settle = scheduleElements(list, {
    start: 0.2,
    entrance: 0.55,
    resolve: v => (typeof v === 'number' ? v : words[v]),
  });
  assert.equal(list[0].at, 1.5);
  assert.equal(list[0].dur, 1.2, 'draw-on default');
  assert.deepEqual(
    list[1].children.map(c => c.at),
    [0.5, 0.7],
  );
  assert.equal(list[3].keys[0].at, 2.25);
  assert.equal(list[3].exitAt, 2.25);
  assert.equal(list[3].exit, 'fade');
  assert.equal(settle, Math.max(1.5 + 1.2, 0.3 + 2, 2.25 + 0.55));
  assert.ok(!('say' in list[0]) && !('exitSay' in list[3]), 'cues are replaced by resolved seconds');
});

test('canvas beats count as figures only when they count, and late cues fail', t => {
  const sb = base();
  sb.beats = [
    {
      id: 'c',
      block: 'canvas',
      duration: 3,
      props: { elements: [{ type: 'text', text: 'Revenue', count: { to: 12 } }] },
    },
  ];
  assert.match(job(t, sb).errors.join(), /source/);
  sb.beats[0].props.source = 'Illustrative';
  assert.deepEqual(job(t, sb).errors, []);
  sb.beats[0].props.elements.push({ type: 'circle', r: 4, at: 3.5 });
  assert.match(job(t, sb).errors.join(), /after the beat ends/);
  sb.beats = [{ id: 'c', block: 'canvas', duration: 3, props: { elements: [{ type: 'text', text: 'Step 1' }] } }];
  const r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.match(r.warnings.join(), /digits/);
  assert.throws(
    () => normalizeProps('canvas', { elements: [{ type: 'circle', r: 1 }], support: 'x' }),
    /add a text element/,
  );
  assert.throws(() => normalizeProps('canvas', { elements: [] }), /at least one/);
});

test('beat layers validate art, camera, tone and plate, and pass them to the renderer', t => {
  const sb = base();
  sb.beats = [
    {
      id: 's',
      block: 'statement',
      duration: 3,
      tone: 'accent',
      camera: 'out',
      art: { over: [{ type: 'line', x1: 0, y1: 0, x2: 100, y2: 0, at: 0.2 }] },
      props: { text: 'Hello' },
    },
  ];
  let r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.equal(r.job.beats[0].tone, 'accent');
  assert.deepEqual(r.job.beats[0].camera, { move: 'out' });
  assert.equal(r.job.beats[0].art.over[0].dur, 1.2);
  for (const [field, value, message] of [
    ['tone', 'neon', /tone must be/],
    ['camera', { move: 'spin' }, /camera must be/],
    ['art', { behind: [] }, /art must be/],
    ['plate', { file: 'a.jpg', side: 'diagonal' }, /plate.side/],
    ['plate', { side: 'left' }, /asset or file/],
    ['plate', { file: 'a.jpg', treatment: 'sepia' }, /plate.treatment/],
    ['plate', { file: 'a.jpg', focus: [2, 0] }, /focus/],
    ['plate', { file: 'clip.mp4', loop: true }, /without looping/],
    ['plate', { file: 'clip.mp4', loop: 'false' }, /boolean/],
  ]) {
    const copy = structuredClone(sb);
    copy.beats[0][field] = value;
    assert.match(job(t, copy).errors.join(), message, field);
  }
  const copy = structuredClone(sb);
  copy.beats[0].block = 'image';
  copy.beats[0].props = { file: 'x.png' };
  copy.beats[0].plate = { file: 'a.jpg', side: 'left' };
  assert.match(job(t, copy).errors.join(), /already show media/);
});

test('film texture accepts presets or amounts and rejects anything else', t => {
  const sb = base();
  sb.beats = [{ id: 's', block: 'statement', duration: 2, props: { text: 'Hi' } }];
  for (const texture of ['film', 'grain', { grain: 0.4, vignette: 1, animate: true }]) {
    sb.texture = texture;
    const r = job(t, sb);
    assert.deepEqual(r.errors, []);
    assert.deepEqual(r.job.texture, texture);
  }
  sb.texture = 'none';
  assert.equal(job(t, sb).job.texture, undefined);
  for (const texture of ['noise', { grain: 2 }, { sparkle: 1 }]) {
    sb.texture = texture;
    assert.match(job(t, sb).errors.join(), /texture must be/);
  }
});

test('graphic transitions mirror across the cut and fall back to a fade when the outgoing scene has no room', t => {
  const sb = base();
  sb.beats = [
    { id: 'a', block: 'statement', duration: 3, props: { text: 'One' } },
    { id: 'b', block: 'statement', duration: 3, transition: 'iris', props: { text: 'Two' } },
  ];
  let r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.equal(r.job.beats[0].exit, 'iris');
  assert.equal(r.job.beats[1].transition, 'iris');
  // The outgoing beat settles too late for the cover to finish before the cut.
  sb.beats[0].duration = 1.0;
  r = job(t, sb);
  assert.equal(r.job.beats[0].exit, 'fade');
  assert.equal(r.job.beats[1].transition, 'fade');
  assert.match(r.warnings.join(), /no room for the iris transition/);
  assert.deepEqual(Object.keys(COVER).sort(), ['iris', 'panel', 'whip']);
});

test('palettes, kinetic stack mode and centred layouts are part of the contract', () => {
  assert.ok(Object.keys(THEMES).length >= 16);
  const k = normalizeProps('kinetic', { mode: 'stack', emphasis: ['film'] });
  assert.equal(k.align, 'center');
  assert.throws(() => normalizeProps('kinetic', { mode: 'highlight', emphasis: ['x'] }), /stack mode/);
  assert.equal(normalizeProps('stat', { value: 3, label: 'x', align: 'center' }).align, 'center');
  assert.throws(() => normalizeProps('stat', { value: 3, label: 'x', align: 'right' }), /align must be/);
  assert.throws(
    () =>
      normalizeProps('bars', {
        data: [
          { label: 'A', value: 1 },
          { label: 'B', value: 2 },
        ],
        align: 'center',
      }),
    /unsupported prop align/,
  );
});

test('print finishes and mosaic styles validate, apply canvas-wide and reach the renderer', t => {
  const ok = normalizeElements(
    [
      { type: 'rect', w: 10, h: 10, print: 'newsprint' },
      { type: 'circle', r: 4, print: { screen: 'lines', tone: [0.1, 0.7], register: [3, 2], ink: 'accent' } },
      { type: 'text', text: 'WORN', print: { wear: 0.4 } },
      { type: 'rect', w: 10, h: 10, mosaic: { style: 'stitch', tile: 18 } },
    ],
    'elements',
    fail,
  );
  assert.equal(ok[0].print, 'newsprint');
  assert.deepEqual(ok[1].print.register, [3, 2]);
  for (const [bad, message] of [
    [{ type: 'rect', w: 1, h: 1, print: 'woodcut' }, /print must be one of/],
    [{ type: 'rect', w: 1, h: 1, print: { tone: 2 } }, /tone must be 0–1/],
    [{ type: 'rect', w: 1, h: 1, print: { register: [90, 0] } }, /register must be/],
    [{ type: 'text', text: 'x', print: 'benday' }, /takes only wear/],
    [{ type: 'icon', name: 'check', print: 'benday' }, /print works on/],
    [{ type: 'rect', w: 1, h: 1, mosaic: { style: 'glass' } }, /style must be/],
  ])
    assert.throws(() => normalizeElements([bad], 'elements', fail), message);
  // A canvas-level print reaches every shape that has not opted out, but never a backdrop.
  const sb = base();
  sb.beats.push({
    id: 'printed',
    block: 'canvas',
    duration: 2,
    props: {
      print: 'letterpress',
      elements: [
        { type: 'rect', x: 0, y: 0, w: 1920, h: 1080, fill: 'bg' },
        { type: 'circle', cx: 960, cy: 540, r: 200, fill: 'accent' },
        { type: 'rect', x: 100, y: 100, w: 200, h: 200, fill: 'ink', print: false },
      ],
    },
  });
  const r = job(t, sb);
  assert.deepEqual(r.errors, []);
  assert.deepEqual(
    r.job.beats[0].props.elements.map(e => e.print),
    [undefined, 'letterpress', undefined],
  );
});

test('the print library loads: era palettes, treatments, sketches and the style-relay playbook', () => {
  for (const id of ['gallery', 'woodblock', 'newsprint', 'constructivist', 'deco', 'lcd']) assert.ok(THEMES[id], id);
  const sb = storyboardFor('style-relay');
  assert.equal(sb.theme, 'gallery');
  assert.ok(sb.beats.every(b => b.props.world === 'plates'));
});

test('a landscape shot re-framed for a tall cut keeps its words whole, readable and on its subject', () => {
  const tall = 1080 / 1920, inside = (v, el) => {
    const e = elementsExtent([el]);
    return e.left >= v[0] && e.left + e.w <= v[0] + v[2] && e.top >= v[1] && e.bottom <= v[1] + v[3];
  };
  const sliced = (v, el) => {
    const e = elementsExtent([el]);
    return !inside(v, el) && e.left < v[0] + v[2] && e.left + e.w > v[0] && e.top < v[1] + v[3] && e.bottom > v[1];
  };
  const same = [0, 0, 1920, 1080];
  assert.equal(reframeView(same, [], 1920 / 1080), same, 'a matching shape is left alone');
  // The shot lands on the longest bar and its figure; the row labels are cropped off on purpose.
  const label = { type: 'text', text: '90% full', x: 430, y: 1000, size: 38, anchor: 'end' };
  const figure = { type: 'text', text: '9×', x: 1664, y: 1000, size: 64 };
  const chart = [label, { type: 'rect', x: 460, y: 956, w: 1180, h: 56 }, figure, { type: 'rect', x: 460, y: 828, w: 520, h: 56 }];
  const v1 = reframeView([700, 530, 1180, 663.75], chart, tall);
  assert.ok(inside(v1, figure), 'the figure the shot was about stays in the tall frame');
  assert.ok(!sliced(v1, label), 'a word the frame reaches is whole or left out, never sliced');
  // A word from an earlier beat beside the new subject: the frame slides past it.
  const carried = { type: 'group', carried: true, children: [{ type: 'text', text: 'Treatment', x: 2960, y: 520, size: 56, anchor: 'middle' }] };
  const city = [{ type: 'path', d: 'M 3220 760 L 3500 760 L 3500 900 L 4900 900' }, { type: 'rect', x: 3900, y: 600, w: 1120, h: 220 },
    { type: 'text', text: 'Your tap', x: 4400, y: 540, size: 56, anchor: 'middle' }];
  const v2 = reframeView([3300, 0, 1920, 1080], city, tall, [carried]);
  assert.ok(!sliced(v2, carried.children[0]));
  // A pull-back keeps all of its subject, even when its labels end up small (they are reported).
  const whole = [0, 1000, 2000, 3000, 4000].map(x => ({ type: 'text', text: 'STATION', x, y: 400, size: 30 }));
  const v3 = reframeView([-200, -400, 4600, 2587], whole, tall);
  assert.ok(whole.every(el => inside(v3, el)), 'nothing in the subject is cropped to enlarge type');
});

test('a playbook beat can be composed again for a vertical cut, and landscape keeps its own', () => {
  const nine = sb => sb.beats.find(b => b.id === 'nine');
  const wide = storyboardFor('concept-explainer'), tall = storyboardFor('concept-explainer', { vertical: true });
  assert.deepEqual(nine(wide).props.view, [700, 530, 1180, 663.75]);
  assert.equal(nine(wide).tall, undefined, 'the override is not left in the storyboard');
  assert.deepEqual(nine(tall).props.view, [1080, 1920]);
  assert.ok(['50% full', '90% full', '9×'].every(t => nine(tall).props.elements.some(el => el.text === t)), 'row labels and the takeaway both stay');
  assert.equal(nine(tall).props.source, nine(wide).props.source, 'props it does not replace are kept');
});
