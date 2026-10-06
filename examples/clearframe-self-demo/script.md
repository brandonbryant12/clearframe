# ClearFrame, made with ClearFrame — script and scene plan

A product demo (about 60–75 seconds, landscape 16:9) that teaches a new person how to direct a
film in the ClearFrame studio while staying in control. Every picture of the interface is a real
capture of this build (see `captures.json`: the files are in `assets/uploads/`; each capture lists
its controls with measured positions `x`, `y` from 0 to 1 and boxes `box`). Use those positions for
`annotate` pins and `focus` regions exactly; do not invent positions. Captures are pictures of the
real UI: never redraw the interface. No numbers or prices appear on screen.

Narration is spoken by the free local draft voice in the rough cut. Keep each line short.

| # | Scene | Picture | Narration |
|---|---|---|---|
| 1 | Title | `title`: kicker "ClearFrame studio", text "This film was made by talking to it." | This film was made in ClearFrame, by talking to it. |
| 2 | Describe | `annotate` on `home.png`, pins from capture `home`: Describe the film, Choose how to collaborate, Create and start building; focus on `home` focus | Start with what you want: an idea, a script or a report, plus the format and the look. |
| 3 | Two ways | `image` of `home-modes.png` (close-up) | Then choose how to work. Make it for me takes the brief to a rough cut you can watch. Build it together proposes, and asks before each step. |
| 4 | Conversation | `annotate` on `conversation.png`, pins from capture `conversation` | OpenCode runs on your computer and connects to a free hosted model. The conversation is saved with the film, and the panel shows what really happened. |
| 5 | Scope | `annotate` on `scope.png`, pins from capture `scope` | Point at exactly what to change: a scene, a layer, a moment, or a review note. Edits outside that scope are refused. |
| 6 | By hand | `image` of `layer-inspector.png` (close-up) | Every field is still yours to edit by hand, and every change, yours or the agent's, is one step of undo. |
| 7 | Review | `annotate` on `review.png`, pins from capture `review` | Render a rough cut, leave notes on the picture, and hand a note to the agent. |
| 8 | Sound | `annotate` on `sound.png`, pins from capture `sound` | Draft narration and music are free. Google voices and music cost money, |
| 9 | Approval | `image` of `sound-approval.png` (close-up) | so nothing is generated until you approve exactly what will be made, within the film's budget. |
| 10 | Export | `annotate` on `deliver.png`, pins from capture `deliver` | When it's ready, render the final, and download it. |
| 11 | End | `endcard`: title "Describe it. Direct it. Export it.", support "ClearFrame studio", action "docs/agent-studio.md" | Describe it, direct it, export it. |

Look: dark, calm and precise, like the studio itself (a dark palette with a periwinkle accent).
Every `annotate` and `image` scene uses its capture as `file`; captions say what the person sees.
