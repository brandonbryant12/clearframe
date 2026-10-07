# Concepts: calibration

These are drawn from real `find` shortlists. The entries named exist in the library; the reasons are the kind of sentence to give a person.

## One idea, four ways

Brief: *"Our checkout is 40% faster. Explain it to the sales team."*

`find "our checkout is 40% faster, explain it to the sales team"` → `block:stat`, `block:delta`, `treatment:business`, `cast-shape:person`, `cast-look:tiles`, `playbook:concept-explainer`.

1. **The number lands.** Show the before figure, then the after figure, counting down on "faster", with the source under it. Then cut to one customer who did not wait.
   - Why: sales repeat numbers, so give them one they can say.
   - Build with: `delta`, `tone: accent`, and `treatment:business`.
2. **One order's journey.** A phone sends an order that travels to the server and comes back, and a clock beside it shrinks.
   - Why: it shows why it is faster, so they can explain it rather than just quote it.
   - Build with: `cast-shape:phone`, `server` and `clock`; `cast-move:travel` and `swap`; the `tiles` look.
   - Example: `examples/order-journey`.
3. **Fewer steps.** The old route winds through four waits and the new one goes straight, with two tokens racing at the same speed. Then the sourced figure lands.
   - Why: it explains why it is faster without leaning on the number alone.
   - Build with: `sketch:shortcut` (`example:fewer-steps`), then a `delta`.
4. **The customer's side.** A person taps Buy and is done before the kettle boils. Kinetic words carry the line.
   - Why: it is the story a buyer hears, so it suits a pitch deck video.
   - Build with: `cast-shape:person`, `mechanism:kinetic` and `sketch:chat`.

For an internal team, I would lean toward the second or third. It gives them the mechanism to explain the change in their own words, and the figure can still land at its end. Another audience, or the person's taste, could reasonably favour the first.

## The same story, two looks

`examples/order-journey` tells one story in two looks:

- `drawn` on `ink` reads as a warm explainer;
- `pixel` on `lcd` reads as a playful teaser for a game or developer audience.

Choose by audience. A look picked only for variety reads as a gimmick.

## Different ideas, different choices

| Brief | What the shortlist offered | A good choice, and why |
|---|---|---|
| A calm thank-you to the nurses who work nights | `treatment:calm`, `sketch:desk`, `example:night-shift`, `palette:ink`, `cast-look:drawn` | One continuous drawn night (`night-shift` as the model), slow, with no figures. Gratitude needs a held picture, not a chart. |
| Explain how our API caches requests, to engineers | `playbook:pr-walkthrough`, `sketch:architecture`, `mechanism:stage`, `cast-shape:server`/`database`, `treatment:blueprint` | A stage with real actors and `send` events, plus a `code-scene` for the cache key. Engineers trust the mechanism they can see. |
| A playful teaser for a retro game launch | `cast-look:pixel`, `palette:lcd`, `sketch:pixel-skyline`, `treatment:trailer`, `cast-shape:flag` | Pixel art on `lcd` with stepped motion and a trailer rhythm. The look is the promise of the game. |
| Quarterly revenue results for the board | `playbook:quarterly-update`, `block:stat`/`delta`, `example:market-update`, `cast-shape:coin` | Figures first, each with a source, with drawing kept to what explains a figure. For this board, the number and its reason probably matter more than a metaphor. |
| Why the app was slow at night (a post-mortem) | `sketch:searchlight`, `example:lights-on`, `playbook:research-investigation`, `palette:noir` | A torch finding each cause in a dark room, then the lights coming on. A post-mortem is a search, and the reveal that it was one problem is the payoff. |
| One merge ships the whole release (for a developer audience) | `sketch:pixel-chain`, `example:chain-reaction`, `cast-look:pixel`, `palette:lcd` | A game level where one press sets off the rest. A chain of effects in space is easier to follow than a pipeline diagram, and the game look suits developers. |
| Launch an app built from customer feedback (warm, for customers) | `sketch:cut-paper`, `example:paper-launch`, `playbook:product-reveal`, `palette:paper` | Scraps of paper coming together as the product. It says "made from what you told us" without a word of copy, and the handmade look feels approachable. |
| Our community keeps growing (warm, for members) | `sketch:seedling`, `example:community-grows`, `playbook:personal-story`, `palette:paper` | A plant growing in labelled stages. It shows growth as something alive and earned, and it stays honest because it draws stages, not amounts. |
| Six tools became one flow (for the team that lived with them) | `sketch:untangle`, `example:one-line`, `sketch:versus`, `block:steps` | The same pieces leaving a tangle for a line. People who knew the old mess recognise the pieces, so the relief lands. `versus` would suit a quicker side-by-side. |
| Your data stays private (for customers) | `sketch:vault`, `example:your-data`, `cast-shape:lock`, `palette:midnight` | A vault door closing over their things. Trust is easier to feel as a place than to read as a policy. |
| We integrated with their system (for both teams) | `sketch:bridge`, `example:across`, `sketch:network`, `mechanism:stage` | A bridge built across a gap, then used. Both sides see themselves, and the moment of connection is visible. For engineers, a stage with real services may say more. |
| How a support ticket travels through the team | `example:cast-journey`, `cast-shape:ticket`, `cast-move:travel`, `playbook:process-cast`, `mechanism:world` | One ticket travelling through a drawn world of stations. Following one thing is easier than reading a flowchart. |

## Signs the concepts are too close

- They differ only in palette, type or transition.
- All of them open on a title card.
- Each is "the same diagram, animated differently".

Change the entry point (a person, a place, a number, a word), the metaphor, or the grammar (one world the camera travels versus cuts between scenes).
