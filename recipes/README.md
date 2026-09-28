# Recipes

Complete storyboards built **only from blocks** — no HTML, no scene code. Scaffold one, replace the content with yours, render.

```bash
clearframe recipes                                   # list them
clearframe new my-update --recipe quarterly-update   # copy one
clearframe voice my-update --draft && clearframe sheet my-update   # look at it
```

| Recipe | Format | Shape |
|---|---|---|
| `quarterly-update` | 16:9 · ~60 s | title → kpis → line → bars → timeline → points → end |
| `concept-explainer` | 16:9 · ~70 s | stat hook → statement → waffle → definition → steps → question → end |
| `product-walkthrough` | 16:9 · ~40 s | title → browser (callouts, cursor) → icons → checklist → end |
| `decision-memo` | 16:9 · ~50 s | title → delta → compare → table → statement → end |
| `incident-review` | 16:9 · ~55 s | title → timeline → stat → flow → checklist → end (no music) |
| `research-summary` | 16:9 · ~60 s | title → quote → distribution → ring → points → end |
| `vertical-short` | 9:16 · ~20 s | stat → statement → circles → end (captions on) |

All figures in recipes are **sample data** and say so. Replace them with sourced numbers and update `sources`.
