# Market update (demo film)

A 42-second narrated market update assembled from the [finance chart templates](../finance-charts/README.md): a title, a headline figure, purchasing power, annual returns, the return distribution and an end card, in the `ledger` palette.

```sh
node examples/market-update/build.mjs            # or: build.mjs vertical
node engine/cli.mjs voice examples/market-update --draft    # free local voice for timing
node engine/cli.mjs music examples/market-update --draft    # free local bed
node engine/cli.mjs render examples/market-update --draft
node engine/cli.mjs viewer examples                         # browse its versions
```

`voice` and `music` without `--draft` use Gemini TTS and Lyria (run `plan` first for the cost). All figures are illustrative; replace them, the titles and the source with real, attributable data before publishing. Renders and versions stay in the ignored `build/` and `review/` folders.
