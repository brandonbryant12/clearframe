---
name: lyria-music
description: Score a video with Google Lyria via the Gemini API — lyria-3.5 (full instrumental beds, duration and timestamped structure steered by prompt) or lyria-3-clip-preview (30 s), plus experimental Lyria RealTime (WebSocket, exact length/BPM). Exact contracts, prompt recipes for calm professional beds, structure derived from the edit, mixing levels, pricing. Use when a ClearFrame film (> ~20 s) needs music.
---

# Lyria music

Music gives a professional film warmth and pace, if it stays **under** the voice. One bed per film costs $0.08.

## Use it

```jsonc
"music": {
  "model": "lyria-3.5",
  "prompt": "Minimal modern ambient, soft felt piano, warm analog pads, a very light pulse",
  "bpm": 80, "key": "D major", "volume": 0.2,
  "arc": { "The forecast": "Intro: a single felt-piano figure over a soft pad.", "Recap": "Resolve on a sustained chord." }
}
```
```bash
clearframe music <dir> --draft   # free synthesized pad, for timing and mix checks
clearframe plan <dir>            # ≈ $0.08
clearframe music <dir>           # → assets/music/bed.wav (+ bed.json with prompt and model notes)
node skills/lyria-music/scripts/music.mjs --style "…" --bpm 80 --key "D major" --seconds 60 --section "0:00-0:08|sparse intro" --dry-run
```
**The engine writes the structure for you.** It groups beats by `chapter`, converts them to timestamps (`[0:00 - 0:09] Intro: …`), asks for about the film's length plus 2 s, adds "Instrumental only, no vocals" and a mix note ("sits under a spoken voiceover"), and asks for a clean ending on a sustained chord. Override per chapter with `music.arc` or fully with `music.sections`.

## Contract: Lyria 3.5 / 3 Clip (verified 2026-09-27)

`POST https://generativelanguage.googleapis.com/v1beta/interactions` with header `x-goog-api-key`
```json
{ "model": "lyria-3.5",
  "input": "Minimal modern ambient, 80 BPM, in D major.\nInstrumental only, no vocals.\nDuration: about 48 seconds.\n[0:00 - 0:09] Intro: …\nEnding: end cleanly on a sustained chord, no fade-out.",
  "response_format": { "type": "audio", "mime_type": "audio/wav" } }
```
- The response holds `steps[type="model_output"].content[]`: a `text` block (structure or lyrics) and an `audio` block `{ mime_type, data }`.
- Output is 44.1 kHz stereo. **MP3 is the default**; `mime_type: "audio/wav"` (from the documented `AudioResponseFormat` enum) requests WAV. The engine accepts either.
- `input` may also be an array with up to 10 images (mood references).
- Duration is steered **in the prompt** ("about 60 seconds") and by timestamped sections. `lyria-3-clip-preview` is always 30 s.
- There is no negative prompt and no seed, and identical calls vary. Everything is SynthID-watermarked. Named-artist prompts are blocked.

| Model | Output | Price |
|---|---|---|
| `lyria-3.5` (default) | full track, up to a couple of minutes | $0.08 / song |
| `lyria-3-clip-preview` | 30 s clip; good for shorts and auditioning a style | $0.04 / clip |
| `lyria-realtime-exp` | endless steerable stream (experimental) | not listed |

## Lyria RealTime (experimental)

Use it when you need an exact BPM or scale, or a bed longer than a song. Set `"model": "lyria-realtime"` with `weightedPrompts`, `bpm`, `density`, `brightness` and `scale`, or run `scripts/realtime.mjs`.
- Endpoint: `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateMusic`
- Protocol: send `{setup:{model:"models/lyria-realtime-exp"}}` and wait for `setupComplete`. Then send `{clientContent:{weightedPrompts:[…]}}`, `{musicGenerationConfig:{bpm, density, brightness, scale, guidance, …}}` and `{playbackControl:"PLAY"}`. Collect `serverContent.audioChunks[].data`: raw s16le PCM, 48 kHz, stereo.
- Each client message carries exactly one field. A config message replaces the whole config, and bpm or scale changes need `RESET_CONTEXT`.
- **Unverified in the docs:** raw-socket API-key auth (`?key=`, the Live API convention) and a v1beta URL. Prefer Lyria 3.5 unless you need RealTime's control.

## Prompt recipes

Lead with genre, then instruments, tempo, key and mood. Keep it spare: the voice is the lead.

| Film | Prompt core | BPM / key |
|---|---|---|
| Calm explainer (default) | Minimal modern ambient, soft felt piano, warm analog pads, very light pulse | 76–84 · D major |
| Confident update | Understated electronic, muted plucked synth arpeggio, soft kick on quarters, warm sub bass | 96–104 · A minor |
| Sober, reflective | Slow cinematic strings and piano, sparse, lots of space, no percussion | 60–70 · C minor |
| Restrained launch | Bright minimal house groove, filtered chords, soft claps, restrained energy | 112–118 · F major |
| Technical deep-dive | Minimal techno pulse, soft Rhodes, gentle glitch-free texture, steady and focused | 90–100 · E minor |

Useful Lyria vocabulary: *Chillout, Minimal Techno, Deep House, Synthpop, Trip Hop, Orchestral Score, Piano Ballad*. Instruments: *Rhodes Piano, Synth Pads, Moog Oscillations, Cello, Harp, Marimba, Vibraphone, Kalimba, Precision Bass*. Moods: *Ambient, Chill, Dreamy, Relaxed, Upbeat, Triumphant (sparingly), Ethereal*.

## Mixing (the engine does this)

- The bed sits at `volume` 0.18–0.22 (about −14 dB) and is **sidechain-ducked** under the narration by a further ~4–6 dB.
- 1.5 s fade in, 2.5 s fade out, loudness-normalised master (−14 LUFS web, −16 internal via `mix.loudness`).
- If the film has no narration, raise `volume` to about 0.5 and let the music carry the rhythm; cut on bars (60 / bpm × 4 s).
