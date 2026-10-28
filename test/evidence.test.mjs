// QA and review bind a video to its render receipt and the working copy before trusting it
// (engine/lib/evidence.mjs). Receipts here are the real prepared manifest, as renderProject
// spreads it into VIDEO.json; only the native picture is a stand-in (an encoded test card).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { prepareProjectSync } from '../packages/engine/dist/film/prepare.mjs';
import { finishingSources } from '../packages/engine/dist/film/render.mjs';
import {
  bindVideo,
  recheck,
  evidenceLine,
} from '../packages/engine/dist/engine/lib/evidence.mjs';
import {
  qaProject,
  motionVerdict,
  verdictOutcome,
  moovFirst,
  deliveryFindings,
} from '../packages/engine/dist/engine/lib/qa.mjs';
import * as Schema from 'effect/Schema';
import {
  MotionVerdictSchema,
  VerdictOutcomeSchema,
} from '../packages/engine/dist/engine/lib/qa-assessment.mjs';
import {
  capabilities,
  contractSchema,
} from '../packages/engine/dist/engine/public-contracts.mjs';
import crypto from 'node:crypto';
import { reviewProject } from '../packages/engine/dist/engine/lib/review.mjs';
import { computeTiming } from '../packages/engine/dist/engine/lib/timing.mjs';
import { sha256File } from '../packages/engine/dist/engine/lib/store.mjs';

const HOUSE = {
  colors: {
    bg: '#f4f1ea',
    surface: '#e6e0d4',
    ink: '#1b1b1b',
    muted: '#5e574c',
    accent: '#1f5fbf',
    accent2: '#b5462f',
    positive: '#2f6b3a',
    negative: '#b5462f',
  },
};

function project(t, { text = 'A circle arrives' } = {}) {
  const root = fs.realpathSync(
    fs.mkdtempSync(path.join(os.tmpdir(), 'cf-evidence-')),
  );
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, 'library/palettes'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'library/palettes/house.json'),
    JSON.stringify(HOUSE),
  );
  fs.mkdirSync(path.join(root, 'sounds'));
  // A short cue file the film plays: an input like any other.
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-f',
    'lavfi',
    '-i',
    'sine=f=880:d=0.1',
    '-ac',
    '2',
    path.join(root, 'sounds/hit.wav'),
  ]);
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify(storyboard(text)),
  );
  return root;
}
const storyboard = (text) => ({
  format: { width: 640, height: 360, fps: 30 },
  theme: 'house',
  sfx: 'normal',
  beats: [
    {
      id: 'a',
      block: 'canvas',
      duration: 2,
      sfx: [{ src: 'sounds/hit.wav', at: 0.3 }],
      props: {
        elements: [
          {
            id: 'dot',
            type: 'circle',
            cx: 320,
            cy: 180,
            r: 60,
            fill: 'accent',
            at: 0.3,
            sound: 'click',
          },
          {
            id: 'label',
            type: 'text',
            text,
            x: 320,
            y: 300,
            size: 28,
            anchor: 'middle',
            at: 0.6,
          },
        ],
      },
    },
  ],
});
/** An encoded stand-in for the picture: `card` decides its bytes, `size` its raster. */
function encode(
  file,
  { card = 'testsrc2', size = '640x360', faststart = true } = {},
) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    `${card}${card.includes('=') ? ':' : '='}s=${size}:r=30:d=2`,
    '-c:v',
    'libx264',
    '-threads',
    '2',
    '-pix_fmt',
    'yuv420p',
    ...(faststart ? ['-movflags', '+faststart'] : []),
    file,
  ]);
}
/** What renderProject writes beside a film, for this video and the project as prepared now. */
function receipt(root, video, { profile = 'final', scale = 1 } = {}) {
  const ctx = prepareProjectSync(root, {
    draft: profile !== 'final',
    rough: profile === 'rough',
  });
  const w = scale === 1 ? 640 : Math.round((640 * scale) / 2) * 2,
    h = scale === 1 ? 360 : Math.round((360 * scale) / 2) * 2;
  const r = {
    ...ctx.manifest,
    encoder: 'test card',
    width: w,
    height: h,
    authoredWidth: 640,
    authoredHeight: 360,
    scale,
    fps: 30,
    frames: ctx.job.frames,
    finishingSourceHashes: finishingSources(),
    outputSha256: sha256File(video),
  };
  fs.writeFileSync(`${video}.json`, JSON.stringify(r));
  return r;
}
const film = (root) => path.join(root, 'build/video.mp4');
const identity = (q) => q.findings.filter((f) => f.kind === 'identity');

test('a final and a reduced draft render are bound to their receipt, and qa records what it checked', async (t) => {
  const root = project(t);
  encode(film(root));
  const r = receipt(root, film(root));
  assert.ok(
    r.hashes['sounds/hit.wav'],
    'the cue file the film plays is a hashed input',
  );
  const q = await qaProject(root);
  assert.equal(q.evidence.scope, 'bound');
  assert.equal(q.evidence.coverage, 'full');
  assert.deepEqual(identity(q), []);
  const saved = JSON.parse(fs.readFileSync(path.join(q.dir, 'qa.json')));
  assert.equal(saved.evidence.videoSha256, sha256File(film(root)));
  assert.equal(saved.evidence.inputId, r.inputId);
  assert.ok(
    saved.evidence.checked.includes('prepared job') &&
      saved.evidence.checked.includes('bytes rechecked after analysis'),
  );
  assert.equal(saved.summary.evidence, 'bound');
  // A bound film with nothing wrong reads READY; the same video without its receipt never does.
  assert.equal(motionVerdict(root, q).ready, true);
  // A half-size draft is measured at its own size, from a receipt bound to it.
  const draft = path.join(root, 'build/draft.mp4');
  encode(draft, { size: '320x180' });
  receipt(root, draft, { profile: 'draft', scale: 0.5 });
  const d = await qaProject(root, { video: draft });
  assert.equal(d.evidence.scope, 'bound');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(d.dir, 'qa.json'))).output.scale,
    0.5,
  );
  assert.ok(
    !d.findings.some((f) => f.kind === 'delivery' && f.level === 'error'),
    'its reduced size is not a delivery error',
  );
});

test('changed bytes, a changed storyboard, a changed cue file or library: each unbinds the receipt', async (t) => {
  const root = project(t);
  encode(film(root));
  receipt(root, film(root));
  // Different pictures, same size and frame count: dimensions prove nothing.
  encode(film(root), { card: 'color=c=white' });
  let q = await qaProject(root);
  assert.equal(q.evidence.scope, 'invalid');
  assert.match(identity(q)[0].message, /Video changed since rendering/);
  assert.equal(identity(q)[0].level, 'error');
  assert.equal(motionVerdict(root, q).ready, false);

  encode(film(root));
  receipt(root, film(root));
  // Same frame count, other words.
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify(storyboard('Another line entirely')),
  );
  q = await qaProject(root);
  assert.equal(q.evidence.scope, 'stale');
  assert.ok(
    identity(q).some((f) =>
      /Input changed since rendering: storyboard\.json/.test(f.message),
    ),
  );

  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify(storyboard('A circle arrives')),
  );
  receipt(root, film(root));
  execFileSync('ffmpeg', [
    '-v',
    'error',
    '-y',
    '-f',
    'lavfi',
    '-i',
    'sine=f=220:d=0.4',
    '-ac',
    '2',
    path.join(root, 'sounds/hit.wav'),
  ]);
  q = await qaProject(root);
  assert.equal(q.evidence.scope, 'stale');
  assert.ok(
    identity(q).some((f) =>
      /Input changed since rendering: sounds\/hit\.wav/.test(f.message),
    ),
  );

  receipt(root, film(root));
  // A palette edit changes the film without changing any hashed file: the prepared job catches it.
  fs.writeFileSync(
    path.join(root, 'library/palettes/house.json'),
    JSON.stringify({ colors: { ...HOUSE.colors, accent: '#c2241b' } }),
  );
  q = await qaProject(root);
  assert.equal(q.evidence.scope, 'stale');
  assert.ok(
    identity(q).some((f) =>
      /film the working copy would draw has changed/.test(f.message),
    ),
  );
});

test('an absent receipt is unbound diagnostics; a malformed or foreign one is an error, never trusted', async (t) => {
  const root = project(t);
  encode(film(root));
  receipt(root, film(root));
  fs.rmSync(`${film(root)}.json`);
  let q = await qaProject(root);
  assert.equal(q.evidence.scope, 'unbound');
  assert.deepEqual(
    identity(q).map((f) => f.level),
    ['warn'],
  );
  const v = motionVerdict(root, q);
  assert.equal(v.ready, false);
  assert.match(v.lines[0], /NOT READY \(unbound evidence\)/);
  assert.match(v.lines.join('\n'), /evidence: UNBOUND/);
  await assert.rejects(reviewProject(root), /No render receipt/);

  for (const [body, why] of [
    ['{invalid', /not readable JSON/],
    [JSON.stringify(['not', 'a', 'receipt']), /not a receipt object/],
    [JSON.stringify({ hashes: {} }), /records no output hash/],
    [
      JSON.stringify({
        kind: 'range-preview',
        range: { frames: [0, 30] },
        outputSha256: sha256File(film(root)),
      }),
      /range preview/,
    ],
    [
      JSON.stringify({
        outputSha256: sha256File(film(root)),
        frames: 60,
        fps: 30,
      }),
      /records no input hashes/,
    ],
    [
      JSON.stringify({
        outputSha256: sha256File(film(root)),
        hashes: { 'storyboard.json': 'x', '../outside.txt': 'y' },
        frames: 60,
        fps: 30,
      }),
      /outside the project/,
    ],
  ]) {
    fs.writeFileSync(`${film(root)}.json`, body);
    q = await qaProject(root);
    assert.equal(q.evidence.scope, 'invalid', body);
    assert.ok(
      identity(q).some((f) => f.level === 'error' && why.test(f.message)),
      `${body}: ${identity(q).map((f) => f.message)}`,
    );
    assert.equal(motionVerdict(root, q).ready, false);
    await assert.rejects(reviewProject(root), why);
  }
});

test('review refuses a stale render; an older receipt binds with what it cannot establish named', async (t) => {
  const root = project(t);
  encode(film(root));
  const r = receipt(root, film(root));
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify(storyboard('Edited after the render')),
  );
  await assert.rejects(
    reviewProject(root),
    /Input changed since rendering: storyboard\.json/,
  );
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify(storyboard('A circle arrives')),
  );
  // A receipt from before job, renderer and finishing identity were recorded.
  const {
    jobSha256,
    rendererSourceHash,
    finishingSourceHashes,
    fontHashes,
    ...old
  } = r;
  fs.writeFileSync(`${film(root)}.json`, JSON.stringify(old));
  const e = bindVideo(root, film(root), { timing: computeTiming(root) });
  assert.equal(e.scope, 'bound');
  assert.equal(e.coverage, 'partial');
  assert.ok(
    e.unchecked.some((u) => /prepared job/.test(u)) &&
      e.unchecked.some((u) => /renderer source/.test(u)),
  );
  assert.match(
    evidenceLine(e),
    /bound \(partial: an older receipt\).*not checked: .*prepared job/,
  );
});

test('a video or receipt replaced while it is measured unbinds the measurement', async (t) => {
  const root = project(t);
  encode(film(root));
  receipt(root, film(root));
  const e = bindVideo(root, film(root), { timing: computeTiming(root) });
  assert.equal(e.scope, 'bound');
  encode(film(root), { card: 'color=c=white' });
  assert.match(recheck(e), /video changed while it was being measured/);
  assert.equal(e.scope, 'invalid');
  encode(film(root));
  receipt(root, film(root));
  const again = bindVideo(root, film(root), { timing: computeTiming(root) });
  fs.appendFileSync(`${film(root)}.json`, ' ');
  assert.match(recheck(again), /receipt changed/);
});

test('delivery: an index after the media and a sound that could not be metered are reported', async (t) => {
  const root = project(t);
  const late = path.join(root, 'late.mp4');
  encode(late, { faststart: false });
  encode(film(root));
  assert.equal(moovFirst(late), false);
  assert.equal(moovFirst(film(root)), true);
  const probe = {
    streams: [
      {
        codec_type: 'video',
        width: 640,
        height: 360,
        avg_frame_rate: '30/1',
        nb_frames: '60',
        pix_fmt: 'yuv420p',
        sample_aspect_ratio: '1:1',
        color_primaries: 'bt709',
        color_transfer: 'bt709',
        color_space: 'smpte170m',
        duration: '2',
      },
      { codec_type: 'audio', duration: '2' },
    ],
  };
  const geometry = { fps: 30, frames: 60, width: 640, height: 360 };
  assert.ok(
    deliveryFindings(probe, { ...geometry, loudness: null }).some(
      (f) => f.level === 'error' && /could not be measured/.test(f.message),
    ),
  );
  assert.ok(
    deliveryFindings(probe, {
      ...geometry,
      loudness: { integrated: -14, peak: null },
    }).some((f) => /true peak not reported/.test(f.message)),
  );
  assert.ok(
    deliveryFindings(probe, {
      ...geometry,
      loudness: { integrated: -14, peak: -2 },
      moovFirst: false,
    }).some((f) => /moov/.test(f.message)),
  );
  assert.deepEqual(
    deliveryFindings(probe, {
      ...geometry,
      loudness: { integrated: -14, peak: -2 },
      moovFirst: true,
    }),
    [],
  );
});

test('the qa command fails a broken binding in both output modes; unbound diagnostics only warn', async (t) => {
  const root = project(t);
  encode(film(root));
  receipt(root, film(root));
  const cli = path.resolve('packages/engine/dist/engine/cli.mjs');
  const run = (...args) =>
    spawnSync(process.execPath, [cli, 'qa', root, ...args], {
      encoding: 'utf8',
    });
  for (const args of [[], ['--json']])
    assert.equal(run(...args).status, 0, `bound ${args}`);
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify(storyboard('Edited after the render')),
  );
  for (const args of [[], ['--json']]) {
    const r = run(...args);
    assert.equal(r.status, 1, `stale ${args}: ${r.stderr}`);
    if (args.length) assert.equal(JSON.parse(r.stdout).evidence.scope, 'stale');
  }
  fs.writeFileSync(`${film(root)}.json`, '{invalid');
  for (const args of [[], ['--json']])
    assert.equal(run(...args).status, 1, `invalid ${args}`);
  fs.rmSync(`${film(root)}.json`);
  const unbound = run('--json');
  assert.equal(unbound.status, 0);
  assert.equal(JSON.parse(unbound.stdout).evidence.scope, 'unbound');
});

test('finishing identity includes the authored sound implementation and audio mixer', () => {
  const hashes = finishingSources();
  for (const file of [
    'film/sound-authored.mjs',
    'film/sound-select.mjs',
    'engine/lib/audio.mjs',
  ]) {
    assert.match(
      hashes[file],
      /^[a-f0-9]{64}$/,
      `${file} must affect render identity`,
    );
  }
});

/** The film asks for 3 s and runs 2 s: long enough to be ready, short enough to compare facts. */
function shortOfRequest(t) {
  const root = project(t);
  fs.writeFileSync(
    path.join(root, 'storyboard.json'),
    JSON.stringify({ ...storyboard('A circle arrives'), length: 3 }),
  );
  fs.mkdirSync(path.join(root, 'source'));
  return root;
}
const checkOf = (verdict, id) =>
  verdict.assessment.checks.find((c) => c.id === id);

test('the verdict records what it assessed; a check that could not run is reported, not passed', async (t) => {
  const root = shortOfRequest(t);
  encode(film(root));
  receipt(root, film(root));
  let v = motionVerdict(root, await qaProject(root));
  // Contract: the verdict is its schema, and readiness is the absence of a blocking check.
  assert.deepEqual(Schema.decodeUnknownSync(MotionVerdictSchema)(v), v);
  assert.equal(v.ready, !v.assessment.checks.some((c) => c.blocking));
  assert.deepEqual(v.assessment.identity, {
    scope: 'bound',
    coverage: 'full',
    unchecked: [],
  });
  assert.equal(v.assessment.sampling.frames, 60);
  assert.ok(
    v.assessment.sampling.width > 0 && v.assessment.sampling.height > 0,
  );
  assert.ok(v.assessment.unassessed.some((c) => /acceptance/.test(c)));
  assert.ok(v.assessment.unassessed.some((c) => /legibility/.test(c)));
  assert.deepEqual(checkOf(v, 'source-omissions'), {
    id: 'source-omissions',
    question: checkOf(v, 'source-omissions').question,
    status: 'skipped',
    blocking: false,
    reason: 'no source documents in source/',
  });
  const readyWithoutSource = v.ready;

  // A source document that cannot be read (a moved file behind a link) used to read as
  // "nothing dropped". It is now unavailable, named in the verdict, and changes no readiness.
  fs.symlinkSync(
    path.join(root, 'moved-away.md'),
    path.join(root, 'source/brief.md'),
  );
  v = motionVerdict(root, await qaProject(root));
  const omissions = checkOf(v, 'source-omissions');
  assert.equal(omissions.status, 'unavailable');
  assert.match(omissions.reason, /ENOENT/);
  assert.equal(v.ready, readyWithoutSource);
  assert.ok(
    v.lines.some((l) => /not assessed: source-omissions/.test(l)),
    v.lines.join('\n'),
  );

  // Readable sources are compared: a sourced figure the film never says is a finding.
  fs.rmSync(path.join(root, 'source/brief.md'));
  fs.writeFileSync(
    path.join(root, 'source/brief.md'),
    '# Source\n\n- Enrollment closes after 45 days for 3,200 employees.\n',
  );
  v = motionVerdict(root, await qaProject(root));
  assert.equal(checkOf(v, 'source-omissions').status, 'findings');
  assert.equal(checkOf(v, 'source-omissions').blocking, false);
  assert.equal(checkOf(v, 'delivered-audio').status, 'skipped');
});

test('a verdict that cannot be measured is an explicit outcome in qa --json, never a silent omission', async (t) => {
  const root = shortOfRequest(t);
  encode(film(root));
  receipt(root, film(root));
  const cli = path.resolve('packages/engine/dist/engine/cli.mjs');
  const qa = () =>
    spawnSync(process.execPath, [cli, 'qa', root, '--json'], {
      encoding: 'utf8',
    });
  let r = qa();
  assert.equal(r.status, 0, r.stderr);
  let motion = JSON.parse(r.stdout).motion;
  assert.equal(motion.status, 'measured');
  assert.deepEqual(
    Schema.decodeUnknownSync(VerdictOutcomeSchema)(motion),
    motion,
  );
  assert.equal(typeof motion.verdict.ready, 'boolean');

  // The timeline the verdict reads is gone: QA still measures the file, the verdict says why not.
  const q = await qaProject(root);
  fs.rmSync(path.join(root, 'build/timing.json'));
  const outcome = verdictOutcome(root, q);
  assert.equal(outcome.status, 'unavailable');
  assert.match(outcome.reason, /timing\.json/);
  r = qa();
  motion = JSON.parse(r.stdout).motion;
  assert.equal(motion.status, 'unavailable');
  const text = spawnSync(process.execPath, [cli, 'qa', root], {
    encoding: 'utf8',
  });
  assert.match(text.stdout.split('\n')[0], /^motion: NOT MEASURED/);
});

/** Decodes `qa --json` output whole, strictly, as the contract the manifest advertises for qa. */
function advertisedQa(stdout) {
  const op = capabilities().operations.find((o) => o.name === 'qa');
  const report = JSON.parse(stdout);
  assert.deepEqual(
    Schema.decodeUnknownSync(contractSchema(op.result))(report, {
      onExcessProperty: 'error',
    }),
    report,
  );
  return report;
}
const hashes = (root) =>
  Object.fromEntries(
    fs
      .readdirSync(root, { recursive: true })
      .map(String)
      .filter((f) => fs.statSync(path.join(root, f)).isFile())
      .map((f) => [
        f,
        crypto
          .createHash('sha256')
          .update(fs.readFileSync(path.join(root, f)))
          .digest('hex'),
      ]),
  );

test('qa --json is exactly its advertised whole report, and writes only what the manifest declares', async (t) => {
  const root = shortOfRequest(t);
  encode(film(root));
  receipt(root, film(root));
  const cli = path.resolve('packages/engine/dist/engine/cli.mjs');
  const qa = (...args) =>
    spawnSync(process.execPath, [cli, 'qa', root, '--json', ...args], {
      encoding: 'utf8',
    });
  const before = hashes(root);
  const bound = advertisedQa(qa().stdout);
  assert.equal(bound.evidence.scope, 'bound');
  assert.equal(bound.motion.status, 'measured');
  // qa replaces the project's QA artifacts: a write, and only under build/qa.
  const after = hashes(root);
  const changed = Object.keys(after).filter((f) => after[f] !== before[f]);
  const op = capabilities().operations.find((o) => o.name === 'qa');
  assert.equal(op.effect, 'write');
  assert.ok(op.writes.some((w) => w.includes('build/qa/qa.json')));
  assert.ok(op.writes.some((w) => w.includes('review/runlog.jsonl')));
  for (const name of ['qa.json', 'timeline.png', 'phone.png'])
    assert.ok(changed.includes(path.join('build/qa', name)), name);
  // Nothing else: every changed file is one the manifest names.
  assert.deepEqual(
    changed.filter(
      (f) =>
        !f.startsWith(`build${path.sep}qa${path.sep}`) &&
        f !== path.join('review', 'runlog.jsonl'),
    ),
    [],
  );
  // The same contract holds for a file with no receipt and for an unmeasurable verdict.
  fs.renameSync(`${film(root)}.json`, path.join(root, 'kept.json'));
  assert.equal(advertisedQa(qa().stdout).evidence.scope, 'unbound');
  fs.renameSync(path.join(root, 'kept.json'), `${film(root)}.json`);
  fs.rmSync(path.join(root, 'build/timing.json'));
  assert.equal(advertisedQa(qa().stdout).motion.status, 'unavailable');
});
