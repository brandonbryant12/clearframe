// Authored sounds play on the renderer's clock, and every sound a film plays is part of its
// identity. Jobs here are real prepared jobs (film/prepare.mjs), not hand-built cue inputs.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { prepareProjectSync } from '../packages/engine/dist/film/prepare.mjs';
import { soundDesign, beatTime } from '../packages/engine/dist/film/sound.mjs';
import {
  SFX,
  cueIdentity,
  resolveCue,
  sfxFile,
} from '../packages/engine/dist/engine/lib/sfx.mjs';
import { workingContent } from '../packages/engine/dist/engine/lib/revisions.mjs';

function project(t, sb) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-sound-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.writeFileSync(path.join(root, 'storyboard.json'), JSON.stringify(sb));
  return root;
}
const VIEW = [0, 0, 1920, 1080];
const canvas = (id, elements, extra = {}) => ({
  id,
  block: 'canvas',
  duration: 3,
  props: { elements, ...extra },
});
const cues = (root) => {
  const ctx = prepareProjectSync(root, { draft: true });
  return soundDesign(ctx.job, ctx.sb.sfx);
};

test('a world carries earlier drawings forward without playing their sounds again', (t) => {
  const root = project(t, {
    format: { width: 1920, height: 1080, fps: 30 },
    sfx: 'normal',
    beats: [
      canvas(
        'one',
        [
          {
            id: 'bell',
            type: 'circle',
            cx: 400,
            cy: 400,
            r: 60,
            fill: 'accent',
            at: 0.5,
            sound: 'chime',
          },
        ],
        { world: 'town', view: VIEW },
      ),
      canvas(
        'two',
        [
          {
            id: 'door',
            type: 'rect',
            x: 900,
            y: 400,
            w: 200,
            h: 300,
            fill: 'surface',
            at: 0.8,
            sound: 'click',
          },
        ],
        { world: 'town', view: VIEW },
      ),
      canvas(
        'three',
        [
          {
            id: 'lamp',
            type: 'circle',
            cx: 1400,
            cy: 600,
            r: 30,
            fill: 'ink',
            at: 1.2,
            sound: 'tock',
          },
        ],
        { world: 'town', view: VIEW },
      ),
    ],
  });
  // Before: the chime rang again at 3.5 s and the click again at 6.8 s, for drawings already finished.
  assert.deepEqual(
    cues(root).map((c) => [c.name, c.t]),
    [
      ['chime', 0.5],
      ['click', 3.8],
      ['tock', 7.2],
    ],
  );
});

test('a stepped drawing sounds on the drawing that shows it, and not after its scene has cut', (t) => {
  const root = project(t, {
    format: { width: 1920, height: 1080, fps: 30 },
    sfx: 'normal',
    beats: [
      canvas('steps', [
        // On twelves: shown at 5/12 s and 19/12 s, so that is where they sound.
        {
          id: 'a',
          type: 'circle',
          cx: 400,
          cy: 500,
          r: 30,
          fill: 'ink',
          at: 0.4,
          fps: 12,
          sound: 'tock',
        },
        {
          id: 'b',
          type: 'circle',
          cx: 600,
          cy: 500,
          r: 30,
          fill: 'ink',
          at: 1.55,
          fps: 12,
          sound: 'tick',
        },
        // On a continuous clock the authored time stands, to the bit.
        {
          id: 'c',
          type: 'circle',
          cx: 800,
          cy: 500,
          r: 30,
          fill: 'ink',
          at: 2.123456789,
          sound: 'click',
        },
        // Twice a second: 2.9 s would first be drawn at 3.0 s, which is the next scene.
        {
          id: 'd',
          type: 'circle',
          cx: 1000,
          cy: 500,
          r: 30,
          fill: 'ink',
          at: 2.9,
          fps: 2,
          sound: 'chime',
        },
      ]),
      {
        id: 'next',
        block: 'statement',
        duration: 2,
        props: { text: 'The next scene' },
      },
    ],
  });
  assert.deepEqual(
    cues(root).map((c) => [c.name, c.t]),
    [
      ['tock', 0.416667],
      ['tick', 1.583333],
      ['click', 2.123456789],
    ],
  );
  assert.equal(beatTime(0.25, []), 0.25);
  assert.equal(beatTime(0.25, [{ fps: 12 }]), 0.25);
  assert.equal(beatTime(1, [{ fps: 0 }, { shift: 3 }, { fps: 0 }]), -2);
});

test('every sound a film plays is an input: cue files are hashed, missing ones are named', async (t) => {
  const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-sound-outside-'));
  t.after(() => fs.rmSync(outside, { recursive: true, force: true }));
  const outsideCue = `../${path.basename(outside)}/outside.wav`;
  const root = project(t, {
    format: { width: 1920, height: 1080, fps: 30 },
    sfx: 'normal',
    beats: [
      {
        ...canvas('a', [
          {
            id: 'dot',
            type: 'circle',
            cx: 400,
            cy: 400,
            r: 60,
            fill: 'accent',
            at: 0.5,
            sound: 'click',
          },
        ]),
        sfx: [
          { src: 'sounds/door.wav', at: 0.4 },
          { src: 'sounds/missing.wav', at: 1 },
          { src: outsideCue, at: 2 },
        ],
      },
    ],
  });
  fs.mkdirSync(path.join(root, 'sounds'));
  const tone = (f, hz) =>
    execFileSync('ffmpeg', [
      '-v',
      'error',
      '-y',
      '-f',
      'lavfi',
      '-i',
      `sine=f=${hz}:d=0.2`,
      '-ac',
      '2',
      path.join(root, f),
    ]);
  tone('sounds/door.wav', 440);
  fs.writeFileSync(path.join(outside, 'outside.wav'), 'not in the project');
  const first = prepareProjectSync(root, { draft: true });
  assert.ok(first.manifest.hashes['sounds/door.wav']);
  assert.equal(
    first.manifest.sounds['sounds/door.wav'],
    first.manifest.hashes['sounds/door.wav'],
  );
  assert.equal(first.manifest.sounds.click, `builtin:${cueIdentity('click')}`);
  assert.ok(
    first.manifest.warnings.some((w) => /sounds\/missing\.wav/.test(w)) &&
      first.manifest.warnings.some((w) => w.includes(outsideCue)),
  );
  assert.equal(
    await resolveCue(root, outsideCue),
    null,
    'a sound from outside the project is never mixed',
  );
  const content = workingContent(root).contentId;

  // The same cue file with other bytes: a different render and a different revision content.
  tone('sounds/door.wav', 880);
  const edited = prepareProjectSync(root, { draft: true });
  assert.notEqual(edited.manifest.inputId, first.manifest.inputId);
  assert.notEqual(workingContent(root).contentId, content);
});

test('a built-in cue is named by its recipe: an edited recipe is a new take and a new input id, not new revision content', async (t) => {
  const root = project(t, {
    format: { width: 1920, height: 1080, fps: 30 },
    sfx: 'normal',
    beats: [
      canvas('a', [
        {
          id: 'dot',
          type: 'circle',
          cx: 400,
          cy: 400,
          r: 60,
          fill: 'accent',
          at: 0.5,
          sound: 'click',
        },
      ]),
    ],
  });
  const before = prepareProjectSync(root, { draft: true }).manifest,
    content = workingContent(root).contentId,
    take = await sfxFile('click'),
    expr = SFX.click.expr;
  t.after(() => (SFX.click.expr = expr));
  SFX.click.expr = `${expr}*0.5`;
  const after = prepareProjectSync(root, { draft: true }).manifest;
  assert.notEqual(after.sounds.click, before.sounds.click);
  assert.notEqual(after.inputId, before.inputId);
  // Revision content names input files; a recipe is code, covered by the receipt's finishing hashes.
  assert.equal(workingContent(root).contentId, content);
  // The cached take is per recipe, so the edited cue is synthesized afresh rather than replayed.
  const fresh = await sfxFile('click');
  assert.notEqual(fresh, take);
  t.after(() => fs.rmSync(fresh, { force: true }));
});
