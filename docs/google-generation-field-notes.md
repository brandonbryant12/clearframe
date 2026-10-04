# Google generation field notes

*Observed in one paid production on **2026-10-04**: a 20 s vertical (9:16) sizzle reel built from generated plates, with native type and a separately mixed soundtrack. Prices come from [ai.google.dev pricing](https://ai.google.dev/gemini-api/docs/pricing) on that date. Sample sizes are small; treat each behaviour as a lead to check, not a guarantee. Contracts live in `docs/gemini-api-contracts.md`.*

## Where the money went

| Service | Use | Estimate |
| --- | --- | --- |
| Veo 3.1 Standard (`veo-3.1-generate-preview`) | 6 image-to-video clips × 8 s, 1080p | **$19.20** |
| Nano Banana Pro (`gemini-3-pro-image`) | 5 storyboard stills at 2K | $0.67 |
| Lyria (`lyria-3.5` ×2, `lyria-3-pro-preview` ×1) | 3 music takes | $0.24 |
| Gemini 3.1 Pro (`gemini-3.1-pro-preview`) | 3 audio/video review calls | ~$0.15 |

Veo was about 80% of the total spend. Only 2 of the 6 clips reached the cut, and the cut used about 3 s from each 8 s clip.

- **Explore on Lite or Fast; pay for Standard only where texture reads.** Lite or Fast at 720p for 4 s costs $0.20–0.40 a clip. Keep Standard for close-ups of a subject's skin, eyes or teeth. The same six clips on Fast at 1080p would have cost $5.76.
- **1080p means 8 s.** Requests for 4 s and 6 s at 1080p returned HTTP 400. For a 3 s beat, generate 720p at 4 s and upscale under grain.
- **Storyboard with stills first.** At about $0.13 per Nano Banana Pro still, every accepted clip started from an approved still. This was the cheapest quality lever in the project.
- Veo audio is always generated and was always discarded. The Gemini API pricing table quotes only a with-audio rate.

## Veo 3.1

- **Seed a continuation with the previous clip's last frame.** The previous shot's last frame went in as `image`, with the prompt "the camera pulls back from the rider's view, revealing…". The result continued that shot without a visible join (1 of 1 attempt). It was the strongest transition in the film, and it works whichever provider made the earlier clip.
- **Late-clip drift.** One Standard take developed a lens flare at about 2.7 s, after which the subject's colour drained to grey. The next two takes added "consistent lighting, no lens flares, the subject keeps its colour throughout" to the prompt and did not drift.
- **"At the end" actions land mid-clip.** "In the final moment, flame erupts" started at about 4.5 s of 8 s in both takes. Find the onset frame by frame before cutting it to a beat.
- **Hover prompts make static clips.** A subject told to "hover" or "bank" barely moved. Ask for camera travel explicitly ("the camera rushes backward and upward in one sweeping move").
- **Moderation.** Veo accepted a recognisable named game character in 6 image-to-video jobs, with the first frame from a Nano Banana Pro still and the character described rather than named. Nano Banana Pro rendered it by name. Another provider blocked face-forward shots of the same character. Acceptance is not a licence: the rights question is separate.

## Nano Banana Pro keyframes

- 9:16 at `2K` returned 1536×2752 PNGs. That is enough for a 1080×1920 first frame, with headroom for a crop.
- Passing an approved still as a reference image kept the character consistent across new framings (profile, close-up) without describing it again.
- The legacy `generateContent` path with `generationConfig.imageConfig {aspectRatio, imageSize}` also works. ClearFrame's script uses Interactions.

## Lyria

- **Length and section timestamps were not honoured.** A prompt for a 20 s cue (drop at 0:10, end 0:20) returned 60 s and 70 s songs from `lyria-3.5` and 70 s from `lyria-3-pro-preview`. The requested structure did exist, but later. In one take, a driving open and a build led to a one-bar stop at 26.05–27.43 s and a drop at 27.44 s.
- **Tempo was honoured.** 140 BPM was requested, and all three takes measured 139.67 BPM. Still measure with `beatmap`.
- **Fit a short film by splicing bar-aligned pieces.** Take the song's first 3 bars, then jump to 4 bars before the drop, with cut points on measured bar multiples and 12 ms fades.
- `lyria-3-pro-preview` is $0.08 per song. Its text block returns section tokens (`[[A0]] [[B1]] …`), not timestamps.

## Gemini 3.1 Pro as reviewer

- **Useful for macro critique.** It flagged a late hook (fire at 1.9 s), a small call-to-action and an abrupt audio tail; all three were confirmed in frames and waveforms, then fixed. As a sound-effect screener it rejected voice-like and cartoonish roars. No human listened to confirm those calls.
- **Unreliable on timing and provenance.** In all three takes it placed Lyria's stop and drop at 29.5–30.0 s; the waveform measured 26.05–27.44 s. It described generated footage as a "Blender/Unreal render" and asked for texture and rig fixes. Treat its timestamps as hints, then measure.
- A 124 MB MP4 sent inline to `generateContent` was accepted and reviewed. Inline limits are not a documented guarantee for files that size; use the Files API for anything you depend on.
