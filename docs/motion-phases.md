# Motion phases and retiming

Prepared motion can expose named frame intervals so an editor can place native evidence after the object settles. This is a timing contract for qualitative artwork. It is not a financial timeline, a measured event clock, or a physics simulation.

All fourteen built-in sculpture recipes now declare `motion.version: 1` and `clock: "qualitative-pose"`. The gate, bridge and quiz declare initial hold, action and final hold phases. The reservoir and conveyor add staged transfer/closure and queue/bypass phases. The three camera studies add held start, pullback or focus action, and held ending phases. Camera optics now participate in hold checks. The six continuously moving loops declare one `cycle`; a nominal open-looking pose does not imply that the camera, light or every object has stopped.

## Authoring

Each phase has a unique `id`, a `role` (`anticipation`, `action`, `settle`, `hold` or `cycle`), normalized `start` and `end`, and `minSeconds`. Intervals must cover `[0,1]` without gaps or overlaps. Do not invent separate anticipation or settlement phases if the recipe does not contain them. A static question or closed pose is a hold. A `cycle` is a single full interval in a looping recipe.

Default rendering keeps the original pose input exactly: encoded frame `i` evaluates `i / frames`. The renderer also bakes an unencoded endpoint at `i = frames` for transform closure checks. Adding a contract does not change the original animation. The bridge's wider portrait camera is a separate framing correction.

To give specific phases a different duration, supply every phase in seconds:

```json
{ "closed": 1, "opening": 1, "hold": 2 }
```

```sh
node engine/cli.mjs sculpture reserve-gate --draft --fps 12 \
  --phase-seconds examples/motion-phases/timings/reserve-gate.json \
  --out /tmp/retimed-gate
```

`--phase-seconds` and `--duration` are mutually exclusive. Each phase must be positive, the total must be 1–12 seconds, and the existing 12–60 integer FPS limit applies. Cumulative requested boundaries round to the nearest output frame. Empty phases and phase durations below their declared minimum are rejected. A phase-retimed action traverses the same canonical pose range over its new frame interval; a hold remains static. This changes authored motion speed. It does not recompute physical forces or measured events.

The current reveal contracts require at least 0.25 seconds of action and 0.5 seconds of final hold. These are minimum mechanical safeguards, **not** enough time to read arbitrary evidence. Lengthen the final hold to the native text and narration's needs. Existing full-cycle recipes require at least one second and expose no safe internal trim.

## Retained manifest

New `render-config.json`, `receipt.json` and `asset.json` carry `motion`. The portable sculpture packager preserves it. Old assets without a manifest remain valid; their files and evidence are not retroactively changed.

- `phases`: resolved zero-based, half-open `[startFrame,endFrame)` intervals, seconds and actual duration.
- `poseSamples`: the canonical pose parameter for every encoded frame, plus the unencoded endpoint.
- `safeTrimWindows`: declared static holds; source boundary cuts still need composition review.
- `loopIntent`: the recipe's intended behavior, separate from observed seam quality.
- `timing`: original normalized pose timing or explicit phase retiming.

Blender frame 1 corresponds to encoded frame 0. For default timing, interval boundaries use the first encoded frame whose normalized pose lies inside the phase. For phase retiming, the rounded frame boundary maps to the authored normalized boundary exactly. Use the resolved seconds, not the unrounded request, for native cue placement.

The renderer checks every object world transform at every encoded frame inside a declared hold, with maximum error `0.0001`. That includes camera and light transforms but excludes material animation, deformation, optical settings and rendered shading. Recipes with those effects need additional checks before declaring a hold. Existing loop transform checks still apply. Neither test establishes visual acceptance.

## Plan a playback change to an existing clip

`planClipRetiming` produces a bounded **plan**, not a new clip or a storyboard edit:

```js
import { planClipRetiming } from './engine/lib/motion-phases.mjs';
const plan = planClipRetiming(asset.motion, {
  startFrame: 6, endFrame: 42, rate: 0.5,
  outputFps: 24, readHoldSeconds: 3,
});
```

The example applies to the 48-frame gate above. It keeps source frames 6–41, doubles their playback duration to six seconds and produces 144 output frame selections. Each source frame repeats four times. The output retains a three-second final hold. `sourceFrames` and `sourceSeconds` describe the selected encoded source frame and its actual timestamp; they do not interpolate poses or pretend to be a new simulation.

Rates are positive 0.25–4; output FPS is an integer 12–60; output is bounded to 2,880 frames. Output frame count rounds to the nearest integer, so the manifest reports both requested and effective playback rate. Selection uses `start + floor(outputIndex × sourceCount / outputCount)`. Faster plans can drop frames; the final encoded source frame is not guaranteed to be selected. Review the resulting cadence and seam if applying a plan externally.

Trims must land inside declared holds and preserve every non-hold phase. Playback may not drop an entire action or shorten a phase below its minimum. `readHoldSeconds` optionally requires a minimum final reading hold. A one-way reveal never becomes a loop. A full loop retains only its loop intent, and needs seam review after frame selection. Reverse playback and partial-cycle edits are intentionally outside this helper.

The [retained examples](../examples/motion-phases/README.md) separate pure planning checks, actual Blender output, saved-scene reproduction and sampled encoded review. Native films do not automatically consume these sidecars; apply their resolved cue times when composing native evidence.
