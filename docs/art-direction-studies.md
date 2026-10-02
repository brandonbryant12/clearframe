# Material studies for native films and 3D inserts

These studies give the picture a physical operation: reveal, interfere, or open. They are original native vector compositions with no third-party assets, generated media, or factual claims. Their different silhouettes, densities and motion are the starting point; changing a palette alone does not make a new direction.

| Sketch | Picture and motion | A useful role | Copy region |
|---|---|---|---|
| `die-cut-aperture` | Offset, notched paper sheets surround a real opening. The front sheet slides far enough to expose the stack, then settles. | Reveal a detail, frame an approved product image, enter the next chapter. | Left half of landscape; top third of vertical. |
| `moire-signal` | Two coarse optical screens move slowly through different angles. Their overlap makes broad interference bands. | Ambiguity, competing readings, an abstract signal or an editorial transition. | Left half of landscape; top third of vertical. |
| `folded-louvers` | Seven folded fins pivot on fixed hinges above a sill, exposing light between their faces. | Opening access, a change of view, a mechanism becoming legible. | Left half of landscape; top third of vertical. |

The sketches also redraw for square, portrait, and custom dimensions. A fixed seed repeats exactly; changing it makes bounded variations in shape, alignment or angle. Omit the seed for the reference arrangement. All paints use palette tokens and all type stays native. The fins and line counts are decorative geometry; they do not encode an amount, probability, frequency, or uncertainty.

## Two contrasting looks

`paper-theatre` pairs the `vellum` palette with didone type, warm paper, restrained shadows and a slow reveal. Use it when the viewer should inspect an object or an idea. `interference` pairs the `oscilloscope` palette with condensed type, deep instrument green, phosphor mint and amber. Use it when alignment, gating, or competing readings are the visual subject. Both carry their own motion, typography and editing guidance.

The existing `cutpaper` treatment remains the brisk, flat shape-morphing direction. `paper-theatre` instead treats the paper as layered material with visible cut edges and depth.

## Try the art showcase

```sh
node engine/cli.mjs new /tmp/paper-study --playbook material-etudes --treatment paper-theatre
node engine/cli.mjs new /tmp/signal-study --playbook material-etudes --treatment interference --vertical
node engine/cli.mjs pipeline /tmp/paper-study --draft --scale 0.5 --json
node engine/cli.mjs pipeline /tmp/signal-study --draft --scale 0.5 --json
```

`material-etudes` is a short montage without narration. Its labels name a way of looking; it contains no quotations, data, or source claims. A treatment can add transition sound effects. The geometry moves from frame one. Pipeline review still needs the contact sheet, phone sheet and encoded motion: a slow interference field can alias at reduced size even when its geometry validates. Avoid rapid flashes and keep the field coarse when changing its density or timing.

For any existing beat:

```json
"art": { "sketch": "die-cut-aperture", "seed": 17, "opacity": 0.85 }
```

Add `under` or `over` elements for story-specific objects and annotations. The background contract keeps authored additions. `drift` is optional; these sketches already contain motion. Keep evidence and captions outside the moving art, and inspect their final positions at phone size. A background does not decide the argument or replace original scene direction.

## Where headless Blender earns its cost

The local `sculpture` command now renders original procedural scenes and retains their baked Blender source, clip, poster and source/settings receipt. See [the sculpture workflow](sculptures.md). Use 3D when viewpoint, contact or light makes the idea clearer:

- **Product reveal:** start on a surface seam or edge light, then pull the camera back to reveal the complete approved product. A changing viewpoint and grazing light justify real 3D. Composite the product name and verified specifications as native type.
- **System assembly:** separate a small set of purpose-shaped parts, then mate them along constrained axes. Use contact, occlusion and one continuous camera to explain the connection. Keep each part tied to the actual system; labels remain native.
- **Scenario gates:** send broad ribbons from a shared origin through visibly different gates. Use fixed scenario labels and equal starting geometry unless real data determines widths. The depth clarifies overlap and alternate routes; it must not suggest probabilities or forecast confidence that the source does not provide.

Keep the Blender output as approved imagery under native claims and charts. Use one motivated 3D shot, preserve its source file and frame settings, and judge whether the shot explains something that the native planes cannot. The louvers deliberately show that a simple opening can already work with native geometry.

Two additional original scene studies explore a different scale of object. `shadow-arcade` uses perspective, mineral plaster and one narrow raking light: an architectural opening repeats into depth while long shadows move across a promenade. `strata-landform` is a warm, matte laminate cutaway: the upper sheets of an invented saddle-shaped ridge lift together to expose a blue-green layer, then settle back into contact. Its contours are qualitative, with no geographic or geological meaning. Both bake their camera and light transforms into the saved scene and use a bounded seed to vary the construction. Render receipts bind the saved scene and clip to the exact source modules; inspect the resulting frames and encoded motion before using them in a film. A module passing syntax or compilation checks does not establish visual quality.

## Verification boundary

`test/art-direction-studies.test.mjs` checks deterministic, palette-only geometry, bounded seed layouts, preserved annotations and native job compilation for both treatments in landscape and vertical. Those focused checks do not establish visual quality, render performance, audio quality, or absence of temporal aliasing. Record actual sheet and video review separately.

The 2026-10-02 production exercise also completed four half-scale native pipelines: both treatments in both shapes, each with zero native errors or warnings and zero encoded QA errors or detected pops. Agent review covered all eight contact/phone sheets and sampled encoded aperture/louver frames after a motion revision. Full real-time playback and listening were not performed. These retained review receipts qualify the checked examples; they do not automatically approve a new film or establish professional quality from test results.
