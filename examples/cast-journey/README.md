# One ticket, one journey

A 14-second study of a cast travelling through a drawn world. The cast is composed shapes: a ticket stub and two people. Three stations are drawn as scenery: the support desk, engineering and the customer. One ticket travels between them along routes that sketch themselves ahead of it, becomes a fix at engineering, and travels on to the customer who asked. It is the reference for the cast's `travel` move, and for scenery under a cast.

| Beat | Narration | The move |
|---|---|---|
| `desk` | "A ticket lands on the support desk." | The engineer and the customer already stand at their stations; the ticket drops onto the desk on "ticket". |
| `route` | "It travels to engineering, where someone can fix it." | On "travels" a pen route sketches up toward engineering and the ticket follows it, arriving beside the engineer, who is circled on "someone". |
| `fix` | "There, it becomes a fix." | The engineer works at the ticket, and it turns into code on "fix". |
| `home` | "And the fix travels on, to the customer who asked." | The engineer walks back to the station. A new route sketches to the customer and the fix follows it; the customer lifts on "asked". |

## What carries the story

- **The world stays put.** The stations are canvas elements in every beat, drawn beneath the cast and present from frame one, so the cuts are invisible.
- **The ticket is the subject.** It carries across every cut, and its route is the story: desk → engineering → customer.
- **The routes are the visible cause.** Each trail is drawn as the move happens and fades when the cast next moves.

## Make it

```sh
node examples/cast-journey/build.mjs        # station positions per shape: landscape left-to-right, vertical up a zig-zag
mkdir -p build/cast-journey && cp examples/cast-journey/storyboard-vertical.json build/cast-journey/storyboard.json
node engine/cli.mjs draft build/cast-journey
node engine/cli.mjs qa build/cast-journey
```

## Measured

Measured on the 8 GB iMac:

- **Render time.** 417 frames in 5.0 s.
- **Checks.** `check`: 0 errors and 0 warnings in both shapes.
- **`qa`.** 0 pops in both shapes.
- **Pace.** It is a calm film, at about 1.3 changes/s. Two advisories mark the holds after the swap and at the end.

The routes are the motion. Read the trails in motion, not on the contact sheet.
