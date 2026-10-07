# Triage, drawn

A 24-second short in the cast's `drawn` look: how a support team triages bug reports, told to new hires with one set of reports that stays on screen throughout. Pen marks do the explaining. It is hand-authored as the reference for `look: "drawn"`, `mark` and `on`. Compare `examples/cast-study`, which shows the same mechanism in flat tiles.

| Beat | Narration | The move |
|---|---|---|
| `inbox` | "Bug reports come in from everywhere: email, chat, and app reviews." | Two reports are already on the page and four more drop in. Each channel lifts as it is named. |
| `copies` | "Some describe the same bug, so the copies are set aside." | On "same", two reports gather around the crash they duplicate (`ring` `on: crash`). On "copies" they are crossed out in red, and on "aside" they leave, still crossed. |
| `rank` | "The rest line up, and the one that hits the most customers goes first." | The four form a line in arrival order. On "most" the crash moves to the front, the thread draws, and it is underlined on "first". |
| `fix` | "The on-call engineer takes it, and it becomes a fix." | The crash steps forward and the rest recede. The engineer drops in, walks onto it and works at it, and it turns into code on "fix". |
| `reply` | "When it ships, everyone who reported it hears back." | The engineer leaves and the fix settles. The reports gather round, and the two copies come back. On "hears", arrows are drawn from the fix to the two copies. |

## What carries the story

- **What persists.** The six reports, which keep their identities. The two copies are set aside, not deleted, and they return at the end.
- **What changes.** The arrangement (pile → line → reordered line → hero → ring), one report's identity (crash → fix), and the pen marks that comment on it.
- **Why each next shot happens.** Duplicates are recognised and set aside, so what remains can be ranked. The top one goes to the engineer and becomes a fix. The fix answers everyone who reported the bug, the copies included.
- **What the audience learns.** The triage loop, and why merging is safe: nobody who reported the bug is lost.

## Make it

```sh
node examples/cast-drawn/build.mjs                 # writes storyboard-landscape.json and storyboard-vertical.json
mkdir -p build/cast-drawn && cp examples/cast-drawn/storyboard-vertical.json build/cast-drawn/storyboard.json
node engine/cli.mjs draft build/cast-drawn         # free local draft voice; renders go to build/
node engine/cli.mjs qa build/cast-drawn            # build/cast-drawn/build/qa/phone.png
```

## Measured

Measured on the 8 GB iMac:

- **Render time.** 727 frames in 7.3–9.0 s, or 16.7 s while sharing the machine with another render.
- **Checks.** `check`: 0 errors and 0 warnings in both shapes.
- **`qa`.** 0 pops in both shapes; 3.5 changes/s in landscape and 3.3 in vertical.
- **Holds.** Two advisories remain: the inbox listing, where the named channels lift but the tiles are small, and the ranking, a reorder of small tiles. Both were reviewed in motion and kept.
- **Critique.** The cinema score is 67, the same as the tile study. Its notes are a locked camera and one scene family.

The review turned up defects that are now fixed in the engine:
- A beside-formation ran off the edge of a vertical frame.
- A clamped cluster stacked its pieces on top of each other.
- Crosses stayed behind when their objects left. Marks on an object now belong to it.
