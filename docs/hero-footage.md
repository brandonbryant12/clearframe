# Footage-led films

Explainers stay native, with generated footage as a sparse insert (`continuity.maxGeneratedShare`, default 20%). Sizzle reels, trailers and brand spots invert that: the picture is generated motion, and native work supplies the type, end card, grade and sound. Raise `maxGeneratedShare` deliberately for these films and keep every word and number native.

## 1. Keyframes before motion

Video generation is the expensive step and the least controllable. Decide the picture with stills first.

- Generate one still per shot with `gemini-image` (`gemini-3-pro-image` for hero frames, about $0.13 at 2K). Write the prompt as a film still: subject, camera position, lens, light, palette, and "no text, no numbers, no logos".
- Pass an approved still as a **reference image** for the next one. It keeps a character or product consistent across framings without re-describing it.
- Review the stills as a set before any video call. A shot that is weak as a still will not improve in motion.

## 2. Motion from the approved frames

- **One reference** is the opening frame. **Two references** (Seedance) are the opening and closing keyframes: the model interpolates the move between them.
- **Continue a shot** by extracting the previous clip's last frame (`ffmpeg -sseof -0.05 -i a.mp4 -frames:v 1 last.png`) and using it as the next clip's first frame, with a prompt that describes the camera move away from it ("the camera pulls back from the rider's view to reveal…"). This makes the strongest invisible joins.
- **Describe the camera explicitly**: "the camera rushes backward and upward in one sweeping move". Subjects told only to "hover" or "bank" barely move.
- Actions prompted for "the end" usually land mid-clip. Find the onset frame by frame before cutting it to a beat.
- Add "consistent lighting, no lens flares, the subject keeps its colour throughout" to long takes; late-clip drift is common.

## 3. Provider routing

| Need | Use |
|---|---|
| Strong motion, keyframe control, sweeping camera | Runway `seedance2_5` ([skill](../skills/runway-video/SKILL.md)) |
| A subject Seedance moderates, native 1080p, 8 s takes | Veo 3.1 ([skill](../skills/veo-video/SKILL.md)) |
| Cheap motion drafts | Runway `gen4.5` (720p, first frame) or Veo 3.1 Lite/Fast |
| Calm establishing inserts in an explainer | Gemini Omni (default) |

Draft on cheap models, then render each chosen shot once on the expensive one. In one 20-second vertical reel, Veo 3.1 Standard was about 80% of the spend and only 2 of its 6 clips made the cut; drafting first would have saved most of it.

## 4. Cut to the music

- Generate the score first or early (`lyria-music`), then measure it with `beatmap`. Lyria returns full songs, often 60–70 s, with the requested structure later than asked; splice bar-aligned pieces (the opening bars, then the bars before the drop) instead of re-rolling.
- Put the hero action on the drop: a burst of fire, a reveal or a slam lands on the measured downbeat, and the one-beat silence before it is the place for a held breath or a close-up.
- Cut picture on bar lines. Let continuous takes run across a section change rather than forcing a cut.
- Never freeze a frame under the end card. Slow the last second of the shot instead, so fire, water or particles keep moving.

## 5. Native type, end card and finishing

- Titles and the end card are native: a soft shadow under the type for legibility over moving plates, the title-safe area for every format, a real logo file.
- A title can be revealed by the action it follows (forged in the wake of a flame, wiped by a pass-by), timed to beats one or two after the drop.
- Finish with a light grade, vignette and grain over the whole film so plates from different models sit together, then loudness-normalise (`qa` reports −14 LUFS for social).

## 6. Review

- Contact-sheet every clip before using it, and frame-check every transition you rely on.
- AI listening and viewing reviews are useful for macro critique (a late hook, a small call to action, an abrupt audio tail) but unreliable on timestamps and provenance. Verify every claim against frames or a waveform before acting on it.
- Generating a recognisable character, brand or likeness does not grant the right to publish it. Decide rights before the film is shared.
