# From image exploration to repeatable motion

Use image generation to discover a picture: its silhouette, material, light, spatial relationship and mood. Choose the production path according to what must remain exact. A prompt containing brand hex values or a font name is a request, not a guarantee.

| Requirement | Production path |
|---|---|
| Exact palette assignments, native type, editable shapes and repeatable animation | Explore with imagegen, then reconstruct the selected idea as native canvas elements or a library sketch. |
| An evocative place, illustration or material where small colour differences are acceptable | Keep the generated still as a prepared plate; add native copy and animate the camera. |
| A complex organic subject plus exact branded messaging | Hybrid: approved raster subject, native background, logo, typography and data. |
| Exact logo, product UI, factual chart or named font | Use the approved source asset or supported native font. Never regenerate it to approximate identity. |

The deterministic guarantee begins with the saved storyboard, assets, palette, fonts and renderer version. Re-running imagegen is not part of rendering. Palette paints resolve to specified colours; shading, blending, antialiasing and encoded video colour conversion produce derived pixel colours. If every flat region must equal a swatch, use opaque solid fills and verify the actual export. A native role such as `bold` selects a bundled font; it does not install an arbitrary named brand font. Check `fframes/assets/fonts/provenance.json` and the font roles in `docs/canvas.md` before promising an exact face.

## A bounded two-pass exploration

1. Write the constraints first: copy region, aspect ratios, palette intent, number of heroes, material, and what stays native. Run `plan DIR` before project generation. The plan estimates configured project providers; it does not price a separate built-in imagegen session.
2. Generate one concept board with distinct forms. Ask for no text, numbers, logos or UI. Review silhouette and material, not just attractiveness.
3. Make one targeted revision: reduce tangled topology, expose layer boundaries, simplify reflections, or improve negative space. Keep the subject and mood fixed.
4. Choose an output path. For a native reconstruction, list the geometry, paint tokens, layer order and motion before coding. Do not trace generated text or preserve accidental detail.
5. Rebuild with existing primitives. Put the reusable composition in `library/sketches/`, a colour family in `library/palettes/`, and directing defaults in `library/treatments/`. Use a fixed seed where layout varies; animation must depend on frame time, never wall time or live randomness.
6. Render the native version, review it at phone size and in the full MP4, then revise. Similarity to the concept is optional; good typography, meaningful motion and controllability are required.

Keep the two prompts and reference images as provenance, outside the runtime dependency path. The worked example is [material studies](design/material-studies/README.md): two built-in imagegen passes informed the folded paper, optical rims and inflated ring. None of those sketches loads a generated PNG.

## Useful prompt families

Use these as starting briefs, not another fixed visual vocabulary. Find the material or mechanism that supports the story.

- **Porcelain and paper:** “A single folded architectural ribbon, three broad faces, pale studio, soft contact shadow, clear shared fold edges, quiet left half for copy. No text or marks.” Rebuild with polygons, token gradients and one restrained float.
- **Optical glass:** “Two overlapping lenses, visible double rims, broad restrained highlights, one small opaque sphere, pale studio, no complex refraction, no writing.” Rebuild with translucent discs, explicit `fill: "none"` rims and separate caustic shapes.
- **Soft inflated forms:** “One hollow ring and diagonal capsule, satin rubber, clear front/back occlusion, few broad tonal regions, spacious composition, no lettering.” Rebuild with annular strokes, rounded rectangles and a front arc; move related parts as a group.
- **Botanical or cellular:** “An abstract seed pod or lobed organism, asymmetric but simple silhouette, translucent membrane, few internal layers, no scientific labels.” Rebuild the shape if repeatable geometry matters; use a cutout if organic complexity is the point. Do not imply scientific accuracy.
- **Print and fabric:** “Folded translucent vellum / woven silk / embossed card, raking light, one broad gesture, no distressed text.” Consider a prepared texture behind native shapes, or use token-painted contours when brand control is strict.
- **Dark mineral:** “Angular crystalline forms, large facets, restrained edge glow, charcoal studio, uncluttered silhouette.” Rebuild as polygon facets; avoid adding unrelated HUD widgets.

A refinement prompt should name one change: “Keep the composition and materials. Simplify each object into at most four visible layers with broad gradients and clean occlusion. Preserve the empty copy region.” The saved [actual prompts](design/material-studies/prompts.json) show the two iterations used here.

## Motion-first asset decisions

Ask for more image outside the visible crop when a camera move needs overscan. Request a transparent cutout when only the subject should move; inspect alpha edges before use. Separate far, subject and foreground only if their camera motion needs to differ. A single flattened illustration cannot reveal hidden sides during a large camera move. For native forms, group related layers so highlights, rims and contact relationships move together. Keep frame-zero scenery visible while speech-cued text waits.

Built-in imagegen is the default when available. Copy any chosen project-bound result into the project and reference that saved path. The repository's `images DIR` command is a separate Gemini provider workflow described in `skills/gemini-image/SKILL.md`; use its planning and budget controls when choosing that path. Do not silently switch providers or regenerate during render.

## Reuse the deterministic library

```json
{
  "id": "reveal",
  "block": "statement",
  "duration": 4,
  "art": { "sketch": "glass-orbits", "seed": 17, "opacity": 0.8 },
  "props": { "text": "Your approved message" }
}
```

`art.sketch` can sit beneath any block. For these compositions, position short copy in the left half (landscape) or top third (portrait), preferably with native canvas text. Default centred blocks can overlap the hero: inspect them. `art.under` appends authored background details, and `art.over` stays above the block. `opacity` affects the selected sketch, not authored additions. Only sketches marked `layer: "under"` with no scene camera/world can be used here; use `props.sketch` for a complete canvas scene.

For detailed shape or timing changes, run `node engine/cli.mjs sketch inflated-loop`, copy its elements into your storyboard, then edit native geometry, `fill`, `stroke`, `loop` and `keys`. Palette tokens remain live. Do not expect every sketch's seed to vary geometry; only seeded layouts use it. Shared/project JSON sketches retain their authored coordinates; supply format variants for the frames you use.
