# Native rendering contract

The root CLI loads `storyboard.json`, computes narration-led beat lengths, validates block props and prepares `build/native/job.json`. Version 2 jobs contain canvas/FPS, expanded palette, motion, contiguous frame spans, normalized block data, local word intervals and caption phrases. Project media is copied under content-hash names; fonts are bundled. A manifest records input hashes and upstream revision.

The reusable Rust binary reads the job at runtime. Content changes do not recompile it; renderer source changes invalidate the build marker. Every block reads local frame time. Numbers/charts use monotonic interpolation; spring motion affects only decorative entrances. Six transitions are scene entrances, not overlapping scene composites. Font advances determine wrapping. Native image/video blocks use prepared local media.

The Node finisher strips upstream's empty audio stream, mixes narration/music/sfx, muxes once, verifies decoded frames and checks inputs did not change during rendering. Clip audio is deliberately excluded. The output sidecar records input identity, renderer revision, backend, color space, elapsed time, output hash and voice provenance. A changed input fails delivery rather than certifying a mixed version.

Final speech-following scenes reject estimates, missing words, transcript mismatch, overlapping intervals and changed audio. Imported offsets use the original recording clock; import does not trim silence. Display seeks are frame-pure and preserve gaps. Transcription correctness still needs human review.

Local Rust execution is trusted development execution, not a sandbox for hostile generated code. Hosted use requires an isolated worker and separate credentials policy. CPU/Metal output and font rendering need independent platform verification.
