# Viewer

`clearframe viewer` writes one HTML page for people who watch, review and approve films rather than build them. Double-click `build/viewer/index.html`, or run with `--serve` so notes save straight into each film.

```sh
node engine/cli.mjs viewer                         # films under examples/ and real-examples/
node engine/cli.mjs viewer ~/films --out ~/films/viewer
node engine/cli.mjs viewer --serve                 # http://127.0.0.1:4317/… with note saving
node engine/cli.mjs viewer --no-render             # skip chart previews (faster)
```

## Films

A poster wall of every film. Opening one gives a review workspace:

- **Lens.** Outlines every piece of text on the frame with its font, size and colour. Hover a box to highlight it in the panel below.
- **Timeline.** Drag anywhere to scrub. Lanes show scenes, narration lines, music, sound effects, media and notes; hover for the time and that scene's thumbnail. Space plays and pauses; the arrow keys step.
- **In this moment.** Live as you play or scrub: the scene and its on-screen words, the narration line, music and nearby sound effects, every visible text element in its real typeface with its colour, and the media the scene uses.
- **Scenes, Files, Fonts.** The storyboard as scene cards; every file in the project with a proper preview (images, SVGs, video, audio with waveforms, fonts as live specimens, text and data, 3D and simulation files as file cards); the fonts this version uses, with a sample line you can type into.
- **Notes.** *+ Note*, then click the picture: the note is pinned to that point and moment (and to the text element under it). Pins reappear when the playhead returns, and markers sit on the timeline. With `--serve`, notes are saved into the film's review record (`review/notes.json`, read by `notes`, `revise` and the rest of the edit loop) or, for an outside film, its `notes.json`. Without a server they stay in the browser; *Download notes* exports them for `notes DIR --import`.
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
