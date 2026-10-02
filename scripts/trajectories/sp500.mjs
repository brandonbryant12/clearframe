#!/usr/bin/env node
// Replay an authored real-source film from a frozen local source kit.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const json = (f, x) => fs.writeFileSync(f, JSON.stringify(x, null, 2) + '\n');
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const show = { at: 0, enter: 'none' };
const text = (text, x, y, size = 48, extra = {}) => ({ type: 'text', text, x, y, size, font: 'display', fill: 'ink', fit: 1500, ...show, ...extra });
const line = (x1, y1, x2, y2, stroke = 'line', width = 3, extra = {}) => ({ type: 'line', x1, y1, x2, y2, stroke, width, ...show, ...extra });
const rect = (x, y, w, h, fill, extra = {}) => ({ type: 'rect', x, y, w, h, fill, ...show, ...extra });
const mono = (s, x, y, size = 31, extra = {}) => text(s, x, y, size, { font: 'mono', fill: 'muted', ...extra });
const header = (s) => [mono('MARKET NOTES', 192, 125, 30, { fill: 'accent' }), mono(s, 1728, 125, 29, { anchor: 'end' }), line(192, 165, 1728, 165)];
export const approaches = [
  { id: 'market-console', selected: true, story: 'Trace the five-session path, then inspect three dated macro releases.', picture: 'A native zero-centred price trace; a bond-rate step; a monthly hiring number; factory gauges.', pace: 'Continuous trace, short evidence inserts, quiet synthesis.', reason: 'A restrained navy and mint field gives the data a different visual grammar from the Coca-Cola product world.' },
  { id: 'newsroom-paper', selected: false, story: 'Read the week as a newspaper edition with source clippings and marginal annotations.', picture: 'Warm paper, editorial type and underlined evidence.', pace: 'Measured reading with decisive cuts.' },
  { id: 'economic-weather', selected: false, story: 'A map of competing economic conditions surrounds the price path.', picture: 'An original spatial map with expanding production and cost-pressure zones.', pace: 'One camera world with changes in emphasis.' },
];
export function authorStoryboard(base, facts, revised = false) {
  const source = 'S&P Dow Jones Indices via FRED · closes Sep 24–Oct 1, 2026';
  const sb = structuredClone(base);
  const points = facts.prices.map((p, i) => [360 + i * 252, 570 - p.changeFromBaselinePct * 300]);
  const plot = [
    ...[-0.8, 0, 0.8].flatMap(v => [line(350, 570 - v * 300, 1665, 570 - v * 300, v === 0 ? 'muted' : 'line', v === 0 ? 3 : 2), mono(`${v > 0 ? '+' : ''}${v.toFixed(1)}%`, 315, 580 - v * 300, 26, { anchor: 'end' })]),
    { type: 'path', d: points.map(([x, y], i) => `${i ? 'L' : 'M'} ${x} ${y}`).join(' '), fill: 'none', stroke: 'accent', width: 9, cap: 'round', join: 'round', at: 0.2, enter: 'draw', dur: revised ? 3.2 : 1.8 },
    ...points.flatMap(([x, y], i) => [
      { type: 'circle', cx: x, cy: y, r: i === 5 ? 12 : 7, fill: i === 5 ? 'accent2' : 'accent', at: 0.2 + i * (revised ? 0.55 : 0.3), enter: 'pop', dur: 0.35 },
      mono(['Sep 24', 'Sep 25', 'Sep 28', 'Sep 29', 'Sep 30', 'Oct 1'][i], x, 872, 29, { anchor: 'middle' }),
    ]),
    mono('BASELINE', 360, 915, 24, { anchor: 'middle' }),
  ];
  Object.assign(sb, {
    title: 'Five sessions, three signals — S&P 500 market update',
    logline: 'A modest weekly decline, set beside three dated economic signals.',
    format: { preset: 'landscape', fps: 30 },
    theme: { base: 'ink', bg: '#0b1825', surface: '#142c3c', ink: '#eff5ed', muted: '#a8becb', accent: '#81e2bc', accent2: '#ffc77a', positive: '#81e2bc', negative: '#ffad98' },
    type: 'typewriter', motion: { preset: 'gentle', intensity: 0.65 }, transition: 'cut', backdrop: 'none',
    music: false, sfx: 'subtle', captions: false, chrome: false,
    sources: facts.sources.map(s => ({ claim: s.title, source: s.url })),
    continuity: { treatment: 'Independent Market Notes identity; navy, mint and warm amber.', camera: 'Wide chart, close evidence inserts, paired gauges, final synthesis.', motion: 'Trace data over time; keep reading surfaces steady. No decorative stock chart.' },
    beats: [
      { id: 'opening', block: 'canvas', vo: 'Five completed sessions. A late lift, but the S and P five hundred still finished lower.', tail: 0.7, props: { source, elements: [
        ...header('SEP 25 — OCT 1, 2026'), text('FIVE SESSIONS.', 190, 350, 118, { at: 0.1, enter: 'wipe', dur: 0.55 }),
        text('−0.49%', 175, 688, 265, { font: 'figures', fill: 'accent2', at: 0.45, enter: 'wipe-up', dur: 0.9 }),
        text('S&P 500', 1200, 560, 75), mono('Price index', 1200, 625, 38),
        line(195, 783, 1720, 783, 'accent', 5, { at: 0.6, enter: 'draw', dur: 1.1 }),
        mono('Five daily returns · Sep 24 close → Oct 1 close', 192, 882, 34),
      ] }, camera: { move: 'in', amount: 0.08 } },
      { id: 'price-path', block: 'canvas', vo: 'The price index fell zero point four nine percent, ending October first at seven thousand, six hundred sixty six point four five.', tail: 0.9, props: { source, elements: [
        ...header('PERFORMANCE'), text('The path to 7,666.45', 192, 273, 68),
        ...plot, mono('Change from Sep 24 close · price return', 1720, 921, 27, { anchor: 'end' }),
      ] } },
      { id: 'bonds', block: 'canvas', vo: 'In bonds, the ten year Treasury rate reached five point two nine percent on September thirtieth.', tail: 0.9, props: { source: 'Federal Reserve H.15 via FRED · 10-year constant maturity · daily rates', elements: [
        ...header('BONDS · AS OF SEP 30'), text('A higher financing benchmark', 192, 294, 73),
        mono('Sep 25', 280, 450, 39), text('5.17%', 275, 625, 140, { font: 'figures' }),
        { type: 'path', d: 'M 795 640 L 795 520 L 1090 520 L 1090 400 L 1230 400', fill: 'none', stroke: 'accent', width: 11, arrow: 'end', head: 30, at: 0.3, enter: 'draw', dur: 1.7 },
        mono('Sep 30', 1240, 450, 39), text('5.29%', 1230, 625, 140, { font: 'figures', fill: 'accent', at: 0.8, enter: 'wipe-up', dur: 0.7 }),
        text('+12 basis points', 192, 810, 64, { fill: 'accent2' }),
        mono('Daily observations · latest rate in this source snapshot', 192, 900, 31),
      ] } },
      { id: 'hiring', block: 'canvas', vo: 'On Wednesday, ADP reported ninety thousand additional private sector jobs in September.', tail: 1.0, props: { source: 'ADP National Employment Report · September 2026 · released Sep 30', elements: [
        ...header('HIRING · RELEASED SEP 30'), text('Private hiring grew.', 192, 305, 87),
        text('+90,000', 178, 655, 231, { font: 'figures', fill: 'accent', at: 0.2, enter: 'wipe-up', dur: 1.0 }),
        text('jobs', 1370, 641, 94),
        ...['September', 'Private sector', 'ADP estimate'].flatMap((s, i) => [line(202 + i * 530, 770, 640 + i * 530, 770, 'accent', 4, { at: 0.55 + i * 0.2, enter: 'draw', dur: 0.7 }), mono(s, 202 + i * 530, 849, 35)]),
        mono('Monthly employment change', 192, 919, 27),
      ] }, camera: { move: 'in', amount: 0.08 } },
      { id: 'factories', block: 'canvas', vo: 'On Thursday, ISM showed factories still expanding. Its manufacturing index was fifty four point five. The prices index rose to seventy seven point nine.', tail: 1.0, props: { source: 'ISM September 2026 Manufacturing PMI report · released Oct 1', elements: [
        ...header('FACTORIES · RELEASED OCT 1'), text('Expansion. Cost pressure.', 192, 278, 83),
        ...[['Manufacturing PMI', 54.5, '54.6 in August', 'accent'], ['Prices index', 77.9, '71.1 in August', 'accent2']].flatMap(([s, value, prior, fill], i) => {
          const y = 460 + i * 270;
          return [text(s, 192, y - 38, 47), rect(200, y, 1120, 50, 'surface'), rect(200, y, 1120 * value / 100, 50, fill, { at: 0.3 + i * 0.6, enter: 'grow-x', dur: 1.2 }),
            line(760, y - 10, 760, y + 64, 'ink', 3), mono('0', 200, y + 101, 26), mono('50', 760, y + 101, 26, { anchor: 'middle' }), mono('100', 1320, y + 101, 26, { anchor: 'end' }),
            text(String(value), 1430, y + 43, 102, { font: 'figures', fill }), mono(prior, 1430, y + 111, 26)];
        }),
        mono(revised ? 'PMI above 50: expansion · prices are an index, not an inflation rate' : 'Both measures use a 0–100 index scale.', 192, 920, revised ? 28 : 31),
      ] } },
      { id: 'closing', block: 'canvas', vo: 'The tension: an expanding economy, with higher financing and input costs. Market prices here stop at Thursday’s close.', tail: 1.2, hold: revised ? 1.2 : 0.2, props: { source: 'Editorial synthesis of FRED, ADP and ISM releases · independent recap', elements: [
        ...header('THE WEEK’S TENSION'), text('Growth', 192, 396, 146, { fill: 'accent', at: 0.1, enter: 'wipe', dur: 0.6 }),
        text('meets higher costs.', 192, 573, 127, { at: 0.4, enter: 'wipe', dur: 0.7 }),
        line(200, 676, 1715, 676, 'accent2', 6, { at: 0.65, enter: 'draw', dur: 0.9 }),
        mono('Prices through Oct 1 · news through Oct 1, 2026', 192, 780, 33),
        mono('Five sessions · price return, excluding dividends', 192, 842, 31),
        mono('Independent Market Notes · local synthetic narration', 192, 916, 27),
      ] }, camera: { move: 'in', amount: 0.07 } },
    ],
  });
  // The independent identity is drawn above; a treatment's sample frame brand
  // and progress rail must not leak into the authored film.
  if (revised) { delete sb.frame; delete sb.lens; }
  return sb;
}

export async function run(output, phase = 'initial') {
  output = path.resolve(output); const kit = path.join(output, 'source-kit');
  const facts = read(path.join(kit, 'facts.json')); const reportFile = path.join(output, 'trajectory.json');
  const report = fs.existsSync(reportFile) ? read(reportFile) : { version: 1, status: 'running', startedAt: new Date().toISOString(), approaches, milestones: [], runs: [], replayTimingNotice: 'CLI times exclude original research and creative authoring.' };
  assert.ok(!report.runs.some(r => r.variant === phase), 'Retain prior evidence; choose a fresh trajectory for replay.');
  const disk = fs.statfsSync(repo); assert.ok(disk.bavail * disk.bsize >= 20 * 2 ** 30, 'Keep 20 GiB free before rendering.');
  for (const source of facts.sources) assert.equal(sha(fs.readFileSync(path.join(kit, source.file))), source.sha256, 'Frozen source bytes changed');
  fs.mkdirSync(path.join(output, 'logs'), { recursive: true });
  const save = () => json(reportFile, report);
  const command = (name, args) => {
    const at = new Date().toISOString(), t = performance.now();
    const r = spawnSync(process.execPath, [path.join(repo, 'engine/cli.mjs'), ...args], { cwd: repo, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    fs.writeFileSync(path.join(output, 'logs', name + '.stdout'), r.stdout ?? ''); fs.writeFileSync(path.join(output, 'logs', name + '.stderr'), r.stderr ?? '');
    report.milestones.push({ name, at, seconds: (performance.now() - t) / 1000, exitCode: r.status, command: ['node', 'engine/cli.mjs', ...args] }); save();
    if (r.status !== 0) throw new Error(`${name}: ${r.error?.message ?? r.stderr}`); return r;
  };
  const variant = phase === 'final' ? 'revised' : phase, project = path.join(output, variant);
  try {
    if (phase !== 'final') {
      if (!fs.existsSync(path.join(project, 'storyboard.json')))
        command(phase + '-start', ['start', project, '--idea', 'Trace five completed S&P sessions and explain three dated economic signals.', '--document', path.join(kit, 'research.md'), '--document', path.join(kit, 'sp500.csv'), '--document', path.join(kit, 'dgs10.csv'), '--direction', 'research-mechanism', '--json']);
      const sb = authorStoryboard(read(path.join(project, 'storyboard.json')), facts, phase === 'revised'); json(path.join(project, 'storyboard.json'), sb);
      fs.cpSync(kit, path.join(project, 'source/frozen'), { recursive: true });
      json(path.join(project, 'source-to-claim.json'), facts);
      const direction = '# Five sessions, three signals\n\nIndependent 1080p market recap. Market cutoff: Oct 1, 2026 close. Use source-native numbers and direct labels. The editorial synthesis is not a claim that any single release caused the market move.\n\n' + approaches.map(a => `## ${a.id}${a.selected ? ' — selected' : ''}\n\n${a.story}\n${a.picture}\n${a.pace}\n`).join('\n') + '\nLocal synthetic narration; no paid generation. Review first pass and retain concrete revisions.\n';
      fs.writeFileSync(path.join(project, 'DIRECTION.md'), direction);
      if (phase === 'revised') { assert.ok(report.runs.some(r => r.variant === 'initial')); fs.cpSync(path.join(output, 'initial/assets/vo'), path.join(project, 'assets/vo'), { recursive: true }); }
    }
    const p = JSON.parse(command(phase + '-pipeline', ['pipeline', project, ...(phase === 'final' ? [] : ['--draft', '--scale', '0.5']), '--json']).stdout);
    assert.equal(p.status, 'ready-for-review'); assert.equal(p.check.errors.length, 0); assert.ok(!p.qa.findings.some(f => f.level === 'error'));
    report.runs.push({ variant: phase, project, pipeline: p, revisionCause: phase === 'revised' ? 'Actual first-pass review: remove inherited Spec framing, pace the full price trace, label the PMI interpretation and hold the final cutoff.' : null });
    if (phase === 'final') { assert.equal(p.draft, false); command('rough-captions', ['captions', project, '--draft']); }
    report.status = phase + '-ready-for-review'; delete report.error; console.log(JSON.stringify({ phase, seconds: p.check.duration, pipelineSeconds: p.seconds, artifacts: p.artifacts }, null, 2));
  } catch (e) { report.status = 'failed'; report.error = e.message; throw e; }
  finally { report.lastFinishedAt = new Date().toISOString(); save(); }
  return report;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { values, positionals } = parseArgs({ args: process.argv.slice(2), allowPositionals: true, options: { phase: { type: 'string', default: 'initial' } } });
  assert.ok(positionals[0], 'Usage: sp500.mjs OUTPUT --phase initial|revised|final'); assert.ok(['initial', 'revised', 'final'].includes(values.phase)); await run(positionals[0], values.phase);
}
