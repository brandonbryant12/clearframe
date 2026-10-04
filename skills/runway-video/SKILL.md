---
name: runway-video
description: Generate footage through Runway Dev — Seedance 2.5/2.0 (best motion, first/last keyframes, 480p–1080p) and Gen-4.5 (cheapest, first frame only). Exact request contract, task polling, image upload, credit pricing, moderation behaviour and when to route a shot to Veo instead. Use for footage-led films (sizzle, trailer, brand spot) or a hero insert native graphics cannot draw.
---

# Runway footage

Runway Dev hosts several video models behind one task API. ClearFrame uses it for **hero motion**: a camera move through a scene, a creature or product in action, a continuous pull-out. Native blocks still carry every word, number and chart.

Set `RUNWAYML_API_SECRET` (a key from dev.runway.com). Select it per asset by model name; everything else in the clip pipeline (`plan`, `clips`, budgets, caching, continuity references) is unchanged.

```jsonc
"assets": [
  { "id": "approach", "kind": "clip", "model": "seedance2_5", "seconds": 5, "resolution": "720p",
    "prompt": "Low tracking shot gliding toward the subject, steady speed, consistent lighting, no lens flares.",
    "refs": ["assets/img/approach-start.png", "assets/img/approach-end.png"] }
]
```

```bash
clearframe plan <dir>                       # credit estimate per clip
clearframe clips <dir> --only approach --budget 3
node skills/runway-video/scripts/runway.mjs --prompt "…" --image first.png --last last.png --seconds 5 --dry-run
```

One reference is the opening frame; two are the opening and closing keyframes (Seedance only). Clip audio is never generated (`audio: false`) because the film keeps one shared mix.

## Models and cost (docs.dev.runwayml.com, 2026-10-04)

| Model | Output | Credits / s | Keyframes | Seconds |
|---|---|---|---|---|
| `seedance2_5` (default) | 480p · 720p · 1080p | 20 · 30 · 68 (80 minimum per clip) | first + last | 4–15 |
| `seedance2` | 720p · 1080p | 36 · 40 | first + last | 4–15 |
| `seedance2_fast` | 720p | 29 | first + last | 4–15 |
| `gen4.5` | 720p | 12 | first only | 2–10 |

1 credit = $0.01. A 5 s Seedance 2.5 clip at 720p is 150 credits ($1.50). 720p upscaled under grain at 1080p delivery is usually indistinguishable in a fast cut; pay for 1080p only on a held hero shot.

## Contract

`POST /v1/image_to_video` (or `/v1/text_to_video` without images) with `Authorization: Bearer`, `X-Runway-Version: 2024-11-06`. Body fields are per model: `promptText`, `promptImage: [{uri, position: first|last}]`, `ratio` (`1280:720`, `720:1280`, `1920:1080`, …), integer `duration`, optional `seed`, `audio`. The response is a task id; poll `GET /v1/tasks/{id}` until `SUCCEEDED` (download `output[0]` promptly; URLs are temporary) or `FAILED`. Images up to 5 MB go inline as data URIs, larger ones through a two-step ephemeral upload. `buildRequest` validates model, resolution, duration and keyframes before any call.

## Moderation

Moderated outputs fail with `failureCode: SAFETY.*` and cost nothing, but **repeated moderation can suspend the account**. In practice, recognisable characters and faces seen close and front-on are blocked far more often than the same subject from behind, in profile or at distance. After one block, reframe (wider, from behind, less face-forward) or move that shot to Veo (`veo-video` skill) rather than retrying. Acceptance by a model is never a licence to use a character or likeness.

See [docs/hero-footage.md](../../docs/hero-footage.md) for the whole footage-led workflow.
