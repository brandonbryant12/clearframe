# shader-effects-inc/shaders: what is worth rebuilding natively

Bounded review of [shader-effects-inc/shaders](https://github.com/shader-effects-inc/shaders), at revision `935f71a7789f0e07811dfe6fd0d8f707e9848238` (MIT, pushed 2026-10-06). No code was copied; this note records ideas to implement independently in the scene engine's SkSL materials, lens and transitions.

## What it is

The repository holds WebGPU components for React, Vue, Svelte, Solid, plain JS and Framer. It has 199 effects, one folder each under `packages/core/src/shaders/`. Effects are not plain shader files: each is written in the project's own TypeScript DSL (`defineStd` from `@coreroot/std`, with shared helpers such as `pixelGrid`, `quantise` and `ditherInks`), which compiles to WGSL in the browser. Each effect is a role in a tree (a generator, a filter that gathers its children, or a transition), with typed props and UI metadata.

**Not adoptable as a renderer.** ClearFrame renders with Skia on Metal from a compiled plan, and frames depend only on frame number and prepared inputs. A WebGPU/browser path would be a second renderer, which `AGENTS.md` rules out. The DSL also means a port would mean rewriting each effect, not translating it. Reimplementing the useful ideas in SkSL is the same work without the dependency.

## Overlap with what ClearFrame already has

| Theirs | ClearFrame today |
|---|---|
| FilmGrain, Vignette, Halftone, Engraving, Duotone, Tritone, GradientMap | `texture.grain`/`vignette`; materials `grain`, `halftone`; canvas `print` (benday, halftone, engraving, newsprint, letterpress); plate duotone |
| Glow, Godrays, LensFlare, LightLeak, ChromaticAberration, Blur, ZoomBlur | `lens` bloom, light leaks, chromatic aberration, blur; motion blur on stages |
| Chrome, Glass, Neon, Sheen, CRTScreen/VHS scanlines | materials `chrome`, `glass`, `neon`, `sheen`, `scanlines`, `gold`, `thermal`, `noise` |
| Particles, FloatingParticles, ParticleFlow | canvas `particles`; stage particles |
| IrisWipe, LinearWipe, Flash-like cuts | transitions `iris`, `panel`, `whip`, `flash`, `dissolve` |

## Gaps worth closing, in priority order

These are judged by the product's films (explainer, product, PR, business) and tonight's direction: continuous pictures, meaningful diversity rather than palette swaps, and the persistent pixel or SVG ensembles of the creative reference.

1. **Dither and pixel grids** (their Dither, Pixelate, Ascii, PixelSort). These are the look of the reference's pixel-object ensembles. ClearFrame's `mosaic` has `style: pixel` for shapes, but no ordered dither over a group or plate. It would be a native material `dither`: a Bayer 4×4 or 8×8 threshold per cell, in two palette inks, with the cell size in frame pixels so it survives the half-size draft. Bayer dithering is textbook, so this is an independent implementation. The material could apply to a cast object, a stage actor or a plate.
2. **Pattern transitions** (BlockDissolve, NoiseDissolve, VenetianBlinds, BarnDoors, CheckerWipe, DiamondWipe, SliceWipe). These add variety in graphic transitions without effects for their own sake. Each is a mask driven by progress (cell index or noise threshold against `t`), so it fits the existing transition compositor. Two would cover most uses: `blinds` (bands, axis and count) and `dissolve-blocks` (a seeded cell order, deterministic per frame).
3. **Product backdrops** (MeshGradient, FlowingGradient, StudioBackground, Aurora). Product and brand films want a soft lit sweep behind a hero object. A `studio` backdrop could be a two-colour floor-to-wall gradient with a soft key-light falloff and an optional slow mesh drift, all from palette tokens and a pure function of time.
4. **Materials for hero objects** (FlutedGlass, Frost, ThinFilm, Holographic, LiquidMetal, Paper). Lower priority: `glass`, `chrome` and `sheen` already cover most uses. `fluted` (vertical ribbed refraction) is the one with a distinct look worth having.
5. **Data backdrops** (ContourLines, FlowField, Voronoi, Heatmap). These would be useful only when driven by real data (a terrain from values, flow from a vector field). As decoration they would become the "random effects" the discovery steering warns against. Defer until a data contract asks for one.

**Not recommended:** cursor and webcam effects (interactive), Glitch, DataMosh and CompressionArtifacts (they read as errors in business films), Kaleidoscope and Twirl-style distortions (decoration), and Form3D/Surface3D (ClearFrame has Blender sculptures and `tilt`).

## If one is built

- **Provenance.** Implement from the algorithm, not their files. If code is ever imported, it has to be MIT at this exact revision, with the notice bundled.
- **Frame purity.** The material is a function of frame time, palette and prepared inputs only.
- **Discoverability.** It goes in the catalog with a when-to-use line (for example, dither: "pixel or retro objects; reads as craft at full size, can moire on phones: check the 360 px sheet").
- **Evidence.** One curated example, judged against a professional reference, and a 360 px phone sheet. Dither in particular can moire or shimmer under motion, so review the encoded MP4, not stills.
