# Viewer

`clearframe viewer` writes one HTML page for people who watch, review and approve films rather than build them. Double-click `build/viewer/index.html`, or run with `--serve` so notes save straight into each film.

```sh
node engine/cli.mjs viewer                         # films under examples/ and real-examples/
node engine/cli.mjs viewer ~/films --out ~/films/viewer
node engine/cli.mjs viewer --serve                 # http://127.0.0.1:4317/… with note saving
node engine/cli.mjs viewer --no-render             # skip chart previews (faster)
```

## Studio

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
