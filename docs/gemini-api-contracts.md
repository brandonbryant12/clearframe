# Gemini API contracts used by ClearFrame

*Verified against ai.google.dev on **2026-11-18**. All calls use the Gemini Developer API with header `x-goog-api-key: $GEMINI_API_KEY` (never a query string, except the Lyria RealTime socket). The request bodies below are pinned by `test/contracts.test.mjs`. Each script prints its exact request with `--dry-run`, without a key or a network call.*

Google now recommends the **Interactions API** (`POST /v1beta/interactions`, snake_case, GA June 2026) for new models. `generateContent` remains supported as "legacy". ClearFrame uses Interactions for Neon shot advice, TTS, transcription, image generation, Lyria and Omni video.

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
{ "model": "gemini-nano-banana-2.1",
  "input": [{ "type": "text", "text": "…" }, { "type": "image", "mime_type": "image/png", "data": "<b64>" }],
  "response_format": { "type": "image", "mime_type": "image/jpeg", "aspect_ratio": "16:9", "image_size": "2K" } }
```
- **Response:** `steps[type=model_output].content[type=image] → { mime_type, data }`.
- **Sizes:** `512` (3.1 Flash only), `1K`, `2K`, `4K`, with an uppercase K.
- **Default:** Nano Banana 2.1 produces 1K, 2K and 4K images. Estimated output charges are $0.0336, $0.0504 and $0.113 respectively. It accepts up to 14 reference images. [Model](https://aistudio.google.com/docs/models/gemini-nano-banana-2.1)
- **Earlier model pins:** `gemini-3.1-flash-image` ($0.067 per image at 1K, $0.101 at 2K), `gemini-3.1-flash-lite-image` ($0.0336, 1K only) and `gemini-3-pro-image` ($0.134 at 1K/2K, $0.24 at 4K; checked 2026-10-04). Pro at 9:16 `2K` returns 1536×2752.
- **Retired:** Imagen is shut down on the Gemini API, and `gemini-2.5-flash-image` is scheduled for shutdown on 2027-03-15.
- **Sources:** [image-generation](https://ai.google.dev/gemini-api/docs/image-generation) · [interactions API reference](https://ai.google.dev/api/interactions-api)

## Music: `skills/lyria-music/scripts/music.mjs`

MP3 request path corrected on 2026-09-28; tests use mocked responses, not paid generation.

```json
{ "model": "lyria-3.5", "input": "<prompt with BPM, key, 'Instrumental only, no vocals.', duration, [m:ss - m:ss] sections>",
  "response_format": { "type": "audio" } }
```
- **Response:** `steps[type=model_output].content[]` holds a `text` block (structure) and an `audio` block.
- **Output:** 44.1 kHz stereo, MP3 by default. Use that default without a MIME override. The guide mentions WAV but its examples show only `type`; the previous inferred WAV override failed in use. `--format` accepts `mp3` only. Convert MP3 locally if WAV is required.
- **Files:** the engine requests MP3, saves using the returned MIME (`audio/mpeg` or `audio/mp3` → `.mp3`), and records the active filename in `bed.json`. Unsupported response types fail instead of being mislabeled as MP3. Draft and RealTime music still use locally produced WAV.
- **Pricing:** `lyria-3.5` is $0.08 per song and `lyria-3-clip-preview` $0.04 per 30 s clip. `lyria-3-pro-preview` (legacy) is $0.08 per song (checked 2026-10-04).
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

## Gemini 4 Neon shot direction

`clearframe find "explain an approval exception" --neon --dry-run` prints the shortlist, the serialized request and an estimated ceiling. Omit `--dry-run` to make one request, optionally setting `--budget USD`. Local search remains available without an account. The response schema admits only candidate IDs. ClearFrame resolves the ID into editable catalog data and returns the proposed movement and a visible review check. The model uses low thinking, a 1,024-token output limit, and no stored interaction. The published standard rates are $3 per million input tokens and $15 per million output tokens. [Neon model](https://aistudio.google.com/docs/models/gemini-4-neon)

## Generated video

`gemini-omni-1.2-flash` accepts ordered image and text input. The video response format carries the resolution, aspect, URI delivery and a duration such as `"4s"`. Request 3–15 whole seconds. ClearFrame treats two images as opening and closing frames. That mode and a follow-up interaction allow up to 10 seconds. Up to six image references are supported. Output estimates at 360p, 720p, 1080p and 4K use 1,931, 5,792, 8,688 and 17,376 tokens per second respectively at $12 per million. A four-second 720p shot estimates $0.278016 before variable input charges. Explicit Omni 1.1 pins retain their earlier request shape. [Omni](https://aistudio.google.com/docs/omni) · [Pricing](https://aistudio.google.com/docs/pricing)

The Gemini Developer API retired Veo 3.1 preview, Fast and Lite on October 22. A cached shot can still be rendered. Select Omni and run `plan` to price a replacement. [Google deprecations](https://aistudio.google.com/docs/deprecations)

## Field notes

Observed behaviour, costs and reviewer reliability from a real paid production (2026-10-04): `docs/google-generation-field-notes.md`.

## Keeping this current

Models and prices change. When a call fails with a model-not-found or schema error, read the linked page, update the script's `buildRequest`, the model and price table at the top of the script, and `test/contracts.test.mjs`, then note the new verification date here.

## Native speech and sparse Omni footage (verified 2026-09-28)

- `gemini-3.5-transcribe`: Interactions, uploaded audio URI, `generation_config.transcription_config.mode = {type:"verbatim", timestamp_granularities:["word"]}`. Parse model-output `word_info` annotations with second-valued offsets. See `packages/engine/src/engine/lib/speech.mts` and [Google transcription](https://ai.google.dev/gemini-api/docs/transcribe).
- Clip continuity/cache keys include palette, visual instructions and reference bytes. Clip audio is excluded from the native film's shared mix. Provider correctness is covered by mocked tests; no live paid call was made for this migration.
