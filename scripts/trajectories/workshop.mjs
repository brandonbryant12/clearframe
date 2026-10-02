#!/usr/bin/env node
// A reproducible, explicitly simulated user trajectory. No provider calls.
// Run initial, inspect it, then run revised; `all` is a deterministic replay.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = path.dirname(path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const cli = path.join(repo, 'engine/cli.mjs');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const json = (file, data) => fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');

export const logoSVG = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="160" viewBox="0 0 320 160"><g fill="none" stroke="#23363a" stroke-width="8" stroke-linejoin="round" stroke-linecap="round"><path d="M40 35 L160 15 L280 35 L160 140 Z"/><path d="M40 35 L160 64 L280 35 M160 64 L160 140"/><path d="M101 25 L220 92"/></g></svg>\n`;
export const approvedCopy = `# Foldwork approved copy — fictional simulation

This is a synthetic brand and service. No real client, testimonial or performance claim is asserted.

## Approved narration

- A1: Every project starts with a messy brief.
- A2: We put the right questions on the table.
- A3: Then we make the alternatives tangible.
- A4: Choose one direction, and leave with a clear next step.
- A5: Bring us the messy brief.

## Approved visible language

Foldwork. A messy brief. The right questions. Who is it for? What must change? What can wait? Make it tangible. One clear direction. Next step. Bring us the messy brief.

## Identity and scope

Foldwork is a fictional small design studio. Its kickoff service helps turn a messy brief into a clear direction. Do not add numbers, testimonials, customer results or guarantees. The supplied whiteboard is a synthetic planning diagram. Preserve the supplied SVG logo unchanged; rasterize only for the renderer and retain its original bytes. Use cream for paper, deep teal for structure and muted terracotta for a selected idea.
`;
export const brand = {
  name: 'Foldwork — fictional studio',
  theme: { base: 'paper', bg: '#f5efe5', surface: '#e8ddcc', ink: '#23363a', muted: '#576c6c',
    accent: '#2a635e', accent2: '#a44a38', positive: '#386d45', negative: '#a64237' },
  type: 'bookish', voiceStyle: 'Warm, clear and unhurried. One thought at a time.',
  rules: ['Preserve the supplied logo and its proportions.', 'Use original paper-workshop scenes, with generous space.',
    'Use only approved copy; no invented figures, testimonials or performance claims.',
    'The cream/teal/terracotta colours have distinct roles, not interchangeable decoration.'],
  assets: [{ id: 'logo', kind: 'image', file: 'logo.svg', role: 'unaltered fictional studio identity' },
    { id: 'whiteboard', kind: 'image', file: 'whiteboard.png', role: 'supplied synthetic planning board' }],
};
export const turns = [
  { turn: 1, kind: 'simulated-user', text: 'We are a small design studio. Explain our kickoff service: turn a messy brief into one clear decision. Use the supplied SVG logo, brand-colour roles, whiteboard PNG and approved copy sheet. Make a vertical video of about 25–30 seconds. No invented numbers or testimonials.' },
  { turn: 2, kind: 'simulated-user', text: 'Avoid a generic three-step slide. Make it feel like a little paper workshop: questions arrive, alternatives take shape, one route is selected.' },
  { turn: 3, kind: 'simulated-user', text: 'The middle is too busy. Remove half the objects, hold the chosen route, and put the unmodified logo on the final frame. CTA: Bring us the messy brief.' },
];
const approaches = [
  { id: 'paper-workshop', story: 'A supplied messy board becomes physical questions, tangible routes, then one clear path.',
    picture: 'Top-down paper objects, a workbench edge, folded route strips and the actual supplied artwork.',
    edit: 'Object montage with a repeated paper material; a deliberate hold on the selected route.',
    pace: 'Quick questions, a slower comparison, then a held next step.', selected: true,
    reason: 'The service is abstract; a small physical workshop gives the decision-making a visible action.' },
  { id: 'one-line-plan', story: 'An indecisive mark explores branches until it becomes one continuous route.',
    picture: 'One native pen stroke, minimal labels and the supplied board as a first-frame reference.',
    edit: 'A single continuous camera world.', pace: 'A continuous draw with one quiet turn.', selected: false },
  { id: 'editorial-proof', story: 'Read the brief as a document; circle ambiguity; rewrite one supported decision.',
    picture: 'Approved copy, cropped source details and typographic annotations.',
    edit: 'A source-led editorial montage with close and wide document views.', pace: 'Patient reading and decisive cuts.', selected: false },
];

// A deterministic, text-free supplied whiteboard image. It is a synthetic asset,
// not a screenshot or a photographic claim. Native text is authored separately.
export function whiteboardPNG() {
  const width = 960, height = 600, pixels = Buffer.alloc(width * height * 3);
  const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
  const bg = rgb('#f5efe5');
  for (let i = 0; i < width * height; i++) pixels.set(bg, i * 3);
  function box(x, y, w, h, color) {
    const c = rgb(color);
    for (let yy = Math.max(0, y); yy < Math.min(height, y + h); yy++)
      for (let xx = Math.max(0, x); xx < Math.min(width, x + w); xx++) pixels.set(c, (yy * width + xx) * 3);
  }
  function line(x1, y1, x2, y2, color, thickness = 4) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let i = 0; i <= steps; i++) box(Math.round(x1 + (x2 - x1) * i / steps), Math.round(y1 + (y2 - y1) * i / steps), thickness, thickness, color);
  }
  box(18, 18, 924, 564, '#e8ddcc'); box(28, 28, 904, 544, '#fffbf4');
  for (const [x, y, c] of [[95, 100, '#cdd9cc'], [340, 70, '#e5c7b0'], [660, 135, '#cdd9cc'],
    [160, 370, '#e5c7b0'], [500, 345, '#e7dfbf']]) {
    box(x + 8, y + 10, 155, 126, '#e8ddcc'); box(x, y, 155, 126, c);
    for (let k = 0; k < 3; k++) line(x + 24, y + 32 + k * 23, x + 118 - k * 12, y + 30 + k * 23, '#576c6c', 3);
  }
  line(250, 163, 333, 133, '#2a635e'); line(497, 147, 650, 198, '#2a635e');
  line(743, 264, 657, 392, '#a44a38'); line(495, 413, 328, 431, '#a44a38');
  const crcTable = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c; });
  const chunk = (type, data) => {
    const out = Buffer.alloc(data.length + 12); out.writeUInt32BE(data.length); out.write(type, 4); data.copy(out, 8);
    let crc = -1; for (const b of out.subarray(4, 8 + data.length)) crc = crcTable[(crc ^ b) & 255] ^ (crc >>> 8);
    out.writeUInt32BE((crc ^ -1) >>> 0, 8 + data.length); return out;
  };
  const scan = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(scan, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(width); ihdr.writeUInt32BE(height, 4); ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(scan, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

export function createFixtures(dir) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'logo.svg'), logoSVG);
  fs.writeFileSync(path.join(dir, 'whiteboard.png'), whiteboardPNG());
  fs.writeFileSync(path.join(dir, 'approved-copy.md'), approvedCopy);
  json(path.join(dir, 'brand.json'), brand); json(path.join(dir, 'simulated-turns.json'), turns);
  json(path.join(dir, 'approaches.json'), approaches);
  return ['logo.svg', 'whiteboard.png', 'approved-copy.md', 'brand.json'].map(file => ({ file, sha256: sha(fs.readFileSync(path.join(dir, file))) }));
}

const visible = { at: 0, enter: 'none' };
const source = 'Fictional studio · simulated user brief';
const label = (text, x, y, size = 60, extra = {}) => ({ type: 'text', text, x, y, size, font: 'serif-display', anchor: 'middle', fill: 'ink', fit: 840, ...extra });
const line = (x1, y1, x2, y2, extra = {}) => ({ type: 'line', x1, y1, x2, y2, stroke: 'muted', width: 3, ...visible, ...extra });
function paper(cx, cy, w, h, angle, text, at = 0.3, fill = 'bg') {
  return { type: 'group', origin: [cx, cy], rotate: angle, at, enter: 'drop', dur: 0.6, dist: 55,
    shadow: { dx: 6, dy: 11, blur: 16, opacity: 0.14 }, children: [
      { type: 'poly', points: [[cx - w / 2, cy - h / 2], [cx + w / 2, cy - h / 2 + 5], [cx + w / 2 - 6, cy + h / 2], [cx - w / 2 + 4, cy + h / 2 - 4]], fill, stroke: 'line', width: 2, ...visible },
      ...(text ? [label(text, cx, cy + 14, 45, { font: 'serif-display', fit: w * 0.85, ...visible })] : [
        line(cx - w * 0.32, cy - h * 0.15, cx + w * 0.32, cy - h * 0.15),
        line(cx - w * 0.32, cy + h * 0.06, cx + w * 0.22, cy + h * 0.06),
        line(cx - w * 0.32, cy + h * 0.25, cx + w * 0.12, cy + h * 0.25),
      ]),
    ] };
}
function desk() {
  return [
    { type: 'rect', x: 65, y: 590, w: 950, h: 1030, r: 12, fill: 'surface', ...visible },
    line(65, 1580, 1015, 1580, { stroke: 'muted', opacity: 0.3, width: 2 }),
    { type: 'path', d: 'M 72 1514 C 220 1496 436 1521 622 1508 C 792 1499 899 1515 1008 1505', fill: 'none', stroke: 'line', width: 3, ...visible },
  ];
}
function route(y, turn, paint, at = 0.4) {
  return { type: 'group', at: 0, enter: 'none', children: [
    { type: 'path', d: `M 200 ${y} L 390 ${y - turn} L 620 ${y + turn} L 850 ${y - 5}`,
      fill: 'none', stroke: 'bg', width: 90, cap: 'butt', join: 'bevel', at, enter: 'draw', dur: 1.6,
      shadow: { dx: 5, dy: 10, blur: 12, opacity: 0.14 } },
    { type: 'path', d: `M 200 ${y} L 390 ${y - turn} L 620 ${y + turn} L 850 ${y - 5}`,
      fill: 'none', stroke: paint, width: 8, arrow: 'end', head: 25, at: at + 0.25, enter: 'draw', dur: 1.6 },
  ] };
}

export function authorStoryboard(base, revised = false) {
  const sb = structuredClone(base);
  const questions = [paper(430, 770, 570, 185, -7, 'Who is it for?', 0.15),
    paper(620, 1100, 585, 190, 6, 'What must change?', 0.55),
    paper(445, 1390, 560, 185, -3, 'What can wait?', 0.95)];
  if (!revised) questions.push(paper(790, 695, 170, 120, 17, '', 0.3, 'wash2'),
    paper(265, 1030, 200, 145, -22, '', 0.7, 'wash'), paper(830, 1430, 180, 130, 18, '', 1.1, 'wash2'));
  const options = [route(820, 70, 'accent'), route(1240, -70, 'accent2', 0.65),
    paper(285, 650, 190, 105, -6, '', 0.2), paper(790, 1460, 180, 105, 7, '', 0.45)];
  if (!revised) options.push(paper(840, 680, 170, 120, 16, '', 0.2, 'wash2'),
    paper(240, 1100, 180, 135, -18, '', 0.45, 'wash'), paper(820, 1030, 170, 120, 22, '', 0.75, 'wash2'),
    paper(380, 1480, 175, 120, -16, '', 0.95, 'wash'));
  Object.assign(sb, { title: 'Foldwork: bring the messy brief — simulated trajectory',
    logline: 'An original paper workshop turns supplied questions into one clear route.',
    format: { preset: 'vertical', fps: 30 }, theme: brand.theme, type: 'bookish',
    motion: { preset: 'gentle', intensity: 0.5 }, transition: 'cut', backdrop: 'none',
    texture: { grain: 0.16 }, captions: false, music: false, sfx: 'subtle', chrome: false,
    sources: [{ claim: 'Narration and visible service language are supplied approved copy for a fictional studio', source: 'source/original.md, approved narration A1–A5; synthetic simulation only' }],
    continuity: { treatment: 'A paper workshop: cream desk, folded strips, one supplied identity.', camera: 'Top-down with gentle pushes; vertical layout is authored directly.', lighting: 'Soft paper shadows.', motion: 'Paper arrives; a path is selected; the last decision holds.' },
    beats: [
      { id: 'arrive', block: 'canvas', vo: 'Every project starts with a messy brief.', tail: 1.2,
        props: { source, elements: [
          { type: 'image', asset: 'logo', x: 430, y: 195, w: 220, h: 110, fit: 'contain', subject: true, ...visible },
          label('A messy brief.', 540, 475, 86, { at: 0.12, enter: 'wipe', dur: 0.55 }),
          ...desk(),
          { type: 'image', asset: 'whiteboard', x: 145, y: 780, w: 790, h: 494, fit: 'contain', subject: true,
            at: 0.15, enter: 'drop', dur: 0.75, dist: 70, shadow: { dx: 8, dy: 14, blur: 24, opacity: 0.17 } },
          paper(780, 1350, 230, 130, 9, '', 0.75, 'wash2'),
        ] }, camera: { move: 'in', amount: 0.18 } },
      { id: 'questions', block: 'canvas', vo: 'We put the right questions on the table.', tail: 1.4, hold: revised ? 0.8 : 0,
        props: { source, elements: [label('The right questions.', 540, 415, 70, { ...visible }), ...desk(), ...questions] },
        camera: { move: 'in', amount: 0.15 } },
      { id: 'alternatives', block: 'canvas', vo: 'Then we make the alternatives tangible.', tail: 1.4,
        props: { source, elements: [label('Make it tangible.', 540, 415, 74, { ...visible }), ...desk(), ...options] },
        camera: { move: 'in', amount: 0.12 } },
      { id: 'choose', block: 'canvas', vo: 'Choose one direction, and leave with a clear next step.', tail: 1.8, hold: revised ? 2.8 : 0.5,
        props: { source, elements: [
          label('One clear direction.', 540, 430, 74, { ...visible }), ...desk(),
          { type: 'path', d: 'M 210 785 L 420 860 L 620 1120 L 805 1250', fill: 'none', stroke: 'bg', width: 110, cap: 'butt', join: 'bevel',
            at: 0.2, enter: 'draw', dur: 1.5, shadow: { dx: 7, dy: 10, blur: 15, opacity: 0.16 } },
          { type: 'path', d: 'M 210 785 L 420 860 L 620 1120 L 805 1250', fill: 'none', stroke: 'accent', width: 10,
            arrow: 'end', head: 32, at: 0.35, enter: 'draw', dur: 1.5 },
          { type: 'circle', cx: 805, cy: 1250, r: 25, fill: 'accent2', at: 1.4, enter: 'pop', dur: 0.35,
            loop: { type: 'pulse', amount: 0.035, period: 3 } },
          label('Next step', 700, 1450, 44, { font: 'mono', fill: 'accent', at: 1.55, enter: 'wipe', dur: 0.4 }),
        ] }, camera: { move: 'in', amount: 0.12 } },
      { id: 'invite', block: 'canvas', vo: 'Bring us the messy brief.', tail: 1.6, hold: revised ? 2.6 : 0.8,
        props: { source, elements: [
          { type: 'image', asset: 'logo', x: 320, y: 370, w: 440, h: 220, fit: 'contain', subject: true, ...visible },
          label('Foldwork', 540, 745, 74, { at: 0.1, enter: 'wipe', dur: 0.45 }),
          label('Bring us', 540, 1080, 80, { at: 0.25, enter: 'wipe', dur: 0.5 }),
          label('the messy brief.', 540, 1190, 90, { font: 'serif-display-italic', fill: 'accent', at: 0.55, enter: 'wipe', dur: 0.6 }),
          line(385, 1320, 695, 1320, { stroke: 'accent2', width: 4, at: 0.95, enter: 'draw', dur: 0.55 }),
        ] } },
    ],
  });
  return { storyboard: sb, middleObjects: { questions: questions.length, alternatives: options.length,
    total: questions.length + options.length } };
}

export async function runTrajectory(output, phase = 'all') {
  assert.ok(['initial', 'revised', 'all'].includes(phase), 'phase is initial, revised or all');
  output = path.resolve(output);
  const saved = path.join(output, 'trajectory.json');
  const free = fs.statfsSync(repo); if (free.bavail * free.bsize < 20 * 2 ** 30) throw new Error('Keep 20 GiB free before rendering the trajectory.');
  if (phase !== 'revised' && fs.existsSync(saved)) throw new Error('Trajectory already exists; choose a new output or use --phase revised.');
  if (phase === 'revised' && !fs.existsSync(saved)) throw new Error('Run the initial phase first.');
  fs.mkdirSync(output, { recursive: true }); fs.mkdirSync(path.join(output, 'logs'), { recursive: true });
  const report = phase === 'revised' ? read(saved) : { version: 1, simulation: true,
    status: 'running', startedAt: new Date().toISOString(), replayTimingNotice: 'Fixture generation and authored-storyboard replay are not original creative authoring time. Live-session timing is recorded separately.',
    turns, approaches, milestones: [], runs: [], friction: [] };
  const save = () => json(saved, report);
  function command(name, args) {
    const at = new Date().toISOString(), t = performance.now();
    const result = spawnSync(process.execPath, [cli, ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const seconds = (performance.now() - t) / 1000;
    fs.writeFileSync(path.join(output, 'logs', name + '.stdout'), result.stdout ?? '');
    fs.writeFileSync(path.join(output, 'logs', name + '.stderr'), result.stderr ?? '');
    report.milestones.push({ kind: 'actual-cli', name, command: ['node', 'engine/cli.mjs', ...args], at, seconds, exitCode: result.status }); save();
    if (result.status !== 0) throw new Error(`${name}: ${result.error?.message ?? result.stderr}`);
    return result;
  }
  const fixtures = path.join(output, 'supplied');
  try {
    if (phase !== 'revised') {
      const t = performance.now(); report.inputs = createFixtures(fixtures);
      report.milestones.push({ kind: 'replay-fixture-generation', seconds: (performance.now() - t) / 1000, countsAsCreativeAuthoring: false });
      json(path.join(output, 'simulated-turns.json'), turns); json(path.join(output, 'approaches.json'), approaches);
      fs.writeFileSync(path.join(output, 'DIRECTION.md'), '# Simulated direction decision\n\n' + approaches.map(a =>
        `## ${a.id}${a.selected ? ' — selected' : ''}\n\n${a.story}\n\nPicture: ${a.picture}\nEdit: ${a.edit}\nPace: ${a.pace}\n${a.reason ? '\nReason: ' + a.reason + '\n' : ''}`).join('\n') +
        '\nTurn 2 selects the original paper workshop. Turn 3 removes decorative objects while retaining meaningful questions and alternatives, then extends the selected-route hold. No human acceptance is claimed.\n');
    }
    for (const variant of phase === 'all' ? ['initial', 'revised'] : [phase]) {
      if (report.runs.some(r => r.variant === variant)) throw new Error(`${variant} evidence already exists; keep it and use a fresh trajectory for another replay.`);
      const project = path.join(output, variant);
      command(variant + '-start', ['start', project, '--idea', 'Turn a messy brief into one clear direction in a paper workshop.',
        '--document', path.join(fixtures, 'approved-copy.md'), '--brand', path.join(fixtures, 'brand.json'),
        '--audience', 'People preparing a design project', '--takeaway', 'Bring Foldwork the messy brief', '--vertical', '--json']);
      const t = performance.now(), authored = authorStoryboard(read(path.join(project, 'storyboard.json')), variant === 'revised');
      json(path.join(project, 'storyboard.json'), authored.storyboard);
      json(path.join(output, variant + '-authored-storyboard.json'), authored.storyboard);
      report.milestones.push({ kind: 'authored-variant-replay', variant, seconds: (performance.now() - t) / 1000, countsAsCreativeAuthoring: false });
      const claims = authored.storyboard.beats.map((beat, i) => ({ beat: beat.id, narration: beat.vo, approvedSource: `supplied/approved-copy.md#A${i + 1}`, status: 'supplied fictional copy', visibleSource: beat.props.source }));
      json(path.join(project, 'source-to-claim.json'), claims);
      fs.copyFileSync(path.join(output, 'DIRECTION.md'), path.join(project, 'DIRECTION.md'));
      if (variant === 'revised') {
        const first = report.runs.find(r => r.variant === 'initial'); assert.ok(first, 'a revision needs its first pass');
        const initialSB = read(path.join(output, 'initial-authored-storyboard.json'));
        assert.deepEqual(authored.storyboard.beats.map(b => [b.id, b.vo]), initialSB.beats.map(b => [b.id, b.vo]), 'revision keeps approved narration');
        fs.cpSync(path.join(first.project, 'assets/vo'), path.join(project, 'assets/vo'), { recursive: true });
        assert.equal(authored.middleObjects.total * 2, first.middleObjects.total, 'the revision removes half the middle objects');
      }
      const pipeline = JSON.parse(command(variant + '-pipeline', ['pipeline', project, '--draft', '--scale', '0.5', '--json']).stdout);
      assert.equal(pipeline.status, 'ready-for-review'); assert.equal(pipeline.check.errors.length, 0);
      assert.ok(!pipeline.qa.findings.some(f => f.level === 'error'));
      const receipt = read(path.join(project, 'intake.json'));
      const originalLogo = receipt.assets.find(a => a.id === 'logo').original;
      assert.ok(originalLogo, 'SVG intake retains its original provenance');
      assert.equal(originalLogo.sha256, sha(logoSVG));
      assert.equal(fs.readFileSync(path.join(project, originalLogo.file), 'utf8'), logoSVG, 'the supplied SVG bytes survive unchanged');
      const assets = authored.storyboard.assets.map(a => ({ id: a.id, file: a.file, sha256: sha(fs.readFileSync(path.join(project, a.file))) }));
      assert.equal(assets.find(a => a.id === 'whiteboard').sha256, sha(whiteboardPNG()));
      assert.ok(authored.storyboard.beats[0].props.elements.some(e => e.asset === 'logo'));
      assert.ok(authored.storyboard.beats.at(-1).props.elements.some(e => e.asset === 'logo'));
      assert.equal(authored.storyboard.beats.filter(b => b.block === 'canvas').length, authored.storyboard.beats.length);
      const voiceHashes = Object.fromEntries(Object.entries(pipeline.inputs.hashes).filter(([file]) => file.startsWith('assets/vo/')));
      if (variant === 'revised') {
        const first = report.runs.find(r => r.variant === 'initial');
        const originalHashes = Object.fromEntries(Object.entries(first.pipeline.inputs.hashes).filter(([file]) => file.startsWith('assets/vo/')));
        assert.deepEqual(voiceHashes, originalHashes, 'revision reuses the same audio and timing bytes');
        assert.ok(pipeline.check.duration >= 25 && pipeline.check.duration <= 30, 'revised film meets the requested duration');
      }
      report.runs.push({ variant, project, middleObjects: authored.middleObjects, pipeline, intake: receipt, assets, claims,
        revisionCause: variant === 'revised' ? 'Simulated turn 3: remove half the middle objects; hold the selected route and final identity.' : null });
      report.status = variant === 'initial' ? 'initial-ready-for-visual-review' : 'revised-ready-for-visual-review'; save();
      console.log(`${variant}: ${pipeline.status}, ${pipeline.seconds.toFixed(1)} CLI pipeline seconds; ${authored.middleObjects.total} middle objects`);
    }
  } catch (error) { report.status = 'failed'; report.error = error.message; throw error; }
  finally { report.lastReplayFinishedAt = new Date().toISOString(); save(); }
  return report;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true,
    options: { phase: { type: 'string', default: 'all' }, 'write-fixtures': { type: 'boolean', default: false } } });
  if (!positionals[0]) throw new Error('Usage: workshop.mjs OUTPUT [--phase initial|revised|all] [--write-fixtures]');
  if (values['write-fixtures']) createFixtures(path.resolve(positionals[0]));
  else await runTrajectory(positionals[0], values.phase);
}
