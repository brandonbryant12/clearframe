# ClearFrame library browser

[Open the local browser](index.html). It indexes retained example packages and the expansion inventory without installing assets or changing their readiness. The current snapshot has seventeen packages, 65 examples with 128 native format variants plus one prepared Blender insert, and 71 inventory items.

Search by topic, operation, source ID or inventory ID. Collection, purpose, medium and package-state filters narrow examples. The inventory view uses availability states (has example, source only, planned) and retains the full readiness text. A linked example does not mean that the entire inventory proposal is complete. Source attribution and adaptation limits remain beside the selected preview. One controlled video is mounted at a time, with no autoplay or preload.

## Rebuild

```sh
node docs/library-browser/example-ledger.mjs
node engine/cli.mjs library-browser --verify --ledger docs/library-browser/example-ledger.json
```

Open `docs/library-browser/index.html` in a browser that permits local files. `--out DIR` changes the output directory. Keep the output in the same relative location to the repository when moving it: fonts, sources and retained media are linked, not copied. There are no network dependencies, module imports or fetch calls in the generated browser. `engine/ui/library-browser/` is the editable UI source; `engine/lib/library-browser-build.mjs` emits the classic script, catalog JSON, HTML and CSS.

`--verify` checks manifest file size and SHA-256 with bounded streaming reads. A missing or changed file is reported and its link is disabled; a missing or changed storyboard disables that specimen's preview too. The command writes the inspectable catalog but exits nonzero if file issues exist. Without `--verify`, integrity reads “hashes not checked.” This is a build-time snapshot: rebuild after changing media or source. File integrity never promotes `prototype` or `ready-for-review` to `accepted`.

`asset-links.json` in the research inventory supplies explicit collection and case-to-operation mappings. Add a mapping when adding a package; a missing multi-operation mapping must remain unknown, rather than linking every package operation to every example. Package manifests and source registers remain the provenance authorities. Path traversal, remote file references and symlinks outside the package are rejected. Imported ledger text is rendered as text and never executed.

The Balance study contains a prepared Blender insert and an unrendered native integration storyboard. Its preview is labelled accordingly. Other package examples retain their existing prototype status, sampled visual/encoded checks and continuous-playback limitations. This browser does not establish new acceptance of any film.

## Record creative choices

Create a choices file:

```json
{
  "mechanisms": ["Reservoir and gate"],
  "materials": ["Porcelain and transparent panels"],
  "camera": ["Fixed orthographic"],
  "story": ["Separate, open, transfer, isolate"]
}
```

Record the current project, then inspect its recent decisions:

```sh
node engine/cli.mjs library-log my-film --choices choices.json --ledger my-series.json --assets B04 --note "An access metaphor; geometry is qualitative."
node engine/cli.mjs library-variation --ledger my-series.json
node engine/cli.mjs library-browser --verify --ledger my-series.json --out build/my-series-browser
```

`library-log` hashes the actual `storyboard.json` bytes. The identity is project path, source hash and declared choices; repeating those inputs is a no-op, including when only a note changes. A source or creative-choice change adds an entry. The ledger uses an exclusive writer lock and atomic replacement. If a process is interrupted, inspect and remove its adjacent `.lock` only after proving that writer is no longer running. Example and project history cannot be mixed by the recorder.

The report groups the most recent twelve entries by normalized mechanism and story labels. Different materials or cameras remain visible within a repeated concept. Palette and seed are deliberately absent: changing them alone does not establish a new concept. These are declared decisions, not semantic inference; consistent naming matters and reuse can be appropriate. The report never edits or forces a visual choice.

The bundled four-entry ledger documents actual library example decisions, including two subjects that intentionally reuse one reservoir. It is not a claim of production usage. `example-ledger.mjs` binds those declarations to current storyboards. Browser generation checks each initial ledger entry's named source hash and labels it verified, changed, missing or unreadable. Imported JSON stays labelled unverified. Import replaces only the in-memory browser session; use Export JSON to retain it. No local storage, uploads or background writes occur.

The displayed candidate thumbnails link back to their retained example. They are review aids, not automatic proof of a different film grammar. General candidate generation, semantic novelty detection and accepted cross-film contact-sheet review remain outside this milestone.

## Verification and remaining work

See [direction](DIRECTION.md) and [source review](evidence/source-review.md). Focused checks cover real catalog mappings, changed/missing previews, path safety and source-bound ledger behavior. The current full Node suite passes 217/217. Seventeen independent source checks are rerun after catalog expansion; both CLI recording/report smoke checks remain bound to the unchanged command source from the static-anchor milestone. No browser evidence is claimed.

Actual interactive visual verification is pending. The browser tool rejected `file:` navigation under its URL security policy. Approval has been requested for a scoped localhost-only HTTP preview; no alternative browser route was attempted while that question was pending. Desktop and phone screenshots, keyboard flow, native video controls, export/import and continuous browser playback must be inspected before calling the UI visually verified.
