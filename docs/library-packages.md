# Reusable library packages

Keep the existing library and renderer structure. A package is a documented collection of compatible pieces, not a new renderer, registry, installer or executable plugin.

## Choose the smallest useful package

| Kind | Contains | Example |
|---|---|---|
| Asset pack | Related media, previews, editable sources and receipts | Ceramic reveal clips |
| Style kit | JSON palettes, type voices and treatments; optional background sketches | A publication's house style |
| Story kit | A narrative playbook, useful sketches, a style kit and optional prepared assets | Explain two competing forces |

An idea remains a note until its reusable part is clear. Colors go in `palettes`, typography in `types`, coordinated art direction in `treatments`, a composition in `sketches`, a narrative arc in `playbooks`, and source-aware creative guidance in `directions`. Trusted procedural 3D recipes stay in the built-in `library/sculptures` directory. A new renderer capability belongs in the engine; a new arrangement of existing capabilities usually does not.

## Package layout

Keep built-ins where they are. Place a demonstrated kit under `examples/library-kits/<id>/`, or keep a brand-specific kit in a shared directory outside the repository. The first example is [balance-study](../examples/library-kits/balance-study/README.md).

```text
<kit>/
  README.md                purpose, limitations, adaptation and replay
  kit.json                 descriptive manifest, versions and file hashes
  LICENSE                  applicable notices for original kit content
  preview.html             local preview; media does not autoplay
  library/                 existing JSON-only shared-library contract
    palettes/
    types/
    treatments/
    sketches/
    playbooks/
    directions/
  media/<asset-id>/         prepared asset package
    asset.json
    poster.png
    clip.mp4
    scene.blend
    source/
    receipt.json
    render-config.json
  storyboard.json          optional illustrative integration specimen
```

Omit unused folders. Do not put `kit.json` inside a library-kind folder: loaders reject unknown item fields. The manifest is documentation read by people and inventory tools; ClearFrame does not discover or install kits automatically. Use the current `--library <kit>/library` option. Explicitly copy/register media when adopting it in another film. A library override never installs Python or executes a Blender recipe.

## Manifest convention, version 1

Use an ID distinct from the item's display title. Record:

- `schemaVersion`, `id`, `version`, `kind`, `title`, `purpose` and `status`.
- Tags grouped as `purpose`, `appearance`, `movement`, `format` and `subject`. Examples: `compare`, `ceramic`, `rack-focus`, `landscape`, `productivity`. Software names belong in capability metadata, not the main category.
- `includes`: local library items, media and specimen paths.
- `requires`: renderer revision or compatible capability list, bundled fonts and any optional tools needed to **edit** source. Distinguish replay without Blender from preparation with Blender.
- `editable`: changes that need only native rendering, changes that need a new Blender pass, and fixed properties of prepared clips.
- `evidence`: source receipts, hash verification and visual-review status. A rendered file is not automatically accepted artwork.
- `files`: relative paths with byte counts and SHA-256 hashes. Omit the manifest itself to avoid a self-hash cycle.
- `license` and provenance. Research citations are inspiration, not a license to redistribute another publisher's charts, text or logos.

Use `idea`, `prototype`, `ready-for-review`, `accepted` or `deprecated` as editorial lifecycle states. These are package conventions, not engine enums. Mark each variant separately: a landscape review does not approve a portrait crop.

## Admission and reuse

1. Write the storytelling job and the operation: separate, accumulate, reveal, compare, connect, rebalance or change scale.
2. Search built-in blocks, sketches, playbooks and sculptures first. Reuse the closest sound mechanism; avoid synonyms that create duplicate assets.
3. Make one small specimen using clearly marked sample data or qualitative labels.
4. Retain editable sources and a preview. Keep measured graphics, labels, citations and captions native. Give metaphors an explicit limitation.
5. Validate JSON with the current library loader; compile the specimen into a native job. For new motion, inspect the encoded clip, joins, holds and phone-size text before changing its review status.
6. Promote proven reusable pieces to the shared or built-in library. Keep unproven ideas in the research inventory. Never move unrelated project files as part of promotion.

The override order remains built-in → shared → project. Prefer unique IDs for additions; use a matching ID only for a deliberate override.

## Blender handoff

Retain the recipe, baked `.blend`, poster, prepared clip, configuration and original receipt together. List duration, FPS, aspect ratio, loop/reveal behavior, copy region, baked colors, camera and alpha availability. Current bundled sculpture MP4s are opaque; recoloring native text does not recolor their pixels. Source changes require another asset pass.

Choose native charts for exact quantities and Blender for physical appearance or a qualitative mechanism. A perspective object must not silently encode a financial amount. New 3D rigs should declare start, action and settled-hold phases so editors can place native evidence at a legible moment. Camera presets and transparent passes discussed in the [expansion plan](research/timmer-library/README.md) are proposals until implemented and verified.

## Finding the next package

Use the [finance-inspired inventory](research/timmer-library/index.html) to filter proposed work by medium, readiness and priority. Its research spans 2025-10-02 through 2026-10-02 and treats Timmer's material as a creative stress test for a general-purpose library. An inventory entry is not a built asset.
