---
name: clearframe-fframes
description: Develop and verify the production FFFrames Rust/SVG renderer used by ClearFrame. Use for native block implementation, media decoding, typography, frame timing, rendering diagnostics and native setup.
---

# Production native renderer

Read `fframes/README.md`, `fframes/SETUP.md`, `fframes/DESIGN.md` and `fframes/AGENTS.md`. All active rendering uses FFFrames. A single storyboard selects native blocks; there is no second scene map or per-film Cargo crate.

1. Use the root CLI for prepare/check/still/sheet/render workflows. Build once, then pass content as runtime JSON. Renderer sources, upstream revision and Cargo.lock determine build cache invalidation.
2. Extend catalog metadata/validation and native code together. Inspect the public upstream API in the pinned checkout rather than assuming browser/SVG-string behavior. Native SVG trees and bundled Inter glyph metrics govern shapes and text.
3. Keep frame logic pure, including backward seeks. Use exact local word intervals and monotonic data interpolation. Chart ranges and baselines must match labels. Preserve unit suffixes and authored focus opacity/duration.
4. Load media from prepared local assets. Video decoder timing must be relative to the scene and explicit source offset. Fail on missing/short media; do not hide gaps with loops or placeholders.
5. Honor resource limits: codex-heavy gate, one Cargo job, bounded Make/Ninja/Rayon workers, one Metal pipeline. Retain a warm cache and disk headroom. Never run competing cold builds.
6. Run focused Rust tests and Node contract tests, inspect native diagnostics, render PNGs and open them, then verify a real encoded MP4 with audio. Test landscape and vertical; include square/portrait where layout code changes.
7. Keep the upstream SMPTE170M conversion and tags paired. A BT709 delivery requires real pixel conversion. Strip the native empty audio stream before the shared mix; generated clip audio is excluded.

Report evidence precisely. Mocked Google calls prove request/response handling, not provider access or actual generated quality. Measured timestamp validation proves internal consistency, not flawless recognition. This local renderer is not a sandbox for untrusted code.
