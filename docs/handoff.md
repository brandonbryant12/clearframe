# Deliver a saved revision

`node engine/cli.mjs handoff PROJECT --rev r003 --out NEW_DIRECTORY` exports an editable package. Without `--rev`, it uses the newest saved revision. The destination must be new; export verifies every stored object and publishes the directory only when the package is complete.

- `project/` contains that revision's storyboard, recorded inputs, project library and media. Later working-copy edits are not included.
- `review/` contains its revision record, prepared job and timeline.
- `delivery/` contains its newest retained final video and original receipt, or its newest retained draft when no final exists. Missing and draft deliveries are reported explicitly.
- `manifest.json` lists the revision identity, required renderer and font identity, input hashes, package hashes and delivery identity. The exporter's current fframes metadata is labelled separately from the historical renderer requirement.
- `rights.json` inventories media with rights marked `unrecorded`. Consult original asset agreements and project provenance; exporting does not infer a licence or acceptance.

The recipient runs `node engine/cli.mjs handoff PACKAGE --verify` before editing. It checks the listed files and the video/receipt identity. This detects corruption against the manifest; it is not a signature or proof of who produced the package. Additional unlisted files are outside that check.

Use an installed ClearFrame engine and its bundled fonts to check and render `project/`. A different engine may produce a different picture; the package reports a renderer mismatch at export. External shared-library overrides are not stored by older revisions: supply those libraries and compare the prepared job before rendering. Project-local library files are retained. The package preserves source and delivery evidence, but does not claim byte-identical replay on an arbitrary installation.

No generation, rendering, uploading or approval happens during export. Inspect the source material before sharing it: saved narration, tables and other inputs may contain information that a finished picture omits.
