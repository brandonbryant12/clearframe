# One line: from a tangle to a line

A 10-second study of simplification. Six cards (a message, a person, a document, settings, a database and a check) lie scattered and turned, joined by crossing curves with friction points pulsing on them. On a spoken word the curves let go and the cards glide into one row. Then one clean line draws through them, and work flows along it. It was curated by hand to demonstrate the `untangle` sketch; it is not agent output.

**What it feels like:** relief. The same pieces stay on screen and only their order changes, so the viewer sees that nothing was lost, only untangled.

**Ideas it helps show:**

- a messy process made simple;
- before and after a redesign;
- "everything in one place";
- fewer handoffs;
- an integration.

| Narration | Picture |
|---|---|
| "Every request used to bounce between six tools." | Scattered cards and a tangle of crossing curves, with friction points pulsing. The tag reads "Six tools". |
| "We **pulled** them into one line," | The curves let go, and the cards glide into a row (a column on a tall frame), each turning square. |
| "and now the work just **flows**." | One clean line draws through the cards, a packet runs along it again and again, and the tag reads "One line". |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "untangle",
  "sketchText": { "BEFORE": "Six tools", "AFTER": "One line" },
  "sketchSay": { "UNTANGLE": "pulled", "FLOW": "flows" } } }
```

It works on light and dark palettes. For different pieces, start from `node engine/cli.mjs sketch untangle` and change the icons.

## Make it

```sh
node examples/one-line/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/line && cp examples/one-line/storyboard-vertical.json build/line/storyboard.json
node engine/cli.mjs draft build/line    # free local draft voice
```

Each shape is 299 frames, about 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "make a messy process simple"`.
