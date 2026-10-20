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
import * as Effect from 'effect/Effect';
import * as Option from 'effect/Option';
import * as Schema from 'effect/Schema';
import { errorMessage } from '../../../engine/lib/errors.mjs';
import {
  ProviderReplyError,
  ProviderRequestError,
  ProviderTransportError,
  runProvider,
  validated,
  withTimeout,
} from '../../gemini-tts/scripts/provider-http.mjs';
import { wavFromPcm } from '../../gemini-tts/scripts/wav.mjs';

const URL_BASE =
  process.env.LYRIA_RT_URL ??
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic';
export const SCALES: readonly string[] = [
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

export interface WeightedPrompt {
  text?: string | undefined;
  weight: number;
}
export interface RealtimeOptions {
  prompts: readonly WeightedPrompt[];
  bpm?: number | undefined;
  density?: number | undefined;
  brightness?: number | undefined;
  scale?: string | undefined;
  guidance?: number | undefined;
  temperature?: number | undefined;
  seed?: number | undefined;
  muteDrums?: boolean | undefined;
  mode?: string | undefined;
}
interface GenerationConfig {
  musicGenerationMode: string;
  bpm?: number;
  density?: number;
  brightness?: number;
  scale?: string;
  guidance?: number;
  temperature?: number;
  seed?: number;
  muteDrums?: boolean;
}
export type ClientMessages = [
  { setup: { model: string } },
  { clientContent: { weightedPrompts: readonly WeightedPrompt[] } },
  { musicGenerationConfig: GenerationConfig },
  { playbackControl: 'PLAY' },
];

function generationConfig(o: RealtimeOptions): GenerationConfig {
  const cfg: GenerationConfig = { musicGenerationMode: o.mode ?? 'QUALITY' };
  if (o.bpm != null) cfg.bpm = Math.round(o.bpm);
  if (o.density != null) cfg.density = o.density;
  if (o.brightness != null) cfg.brightness = o.brightness;
  if (o.scale) {
    if (!SCALES.includes(o.scale))
      throw new Error(`scale must be one of ${SCALES.join(', ')}`);
    cfg.scale = o.scale;
  }
  if (o.guidance != null) cfg.guidance = o.guidance;
  if (o.temperature != null) cfg.temperature = o.temperature;
  if (o.seed != null) cfg.seed = o.seed;
  if (o.muteDrums) cfg.muteDrums = true;
  return cfg;
}

export function messages(opts: RealtimeOptions): ClientMessages {
  return [
    { setup: { model: 'models/lyria-realtime-exp' } },
    { clientContent: { weightedPrompts: opts.prompts } },
    { musicGenerationConfig: generationConfig(opts) },
    { playbackControl: 'PLAY' },
  ];
}

const RATE = 48000,
  CHANNELS = 2;

const ServerMessageSchema = Schema.Struct({
  setupComplete: Schema.optionalKey(Schema.Unknown),
  filteredPrompt: Schema.optionalKey(Schema.Unknown),
  warning: Schema.optionalKey(Schema.Unknown),
  serverContent: Schema.optionalKey(
    Schema.Struct({
      audioChunks: Schema.optionalKey(
        Schema.Array(Schema.Struct({ data: Schema.String })),
      ),
    }),
  ),
});
const decodeServerMessage = Schema.decodeUnknownOption(ServerMessageSchema);

/** A socket message as text, whichever form the runtime delivers it in. */
async function messageText(data: unknown): Promise<string> {
  if (typeof data === 'string') return data;
  if (data instanceof Blob)
    return Buffer.from(await data.arrayBuffer()).toString('utf8');
  if (data instanceof ArrayBuffer) return Buffer.from(data).toString('utf8');
  if (ArrayBuffer.isView(data))
    return Buffer.from(data.buffer, data.byteOffset, data.byteLength).toString(
      'utf8',
    );
  return String(data);
}

type CaptureError = ProviderTransportError | ProviderReplyError;
type Resume = (effect: Effect.Effect<Buffer, CaptureError>) => void;

/** Open the socket and collect PCM until `target` bytes; returns the canceler that closes it. */
function openCapture(
  url: string,
  msgs: ClientMessages,
  target: number,
  resume: Resume,
): Effect.Effect<void> {
  const ws = new WebSocket(url);
  const chunks: Buffer[] = [];
  let bytes = 0,
    settled = false,
    queue = Promise.resolve();
  const done = (effect: Effect.Effect<Buffer, CaptureError>): void => {
    if (settled) return;
    settled = true;
    resume(effect);
  };
  const finish = (): void => {
    try {
      ws.send(JSON.stringify({ playbackControl: 'STOP' }));
    } catch {}
    ws.close();
    done(Effect.succeed(Buffer.concat(chunks)));
  };
  const handle = (raw: string): void => {
    if (settled) return;
    const m = Option.getOrUndefined(decodeServerMessage(JSON.parse(raw)));
    if (!m)
      return done(
        Effect.fail(
          new ProviderReplyError({
            message: 'Lyria RealTime sent an unreadable message',
          }),
        ),
      );
    if (m.setupComplete) {
      for (const x of msgs.slice(1)) ws.send(JSON.stringify(x));
      return;
    }
    if (m.filteredPrompt)
      console.warn(`prompt filtered: ${JSON.stringify(m.filteredPrompt)}`);
    if (m.warning) console.warn(`warning: ${String(m.warning)}`);
    for (const c of m.serverContent?.audioChunks ?? []) {
      const buf = Buffer.from(c.data, 'base64');
      chunks.push(buf);
      bytes += buf.length;
    }
    if (bytes >= target) finish();
  };
  ws.onopen = () => ws.send(JSON.stringify(msgs[0]));
  ws.onerror = (e) => {
    const detail =
      'message' in e && typeof e.message === 'string' ? e.message : e.type;
    done(
      Effect.fail(
        new ProviderTransportError({
          url: URL_BASE,
          message: `WebSocket error: ${detail}`,
        }),
      ),
    );
  };
  ws.onclose = (e) => {
    if (bytes < target)
      done(
        Effect.fail(
          new ProviderTransportError({
            url: URL_BASE,
            message: `socket closed early (${e.code} ${e.reason})`,
          }),
        ),
      );
  };
  ws.onmessage = (ev) => {
    const data: unknown = ev.data;
    // In arrival order, even when a binary frame must be read asynchronously.
    queue = queue
      .then(() => messageText(data))
      .then(handle)
      .catch((cause: unknown) =>
        done(
          Effect.fail(
            new ProviderReplyError({ message: errorMessage(cause), cause }),
          ),
        ),
      );
  };
  return Effect.sync(() => {
    settled = true;
    ws.close();
  });
}

export interface StreamOptions {
  key?: string | undefined;
  seconds?: number | undefined;
  timeoutMs?: number | undefined;
}

/** Stream `seconds` of music and succeed with a WAV; a timeout or interruption closes the socket. */
export const streamEffect = (
  opts: RealtimeOptions,
  {
    key = process.env.GEMINI_API_KEY,
    seconds = 60,
    timeoutMs,
  }: StreamOptions = {},
) =>
  Effect.gen(function* () {
    if (!key)
      return yield* new ProviderRequestError({
        message: 'GEMINI_API_KEY is not set',
      });
    if (typeof WebSocket === 'undefined')
      return yield* new ProviderRequestError({
        message: 'Global WebSocket missing — use Node ≥ 22.',
      });
    const msgs = yield* validated(() => messages(opts));
    const target = seconds * RATE * CHANNELS * 2;
    const url = `${URL_BASE}?key=${encodeURIComponent(key)}`;
    const pcm = yield* Effect.callback<Buffer, CaptureError>((resume) =>
      openCapture(url, msgs, target, resume),
    ).pipe(
      withTimeout(timeoutMs ?? (seconds * 4 + 60) * 1000, 'Lyria RealTime'),
    );
    return wavFromPcm(pcm.subarray(0, target), RATE, CHANNELS);
  });

/** Stream `seconds` of music and resolve with a WAV Buffer. */
export const stream = (
  opts: RealtimeOptions,
  options: StreamOptions = {},
): Promise<Buffer> => runProvider(streamEffect(opts, options));

const numberOption = (v: string | undefined): number | undefined =>
  v ? Number(v) : undefined;

async function main(): Promise<void> {
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
  const prompts = v.prompt.map((p) => {
    const m = p.match(/^(.*?):([\d.]+)$/);
    return m ? { text: m[1], weight: +m[2] } : { text: p, weight: 1.0 };
  });
  const opts: RealtimeOptions = {
    prompts,
    bpm: numberOption(v.bpm),
    density: numberOption(v.density),
    brightness: numberOption(v.brightness),
    scale: v.scale,
    seed: numberOption(v.seed),
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

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  main().catch((e: unknown) => {
    console.error(errorMessage(e));
    process.exit(1);
  });
}
