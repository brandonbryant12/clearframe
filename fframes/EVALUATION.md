# Evaluation

The original paired-renderer protocol and historical result are preserved in `../archive/comparison/EVALUATION.md` and `../archive/comparison/STATUS.md`. Frozen local comparison runs remain in `runs/` (ignored).

For current work, hold storyboard, media, timing, font assets, canvas, FPS and quality constant; compare output identities and inspect actual images/audio before comparing render time. Separate cold compilation, warm compilation, native render, mixing and review. The native output report gives total render/finish wall time, not isolated engine throughput.
