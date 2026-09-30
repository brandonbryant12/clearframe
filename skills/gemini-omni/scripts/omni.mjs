import fs from 'node:fs';
import path from 'node:path';
import { post, outputBlocks } from '../../gemini-tts/scripts/tts.mjs';
import { downloadVideo } from '../../../engine/lib/google-files.mjs';
export const MODEL = 'gemini-omni-1.1-flash';
export function buildRequest({
  prompt,
  aspect = '16:9',
  resolution = '720p',
  refs = [],
  previousInteractionId,
  model = MODEL,
}) {
  if (model !== MODEL) throw new Error(`Supported Omni model: ${MODEL}`);
  if (!prompt?.trim()) throw new Error('Omni needs a prompt');
  if (!['16:9', '9:16'].includes(aspect) || !['360p', '720p', '1080p', '4k'].includes(resolution))
    throw new Error('Unsupported Omni aspect or resolution');
  if (refs.length > 2) throw new Error('Use at most two continuity references (first and last frame).');
  const input = refs.map(file => {
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[
      path.extname(file).toLowerCase()
    ];
    if (!mime) throw new Error('Continuity references must be PNG, JPEG or WebP');
    return { type: 'image', mime_type: mime, data: fs.readFileSync(file).toString('base64') };
  });
  input.push({ type: 'text', text: prompt });
  return {
    model,
    input,
    response_format: { type: 'video', aspect_ratio: aspect, resolution, delivery: 'uri' },
    ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
  };
}
// Output token estimate, not a billing cap: duration is requested in the prompt.
export function estimateCost({ seconds = 4, resolution = '720p' } = {}) {
  if (resolution !== '720p')
    throw new Error('ClearFrame currently budgets Omni at 720p only; choose 720p for generated inserts.');
  if (!Number.isFinite(seconds) || seconds <= 0) throw new Error('seconds must be positive');
  return (seconds * 5792 * 17.5) / 1e6;
}
export async function generateVideo(opts) {
  const result = await post('/interactions', buildRequest(opts), { ...opts, retries: 0, timeoutMs: 600_000 });
  const video = outputBlocks(result, 'video').at(-1);
  if (video?.mime_type !== 'video/mp4') throw new Error('Omni did not return an MP4');
  const data = video.data ? Buffer.from(video.data, 'base64') : video.uri ? await downloadVideo(video.uri, opts) : null;
  if (!data?.length || data.toString('ascii', 4, 8) !== 'ftyp')
    throw new Error('Omni returned empty or invalid MP4 data');
  return { data, interactionId: result.id, usage: result.usage };
}
