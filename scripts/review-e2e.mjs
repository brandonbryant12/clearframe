#!/usr/bin/env node
// End-to-end check of the review and edit loop on a local, free fixture, through the CLI:
// a two-speaker "podcast" spoken by the OS voices (macOS `say`), word timestamps from local
// Whisper, then ingest → paper edit → rough cut → note → candidate across a transition →
// acceptance → a sentence cut (the film gets shorter) → candidate → rejection → pause
// tightening and undo → a full compare. It checks frame counts, byte identity after undo and
// the notes' states, and writes REPORT.md + report.json with every timing.
//
// Decisions in this run are made by the script and recorded as `scripted-e2e`; they stand
// in for a person's replies and are not anyone's real review. The voices are synthetic: this
// is not listening evidence, and the timings describe this machine and this fixture only.
//
//   codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 node scripts/review-e2e.mjs OUT_DIR
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const OUT = path.resolve(process.argv[2] ?? path.join(ROOT, 'build', 'review-e2e'));
if (fs.existsSync(path.join(OUT, 'film', 'storyboard.json'))) throw new Error(`${OUT} already has a run; choose a new directory.`);
fs.mkdirSync(OUT, { recursive: true });
const FILM = path.join(OUT, 'film');
const BY = ['--by', 'scripted-e2e'];
const steps = [];
const env = { ...process.env, CLEARFRAME_HEAVY_HELD: '1' };

function step(name, cmd, args, { allowFail = false } = {}) {
  const t0 = performance.now();
  const r = spawnSync(cmd, args, { cwd: ROOT, env, encoding: 'utf8', maxBuffer: 1 << 26 });
  const seconds = (performance.now() - t0) / 1000;
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.replace(/^.*NO_COLOR.*\n|^\(Use `node --trace-warnings.*\n/gm, '');
  steps.push({ name, seconds: Math.round(seconds * 100) / 100, status: r.status, tail: out.split('\n').filter(l => !/^frames |%\)|^rendering|^encoding|^wrote|\[Beat\]/.test(l)).slice(-14).join('\n') });
  console.log(`\n## ${name} (${seconds.toFixed(1)} s, exit ${r.status})\n${steps.at(-1).tail}`);
  if (r.status !== 0 && !allowFail) throw new Error(`${name} failed:\n${out.slice(-3000)}`);
  return out;
}
const cf = (name, ...args) => step(name, process.execPath, [path.join(ROOT, 'engine/cli.mjs'), ...args]);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sb = () => JSON.parse(fs.readFileSync(path.join(FILM, 'storyboard.json'), 'utf8'));
const save = s => fs.writeFileSync(path.join(FILM, 'storyboard.json'), JSON.stringify(s, null, 2) + '\n');
const timeline = id => JSON.parse(fs.readFileSync(path.join(FILM, 'review/revisions', id, 'timeline.json'), 'utf8'));
const latest = () => {
  const dir = path.join(FILM, 'review/revisions');
  return fs.readdirSync(dir).sort().at(-1);
};
const frames = f => Number(spawnSync('ffprobe', ['-v', 'error', '-count_frames', '-select_streams', 'v:0', '-show_entries', 'stream=nb_read_frames', '-of', 'csv=p=0', f], { encoding: 'utf8' }).stdout.trim());
const checks = [];
const check = (what, ok, detail = '') => {
  checks.push({ what, ok: !!ok, detail });
  console.log(`${ok ? '✓' : '✗'} ${what}${detail ? ` — ${detail}` : ''}`);
};

// ------------------------------------------------------------------ 1. the recording
const LINES = [
  ['HOST', 'Samantha', 'Welcome back. Today we are talking about queues, the lines we wait in every day.'],
  ['GUEST', 'Daniel', 'Thanks for having me. Queues are everywhere, and almost nobody sees how they work.'],
  ['HOST', 'Samantha', 'So what actually makes a line grow?'],
  ['GUEST', 'Daniel', 'Work arrives faster than it leaves. That is the whole story, really.'],
  ['HOST', 'Samantha', 'Um, that sounds too simple.'],
  ['GUEST', 'Daniel', 'It is simple, but the effect is not. When a desk is ninety percent busy, the wait does not grow a little. It explodes.'],
  ['HOST', 'Samantha', 'Explodes how?'],
  ['GUEST', 'Daniel', 'At half load you barely wait. At ninety percent, the same desk makes people wait many times longer.'],
  ['HOST', 'Samantha', 'Honestly, I once spent an hour reading about airport security lines, which is a story for another day.', 2.4],
  ['GUEST', 'Daniel', 'Airports are a perfect example. One slow scanner and the whole hall backs up.'],
  ['HOST', 'Samantha', 'So what do you do about it?'],
  ['GUEST', 'Daniel', 'Measure the wait, not just the work. Then keep a little slack, so one bad hour does not ruin the day.'],
  ['HOST', 'Samantha', 'Slack sounds like waste.'],
  ['GUEST', 'Daniel', 'It looks like waste on a spreadsheet. In a queue, it is the thing that keeps the line short.'],
  ['HOST', 'Samantha', 'That is a good place to stop. Thank you.'],
];
const src = path.join(OUT, 'source');
fs.mkdirSync(src, { recursive: true });
const parts = [];
const t0 = performance.now();
for (const [i, [, voice, text, pause = 0.6]] of LINES.entries()) {
  const aiff = path.join(src, `line-${i}.aiff`),
    wav = path.join(src, `line-${i}.wav`);
  const r = spawnSync('say', ['-v', voice, '-r', '175', '-o', aiff, text]);
  if (r.status !== 0) throw new Error('macOS say is needed for this fixture.');
  spawnSync('ffmpeg', ['-v', 'error', '-y', '-i', aiff, '-af', `apad=pad_dur=${pause}`, '-ar', '48000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
  parts.push(wav);
}
const episode = path.join(src, 'episode.wav');
fs.writeFileSync(path.join(src, 'list.txt'), parts.map(p => `file '${p}'`).join('\n'));
spawnSync('ffmpeg', ['-v', 'error', '-y', '-f', 'concat', '-safe', '0', '-i', path.join(src, 'list.txt'), '-c', 'copy', episode]);
fs.writeFileSync(path.join(src, 'script.txt'), LINES.map(([who, , text]) => `${who}: ${text}`).join('\n') + '\n');
steps.push({ name: 'synthesize the recording (say)', seconds: Math.round((performance.now() - t0) / 10) / 100, status: 0 });
const words = path.join(src, 'episode.json');
step('measure words (local Whisper, base)', 'whisper', [episode, '--model', 'base', '--word_timestamps', 'True', '--output_format', 'json', '--output_dir', src, '--fp16', 'False', '--language', 'en']);
check('Whisper word file', fs.existsSync(words));

// ------------------------------------------------------------------ 2. plan and rough cut
cf('ingest the recording', 'ingest', FILM, '--audio', episode, '--words', words, '--script', path.join(src, 'script.txt'), '--speakers', 'HOST=Maya:Host,GUEST=Sam:Guest');
// The agent's plan, kept small: chapters, a dissolve at the turn, and two pictures declared as
// placeholders (so the rough cut shows where drawings will go without drawing them yet).
const plan = sb();
const n = plan.beats.length;
plan.beats.forEach((b, i) => (b.chapter = i < n / 3 ? 'The question' : i < (2 * n) / 3 ? 'The explosion' : 'What to do'));
const explode = plan.beats.find(b => /ninety percent busy/.test(b.vo)) ?? plan.beats[Math.floor(n / 2)];
explode.placeholder = 'a desk whose queue grows faster as it gets busier';
explode.transition = 'dissolve';
const slack = plan.beats.find(b => /slack/i.test(b.vo) && b !== explode);
if (slack) slack.placeholder = 'a little slack: an empty chair that keeps the line short';
save(plan);
cf('paper edit with suggested cuts', 'paper', FILM, '--suggest-cuts');
const paper = fs.readFileSync(path.join(FILM, 'review/paper-edit.md'), 'utf8');
check('paper edit lists chapters, recording times and a filler suggestion', /## The question/.test(paper) && /Recording: /.test(paper) && /“Um,?”|filler/i.test(paper));
const roughOut = cf('rough cut (draft --rough)', 'draft', FILM, '--rough');
const r1 = latest();
check('rough cut saved a revision with its placeholders', timeline(r1).beats.filter(b => b.placeholder).length >= 1, r1);
const film1 = path.join(FILM, 'build/video.mp4');
check('rough cut decodes to the timeline’s frame count', frames(film1) === timeline(r1).frames, `${frames(film1)} frames`);

// ------------------------------------------------------------------ 3. a picture note → candidate across a transition
const tl1 = timeline(r1);
const target = tl1.beats.find(b => b.id === explode.id);
const at = (target.start + target.end) / 2;
cf('note on the placeholder (keep the voice)', 'note', FILM, 'Draw this: the queue at a busy desk. Keep the voice.', '--at', at.toFixed(2), '--rev', r1, '--keep', 'voice', ...BY);
const draw = sb();
const beat = draw.beats.find(b => b.id === explode.id);
delete beat.placeholder;
beat.block = 'canvas';
const firstWord = target.words[0]?.w ?? '';
beat.props = {
  elements: [
    { type: 'rect', id: 'desk', x: 560, y: 690, w: 800, h: 36, r: 8, fill: 'surface', enter: 'grow-x' },
    ...[0, 1, 2, 3, 4].map(k => ({ type: 'circle', cx: 700 + k * 120, cy: 620, r: 34, fill: k > 2 ? 'accent2' : 'accent', at: 0.4 + k * 0.35 })),
    { type: 'text', text: 'One busy desk', x: 960, y: 810, size: 56, anchor: 'middle', fill: 'ink', ...(firstWord ? { say: firstWord.replace(/[^\p{L}\p{N}'-]/gu, '') } : {}) },
  ],
};
save(draw);
const revise1 = cf('revise: candidate for the picture note', 'revise', FILM, '--note', 'n001');
const r2 = latest();
const p1 = JSON.parse(fs.readFileSync(path.join(FILM, 'review/compare', `${r1}-${r2}`, 'compare.json'), 'utf8'));
const pass1 = p1.passages[0];
check('picture edit: only its beat changed in content', p1.report.beats.filter(b => b.status === 'content').map(b => b.id).join() === explode.id, p1.report.summary.join(' '));
check('picture edit: before and after cover the same frames', JSON.stringify(pass1.before.range.frames) === JSON.stringify(pass1.after.range.frames), JSON.stringify(pass1.after.range.frames));
check('the passage crosses the dissolve into the edited beat', pass1.after.range.frames[0] < target.startFrame && pass1.after.beats.length >= 2, pass1.after.beats.map(b => b.id).join(', '));
check('preview clock verified against directly drawn frames', pass1.after.verified?.every(v => v.psnr >= 35 && (v.neighbour == null || v.neighbour <= v.psnr + 0.5)), JSON.stringify(pass1.after.verified));
check('preview audio is cut from the full mix', pass1.after.audio?.from === 'the full film mix', JSON.stringify(pass1.after.audio?.film));
check('before/after files decode to the passage length', frames(pass1.before.output) === pass1.before.frames && frames(pass1.after.output) === pass1.after.frames);
cf('accept the candidate (scripted stand-in)', 'accept', FILM, r2, '--note', 'n001', ...BY, '--said', 'scripted test acceptance');

// ------------------------------------------------------------------ 4. a sentence cut → candidate with a shorter film
const tl2 = timeline(r2);
const aside = tl2.beats.find(b => /rabbit hole|airport security lines|story for another day/i.test(b.vo?.text ?? ''));
const asideWord = aside.words.find(w => /security/i.test(w.w)) ?? aside.words[Math.floor(aside.words.length / 2)];
cf('note: cut the aside', 'note', FILM, 'Cut this aside, it wanders.', '--at', ((asideWord.t0 + asideWord.t1) / 2).toFixed(2), '--rev', r1, ...BY);
const wavBefore = Object.fromEntries(sb().beats.filter(b => b.vo).map(b => [b.id, sha(path.join(FILM, 'assets/vo', `${b.id}.wav`))]));
cf('cut the sentence the note points at', 'cut', FILM, '--note', 'n002', ...BY);
const notes1 = cf('notes after the cut', 'notes', FILM);
check('the note that asked for the cut is addressed', /n002 open\s+addressed/.test(notes1));
const revise2 = cf('revise: candidate for the cut', 'revise', FILM, '--note', 'n002');
const r3 = latest();
const p2 = JSON.parse(fs.readFileSync(path.join(FILM, 'review/compare', `${r2}-${r3}`, 'compare.json'), 'utf8'));
const pass2 = p2.passages[0];
check('the cut shortens the film by whole frames', p2.report.durationDelta < 0 && Math.abs(timeline(r3).frames - timeline(r2).frames - Math.round(p2.report.durationDelta * 30)) <= 1, `${p2.report.durationDelta} s`);
check('later beats are reported as moved, not changed', p2.report.beats.some(b => b.status === 'shifted') && !p2.report.beats.some(b => b.status === 'content' && b.id !== aside.id && !(b.reasons ?? []).join().includes('words')), p2.report.summary.join(' '));
check('the before passage is longer than the after by the cut', pass2.before.frames - pass2.after.frames === timeline(r2).frames - timeline(r3).frames, `${pass2.before.frames} → ${pass2.after.frames}`);
check('the before passage comes from the earlier revision’s inputs', /stored|re-rendered/.test(pass2.before.from ?? ''), pass2.before.from);
cf('reject the cut (scripted stand-in)', 'reject', FILM, r3, '--note', 'n002', ...BY, '--said', 'scripted test rejection');
const wavAfter = Object.fromEntries(sb().beats.filter(b => b.vo).map(b => [b.id, sha(path.join(FILM, 'assets/vo', `${b.id}.wav`))]));
check('rejecting restores every slice byte for byte', JSON.stringify(wavAfter) === JSON.stringify(wavBefore));
const notes2 = cf('notes after the rejection', 'notes', FILM);
check('the rejected note is open again where it was', /n002 open\s+current/.test(notes2));

// ------------------------------------------------------------------ 5. pauses, undo, a full compare
const pauses = cf('tighten pauses over 1.5 s', 'cut', FILM, '--pauses-over', '1.5', '--keep-pause', '0.6', ...BY);
const id = /^(c\d{3})/m.exec(pauses)?.[1];
if (id && Number(/: (\d+) frame/.exec(pauses)?.[1]) > 0) {
  cf('undo the pause cut', 'uncut', FILM, '--cut', id);
  const wavUndo = Object.fromEntries(sb().beats.filter(b => b.vo).map(b => [b.id, sha(path.join(FILM, 'assets/vo', `${b.id}.wav`))]));
  check('uncut restores the recording byte for byte', JSON.stringify(wavUndo) === JSON.stringify(wavBefore), id);
}
cf('render the current state (draft)', 'preview', FILM, '--rough');
const r4 = latest();
cf('compare the first rough cut with now', 'compare', FILM, r1, r4);
cf('review page', 'page', FILM);
const runlog = JSON.parse(cf('run log', 'runlog', FILM, '--json'));
cf('checkpoints', 'checkpoints', FILM);

// ------------------------------------------------------------------ 6. what a rough cut may relax
// The real frame audit on a separate scratch film: a 10 px source line without a digit stays an
// error under --rough; marked `unfinished`, it is listed as craft; a normal check refuses it.
const AUD = path.join(OUT, 'audit');
fs.mkdirSync(AUD, { recursive: true });
const auditFilm = (extra = {}) =>
  fs.writeFileSync(
    path.join(AUD, 'storyboard.json'),
    JSON.stringify({
      version: 2,
      title: 'Audit regression',
      format: { preset: 'landscape', fps: 30 },
      theme: 'ink',
      transition: 'cut',
      music: false,
      beats: [
        {
          id: 'chart',
          block: 'canvas',
          duration: 3,
          props: {
            elements: [
              { type: 'rect', x: 560, y: 400, w: 800, h: 200, fill: 'accent', enter: 'none' },
              { type: 'text', id: 'src', text: 'Source: City transit survey', x: 960, y: 700, size: 10, anchor: 'middle', fill: 'muted', enter: 'none', ...extra },
            ],
          },
        },
      ],
    }),
  );
const checkJSON = (name, rough) => {
  const t1 = performance.now();
  const r = spawnSync(process.execPath, [path.join(ROOT, 'engine/cli.mjs'), 'check', AUD, ...(rough ? ['--rough'] : [])], { cwd: ROOT, env, encoding: 'utf8' });
  const text = `${r.stdout}`;
  steps.push({ name, seconds: Math.round((performance.now() - t1) / 10) / 100, status: r.status, expected: rough && /unfinished/.test(name) ? 0 : 1 });
  return { status: r.status, report: JSON.parse(text.slice(text.indexOf('{'))) };
};
auditFilm();
let a = checkJSON('check --rough: tiny source line', true);
check('rough: a too-small source line without digits is still an error', a.status === 1 && a.report.errors.some(e => /Source: City transit survey/.test(e)) && !a.report.craft.length, a.report.errors[0]);
auditFilm({ unfinished: 'real source line to come' });
a = checkJSON('check --rough: the same line marked unfinished', true);
check('rough: the same element marked unfinished is listed as craft', a.status === 0 && a.report.craft.length === 1 && /marked unfinished/.test(a.report.craft[0]), a.report.craft[0]);
a = checkJSON('check (final): marked unfinished', false);
check('a normal check refuses an element marked unfinished', a.status === 1 && /marked unfinished/.test(a.report.errors[0]), a.report.errors[0]);

// ------------------------------------------------------------------ report
const report = {
  when: new Date().toISOString(),
  machine: { platform: process.platform, node: process.version },
  fixture: { lines: LINES.length, seconds: timeline(r1).duration, beats: timeline(r1).beats.length },
  revisions: { rough: r1, picture: r2, cut: r3, final: r4 },
  checks,
  steps,
  runlog: { measuredMs: runlog.measuredMs, gapMs: runlog.gapMs, phases: runlog.phases, milestones: runlog.milestones },
  limits: [
    'Synthetic voices (macOS say) and a 15-line script: not a real podcast, not listening evidence.',
    'Decisions were made by this script (scripted-e2e) as stand-ins for a person.',
    'Timings describe this machine, this fixture and a warm renderer; they are not a measurement of the 7-minute run on the other computer.',
  ],
};
fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2) + '\n');
fs.writeFileSync(
  path.join(OUT, 'REPORT.md'),
  [
    `# Review loop end to end (${report.when})`,
    '',
    `Fixture: ${LINES.length} spoken lines, ${report.fixture.seconds.toFixed(1)} s, ${report.fixture.beats} beats after ingest. Revisions: rough ${r1}, picture candidate ${r2}, cut candidate ${r3} (rejected), current ${r4}.`,
    '',
    '## Checks',
    ...checks.map(c => `- ${c.ok ? '✓' : '✗'} ${c.what}${c.detail ? ` — ${c.detail}` : ''}`),
    '',
    '## Steps (wall clock per command)',
    '| step | seconds | exit |',
    '|---|---|---|',
    ...steps.map(s => `| ${s.name} | ${s.seconds} | ${s.status} |`),
    '',
    `Run log: ${(runlog.measuredMs / 1000).toFixed(1)} s measured inside commands; ${(runlog.gapMs / 1000).toFixed(1)} s between them (this script's own work between commands, not authoring).`,
    '',
    '## Limits',
    ...report.limits.map(l => `- ${l}`),
    '',
    'Open film/review/index.html and film/review/compare/*/index.html.',
  ].join('\n') + '\n',
);
console.log(`\n${checks.filter(c => c.ok).length}/${checks.length} checks passed · ${path.join(OUT, 'REPORT.md')}`);
if (checks.some(c => !c.ok)) process.exitCode = 1;
void roughOut;
void revise1;
void revise2;
