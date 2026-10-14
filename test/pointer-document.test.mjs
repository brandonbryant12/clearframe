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

test('a receipt is drawn from its lines, refuses a total they do not add up to, and names its parts', () => {
  const receipt = { type: 'receipt', id: 'lunch', x: 600, y: 100, merchant: 'Harbor Grill', items: [{ qty: 2, name: 'Crab cakes', price: 32 }, { qty: 1, name: 'Iced tea', price: 4.5 }], tax: 3.06, marks: [{ words: 'Crab cakes', style: 'highlight', say: 'itemised' }] };
  const list = normalizeElements([receipt, { type: 'pointer', to: 'lunch-total', say: 'total' }], 'elements', fail);
  const [group] = list;
  assert.equal(group.type, 'group');
  const texts = [];
  const walk = l => l.forEach(el => (el.type === 'text' ? texts.push(el) : el.children && walk(el.children)));
  walk(group.children);
  assert.ok(texts.some(t => t.text === '$39.56'), 'the total is the sum of the lines');
  assert.equal(texts.find(t => t.text === 'Crab cakes').marks[0].say, 'itemised', 'a mark goes to the line that prints its words');
  expandPointers(list, { width: 1920, height: 1080 });
  assert.ok(group.children.some(c => c.id === 'lunch-total' && c.keys?.length), 'a pointer finds the total by id and presses it');
  assert.throws(() => normalizeElements([{ ...receipt, total: 40 }], 'elements', fail), /add up to \$39\.56/);
  assert.throws(() => normalizeElements([{ ...receipt, marks: [{ words: 'Lobster' }] }], 'elements', fail), /not printed on the receipt/);
  assert.throws(() => normalizeElements([{ type: 'receipt', merchant: 'Harbor Grill', slip: true, items: receipt.items, total: 1 }], 'elements', fail), /card slip prints no items/);
});

test('an app screen names its parts for the pointer, opens on its word and turns its button into the confirmation', () => {
  const app = { type: 'app', id: 'hub', title: 'Kestrel Hub', tabs: ['Benefits', 'Claims'], heading: 'New claim', open: { say: 'Claims' }, upload: { label: 'Add receipt', receipt: { merchant: 'Clearview Optical', items: [{ name: 'Frames', price: 160 }] }, say: 'receipt' }, fields: [{ label: 'Amount', value: '$160.00', say: 'receipt', after: 0.7 }], button: { label: 'Submit', done: 'Claim sent', say: 'Submit' } };
  const list = normalizeElements([app, { type: 'pointer', steps: [{ to: 'hub-tab-claims', say: 'Claims' }, { to: 'hub-upload', say: 'receipt' }, { to: 'hub-button', say: 'Submit' }] }], 'elements', fail);
  const ids = new Map();
  const walk = l => l.forEach(el => (el.id && ids.set(el.id, el), el.children && walk(el.children)));
  walk(list);
  for (const id of ['hub-tab-benefits', 'hub-tab-claims', 'hub-upload', 'hub-field-amount', 'hub-button', 'hub-done', 'hub-photo']) assert.ok(ids.has(id), id);
  assert.equal(ids.get('hub-button').exitSay, 'Submit', 'the button gives way on its word');
  assert.equal(ids.get('hub-done').say, 'Submit', 'and the confirmation takes its place');
  assert.ok(JSON.stringify(ids.get('hub-photo')).includes('"type":"rect"') && !JSON.stringify(ids.get('hub-photo')).includes('Frames'), 'the photo is too small to read, so its lines are bars');
  expandPointers(list, { width: 1920, height: 1080 });
  assert.throws(() => normalizeElements([{ ...app, fields: [{ label: 'Amount', value: 'x'.repeat(30) }] }], 'elements', fail), /up to 24 characters/);
  assert.throws(() => normalizeElements([{ ...app, button: { label: 'Submit', done: 'Sent' } }], 'elements', fail), /needs say/);
});
