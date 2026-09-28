# AGENTS.md

This repository is **ClearFrame**, a harness for making calm, precise, professional motion-graphics videos as code. If you are an AI agent asked to make, edit or render a video here, follow this file.

## Start here

1. Read `skills/clearframe/SKILL.md`, the director's workflow. It routes you to the other skills.
2. Load the others as you need them:
   - `skills/clearframe-script/SKILL.md`: narration
   - `skills/clearframe-motion/SKILL.md`: visual doctrine and anti-slop
   - `skills/clearframe-dataviz/SKILL.md`: numbers and charts
   - `skills/clearframe-engine/SKILL.md`: storyboard, scene modules, runtime, CLI
   - `skills/clearframe-integrity/SKILL.md`: sources, disclosures, review
   - `skills/gemini-tts`, `skills/lyria-music`, `skills/gemini-image`, `skills/veo-video`: paid generation, only when needed

## Commands

```bash
npm install                                   # once (Node ≥ 20, ffmpeg on PATH)
node engine/cli.mjs new <dir> --template explainer|vertical
node engine/cli.mjs voice <dir> --draft       # free timing; drop --draft for Gemini TTS
node engine/cli.mjs music <dir> --draft       # free placeholder; drop --draft for Lyria
node engine/cli.mjs sheet <dir>               # then READ <dir>/build/sheet.png
node engine/cli.mjs check <dir>               # fix errors; justify or fix warnings
node engine/cli.mjs plan <dir>                # cost before spending
node engine/cli.mjs render <dir> [--draft]
npm test
```

## Rules

- **Look at your work.** After building or changing scenes, render the contact sheet and read the image before claiming anything looks good.
- **Never invent figures.** Every number on screen or in narration comes from the user, `data.json` or `storyboard.sources`, or is labelled hypothetical on screen.
- **Never generate information.** Image and video models make textures and plates only, never text, numbers, charts, logos or real people.
- **Spend deliberately.** Run `plan` first and respect `storyboard.budget`. Don't use `GEMINI_API_KEY` unless the user wants final-quality generation.
- **Determinism.** Every tween goes on the master timeline `tl`. Use no `Math.random`, `Date.now` or timers. Never tween a property that a `CF.onFrame` function also writes.
- **Parallelize scenes.** If you can spawn subagents, give each one scene module plus `storyboard.json`, `STYLE.md` and the engine skill.

## Repo map

- `engine/`: CLI (`cli.mjs`), Node libs (timing, server, render, audio, inspect, generate), browser runtime (`runtime/cf.js`, `cf-kit.js`, `cf.css`)
- `skills/`: Agent Skills (`SKILL.md` + scripts). Also installable as a Claude Code plugin.
- `examples/`, `templates/`: complete projects
- `schema/storyboard.schema.json`: the storyboard schema
- `docs/`: research and API contracts
- `test/`: `node --test`
