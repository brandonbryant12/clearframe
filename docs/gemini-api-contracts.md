# Gemini API contracts used by ClearFrame

*Verified against ai.google.dev on **2026-09-27**. All calls use the Gemini Developer API with header `x-goog-api-key: $GEMINI_API_KEY` (never a query string, except the Lyria RealTime socket). The request bodies below are pinned by `test/contracts.test.mjs`. Each script prints its exact request with `--dry-run`, without a key or a network call.*

Google now recommends the **Interactions API** (`POST /v1beta/interactions`, snake_case, GA June 2026) for new models. `generateContent` remains supported as "legacy". ClearFrame uses Interactions for TTS, image and Lyria, and `predictLongRunning` for Veo.

## Text-to-speech: `skills/gemini-tts/scripts/tts.mjs`

```http
POST https://generativelanguage.googleapis.com/v1beta/interactions
```
```json
{ "model": "gemini-3.8-flash-tts",
  "input": [{ "type": "user_input", "content": [{ "type": "text", "text": "…",
    "annotations": [{ "type": "speech_metadata", "style": "calm, measured" }] }] }],
  "response_format": { "type": "audio", "mime_type": "audio/wav", "sample_rate": 24000 },
  "generation_config": { "speech_config": [{ "voice": "Charon" }] } }
```
- **Response:** `steps[type=model_output].content[type=audio] → { mime_type, data, sample_rate, channels }`. Unary responses default to WAV (RIFF header), 24 kHz, mono, s16le. Streaming returns headerless `audio/l16`.
- **Models and pricing:** `gemini-3.8-flash-tts` (GA 2026-09-22) at $9 per 1M audio tokens through 2026, and `gemini-3.8-flash-lite-tts` at $6. Audio is 25 tokens per second.
- **Limits:** 8,192 input and 16,384 output tokens.
- **Directing delivery:** the text is a verbatim transcript. Style goes in `speech_metadata.style`, and inline tags such as `<short pause>` and `<breath>` are allowed.
- **Sources:** [speech-generation](https://ai.google.dev/gemini-api/docs/speech-generation) · [generate-content/speech-generation](https://ai.google.dev/gemini-api/docs/generate-content/speech-generation) · [model card](https://ai.google.dev/gemini-api/docs/models/gemini-3.8-flash-tts) · [pricing](https://ai.google.dev/gemini-api/docs/pricing)

## Image generation: `skills/gemini-image/scripts/image.mjs`

```json
{ "model": "gemini-3.1-flash-image",
  "input": [{ "type": "text", "text": "…" }, { "type": "image", "mime_type": "image/png", "data": "<b64>" }],
  "response_format": { "type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9", "image_size": "2K" } }
```
- **Response:** `steps[type=model_output].content[type=image] → { mime_type, data }`.
- **Sizes:** `512` (3.1 Flash only), `1K`, `2K`, `4K`, with an uppercase K.
- **Models and pricing:** `gemini-3.1-flash-image` ($0.067 per image at 1K, $0.101 at 2K), `gemini-3.1-flash-lite-image` ($0.0336, 1K only) and `gemini-3-pro-image`.
- **Retired:** Imagen is shut down on the Gemini API, and `gemini-2.5-flash-image` shuts down 2026-10-02.
- **Sources:** [image-generation](https://ai.google.dev/gemini-api/docs/image-generation) · [interactions API reference](https://ai.google.dev/api/interactions-api)

## Music: `skills/lyria-music/scripts/music.mjs`

```json
{ "model": "lyria-3.5", "input": "<prompt with BPM, key, 'Instrumental only, no vocals.', duration, [m:ss - m:ss] sections>",
  "response_format": { "type": "audio", "mime_type": "audio/wav" } }
```
- **Response:** `steps[type=model_output].content[]` holds a `text` block (structure) and an `audio` block.
- **Output:** 44.1 kHz stereo, MP3 by default. `mime_type` comes from the documented `AudioResponseFormat` enum (the WAV example in the guide shows only `type`).
- **Pricing:** `lyria-3.5` is $0.08 per song and `lyria-3-clip-preview` $0.04 per 30 s clip.
- **Not documented:** a negative prompt or a seed.
- **Sources:** [music-generation](https://ai.google.dev/gemini-api/docs/music-generation) · [Lyria prompt guide](https://ai.google.dev/gemini-api/docs/lyria-prompt-guide)

### Lyria RealTime (experimental): `skills/lyria-music/scripts/realtime.mjs`
`wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic`
- **Session flow:**
  1. Send `{"setup":{"model":"models/lyria-realtime-exp"}}` and wait for `setupComplete`.
  2. Send `{"clientContent":{"weightedPrompts":[{"text","weight"}]}}`.
  3. Send `{"musicGenerationConfig":{bpm 60–200, density 0–1, brightness 0–1, scale, guidance 0–6, temperature 0–3, topK, seed, muteBass, muteDrums, onlyBassAndDrums, musicGenerationMode}}`.
  4. Send `{"playbackControl":"PLAY"}`.
- **Output:** `serverContent.audioChunks[].data`, raw s16le PCM at 48 kHz, stereo.
- **Unverified:** raw-socket auth via `?key=` (the Live API convention) and a v1beta URL.
- **Sources:** [realtime-music-generation](https://ai.google.dev/gemini-api/docs/realtime-music-generation) · [live_music reference](https://ai.google.dev/api/live_music)

## Video: `skills/veo-video/scripts/veo.mjs`

```http
POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-lite-generate-preview:predictLongRunning
```
```json
{ "instances": [{ "prompt": "…", "image": { "inlineData": { "mimeType": "image/jpeg", "data": "<b64>" } } }],
  "parameters": { "aspectRatio": "16:9", "resolution": "720p", "durationSeconds": "4" } }
```
- **Polling:** poll `GET /v1beta/{operation.name}` until `done`, read `response.generateVideoResponse.generatedSamples[0].video.uri`, then download it with the API-key header, following redirects.
- **Constraints:** 1080p and 4k require 8 s, Lite has no 4k, and `personGeneration` rules depend on mode. `negativePrompt` is not documented.
- **Output:** MP4 at 24 fps with audio. Files are retained for 2 days.
- **Pricing:** Lite $0.05/s at 720p and $0.08/s at 1080p; Fast $0.10, $0.12 and $0.30; Standard $0.40, $0.40 and $0.60.
- **Sources:** [veo](https://ai.google.dev/gemini-api/docs/veo) · [pricing](https://ai.google.dev/gemini-api/docs/pricing) · [deprecations](https://ai.google.dev/gemini-api/docs/deprecations)

## Keeping this current

Models and prices change. When a call fails with a model-not-found or schema error, read the linked page, update the script's `buildRequest`, the model and price table at the top of the script, and `test/contracts.test.mjs`, then note the new verification date here.
