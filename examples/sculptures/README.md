# Material operations

Open index.html for the offline gallery. Nothing autoplays. Each folder contains a prepared clip, poster, editable baked scene, original recipe source, full render receipt and asset.json with hashes. Reuse the clip under native film graphics; changing a headline does not need Blender.

These original sources and procedural artwork use the repository's MIT license. See docs/sculptures.md in ClearFrame for generation, integration, verification and creative guidance. Baked scenes can render with automatic Python execution disabled. The source recipes provide easier parameter changes.

Rebuild a gallery from retained asset passes with:

    node scripts/package-sculptures.mjs /path/to/asset-root NEW-GALLERY-DIR

The retained render-config.json records the original rendering paths. Use the CLI with a fresh output directory to regenerate it elsewhere. Full PNG sequences stay in the external production evidence; they are intentionally not duplicated in this compact reusable pack.
