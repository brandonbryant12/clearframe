# Pinned FFFrames media decoder patch

Source: https://github.com/dmtrKovalenko/fframes/tree/bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b/fframes-media

Upstream version: `1.0.1`, revision `bacfc3c3212d3d9429468435bfdc1ae2a21c7b3b`.
License: MIT; the upstream license is included as `LICENSE.txt`.

This directory contains the upstream `src/` files and manifest. The manifest's
workspace dependencies are expanded to their exact upstream dependency declarations
so this crate can be patched independently; `webvtt-parser` remains pinned to the
same Git revision. Upstream audio test fixtures are omitted because they are not
needed by the application or the renderer's regression tests.

Only `src/video_decoder.rs` changes runtime behavior. At demuxer EOF, the upstream
decoder returned `false` immediately. H.264 B-frames can still be buffered, which
made a valid clip's final frame disappear. The patch sends the FFmpeg drain packet
and receives delayed frames until the requested presentation timestamp or decoder
EOF. It preserves missing-frame behavior beyond the clip and returns demuxer read
errors rather than treating them as ordinary EOF. No looping, duplicate frames,
frame freezing, or substitute imagery is used.

The application test `video_decoder_drains_exact_last_b_frame_and_survives_backward_seeks`
checks frame 119 of a 120-frame H.264 clip, verifies its timestamp and pixels differ
from frame 118, rejects frame 120, seeks backward, and reproduces the final pixels.
Remove this patch after upgrading to a pinned upstream revision with equivalent
decoder draining and passing the same regression.
