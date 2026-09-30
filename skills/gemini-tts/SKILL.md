---
name: gemini-tts
description: Generate and direct narration with Google Gemini 3.8 Flash TTS (gemini-3.8-flash-tts) through the Interactions API — one continuous take per film for a consistent voice, casting, one short style, writing delivery into the words, inline vocal tags, two-voice conversations, designed voices, limits, pricing and a zero-dependency Node script. Use whenever a ClearFrame film (or any project) needs voiceover, when a voice sounds inconsistent or flat, or to check a TTS request without calling the API (--dry-run).
---

# Gemini 3.8 TTS

Every final ClearFrame voice comes from Gemini 3.8 Flash TTS. It costs about $0.0023 per 10 s of speech, so a 60 s film is about a cent and a half. Iterate with the free OS voice (`clearframe voice DIR --draft`) and record Gemini once the words are right.

## The rule: one continuous take, one short style

The model gives a consistent, lively voice when it reads **the whole narration in one request, as one text, with one short style**. Voices drift when lines are recorded separately, each with its own style, and stitched together. Every style re-prompts the voice, and every join resets pitch, energy and room tone. ClearFrame therefore:

- records the whole film as **one take** by default (`voice.takes: "film"`). Only films past about 8 minutes are split, at a chapter boundary. Gemini allows 8,192 input and 16,384 output tokens per call, about 10 minutes of speech.
- sends the take as **one text part with `voice.style`**. Beats are separated by paragraph breaks, which read as natural pauses. The engine then cuts the take back into beats at those pauses, using word timings measured by local Whisper.
- **ignores per-beat `style`** in continuous takes (with a warning). `voice.perBeatStyle: true` sends them anyway, as separate parts, which buys control at the cost of consistency. Avoid it.

`voice.takes: "chapter"` (one take per chapter) and `"beat"` (one per line) still exist. Use `beat` only for one-off inserts.

## Use it

```bash
clearframe voice <dir> --draft          # free OS voice, one continuous take, words measured with Whisper
clearframe voice <dir>                  # Gemini: one continuous take (cached by text, voice, style, model)
clearframe voice <dir> --force          # re-record after changing words
clearframe voice <dir> --dry-run        # the exact request per take (one text, one style); no key, no call
node skills/gemini-tts/scripts/tts.mjs --text "Seventy percent." --voice Charon --style "calm, measured" --out vo.wav
node skills/gemini-tts/scripts/tts.mjs --text "…" --dry-run    # prints the exact request; no key, no call
node skills/gemini-tts/scripts/tts.mjs --list-voices
```
`voice` prints the estimated seconds and cost and honours `--budget` / `storyboard.budget`. Don't make paid calls merely to test code; use `--dry-run`.

## Directing the voice: cast, direct, speak

1. **Cast (the voice).** Accent, age, gender and timbre belong to the voice, not to the style. Pick a prebuilt voice (table below), or design one once and reuse its ID. Keep the same `voice.voice` across a series.
2. **Direct (one short style).** Use 2–6 words that describe a person talking, for example `warm, curious, unhurried`, `clear, quietly confident`, `bright, conversational` or `low, measured, intimate`.
   - Don't stack emotions.
   - Don't write long "audio profiles", scene descriptions or director's notes; they cause drift.
   - Never tell the model to keep the voice steady.
   - Test plain (no style) first, then add a style only to tweak.
3. **Speak (the text, read verbatim).** Everything is spoken except inline tags in angle brackets and backchannels in pipes, so `(whispering)` or `Say calmly:` will be read aloud. Delivery comes from the writing:
   - **Fragments** punch: "Seven degrees. That's the gap."
   - **Commas and full stops** pace a line. A dash (`--`) cuts it short. An ellipsis (`...`) trails off or hesitates.
   - **A question** lifts the voice. Use one real question per minute.
   - **Word order sets stress:** the last word of a sentence lands. CAPITALS force stress but show in captions.
   - **Numbers:** write digits ("70%", "2025"); they are read naturally, and cues match either way.

### Inline tags (Gemini 3.8)

Tags go exactly where the sound happens. In other languages, keep the tags in English.

| Use | Tags |
|---|---|
| **Narration** (sparingly) | `<short pause>` before a number or reveal, `<long pause>` after a turn, `<breath>` before a big line |
| **Conversation** (one or two per minute) | `<chuckle>`, `<laugh>`, `<sigh>`, `<exhales>`, `<gasp>`, `<tsk>`, `<phew>`, `<whispering>` |
| **Character and drama only** | `<laughter>`, `<giggle>`, `<snicker>`, `<cackle>`, `<cheer>`, `<shout>`, `<scream>`, `<shriek>`, `<cry>`, `<sob>`, `<whimper>`, `<groan>`, `<moan>`, `<grunt>`, `<growl>`, `<grr>`, `<hiss>`, `<argh>`, `<pant>`, `<heavy breath>`, `<cough>`, `<sneeze>`, `<yawn>`, `<throat-clearing>`, `<snort>`, `<pff>` |

**Backchannels:** in a two-voice take, a listener's reaction goes in pipes inside the other speaker's turn, for example `|mm-hm|`, `|oh really?|` or `|right|`. `critique` flags heavy tag use and bracketed directions.

### Two voices

Set `voice.cast` (for example `{"host": {"voice": "Puck", "style": "curious"}, "guest": {"voice": "Kore", "style": "knowledgeable, warm"}}`) and a `speaker` on each beat. A take is one `mode: "conversational"` request with up to two prebuilt voices and an explicit speaker on every turn. Each speaker keeps their own constant style. Designed or replicated voices can't share a conversational request; they are synthesized turn by turn, so expect less natural turn-taking.

### Designed and replicated voices

- **Voice Design** creates a voice from a text description, with a preview. **Replication** clones a voice from about 30 s of audio plus a spoken consent recording.
- Both return a reusable voice ID: put it in `voice.voice` (check the request shape with `--dry-run`). A designed voice is the most reliable way to keep one signature voice across many films.
- Keep its style strings short: long prompts on top of a designed voice drift the fastest.
- Replicate only voices you have explicit consent for, and disclose synthetic voices (`clearframe-integrity`).

## Contract (verified 2026-09-30 against ai.google.dev)

`POST https://generativelanguage.googleapis.com/v1beta/interactions` with header `x-goog-api-key: $GEMINI_API_KEY`

```json
{
  "model": "gemini-3.8-flash-tts",
  "input": [{ "type": "user_input", "content": [{
    "type": "text",
    "text": "Seven degrees. That's how much hotter a city night can run.\n\nIt's only a few degrees, right?\n\n…",
    "annotations": [{ "type": "speech_metadata", "style": "warm, curious, quietly concerned" }]
  }]}],
  "response_format": { "type": "audio", "mime_type": "audio/wav", "sample_rate": 24000 },
  "generation_config": { "speech_config": [{ "voice": "Charon" }] }
}
```
- **Response:** `steps[type="model_output"].content[type="audio"] = { mime_type, data: <base64>, sample_rate, channels }`. Unary responses are a complete `audio/wav` file (24 kHz mono s16le); write it straight to disk. The script wraps `audio/l16` if it ever appears.
- **`speech_metadata` applies per content part (turn).** One part means one style. Two voices need `speech_config: { mode: "conversational", speakers: [{ speaker, voice }] }` and `speech_metadata.speaker` on every part.
- **Limits:** 8,192 input tokens and 16,384 output tokens per call (audio is 25 tokens/s, so about 10 minutes). No thinking and no tools.
- **Languages:** 130+ languages, with `language` set on the speaker.
- The legacy `generateContent` form still works; ClearFrame uses Interactions, which Google recommends.

| Model | Status | Audio out (per 1M tokens) | ≈ per 10 s |
|---|---|---|---|
| `gemini-3.8-flash-tts` (default) | GA, most expressive | $9.00 until 2026-12-31, then $18 | $0.0023 |
| `gemini-3.8-flash-lite-tts` | GA, cheapest | $6.00 until 2026-12-31, then $12 | $0.0015 |

Batch and Flex are 50% off. The 2.5 and 3.1 preview TTS models are deprecated.

## Prebuilt voices

| Tone | Voices |
|---|---|
| Informative, neutral (default) | **Charon**, Rasalgethi, Sadaltager (knowledgeable), Schedar (even) |
| Clear, precise | Iapetus, Erinome |
| Warm, reassuring | Sulafat, Achird (friendly), Vindemiatrix (gentle) |
| Firm, authoritative | Kore, Orus, Alnilam |
| Mature, grounded | Gacrux |
| Lively (launches, social, used sparingly) | Laomedeia, Puck, Sadachbia, Zephyr |

The full list: Zephyr, Puck, Charon, Kore, Fenrir, Leda, Orus, Aoede, Callirrhoe, Autonoe, Enceladus, Iapetus, Umbriel, Algieba, Despina, Erinome, Algenib, Rasalgethi, Laomedeia, Achernar, Alnilam, Schedar, Gacrux, Pulcherrima, Achird, Zubenelgenubi, Vindemiatrix, Sadachbia, Sadaltager, Sulafat. More than 2,000 more are in the Extended Voice Library (`--list-voices`).

## When the voice is wrong

| Symptom | Fix |
|---|---|
| The voice changes between lines | Make sure `voice.takes` is `film` (the default) and there is no `voice.perBeatStyle`; remove per-beat `style`. Re-record the whole take. |
| It drifts over a long take | Shorten `voice.style` to 2–6 words. Remove anything like "maintain the same voice". Consider a designed voice. |
| Flat | The words are flat. Add fragments, one question, a pause before the reveal, and put the stressed word last. Then try a livelier voice before a stronger style. |
| Too theatrical | Remove tags, soften the style ("clear, conversational"), and pick a neutral voice (Charon, Schedar). |
| A direction was read aloud | It was in the text. Move it to a tag or the style. |
| One line reads wrong | Change that line's punctuation or word order and re-record the take. Don't patch in a single-line take. |
| Beat cuts land mid-word | Install Whisper (`align --whisper`) so the take is split on measured words. Give each beat a clear full stop. |
