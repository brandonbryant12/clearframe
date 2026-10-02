# Balance study

A small **story kit** demonstrating the package convention: one retained Blender mobile, a JSON style, a native balance composition and a two-beat playbook. It explains the reusable operation “compare competing forces.” It contains no Timmer copy, Fidelity artwork or market dataset.

Open [preview.html](preview.html) for the prepared clip and usage notes. Read [kit.json](kit.json) for provenance, hashes and limits. The retained scene can be edited in Blender; replaying its clip does not require Blender.

## Use the native kit

From the repository root, choose a fresh output directory:

```sh
node engine/cli.mjs new /tmp/my-balance-film --library examples/library-kits/balance-study/library --playbook balance-study --treatment balance-study
node engine/cli.mjs critique /tmp/my-balance-film
```

The existing library loader reads these JSON files. It does not install a package or copy its media. The playbook resolves the flat sketch into native elements; shared palette/type/treatment travel with the new project.

## Include the prepared Blender asset

Copy the kit's complete `media/counterweight-mobile` folder into the destination film, preserving the scene, recipe and original receipt alongside the clip. Add a clip asset with a file path inside that film, then use its ID in a plate or video block. [storyboard.json](storyboard.json) is a self-contained source example: six seconds of prepared media, six seconds of a native balance and six seconds of matched questions.

The source specimen has been schema-loaded and compiled into a native job. No final specimen video or visual acceptance is claimed. For a later render, use the normal sheet/check/render/review workflow after checking disk headroom; full renders on this Mac use codex-heavy.

## What changes where

- Change labels, evidence, typography and native palette in the storyboard/library. No Blender pass needed.
- Change mobile geometry, lighting, baked colors or 3D camera in the retained recipe/scene, then prepare a new asset.
- The retained clip is opaque 1920×1080, 24 fps, six seconds and loopable by its source contract. It has no audio or baked text. It is not an alpha overlay or a verified portrait asset.
- JSON sketch variants cover landscape, vertical, square and portrait; they still need visual review in the destination film.
- The balance is choreographed, not a numerical force simulation or a depiction of portfolio weights.

## Provenance and review

The media is copied unchanged from the repository's counterweight-mobile package, with original receipt and source hashes. `render-config.json` retains original build paths as historical evidence; regenerate into a new output directory instead of replaying those old paths verbatim. The kit manifest separately records current portable paths. SHA-256 verification proves file identity, not visual approval. Original ClearFrame artwork and kit files use the included MIT license. Bundled renderer fonts retain their existing font licenses in the renderer distribution.
