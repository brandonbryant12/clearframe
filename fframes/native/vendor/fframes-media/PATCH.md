# FFFrames 1.2.0 fractional-duration patch

Source: https://github.com/dmtrKovalenko/fframes/tree/055bb6b9dcbbcca6532206847d43ea8e81fa2a0b/fframes-media

Upstream version: `1.2.0`, revision `055bb6b9dcbbcca6532206847d43ea8e81fa2a0b`.
License: MIT; the exact upstream notice is included as `LICENSE.txt`.

The source files match this revision except one duration conversion in
`src/video_decoder.rs`. The standalone manifest expands workspace dependencies
and lints; unused upstream audio fixtures are omitted.

Upstream 1.2 supplies delayed-frame draining and final-sample preservation. Its
exclusive output-frame bound rounds the stream duration to the nearest frame.
For a 49-frame, 24 fps clip sampled at 30 fps, the true bound is 61.25: offset 61
is still within the clip, but upstream rounds to 61 and reports EOF. This patch
uses `av_rescale_q_rnd(..., AV_ROUND_UP)`. The exclusive integer bound becomes 62,
so offset 61 is visible and 62 is absent. Integer durations are unchanged, and
looping uses the same corrected bound. Decoder, seek and pixel conversion logic
are otherwise upstream code. Unknown duration handling is not changed here.

The existing two B-frame/backward-seek regressions remain. The new
`video_decoder_preserves_the_final_sample_when_output_duration_is_not_integral`
regression fails on unpatched 1.2 at offset 61 and checks repeated calls, exclusive
end behavior and backward/direct seeks. Its small synthetic fixture and creation
provenance are under `native/tests/fixtures/bframes-49-at-24fps.*`.
