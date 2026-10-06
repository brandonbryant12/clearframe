# Studio design references

The studio uses independently implemented interaction ideas from the ArtCraft family. No third-party source or assets were copied in the initial implementation. Their code is available under MIT OR Apache-2.0; any later imports must preserve the MIT notice and exact provenance required by AGENTS.md.

- FilmCraft `ada55eb62568ba75be25cd12bd07b5fbdc37f88d`: `crates/ui-egui/src/dock.rs` for resizable panel layout, workspace selection and persistent dimensions; timeline/monitor separation. https://github.com/storytold/filmcraft/tree/ada55eb62568ba75be25cd12bd07b5fbdc37f88d
- EffectCraft `857340036bef4300afe2a484ca6175c3b09ec2ce`: `crates/ui-egui/src/panels/properties.rs` for selection-driven properties and shared command actions; `render_queue.rs` for progress visible beside creative work. https://github.com/storytold/effectcraft/tree/857340036bef4300afe2a484ca6175c3b09ec2ce
- LightCraft `65da36675f78f1c85cb7d135669f95e67e524c70`: documented preview caching, background rendering, before/after views and transactional undo. https://github.com/storytold/lightcraft/tree/65da36675f78f1c85cb7d135669f95e67e524c70

## Direction

The film is the visual focus. Neutral charcoal (#18191c), panels (#222428), fields (#191b20), dividers (#3b3e45), light ink (#eeeff1) and a restrained periwinkle selection (#9aaef9) separate app chrome from each film's own palette. System UI type stays compact and readable; the film keeps its native typefaces. Scene browser left, picture center, contextual properties right, sequence below. Version history appears in review context. No decorative dashboard metrics.

A shared scene identity connects browser, sequence, inspector and render requests. All source changes go through a single command path. Working source, stale previews and rendered revisions have distinct visible states. A keyboard or agent command should eventually be interchangeable with the same UI action and undo history.
