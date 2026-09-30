#!/usr/bin/env node
// Gemini native image generation ("Nano Banana 2") via the Interactions API. Zero dependencies (Node ≥ 20).
//
// Contract (verified against ai.google.dev, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   header: x-goog-api-key
//   { model: "gemini-3.1-flash-image",
//     input: [ { type: "text", text }, { type: "image", mime_type: "image/png", data: <base64> } ...refs ],
//     response_format: { type: "image", mime_type: "image/jpeg", aspect_ratio: "16:9", image_size: "2K" } }
//   → steps[type=model_output].content[type=image] = { mime_type, data (base64) }
//   aspect_ratio: 1:1 2:3 3:2 3:4 4:3 4:5 5:4 9:16 16:9 21:9 (+ 1:4 4:1 1:8 8:1 on 3.1 Flash)
//   image_size: "512" (3.1 Flash only) | "1K" | "2K" | "4K" (uppercase K). Lite is 1K only.
//   Imagen was shut down on the Gemini API (Aug 2026) — do not use imagen-* models.
//
// Usage:
//   node image.mjs --prompt "..." --aspect 16:9 --size 2K --out assets/img/texture.jpg
//   node image.mjs --prompt "..." --ref style.png --ref layout.png --out out.jpg
//   node image.mjs --prompt "..." --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { API, outputBlocks, post } from '../../gemini-tts/scripts/tts.mjs';

export const MODELS = {
  'gemini-3.1-flash-image': {
    price: { 512: 0.045, '1K': 0.067, '2K': 0.101, '4K': 0.151 },
    note: 'Nano Banana 2 · default',
  },
  'gemini-3.1-flash-lite-image': {
    price: { '1K': 0.0336 },
    note: 'Nano Banana 2 Lite · cheapest · 1K only · weak at multi-reference',
  },
  'gemini-3-pro-image': { price: { '1K': 0.134, '2K': 0.134, '4K': 0.24 }, note: 'Nano Banana Pro · premium' },
};
const ASPECTS = ['1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9', '21:9', '1:4', '4:1', '1:8', '8:1'];
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

export function buildRequest({ prompt, model = 'gemini-3.1-flash-image', aspect = '16:9', size = '2K', refs = [] }) {
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (!ASPECTS.includes(aspect)) throw new Error(`aspect must be one of ${ASPECTS.join(' ')}`);
  let imageSize = String(size).toUpperCase().replace(/^512$/, '512');
  if (model.includes('lite') && imageSize !== '1K') imageSize = '1K';
  if (imageSize === '512' && model !== 'gemini-3.1-flash-image') imageSize = '1K';
  const input = [{ type: 'text', text: prompt }];
  for (const ref of refs) {
    const ext = path.extname(ref).toLowerCase();
    input.push({ type: 'image', mime_type: MIME[ext] ?? 'image/png', data: fs.readFileSync(ref).toString('base64') });
  }
  return {
    model,
    input,
    response_format: { type: 'image', mime_type: 'image/jpeg', aspect_ratio: aspect, image_size: imageSize },
  };
}

export function estimateCost({ model = 'gemini-3.1-flash-image', size = '2K' }) {
  const p = MODELS[model]?.price ?? {};
  return p[String(size).toUpperCase()] ?? p['1K'] ?? 0.1;
}

/** Generate one image. Returns { data: Buffer, mimeType, text }. */
export async function generateImage(opts) {
  const body = buildRequest(opts);
  const json = await post('/interactions', body, opts);
  const img = outputBlocks(json, 'image').at(-1);
  if (!img?.data) throw new Error(`No image in response (possibly filtered): ${JSON.stringify(json).slice(0, 400)}`);
  const text = outputBlocks(json, 'text')
    .map(t => t.text)
    .join('\n');
  return { data: Buffer.from(img.data, 'base64'), mimeType: img.mime_type ?? 'image/jpeg', text };
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' },
      model: { type: 'string', default: 'gemini-3.1-flash-image' },
      aspect: { type: 'string', default: '16:9' },
      size: { type: 'string', default: '2K' },
      ref: { type: 'string', multiple: true, default: [] },
      out: { type: 'string', default: 'image.jpg' },
      'dry-run': { type: 'boolean' },
    },
  });
  const opts = { prompt: v.prompt, model: v.model, aspect: v.aspect, size: v.size, refs: v.ref };
  if (v['dry-run']) {
    const body = buildRequest(opts);
    body.input = body.input.map(p => (p.data ? { ...p, data: `<${p.data.length} base64 chars>` } : p));
    console.log(`POST ${API}/interactions\n${JSON.stringify(body, null, 2)}\n≈ $${estimateCost(opts).toFixed(3)}`);
    return;
  }
  const r = await generateImage(opts);
  fs.mkdirSync(path.dirname(path.resolve(v.out)), { recursive: true });
  fs.writeFileSync(v.out, r.data);
  console.log(`wrote ${v.out} (${r.mimeType})${r.text ? `\nmodel note: ${r.text}` : ''}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
