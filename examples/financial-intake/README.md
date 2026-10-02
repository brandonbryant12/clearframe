# Portable financial intake

This invented source and brand kit demonstrate the input boundary. Add your own approved PNG/JPEG/WebP logo or artwork to the kit's `assets` list, with paths relative to `brand.json`.

```sh
node engine/cli.mjs start build/cash-intake \
  --idea 'Explain why cash timing matters' \
  --document examples/financial-intake/report.md \
  --brand examples/financial-intake/brand.json \
  --playbook cash-flow --audience 'Business owners' \
  --takeaway 'Follow availability, not just the month-end balance'
node engine/cli.mjs critique build/cash-intake
# Read the brief and rewrite the sample beats for your real source before production.
# This fixture deliberately uses the cash-flow playbook's same illustrative arithmetic.
/Users/brandon/.local/bin/codex-heavy -- env CLEARFRAME_HEAVY_HELD=1 \
  node engine/cli.mjs pipeline build/cash-intake --draft --scale 0.5
```

The draft has local synthetic narration. It uses no provider APIs. Half-resolution output keeps the same layout, frames and audio clock. Final renders still use authored resolution. See [production workflow](../../docs/production.md), [intake](../../docs/intake.md) and [financial playbooks](../../docs/financial-playbooks.md).
