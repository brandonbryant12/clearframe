// The creative library: built-in files plus shared and project layers, validated on load.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { items, item, palettes, useProject, libraryDirs } from '../film/library.mjs';
import { palette } from '../film/catalog.mjs';
import { sketch } from '../film/sketches.mjs';
import { normalizeElements } from '../film/canvas.mjs';
import { treatmentById } from '../film/treatments.mjs';
import { scaffold } from '../film/playbooks.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { createJob } from '../film/job.mjs';

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
  assert.equal(item('treatments', 'keynote').film.theme, 'stage');
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
  const { muse } = await import('../film/muse.mjs');
  assert.deepEqual(muse(42), muse(42));
  const draws = new Set([1, 2, 3, 4, 5, 6, 7, 8].map(s => JSON.stringify([muse(s).palette, muse(s).twist])));
  assert.ok(draws.size >= 6, 'different seeds start somewhere different');
  // The October 2026 set: every frame shape builds and validates as canvas elements.
  for (const name of ['chat', 'device'])
    for (const preset of ['landscape', 'vertical', 'square', 'portrait']) {
      const els = sketch(name, preset).elements;
      assert.ok(els.length > 0, `${name} ${preset}`);
      normalizeElements(els, `${name}.${preset}`, m => {
        throw new Error(m);
      });
    }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-seed-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const sb = scaffold(path.join(dir, 'film'), { playbook: 'concept-explainer', seed: 42 });
  assert.equal(sb.theme, muse(42).palette);
  assert.match(fs.readFileSync(path.join(dir, 'film', 'DIRECTION.md'), 'utf8'), /Creative seed 42/);
});

test('playbook art keeps its shorthand, so drift follows the final beat length like authored art', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-playbook-art-'));
  const beats = [
    { id: 'house', block: 'statement', duration: 3, props: { text: 'Idea' }, art: { sketch: 'house-glow', drift: 1 } },
    { id: 'quick', block: 'statement', duration: 0.5, props: { text: 'Fast' }, art: { sketch: 'house-glow', seed: 5, drift: 0.6 } },
    { id: 'spoken', block: 'statement', vo: 'The narration decides how long this beat stays on screen.', props: { text: 'Said' }, art: { sketch: 'house-glow', drift: 0.8 } },
  ];
  const compile = dir => {
    const r = createJob(loadStoryboard(dir), computeTiming(dir), { draft: true });
    assert.deepEqual(r.errors, []);
    return r.job.beats;
  };
  try {
    write(root, 'library/sketches/house-glow.json', {
      summary: 'A brand glow', use: 'openers', layer: 'under',
      elements: [{ type: 'circle', cx: 960, cy: 540, r: 200, fill: 'accent', at: 0, enter: 'none' }],
    });
    write(root, 'library/playbooks/drift-book.json', { title: 'Drift', audience: 'a', inputs: 'b', beats });
    write(root, 'storyboard.json', { beats: [{ id: 'a', block: 'title', props: { title: 'x' } }] });
    loadStoryboard(root);
    // A background sketch as an art layer: authored layers kept, drift only when asked.
    const { expandArt } = await import('../film/sketches.mjs');
    const authoredEl = { type: 'circle', r: 8, fill: 'accent2' };
    const layered = expandArt({ sketch: 'house-glow', opacity: 0.6, under: [authoredEl], over: [authoredEl] }, { width: 1080, height: 1920 });
    assert.equal(layered.under[0].opacity, 0.6);
    assert.deepEqual(layered.under.at(-1), authoredEl);
    assert.deepEqual(layered.over, [authoredEl]);
    assert.equal(expandArt({ sketch: 'house-glow' }, { width: 1920, height: 1080, duration: 6 }).under[0].keys, undefined, 'no drift unless asked');
    const [left, right] = [3, 4].map(seed => expandArt({ sketch: 'house-glow', seed, drift: 1 }, { width: 1920, height: 1080, duration: 6 }).under[0]);
    assert.equal(right.keys[0].dur, 6, 'the push spans the beat');
    assert.ok(right.keys[0].scale > 1 && right.keys[0].hold === false);
    assert.equal(Math.sign(left.keys[0].x), -Math.sign(right.keys[0].x), 'the seed chooses the direction of travel');
    assert.throws(() => expandArt({ sketch: 'house-glow', drift: 2 }), /drift/);
    assert.throws(() => expandArt({ sketch: 'house-glow', opacity: 2 }), /opacity/);
    assert.throws(() => expandArt({ sketch: 'route' }), /not a background layer/);
    assert.throws(() => expandArt({ sketch: 'missing' }), /Unknown sketch/);
    const made = path.join(root, 'made');
    const sb = scaffold(made, { playbook: 'drift-book' });
    assert.deepEqual(sb.beats.map(b => b.art), beats.map(b => b.art), 'art stays as shorthand until the job');
    assert.ok(fs.existsSync(path.join(made, 'library/sketches/house-glow.json')), 'shared art sketches travel with the project');
    assert.throws(() => scaffold(path.join(root, 'bad'), { playbook: 'drift-book', theme: 'paper', seed: 1.5 }), /seed/);
    // Compiled alone (the shared library no longer loaded), as a hand-authored copy would be.
    const authored = path.join(root, 'authored');
    write(authored, 'storyboard.json', { ...sb, beats });
    fs.cpSync(path.join(made, 'library'), path.join(authored, 'library'), { recursive: true });
    const [fromBook, byHand] = [compile(made), compile(authored)];
    assert.deepEqual(fromBook.map(b => b.art), byHand.map(b => b.art));
    for (const b of fromBook) assert.ok(Math.abs(b.art.under[0].keys[0].dur - b.frames / 30) < 0.02, `${b.id} drift spans its beat`);
    assert.equal(fromBook[0].art.under[0].children[0].r, 200);
    assert.ok(fromBook[1].frames / 30 < 1 && fromBook[2].frames / 30 > 3);
  } finally {
    useProject(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('type voices are library items that reach the job, override per beat and check glyphs against their face', () => {
  const voices = items('types');
  assert.ok(voices.length >= 3 && voices[0].id === 'inter');
  for (const t of items('treatments')) if (t.film.type) assert.ok(item('types', t.film.type), `${t.id} names a voice`);
  // The library no longer converges on one voice: most of the serif-emphasis looks moved.
  const voiced = items('treatments').filter(t => t.film.type && t.film.type !== 'inter');
  assert.ok(new Set(voiced.map(t => t.film.type)).size >= 1, 'a voice other than inter is in use');
  assert.ok(items('treatments').filter(t => t.beats?.emphasisStyle === 'serif').length <= 8);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-type-'));
  const beats = [
    { id: 'a', block: 'title', duration: 3, props: { text: 'Make the next step clear', emphasis: ['clear'] } },
    { id: 'b', block: 'statement', duration: 3, type: 'inter', props: { text: 'Plain again' } },
    { id: 'c', block: 'chapter', duration: 3, type: 'geometric', props: { number: '02', title: 'Caps' } },
  ];
  const compile = (sb, extra = {}) => createJob({ ...loadStoryboard(root), ...sb }, computeTiming(root), { draft: true, ...extra });
  try {
    write(root, 'storyboard.json', { theme: 'paper', type: 'bookish', beats });
    const { job, errors } = compile({});
    assert.deepEqual(errors, []);
    assert.deepEqual(job.type, { id: 'bookish', display: 'dm-serif', emphasis: 'italic', upper: false, tracking: -0.005, leading: 1 });
    assert.equal(job.beats[0].type, undefined, 'the film voice is not repeated per beat');
    assert.equal(job.beats[1].type.display, 'inter', 'a beat opts back out');
    assert.equal(job.beats[2].type.display, 'space-grotesk');
    write(root, 'storyboard.json', { theme: 'paper', beats });
    assert.equal(compile({}).job.type, undefined, 'the default look leaves the job unchanged');
    write(root, 'storyboard.json', { theme: 'paper', type: 'gothic', beats });
    assert.match(compile({}).errors.join('\n'), /Unknown type "gothic"/);
    // A character the voice's face lacks fails before rendering, naming the face.
    write(root, 'storyboard.json', { theme: 'paper', type: 'bookish', beats: [{ ...beats[0], props: { text: 'Alpha α' } }] });
    assert.match(compile({}).errors.join('\n'), /not in the bundled DMSerifDisplay/);
    // Shared voices travel with a scaffolded project like palettes do.
    write(root, 'library/types/house.json', { title: 'House', when: 'Brand.', display: 'space-grotesk', emphasis: 'weight' });
    write(root, 'library/treatments/housed.json', { title: 'Housed', when: 'Brand.', film: { theme: 'paper', type: 'house' } });
    useProject(null);
    loadStoryboard(root);
    const sb = scaffold(path.join(root, 'made'), { playbook: 'concept-explainer', treatment: 'housed' });
    assert.equal(sb.type, 'house');
    assert.ok(fs.existsSync(path.join(root, 'made/library/types/house.json')));
    write(root, 'library/types/bad.json', { title: 'Bad', when: 'x', display: 'archivo-wide', emphasis: 'italic' });
    useProject(null);
    assert.throws(() => useProject(root), /has no italic/);
  } finally {
    useProject(null);
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('the library index finds a short mixed shortlist and gives one entry exact authoring', async () => {
  const { find, detail } = await import('../film/discover.mjs');
  const hits = find('a playful retro game launch teaser');
  assert.ok(hits.length >= 5 && hits.length <= 8, `a short shortlist (${hits.length})`);
  assert.ok(new Set(hits.map(h => h.kind)).size >= 3, 'it mixes kinds, not one list');
  assert.ok(hits.some(h => h.id === 'cast-look:pixel'), 'the pixel look surfaces for a retro game');
  const d = await detail('cast-shape:server');
  assert.equal(d.example.props.cast.objects[0].shape, 'server', 'detail carries a copyable example');
  assert.ok(!find('a playful 30 second launch for a calendar app').some(h => h.id === 'block:stat'), 'a length is not a figure');
  // The examples compile as given: a stage's events, and a move that needs its own fields.
  const { compileStage } = await import('../scene/recipes.mjs');
  const { expandCastProps } = await import('../film/cast.mjs');
  compileStage((await detail('mechanism:stage')).example.props, { cue: () => 1, end: 6, where: 'stage', frame: { width: 1920, height: 1080 } });
  // A sketch's named moments land on spoken words, and the cue names never reach the plan.
  const { sketch } = await import('../film/sketches.mjs');
  const lit = JSON.stringify(sketch('searchlight', 'vertical', { text: { FIRST: 'Old logs' }, say: { FIRST: 'logs', ALL: 'Lights' } }).elements);
  assert.ok(lit.includes('"say":"logs"') && lit.includes('"exitSay":"Lights"') && lit.includes('Old logs') && !lit.includes('"cue"'), 'sketchSay cues a sketch');
  assert.deepEqual(Object.keys((await detail('sketch:searchlight')).example.props.sketchSay).sort(), ['ALL', 'FIRST', 'SEARCH', 'SECOND', 'THIRD'], 'detail lists the cues to fill');
  assert.ok(JSON.stringify(sketch('vesting', 'landscape', { say: { ONE: 'one' } }).elements).includes('"say":"one"'), 'a workplace sketch takes its cue too');
  assert.throws(() => sketch('searchlight', 'landscape', { say: { FIRTS: 'logs' } }), /FIRTS.*FIRST/, 'a misspelt moment names the real ones');
  assert.ok(find('a handmade launch for our app').some(h => h.id === 'sketch:cut-paper'), 'everyday craft words reach the paper workbench');
  // The studio agent can take a sketch's drawn elements to adapt the picture itself.
  const { createTools } = await import('../engine/lib/agent/tools.mjs');
  const project = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-sketch-'));
  const tools = createTools({ base: project, jobs: null, filmOf: () => null, pauseOf: () => null, currentScope: () => null });
  const drawn = JSON.parse((await tools.catalog({ dir: project, input: { topic: 'sketch', name: 'untangle', shape: 'vertical', sketchSay: { FLOW: 'flows' } } })).content);
  assert.ok(drawn.shape === 'vertical' && JSON.stringify(drawn.elements).includes('"say":"flows"'), 'catalog topic sketch returns filled elements for the shape');
  for (const move of ['swap', 'merge', 'hero', 'mark']) expandCastProps((await detail(`cast-move:${move}`)).example.props, { width: 1080, height: 1920, beatId: 'b', duration: 4 }, { cue: () => 1, carry: {}, notes: [] });
});

test('sketch moments are listed in the order they happen, and an early exit word waits for a timed entrance', async () => {
  // Agents fill moments with narration words in the listed order: match drew TOTAL first in its
  // source, which made coins leave before they arrived.
  const { sketchMoments } = await import('../film/sketches.mjs');
  assert.deepEqual(sketchMoments('match'), ['YOU', 'MATCH', 'TOTAL']);
  assert.deepEqual(sketchMoments('expire'), ['FILL', 'YEAREND', 'KEEP']);
  const { scheduleElements } = await import('../film/canvas.mjs');
  const words = { first: 0, later: 2 }, resolve = v => (typeof v === 'number' ? v : words[v]);
  const bar = { type: 'rect', at: 0.35, dur: 0.6, exit: 'fade', exitSay: 'first' };
  scheduleElements([bar], { start: 0, entrance: 0.6, resolve });
  assert.equal(bar.exitAt, 0.95, 'the exit waits for the entrance');
  assert.throws(() => scheduleElements([{ type: 'rect', say: 'later', exit: 'fade', exitSay: 'first' }], { start: 0, entrance: 0.6, resolve }), /"later".*"first"/);
});

test('figures typed into a beat are checked against the source document; sketch params count, structure does not', async () => {
  const { unsourcedFigures } = await import('../engine/lib/figures.mjs');
  const numbers = { files: ['source/brief.md'], values: new Set([750, 1500, 4, 21, 2027, 0]) };
  const beat = sketchParams => ({ props: { source: 'Benefits guide 2027', sketch: 'expire', sketchParams } });
  assert.deepEqual(unsourcedFigures(beat({ total: 3, keep: 0, each: 800, prefix: '$' }), numbers).map(f => f.where), ['sketchParams.each']);
  assert.deepEqual(unsourcedFigures({ props: { sketch: 'deadline', sketchParams: { days: 30, start: 3, end: 21 } } }, numbers), [], 'days in a month are structure');
  assert.deepEqual(unsourcedFigures({ props: { chart: { kind: 'bars', values: [{ label: 'HSA', value: 1500 }, { label: 'rate', value: 0.04 }] } } }, numbers), [], 'a fraction matches its percentage');
  assert.deepEqual(unsourcedFigures({ props: { elements: [{ type: 'text', text: 'Example receipt: $36.00' }] } }, numbers), [], 'a labelled example is not a claim');
});

test('a short film is told which facts of its source it never states', async () => {
  const { droppedFacts } = await import('../engine/lib/figures.mjs');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-dropped-'));
  fs.mkdirSync(path.join(root, 'source'));
  fs.writeFileSync(path.join(root, 'source', 'document.md'), '**For:** 420 advisers\n\n## Source: Policy RC-31\n\n- Last year **27** emails went to the wrong person.\n- Personal email, USB drives and consumer file-sharing apps are not allowed\n  for client documents.\n\n## Tone\n\nMatter-of-fact and respectful of busy people.\n');
  const sb = { beats: [{ id: 'a', vo: 'Last year, 27 emails went astray.', props: {} }] };
  assert.deepEqual(droppedFacts(root, sb), ['Personal email, USB drives and consumer file-sharing apps are not allowed for client documents.']);
  sb.beats.push({ id: 'b', vo: 'No personal email, no USB drives, no consumer apps for client documents.', props: {} });
  assert.deepEqual(droppedFacts(root, sb), []);
});
