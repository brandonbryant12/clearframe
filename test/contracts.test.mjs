// Pin request bodies to the documented Gemini API contracts (ai.google.dev, verified 2026-09-27).
// These never call the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tts from '../skills/gemini-tts/scripts/tts.mjs';
import * as image from '../skills/gemini-image/scripts/image.mjs';
import * as music from '../skills/lyria-music/scripts/music.mjs';
import * as rt from '../skills/lyria-music/scripts/realtime.mjs';
import * as veo from '../skills/veo-video/scripts/veo.mjs';

test('TTS: Interactions body with speech_metadata style and speech_config array', () => {
  const body = tts.buildRequest({ text: 'Hello there.', voice: 'Kore', style: 'calm' });
  assert.deepEqual(body, {
    model: 'gemini-3.8-flash-tts',
    input: [{ type: 'user_input', content: [{ type: 'text', text: 'Hello there.', annotations: [{ type: 'speech_metadata', style: 'calm' }] }] }],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: 'Kore' }] },
  });
  assert.equal(Object.keys(tts.VOICES).length, 30);
});

test('TTS: extracts audio from steps[model_output].content[audio]', () => {
  const blocks = tts.outputBlocks({ status: 'completed', steps: [{ type: 'model_output', content: [{ type: 'audio', mime_type: 'audio/wav', data: 'AA==' }] }] }, 'audio');
  assert.equal(blocks.length, 1);
  assert.throws(() => tts.outputBlocks({ status: 'failed', steps: [] }, 'audio'), /failed/);
});

test('Image: response_format carries aspect_ratio + image_size; lite forces 1K', () => {
  const body = image.buildRequest({ prompt: 'texture', aspect: '16:9', size: '2K' });
  assert.deepEqual(body.response_format, { type: 'image', mime_type: 'image/jpeg', aspect_ratio: '16:9', image_size: '2K' });
  assert.deepEqual(body.input, [{ type: 'text', text: 'texture' }]);
  assert.equal(body.model, 'gemini-3.1-flash-image');
  assert.equal(image.buildRequest({ prompt: 'x', model: 'gemini-3.1-flash-lite-image', size: '4K' }).response_format.image_size, '1K');
  assert.throws(() => image.buildRequest({ prompt: 'x', aspect: '7:3' }));
});

test('Lyria 3.5: string input, audio response_format, structured prompt', () => {
  const prompt = music.composePrompt({ style: 'Minimal ambient', bpm: 80, key: 'D major', seconds: 62, sections: [{ from: 0, to: 8, text: 'Intro' }] });
  assert.match(prompt, /80 BPM/);
  assert.match(prompt, /Instrumental only, no vocals\./);
  assert.match(prompt, /\[0:00 - 0:08\] Intro/);
  assert.deepEqual(music.buildRequest({ prompt: 'x' }), { model: 'lyria-3.5', input: 'x', response_format: { type: 'audio' } });
  assert.deepEqual(music.buildRequest({ prompt: 'x', format: 'mp3' }).response_format, { type: 'audio' });
  assert.throws(() => music.buildRequest({ prompt: 'x', format: 'wav' }), /MP3 only/);
  assert.throws(() => music.buildRequest({ prompt: 'x', format: 'bogus' }), /MP3 only/);
  assert.throws(() => music.buildRequest({ prompt: 'x', images: Array(11).fill('missing.png') }), /at most 10/);
  assert.match(music.composePrompt({ style: 'ambient', sections: [{ from: 59.8, to: 120, text: 'Bridge' }] }), /\[1:00 - 2:00\]/);
});

test('Lyria RealTime: one field per client message, setup first', () => {
  const msgs = rt.messages({ prompts: [{ text: 'ambient', weight: 1 }], bpm: 84, scale: 'D_MAJOR_B_MINOR' });
  assert.deepEqual(msgs[0], { setup: { model: 'models/lyria-realtime-exp' } });
  for (const m of msgs) assert.equal(Object.keys(m).length, 1);
  assert.equal(msgs[2].musicGenerationConfig.bpm, 84);
  assert.deepEqual(msgs[3], { playbackControl: 'PLAY' });
  assert.throws(() => rt.messages({ prompts: [], scale: 'H_MAJOR' }));
});

test('Veo: predictLongRunning body — string durationSeconds, inlineData image, constraints', () => {
  const body = veo.buildRequest({ prompt: 'slow drift', seconds: 4 });
  assert.deepEqual(body, { instances: [{ prompt: 'slow drift' }], parameters: { aspectRatio: '16:9', resolution: '720p', durationSeconds: '4' } });
  assert.throws(() => veo.buildRequest({ prompt: 'x', resolution: '1080p', seconds: 4 }), /requires seconds=8/);
  assert.throws(() => veo.buildRequest({ prompt: 'x', model: 'veo-3.1-lite-generate-preview', resolution: '4k', seconds: 8 }), /4k/);
  assert.equal(veo.estimateCost({ seconds: 4 }), 0.2);
});
