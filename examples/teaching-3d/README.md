# A question, then a dimensional answer

This 20.5-second authored sequence keeps the question, option labels, answer and worked explanation native. The complete 3D view sits in an 800×450 picture panel; nothing is cropped. The quiz poster shows three identical tiles. A/B/C below the panel map to left/middle/right, and the receipt's selected right tile agrees with `correctIndex:2`. The gap sequence retains the empty state before the missing piece descends.

The storyboard is an editable source template, not a directly renderable project. Follow [native setup](../../film/SETUP.md), then run from the repository root with the included `quiz-triptych` and `gap-bridge` masters. The script creates a self-contained project with its retained assets and derivatives; no Blender installation is needed:

```sh
node scripts/trajectories/teaching-3d.mjs --asset-root examples/sculptures --out /tmp/teaching-3d --final --render
```

The script makes no Blender or paid generation calls. It verifies and retains each original scene, clip, poster, receipt and source hash. Recorded FFmpeg commands scale and pad the full view, then extend the 4-second answer clip by holding its final frame for 2 seconds and normalize it to the delivery rate of 30 fps. The answer never loops back to the unanswered state. The project keeps hashes for original and derived files.

Both question and answer phase durations remain editable. When changing the correct answer, change the native options and mapping together and use a matching retained selection asset. Inspect the question poster, chosen tile, final hold, explanation and encoded timing. See [teaching direction](../../docs/teaching-sequences.md). Mechanical success alone does not approve the film's quality.
