# From image exploration to repeatable motion

Use image generation to discover a picture: its silhouette, material, light, spatial relationship and mood. Choose the production path according to what must remain exact. A prompt containing brand hex values or a font name is a request, not a guarantee.

| Requirement | Production path |
|---|---|
| Exact palette assignments, native type, editable shapes and repeatable animation | Explore with imagegen, then reconstruct the selected idea as native canvas elements or a library sketch. |
| An evocative place, illustration or material where small colour differences are acceptable | Keep the generated still as a prepared plate; add native copy and animate the camera. |
| A complex organic subject plus exact branded messaging | Hybrid: approved raster subject, native background, logo, typography and data. |
| Exact logo, product UI, factual chart or named font | Use the approved source asset or supported native font. Never regenerate it to approximate identity. |

The deterministic guarantee begins with the saved storyboard, assets, palette, fonts and renderer version. Re-running imagegen is not part of rendering. Palette paints resolve to specified colours; shading, blending, antialiasing and encoded video colour conversion produce derived pixel colours. If every flat region must equal a swatch, use opaque solid fills and verify the actual export. A native role such as `bold` selects a bundled font; it does not install an arbitrary named brand font. Check `packages/engine/src/film/assets/fonts/provenance.json` and the font roles in `docs/canvas.md` before promising an exact face.

## A bounded two-pass exploration

1. Write the constraints first: copy region, aspect ratios, palette intent, number of heroes, material, and what stays native. Run `plan DIR` before project generation. The plan estimates configured project providers; it does not price a separate built-in imagegen session.
2. Generate one concept board with distinct forms. Ask for no text, numbers, logos or UI. Review silhouette and material, not just attractiveness.
3. Make one targeted revision: reduce tangled topology, expose layer boundaries, simplify reflections, or improve negative space. Keep the subject and mood fixed.
4. Choose an output path. For a native reconstruction, list the geometry, paint tokens, layer order and motion before coding. Do not trace generated text or preserve accidental detail.
5. Rebuild with existing primitives. Put the reusable composition in `packages/engine/src/library/sketches/`, a colour family in `packages/engine/src/library/palettes/`, and directing defaults in `packages/engine/src/library/treatments/`. Use a fixed seed where layout varies; animation must depend on frame time, never wall time or live randomness.
6. Render the native version, review it at phone size and in the full MP4, then revise. Similarity to the concept is optional; good typography, meaningful motion and controllability are required.

Keep the two prompts and reference images as provenance, outside the runtime dependency path.

## What to ask for

Ask for the object or place the story is about (the product, the document, the office, the harbour the shipment leaves from), not an abstract decoration to put behind the words: a decorative object with no job fails the library's bar (`packages/engine/src/library/README.md`). Name the material, the light and the empty region for copy, and forbid text, numbers and logos.

A refinement prompt should name one change: “Keep the composition and materials. Simplify each object into at most four visible layers with broad gradients and clean occlusion. Preserve the empty copy region.”

## Motion-first asset decisions

Ask for more image outside the visible crop when a camera move needs overscan. Request a transparent cutout when only the subject should move; inspect alpha edges before use. Separate far, subject and foreground only if their camera motion needs to differ. A single flattened illustration cannot reveal hidden sides during a large camera move. For native forms, group related layers so highlights, rims and contact relationships move together. Keep frame-zero scenery visible while speech-cued text waits.

Built-in imagegen is the default when available. Copy any chosen project-bound result into the project and reference that saved path. The repository's `images DIR` command is a separate Gemini provider workflow described in `skills/gemini-image/SKILL.md`; use its planning and budget controls when choosing that path. Do not silently switch providers or regenerate during render.

## Reuse the deterministic library

Put a rebuilt composition in `packages/engine/src/library/sketches/` (a project's own library for brand art). A sketch that declares `layer: "under"` can then sit beneath any block as `art: {sketch: NAME, seed, opacity, drift}`; run `pnpm cf sketch NAME` to copy its elements into a storyboard and edit native geometry, `fill`, `stroke`, `loop` and `keys`. Palette tokens remain live.
