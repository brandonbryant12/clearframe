# Viewer

`clearframe viewer [folder]` writes one HTML page for people who watch and approve films rather than build them. Open `build/viewer/index.html` by double-clicking; there is no server and nothing to install.

```sh
node engine/cli.mjs viewer examples              # every film under examples/
node engine/cli.mjs viewer ~/films --out ~/films/viewer
node engine/cli.mjs viewer --no-render           # skip chart previews (faster)
```

**Films.** A poster wall of every folder with a rendered video. Opening a film plays the latest version and lists every earlier one: its number, the label it was saved with, date, length, draft or final, approval and notes. *Compare two versions* plays any two side by side, kept in step. *Download this version* saves the MP4.

Versions come from the engine's own record (`review/revisions/`), so every render is listed automatically; a project rendered before versions existed shows its latest video. Approvals and notes come from `review/decisions.jsonl` and `review/notes.json`.

**Building blocks.** The finance chart templates in wide and tall formats with what each is for (open one to copy its beat for an editor), the prepared 3D elements (hover to play), and every colour palette.

Run the command again to refresh the page. Posters, chart previews and the page live in `build/viewer/` (ignored by git); videos are linked in place, not copied.
