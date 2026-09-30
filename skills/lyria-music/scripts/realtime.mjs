#!/usr/bin/env node
// Lyria RealTime (experimental) — steerable instrumental stream over WebSocket, captured to a WAV of exact length.
// Use when you need precise BPM/length/density control or a seamless bed longer than a song. Node ≥ 22 (global WebSocket).
//
// Contract (ai.google.dev/api/live_music, 2026-09-27):
//   wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic
//   Client messages carry exactly one of: setup | clientContent | musicGenerationConfig | playbackControl
//     {"setup":{"model":"models/lyria-realtime-exp"}}                     → wait for {"setupComplete":{}}
//     {"clientContent":{"weightedPrompts":[{"text":"...","weight":1.0}]}}
//     {"musicGenerationConfig":{"bpm":90,"density":0.4,"brightness":0.5,"scale":"D_MAJOR_B_MINOR","guidance":4.0,...}}
//     {"playbackControl":"PLAY" | "PAUSE" | "STOP" | "RESET_CONTEXT"}
//   Server: {"serverContent":{"audioChunks":[{"data":"<base64 PCM>","mimeType":"..."}]}}, {"filteredPrompt":{...}}, {"warning":"..."}
//   Audio: raw 16-bit PCM, 48 kHz, stereo. Instrumental only. SynthID-watermarked.
//   UNVERIFIED in the docs: API-key auth for raw sockets (we use the Live API convention `?key=`), and a v1beta URL.
//
// Usage:
//   node realtime.mjs --prompt "minimal ambient pulse, warm pads" --prompt "soft marimba:0.4" --bpm 84 --seconds 75 --out bed.wav
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath } from 'node:url';

const URL_BASE =
  process.env.LYRIA_RT_URL ??
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';
export const SCALES = [
  'C_MAJOR_A_MINOR',
  'D_FLAT_MAJOR_B_FLAT_MINOR',
  'D_MAJOR_B_MINOR',
  'E_FLAT_MAJOR_C_MINOR',
  'E_MAJOR_D_FLAT_MINOR',
  'F_MAJOR_D_MINOR',
  'G_FLAT_MAJOR_E_FLAT_MINOR',
  'G_MAJOR_E_MINOR',
  'A_FLAT_MAJOR_F_MINOR',
  'A_MAJOR_G_FLAT_MINOR',
  'B_FLAT_MAJOR_G_MINOR',
  'B_MAJOR_A_FLAT_MINOR',
  'SCALE_UNSPECIFIED',
];

export function messages({
  prompts,
  bpm,
  density,
  brightness,
  scale,
  guidance,
  temperature,
  seed,
  muteDrums,
  mode = 'QUALITY',
}) {
  const cfg = { musicGenerationMode: mode };
  if (bpm != null) cfg.bpm = Math.round(bpm);
  if (density != null) cfg.density = density;
  if (brightness != null) cfg.brightness = brightness;
  if (scale) {
    if (!SCALES.includes(scale)) throw new Error(`scale must be one of ${SCALES.join(', ')}`);
    cfg.scale = scale;
  }
  if (guidance != null) cfg.guidance = guidance;
  if (temperature != null) cfg.temperature = temperature;
  if (seed != null) cfg.seed = seed;
  if (muteDrums) cfg.muteDrums = true;
  return [
    { setup: { model: 'models/lyria-realtime-exp' } },
    { clientContent: { weightedPrompts: prompts } },
    { musicGenerationConfig: cfg },
    { playbackControl: 'PLAY' },
  ];
}

function wav(pcm, rate, channels) {
  const h = Buffer.alloc(44);
  h.write('RIFF', 0);
  h.writeUInt32LE(36 + pcm.length, 4);
  h.write('WAVE', 8);
  h.write('fmt ', 12);
  h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20);
  h.writeUInt16LE(channels, 22);
  h.writeUInt32LE(rate, 24);
  h.writeUInt32LE(rate * channels * 2, 28);
  h.writeUInt16LE(channels * 2, 32);
  h.writeUInt16LE(16, 34);
  h.write('data', 36);
  h.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([h, pcm]);
}

/** Stream `seconds` of music and return a WAV Buffer. */
export async function stream(opts, { key = process.env.GEMINI_API_KEY, seconds = 60, timeoutMs } = {}) {
  if (!key) throw new Error('GEMINI_API_KEY is not set');
  if (typeof WebSocket === 'undefined') throw new Error('Global WebSocket missing — use Node ≥ 22.');
  const msgs = messages(opts);
  const rate = 48000,
    channels = 2;
  const target = seconds * rate * channels * 2;
  const chunks = [];
  let bytes = 0;
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${URL_BASE}?key=${encodeURIComponent(key)}`);
    const timer = setTimeout(
      () => {
        ws.close();
        reject(new Error('Lyria RealTime timed out'));
      },
      timeoutMs ?? (seconds * 4 + 60) * 1000,
    );
    const finish = () => {
      clearTimeout(timer);
      try {
        ws.send(JSON.stringify({ playbackControl: 'STOP' }));
      } catch {}
      ws.close();
      resolve(wav(Buffer.concat(chunks).subarray(0, target), rate, channels));
    };
    ws.onopen = () => ws.send(JSON.stringify(msgs[0]));
    ws.onerror = e => {
      clearTimeout(timer);
      reject(new Error(`WebSocket error: ${e.message ?? e.type}`));
    };
    ws.onclose = e => {
      if (bytes < target) {
        clearTimeout(timer);
        reject(new Error(`socket closed early (${e.code} ${e.reason})`));
      }
    };
    ws.onmessage = async ev => {
      const raw =
        typeof ev.data === 'string'
          ? ev.data
          : Buffer.from((await ev.data.arrayBuffer?.()) ?? ev.data).toString('utf8');
      const m = JSON.parse(raw);
      if (m.setupComplete) {
        for (const x of msgs.slice(1)) ws.send(JSON.stringify(x));
        return;
      }
      if (m.filteredPrompt) console.warn(`prompt filtered: ${JSON.stringify(m.filteredPrompt)}`);
      if (m.warning) console.warn(`warning: ${m.warning}`);
      for (const c of m.serverContent?.audioChunks ?? []) {
        const buf = Buffer.from(c.data, 'base64');
        chunks.push(buf);
        bytes += buf.length;
      }
      if (bytes >= target) finish();
    };
  });
}

async function main() {
  const { values: v } = parseArgs({
    options: {
      prompt: { type: 'string', multiple: true, default: [] },
      bpm: { type: 'string' },
      density: { type: 'string' },
      brightness: { type: 'string' },
      scale: { type: 'string' },
      seconds: { type: 'string', default: '60' },
      seed: { type: 'string' },
      'mute-drums': { type: 'boolean' },
      out: { type: 'string', default: 'music.wav' },
      'dry-run': { type: 'boolean' },
    },
  });
  const prompts = v.prompt.map(p => {
    const m = p.match(/^(.*?):([\d.]+)$/);
    return m ? { text: m[1], weight: +m[2] } : { text: p, weight: 1.0 };
  });
  const opts = {
    prompts,
    bpm: v.bpm && +v.bpm,
    density: v.density && +v.density,
    brightness: v.brightness && +v.brightness,
    scale: v.scale,
    seed: v.seed && +v.seed,
    muteDrums: v['mute-drums'],
  };
  if (v['dry-run']) {
    console.log(`WS ${URL_BASE}?key=…`);
    for (const m of messages(opts)) console.log(JSON.stringify(m));
    return;
  }
  const buf = await stream(opts, { seconds: +v.seconds });
  fs.mkdirSync(path.dirname(path.resolve(v.out)), { recursive: true });
  fs.writeFileSync(v.out, buf);
  console.log(`wrote ${v.out}`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main().catch(e => {
    console.error(e.message);
    process.exit(1);
  });
}
