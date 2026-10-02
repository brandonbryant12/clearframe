import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { item } from '../fframes/library.mjs';
import { sketch, expandArt, SKETCH_FRAMES } from '../fframes/sketches.mjs';
import { normalizeElements, elementsExtent } from '../fframes/canvas.mjs';
import { scaffold } from '../fframes/playbooks.mjs';
import { createJob } from '../fframes/job.mjs';
import { computeTiming } from '../engine/lib/timing.mjs';
import { loadStoryboard } from '../engine/lib/project.mjs';

const names = ['die-cut-aperture', 'moire-signal', 'folded-louvers'];

test('material studies remain deterministic native under-layers at every supported frame shape', () => {
  for (const name of names) for (const format of Object.keys(SKETCH_FRAMES)) {
    const a = sketch(name, format, { seed: 17 });
    assert.equal(a.layer, 'under');
    assert.deepEqual(a, sketch(name, format, { seed: 17 }), `${name} ${format}`);
    assert.notDeepEqual(a, sketch(name, format, { seed: 29 }), `${name} responds to its seed`);
    normalizeElements(a.elements, `${name}.${format}`, message => { throw new Error(message); });
    assert.doesNotMatch(JSON.stringify(a), /#[0-9a-f]{6}|"(?:file|asset|text|count)"/i,
      'materials carry palette geometry, not baked text, media, or data');
    const overlay = { type: 'line', x1: 120, y1: 200, x2: 240, y2: 200, fill: 'none', stroke: 'accent' };
    const [width, height] = SKETCH_FRAMES[format], art = expandArt({ sketch: name, seed: 17, over: [overlay] }, { width, height });
    assert.deepEqual(art.under[0].children, a.elements);
    assert.deepEqual(art.over, [overlay], 'author annotations survive the reusable art layer');
  }
});

test('seed variation preserves the editorial copy zone and respects nonstandard frame dimensions', () => {
  // Ignore only the soft contact shadow. All solid artwork must stay beyond the copy zone.
  const subject = elements => elements.filter(e => !e.fill?.fade);
  for (const name of names) {
    for (const [format, [w, h]] of Object.entries(SKETCH_FRAMES)) {
      const tall = w <= h * 1.1;
      for (const seed of [undefined, 0, 3, 17, 29, 80]) {
        const e = elementsExtent(subject(sketch(name, format, { seed }).elements));
        assert.ok(tall ? e.top >= h * 0.39 : e.left >= w * 0.49, `${name} ${format} seed ${seed}: clear copy zone`);
      }
    }
    assert.deepEqual(expandArt({ sketch: name, seed: 3 }, { width: 1280, height: 720 }).under[0].children,
      item('sketches', name).build(1280, 720, { seed: 3 }).elements);
  }
});

test('both art directions compile a narration-free, claim-free showcase in landscape and vertical', t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cf-art-studies-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const treatment of ['paper-theatre', 'interference']) for (const vertical of [false, true]) {
    const dir = path.join(root, `${treatment}-${vertical}`);
    const sb = scaffold(dir, { playbook: 'material-etudes', treatment, vertical });
    assert.deepEqual(sb.sources, []);
    assert.ok(sb.beats.every(b => !b.vo), 'the visual study needs no generated or attributed speech');
    assert.ok(sb.beats.every(b => b.props.elements.length > 0));
    assert.deepEqual(sb.beats.map(b => b.art.sketch), names);
    const loaded = loadStoryboard(dir), result = createJob(loaded, computeTiming(dir), { draft: true });
    assert.deepEqual(result.errors, [], `${treatment} ${vertical}`);
    assert.equal(loaded.assets.length, 0);
    assert.ok(result.job.beats.every(b => b.props.elements.length > 0));
  }
});
