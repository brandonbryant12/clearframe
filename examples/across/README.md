# Across: a bridge that closes a gap

A 10-second study of connection. A team stands on one cliff and the data it needs on the other, with a chasm between them. On a spoken word the bridge goes up: towers rise, planks drop into place one by one, and the cables draw. On the next word, cards start crossing and keep crossing. It was curated by hand to demonstrate the `bridge` sketch; it is not agent output.

**What it feels like:** hopeful and constructive. The connection is built before your eyes, then used, so "integration" becomes something you can see happen.

**Ideas it helps show:**

- an integration between two systems;
- a partnership;
- access ("now they can reach it");
- closing a gap;
- a new channel.

| Narration | Picture |
|---|---|
| "Your team on one side, the data they need on the other." | Two cliffs, people on the left and a database on the right, with the chasm between. |
| "We **built** the bridge," | The towers rise, the planks drop in from left to right, and the cables draw. |
| "and now every request **crosses** on its own." | Cards cross the bridge one after another, in a continuous loop. |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "bridge",
  "sketchText": { "LEFT": "Your team", "RIGHT": "The data" },
  "sketchSay": { "BUILD": "built", "CROSS": "crosses" } } }
```

It works on light and dark palettes. A tall frame keeps the scene in its lower half and leaves the top for a headline.

## Make it

```sh
node examples/across/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/across && cp examples/across/storyboard-vertical.json build/across/storyboard.json
node engine/cli.mjs draft build/across   # free local draft voice
```

Each shape is 310 frames, about 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "connect our two systems"`.
