# Studio design references

The studio uses independently implemented interaction ideas from the ArtCraft family. No third-party source or assets were copied in the initial implementation. Their code is available under MIT OR Apache-2.0; any later imports must preserve the MIT notice and exact provenance required by AGENTS.md.

- FilmCraft `ada55eb62568ba75be25cd12bd07b5fbdc37f88d`: `crates/ui-egui/src/dock.rs` for resizable panel layout, workspace selection and persistent dimensions; timeline/monitor separation. https://github.com/storytold/filmcraft/tree/ada55eb62568ba75be25cd12bd07b5fbdc37f88d
- EffectCraft `857340036bef4300afe2a484ca6175c3b09ec2ce`: `crates/ui-egui/src/panels/properties.rs` for selection-driven properties and shared command actions; `render_queue.rs` for progress visible beside creative work. https://github.com/storytold/effectcraft/tree/857340036bef4300afe2a484ca6175c3b09ec2ce
- LightCraft `65da36675f78f1c85cb7d135669f95e67e524c70`: documented preview caching, background rendering, before/after views and transactional undo. https://github.com/storytold/lightcraft/tree/65da36675f78f1c85cb7d135669f95e67e524c70

## Direction

The film is the visual focus. Neutral charcoal (#18191c), panels (#222428), fields (#191b20), dividers (#3b3e45), light ink (#eeeff1) and a restrained periwinkle selection (#9aaef9) separate app chrome from each film's own palette. System UI type stays compact and readable; the film keeps its native typefaces. Scene browser left, picture center, contextual properties right, sequence below. Version history appears in review context. No decorative dashboard metrics.

A shared scene identity connects browser, sequence, inspector and render requests. All source changes go through a single command path, checked by the engine's own job builder before they are written. Working source, stale previews and rendered revisions have distinct visible states. Keyboard, command-palette, `clearframe studio` and UI actions share the same commands and undo history.

## What was adapted, and from where

Everything below is reimplemented in the viewer's browser JS. No ArtCraft source or assets were copied, so no notice is needed.

- **Dock and workspaces** (FilmCraft `dock.rs`): fixed regions with persisted, resizable sizes, and named arrangements (Story, Design, Review, Deliver) that rearrange tabs around one selection instead of opening separate pages.
- **Source and program monitor** (FilmCraft `project_views.rs`): the monitor switches between the working copy and a rendered version, and a compare mode shows them together (wipe or side by side).
- **Selection-driven properties** (EffectCraft `properties.rs`): the inspector follows the selection (scene, element, words, note) and offers only fields the contract allows. Each change is one shared command.
- **Render queue beside the work** (EffectCraft `render_queue.rs`): a visible queue with progress, waiting state and cancellation, in the status bar rather than a separate screen.
- **Cached previews and before/after** (LightCraft): stills are cached by content hash, the previous still of a scene is kept for a before/after wipe, and results remember which source they were made from.
- **Command palette** (PhotoCraft and PrintCraft READMEs: ⌘K over every tool): one searchable list over actions, scenes, versions, blocks and looks.
