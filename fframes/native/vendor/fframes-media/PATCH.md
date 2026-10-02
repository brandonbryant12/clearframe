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
EOF. The decoder also recognizes the final frame's actual presentation interval
when a film samples faster than its source clip. This uses the decoded frame's
duration and the known stream end, without estimating duration from average FPS.
Requests at or beyond the stream end return false before seeking. It preserves
missing-frame behavior beyond the clip and returns demuxer read errors rather
than treating them as ordinary EOF. It does not extend a short clip or substitute
imagery.

The application test `video_decoder_drains_exact_last_b_frame_and_survives_backward_seeks`
checks frame 119 of a 120-frame H.264 clip, verifies its timestamp and pixels differ
from frame 118, rejects frame 120, seeks backward, and reproduces the final pixels.
`video_decoder_preserves_the_final_sample_interval_at_a_higher_output_rate`
samples that fixture at 60 fps: requests 238 and 239 share the actual final frame,
240 and a far post-end request fail, repeated requests remain stable, and a
backward seek followed by a direct seek into the final interval reproduces it.
Remove this patch after upgrading to a pinned upstream revision with equivalent
decoder draining and final-interval handling and passing the same regressions.
