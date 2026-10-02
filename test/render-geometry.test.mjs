import test from 'node:test';
import assert from 'node:assert/strict';
import { renderGeometry, reviewGeometry } from '../fframes/render-geometry.mjs';

test('review raster scales independently of authored geometry, with encoder-safe dimensions', () => {
  assert.deepEqual(renderGeometry({ width: 1920, height: 1080 }, { draft: true, scale: 0.5 }), { width: 960, height: 540, scale: 0.5 });
  assert.deepEqual(renderGeometry({ width: 1080, height: 1350 }, { draft: true, scale: 0.5 }), { width: 540, height: 676, scale: 0.5 });
  assert.throws(() => renderGeometry({ width: 1920, height: 1080 }, { scale: 0.5 }), /drafts only/);
  for (const scale of [0, NaN, Infinity, 2, '0.5']) assert.throws(() => renderGeometry({ width: 1920, height: 1080 }, { draft: true, scale }));
});

test('QA recognizes a reduced review only when both video and storyboard match its receipt', () => {
  const authored = { width: 1920, height: 1080 };
  const receipt = { draft: true, scale: 0.5, width: 960, height: 540, authoredWidth: 1920, authoredHeight: 1080,
    outputSha256: 'video', hashes: { 'storyboard.json': 'story' } };
  const hashes = { videoHash: 'video', storyboardHash: 'story' };
  assert.deepEqual(reviewGeometry(authored, receipt, hashes), { width: 960, height: 540, scale: 0.5, draft: true });
  for (const r of [undefined, { ...receipt, outputSha256: 'other' }, { ...receipt, width: 958 }, { ...receipt, scale: 0 }, { ...receipt, draft: false }])
    assert.equal(reviewGeometry(authored, r, hashes).width, 1920);
  assert.equal(reviewGeometry(authored, receipt, { ...hashes, storyboardHash: 'edited' }).width, 1920);
});
