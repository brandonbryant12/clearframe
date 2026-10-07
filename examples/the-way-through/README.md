# The way through: one lit path in a maze

A 10-second study of guidance. A maze is drawn with a person at the entrance and a check at the exit. On a spoken word, the one path through draws on in the accent and a token follows it. On the next word, the exit lights. It was curated by hand to demonstrate the `maze` sketch; it is not agent output.

**What it feels like:** calm and clarifying. The maze stays complicated; what changes is that someone has found the way for you.

**Ideas it helps show:**

- onboarding;
- "we find the way for you";
- navigating rules, forms or a process;
- a clear route through a confusing system.

| Narration | Picture |
|---|---|
| "Opening an account used to feel like this." | The maze draws, with "Sign up" at the entrance and "Ready" at the exit. |
| "Now we **guide** you through, one clear step at a time," | The path through draws on in the accent, and a token follows it. |
| "and you are **done**." | The token reaches the exit, and the check lights. |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "maze",
  "sketchText": { "START": "Sign up", "FINISH": "Ready" },
  "sketchSay": { "GUIDE": "guide", "ARRIVE": "done" } } }
```

The maze is generated from `seed` by a depth-first search on a grid, so the same seed always draws the same maze, and another seed draws another. The wide frame uses a 15 × 7 grid and the tall frame 8 × 12. Cue `ARRIVE` after the path has drawn, which takes up to 3 s. The sketch works on light and dark palettes.

## Make it

```sh
node examples/the-way-through/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/maze && cp examples/the-way-through/storyboard-vertical.json build/maze/storyboard.json
node engine/cli.mjs draft build/maze        # free local draft voice
```

Each shape is 299 frames, under 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "guide new customers through a confusing process"`.
