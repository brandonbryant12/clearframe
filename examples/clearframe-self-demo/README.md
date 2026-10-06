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

(Recorded as they happen; see `prompts.md` for the exact text.)
