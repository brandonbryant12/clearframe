# Paper launch: scraps become one product

An 11-second study in cut paper. Scraps of coloured paper lie scattered on a cutting mat, fly into place one after another, and become one product card, which lifts off the mat as its name types in. It was curated by hand to demonstrate the `cut-paper` sketch; it is not agent output, and "Tally" is a made-up product.

**What it feels like:** handmade and warm, a maker's desk. Every layer keeps its own soft shadow, so the product reads as built from real pieces, not rendered whole.

**Ideas it helps show:**

- scattered notes, feedback or ideas becoming one product;
- a launch;
- "how it came together";
- a design process;
- a team's parts adding up.

| Narration | Picture |
|---|---|
| "It started as scraps: a customer note, a sketch, a few lines of copy." | Paper pieces lie turned on the mat beside a pencil and offcuts, and the camera pushes in slowly. |
| "Put **together**, they became one app." | The pieces lift and fly into place: the frame, the title bar, the picture and its sun, the lines of copy, the button. Each one lands a moment after the last. |
| "**Meet** Tally." | The finished card lifts off the mat, and its name and button type in. |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "cut-paper",
  "sketchText": { "PRODUCT": "Tally", "ACTION": "Get started" },
  "sketchSay": { "BUILD": "together", "REVEAL": "Meet" } } }
```

Its paper shadows read best on a light palette (`paper`, `sketchbook`, `sorbet`). On a dark one, such as `ink`, the layers separate by colour instead. It lays out a wide card on a wide frame, and a tall card with the picture above the copy on a vertical one.

## Make it

```sh
node examples/paper-launch/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/paper && cp examples/paper-launch/storyboard-vertical.json build/paper/storyboard.json
node engine/cli.mjs draft build/paper    # free local draft voice
```

Each shape is 342 frames, about 5 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "scattered ideas come together into a product"`.
