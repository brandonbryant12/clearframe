# Community grows: growth as a plant

An 11-second study of growth. A seed in the soil puts down roots and a shoot, the stem draws up through two more stages with leaves unfolding at each, and a flower opens at the top. Each stage is labelled at its height, so the plant reads as a timeline. It was curated by hand to demonstrate the `seedling` sketch; it is not agent output.

**What it feels like:** calm and hopeful. Growth is shown as something alive that takes its time, not a line on a chart.

**Ideas it helps show:**

- a community or customer base growing;
- compounding;
- a habit taking root;
- a product maturing;
- "a small start that grows on its own".

It shows the stages of growth, not an amount. For a figure, add a sourced `stat` beat after it.

| Narration | Picture |
|---|---|
| "It started with one small **team**." | Soil and a low sun. The seed appears in the ground. |
| "Word spread, and the **roots** went deep." | The roots draw down, the first shoot rises, a pair of leaves unfolds, and "Word spreads" is labelled at its height. |
| "Others joined, and it kept **growing**." | The stem draws higher, more leaves unfold, and "Others join" is labelled. |
| "Now it **blooms** on its own." | The flower opens at the top, "A community" is labelled, and the grown plant sways. |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "seedling",
  "sketchText": { "ONE": "Word spreads", "TWO": "Others join", "THREE": "A community" },
  "sketchSay": { "SEED": "team", "SPROUT": "roots", "GROW": "growing", "BLOOM": "blooms" } } }
```

It works on light and dark palettes. On a tall frame the plant moves left so the labels keep their room.

## Make it

```sh
node examples/community-grows/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/grow && cp examples/community-grows/storyboard-vertical.json build/grow/storyboard.json
node engine/cli.mjs draft build/grow        # free local draft voice
```

Each shape is 344 frames, about 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "our community keeps growing"`.
