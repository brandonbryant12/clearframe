// B-roll covers its beat: no loops, no repeated seconds, and no paying for a take too short to use.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { footageProblems } from '../engine/lib/continuity.mjs';
import { storyboardFor } from '../film/playbooks.mjs';
import { writeJSON } from '../engine/lib/util.mjs';

test('coverage, the one-take ceiling and repeated seconds are found before rendering', () => {
  const use = (beat, index, source, offset, seconds, have) => ({ beat, index, source, offset, seconds, have, generated: true });
  const { errors, warnings } = footageProblems([
    use('a', 0, 'city', 0, 6, 4),
    use('b', 1, 'city', 0, 3, 8),
    use('c', 2, 'sea', 0, 12, 12),
    use('d', 3, 'park', 0, 3, 8),
    use('e', 4, 'park', 4, 3, 8),
    use('f', 6, 'park', 0, 3, 8),
  ]);
  assert.match(errors.join('\n'), /a: city covers 4.0 s but the beat needs 6.0 s/);
  assert.match(errors.join('\n'), /one generated take is at most 10 s/);
  assert.match(errors.join('\n'), /b repeats 3.0 s of city/);
  assert(!errors.some(m => /^e /.test(m)), 'a later, different range of the same take is fine');
  assert.match(warnings.join('\n'), /f repeats 3.0 s of park already shown in d/);
});

test('plan reports short generated footage and clips refuses to pay for it', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-broll-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const sb = storyboardFor('concept-explainer');
  sb.assets = [{ id: 'city', kind: 'clip', prompt: 'A quiet street at dawn, locked camera', seconds: 4 }];
  sb.beats = [{ id: 'street', block: 'statement', duration: 6, plate: { asset: 'city', side: 'right', offset: 0.5 }, props: { text: 'Every morning' } }];
  writeJSON(path.join(root, 'storyboard.json'), sb);
  const { plan, clips } = await import('../engine/lib/generate.mjs');
  assert.match(plan(root).footage.errors.join(), /city covers 4.0 s but the beat needs 6.5 s from offset 0.5 s/);
  await assert.rejects(clips(root, { budget: 100 }), /Not generating: street/);
});
