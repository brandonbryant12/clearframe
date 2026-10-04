---
name: veo-video
description: Generate short footage with Google Veo 3.1 via the Gemini API — defaults to the cheapest model (veo-3.1-lite-generate-preview, 720p, 4 s ≈ $0.20) — with the exact predictLongRunning contract, polling and download, image-to-video from a Gemini still for style consistency, constraints, pricing, and prompt recipes for calm establishing plates. Use rarely: only for an establishing shot code can't fake, ≤ 20% of runtime, never to carry information.
---

ClearFrame defaults generated clips to Gemini Omni Flash 1.1. Select a Veo model explicitly to use this alternate provider.

# Veo footage

**Last resort, by design.** A ClearFrame film is typography, numbers and diagrams. Footage earns its place only as an *establishing plate*: a place, a physical process, a texture in motion that code can't fake. It never carries information, since text and numbers in generated video are unreliable. Put the words and numbers over the plate in code.

Budget rule: ≤ 20% of runtime, clips of 4 s, and one or two per film. `clearframe plan` warns above 20%.

## Use it

```jsonc
"assets": [
  { "id": "atrium", "kind": "image", "prompt": "Architectural photograph of an empty modern atrium at dawn … No people, no text." },
  { "id": "atrium-move", "kind": "clip", "from": "atrium", "seconds": 4,
    "prompt": "Very slow forward dolly through the atrium, soft dawn light shifting across the floor, calm, no people, no text, no camera shake." }
]
```
```bash
clearframe images <dir> && clearframe clips <dir>     # still first, then animate it (style consistency)
node skills/veo-video/scripts/veo.mjs --prompt "…" --image still.jpg --seconds 4 --out clip.mp4 [--dry-run]
```
In a scene: `<video src="assets/clips/atrium-move.mp4" data-start="hook" muted playsinline></video>`. The runtime seeks it frame-accurately, and its audio is ignored because ClearFrame mixes sound separately.

## Contract (verified 2026-09-27 against ai.google.dev/gemini-api/docs/veo)

`POST https://generativelanguage.googleapis.com/v1beta/models/veo-3.1-lite-generate-preview:predictLongRunning` with header `x-goog-api-key`
```json
{ "instances": [{ "prompt": "…",
    "image": { "inlineData": { "mimeType": "image/jpeg", "data": "<base64>" } } }],
  "parameters": { "aspectRatio": "16:9", "resolution": "720p", "durationSeconds": "4" } }
```
1. The call returns `{ "name": "<operation>" }`.
2. Poll `GET https://generativelanguage.googleapis.com/v1beta/<operation>` every ~10 s until `"done": true`. Latency runs from 11 s to 6 min.
3. Read the URI at `response.generateVideoResponse.generatedSamples[0].video.uri`, then download it **with the `x-goog-api-key` header**, following redirects. Files stay on the server for 2 days.

Constraints:
- `aspectRatio`: `16:9` or `9:16`.
- `durationSeconds`: `"4"`, `"6"` or `"8"`, sent as strings as the docs show. 1080p and 4k require 8 s, and Lite has no 4k.
- `personGeneration`: `allow_all` is the only value for text-to-video and `allow_adult` the only value for image-to-video. ClearFrame omits it, and the prompts avoid people.
- `lastFrame` (interpolation) requires `image`.
- `referenceImages` and extension are available on 3.1 and 3.1 Fast only.
- `negativePrompt` is **not documented** on the Gemini API, so put exclusions in the prompt.
- Output is MP4 at 24 fps with native audio (always on) and a SynthID watermark.

| Model | 720p | 1080p | 4k |
|---|---|---|---|
| `veo-3.1-lite-generate-preview` (**default, cheapest**) | $0.05/s | $0.08/s | — |
| `veo-3.1-fast-generate-preview` | $0.10/s | $0.12/s | $0.30/s |
| `veo-3.1-generate-preview` | $0.40/s | $0.40/s | $0.60/s |

A 4 s Lite clip at 720p costs $0.20. In a 2026-10-04 sizzle production, Standard at 1080p was 80% of the spend and only about 3 s of each 8 s clip was used: explore on Lite or Fast, and keep Standard for close-ups (see `docs/google-generation-field-notes.md`). Upscaling a 720p plate under grain and a vignette at 1080p is usually invisible; use 1080p (8 s, $0.64) only for full-bleed hero plates.

## Prompt recipes (calm plates)

Structure: **camera move → subject → light → palette → pace → exclusions.**
- "Very slow forward dolly across a sunlit wooden desk with neatly stacked paper, shallow depth of field, warm morning light, muted palette, calm, no people, no text, no logos, no camera shake."
- "Locked-off wide shot of clouds drifting over a quiet city skyline at dusk, soft haze, slate-blue palette, slow and steady, no text, no people in frame."
- "Macro slow pan across flowing ink dispersing in water, cobalt on off-white, soft light, graceful and slow, no text."
- For vertical, use `--aspect 9:16` and compose with the top 11% and bottom 20% kept clear.

**Image-to-video from a Gemini still** is the house technique. Generate the look with `gemini-image`, then animate it, so every plate matches the theme's palette.

**Continuing a shot:** pass the previous clip's last frame as `image` and describe the camera move away from it. That produced a seamless pull-out in one production. Also add "consistent lighting, no lens flares" to counter late-clip drift, and expect actions prompted for "the end" to land mid-clip. Field notes: `docs/google-generation-field-notes.md`.

## Don't

- Don't rely on it for text, numbers, charts, UI, logos, faces or recognisable people.
- No fast motion, handheld shake, whip pans or "epic" drone swoops. They fight the calm grammar. A `sizzle` or `trailer` brief may ask for that energy; then follow the field notes above.
- Don't generate footage to fill time. If a beat feels empty, the script or the visual idea is the problem.
