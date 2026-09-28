#!/usr/bin/env node
// Gemini text-to-speech — gemini-3.8-flash-tts via the Interactions API. Zero dependencies (Node ≥ 20).
//
// Contract (verified against ai.google.dev, 2026-09-27):
//   POST https://generativelanguage.googleapis.com/v1beta/interactions   header: x-goog-api-key
//   { model, input: [{ type: "user_input", content: [{ type: "text", text, annotations: [{ type: "speech_metadata", style }] }] }],
//     response_format: { type: "audio", mime_type: "audio/wav", sample_rate: 24000 },
//     generation_config: { speech_config: [{ voice: "Charon" }] } }
//   → steps[type=model_output].content[type=audio] = { mime_type, data (base64), sample_rate, channels }
//   Unary responses default to audio/wav (24 kHz, mono, s16le, with RIFF header). audio/l16 is headerless PCM.
//
// Usage:
//   node tts.mjs --text "Seventy percent is not a promise." --voice Charon --style "calm, measured" --out vo.wav
//   node tts.mjs --text "..." --dry-run          # print the request body, call nothing
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

export const API = process.env.GEMINI_API_BASE ?? 'https://generativelanguage.googleapis.com/v1beta';
export const MODELS = {
  'gemini-3.8-flash-tts': { outPerM: 9.0, note: 'GA · newest · most expressive' },
  'gemini-3.8-flash-lite-tts': { outPerM: 6.0, note: 'GA · cheapest' },
};
export const VOICES = {
  Zephyr: 'Bright', Puck: 'Upbeat', Charon: 'Informative', Kore: 'Firm', Fenrir: 'Excitable', Leda: 'Youthful', Orus: 'Firm',
  Aoede: 'Breezy', Callirrhoe: 'Easy-going', Autonoe: 'Bright', Enceladus: 'Breathy', Iapetus: 'Clear', Umbriel: 'Easy-going',
  Algieba: 'Smooth', Despina: 'Smooth', Erinome: 'Clear', Algenib: 'Gravelly', Rasalgethi: 'Informative', Laomedeia: 'Upbeat',
  Achernar: 'Soft', Alnilam: 'Firm', Schedar: 'Even', Gacrux: 'Mature', Pulcherrima: 'Forward', Achird: 'Friendly',
  Zubenelgenubi: 'Casual', Vindemiatrix: 'Gentle', Sadachbia: 'Lively', Sadaltager: 'Knowledgeable', Sulafat: 'Warm',
};

/** Build the documented request body. `style` is a SHORT delivery note ("calm, measured"); the text is read verbatim. */
export function buildRequest({ text, voice = 'Charon', style, model = 'gemini-3.8-flash-tts', language, sampleRate = 24000, format = 'audio/wav' }) {
  if (!text?.trim()) throw new Error('text is required');
  const part = { type: 'text', text };
  if (style) part.annotations = [{ type: 'speech_metadata', style }];
  const speaker = { voice };
  if (language) speaker.language = language;
  return {
    model,
    input: [{ type: 'user_input', content: [part] }],
    response_format: { type: 'audio', mime_type: format, sample_rate: sampleRate },
    generation_config: { speech_config: [speaker] },
  };
}

/** Rough cost: audio out is 25 tokens/second. Text input is negligible. */
export function estimateCost({ seconds, model = 'gemini-3.8-flash-tts' }) {
  return ((seconds * 25) / 1e6) * (MODELS[model]?.outPerM ?? 9);
}

function wavFromPcm(pcm, rate, channels) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8); h.write('fmt ', 12);
  h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(channels, 22); h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 2, 28); h.writeUInt16LE(channels * 2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

export async function post(pathname, body, { key = process.env.GEMINI_API_KEY, retries = 4, timeoutMs = 180_000 } = {}) {
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(`${API}${pathname}`, {
      method: 'POST',
      headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const txt = await res.text();
    let json; try { json = JSON.parse(txt); } catch { json = null; }
    if (res.ok) return json;
    if ([429, 500, 502, 503, 504].includes(res.status) && attempt < retries) {
      await new Promise((r) => setTimeout(r, 2000 * 2 ** attempt));
      continue;
    }
    throw new Error(`Gemini ${res.status}: ${json?.error?.message ?? txt.slice(0, 400)}`);
  }
}

/** Output blocks of a given type from an Interaction response. */
export function outputBlocks(interaction, type) {
  if (interaction?.status && interaction.status !== 'completed') {
    throw new Error(`interaction ${interaction.status}${interaction.error ? `: ${JSON.stringify(interaction.error)}` : ''}`);
  }
  return (interaction?.steps ?? []).filter((s) => s.type === 'model_output').flatMap((s) => s.content ?? []).filter((c) => c.type === type);
}

/** Synthesize speech. Returns { wav: Buffer, mimeType, usage }. */
export async function synthesize(opts) {
  const body = buildRequest(opts);
  const json = await post('/interactions', body, opts);
  const audio = outputBlocks(json, 'audio').at(-1);
  if (!audio?.data) throw new Error(`No audio in response: ${JSON.stringify(json).slice(0, 400)}`);
  const buf = Buffer.from(audio.data, 'base64');
  const mime = String(audio.mime_type ?? 'audio/wav').toLowerCase();
  let wav = buf;
  if (mime.startsWith('audio/l16') || mime.includes('pcm')) {
    const rate = Number(mime.match(/rate=(\d+)/)?.[1] ?? audio.sample_rate ?? 24000);
    wav = wavFromPcm(buf, rate, audio.channels ?? 1);
  } else if (!mime.includes('wav') && buf.toString('ascii', 0, 4) !== 'RIFF') {
    return { data: buf, mimeType: mime, usage: json.usage };
  }
  return { wav, mimeType: 'audio/wav', usage: json.usage };
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      text: { type: 'string' }, file: { type: 'string' }, voice: { type: 'string', default: 'Charon' }, style: { type: 'string' },
      model: { type: 'string', default: 'gemini-3.8-flash-tts' }, language: { type: 'string' }, out: { type: 'string', default: 'speech.wav' },
      'dry-run': { type: 'boolean' }, 'list-voices': { type: 'boolean' },
    },
  });
  if (v['list-voices']) { for (const [n, d] of Object.entries(VOICES)) console.log(`${n.padEnd(14)} ${d}`); return; }
  const text = v.text ?? (v.file ? fs.readFileSync(v.file, 'utf8') : null);
  const opts = { text, voice: v.voice, style: v.style, model: v.model, language: v.language };
  if (v['dry-run']) { console.log(`POST ${API}/interactions\n${JSON.stringify(buildRequest(opts), null, 2)}`); return; }
  const r = await synthesize(opts);
  fs.mkdirSync(path.dirname(path.resolve(v.out)), { recursive: true });
  fs.writeFileSync(v.out, r.wav ?? r.data);
  console.log(`wrote ${v.out} (${r.mimeType})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch((e) => { console.error(e.message); process.exit(1); });
}
