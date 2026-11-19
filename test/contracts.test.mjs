// Pin request bodies to the documented Gemini API contracts (ai.google.dev, verified 2026-09-27).
// These never call the network.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as tts from '../packages/engine/dist/skills/gemini-tts/scripts/tts.mjs';
import * as image from '../packages/engine/dist/skills/gemini-image/scripts/image.mjs';
import * as music from '../packages/engine/dist/skills/lyria-music/scripts/music.mjs';
import * as rt from '../packages/engine/dist/skills/lyria-music/scripts/realtime.mjs';
import { clipProvider } from '../packages/engine/dist/engine/lib/generation/clips.mjs';

test('TTS: Interactions body with speech_metadata style and speech_config array', () => {
  const body = tts.buildRequest({
    text: 'Hello there.',
    voice: 'Kore',
    style: 'calm',
  });
  assert.deepEqual(body, {
    model: 'gemini-3.8-flash-tts',
    input: [
      {
        type: 'user_input',
        content: [
          {
            type: 'text',
            text: 'Hello there.',
            annotations: [{ type: 'speech_metadata', style: 'calm' }],
          },
        ],
      },
    ],
    response_format: {
      type: 'audio',
      mime_type: 'audio/wav',
      sample_rate: 24000,
    },
    generation_config: { speech_config: [{ voice: 'Kore' }] },
  });
  assert.equal(Object.keys(tts.VOICES).length, 30);
});

test('TTS: extracts audio from steps[model_output].content[audio]', () => {
  const blocks = tts.outputBlocks(
    {
      status: 'completed',
      steps: [
        {
          type: 'model_output',
          content: [{ type: 'audio', mime_type: 'audio/wav', data: 'AA==' }],
        },
      ],
    },
    'audio',
  );
  assert.equal(blocks.length, 1);
  assert.throws(
    () => tts.outputBlocks({ status: 'failed', steps: [] }, 'audio'),
    /failed/,
  );
});

test('Image: response_format carries aspect_ratio + image_size; lite forces 1K', () => {
  const body = image.buildRequest({
    prompt: 'texture',
    aspect: '16:9',
    size: '2K',
  });
  assert.deepEqual(body.response_format, {
    type: 'image',
    mime_type: 'image/jpeg',
    aspect_ratio: '16:9',
    image_size: '2K',
  });
  assert.deepEqual(body.input, [{ type: 'text', text: 'texture' }]);
  assert.equal(body.model, 'gemini-nano-banana-2.1');
  assert.equal(image.estimateCost({ size: '2K' }), 0.0504);
  assert.equal(
    image.estimateCost({ model: 'gemini-3.1-flash-image', size: '2K' }),
    0.101,
  );
  assert.throws(
    () => image.buildRequest({ prompt: 'x', size: '8K' }),
    /Unsupported image size/,
  );
  assert.throws(
    () => image.buildRequest({ prompt: 'x', refs: Array(15).fill('ref.png') }),
    /14 reference/,
  );
  assert.equal(
    image.buildRequest({
      prompt: 'x',
      model: 'gemini-3.1-flash-lite-image',
      size: '4K',
    }).response_format.image_size,
    '1K',
  );
  assert.throws(() => image.buildRequest({ prompt: 'x', aspect: '7:3' }));
});

test('Lyria 3.5: string input, audio response_format, structured prompt', () => {
  const prompt = music.composePrompt({
    style: 'Minimal ambient',
    bpm: 80,
    key: 'D major',
    seconds: 62,
    sections: [{ from: 0, to: 8, text: 'Intro' }],
  });
  assert.match(prompt, /80 BPM/);
  assert.match(prompt, /Instrumental only, no vocals\./);
  assert.match(prompt, /\[0:00 - 0:08\] Intro/);
  assert.deepEqual(music.buildRequest({ prompt: 'x' }), {
    model: 'lyria-3.5',
    input: 'x',
    response_format: { type: 'audio' },
  });
  assert.deepEqual(
    music.buildRequest({ prompt: 'x', format: 'mp3' }).response_format,
    { type: 'audio' },
  );
  assert.throws(
    () => music.buildRequest({ prompt: 'x', format: 'wav' }),
    /MP3 only/,
  );
  assert.throws(
    () => music.buildRequest({ prompt: 'x', format: 'bogus' }),
    /MP3 only/,
  );
  assert.throws(
    () =>
      music.buildRequest({
        prompt: 'x',
        images: Array(11).fill('missing.png'),
      }),
    /at most 10/,
  );
  assert.match(
    music.composePrompt({
      style: 'ambient',
      sections: [{ from: 59.8, to: 120, text: 'Bridge' }],
    }),
    /\[1:00 - 2:00\]/,
  );
});

test('Lyria RealTime: one field per client message, setup first', () => {
  const msgs = rt.messages({
    prompts: [{ text: 'ambient', weight: 1 }],
    bpm: 84,
    scale: 'D_MAJOR_B_MINOR',
  });
  assert.deepEqual(msgs[0], { setup: { model: 'models/lyria-realtime-exp' } });
  for (const m of msgs) assert.equal(Object.keys(m).length, 1);
  assert.equal(msgs[2].musicGenerationConfig.bpm, 84);
  assert.deepEqual(msgs[3], { playbackControl: 'PLAY' });
  assert.throws(() => rt.messages({ prompts: [], scale: 'H_MAJOR' }));
});

test('retired Veo models fail before a network request', (t) => {
  t.mock.method(globalThis, 'fetch', () => {
    throw new Error('Unexpected request');
  });
  for (const model of [
    'veo-3.1-lite-generate-preview',
    'veo-3.1-fast-generate-preview',
    'veo-3.1-generate-preview',
  ])
    assert.throws(() => clipProvider(model), /retired.*gemini-omni-1\.2-flash/);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
});

test('Neon directs from real catalog entries, validates its result, and respects dry-run and budget', async (t) => {
  const { adviseShot } =
    await import('../packages/engine/dist/engine/lib/shot-advice.mjs');
  const { entries } = await import('../packages/engine/dist/film/discover.mjs');
  const entry = entries().find((e) => e.id === 'sketch:parallel-checks');
  assert.ok(entry);
  let libraryId = entry.id;
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({
      status: 'completed',
      steps: [
        {
          type: 'model_output',
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                libraryId,
                direction: 'Send both reviews before the decision.',
                check: 'The release waits for both results.',
              }),
            },
          ],
        },
      ],
    }),
  );
  const preview = await adviseShot(
    'Review a change concurrently',
    [entry],
    0,
    true,
  );
  assert.equal(preview.request.model, 'gemini-4-neon');
  assert.equal(preview.request.store, false);
  assert.deepEqual(
    preview.request.response_format.schema.properties.libraryId.enum,
    [entry.id],
  );
  assert.ok(preview.estimatedUsd > 0);
  await assert.rejects(adviseShot('Review a change', [entry], 0), /budget/i);
  await assert.rejects(adviseShot('No match', [], 1), /No matching/);
  assert.equal(globalThis.fetch.mock.callCount(), 0);
  const before = process.env.GEMINI_API_KEY;
  process.env.GEMINI_API_KEY = 'test-only';
  t.after(() => {
    if (before === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = before;
  });
  const selected = await adviseShot('Review a change', [entry], 1);
  assert.equal(selected.authoring.example.block, 'canvas');
  assert.equal(
    selected.authoring.example.props.diagram.nodes[0].label,
    'Change',
  );
  libraryId = 'sketch:invented';
  await assert.rejects(
    adviseShot('Review a change', [entry], 1),
    /outside the shortlist/,
  );
  assert.equal(globalThis.fetch.mock.callCount(), 2);
});
