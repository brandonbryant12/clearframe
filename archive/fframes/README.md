# FFFrames

ClearFrame drew its films with [FFFrames](https://github.com/dmtrKovalenko/fframes) (MIT) at
revision `055bb6b` until October 2026: blocks built `svgr!` trees that FFFrames converted with
usvg and drew with Skia. That path was retired for the scene engine's own display list.

Since 2026-10-12 (branch `fframes-return`) fframes is back as the **film runtime** at the
revision in `upstream.json`: a Cargo git dependency of `scene/native` that schedules the render,
encodes GOP-aligned segments in parallel and concatenates them, while ClearFrame's engine draws
every frame through a custom render backend (`scene/native/src/runtime.rs`). No fframes source is
copied or patched. `UPSTREAM-LICENSE.txt` is the upstream MIT notice for that revision. See
[docs/fframes-return.md](../../docs/fframes-return.md).
