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
   - Example: `examples/cast-journey` (the same move, with a ticket).
3. **Fewer steps.** The old route winds through four waits and the new one goes straight, with two tokens racing at the same speed. Then the sourced figure lands.
   - Why: it explains why it is faster without leaning on the number alone.
   - Build with: `sketch:shortcut` (`example:fewer-steps`), then a `delta`.
4. **The customer's side.** A person taps Buy and is done before the kettle boils. Kinetic words carry the line.
   - Why: it is the story a buyer hears, so it suits a pitch deck video.
   - Build with: `cast-shape:person`, `mechanism:kinetic` and `sketch:chat`.

For an internal team, I would lean toward the second or third. It gives them the mechanism to explain the change in their own words, and the figure can still land at its end. Another audience, or the person's taste, could reasonably favour the first.

## The same story, two looks

A cast takes one look for the whole film, and the look says who the film is for:

- `tiles` on `meridian` or `paper` reads as a clear product or business film;
- `drawn` on `sketchbook` reads as a warm explainer for new hires or customers.

Choose by audience. A look picked only for variety reads as a gimmick.

## Different ideas, different choices

| Brief | What the shortlist offered | A good choice, and why |
|---|---|---|
| Remind staff that FSA money expires at year end | `example:fsa-deadline`, `sketch:expire`, `sketch:deadline`, `treatment:workplace`, `palette:meadow` | The jar that keeps only the carry-over, then the plan's own words scrolled to the rule and marked, then the claim pressed in the app. People act on a rule they have seen in the document, and on a step they have seen done. |
| Explain how our API caches requests, to engineers | `playbook:pr-walkthrough`, `sketch:architecture`, `mechanism:stage`, `cast-shape:server`/`database`, `treatment:blueprint` | A stage with real actors and `send` events, plus a `code-scene` for the cache key. Engineers trust the mechanism they can see. |
| Quarterly revenue results for the board | `playbook:data-story`, `block:stat`/`delta`, `example:finance-charts`, `cast-shape:coin` | Figures first, each with a source, with drawing kept to what explains a figure. For this board, the number and its reason probably matter more than a metaphor. |
| Why the app was slow at night (a post-mortem) | `sketch:searchlight`, `mechanism:document`, `treatment:business`, `palette:noir` | A torch finding each cause in a dark room, then the lights coming on. A post-mortem is a search, and the reveal that it was one problem is the payoff. |
| What one pull request changes (for its reviewers) | `playbook:pr-walkthrough`, `example:pr-film`, `sketch:component-change`, `treatment:business` | The component swapped in place on the diagram, the real diff beside it, then the check that proves it. Reviewers trust a change they can watch happen to the system they know. |
| Launch an app built from customer feedback (warm, for customers) | `sketch:cut-paper`, `playbook:product-reveal`, `palette:paper` | Scraps of paper coming together as the product. It says "made from what you told us" without a word of copy, and the handmade look feels approachable. |
| Six tools became one flow (for the team that lived with them) | `sketch:untangle`, `example:one-line`, `sketch:versus`, `block:steps` | The same pieces leaving a tangle for a line. People who knew the old mess recognise the pieces, so the relief lands. `versus` would suit a quicker side-by-side. |
| Your data stays private (for customers) | `sketch:vault`, `cast-shape:lock`, `palette:midnight` | A vault door closing over their things. Trust is easier to feel as a place than to read as a policy. |
| We integrated with their system (for both teams) | `sketch:bridge`, `mechanism:stage` | A bridge built across a gap, then used. Both sides see themselves, and the moment of connection is visible. For engineers, a stage with real services may say more. |
| We make account setup easy (for new customers) | `sketch:maze`, `sketch:portal`, `sketch:untangle`, `treatment:workplace` | One lit path through a maze, then the step itself done in the app. It admits the process is complicated and shows that someone has found the way. |
| How a support ticket travels through the team | `example:cast-journey`, `cast-shape:ticket`, `cast-move:travel`, `playbook:process-cast`, `mechanism:world` | One ticket travelling through a drawn world of stations. Following one thing is easier than reading a flowchart. |

## From discovery to adaptation: a benefits film

Brief: *"Most of our people lose some of their FSA money every December. Tell them the rule and how to claim before the deadline."* It is built in `examples/fsa-deadline`.

- **`find` on the brief** surfaces `sketch:expire` (use it or lose it), `sketch:deadline` (a window on a calendar) and `example:fsa-deadline`, whose README names the other two pieces: the canvas `document` and `pointer` (`docs/canvas.md`).
- **`--id`** shows `expire` takes its counts as `sketchParams` and its moments as `sketchSay`, so it is filled, not copied. The `document` holds the plan's own sections; its `scroll` and `marks` land on the words the voice reads.
- **The step is drawn in the app,** with an id on every control, so the `pointer` presses them by name and follows them if the layout changes.

Why these suit this brief: the money, the rule and the step are three different pictures of one fact, and each lands on the word that names it. They are existing pieces, filled with the plan's own words.

## Signs the concepts are too close

- They differ only in palette, type or transition.
- All of them open on a title card.
- Each is "the same diagram, animated differently".

Change the entry point (a person, a place, a number, a word), the metaphor, or the grammar (one world the camera travels versus cuts between scenes).
