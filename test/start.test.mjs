import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { startProject } from '../engine/lib/start.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { createJob } from '../fframes/job.mjs';
import { wireframePNG } from '../fframes/wireframe.mjs';
import { palette } from '../fframes/catalog.mjs';
import { useProject } from '../fframes/library.mjs';
import { inspectSVG } from '../engine/lib/svg-assets.mjs';

const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
function workspace(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-start-'));
  t.after(() => { useProject(null); fs.rmSync(dir, { recursive: true, force: true }); });
  return dir;
}

test('idea, evidence and a brand become a movable project without relabeling sample claims', t => {
  const dir = workspace(t), kit = path.join(dir, 'kit'), root = path.join(dir, 'film');
  fs.mkdirSync(kit);
  const png = wireframePNG(palette('paper'));
  fs.writeFileSync(path.join(kit, 'logo.png'), png);
  fs.writeFileSync(path.join(kit, 'brand.json'), JSON.stringify({ name: 'Example Studio', theme: 'ink', type: 'didone',
    voiceStyle: 'Warm and clear', rules: ['Keep the original logo'], assets: [{ id: 'logo', file: 'logo.png', role: 'closing identity' }] }));
  const report = path.join(dir, 'report.md');
  fs.writeFileSync(report, '# Cash timing\n\nThe illustrative reserve is $40 [1].\n\n## Sources\n1. Demonstration ledger https://example.org/ledger\n');
  const receipt = startProject(root, { idea: 'Explain timing', document: report, brand: path.join(kit, 'brand.json'), audience: 'Finance teams', takeaway: 'Trace each movement' });
  assert.equal(receipt.status, 'starter-needs-direction');
  assert.equal(receipt.evidence.figures, 1);
  assert.equal(receipt.assets[0].sha256.length, 64);
  assert.deepEqual(fs.readFileSync(path.join(root, 'assets/brand/logo.png')), png);
  assert.equal(json(path.join(root, 'brand.json')).assets[0].file, 'assets/brand/logo.png');
  assert.ok(!fs.readFileSync(path.join(root, 'brand.json'), 'utf8').includes(kit));
  assert.match(fs.readFileSync(path.join(root, 'EVIDENCE.md'), 'utf8'), /Demonstration ledger/);
  assert.match(json(path.join(root, 'storyboard.json')).sources[0].title, /Hypothetical/);
  fs.rmSync(kit, { recursive: true });
  fs.unlinkSync(report);
  const moved = path.join(dir, 'moved'); fs.renameSync(root, moved);
  const sb = loadStoryboard(moved);
  assert.equal(sb.type, 'didone');
  assert.equal(sb.voice.style, 'Warm and clear');
  assert.deepEqual(createJob(sb, computeTiming(moved), { draft: true }).errors, []);
  assert.deepEqual(fs.readFileSync(path.join(moved, sb.assets[0].file)), png);
});

test('bad inputs and scaffold failure leave no partially created film; existing work survives', t => {
  const dir = workspace(t), root = path.join(dir, 'film');
  fs.mkdirSync(root); fs.writeFileSync(path.join(root, 'keep.txt'), 'user work');
  assert.throws(() => startProject(root, { idea: 'A film' }), /not empty/);
  assert.equal(fs.readFileSync(path.join(root, 'keep.txt'), 'utf8'), 'user work');
  const missing = path.join(dir, 'new');
  assert.throws(() => startProject(missing, { idea: 'A film', playbook: 'does-not-exist' }), /Unknown playbook/);
  assert.ok(!fs.existsSync(missing));
  assert.ok(!fs.readdirSync(dir).some(x => x.startsWith('.clearframe-start-')));
  const brand = path.join(dir, 'brand.json');
  fs.writeFileSync(brand, JSON.stringify({ name: 'Brand', theme: { base: 'paper', ink: '#ffffff' } }));
  assert.throws(() => startProject(missing, { idea: 'A film', brand }), /contrast/);
  assert.ok(!fs.existsSync(missing));
  fs.writeFileSync(brand, JSON.stringify({ name: 'Brand', assets: [{ id: '../escape', file: 'logo.png' }] }));
  assert.throws(() => startProject(missing, { idea: 'A film', brand }), /unique slugs/);
  fs.writeFileSync(path.join(dir, 'logo.png'), 'first');
  fs.writeFileSync(path.join(dir, 'other.png'), 'second');
  fs.writeFileSync(brand, JSON.stringify({ name: 'Brand', assets: [{ id: 'logo', file: 'logo.png' }, { id: 'Logo', file: 'other.png' }] }));
  assert.throws(() => startProject(missing, { idea: 'A film', brand }), /unique slugs/);
  assert.ok(!fs.existsSync(missing));
  assert.throws(() => startProject(missing, {}), /needs --idea/);
});

test('shared palette and type used by a brand travel with the project', t => {
  const dir = workspace(t), library = path.join(dir, 'library'), root = path.join(dir, 'film');
  fs.mkdirSync(path.join(library, 'palettes'), { recursive: true });
  fs.mkdirSync(path.join(library, 'types'));
  const { base, ...colors } = palette('paper');
  fs.writeFileSync(path.join(library, 'palettes/acme.json'), JSON.stringify({ colors }));
  fs.writeFileSync(path.join(library, 'types/acme.json'), JSON.stringify({ title: 'Acme', when: 'Brand films', display: 'inter', emphasis: 'accent' }));
  const brand = path.join(dir, 'brand.json');
  fs.writeFileSync(brand, JSON.stringify({ name: 'Acme', theme: 'acme', type: 'acme' }));
  const old = process.env.CLEARFRAME_LIBRARY;
  try {
    process.env.CLEARFRAME_LIBRARY = library;
    startProject(root, { idea: 'Explain a process', brand });
    delete process.env.CLEARFRAME_LIBRARY; useProject(null);
    fs.rmSync(library, { recursive: true });
    const sb = loadStoryboard(root);
    assert.deepEqual(createJob(sb, computeTiming(root), { draft: true }).errors, []);
    assert.equal(sb.theme, 'acme');
  } finally {
    if (old == null) delete process.env.CLEARFRAME_LIBRARY; else process.env.CLEARFRAME_LIBRARY = old;
    useProject(null);
  }
});

test('CLI start emits a parseable receipt and rejects unsupported scale before making a project', t => {
  const dir = workspace(t);
  const r = spawnSync(process.execPath, ['engine/cli.mjs', 'start', path.join(dir, 'film'), '--idea', 'Explain a process', '--json'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).title, 'Explain a process');
  const bad = spawnSync(process.execPath, ['engine/cli.mjs', 'start', path.join(dir, 'bad'), '--idea', 'Idea', '--scale', '0.5'], { encoding: 'utf8' });
  assert.notEqual(bad.status, 0); assert.ok(!fs.existsSync(path.join(dir, 'bad')));
});

test('evidence is parsed from the copied original even if the external report changes mid-intake', t => {
  const dir = workspace(t), report = path.join(dir, 'report.md'), brand = path.join(dir, 'brand.json');
  fs.writeFileSync(report, '# Example\n\nIllustrative cash is $100.\n');
  fs.writeFileSync(path.join(dir, 'logo.png'), 'asset bytes');
  fs.writeFileSync(brand, JSON.stringify({ name: 'Example', assets: [{ id: 'logo', file: 'logo.png' }] }));
  const copy = fs.copyFileSync;
  t.mock.method(fs, 'copyFileSync', (from, to, flags) => {
    if (String(from).endsWith('logo.png')) fs.writeFileSync(report, '# Example\n\nIllustrative cash is $200.\n');
    return copy(from, to, flags);
  });
  const root = path.join(dir, 'film');
  startProject(root, { document: report, brand });
  assert.match(fs.readFileSync(report, 'utf8'), /200/);
  for (const file of ['source/original.md', 'source/document.md', 'EVIDENCE.md'])
    assert.match(fs.readFileSync(path.join(root, file), 'utf8'), /100/);
});

test('SVG brand intake retains the exact original and registers a transparent native PNG', { skip: process.platform !== 'darwin' }, t => {
  const dir = workspace(t), root = path.join(dir, 'film');
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100" width="200" height="100"><path d="M10 90L50 10L90 90Z" fill="#005544"/></svg>';
  fs.writeFileSync(path.join(dir, 'logo.svg'), svg);
  fs.writeFileSync(path.join(dir, 'brand.json'), JSON.stringify({ name: 'Example', assets: [{ id: 'logo', file: 'logo.svg' }] }));
  const receipt = startProject(root, { idea: 'A simple idea', brand: path.join(dir, 'brand.json') });
  const asset = receipt.assets[0];
  assert.equal(fs.readFileSync(path.join(root, asset.original.file), 'utf8'), svg);
  assert.equal(asset.file, 'assets/brand/logo.png');
  assert.equal(asset.conversion.width, 2048); assert.equal(asset.conversion.height, 1024);
  assert.equal(asset.conversion.liveText, false);
  assert.equal(json(path.join(root, 'brand.json')).assets[0].file, asset.file);
  const r = spawnSync('/usr/bin/sips', ['-g', 'hasAlpha', path.join(root, asset.file)], { encoding: 'utf8' });
  assert.match(r.stdout, /hasAlpha: yes/);
  fs.writeFileSync(path.join(dir, 'logo.svg'), svg.replace('<path', '<image href="https://example.org/external.png"/><path'));
  const bad = path.join(dir, 'bad');
  assert.throws(() => startProject(bad, { idea: 'A simple idea', brand: path.join(dir, 'brand.json') }), /external/);
  assert.ok(!fs.existsSync(bad));
  for (const encoded of ['u&#114;l(https://example.org/paint.svg#ink)', 'url( https://example.org/paint.svg#ink )']) {
    fs.writeFileSync(path.join(dir, 'logo.svg'), svg.replace('fill="#005544"', `fill="${encoded}"`));
    assert.throws(() => startProject(bad, { idea: 'A simple idea', brand: path.join(dir, 'brand.json') }), /external/);
    assert.ok(!fs.existsSync(bad));
  }
  fs.writeFileSync(path.join(dir, 'logo.svg'), svg.replace('fill="#005544"', 'fill="url(&quot;#ink&quot;)"'));
  assert.deepEqual(inspectSVG(path.join(dir, 'logo.svg')), { liveText: false });
  fs.writeFileSync(path.join(dir, 'logo.svg'), svg.replace('<svg ', '<svg xml:base="https://example.org/" '));
  assert.throws(() => inspectSVG(path.join(dir, 'logo.svg')), /self-contained/);
});

test('multiple documents keep citation namespaces and CSV values separate in one intake', t => {
  const dir = workspace(t), root = path.join(dir, 'film');
  const a = path.join(dir, 'a.md'), b = path.join(dir, 'b.md'), csv = path.join(dir, 'ledger.csv');
  fs.writeFileSync(a, '# Report A\n\nRevenue is $100 [1].\n\n## Sources\n1. Ledger A\n');
  fs.writeFileSync(b, '# Report B\n\nRevenue is $200 [1].\n\n## Sources\n1. Ledger B\n');
  fs.writeFileSync(csv, 'Item,USD\n"Sale, gross",100\nFee,-3\nNet,97\n');
  const result = spawnSync(process.execPath, ['engine/cli.mjs', 'start', root, '--document', a, '--document', b, '--document', csv, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  const receipt = JSON.parse(result.stdout), research = json(path.join(root, 'source/research.json'));
  assert.equal(receipt.inputs.length, 3);
  assert.deepEqual(research.figures.filter(f => f.sources.length).map(f => f.sources), [['doc1:1'], ['doc2:1']]);
  assert.ok(research.sources.some(s => s.id === 'doc1:1' && s.title === 'Ledger A'));
  assert.ok(research.sources.some(s => s.id === 'doc2:1' && s.title === 'Ledger B'));
  assert.deepEqual(research.tables[0].rows, [['Sale, gross', '100'], ['Fee', '-3'], ['Net', '97']]);
  for (const [i, file] of [a, b, csv].entries()) assert.deepEqual(fs.readFileSync(path.join(root, receipt.inputs[i].file)), fs.readFileSync(file));
});
