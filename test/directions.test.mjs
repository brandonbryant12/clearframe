import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { scaffold, sketchGallery } from '../fframes/playbooks.mjs';
import { directionOptions, directions } from '../fframes/directions.mjs';
import { items, useProject } from '../fframes/library.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { ingestRecording } from '../engine/lib/ingest.mjs';
import { pcmToWav } from '../engine/lib/util.mjs';
import { readPCM } from '../engine/lib/levels.mjs';
import { createJob } from '../fframes/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value)); };
function temp(t) { const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-directions-')); t.after(() => { useProject(null); fs.rmSync(root, { recursive: true, force: true }); }); return root; }

test('directions seed different visual structures, allow overrides and do not alter source evidence', t => {
  const root = temp(t), source = path.join(root, 'report.md');
  const text = '# Illustrative report\n\nA sample mechanism has a missing comparison. No study result is asserted.\n';
  fs.writeFileSync(source, text);
  const signatures = [];
  for (const direction of ['research-evidence', 'research-mechanism', 'research-fieldnotes']) {
    const dir = path.join(root, direction);
    const r = spawnSync(process.execPath, ['engine/cli.mjs', 'start', dir, '--document', source, '--direction', direction], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr);
    assert.equal(fs.readFileSync(path.join(dir, 'source/original.md'), 'utf8'), text);
    const sb = loadStoryboard(dir);
    assert.deepEqual(createJob(sb, computeTiming(dir), { draft: true }).errors, []);
    signatures.push(JSON.stringify(sb.beats.map(b => [b.block, b.props.elements, b.props.view, b.transition])));
    assert.match(fs.readFileSync(path.join(dir, 'DIRECTION.md'), 'utf8'), /starting hypothesis/);
  }
  assert.equal(new Set(signatures).size, 3, 'the choices change the picture and structure, not just the palette');
  const options = directionOptions({ direction: 'research-evidence', playbook: 'podcast-thread', treatment: 'blueprint', theme: 'paper' });
  const sb = scaffold(path.join(root, 'combined'), options);
  assert.equal(sb.treatment, 'blueprint'); assert.equal(sb.theme, 'paper');
  assert.equal(sb.beats.length, items('playbooks').find(b => b.id === 'podcast-thread').beats.length);
  assert.ok(directions('podcast').some(d => d.id === 'research-mechanism'), 'source tags suggest; they do not restrict');
});

test('custom directions and their overridden defaults remain portable after their shared library is removed', t => {
  const root = temp(t), library = path.join(root, 'kit'), dir = path.join(root, 'film');
  write(path.join(library, 'directions/house.json'), { ...directions()[0], id: 'house', title: 'A new idea', playbook: 'house', treatment: 'house' });
  write(path.join(library, 'playbooks/house.json'), { title: 'House', audience: 'a', inputs: 'a', beats: [{ id: 'a', block: 'statement', duration: 2, props: { text: 'Original scene' } }] });
  write(path.join(library, 'treatments/house.json'), { title: 'House', when: 'New films', film: { theme: 'paper', type: 'didone' } });
  write(path.join(library, 'palettes/override.json'), { colors: items('palettes')[0].colors });
  write(path.join(library, 'playbooks/override.json'), { title: 'Override', audience: 'a', inputs: 'a', beats: [{ id: 'a', block: 'statement', duration: 2, props: { text: 'Override scene' } }] });
  write(path.join(library, 'treatments/override.json'), { title: 'Override', when: 'Selected independently', playbook: 'override', film: { theme: 'override' } });
  const r = spawnSync(process.execPath, ['engine/cli.mjs', 'new', dir, '--library', library, '--direction', 'house', '--playbook', 'concept-explainer', '--treatment', 'override', '--theme', 'paper'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  fs.rmSync(library, { recursive: true });
  const sb = loadStoryboard(dir);
  assert.equal(sb.treatment, 'override'); assert.equal(sb.theme, 'paper');
  assert.equal(directions().find(d => d.id === 'house').title, 'A new idea');
  assert.deepEqual(createJob(sb, computeTiming(dir), { draft: true }).errors, []);
  // Camera properties must survive the catalog preview as well as the actual playbook.
  const gallery = sketchGallery({ only: ['thread-opening'] });
  assert.ok(gallery.beats[0].props.view[0] > 0, 'off-origin drawing keeps its camera in gallery');
});

test('podcast looks preserve exact source audio, cut times, words, speakers and measured alignment', async t => {
  const root = temp(t), audio = path.join(root, 'fixture.wav');
  // A synthetic timing fixture verifies byte/metadata preservation, not recognizer accuracy.
  const pcm = Buffer.alloc(48000 * 4 * 2);
  for (let i = 0; i < pcm.length / 2; i++) pcm.writeInt16LE(Math.round(Math.sin(i * Math.PI / 100) * 1800), i * 2);
  fs.writeFileSync(audio, pcmToWav(pcm, { sampleRate: 48000 }));
  const brand = path.join(root, 'brand.json');
  write(brand, { name: 'Recorded show', theme: 'paper', voiceStyle: 'Must not change the recording' });
  const words = [{ w: 'One', t0: 0.1, t1: 0.7, speaker: 'host' }, { w: 'thought.', t0: 0.8, t1: 1.6, speaker: 'host' },
    { w: 'A', t0: 2.1, t1: 2.4, speaker: 'guest' }, { w: 'reply.', t0: 2.5, t1: 3.8, speaker: 'guest' }];
  const runs = [];
  for (const direction of [undefined, 'podcast-thread', 'podcast-kinetic', 'podcast-sketch']) {
    const dir = path.join(root, direction ?? 'plain');
    await ingestRecording(dir, { audio, words, direction, playbook: 'cash-flow', brand });
    assert.match(fs.readFileSync(path.join(dir, 'DIRECTION.md'), 'utf8'), /cash-flow/);
    const sb = loadStoryboard(dir);
    assert.deepEqual(createJob(sb, computeTiming(dir)).errors, []);
    const metadata = sb.beats.map(b => { const { createdAt, ...meta } = read(path.join(dir, 'assets/vo', b.id + '.json')); return meta; });
    const slices = sb.beats.map(b => readPCM(path.join(dir, 'assets/vo', b.id + '.wav')).pcm);
    const raw = read(path.join(dir, 'storyboard.json'));
    assert.equal(raw.transition, 'cut'); assert.equal(raw.voice, undefined); assert.deepEqual(raw.pacing, { continuous: true });
    assert.equal(raw.theme, 'paper'); assert.ok(fs.existsSync(path.join(dir, 'BRAND.md')));
    assert.deepEqual(Buffer.concat(slices), readPCM(path.join(dir, 'source/recording.wav')).pcm);
    runs.push({ source: sb.beats.map(b => [b.id, b.vo, b.speaker, b.note]), metadata, slices });
  }
  for (const run of runs.slice(1)) assert.deepEqual(run, runs[0]);
  const invalid = path.join(root, 'invalid');
  await assert.rejects(ingestRecording(invalid, { audio, words, treatment: 'missing' }), /Unknown treatment/);
  assert.ok(!fs.existsSync(invalid));
  await assert.rejects(ingestRecording(invalid, { audio, words: [] }), /No word timestamps/);
  assert.ok(!fs.existsSync(invalid), 'failed recording intake leaves no partial project');
});
