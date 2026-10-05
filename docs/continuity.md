# Native graphics and occasional Omni inserts

Use `gemini-omni-1.1-flash` for a brief establishing shot, atmosphere or an otherwise difficult visual. Keep the story's facts, labels, numbers, charts and speech-following typography in native FFFrames blocks. The default review threshold is 20% generated footage, configurable with `continuity.maxGeneratedShare`.

```json
{
  "theme": { "base": "editorial", "accent": "#b13e2e" },
  "continuity": {
    "maxGeneratedShare": 0.2,
    "treatment": "Restrained editorial film, warm paper and rust accents",
    "lighting": "Soft daylight from the left",
    "camera": "Locked camera, eye level",
    "motion": "Slow left-to-right movement",
    "motif": "One red thread connecting each scene"
  },
  "assets": [{
    "id": "room", "kind": "clip", "model": "gemini-omni-1.1-flash",
    "prompt": "An empty workshop, a red thread crossing a pale wooden desk",
    "seconds": 4, "resolution": "720p",
    "refs": ["assets/opening.png", "assets/closing.png"]
  }],
  "beats": [{
    "id": "room", "block": "video", "duration": 4,
    "props": {"asset":"room","offset":0,"label":"Generated illustration","caption":"A sense of place"}
  }]
}
```

Merge the example into a complete storyboard. References are optional local PNG/JPEG/WebP files; use one for composition/style, two for opening/closing compositions. Make them by rendering a native `still` or selecting approved visual references. `previousInteractionId` can continue a prior generated interaction; the result ID is recorded in asset metadata. Reference bytes, palette and continuity instructions participate in the cache hash.

Run `plan DIR`, then explicitly `clips DIR --only room --budget 1`. The adapter requests MP4 URI delivery, polls processing and downloads without forwarding API credentials to redirect hosts. Native rendering checks the clip covers its authored duration plus source offset; choose a shorter beat if the generated take is short. No invisible freeze or loop fills missing footage.

Duration is requested in the prompt and can vary. The built-in estimate currently supports 720p, based on Google's documented output rate, excluding variable input/text charges; it is not a hard spending cap. View the actual asset before using it. A new request is not automatically retried after an uncertain paid failure.

Continuity requires judgment: compare the last native frame, first clip frame, last clip frame and next native frame. Match color, subject position, scale, lighting and movement. The native media frame, typography and palette connect the treatment; the shared narration/music continues across the cut. Clip audio is excluded from the mix. Review for unwanted text, visual artifacts, identity drift and misleading realism. Prompts and references guide consistency; they cannot guarantee it.

Footage-led films (sizzle, trailer, brand spot) invert this balance; see [footage-led films](hero-footage.md) and the [Runway skill](../skills/runway-video/SKILL.md) for keyframe-first generation, provider routing and cutting to music.

Official contracts: [Omni](https://ai.google.dev/gemini-api/docs/omni), [pricing](https://ai.google.dev/gemini-api/docs/pricing), [Files API](https://ai.google.dev/gemini-api/docs/files). Verified 2026-09-28. Veo remains available only when an asset explicitly selects a supported Veo model.

## B-roll composition and coverage

Choose the placement before generating: `plate.side: "full"` for background footage under native text; `"left"` or `"right"` for a half-screen composition. Use split placement for detailed text, charts or busy footage. For a full background, start with `scrim: 0.8`, `drift: "none"` and a suitable palette treatment. A scrim value is a starting point, not a readability guarantee. Blur alone does not ensure contrast.

Plan Gemini Omni Flash footage for the actual beat duration plus its source `offset` and edit handles. A generated take's measured duration wins over the requested duration. `check` rejects short footage and `plate.loop: true`; use a longer take, trim the scene without clipping narration, or author a sequence of different shots. Never loop, silently freeze the tail, or slow footage merely to fill a timing gap.

Before approving the rough cut, inspect decoded frames at the beginning, middle, end and every major lighting/movement change. Read the headline, labels, numbers, sources and captions at full size and on a 360 px phone view. Watch the full beat to catch moving contrast failures. Increase the scrim, use an opaque native panel, switch to a split, or choose another shot when text cannot be read immediately. Record the frames and decision in DIRECTION.md. Existing geometry audits cannot certify contrast over changing footage.

For business work, request a locked camera, restrained subject motion and no handheld sway in the generation prompt. Also set `lens.handheld: 0`, beat `camera: "none"`, and plate `drift: "none"` in the native composition. These control different layers; a stable native camera cannot remove shake baked into footage. Keep generated audio excluded. Run `plan` before paid calls and use the existing authorized budget; no paid generation is needed to test these authoring rules.
