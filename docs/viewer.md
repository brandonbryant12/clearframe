# Studio and review

`clearframe viewer --serve` opens the local editing studio: each ClearFrame film opens as one workspace for editing, previewing, reviewing and delivering. The standalone HTML (no server) keeps the read-only rendered-film review. Double-click `build/viewer/index.html`, or run with `--serve` so notes save straight into each film.

```sh
node engine/cli.mjs viewer                         # films under examples/ and real-examples/
node engine/cli.mjs viewer ~/films --out ~/films/viewer
node engine/cli.mjs viewer --serve                 # http://127.0.0.1:4317/… with note saving
node engine/cli.mjs viewer --no-render             # skip chart previews (faster)
```

## Editing workspace

Open a ClearFrame project from the studio board (with `--serve`). The workspace has four regions around one selection and one playhead:

- **Browser** (left): *Scenes* (drag to reorder; dots mark scenes edited since the latest render, engine errors and placeholders), *Script* (every scene's narration in order; a recording appears as its transcript), *Library* (blocks, drawings, palettes, type voices, motion, transitions and treatments, each with an action), *Assets* (project pictures and clips: drag onto the monitor or use *Plate*) and *Brief* (the brief and the film's sources). Below 1180 px wide it becomes a drawer.
- **Monitor** (centre): the *Working copy* (native stills and section previews of the saved storyboard), a *Rendered* version (with its notes pinned to the picture) or *Compare* (render against working copy, before against after an edit, or a candidate's passages; wipe or side by side). A badge always says what is showing and whether it matches the working copy. Text on a still can be clicked to select its element; the selected shape is outlined.
- **Inspector** (right): *Inspect* (the selected scene or element), *Film* (format, palette, type, motion, cutting, lens, frame, captions, sound, sources, treatments), *Review* and *Deliver*.
- **Timeline** (bottom): picture, narration, notes and music lanes on the engine's own timing (see below). Drag the ruler to scrub, a scene to reorder it, its right edge to set its duration; shift-click selects a run of scenes for a section preview; ⌘-scroll or `=`/`-`/`0` zoom.

**Story**, **Design**, **Review** and **Deliver** (keys 1–4) are arrangements of these panels, not separate pages. Panel sizes, the last arrangement, the open inspector sections and the selected scene persist in this browser. ⌘K opens a command palette over every action, scene, version, block, palette and treatment; `?` lists the shortcuts (space, J/K/L, ←/→ frame, ↑/↓ scene, ⌥↑/⌥↓ move, ⌘Z/⇧⌘Z, ⌘↩ still, ⇧⌘↩ section, ⌘D, ⌫, N).

### Edits

Each field saves when it loses focus or on Enter (⌘↩ in a text area) as one command, and each command is one step of undo. Before anything is written, the command builds the candidate film with the engine's own job builder (and the stage compiler for stages). If that adds an error, nothing is saved and the engine's reason appears under the field, with the value still in it; Esc restores the saved value. Problems already in the file do not block unrelated edits.

| Command | What it does |
|---|---|
| `set` | One value at a dotted path on the film or a scene (`props.data.2.value`, `art.under.0.fill`, `motion.intensity`); `null` removes it (and removes a list item). Only schema fields, and props the block has, are accepted. |
| `move` | A scene to a new position; ids never change. |
| `insert` | A catalog block after the selection, with the catalog's sample content and its "replace before publishing" source; or a canvas sketch. New silent scenes are six seconds long. Scenery sketches go behind a scene as `art`. |
| `duplicate` · `delete` | Not for recorded scenes: a recording plays once, and its scenes go when their words are cut. |
| `treatment` | The treatment's film look and scene defaults (`applyTreatment`), in one step. |
| `batch` | Several of the above as one undo step. |
| `undo` · `redo` | Persisted in `review/studio-history.json`. |

History compares canonical JSON, so reformatting the file is not a change. An edit made outside the studio (by hand, or by a CLI tool that is not `studio`) starts a new history on the next command. If the history was written but the storyboard was not (a crash between the two), that step is dropped. Commands take the project's review lock (the one `cut`, `revise` and the other review commands use) and fail at once if another process holds it. Stale clients cannot overwrite newer edits: every command carries the content hash it was made against, and the UI queues its commands so that each one uses the previous result.

The same commands run from the command line, with the same history:

```sh
node engine/cli.mjs studio film                      # scenes, timing, engine errors, undo/redo
node engine/cli.mjs studio film set props.text '"A clearer line"' --beat open
node engine/cli.mjs studio film insert bars --beat open
node engine/cli.mjs studio film move --beat bars --to 2
node engine/cli.mjs studio film undo
node engine/cli.mjs studio film history
```

An open studio picks up edits made this way within a few seconds.

### Narration and recordings

Script narration (`vo` with no audio yet, or a generated take) is edited as text. A generated take is re-recorded as a whole when narration is next made; rough cuts use a free local draft voice. Narration imported with its audio is never retyped. For an imported recording (`ingest --audio`), the narration is its transcript: select words (click, shift-click) in the inspector, the Script panel or the zoomed narration lane, then **Cut** (the engine plans the cut first and shows what goes; the cut records your name and is rebuilt from the master), **Split before** a word, or **Merge with next**. Undo of a cut is the engine's exact `uncut` (the same audio, byte for byte), and redo cuts the same words again by identity. Splits and merges are kept in `review/edits.jsonl`; their inverse is a merge or a split, not an undo. Narration imported per scene with `speech` is read-only; re-import it to change it.

### Previews and jobs

- **Live stills.** After a selection or an edit, the selected scene's native still is rendered from the saved working copy (about a second on this machine). Results are cached by content, so going back to a version you have seen is instant. *Frame at playhead* renders the exact frame under the playhead.
- **Preview section** (⇧⌘↩) renders the selected scenes (shift-click for a run) from the full prepared timeline, with half-second handles, the film's own mix and a clock checked against frames drawn directly (`preview --beats`). It plays in the monitor on the film's clock.
- **Rough cut** (`draft --rough --scale 0.5`, free draft narration) and **Final** (`render`, prepared narration only) save revisions. The film refreshes in place when they finish.
- **Check** (`check --draft`), **Captions** (`captions`) and a note's **candidate** (`revise --note`) and **rejection** (`reject --by --said`) also run as jobs.

Jobs run one at a time through the shared heavy-work gate, in order; the status bar shows the running job, its progress and "waiting for the gate". Any job can be cancelled while queued or running (its whole process group stops). Each result records the working copy's hash at the start, and if the source changed while it ran it is marked "may not match". Stills and sections never pause editing. Rough cuts, finals, candidates and rejections pause edits (the server refuses commands) until they finish or are cancelled. A failed render shows the engine's findings under the monitor, with a link to each scene named. Outputs live in the viewer's `studio/` folder, pruned to the newest 60 files and 400 MB. The job list survives a page reload; jobs interrupted by a server restart are marked so. Children stop with the server. No job makes paid calls.

### Timing

The timeline uses the engine's own timing of the saved working copy (`computeTiming`): narration-led scenes take the narration's length, and scenes whose narration is estimated (no audio, or no measured word timings) are marked. With a rendered version on the monitor, the timeline switches to that version's frames and says so. The transport's timecode is minutes:seconds:frames. Browser video seeking is approximate (about one frame); the native still is the frame-exact reference.

### Review and delivery

Notes belong to the rendered version you watched, never to the working copy. In **Review**: choose a version, press N (or *+ Note*) and click the picture, or add a whole-cut note; reply; resolve (your name is required, and *Won't change* closes a note without a change) or reopen. *Edit this scene* switches to the working copy with that scene selected. Once a note's scenes have changed, *Make candidate* runs `revise`: the engine checks the edit stays inside the note's scenes, saves a candidate revision and renders before/after passages, which play together in Compare. The note then reads "applied · awaiting a verdict". **Record acceptance** and **Record rejection** require the person's name and their own words, typed in the dialog; nothing is filled in for them except a name typed earlier in this browser. They call the engine's `accept` and `reject`. Applied is not accepted.

**Deliver** lists, honestly, the engine's errors and warnings, the latest native check (and whether it ran on this working copy), estimated narration, placeholders, whether the newest render matches the working copy, and whether a person accepted it. It also has rough-cut, final, caption and download actions.

### Local API

Under `/api/studio/`: `GET state?film=` (storyboard, hash, history, engine timing, errors and warnings, pickable text boxes, narration kinds, changes since the newest render, whether edits are paused), `GET schema` (the field contracts), `GET jobs?film=`, `GET film?film=` (the film's versions and notes, rebuilt), `GET review?film=` (decisions, keeps, checkpoints), `POST command`, `POST jobs`, `POST jobs/cancel` and `POST accept`. The server answers only on 127.0.0.1 with a local Host header. Every POST (the notes endpoints too) must be JSON from the same origin. Malformed paths return 400, dotfiles are never served, and byte ranges are validated.

## Studio board

Every film sits in a column for its phase of production, with a stage chip, its open notes and the next step. A search box filters by title, folder or stage.

| Phase | Stage | What exists | What the film page shows |
| --- | --- | --- | --- |
| Pre-production | Brief | `brief.md` only | The brief |
| | Script | A storyboard whose scenes are mostly `placeholder` slates | Boards: narration and what each scene must show |
| | Storyboard | A designed storyboard, nothing rendered | Boards: a still of every scene, its words, narration and source |
| Production | Rough cut | A render made with `--rough`, or one that still has placeholders | The review workspace; placeholder scenes are hatched on the timeline |
| Post-production | In review | A draft render | The review workspace |
| | Final | A final render | The review workspace |

Pre-processing (brief, script, storyboard) is planning; production makes the picture; post-processing (review rounds, final render) shapes and finishes it. Boards are stills drawn straight from the storyboard, so a film has pictures before it has a video; they are cached in `build/viewer/media/` and redrawn when a scene changes. A `brief.md` beside any film appears as its Brief tab. An outside film can name its stage in `film.json` (`"stage": "rough"`). `examples/timmer-takes/` holds five market-commentary films, one at each stage.

## Films

Every film page shows a lifecycle stepper and the next step. Once a film has a video it opens as a review workspace:

- **Lens.** Outlines every piece of text on the frame with its font, size and colour. Hover a box to highlight it in the panel below.
- **Timeline.** Drag anywhere to scrub. Lanes show scenes, narration lines, music, sound effects, media and notes; hover for the time and that scene's thumbnail. Space plays and pauses; the arrow keys step.
- **In this moment.** Live as you play or scrub: the scene and its on-screen words, the narration line, music and nearby sound effects, every visible text element in its real typeface with its colour, and the media the scene uses.
- **Scenes, Files, Fonts.** The storyboard as scene cards; every file in the project with a proper preview (images, SVGs, video, audio with waveforms, fonts as live specimens, text and data, 3D and simulation files as file cards); the fonts this version uses, with a sample line you can type into.
- **Notes.** Press *+ Note* (or N), then click the picture: the note is pinned to that point and moment (and to the text element under it). Pins reappear when the playhead returns, and markers sit on the timeline. With `--serve`, notes are saved into the film's review record (`review/notes.json`, read by `notes`, `revise` and the rest of the edit loop) or, for an outside film, its `notes.json`. Without a server they stay in the browser; *Download notes* exports them for `notes DIR --import`. Each note is a thread: resolve, reopen and reply; write `#tags` (for example `#type`, `#pacing`) to group and filter notes. In the engine a reviewer's resolution is recorded as `accepted`.
- **What changed.** From the second version on, a panel lists every scene added, removed, reworded (old words struck through beside the new), redesigned from a placeholder, given different media or retimed, and how many of the previous version's notes were resolved. Changed scenes are underlined on the timeline, and each version in the list shows its change count.
- **Transport.** Step one frame at a time (`,` and `.`), change speed (1×, ½×, ¼×, 2×) and loop the current scene (O). The frame number shows beside the time.
- Versions, side-by-side comparison kept in step, and downloads, as before. Add `?t=12.5` to a film link to open at a moment.

## Films made elsewhere

A folder with a `film.json` appears alongside ClearFrame films. Every other file in the folder is listed under Files.

```json
{
  "title": "Brand reel", "about": "One line on what it is.",
  "versions": [{ "id": "v1", "label": "First cut", "file": "versions/v1.mp4", "createdAt": "2026-10-03T14:00:00Z", "quality": "Draft" }],
  "scenes": [{ "start": 0, "end": 5, "kind": "Opening", "description": "…", "media": ["clips/a.mp4"],
               "elements": [{ "text": "WINNING", "font": "fonts/Display.ttf", "size": 250, "color": "#ffffff", "box": [90, 740, 900, 180], "at": 1.2 }] }],
  "lanes": { "music": [{ "start": 0, "end": 20, "name": "Score" }], "sfx": [{ "t": 12.0, "name": "Impact" }], "narration": [] },
  "fonts": [{ "file": "fonts/Display.ttf", "used": ["Slogan"] }]
}
```

`real-examples/` is the place for client and personal films: it is ignored by git, so nothing there is committed.

## Building blocks

The chart templates in wide and tall formats with what each is for (copy a beat for an editor), every typeface as a live specimen, the prepared 3D elements, and the colour palettes.

Posters, waveforms, chart previews, `fonts.css` and the page live in `build/viewer/` (ignored by git); videos and files are linked in place, not copied. Run the command again to refresh.

## Notes through the final cut

Final is an export quality, not a lock on feedback. Every rendered version keeps **+ Note**, **Whole-cut note**, replies, Resolve and Reopen. Whole-cut notes belong to the watched version, have no timestamp or picture pin, and do not move the playhead. New open notes return a final cut to In review while preserving its Final quality label.

The Storyboard panel stays available after rendering: a grid of the selected version's scene frames, narration and timings; selecting a card seeks to that scene. Before the first render, Boards still shows the planned storyboard. These are different views of the plan and the rendered cut.

Dragging the timeline pauses playback and leaves the player at the chosen time, including after pointer cancellation. A note pins the time when its composer opened. Two notes at the same time open their own threads. The local server reloads persisted threads when the film is reopened, without resetting the playhead. Download browser-only notes before moving to another machine.

Preview reuse is scoped to the project and its input files, including media and narration. A result made while those inputs changed is marked stale. Switching films abandons unsent edits and ignores late responses from the previous workspace; a save already sent still completes for its original film.
