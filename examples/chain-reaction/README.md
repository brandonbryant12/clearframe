# Chain reaction: one action sets off the rest

A 10-second study of cause and effect in a handheld game level. A player steps onto a plate, a signal runs along a buried wire and up a gate post, the gate drops, crates roll through it and down the level, and a machine's screen lights with the result. It was curated by hand to demonstrate the `pixel-chain` sketch; it is not agent output.

**What it feels like:** playful and mechanical, a small machine you want to watch again. Each link starts where the last one ended, so the eye follows the cause through space, not a list of steps.

**Ideas it helps show:**

- automation;
- a trigger and its effects;
- a deploy or release pipeline;
- "press one button and everything else follows";
- a habit that compounds.

| Narration | Picture |
|---|---|
| "One **merge**." | The player steps onto the plate, and the plate sinks. |
| "A **signal** runs the checks." | The buried wire lights cell by cell, then the gate post. |
| "The **gate** opens," | The gate drops into the ground. |
| "every build **rolls** down the line," | The crates roll through the gate and step down the stairs (in the vertical cut, they fall down the shaft) to the machine. |
| "and the release goes **live**." | The machine's screen lights with LIVE, a lamp blinks and smoke puffs. |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "pixel-chain",
  "sketchText": { "TITLE": "Release day", "RESULT": "Live" },
  "sketchSay": { "PRESS": "merge", "SIGNAL": "signal", "OPEN": "gate", "ROLL": "rolls", "RESULT": "live" } } }
```

Cue all five moments or none, since uncued moments keep their default seconds. The level is laid out per shape:

- **Wide:** a platform with stairs down to the right.
- **Vertical:** a ledge with a drop down the shaft, and the machine beneath the ledge.

Pair it with the `lcd` palette (and the `handheld` treatment for a whole film).

## Make it

```sh
node examples/chain-reaction/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/chain && cp examples/chain-reaction/storyboard-vertical.json build/chain/storyboard.json
node engine/cli.mjs draft build/chain      # free local draft voice
```

Each shape is 312 frames, about 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "one action sets off the rest"`.
