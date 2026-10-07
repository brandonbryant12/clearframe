# Concepts: calibration

These are drawn from real `find` shortlists. The entries named exist in the library; the reasons are the kind of sentence to give a person.

## One idea, three ways

Brief: *"Our checkout is 40% faster. Explain it to the sales team."*

`find "our checkout is 40% faster, explain it to the sales team"` → `block:stat`, `block:delta`, `treatment:business`, `cast-shape:person`, `cast-look:tiles`, `playbook:concept-explainer`.

1. **The number lands.** Show the before figure, then the after figure, counting down on "faster", with the source under it. Then cut to one customer who did not wait.
   - Why: sales repeat numbers, so give them one they can say.
   - Build with: `delta`, `tone: accent`, and `treatment:business`.
2. **One order's journey.** A phone sends an order that travels to the server and comes back, and a clock beside it shrinks.
   - Why: it shows why it is faster, so they can explain it rather than just quote it.
   - Build with: `cast-shape:phone`, `server` and `clock`; `cast-move:travel` and `swap`; the `tiles` look.
   - Example: `examples/order-journey`.
3. **The customer's side.** A person taps Buy and is done before the kettle boils. Kinetic words carry the line.
   - Why: it is the story a buyer hears, so it suits a pitch deck video.
   - Build with: `cast-shape:person`, `mechanism:kinetic` and `sketch:chat`.

Recommend the second for an internal team. It is the only one that leaves them able to explain the change, and the figure can still land at its end.

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
| Quarterly revenue results for the board | `playbook:quarterly-update`, `block:stat`/`delta`, `example:market-update`, `cast-shape:coin` | Figures first, each with a source, and one drawn driver at most. A board wants the number and its reason, not a metaphor. |
| Why the app was slow at night (a post-mortem) | `sketch:searchlight`, `example:lights-on`, `playbook:research-investigation`, `palette:noir` | A torch finding each cause in a dark room, then the lights coming on. A post-mortem is a search, and the reveal that it was one problem is the payoff. |
| One merge ships the whole release (for a developer audience) | `sketch:pixel-chain`, `example:chain-reaction`, `cast-look:pixel`, `palette:lcd` | A game level where one press sets off the rest. A chain of effects in space is easier to follow than a pipeline diagram, and the game look suits developers. |
| How a support ticket travels through the team | `example:cast-journey`, `cast-shape:ticket`, `cast-move:travel`, `playbook:process-cast`, `mechanism:world` | One ticket travelling through a drawn world of stations. Following one thing is easier than reading a flowchart. |

## Signs the concepts are too close

- They differ only in palette, type or transition.
- All of them open on a title card.
- Each is "the same diagram, animated differently".

Change the entry point (a person, a place, a number, a word), the metaphor, or the grammar (one world the camera travels versus cuts between scenes).
