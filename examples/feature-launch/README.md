# A feature launch with actual product proof

This 30-second example launches ClearFrame's original 3D studies. It consumes ready asset directories with `asset.json`, `receipt.json`, `clip.mp4`, `poster.png`, `scene.blend` and retained source files. It does not start Blender or call a paid provider. All copy and workflow diagrams remain native storyboard elements.

Three materially different concepts are recorded in `concepts.json`: a material reveal that resolves into an editable workflow, one asset used for three storytelling jobs, and a command-to-picture editorial workbench. The selected film moves through reveal, mechanism, command, retained files, a text change, and payoff. The concepts differ in argument, pictures, edit structure and pace.

## Prepare and render

The included `storyboard.json` links to the ready clips and posters in the sibling `examples/sculptures/` gallery. Its portable CLI evidence marks the substituted output-directory placeholder. For a fresh run with original receipts and separate review outputs, use the script below.

From the repository root, use the included master set. Follow [native setup](../../fframes/SETUP.md); no Blender installation is required for this replay. The reference storyboard uses sibling assets and is not directly renderable: the script below copies them into a self-contained project.

```sh
node scripts/trajectories/feature-launch.mjs --asset-root examples/sculptures --out /tmp/clearframe-launch-draft --render
node scripts/trajectories/feature-launch.mjs --asset-root examples/sculptures --out /tmp/clearframe-launch-final --render --final
```

Omit `--render` to prepare source and assets only. Preparation refuses an existing output directory. A prepared project can be rendered again with `--out /tmp/clearframe-launch-draft --render-only`; each native pipeline run retains its own snapshot. `--final` requires 1920×1080 assets with non-draft receipts and omits the native pipeline's draft/scale flags. The shared heavy-process gate serializes expensive work.

The script verifies every copied source and output hash against the Blender receipts. It retains original source scenes and settings in `source/artifacts/`, captures actual CLI catalog and dry-run output in `source/cli-proof.json`, and binds film assets in `asset-manifest.json`. Preparation time, native pipeline time and prior Blender render time are separate measurements. They are not a measure of creative authoring time.

## Adapt it to a real product

Start with a verified feature, an audience problem and a specific before/after. Map **feature → observable proof → user payoff** before choosing a sculpture. “A new 3D asset workflow” becomes actual local CLI commands, retained scene/clip/receipt files, and native text that can change while its image bytes remain identical. The payoff is a more dimensional film whose story stays editable.

For another product, collect approved logo files, palette and typography, current product screenshots or a genuine screen recording, exact approved copy, and evidence for each capability claim. Preserve supplied logo and UI bytes. Never redraw an invented interface and present it as a screenshot. A native diagram can explain behavior when it is visibly labelled as a visualization. Use actual captured before/after product states when the argument depends on interface behavior or output quality.

Choose among three distinct directions before detailed production. For example: follow the user through a genuine task; reveal a product mechanism with one motivated 3D cutaway; or compare a verified before and after with a quiet editorial proof sequence. Changing only colour, type or a transition does not create another concept. Use source evidence to decide what each picture can claim.

The sculptures here are original conceptual illustrations. Their panels, petals, ribbons and motion do not represent a real device, measured performance, physical simulation or probability. Keep factual product labels, specifications and data in native layers. Replace a sculpture with an approved product model or recording when literal identity matters.

## Review and limits

Inspect `storyboard.json`, `source/cli-proof.json`, `asset-manifest.json` and `edit-proof.json` alongside the contact and phone sheets. The edit shot is a labelled native visualization; its two separate source fixtures retain the same image while changing the native text. It is not an interactive UI recording. The CLI commands are real syntax, while the command panel is an authored view.

The film has no speech. `accessible-transcript.md` records its on-screen text; transition effects are its only sound. Contact-sheet review does not establish full playback, sound quality, seam quality or human approval. Record those checks separately. Source hashes prove provenance, not visual quality or creative success.
