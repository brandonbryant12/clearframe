#!/usr/bin/env node
// Round report for agent-made bench films (bench/enterprise briefs, projects in build/bench/rN-*).
// For each project: what the agent chose (format, palette, treatment, type, blocks, worlds, casts,
// stages, transitions), the critique, the encoded film's motion from `qa` (change per second, held
// stretches), how the run went (`runlog`: commands, failures, wall time) and whether the agent left
// a TRAJECTORY.md. A sameness table at the end shows choices repeated across films.
//   node scripts/bench-enterprise.mjs [--round r1] [--qa] [--out build/bench/ENTERPRISE.md] [DIR…]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BENCH = path.join(ROOT, 'build', 'bench');
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name) =>
  args.includes(name) ? args[args.indexOf(name) + 1] : null;
const round = opt('--round');
const out =
  opt('--out') ??
  path.join(BENCH, round ? `ENTERPRISE-${round}.md` : 'ENTERPRISE.md');
const named = args.filter(
  (a, i) => !a.startsWith('--') && !['--round', '--out'].includes(args[i - 1]),
);
const dirs = named.length
  ? named.map((d) => path.resolve(d))
  : fs
      .readdirSync(BENCH)
      .filter((d) => /^r\d+-/.test(d) && (!round || d.startsWith(`${round}-`)))
      .map((d) => path.join(BENCH, d))
      .filter((d) => fs.existsSync(path.join(d, 'storyboard.json')));

const cli = (...a) =>
  spawnSync('node', [path.join(ROOT, 'apps/cli/dist/main.mjs'), ...a], {
    encoding: 'utf8',
    cwd: ROOT,
  });
const json = (...a) => {
  const r = cli(...a);
  try {
    return JSON.parse(r.stdout);
  } catch {
    return null;
  }
};
const read = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
};
const newest = (dir, test) => {
  const hits = [];
  const walk = (d) => {
    for (const e of fs.existsSync(d)
      ? fs.readdirSync(d, { withFileTypes: true })
      : []) {
      const p = path.join(d, e.name);
      if (e.isDirectory() && !['node_modules', 'review'].includes(e.name))
        walk(p);
      else if (test(e.name, p)) hits.push(p);
    }
  };
  walk(dir);
  return (
    hits.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] ??
    null
  );
};
const count = (list) =>
  list.reduce((m, k) => ((m[k] = (m[k] ?? 0) + 1), m), {});
const top = (m, n = 6) =>
  Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k}×${v}`)
    .join(' ');

const rows = dirs.map((dir) => {
  const sb = read(path.join(dir, 'storyboard.json')) ?? {};
  const beats = sb.beats ?? [];
  const blocks = count(beats.map((b) => b.block));
  const format =
    typeof sb.format === 'string'
      ? sb.format
      : (sb.format?.preset ?? 'landscape');
  const devices = [];
  if (beats.some((b) => b.props?.world)) devices.push('world');
  if (beats.some((b) => b.props?.cast)) devices.push('cast');
  if (beats.some((b) => b.block === 'stage' || b.stage) || sb.stages?.length)
    devices.push('stage');
  if (beats.some((b) => b.props?.place || b.place)) devices.push('board');
  if (beats.some((b) => b.plate || b.props?.plates)) devices.push('plate');
  if (beats.some((b) => b.tone)) devices.push('tone');
  if (beats.some((b) => b.art)) devices.push('art');
  if (
    beats.some(
      (b) =>
        b.props?.graph ||
        b.props?.accumulate ||
        b.props?.estimate ||
        b.props?.field,
    )
  )
    devices.push('explain');
  if (
    beats.some(
      (b) =>
        b.props?.chart ||
        b.props?.bars ||
        b.props?.stat ||
        [
          'bars',
          'stat',
          'line',
          'kpis',
          'waffle',
          'donut',
          'ring',
          'delta',
        ].includes(b.block),
    )
  )
    devices.push('chart');
  if (
    (sb.assets ?? []).some(
      (a) => /\.(mp4|mov|webm)$/i.test(a.file ?? '') || a.kind === 'clip',
    )
  )
    devices.push('footage');
  const transitions = count(
    beats.map((b) => b.transition ?? sb.transition ?? 'default'),
  );
  const critique = json('critique', dir, '--json');
  const mp4 = newest(
    dir,
    (n, p) => n.endsWith('.mp4') && !p.includes(`${path.sep}qa${path.sep}`),
  );
  let qa = null;
  const qaFile = newest(dir, (n) => n === 'qa.json');
  if (
    flag('--qa') &&
    mp4 &&
    (!qaFile || fs.statSync(qaFile).mtimeMs < fs.statSync(mp4).mtimeMs)
  )
    cli('qa', dir, '--video', mp4);
  qa = read(newest(dir, (n) => n === 'qa.json') ?? '') ?? null;
  const runlog = json('runlog', dir, '--json');
  const words = beats
    .map((b) => b.vo ?? '')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return {
    name: path.basename(dir),
    dir: path.relative(ROOT, dir),
    title: sb.title ?? '',
    format,
    theme: sb.theme ?? '-',
    treatment: sb.treatment ?? '-',
    type: sb.type ?? '-',
    motion:
      typeof sb.motion === 'string' ? sb.motion : (sb.motion?.preset ?? '-'),
    beats: beats.length,
    words,
    blocks,
    devices,
    transitions,
    film: critique?.summary?.film ?? null,
    warnings: (critique?.findings ?? [])
      .filter((f) => f.level === 'warn' && f.where !== 'check')
      .map((f) => `${f.where}: ${f.message}`),
    mp4: mp4 ? path.relative(ROOT, mp4) : null,
    seconds: qa?.summary?.seconds ?? critique?.summary?.seconds ?? null,
    change: qa?.summary?.changePerSecond ?? null,
    held: qa?.summary?.heldSeconds ?? null,
    commands: runlog?.commands ?? null,
    failed: runlog?.failed ?? null,
    minutes:
      runlog?.wallMs != null ? Math.round(runlog.wallMs / 6000) / 10 : null,
    trajectory: fs.existsSync(path.join(dir, 'TRAJECTORY.md')),
  };
});

const lines = [
  `# Enterprise bench${round ? ` · ${round}` : ''}`,
  '',
  'Agent-made films from `bench/enterprise` briefs. Cinema is `critique`; change/s and held come from `qa` on the encoded film (a held slide sits under 2 change/s; held lists stretches of 2.5 s or more where the picture barely changes under the voice).',
  '',
  '| Film | Format | Look | Beats | Words | Blocks | Devices | Cinema | Change/s | Held s | Cmds (failed) | Min | Log |',
  '|---|---|---|---|---|---|---|---|---|---|---|---|---|',
  ...rows.map((r) =>
    [
      r.name,
      r.format,
      `${r.theme} · ${r.treatment} · ${r.type}`,
      r.beats,
      r.words,
      top(r.blocks),
      r.devices.join(' ') || '—',
      r.film ?? '—',
      r.change ?? '—',
      r.held ?? '—',
      r.commands != null ? `${r.commands} (${r.failed})` : '—',
      r.minutes ?? '—',
      r.trajectory ? 'yes' : 'no',
    ]
      .join(' | ')
      .replace(/^/, '| ')
      .replace(/$/, ' |'),
  ),
  '',
  '## Sameness across films',
  '',
  `- Palettes: ${top(count(rows.map((r) => r.theme)), 12)}`,
  `- Treatments: ${top(count(rows.map((r) => r.treatment)), 12)}`,
  `- Type voices: ${top(count(rows.map((r) => r.type)), 12)}`,
  `- Blocks: ${top(
    rows.reduce(
      (m, r) => (
        Object.entries(r.blocks).forEach(([k, v]) => (m[k] = (m[k] ?? 0) + v)),
        m
      ),
      {},
    ),
    14,
  )}`,
  `- Devices: ${top(count(rows.flatMap((r) => r.devices)), 12)}`,
  `- Transitions: ${top(
    rows.reduce(
      (m, r) => (
        Object.entries(r.transitions).forEach(
          ([k, v]) => (m[k] = (m[k] ?? 0) + v),
        ),
        m
      ),
      {},
    ),
    10,
  )}`,
  '',
  ...rows.flatMap((r) => [
    `## ${r.name}: ${r.title}`,
    '',
    `- ${r.dir} · ${r.mp4 ?? 'no film rendered'}`,
    ...(r.warnings.length
      ? r.warnings.slice(0, 8).map((w) => `- ! ${w}`)
      : ['- critique: no warnings']),
    '',
  ]),
];
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, lines.join('\n'));
fs.writeFileSync(out.replace(/\.md$/, '.json'), JSON.stringify(rows, null, 2));
console.log(out);
