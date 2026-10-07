# Lights on: a search in the dark

A 14-second study of discovery: one torch searches a dark storeroom, finds three things in turn, and then the lights come on to show they were one story. It was curated by hand to demonstrate the `searchlight` sketch; it is not agent output, and the three findings are illustrative.

**What it feels like:** a quiet detective story. The dark makes the viewer lean in, each find is a small reward, and the lights coming up is the moment it makes sense.

**Ideas it helps show:**

- what nobody had looked at;
- finding the cause of a problem;
- an audit or a post-mortem;
- "three things were hiding";
- several symptoms that turn out to be one cause.

| Narration | Picture |
|---|---|
| "Nobody **looks** in here." | A dark room of shelves; the hand-held torch sweeps across it. |
| "First, old **logs** filling the disk." | The light crosses to a crate, and its label fades in as the light arrives. |
| "Then a retry **queue** that never empties." | The light finds a stack of files. The first label stays. |
| "And a nightly **job** that runs every minute." | The light finds a machine with a blinking light. |
| "**Lights** on: it was one problem all along." | The torch fades, the lamps come on, the room shows, and a thread joins the three finds. |

The whole beat is one sketch with words, as in [build.mjs](build.mjs):

```json
{ "block": "canvas", "props": {
  "sketch": "searchlight",
  "sketchText": { "FIRST": "Old logs", "SECOND": "Retry queue", "THIRD": "Nightly job" },
  "sketchSay": { "SEARCH": "looks", "FIRST": "logs", "SECOND": "queue", "THIRD": "job", "ALL": "Lights" } } }
```

- **`sketchText`** names the finds.
- **`sketchSay`** lands each of the sketch's named moments on a spoken word: the light reaches a find, and the room lights up.

Without `sketchSay` the light keeps its default seconds. The sketch works on any palette. The dark is near-black, and the torch reveals the palette's own colours, so on `paper` it reads as a dark room in a light film. It lays itself out for both shapes: three shelving units side by side on a wide frame, and two tall ones on a vertical frame.

## Make it

```sh
node examples/lights-on/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/lights && cp examples/lights-on/storyboard-vertical.json build/lights/storyboard.json
node engine/cli.mjs draft build/lights   # free local draft voice
```

Each shape is 416 frames, about 4 s to render on this Mac, and `check` reports 0 errors.

Find it with `node engine/cli.mjs find "finding what nobody noticed"`.
