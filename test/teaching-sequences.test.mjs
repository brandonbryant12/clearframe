import test from 'node:test';
import assert from 'node:assert/strict';
import { teachingSpec, expandTeachingProps } from '../film/teaching.mjs';
import { normalizeElements } from '../film/canvas.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { scaffold } from '../film/playbooks.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { createJob } from '../film/job.mjs';

const source = 'Arithmetic example';
const choice = { form: 'choice', phase: 'question', prompt: 'What changed from 4% to 5%?', options: ['1 percent', '5 percent', '1 percentage point'], correctIndex: 2, explanation: 'The rates differ by 1 percentage point. The relative increase is 25%.' };
const gap = { form: 'gap', phase: 'question', prompt: 'Complete the statement.', before: 'From 4% to 5% is', answer: '1 percentage point', after: 'higher.', explanation: 'Subtract the two percentages: 5 minus 4 equals 1 percentage point.' };
const frame = { width: 1920, height: 1080, beatId: 'lesson', duration: 6 };

test('question phases keep answers and explanations out of the native display', () => {
  for (const teaching of [choice, gap]) {
    const p = expandTeachingProps({ teaching, source }, frame);
    assert(!p.elements.some(el => /answer|explanation/.test(el.id)));
    assert(p.elements.some(el => el.id.endsWith('teach-reading')));
    assert.equal(p.source, source);
  }
  const first = expandTeachingProps({ teaching: choice, source }, frame);
  const differentAnswer = expandTeachingProps({ teaching: { ...choice, correctIndex: 0 }, source }, frame);
  assert.deepEqual(first, differentAnswer, 'the question picture cannot disclose the correct option');
});

test('answer mapping is explicit and precedes the worked explanation', () => {
  const p = expandTeachingProps({ teaching: { ...choice, phase: 'answer', revealAt: 0.3, explainAt: 1.3 }, source }, frame);
  const label = p.elements.find(el => el.id.endsWith('teach-answer-label'));
  const explanation = p.elements.find(el => el.id.endsWith('teach-explanation'));
  assert.equal(label.text, 'Answer C'); assert.equal(label.at, 0.3);
  assert.equal(explanation.text, choice.explanation); assert.equal(explanation.at, 1.3);
  const changed = expandTeachingProps({ teaching: { ...choice, phase: 'answer', correctIndex: 0 }, source }, frame);
  assert.equal(changed.elements.find(el => el.id.endsWith('teach-answer-label')).text, 'Answer A');
  const filled = expandTeachingProps({ teaching: { ...gap, phase: 'answer' }, source }, frame);
  assert.equal(filled.elements.find(el => el.id.endsWith('teach-filled-answer')).text, gap.answer);
});

test('teaching validates mapping, phases, source and a useful explanation hold', () => {
  for (const correctIndex of [-1, 3, '2', NaN]) assert.throws(() => teachingSpec({ ...choice, correctIndex }, source), /correctIndex/);
  assert.throws(() => teachingSpec({ ...choice, options: ['A', ' a '] }, source), /distinct/);
  assert.throws(() => teachingSpec({ ...choice, phase: 'click' }, source), /phase/);
  assert.throws(() => teachingSpec(choice), /source/);
  assert.throws(() => teachingSpec({ ...choice, source: 'Elsewhere' }, source), /conflicts/);
  assert.throws(() => teachingSpec({ ...gap, answer: ' ' }, source), /answer/);
  assert.throws(() => teachingSpec({ ...choice, revealAt: 1.5, explainAt: 1 }, source), /explainAt/);
  assert.throws(() => expandTeachingProps({ teaching: { ...choice, phase: 'answer', explainAt: 4 }, source }, { ...frame, duration: 4.5 }), /one second/);
});

test('full layouts adapt to both frame shapes and split reserves landscape copy space', () => {
  for (const [width, height, layout] of [[1920, 1080, 'full'], [1080, 1920, 'full'], [1920, 1080, 'split']]) {
    for (const base of [choice, gap]) for (const phase of ['question', 'answer']) {
      const p = expandTeachingProps({ teaching: { ...base, phase, layout, motion: 'none' }, source }, { ...frame, width, height });
      normalizeElements(p.elements, 'lesson', message => { throw Error(message); });
      assert(p.elements.every(el => el.id.startsWith('lesson-')));
      if (layout === 'split') assert(p.elements.filter(el => el.type === 'text').every(el => el.x + el.width <= width * 0.46 + 1e-8));
      assert(p.elements.every(el => el.enter === 'none'));
    }
  }
  assert.throws(() => expandTeachingProps({ teaching: { ...choice, layout: 'split' }, source }, { ...frame, width: 1080, height: 1920 }), /landscape/);
});

test('teaching playbook compiles both phases in both shapes without assets', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-teaching-')); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const vertical of [false, true]) {
    const dir = path.join(root, vertical ? 'vertical' : 'landscape');
    scaffold(dir, { playbook: 'teaching-sequences', vertical });
    const sb = loadStoryboard(dir), result = createJob(sb, computeTiming(dir), { draft: true });
    assert.deepEqual(result.errors, []); assert.deepEqual(result.warnings, []);
    assert.equal(sb.assets.length, 0);
    for (const b of result.job.beats) {
      assert.equal(b.props.teaching, undefined); assert.equal(b.props.source, 'Arithmetic example · 4% to 5%');
      normalizeElements(b.props.elements, b.id, message => { throw Error(message); });
    }
  }
});
