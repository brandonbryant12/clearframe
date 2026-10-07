# Your data: a vault that closes on a word

A 10-second study of security and trust. Five cards of someone's data (a file, a person, a message, a chart and a record) float beside an open vault whose door stands edge-on. On a spoken word they fly into the dark inside. On the next, the door swings shut over them, the wheel turns, six bolts slide home, and a ring of light settles around the door with its label. It was curated by hand to demonstrate the `vault` sketch; it is not agent output.

**What it feels like:** solid and reassuring. The data visibly goes somewhere, and the closing door is a promise you can watch being kept.

**Ideas it helps show:**

- privacy ("your data stays yours");
- encryption;
- backups;
- compliance;
- a safe place for what matters.

| Narration | Picture |
|---|---|
| "Your files, your messages, your history." | Cards float beside an open vault; the door stands edge-on, and the inside is dark. |
| "We **keep** them in one place," | The cards fly into the vault and shrink into the dark. |
| "**locked**, that only you can open." | The door swings shut, the wheel turns, the bolts slide home, a ring of light settles, and the label reads "Only yours". |

The beat is one sketch with words:

```json
{ "block": "canvas", "props": {
  "sketch": "vault",
  "sketchText": { "SAFE": "Only yours" },
  "sketchSay": { "GUARD": "keep", "LOCK": "locked" } } }
```

It works on light and dark palettes; the vault's inside is always near-black, because it is a hole. On a wide frame the vault stands right of the cards, and on a tall frame below them.

## Make it

```sh
node examples/your-data/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/vault && cp examples/your-data/storyboard-vertical.json build/vault/storyboard.json
node engine/cli.mjs draft build/vault    # free local draft voice
```

Each shape is 287 frames, about 3 s to render on this Mac, and `check` reports 0 errors and 0 warnings.

Find it with `node engine/cli.mjs find "keep our customers' data private"`.
