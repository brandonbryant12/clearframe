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
