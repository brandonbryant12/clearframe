# Native rendering contract

This describes the FFFrames job and renderer. With the default scene engine the same job is prepared, a scene plan is compiled beside it, and the engine composites the film itself while this code draws each beat's block content ([scene engine](../docs/scene-engine.md)); the finisher, receipts and colour conventions below apply to both.

The root CLI loads `storyboard.json`, computes narration-led beat lengths, validates block props and prepares `build/native/job.json`. Version 2 jobs contain canvas/FPS, expanded palette, motion, contiguous frame spans, normalized block data, local word intervals and caption phrases. Project media is copied under content-hash names; fonts are bundled. A manifest records input hashes and upstream revision.

The reusable Rust binary reads the job at runtime. Content changes do not recompile it; renderer source changes invalidate the build marker. Every block reads local frame time. Numbers/charts use monotonic interpolation; spring motion affects only decorative entrances. Six transitions are scene entrances, not overlapping scene composites. Font advances determine wrapping. Native image/video blocks use prepared local media.

The Node finisher strips upstream's empty audio stream, mixes narration/music/sfx, muxes once, verifies decoded frames and checks inputs did not change during rendering. Clip audio is deliberately excluded. The output sidecar records input identity, renderer revision, backend, color space, elapsed time, output hash and voice provenance. A changed input fails delivery rather than certifying a mixed version.

Final speech-following scenes reject estimates, missing words, transcript mismatch, overlapping intervals and changed audio. Imported offsets use the original recording clock; import does not trim silence. Display seeks are frame-pure and preserve gaps. Transcription correctness still needs human review.

Local Rust execution is trusted development execution, not a sandbox for hostile generated code. Hosted use requires an isolated worker and separate credentials policy. CPU/Metal output and font rendering need independent platform verification.

## Native color working convention

Native graphics use sRGB picture values. The encoder applies a BT.601 limited-range matrix; the finisher signals BT.709 primaries, IEC 61966-2-1/sRGB transfer, SMPTE 170M matrix and limited range in both the H.264 stream and MP4 container. These are distinct properties. Metadata signaling does not convert a transfer curve or matrix. Receipts record the actual four color properties plus hashes for the JavaScript renderer finalization and audio/mux modules.

Prepared media should conform to the sRGB graphics convention. Arbitrary imported video and wide-gamut/HDR/ICC inputs are not automatically normalized by this contract. BT.709 delivery requires explicit pixel conversion. See the [source trace and bounded remux evidence](../docs/research/fframes-color-transfer/README.md); player appearance and arbitrary-media normalization remain separate verification work.
