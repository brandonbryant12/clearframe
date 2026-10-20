# Decoder regression fixture

`bframes.mp4` is synthetic FFmpeg `testsrc2` output created locally, with no generated
or external media. It contains 120 frames at 30 fps, 64×64 pixels, and reordered B-frames.

```sh
ffmpeg -v error -f lavfi -i 'testsrc2=size=64x64:rate=30:duration=4' \
  -an -c:v libx264 -preset medium -crf 18 -bf 3 -g 60 -threads 1 -y bframes.mp4
```

The fixture is deliberately small; it exercises delayed decoder output, exact final
timestamps, absent out-of-range samples, and deterministic backward seeks.
