# FFFrames (retired)

ClearFrame drew its films with [FFFrames](https://github.com/dmtrKovalenko/fframes) (MIT) at the
revision in `upstream.json` until October 2026. The block code was always ClearFrame's own: it
built `svgr!` trees that FFFrames converted with usvg and drew with Skia, and FFFrames' media
crate (with a one-line rounding patch) decoded footage. The renderer in `scene/native` now draws
the same blocks as its own display list with Skia and decodes footage with the FFmpeg tools, so
none of that code or any FFFrames crate is used. `UPSTREAM-LICENSE.txt` is the upstream notice
for the revision that was used.
