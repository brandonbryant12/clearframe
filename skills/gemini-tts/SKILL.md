---
name: gemini-tts
description: Generate narration with Google Gemini text-to-speech (gemini-3.8-flash-tts, GA Sept 2026) through the Interactions API — exact request/response contract, voice casting, short style strings, inline pause tags, WAV handling, pricing, and a zero-dependency Node script. Use when a ClearFrame video (or any project) needs final voiceover, or to verify a TTS request without calling the API (--dry-run).
---

# Gemini TTS

The final voice of every ClearFrame film. It costs about $0.0023 per 10 s of speech, so a 60 s film is roughly a cent and a half. Use it for every final render. Use `clearframe voice --draft` (free OS voice) while iterating.

## Use it

```bash
clearframe voice <dir>                 # every beat with `vo`, cached by (text, voice, style, model)
clearframe voice <dir> --only hook,end # re-record specific lines
node skills/gemini-tts/scripts/tts.mjs --text "Seventy percent." --voice Charon --style "calm, measured" --out vo.wav
node skills/gemini-tts/scripts/tts.mjs --text "…" --dry-run    # prints the exact request; no key, no call
node skills/gemini-tts/scripts/tts.mjs --list-voices
```
The engine trims leading and trailing silence, measures the take, detects pauses and aligns every word, which is what `b.say('word')` uses.

## Contract (verified 2026-09-27 against ai.google.dev)

`POST https://generativelanguage.googleapis.com/v1beta/interactions` with header `x-goog-api-key: $GEMINI_API_KEY`

```json
{
  "model": "gemini-3.8-flash-tts",
  "input": [{ "type": "user_input", "content": [{
    "type": "text",
    "text": "Seventy percent. <short pause> It sounds like a sure thing.",
    "annotations": [{ "type": "speech_metadata", "style": "calm, measured, quietly confident" }]
  }]}],
  "response_format": { "type": "audio", "mime_type": "audio/wav", "sample_rate": 24000 },
  "generation_config": { "speech_config": [{ "voice": "Charon" }] }
}
```
Response: `steps[type="model_output"].content[type="audio"] = { mime_type, data: <base64>, sample_rate, channels }`.
- Unary responses are **`audio/wav` by default**: a complete file with a RIFF header, 24 kHz, mono, s16le. Write it straight to disk. (Older 2.5 and 3.1 models returned headerless L16. The script wraps `audio/l16` if it ever appears.)
- `speech_config` is an **array** for a single speaker. For two speakers, use `mode: "conversational"` with `speakers: [{ speaker, voice }]` and `speech_metadata.speaker` on each part.
- Limits are 8,192 input tokens and 16,384 output tokens per call, with no thinking or tools. ClearFrame sends one beat per call, well under the limits.
- The legacy `generateContent` form is still supported: `generationConfig.responseModalities: ["AUDIO"]` plus `speechConfig.voiceConfig.voice` and a `speech_metadata.style` part. ClearFrame uses Interactions, which Google now recommends.

| Model | Status | Audio out (per 1M tokens) | ≈ per 10 s |
|---|---|---|---|
| `gemini-3.8-flash-tts` (default) | GA, newest, most expressive | $9.00 until 2026-12-31, then $18 | $0.0023 |
| `gemini-3.8-flash-lite-tts` | GA, cheapest | $6.00 until 2026-12-31, then $12 | $0.0015 |

Audio is 25 tokens per second. Batch and Flex are 50% off. The 2.5 and 3.1 preview TTS models are deprecated.

## Directing the voice

- **The text is read verbatim.** Don't write "Say calmly:" in the text; it will be spoken.
- **Style is short and constant:** set `voice.style` once, e.g. `calm, measured, quietly confident`. Long "director's notes" cause drift between lines. Override per beat only for a deliberate shift (`slower, softer`).
- **Inline tags:** `<short pause>`, `<long pause>`, `<breath>`. Tags like `<laugh>`, `<sigh>` and `<whispers>` exist; don't use them in professional pieces.
- **Emphasis:** word order first. CAPS forces stress but shows in captions.
- **Accent, age and gender belong to the voice.** Choose a different voice rather than describing one in the style string. Hundreds more voices are available via `GET /v1beta/voices` and voice design, but prebuilt voices are the stable default.

Casting for professional work: Charon (informative, the default), Sadaltager (knowledgeable), Schedar (even), Iapetus or Erinome (clear), Sulafat (warm), Kore (firm), Gacrux (mature). The full table is in `clearframe-script`.

## Gotchas

- Keep lines per beat short (5–15 words). Shorter takes are more consistent and cheaper to redo.
- If a take sounds wrong, change the text (punctuation, word order) before the style. The model follows the words.
- A `status` other than `completed` (`failed`, `incomplete`) throws with the error. 429 and 5xx responses retry with backoff.
- Synthetic voice must be disclosed (see `clearframe-integrity`). Never replicate a real person's voice without consent.
