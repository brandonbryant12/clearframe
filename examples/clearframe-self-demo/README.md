# ClearFrame self-demo — work in progress

This checkpoint contains the narration and scene plan for a product demo made through
ClearFrame itself, plus a repeatable capture tool at `scripts/demo-captures.mjs`.
The film is still being built and reviewed; this is not a completed demo or acceptance report.

Run the studio, then capture its actual interface into an external output directory:

```sh
node scripts/demo-captures.mjs --out /absolute/path/to/demo-captures \
  --studio http://127.0.0.1:4317 --cdp http://127.0.0.1:9333 \
  --tour FILM_WITH_REVIEW_NOTES --done FILM_WITH_FINAL_RENDER
```

The capture command expects Chrome with remote debugging enabled at the given CDP URL.
Omit `--cdp` to let the tool launch a temporary headless Chrome. Use the film ids from your
studio. The review film needs the sample scene and layer used by the capture recipe;
adapt the selectors in the script for a different fixture.

The tool captures real UI states and measured control positions for the film to use.
It opens and cancels the sound approval dialog without making a paid request.
Upload the resulting pictures and `captures.json` with `script.md` through the home page,
then ask ClearFrame to build a rough cut. Keep captures, rendered video and review evidence
outside Git. The final source, full process notes and review results will follow as work continues.
