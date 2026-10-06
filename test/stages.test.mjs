import test from 'node:test';
import assert from 'node:assert/strict';
import { clearframeStage, manifestStage, stageInfo } from '../engine/lib/viewer/stages.mjs';

test('a ClearFrame film moves from brief to final as its storyboard and renders mature', () => {
  const beat = (id, placeholder) => ({ id, block: 'statement', ...(placeholder ? { placeholder } : {}) });
  const script = { beats: [{ id: 't', block: 'title' }, beat('a', 'chart'), beat('b', 'chart'), beat('c')] };
  const board = { beats: [beat('a'), beat('b'), beat('c', 'chart')] };
  assert.equal(clearframeStage(null), 'brief');
  assert.equal(clearframeStage(script), 'script', 'most body scenes still placeholders');
  assert.equal(clearframeStage(board), 'storyboard');
  assert.equal(clearframeStage(board, { profile: 'rough' }), 'rough');
  assert.equal(clearframeStage(board, { profile: 'draft', placeholders: ['c'] }), 'rough', 'a draft that still has slates is a rough cut');
  assert.equal(clearframeStage(board, { profile: 'draft', placeholders: [] }), 'review');
  assert.equal(clearframeStage(board, { profile: 'final' }), 'final');
});

test('an outside film can name its stage; otherwise its latest version decides', () => {
  assert.equal(manifestStage({ stage: 'rough' }, [{ quality: 'Final' }]), 'rough');
  assert.equal(manifestStage({}, [{ quality: 'Draft' }, { quality: 'Final' }]), 'final');
  assert.equal(manifestStage({}, [{ quality: 'Draft' }]), 'review');
});

test('the next step follows the open notes', () => {
  assert.equal(stageInfo('review', { openNotes: 2 }).next, 'Send your notes to the agent');
  assert.equal(stageInfo('review').next, 'Watch it, then approve it or leave notes');
  assert.equal(stageInfo('final', { openNotes: 1 }).next, 'Send your notes to the agent');
  assert.deepEqual([stageInfo('rough').phase, stageInfo('final').index], ['Production', 5]);
});
