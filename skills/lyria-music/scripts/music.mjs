#!/usr/bin/env node
// Lyria music via the Interactions API — lyria-3.5 (songs up to a couple of minutes) or lyria-3-clip-preview (30 s).
// Zero dependencies (Node ≥ 20).
//
// Contract (verified against ai.google.dev, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   header: x-goog-api-key
//   { model: "lyria-3.5", input: "<prompt>" | [ {type:"text",text}, {type:"image",mime_type,data} ...≤10 ],
//     response_format: { type: "audio", mime_type: "audio/wav" } }        // MP3 is the default when mime_type is omitted
//   → steps[type=model_output].content[] = { type:"text", text:"<lyrics / structure>" }, { type:"audio", mime_type, data }
//   Output: 44.1 kHz stereo. Duration is steered IN THE PROMPT ("about 70 seconds") and with timestamped sections
//   ("[0:00 - 0:08] Intro: ..."). Say "Instrumental only, no vocals." for beds. No negative prompt or seed documented.
//   Pricing: lyria-3.5 $0.08/song, lyria-3-clip-preview $0.04/clip (paid tier only). Output is SynthID-watermarked.
//
// Usage:
//   node music.mjs --prompt "Minimal ambient electronic, 84 BPM, in D major, soft Rhodes and warm synth pads" --seconds 70 --out bed.wav
//   node music.mjs --prompt "..." --section "0:00-0:08|sparse intro, single pad" --section "0:08-0:55|steady pulse, leaves room for voice" --dry-run
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';
import { API, outputBlocks, post } from '../../gemini-tts/scripts/tts.mjs';

export const MODELS = {
  'lyria-3.5': { price: 0.08, note: 'full tracks, duration steered by prompt' },
  'lyria-3-clip-preview': { price: 0.04, note: 'always 30 s — cheap for auditioning a style' },
};

const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;

/**
 * Compose a Lyria prompt from structured intent. Sections: [{ from, to, text }] in seconds.
 * Keeps musical instructions separate from any lyrics (we use instrumental beds).
 */
export function composePrompt({ style, bpm, key, seconds, sections = [], instrumental = true, ending = 'end cleanly on a sustained chord, no fade-out' }) {
  const lines = [];
  lines.push([style, bpm ? `${bpm} BPM` : null, key ? `in ${key}` : null].filter(Boolean).join(', ') + '.');
  if (instrumental) lines.push('Instrumental only, no vocals.');
  if (seconds) lines.push(`Duration: about ${Math.round(seconds)} seconds.`);
  lines.push('Mix: understated and spacious — it sits under a spoken voiceover, so keep the midrange clear and avoid busy melodies.');
  for (const s of sections) lines.push(`[${mmss(s.from)} - ${mmss(s.to)}] ${s.text}`);
  if (ending) lines.push(`Ending: ${ending}.`);
  return lines.join('\n');
}

export function buildRequest({ prompt, model = 'lyria-3.5', format = 'wav', images = [] }) {
  if (!prompt?.trim()) throw new Error('prompt is required');
  const input = images.length
    ? [{ type: 'text', text: prompt }, ...images.map((f) => ({ type: 'image', mime_type: /\.png$/i.test(f) ? 'image/png' : 'image/jpeg', data: fs.readFileSync(f).toString('base64') }))]
    : prompt;
  const response_format = { type: 'audio' };
  if (format === 'wav') response_format.mime_type = 'audio/wav';
  if (format === 'mp3') response_format.mime_type = 'audio/mp3';
  return { model, input, response_format };
}

export const estimateCost = ({ model = 'lyria-3.5' } = {}) => MODELS[model]?.price ?? 0.08;

/** Generate music. Returns { data: Buffer, mimeType, ext, text }. */
export async function generateMusic(opts) {
  const body = buildRequest(opts);
  const json = await post('/interactions', body, { timeoutMs: 600_000, ...opts });
  const audio = outputBlocks(json, 'audio').at(-1);
  if (!audio?.data) throw new Error(`No audio in response (prompt may have been filtered): ${JSON.stringify(json).slice(0, 400)}`);
  const mime = String(audio.mime_type ?? 'audio/mp3').toLowerCase();
  const ext = mime.includes('wav') ? 'wav' : mime.includes('ogg') ? 'ogg' : 'mp3';
  const text = outputBlocks(json, 'text').map((t) => t.text).join('\n');
  return { data: Buffer.from(audio.data, 'base64'), mimeType: mime, ext, text };
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string' }, style: { type: 'string' }, bpm: { type: 'string' }, key: { type: 'string' }, seconds: { type: 'string' },
      section: { type: 'string', multiple: true, default: [] }, model: { type: 'string', default: 'lyria-3.5' },
      format: { type: 'string', default: 'wav' }, image: { type: 'string', multiple: true, default: [] }, out: { type: 'string', default: 'music.wav' },
      'dry-run': { type: 'boolean' },
    },
  });
  const sections = v.section.map((s) => {
    const [range, text] = s.split('|');
    const [a, b] = range.split('-').map((x) => x.split(':').reduce((acc, n) => acc * 60 + parseFloat(n), 0));
    return { from: a, to: b, text };
  });
  const prompt = v.style || sections.length
    ? composePrompt({ style: v.style ?? v.prompt, bpm: v.bpm, key: v.key, seconds: v.seconds && +v.seconds, sections })
    : v.prompt;
  const opts = { prompt, model: v.model, format: v.format, images: v.image };
  if (v['dry-run']) { console.log(`POST ${API}/interactions\n${JSON.stringify(buildRequest(opts), null, 2)}\n≈ $${estimateCost(opts).toFixed(2)}`); return; }
  const r = await generateMusic(opts);
  const out = v.out.replace(/\.(wav|mp3|ogg)$/i, '') + `.${r.ext}`;
  fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
  fs.writeFileSync(out, r.data);
  if (r.text) fs.writeFileSync(out.replace(/\.\w+$/, '.txt'), r.text);
  console.log(`wrote ${out} (${r.mimeType})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
