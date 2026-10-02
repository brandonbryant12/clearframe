# Foldwork: a simulated user trajectory

This fictional studio, artwork and approved copy exercise the complete idea/brand/document-to-video workflow. The three turns are **simulated user instructions**, not a real client's messages or approval.

The supplied inputs deliberately mix an outlined SVG identity, semantic colour roles, a synthetic whiteboard PNG and an approved copy document. `logo.svg` contains only local outline geometry. The renderer uses its converted PNG while intake retains the exact original SVG and both hashes. The whiteboard is a deterministic authored diagram, not a photograph or an actual application screenshot.

`approaches.json` records three different story, picture, editing and pacing choices. The selected paper workshop is authored as five original native canvas scenes in a vertical composition. It does not use a playbook's scene elements. The initial middle contains 14 paper/route objects. The simulated revision removes half, keeps the meaningful questions and alternatives, and holds the chosen route and final identity longer. The approved narration stays unchanged.

## Run the actual films

From the repository root:

```sh
node scripts/trajectories/workshop.mjs /path/to/new-workshop-evidence --phase initial
# Inspect the saved contact/phone sheets and film before the revision.
node scripts/trajectories/workshop.mjs /path/to/new-workshop-evidence --phase revised
```

`--phase all` replays both variants serially. A completed variant is retained and cannot be overwritten by the script. Native pipeline calls use the shared resource gate. The script uses free local draft narration and no paid providers. The revised film reuses the approved first-pass narration.

The script recreates the fictional input bytes and records actual CLI command/stage times, source-to-claim bindings, original/revised storyboards, brand provenance, pipeline receipts and review queues. These replay timings do not measure the original creative authoring session. The live run separately records that session in `live-session.json` and its visual observations in `visual-review.json`.

To reproduce only the supplied fixture bytes in a new folder:

```sh
node scripts/trajectories/workshop.mjs /path/to/new-fixture --write-fixtures
```

## Acceptance criteria for the simulation

- All five scenes use original canvas pictures and the deliberately authored vertical layout.
- Narration matches A1–A5 in `approved-copy.md`. No invented numbers, testimonials or service guarantees appear.
- The supplied SVG is retained byte for byte; its rendered derivative and the supplied whiteboard are actually placed in the film. The final identity preserves its proportions.
- The revised middle contains seven meaningful/physical objects versus fourteen in the first pass. Source copy and narration remain unchanged.
- Both actual CLI pipelines complete with matching input/output receipts and zero native or encoded QA errors.
- Contact and phone sheets are inspected after each run. Playback/listening is reported separately, with any unavailable verification made explicit.

Passing these criteria establishes an agent-reviewed simulation. It does not record human acceptance or approve a real client's film.
