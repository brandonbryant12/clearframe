#!/usr/bin/env node
// A source-bound, text-led product launch. Consumes existing Blender assets only.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const cli = path.join(repo, 'engine/cli.mjs');
const ids = ['petal-reveal', 'exploded-core', 'ribbon-thread'];
const artifactNames = ['scene.blend', 'poster.png', 'clip.mp4'];
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const hash = file => sha(fs.readFileSync(file));
const json = (file, value) => fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n');

export const concepts = [
  { id: 'give-ideas-depth', selected: true,
    promise: 'Add dimensional imagery while retaining editable native storytelling.',
    structure: 'Material reveal → mechanism → actual commands → retained artifacts → native text change → payoff.',
    image: 'Light petal, dark assembly and continuous ribbon; native command, file and edit diagrams connect the objects to actual behavior.',
    rhythm: 'Two four-second visual hooks, two five-second explanation beats, a seven-second before/after, a five-second closing hold.',
    reason: 'Shows both the new visual range and the practical editability claim.' },
  { id: 'one-asset-three-jobs', selected: false,
    promise: 'One retained 3D asset can support a reveal, an explanation and a chapter transition.',
    structure: 'Repeat the same sculpture in three purpose-built compositions, then reveal its single source.',
    image: 'A close material study, a labelled exploded view and a cropped wipe share one object.',
    rhythm: 'A precise triptych with matched cuts and one long final comparison.' },
  { id: 'from-command-to-picture', selected: false,
    promise: 'Make the local asset workflow understandable and reproducible.',
    structure: 'Begin on a real command, follow scene and render outputs, then build a finished film around them.',
    image: 'An editorial workbench with actual retained commands, scene metadata and a single hero object.',
    rhythm: 'Patient procedural sequence, accelerating only when the completed image appears.' },
];

const show = { at: 0, enter: 'none' };
const text = (value, x, y, size = 60, extra = {}) => ({ type: 'text', text: value, x, y, size, font: 'display', fill: 'ink', fit: 1580, ...show, ...extra });
const rect = (x, y, w, h, fill = 'surface', extra = {}) => ({ type: 'rect', x, y, w, h, fill, ...show, ...extra });
const line = (x1, y1, x2, y2, stroke = 'muted', width = 3, extra = {}) => ({ type: 'line', x1, y1, x2, y2, stroke, width, ...show, ...extra });
const note = (value, x = 150, y = 938, extra = {}) => text(value, x, y, 27, { font: 'mono', fill: 'muted', ...extra });
const picture = (asset, x, y, w, h, extra = {}) => ({ type: 'image', asset, x, y, w, h, fit: 'contain', ...show, ...extra });
const fileCard = (x, name, role, label, color) => [
  rect(x, 380, 490, 450, '#ffffff', { r: 18, shadow: { dx: 0, dy: 12, blur: 24, opacity: 0.13 } }),
  rect(x + 34, 420, 82, 13, color),
  text(label, x + 34, 590, 105, { font: 'mono', fill: color, fit: 430, at: 0.2, enter: 'rise', dur: 0.7 }),
  text(name, x + 34, 690, 44, { font: 'mono', fit: 430 }),
  text(role, x + 34, 766, 36, { fill: 'muted', fit: 430 }),
];

export function authorStoryboard() {
  return {
    version: 2,
    title: 'ClearFrame — Give ideas depth',
    logline: 'Dimensional assets, retained scenes, editable native stories.',
    format: { preset: 'landscape', fps: 30 },
    theme: 'porcelain', type: 'geometric', motion: { preset: 'gentle', intensity: 0.45 },
    transition: 'cut', backdrop: 'none', chrome: false, captions: false,
    music: false, sfx: 'subtle', texture: { grain: 0 },
    pacing: { lead: 0, tail: 0, minBeat: 0, outro: 0 },
    continuity: {
      maxGeneratedShare: 1,
      treatment: 'Original local Blender studies under native type; source artifacts retained.',
      camera: 'Use the baked 3D camera unchanged; locked native workflow diagrams.',
      motion: 'Material operation first, then artifact flow and an explicit native text change.',
    },
    sources: [
      { claim: 'The CLI lists sculpture studies and resolves a local sculpture render configuration.', source: 'source/cli-proof.json and retained CLI source hashes' },
      { claim: 'Each shown asset retains its rendered clip, editable baked scene and provenance receipt.', source: 'source/artifacts/*/receipt.json; asset-manifest.json binds copied bytes' },
      { claim: 'The edit demonstration changes a native text element while preserving the same image asset bytes.', source: 'edit-proof.json; source/edit-before.storyboard.json; source/edit-after.storyboard.json' },
    ],
    assets: ids.flatMap(id => [
      { id, kind: 'clip', file: `assets/clips/${id}.mp4` },
      { id: `${id}-poster`, kind: 'image', file: `assets/img/${id}.png` },
    ]),
    beats: [
      { id: 'depth', block: 'canvas', duration: 4, camera: 'none',
        plate: { asset: 'petal-reveal', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: true },
        props: { elements: [note('CLEARFRAME', 150, 140),
          text('Give', 145, 350, 95, { fit: 380, at: 0.12, enter: 'rise', dur: 0.55 }),
          text('ideas', 145, 462, 95, { fit: 380, at: 0.28, enter: 'rise', dur: 0.55 }),
          text('depth.', 145, 574, 95, { fit: 380, at: 0.44, enter: 'rise', dur: 0.55 }),
          note('Original dimensional studies', 150, 944),
        ] } },
      { id: 'inside', block: 'canvas', duration: 4, tone: 'invert', camera: 'none',
        plate: { asset: 'exploded-core', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: true },
        props: { elements: [note('MAKE THE MECHANISM VISIBLE', 150, 140, { fill: '#c6c3bf' }),
          text('See', 145, 405, 99, { fill: '#ffffff', fit: 380, at: 0.2, enter: 'wipe', dur: 0.6 }),
          text('inside.', 145, 520, 99, { fill: '#ffffff', fit: 380, at: 0.4, enter: 'wipe', dur: 0.6 }),
          note('Conceptual assembly', 150, 944, { fill: '#c6c3bf' }),
        ] } },
      { id: 'choose', block: 'canvas', duration: 5, camera: 'none',
        props: { elements: [text('Choose a study.', 150, 242, 101),
          rect(150, 345, 1620, 440, '#1a1816', { r: 20 }),
          text('$ clearframe sculptures', 205, 475, 59, { font: 'mono', fill: '#f6f1ea', at: 0.15, enter: 'wipe', dur: 0.8 }),
          text('$ clearframe sculpture exploded-core', 205, 604, 54, { font: 'mono', fill: '#f6f1ea', at: 0.85, enter: 'wipe', dur: 1 }),
          text('  --out assets/core', 205, 690, 54, { font: 'mono', fill: '#a6c4c1', at: 1.2, enter: 'wipe', dur: 0.7 }),
          note('Actual CLI syntax · native command visualization'),
        ] } },
      { id: 'retain', block: 'canvas', duration: 5, camera: 'none',
        props: { source: 'Retained source receipts', elements: [text('Keep the scene.', 150, 242, 101),
          ...fileCard(150, 'scene.blend', 'Editable scene', '.blend', '#4d6a6d'),
          ...fileCard(715, 'clip.mp4', 'Ready video asset', '.mp4', '#8c2f39'),
          ...fileCard(1280, 'receipt.json', 'Source + settings', '.json', '#6b625a'),
          note('Files verified against each source receipt'),
        ] } },
      { id: 'edit', block: 'canvas', duration: 7, camera: 'none',
        props: { elements: [text('Change the line.', 150, 206, 101),
          note('NATIVE TEXT DEMONSTRATION', 150, 280),
          rect(150, 378, 730, 409, 'surface', { r: 18 }),
          note('storyboard.json', 188, 449),
          text('"text":', 188, 548, 55, { font: 'mono', fit: 620 }),
          text('"Make it visible."', 188, 650, 55, { font: 'mono', fit: 620, exit: 'fade', exitAt: 3.05, exitDur: 0.3 }),
          text('"Make it yours."', 188, 650, 55, { font: 'mono', fit: 620, fill: 'accent', at: 3.4, enter: 'fade', dur: 0.3 }),
          line(898, 584, 966, 584, 'accent', 6, { arrow: 'end', head: 20 }),
          rect(994, 368, 776, 514, '#ffffff', { r: 16 }),
          picture('ribbon-thread-poster', 1008, 380, 748, 421),
          text('Make it visible.', 1035, 849, 50, { fit: 670, exit: 'fade', exitAt: 3.05, exitDur: 0.3 }),
          text('Make it yours.', 1035, 849, 50, { fit: 670, fill: 'accent', at: 3.4, enter: 'fade', dur: 0.3 }),
          note('The art stays the same. The words stay editable.'),
        ] } },
      { id: 'story', block: 'canvas', duration: 5, camera: 'none',
        plate: { asset: 'ribbon-thread', side: 'full', treatment: 'none', drift: 'none', scrim: 0, loop: true },
        props: { elements: [note('CLEARFRAME', 150, 140),
          text('Keep', 145, 336, 93, { fit: 405, at: 0.15, enter: 'rise', dur: 0.55 }),
          text('your', 145, 446, 93, { fit: 405, at: 0.3, enter: 'rise', dur: 0.55 }),
          text('story.', 145, 556, 93, { fit: 405, at: 0.45, enter: 'rise', dur: 0.55 }),
          text('Editable.', 150, 677, 57, { fit: 405, fill: 'accent', at: 0.9, enter: 'fade', dur: 0.6 }),
          note('Dimensional art. Native stories.', 150, 944),
        ] } },
    ],
  };
}

function copyVerified(from, to, expected) {
  const bytes = fs.readFileSync(from);
  const actual = sha(bytes);
  if (expected) assert.equal(actual, expected, `Source hash mismatch: ${from}`);
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.writeFileSync(to, bytes);
  assert.equal(hash(to), actual);
  return { sha256: actual, bytes: bytes.length };
}

export function prepare(assetRoot, out, { final = false } = {}) {
  assetRoot = path.resolve(assetRoot); out = path.resolve(out);
  if (fs.existsSync(out)) throw new Error(`Output exists; preserve it and choose a fresh directory: ${out}`);
  const inputs = ids.map(id => {
    const folder = path.join(assetRoot, id), asset = read(path.join(folder, 'asset.json')), receipt = read(path.join(folder, 'receipt.json'));
    assert.equal(receipt.status, 'ready-for-review', `${id} has no completed render receipt`);
    assert.equal(asset.kind, 'clip'); assert.equal(asset.loop, true); assert.equal(receipt.config.loop, true);
    assert.equal(receipt.blender.requiresAutoExec, false); assert.equal(receipt.blender.bakedMotion, true);
    if (final) { assert.equal(asset.width, 1920, `${id} needs a 1920px master`); assert.equal(asset.height, 1080); assert.equal(receipt.config.draft, false); }
    assert.deepEqual(Object.keys(receipt.outputs).sort(), [...artifactNames].sort(), `${id} has unexpected output paths`);
    for (const name of artifactNames) {
      const info = receipt.outputs[name];
      assert.equal(info.file, name, `${id}/${name} has an unexpected file path`);
      assert.equal(hash(path.join(folder, name)), info.sha256, `${id}/${name} receipt mismatch`);
    }
    for (const [name, expected] of Object.entries(receipt.sourceHashes)) assert.equal(hash(path.join(folder, 'source', path.basename(name))), expected, `${id} source ${name} mismatch`);
    return { id, folder, asset, receipt };
  });
  fs.mkdirSync(path.join(out, 'source'), { recursive: true });
  const startedAt = new Date().toISOString(), t = performance.now();
  const manifest = [];
  for (const { id, folder, asset, receipt } of inputs) {
    const retained = path.join(out, 'source/artifacts', id);
    const files = {};
    for (const [name, info] of Object.entries(receipt.outputs)) files[name] = copyVerified(path.join(folder, name), path.join(retained, name), info.sha256);
    for (const name of ['asset.json', 'receipt.json', 'blender.json', 'render-config.json']) {
      if (fs.existsSync(path.join(folder, name))) files[name] = copyVerified(path.join(folder, name), path.join(retained, name));
    }
    for (const [name, expected] of Object.entries(receipt.sourceHashes)) files[`source/${path.basename(name)}`] = copyVerified(path.join(folder, 'source', path.basename(name)), path.join(retained, 'source', path.basename(name)), expected);
    copyVerified(path.join(folder, 'clip.mp4'), path.join(out, 'assets/clips', `${id}.mp4`), receipt.outputs['clip.mp4'].sha256);
    copyVerified(path.join(folder, 'poster.png'), path.join(out, 'assets/img', `${id}.png`), receipt.outputs['poster.png'].sha256);
    manifest.push({ id, copiedFrom: folder, width: asset.width, height: asset.height, fps: asset.fps, duration: asset.duration, draft: receipt.config.draft, files });
  }
  const command = args => {
    const began = performance.now();
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    return { command: ['node', 'engine/cli.mjs', ...args], seconds: (performance.now() - began) / 1000, exitCode: result.status, output: JSON.parse(result.stdout) };
  };
  const listed = command(['sculptures', '--json']);
  for (const id of ids) assert(listed.output.some(x => x.id === id), `${id} missing from actual CLI catalog`);
  const planned = command(['sculpture', 'exploded-core', '--out', path.join(out, 'unused-dry-run-output'), '--dry-run']);
  assert(!fs.existsSync(path.join(out, 'unused-dry-run-output')), 'Dry run mutated its target');
  json(path.join(out, 'source/cli-proof.json'), { recordedAt: new Date().toISOString(), commands: [listed, planned], sourceHashes: Object.fromEntries(['engine/cli.mjs', 'engine/lib/sculptures.mjs', 'package.json'].map(name => [name, hash(path.join(repo, name))])) });
  const storyboard = authorStoryboard();
  json(path.join(out, 'storyboard.json'), storyboard);
  json(path.join(out, 'concepts.json'), concepts);
  json(path.join(out, 'asset-manifest.json'), manifest);
  const editBeat = storyboard.beats.find(x => x.id === 'edit');
  const before = structuredClone(storyboard), after = structuredClone(storyboard);
  for (const [book, variant] of [[before, 'before'], [after, 'after']]) {
    book.title += ` — ${variant} text proof`;
    book.beats = [{ ...structuredClone(editBeat), id: `edit-${variant}`, duration: 3,
      props: { elements: [picture('ribbon-thread-poster', 576, 135, 768, 432), text(variant === 'before' ? 'Make it visible.' : 'Make it yours.', 960, 755, 98, { anchor: 'middle', fit: 1580 })] } }];
    json(path.join(out, `source/edit-${variant}.storyboard.json`), book);
  }
  json(path.join(out, 'edit-proof.json'), {
    kind: 'native-authored-before-after', claim: 'Only the displayed native string changes; both variants bind to the same copied image bytes.',
    before: 'Make it visible.', after: 'Make it yours.',
    asset: 'assets/img/ribbon-thread.png', assetSHA256: hash(path.join(out, 'assets/img/ribbon-thread.png')),
    proof: 'The separate storyboard fixtures are inspectable source evidence. The launch film presents their text change as an explicitly labelled native visualization, not a recording of an interactive UI.',
  });
  fs.copyFileSync(path.join(repo, 'examples/feature-launch/README.md'), path.join(out, 'README.md'));
  fs.writeFileSync(path.join(out, 'DIRECTION.md'), '# Give ideas depth\n\nA 30-second, text-led ClearFrame feature launch. The artwork is an original procedural metaphor; it is not a literal product, performance measurement or screenshot. Native command and edit diagrams are labelled as visualizations.\n\n'+concepts.map(c=>`## ${c.id}${c.selected?' — selected':''}\n${c.promise}\n\n${c.structure}\n\n${c.image}\n\n${c.rhythm}\n`).join('\n')+'\nNo narration is requested. Transition effects provide the only sound; no paid generation or Blender rerender is invoked by this script. Review the encoded timing and sound separately before publication.\n');
  fs.writeFileSync(path.join(out, 'accessible-transcript.md'), '# On-screen content\n\nThis is a text-led film without speech.\n\n0–4s: ClearFrame. Give ideas depth. Original dimensional studies.\n\n4–8s: Make the mechanism visible. See inside. Conceptual assembly.\n\n8–13s: Choose a study. Actual CLI commands list studies and render exploded-core into assets/core. Native command visualization.\n\n13–18s: Keep the scene. scene.blend: editable scene. clip.mp4: ready video asset. receipt.json: source and settings.\n\n18–25s: Change the line. Native text demonstration: Make it visible becomes Make it yours. The art stays the same. The words stay editable.\n\n25–30s: ClearFrame. Keep your story. Editable. Dimensional art. Native stories.\n');
  const report = { version: 1, kind: 'feature-launch', status: 'prepared-for-native-review', startedAt, preparedAt: new Date().toISOString(), mode: final ? 'final-assets' : 'prototype-assets', assetRoot, project: out, preparedSeconds: (performance.now() - t) / 1000, duration: storyboard.beats.reduce((n, b) => n + b.duration, 0), paidCalls: 0, blenderRenders: 0, timingNotice: 'Preparation and CLI replay time do not measure original creative authoring. Source render timings remain in the copied Blender receipts.' };
  json(path.join(out, 'trajectory.json'), report);
  return report;
}

export function render(out, { final = false } = {}) {
  out = path.resolve(out);
  const report = read(path.join(out, 'trajectory.json'));
  if (final) assert.equal(report.mode, 'final-assets', 'Final output requires retained 1080p non-draft masters');
  const startedAt = new Date().toISOString(), t = performance.now();
  const args = ['pipeline', out, ...(final ? [] : ['--draft', '--scale', '0.5']), '--json'];
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  const logId = startedAt.replace(/[:.]/g, '-');
  fs.mkdirSync(path.join(out, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(out, 'logs', `${logId}.stdout`), result.stdout || '');
  fs.writeFileSync(path.join(out, 'logs', `${logId}.stderr`), result.stderr || '');
  report.runs ??= [];
  const run = { startedAt, cliSeconds: (performance.now() - t) / 1000, command: ['node', 'engine/cli.mjs', ...args], exitCode: result.status };
  report.runs.push(run); json(path.join(out, 'trajectory.json'), report);
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  const pipeline = JSON.parse(result.stdout); run.pipeline = pipeline;
  assert.equal(pipeline.check.errors.length, 0);
  assert.equal(pipeline.qa.findings.filter(x => x.level === 'error').length, 0);
  assert(Math.abs(pipeline.check.duration - 30) < 0.05, 'Launch duration changed unexpectedly');
  report.status = 'ready-for-agent-visual-review';
  json(path.join(out, 'trajectory.json'), report);
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { 'asset-root': { type: 'string' }, out: { type: 'string' }, render: { type: 'boolean', default: false }, final: { type: 'boolean', default: false }, 'render-only': { type: 'boolean', default: false } } });
  if (!values.out || (!values['render-only'] && !values['asset-root'])) throw new Error('Usage: node scripts/trajectories/feature-launch.mjs --asset-root READY_ASSET_ROOT --out NEW_PROJECT [--render] [--final], or --out EXISTING_PROJECT --render-only [--final]');
  const report = values['render-only'] ? render(values.out, values) : prepare(values['asset-root'], values.out, values);
  const result = values.render && !values['render-only'] ? render(values.out, values) : report;
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
}
