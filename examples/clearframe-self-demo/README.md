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

**4d. Together, whole film: the tall close-ups.** The second capture manifest was added through
Assets (`source/captures-2.json`). Asked for a proposal, the agent corrected every pin to its measured
position (it also found the Scope pin it had placed at the centre) and proposed word-cued camera
pushes; nothing changed before the answer. After "Yes", the engine refused the render: pushing into
an `annotate` scene throws its own pin legend, caption and label off the frame. The agent ran a
check rather than rendering blind, explained why (the legend sits beside the picture; a phone needs
2.5–4.5× and that zoom is soft), and handed the decision back with three options. r002 stayed
watchable throughout.

- **What this showed:** zooming screenshots cannot make tall UI read on a phone without losing the
  labels or sharpness. Codex's round-6 review reached the same verdict independently, and added
  that a slideshow of stills cannot show a stop, an undo or a mode switch at all.
- **Fixed for the demo:** `scripts/demo-clips.mjs` records real interactions (real mouse and
  keyboard events, a drawn cursor) in a tight 16:9 box at 2×, about 500 CSS px wide so UI text reads
  at 360 px. Eight clips: switching modes, a saved reply and its status, Ask the agent pinning a
  scene, a hand edit with ⌘Z and ⇧⌘Z (the film then verified back to its starting hash), a request
  stopped while the agent waited (film unchanged), the sound takes and buttons, the Google approval
  opened and cancelled, and Render final and Download. `clips.json` says what each one exercised.
  The edit and stop clips act on a task-owned demo film (one free-model request, stopped); the rest
  only look.

**4e. Clips in, rough cut r003.** Answered in Build it together with the clips added through Assets.
The agent replaced seven stills with clip scenes and added the stop scene; its first check failed
because the conversation clip (10.4 s) was shorter than the beat estimated from word count, which it
fixed by binding the real draft narration rather than looping or trimming. r003: 12 scenes, 67.1 s,
960×540 rough cut, engine clean. A 360 px phone sheet showed the clips' UI text reading at last, but
the `video` block draws footage in a wide band above its title, so `fit: cover` cropped the dialog,
the scope chip and the Google button out of their scenes.

- **Fixed in the engine-facing tools during this step** (Codex rounds 6–7): the agent now reports
  measured outputs (the half-size rough cut, the draft voice) apart from settings, narration records
  name the OS voice that actually spoke, and older records are presented with their Google values
  labelled as settings at the time. The viewer was restarted to load them, after checking both the
  demo and the separate Codex film were idle (logged in the coordination log).
- **Clip lengths:** footage never loops; each clip holds its final frame (the screen at rest) for the
  rest of its scene. `clips.json` records each file's encoded length, its action and its held seconds.

**4f. Full-frame clips, rough cut r004.** Make it for me, with `home.mp4` added. The agent rebuilt
every clip scene as a stage with one full-frame `video` element (`fit: contain`, so a 16:9 clip is
not cropped; `hold: true`, so it rests on its last frame), nothing drawn over it, and the home
clip in scene 02. r004: 67.1 s, engine clean. Its report used the new measured facts unprompted by
any correction: "960×540, 67.1s as encoded — the half-size rough", narration "the free local draft
voice (OS voice), not a Google voice". On the 360 px sheet every clip scene reads: the brief being
typed, both modes, the film status, the scope chip, ⌘Z on a hand edit, the priced Google button
and the approval's exact amount, Render final and Download. Only 07 Review was still a small still.
