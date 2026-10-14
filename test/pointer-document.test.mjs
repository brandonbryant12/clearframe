// A pointer that presses elements by id, and a document of real text that scrolls to a section.
import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeElements, scheduleElements } from '../film/canvas.mjs';
import { expandPointers } from '../film/pointer.mjs';

const fail = m => {
  throw new Error(m);
};
const button = { type: 'group', id: 'share', x: 900, y: 700, children: [{ type: 'rect', x: 0, y: 0, w: 320, h: 90, r: 18, fill: 'accent' }] };

test('a pointer travels to its target and presses it on the word, and the target answers', () => {
  const list = normalizeElements([structuredClone(button), { type: 'pointer', to: 'share', say: 'securely' }], 'elements', fail);
  expandPointers(list, { width: 1920, height: 1080 });
  scheduleElements(list, { start: 0, entrance: 0.5, resolve: w => ({ securely: 3 })[w] });
  const [target, cursor] = list;
  assert.equal(cursor.type, 'group');
  const travel = cursor.keys[0];
  assert.ok(travel.at + travel.dur < 3 && travel.at + travel.dur > 2.7, 'it arrives just before the word');
  assert.ok(Math.abs(cursor.x + travel.x - (900 + 320 * 0.66)) < 0.01, 'it rests on the button, right of its label');
  const [ring, arrow] = cursor.children[0].children;
  const press = arrow.keys[0];
  assert.equal(press.at, 3);
  assert.equal(press.sound, 'click');
  assert.ok(ring.keys.some(k => k.at === 3 && k.opacity > 0), 'a ring spreads from the point pressed');
  assert.ok(cursor.keys.at(-1).at > 3 && cursor.keys.at(-1).x > travel.x, 'after the last press it moves off what it pressed');
  assert.ok(target.keys[0].at > 3 && target.keys[0].ease === 'thereAndBack', 'the button dips and comes back');
  assert.ok(cursor.at < travel.at, 'it is on screen before it sets off');
  assert.throws(() => expandPointers([{ type: 'pointer', to: 'nowhere', say: 'x' }]), /no element has id "nowhere"/);
});

test('a pointer visits several steps, and a tall frame gets a fingertip', () => {
  const list = normalizeElements(
    [structuredClone(button), { ...structuredClone(button), id: 'save', x: 300 }, { type: 'pointer', steps: [{ to: 'share', at: 1 }, { to: 'save', at: 2.5, press: false }], sound: false }],
    'elements',
    fail,
  );
  expandPointers(list, { width: 1080, height: 1920 });
  const cursor = list[2];
  assert.equal(cursor.keys.length, 2, 'a last step that only hovers stays where it is');
  const tip = cursor.children[0].children.at(-1);
  assert.equal(tip.type, 'circle', 'a phone is tapped, not clicked');
  assert.equal(tip.keys.length, 1, 'only the pressed step presses');
  assert.equal(tip.keys[0].sound, undefined, 'sound: false is silent');
  assert.equal(list[1].keys, undefined, 'a step that only hovers leaves its target alone');
});

test('a document holds real sections, scrolls to one on its word and marks its words', () => {
  const doc = {
    type: 'document',
    x: 160,
    y: 120,
    w: 1000,
    h: 760,
    title: 'Flexible spending account',
    sections: [
      { heading: 'What it covers', text: 'Medical, dental and vision costs your plan does not pay.' },
      { heading: 'The deadline', text: 'Unused money is forfeited at the end of the plan year.' },
    ],
    scroll: [{ to: 'deadline', say: 'deadline' }],
    marks: [{ words: 'forfeited at the end of the plan year', say: 'forfeited' }],
  };
  const [d] = normalizeElements([doc], 'elements', fail);
  const settle = scheduleElements([d], { start: 0, entrance: 0.5, resolve: w => ({ deadline: 2, forfeited: 3 })[w] });
  assert.equal(d.scroll[0].at, 2);
  assert.equal(d.marks[0].at, 3);
  assert.equal(d.marks[0].style, 'highlight');
  assert.equal(settle, 3 + d.marks[0].dur);
  for (const [bad, message] of [
    [{ ...doc, marks: [{ words: 'not in it' }] }, /whole words of one section/],
    [{ ...doc, scroll: [{ to: 'nowhere', say: 'x' }] }, /section index or words/],
    [{ ...doc, sections: [{ text: '' }] }, /the section's words/],
  ])
    assert.throws(() => normalizeElements([bad], 'elements', fail), message);
});
