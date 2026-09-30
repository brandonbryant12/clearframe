#!/usr/bin/env node
// Veo 3.1 video generation (long-running operation). Zero dependencies (Node ≥ 20).
// Default: veo-3.1-lite-generate-preview at 720p for 4 s — the cheapest Veo ($0.05/s → $0.20 a clip).
//
// Contract (verified against ai.google.dev/gemini-api/docs/veo, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/models/{model}:predictLongRunning   header: x-goog-api-key
//   { instances: [{ prompt, image?: { inlineData: { mimeType, data } }, lastFrame?: { inlineData: {...} } }],
//     parameters: { aspectRatio: "16:9"|"9:16", resolution: "720p"|"1080p"|"4k", durationSeconds: "4"|"6"|"8",
//                   personGeneration?: "allow_all" (text→video) | "allow_adult" (image→video), seed? } }
//   → { name: "<operation>" }; poll GET /v1beta/{name} until done:true
//   → response.generateVideoResponse.generatedSamples[0].video.uri ; download it WITH the x-goog-api-key header (follow redirects)
//   Notes: 1080p/4k require 8 s; Lite has no 4k; output MP4 24 fps with native audio (always on);
//   files are kept on the server for 2 days; negativePrompt is not documented — put exclusions in the prompt.
//
// Usage:
//   node veo.mjs --prompt "Slow aerial drift over a city at dawn, soft haze, no text" --seconds 4 --out clip.mp4
//   node veo.mjs --prompt "Gentle parallax push-in" --image still.jpg --out clip.mp4       # image → video
//   node veo.mjs --prompt "..." --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const API = process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';
export const MODELS = {
  'veo-3.1-lite-generate-preview': {
    perSec: { '720p': 0.05, '1080p': 0.08 },
    note: 'cheapest · no 4k · no reference images/extension',
  },
  'veo-3.1-fast-generate-preview': { perSec: { '720p': 0.1, '1080p': 0.12, '4k': 0.3 }, note: 'fast' },
  'veo-3.1-generate-preview': { perSec: { '720p': 0.4, '1080p': 0.4, '4k': 0.6 }, note: 'highest quality' },
};
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const inline = file => ({
  inlineData: {
    mimeType: MIME[path.extname(file).toLowerCase()] ?? 'image/png',
    data: fs.readFileSync(file).toString('base64'),
  },
});

export function buildRequest({
  prompt,
  model = 'veo-3.1-lite-generate-preview',
  image,
  lastFrame,
  aspect = '16:9',
  resolution = '720p',
  seconds = 4,
  seed,
  personGeneration,
}) {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (!['16:9', '9:16'].includes(aspect)) throw new Error('aspect must be 16:9 or 9:16');
  if (![4, 6, 8].includes(+seconds)) throw new Error('seconds must be 4, 6 or 8');
  if (resolution !== '720p' && +seconds !== 8) throw new Error(`${resolution} requires seconds=8`);
  if (resolution === '4k' && model.includes('lite')) throw new Error('Veo 3.1 Lite does not support 4k');
  if (lastFrame && !image) throw new Error('lastFrame requires image');
  const instance = { prompt };
  if (image) instance.image = inline(image);
  if (lastFrame) instance.lastFrame = inline(lastFrame);
  const parameters = { aspectRatio: aspect, resolution, durationSeconds: String(seconds) };
  if (seed != null) parameters.seed = +seed;
  if (personGeneration) parameters.personGeneration = personGeneration;
  return { instances: [instance], parameters };
}

export function estimateCost({ model = 'veo-3.1-lite-generate-preview', resolution = '720p', seconds = 4 }) {
  return (MODELS[model]?.perSec?.[resolution] ?? 0.4) * seconds;
}

async function call(url, init, key) {
  const res = await fetch(url, {
    ...init,
    headers: { 'x-goog-api-key': key, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const txt = await res.text();
  let json;
  try {
    json = JSON.parse(txt);
  } catch {
    json = null;
  }
  if (!res.ok) throw new Error(`Veo ${res.status}: ${json?.error?.message ?? txt.slice(0, 400)}`);
  return json;
}

/** Generate a clip; resolves with the local file path. */
export async function generateVideo(
  opts,
  { key = process.env.GEMINI_API_KEY, out = 'clip.mp4', pollMs = 10_000, timeoutMs = 12 * 60_000, onPoll } = {},
) {
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  const model = opts.model ?? 'veo-3.1-lite-generate-preview';
  const op = await call(
    `${API}/models/${model}:predictLongRunning`,
    { method: 'POST', body: JSON.stringify(buildRequest({ ...opts, model })) },
    key,
  );
  if (!op?.name) throw new Error(`No operation name returned: ${JSON.stringify(op).slice(0, 300)}`);
  const deadline = Date.now() + timeoutMs;
  let status = op;
  while (!status.done) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for ${op.name}`);
    await new Promise(r => setTimeout(r, pollMs));
    status = await call(`${API}/${op.name}`, { method: 'GET' }, key);
    onPoll?.(status);
  }
  if (status.error) throw new Error(`Veo operation failed: ${JSON.stringify(status.error)}`);
  const uri = status.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
  if (!uri)
    throw new Error(
      `No video in response (it may have been filtered): ${JSON.stringify(status.response ?? status).slice(0, 400)}`,
    );
  const res = await fetch(uri, { headers: { 'x-goog-api-key': key }, redirect: 'follow' });
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  return out;
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' },
      model: { type: 'string', default: 'veo-3.1-lite-generate-preview' },
      image: { type: 'string' },
      'last-frame': { type: 'string' },
      aspect: { type: 'string', default: '16:9' },
      resolution: { type: 'string', default: '720p' },
      seconds: { type: 'string', default: '4' },
      seed: { type: 'string' },
      out: { type: 'string', default: 'clip.mp4' },
      'dry-run': { type: 'boolean' },
    },
  });
  const opts = {
    prompt: v.prompt,
    model: v.model,
    image: v.image,
    lastFrame: v['last-frame'],
    aspect: v.aspect,
    resolution: v.resolution,
    seconds: +v.seconds,
    seed: v.seed,
  };
  if (v['dry-run']) {
    const body = buildRequest(opts);
    for (const k of ['image', 'lastFrame']) if (body.instances[0][k]) body.instances[0][k].inlineData.data = '<base64>';
    console.log(
      `POST ${API}/models/${opts.model}:predictLongRunning\n${JSON.stringify(body, null, 2)}\n≈ $${estimateCost(opts).toFixed(2)}`,
    );
    return;
  }
  const file = await generateVideo(opts, { out: v.out, onPoll: () => process.stdout.write('.') });
  console.log(`\nwrote ${file}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
