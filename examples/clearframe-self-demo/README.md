# ClearFrame, made with ClearFrame

A product demo of the browser studio, produced *with* the browser studio: the home page, an
OpenCode conversation on the free model, the studio's own editing, review and sound controls, and
the native renderer. This folder holds everything needed to reproduce it except generated files.

| File | What |
| --- | --- |
| `script.md` | The scene plan and narration given to the agent (uploaded with the brief) |
| `prompts.md` | Every prompt and selection the person made, in order, exactly as entered |
| `storyboard.json` | The film's final storyboard (written by the agent and the person through the studio) |
| `README.md` | This process record |

Not in Git (kept outside the worktree, see "Evidence"): the UI captures, rough cuts, the final MP4,
review stills and the OpenCode session database.

## How it was made (process record)

**Tested revision.** Studio code at main `a114b31` (PR #7) plus this branch's fixes; the commit that
rendered the final is listed in "Final render".

**Setup.** `node engine/cli.mjs viewer --serve` (port 4317) on macOS arm64; OpenCode 2.0.24 from
`node_modules`, isolated under `.clearframe/opencode`; model `opencode/big-pickle` (free). Headless
Chrome 154 (one profile, remote debugging on 9333) drove the browser the way a person would.

### 1. Real UI captures (operator step, scripted)

`scripts/demo-captures.mjs` opened real films in the running studio and captured each state at
1920×1080, plus 2× close-ups, and measured every control's position into `captures.json`:

```sh
node scripts/demo-captures.mjs --out "$EVIDENCE/demo/captures-pass-a" --cdp http://127.0.0.1:9333 \
  --tour projects-why-the-tide-turns-twice --done projects-flash-then-rumble
```

States: home brief and modes; a saved conversation with the film's real state; a scene pinned as the
scope with the composer; one layer selected with its fields and "Ask the agent about this layer";
review with a note; the Sound tab and the Google approval dialog (opened and **cancelled**, nothing
generated or charged); Deliver with the final. The tool only reads, types into the composer without
sending, and cancels dialogs. Two capture problems were fixed in the tool before use: a pin measured
off-screen (now refused rather than recorded) and a layer state whose targets scrolled away.

The captures show other task-owned demo films (a tide explainer, "Flash, then rumble"); no personal
or credential data appears in them.

### 2. A new film from the home page (Make it for me)

In the browser home page: the title, the idea, kind of film "Show a workflow and its payoff", look
left to the agent, **Make it for me**, audience and takeaway (all in `prompts.md`), and 17 files:
`script.md`, `captures.json` and 15 captures. Create sent the first message shown in `prompts.md`.

- **Gap found and fixed:** Create failed with "Unsupported document type .json": the home page accepted
  JSON sources but the `start` intake cannot read JSON. Fixed in commit `5c3e364` (JSON and other
  non-prose sources are kept in `source/`; the intake reads the rest), with a regression test. The
  viewer was restarted to load it, after checking the separate Codex test film was idle.
- **Earlier gap fixed for this demo:** the home page only took documents; pictures now go to
  `assets/uploads/` (commit `7407420`).

Project `projects/clearframe-made-with-clearframe`, OpenCode session `ses_eeea17521ffe6bAuNb9KjuNbnT`.
The agent read the script, the capture manifest and the block references, made three labelled edits
(structure; the eleven scenes with the measured pins and focus regions; logline and sources), queued
the rough cut and followed it: **rough cut r001**, 63.7 s, 960×540, free local draft voice, engine
check 0 errors, 7 minutes, no shell requests, cost $0.

### 3. Director's review of r001

Watching r001: the structure and narration follow the script, the captures are real and the pins land
on the right controls, but the full-screen captures play at about a quarter of the frame and the tall
inspector column in "By hand" is tiny. On a phone none of the UI text reads. The revisions below fix
that through the product.

### 4. Revisions

Exact text and selections are in `prompts.md`; each step's evidence (screenshots, the scope and mode
at send time, which scenes changed, the agent's reply) is in the external `process/steps.jsonl`.

**4a. Together, one scene.** Build it together, scene "06 By hand" pinned as the scope, asked for a
proposal. The agent asked to run `sips` to read the picture's size (denied in the studio's
permission card), proposed without changing anything, and on the quick reply "Yes — go with your
recommendation." made one labelled edit ("Crop scene 06 in so the inspector fills the frame":
`fit: cover` and a slow push-in) to that scene only. *Undo these edits* returned the film exactly
to its prior state; ⇧⌘Z restored the edit.

- **Gap found and fixed:** the agent has no shell, so it could not learn a picture's size.
  `clearframe_files` now lists width×height for PNG, JPEG, GIF and WebP (commit `6df49d5`).

**4b. A review note, handed to the agent.** In Review, a note on the rendered r001 at 0:22 in
"04 Conversation" by "Demo director"; *Ask the agent* on the note (scope: the note) in Make it for
me. One labelled edit to that scene only, the conversation close-up, and a still to check it. The
agent pointed out that `captures.json` measured pins only on the full screenshots.

- **Gap found and fixed:** `scripts/demo-captures.mjs` now records each close-up's crop and the pins
  inside it, normalised to the close-up. A second capture pass produced close-ups with identical
  sizes, so its measurements apply to the pictures already in the film.

**4c. Whole film, Make it for me → rough cut r002.** Close-ups for Scope, Review, Sound and Export in
one labelled edit; r002 rendered (63.7 s, engine clean). Director's review of r002: the wide
close-ups (scope composer, review thread, the two modes) now read on a phone; the tall ones
(conversation, inspector, sound and readiness panels) still sit small in a wide frame, the "By hand"
cover crop lands on two meaningless coordinate fields, and the agent placed the close-up pins at the
centre (0.5, 0.5) for lack of measurements.
