#!/usr/bin/env node
// The review benchmark: a fixed set of films scaffolded from scratch and drafted for free, so
// every review round judges the same thing. For each film: the cinema score, a contact sheet
// and a strip of decoded frames around every cut. Writes build/bench/REPORT.md for a reviewer.
//   node scripts/bench.mjs [--only name,name] [--no-strips]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = path.join(ROOT, 'build', 'bench');
const FILMS = [
  { name: 'data-story', args: ['--playbook', 'data-story'], why: 'a data film from the default report arc' },
  {
    name: 'digest-editorial',
    args: ['--playbook', 'research-digest', '--treatment', 'editorial'],
    why: 'what ingest starts from, in a report look',
  },
  { name: 'concept-explainer', args: ['--playbook', 'concept-explainer'], why: 'what `new` starts from' },
  { name: 'cinematic-explainer', args: ['--treatment', 'cinematic'], why: 'a film look applied to an explainer' },
  { name: 'trailer', args: ['--treatment', 'trailer'], why: 'a genre film' },
  { name: 'cold-open', args: ['--treatment', 'documentary'], why: 'a documentary opening' },
  { name: 'product-reveal', args: ['--treatment', 'keynote'], why: 'a product film' },
  { name: 'title-sequence', args: ['--treatment', 'cutpaper'], why: 'a motion-design opener' },
  { name: 'zoom-journey', args: ['--playbook', 'zoom-journey'], why: 'one continuous camera through scales' },
  { name: 'trailer-vertical', args: ['--treatment', 'trailer', '--vertical'], why: 'a vertical social cut' },
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const strips = !args.includes('--no-strips');
// --report-only rebuilds REPORT.md from the existing renders (after re-running a few films).
const reportOnly = args.includes('--report-only');
const latestStrip = dir => {
  const b = path.join(dir, 'build');
  if (!fs.existsSync(b)) return null;
  const runs = fs
    .readdirSync(b)
    .filter(d => d.startsWith('review-') && fs.existsSync(path.join(b, d, 'strip.png')))
    .map(d => path.join(b, d, 'strip.png'))
    .sort((x, y) => fs.statSync(y).mtimeMs - fs.statSync(x).mtimeMs);
  return runs[0] ?? null;
};
const cli = (...a) => spawnSync('node', [path.join(ROOT, 'engine/cli.mjs'), ...a], { cwd: ROOT, encoding: 'utf8' });

fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const f of FILMS.filter(f => reportOnly || !only || only.includes(f.name))) {
  const dir = path.join(OUT, f.name);
  if (reportOnly) {
    const crit = cli('critique', dir).stdout;
    const sheet = path.join(dir, 'sheet.png');
    rows.push({
      ...f,
      score: crit.match(/cinema (\d+)\/100/)?.[1],
      sheet: fs.existsSync(sheet) ? sheet : null,
      strip: latestStrip(dir),
      findings: crit.split('\n').slice(1, 6),
    });
    continue;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const made = cli('new', dir, ...f.args);
  if (made.status) {
    rows.push({ ...f, error: made.stderr.trim().split('\n').at(-1) });
    continue;
  }
  const crit = cli('critique', dir).stdout;
  const score = crit.match(/cinema (\d+)\/100/)?.[1];
  const sheet = path.join(dir, 'sheet.png');
  const sh = cli('sheet', dir, '--draft', '--out', sheet);
  let strip = null;
  if (strips && !sh.status) {
    const r = cli('render', dir, '--draft', '--no-audio');
    if (!r.status) strip = cli('review', dir).stdout.match(/(\S+strip\.png)/)?.[1] ?? null;
  }
  rows.push({ ...f, score, sheet: fs.existsSync(sheet) ? sheet : null, strip, findings: crit.split('\n').slice(1, 6) });
  console.log(
    `${f.name.padEnd(20)} cinema ${score ?? '?'}  ${fs.existsSync(sheet) ? 'sheet' : 'NO SHEET'}${strip ? ' + strip' : ''}`,
  );
}

const rel = p => (p ? path.relative(ROOT, p) : '—');
fs.writeFileSync(
  path.join(OUT, 'REPORT.md'),
  `# Review benchmark

Scaffolded from scratch with \`clearframe new\` and drafted for free (local voice estimate, no paid media). Same films every round.

| Film | Why it's here | Cinema | Sheet | Strip (frames around every cut) |
|---|---|---|---|---|
${rows.map(r => `| ${r.name} | ${r.why} | ${r.score ?? r.error ?? '?'} | ${rel(r.sheet)} | ${rel(r.strip)} |`).join('\n')}

${rows
  .map(
    r =>
      `## ${r.name}\n${
        (r.findings ?? [])
          .filter(Boolean)
          .map(l => `    ${l}`)
          .join('\n') || '    (no critique findings)'
      }`,
  )
  .join('\n\n')}
`,
);
console.log(`→ ${rel(path.join(OUT, 'REPORT.md'))}`);
