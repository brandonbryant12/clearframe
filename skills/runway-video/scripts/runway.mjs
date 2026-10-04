#!/usr/bin/env node
// Runway Dev video generation (Seedance 2.5 / 2.0, Gen-4.5). Zero dependencies (Node ≥ 20).
//
// Contract (verified against docs.dev.runwayml.com/api.md, 2026-10-04):
//   POST https://api.dev.runwayml.com/v1/image_to_video | /v1/text_to_video
//   headers: Authorization: Bearer $RUNWAYML_API_SECRET, X-Runway-Version: 2024-11-06
//   body (per model): { model, promptText, promptImage?: [{uri, position: "first"|"last"}], ratio, duration, seed?, audio? }
//   → { id }; poll GET /v1/tasks/{id} until SUCCEEDED (output[0] is a temporary URL) or FAILED (failure, failureCode).
//   Images: data URIs up to 5 MB, else POST /v1/uploads {filename, type:"ephemeral"} → multipart POST → runwayUri.
//   Moderated outputs fail with failureCode SAFETY.* and cost 0 credits, but repeated moderation can suspend an account.
//
// Usage:
//   node runway.mjs --prompt "..." --image first.png [--last last.png] --seconds 5 --out clip.mp4
//   node runway.mjs --prompt "..." --model gen4.5 --seconds 5 --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const API = process.env.RUNWAY_API_BASE ?? 'https://api.dev.runwayml.com';
export const VERSION = '2024-11-06';
// Credits per second of output (1 credit = $0.01), from docs.dev.runwayml.com/guides/pricing.md on 2026-10-04.
export const MODELS = {
  seedance2_5: { credits: { '480p': 20, '720p': 30, '1080p': 68 }, minimum: 80, seconds: [4, 15], lastFrame: true, audio: true,
    note: 'strongest motion and keyframe control; first/last frames' },
  seedance2: { credits: { '720p': 36, '1080p': 40 }, minimum: 0, seconds: [4, 15], lastFrame: true, audio: true, note: 'previous Seedance' },
  seedance2_fast: { credits: { '720p': 29 }, minimum: 0, seconds: [4, 15], lastFrame: true, audio: true, note: 'faster Seedance draft' },
  'gen4.5': { credits: { '720p': 12 }, minimum: 0, seconds: [2, 10], lastFrame: false, audio: false, note: 'cheapest; first frame only' },
};
const RATIOS = {
  '480p': { '16:9': '854:480', '9:16': '480:854' },
  '720p': { '16:9': '1280:720', '9:16': '720:1280', '1:1': '960:960' },
  '1080p': { '16:9': '1920:1080', '9:16': '1080:1920', '1:1': '1440:1440' },
};
const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
const DATA_URI_LIMIT = 4.5 * 2 ** 20;

export function ratioFor(model, aspect, resolution) {
  const r = RATIOS[resolution]?.[aspect];
  if (!r) throw new Error(`No ${resolution} ${aspect} ratio`);
  if (model === 'gen4.5' && !['1280:720', '720:1280', '960:960'].includes(r)) throw new Error('gen4.5 supports 720p only');
  return r;
}

/** The JSON body for one request. `images` are already-resolved URIs: [first] or [first, last]. */
export function buildRequest({ prompt, model = 'seedance2_5', images = [], aspect = '16:9', resolution = '720p', seconds = 5, seed, audio = false }) {
  const m = MODELS[model];
  if (!m) throw new Error(`Unsupported Runway model ${model}`);
  if (!prompt?.trim()) throw new Error('prompt is required');
  if (model === 'gen4.5' && prompt.length > 1000) throw new Error('gen4.5 prompts are limited to 1000 characters');
  if (!(m.credits[resolution] > 0)) throw new Error(`${model} has no ${resolution} output`);
  if (!Number.isInteger(+seconds) || +seconds < m.seconds[0] || +seconds > m.seconds[1])
    throw new Error(`${model} needs ${m.seconds[0]}–${m.seconds[1]} whole seconds`);
  if (images.length > 2) throw new Error('at most two keyframes: first and last');
  if (images.length === 2 && !m.lastFrame) throw new Error(`${model} accepts a first frame only`);
  if (model === 'gen4.5' && !images.length && aspect === '1:1') throw new Error('gen4.5 text-to-video is 16:9 or 9:16');
  const body = { model, promptText: prompt, ratio: ratioFor(model, aspect, resolution), duration: +seconds };
  if (images.length) body.promptImage = images.map((uri, i) => ({ uri, position: i ? 'last' : 'first' }));
  if (seed != null) body.seed = +seed;
  // Clip audio is never mixed into a ClearFrame film; skip generating it where the model allows.
  if (m.audio) body.audio = !!audio;
  return { endpoint: images.length ? '/v1/image_to_video' : '/v1/text_to_video', body };
}

export function estimateCost({ model = 'seedance2_5', resolution = '720p', seconds = 5 }) {
  const m = MODELS[model];
  return Math.max(m?.minimum ?? 0, (m?.credits?.[resolution] ?? 40) * seconds) / 100;
}

async function call(url, init, key) {
  const res = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${key}`, 'X-Runway-Version': VERSION, 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const txt = await res.text();
  let json = null;
  try { json = JSON.parse(txt); } catch {}
  if (!res.ok) throw new Error(`Runway ${res.status}: ${json?.error ?? txt.slice(0, 400)}`);
  return json;
}

/** A URI Runway can read for a local image: inline when small, an ephemeral upload otherwise. */
export async function imageUri(file, key) {
  const data = fs.readFileSync(file), mime = MIME[path.extname(file).toLowerCase()] ?? 'image/png';
  if (data.length <= DATA_URI_LIMIT) return `data:${mime};base64,${data.toString('base64')}`;
  const up = await call(`${API}/v1/uploads`, { method: 'POST', body: JSON.stringify({ filename: path.basename(file), type: 'ephemeral' }) }, key);
  const form = new FormData();
  for (const [k, v] of Object.entries(up.fields)) form.append(k, v);
  form.append('file', new Blob([data], { type: mime }), path.basename(file));
  const res = await fetch(up.uploadUrl, { method: 'POST', body: form });
  if (!res.ok) throw new Error(`Runway upload failed: ${res.status}`);
  return up.runwayUri;
}

/** Generate a clip; resolves with { file, taskId }. Moderation failures say so plainly. */
export async function generateVideo(opts, { key = process.env.RUNWAYML_API_SECRET, out = 'clip.mp4', pollMs = 6_000, timeoutMs = 30 * 60_000, onPoll } = {}) {
  if (!key) throw new Error('RUNWAYML_API_SECRET is not set');
  const images = [];
  for (const f of opts.images ?? []) images.push(await imageUri(f, key));
  const { endpoint, body } = buildRequest({ ...opts, images });
  const task = await call(`${API}${endpoint}`, { method: 'POST', body: JSON.stringify(body) }, key);
  const deadline = Date.now() + timeoutMs;
  let status = task;
  while (!['SUCCEEDED', 'FAILED', 'CANCELLED'].includes(status.status)) {
    if (Date.now() > deadline) throw new Error(`Timed out waiting for Runway task ${task.id}`);
    await new Promise(r => setTimeout(r, pollMs));
    status = await call(`${API}/v1/tasks/${task.id}`, { method: 'GET' }, key);
    onPoll?.(status);
  }
  if (status.status !== 'SUCCEEDED') {
    const moderated = String(status.failureCode ?? '').startsWith('SAFETY');
    throw new Error(moderated
      ? `Runway moderation blocked task ${task.id} (${status.failureCode}). No credits were charged, but repeated blocks can suspend the account: reframe the subject (wider, from behind, less face-forward) or route this shot to another provider.`
      : `Runway task ${task.id} ${status.status}: ${status.failure ?? ''} ${status.failureCode ?? ''}`.trim());
  }
  const res = await fetch(status.output[0]);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, Buffer.from(await res.arrayBuffer()));
  return { file: out, taskId: task.id };
}

async function main() {
  const { values: v } = parseArgs({ options: {
    prompt: { type: 'string' }, model: { type: 'string', default: 'seedance2_5' },
    image: { type: 'string' }, last: { type: 'string' }, aspect: { type: 'string', default: '16:9' },
    resolution: { type: 'string', default: '720p' }, seconds: { type: 'string', default: '5' },
    seed: { type: 'string' }, out: { type: 'string', default: 'clip.mp4' }, 'dry-run': { type: 'boolean' },
  } });
  const opts = { prompt: v.prompt, model: v.model, aspect: v.aspect, resolution: v.resolution, seconds: +v.seconds, seed: v.seed,
    images: [v.image, v.last].filter(Boolean) };
  if (v['dry-run']) {
    const { endpoint, body } = buildRequest({ ...opts, images: opts.images.map(() => 'data:<image>') });
    console.log(`POST ${API}${endpoint}\n${JSON.stringify(body, null, 2)}\n≈ $${estimateCost(opts).toFixed(2)}`);
    return;
  }
  const { file } = await generateVideo(opts, { out: v.out, onPoll: s => process.stdout.write(s.status === 'RUNNING' ? '.' : '·') });
  console.log(`\nwrote ${file}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => { console.error(e.message); process.exit(1); });
}
