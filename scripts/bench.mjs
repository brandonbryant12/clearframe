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
  // Generated imagery without new spend: a copy of a project whose depth plates are cached.
  {
    name: 'plates-harbor',
    copy: 'build/plates-demo',
    edit: sb => {
      sb.assets[0].ground = 'water';
      sb.sfx = 'subtle';
      // The harbour heard: water at the hull under the line.
      sb.beats[0].sfx = [{ src: 'lap', at: 0.3, volume: 0.5 }];
    },
    why: 'generated depth plates (cached images; no new spend)',
  },
];

const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const strips = !args.includes('--no-strips');
// Sound evidence: a free draft voice and bed, the mixed loudness and a waveform with the cuts
// (grey) and sound cues (accent) marked, so a reviewer can judge the mix from an image.
const sound = !args.includes('--no-sound');
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
const run = (cmd, a) => spawnSync(cmd, a, { cwd: ROOT, encoding: 'utf8' });

/** Integrated loudness, range and true peak of a rendered film. */
function loudness(video) {
  const out = run('ffmpeg', ['-hide_banner', '-i', video, '-af', 'ebur128=peak=true', '-f', 'null', '-']).stderr;
  const tail = out.slice(out.lastIndexOf('Summary:'));
  const num = re => Number(tail.match(re)?.[1]);
  return { lufs: num(/I:\s+(-?[\d.]+) LUFS/), lra: num(/LRA:\s+(-?[\d.]+) LU/), peak: num(/Peak:\s+(-?[\d.]+) dBFS/) };
}

/** The mix as a waveform, cuts as grey lines and sound cues as accent ticks. */
function waveform(dir, video) {
  const timing = JSON.parse(fs.readFileSync(path.join(dir, 'build/timing.json'), 'utf8'));
  // The automatic sound design and each beat's own subject sounds (a brake, a drop).
  const cues = [
    ...JSON.parse(fs.readFileSync(path.join(dir, 'build/cues.json'), 'utf8')),
    ...timing.beats.flatMap(b => (b.sfx ?? []).map(s => ({ name: s.src, t: s.t }))),
  ].sort((a, b) => a.t - b.t);
  const W = 1600,
    H = 260,
    x = t => Math.round((t / timing.duration) * W);
  const marks = [
    ...timing.beats.slice(1).map(b => `drawbox=x=${x(b.start)}:y=0:w=2:h=${H}:color=0x8b949e@0.9:t=fill`),
    ...cues.map(c => `drawbox=x=${x(c.t) - 2}:y=${H - 30}:w=5:h=30:color=orange@1.0:t=fill`),
  ];
  const file = path.join(dir, 'build/waveform.png');
  run('ffmpeg', [
    '-y',
    '-i',
    video,
    '-filter_complex',
    `[0:a]showwavespic=s=${W}x${H}:colors=0x58a6ff:scale=sqrt[w];color=c=0x0d1117:s=${W}x${H}[bg];[bg][w]overlay=format=auto,${marks.join(',')}`,
    '-frames:v',
    '1',
    file,
  ]);
  return fs.existsSync(file) ? { file, cues } : null;
}

fs.mkdirSync(OUT, { recursive: true });
const rows = [];
for (const f of FILMS.filter(f => reportOnly || !only || only.includes(f.name))) {
  const dir = path.join(OUT, f.name);
  if (reportOnly) {
    const crit = cli('critique', dir).stdout;
    const sheet = path.join(dir, 'sheet.png');
    const video = path.join(dir, 'build/video.mp4');
    const check = JSON.parse(cli('check', dir, '--draft').stdout || '{}');
    rows.push({
      ...f,
      score: crit.match(/cinema (\d+)\/100/)?.[1],
      sheet: fs.existsSync(sheet) ? sheet : null,
      strip: latestStrip(dir),
      audio:
        sound && fs.existsSync(path.join(dir, 'build/cues.json'))
          ? { ...loudness(video), wave: waveform(dir, video) }
          : null,
      errors: check.errors ?? [],
      findings: crit.split('\n').slice(1, 6),
    });
    continue;
  }
  fs.rmSync(dir, { recursive: true, force: true });
  if (f.copy) {
    const from = path.join(ROOT, f.copy);
    if (!fs.existsSync(path.join(from, 'storyboard.json'))) {
      rows.push({ ...f, error: `${f.copy} is missing` });
      continue;
    }
    fs.mkdirSync(dir, { recursive: true });
    fs.cpSync(path.join(from, 'assets'), path.join(dir, 'assets'), { recursive: true });
    const sb = JSON.parse(fs.readFileSync(path.join(from, 'storyboard.json'), 'utf8'));
    f.edit?.(sb);
    fs.writeFileSync(path.join(dir, 'storyboard.json'), JSON.stringify(sb, null, 2));
  } else {
    const made = cli('new', dir, ...f.args);
    if (made.status) {
      rows.push({ ...f, error: made.stderr.trim().split('\n').at(-1) });
      continue;
    }
  }
  const crit = cli('critique', dir).stdout;
  const score = crit.match(/cinema (\d+)\/100/)?.[1];
  const sheet = path.join(dir, 'sheet.png');
  const sh = cli('sheet', dir, '--draft', '--out', sheet);
  let strip = null,
    audio = null;
  if (strips && !sh.status) {
    if (sound) {
      cli('voice', dir, '--draft');
      cli('music', dir, '--draft');
    }
    const r = cli('render', dir, '--draft', ...(sound ? [] : ['--no-audio']));
    if (!r.status) {
      strip = cli('review', dir).stdout.match(/(\S+strip\.png)/)?.[1] ?? null;
      const video = path.join(dir, 'build/video.mp4');
      if (sound) audio = { ...loudness(video), wave: waveform(dir, video) };
    }
  }
  const check = JSON.parse(cli('check', dir, '--draft').stdout || '{}');
  rows.push({
    ...f,
    score,
    sheet: fs.existsSync(sheet) ? sheet : null,
    strip,
    audio,
    errors: check.errors ?? [],
    findings: crit.split('\n').slice(1, 6),
  });
  console.log(
    `${f.name.padEnd(20)} cinema ${score ?? '?'}  ${fs.existsSync(sheet) ? 'sheet' : 'NO SHEET'}${strip ? ' + strip' : ''}`,
  );
}

const rel = p => (p ? path.relative(ROOT, p) : '—');
fs.writeFileSync(
  path.join(OUT, 'REPORT.md'),
  `# Review benchmark

Scaffolded from scratch with \`clearframe new\` and drafted for free (local voice estimate, no paid media). Same films every round.

| Film | Why it's here | Cinema | Check | Sheet | Strip (frames around every cut) |
|---|---|---|---|---|---|
${rows.map(r => `| ${r.name} | ${r.why} | ${r.score ?? r.error ?? '?'} | ${r.errors?.length ? `${r.errors.length} errors` : 'passes'} | ${rel(r.sheet)} | ${rel(r.strip)} |`).join('\n')}

Sound is a draft: a local TTS voice in one take and a synthesised bed (the final uses Gemini TTS and a Lyria score). Each waveform marks the cuts (grey) and the sound cues (orange).

| Film | Loudness | Range | True peak | Waveform | Cues |
|---|---|---|---|---|---|
${rows
  .map(
    r =>
      `| ${r.name} | ${r.audio ? `${r.audio.lufs} LUFS` : '—'} | ${r.audio ? `${r.audio.lra} LU` : '—'} | ${r.audio ? `${r.audio.peak} dBFS` : '—'} | ${rel(r.audio?.wave?.file)} | ${
        r.audio?.wave?.cues.map(c => `${c.name} ${c.t.toFixed(1)}s`).join(', ') || '—'
      } |`,
  )
  .join('\n')}

${rows
  .map(
    r =>
      `## ${r.name}\n${
        [...(r.errors ?? []).map(e => `✗ check: ${e}`), ...(r.findings ?? []).filter(Boolean)]
          .map(l => `    ${l}`)
          .join('\n') || '    (no critique findings)'
      }`,
  )
  .join('\n\n')}
`,
);
console.log(`→ ${rel(path.join(OUT, 'REPORT.md'))}`);
