# What made 2026's code-rendered videos land, and what ClearFrame took from them

*Research compiled 2026-09-27. View counts are snapshots from that day. Items marked (unverified) could not be confirmed from a primary source. Clip lengths, cut rates and loudness figures were measured from downloaded preview files with ffprobe, ffmpeg scene detection (threshold 0.3) and EBU R128.*

## Context

Claude Opus 5.5 launched on 2026-09-22. Within days, feeds filled with motion-graphics videos it had written as code: HTML/CSS/SVG/Canvas animated with GSAP, p5.js or three.js, captured frame by frame in headless Chrome and encoded with ffmpeg. None were generative video. The model outputs text, and the "video" is a program.

## Case study: the "p(doom)" videos

The viral p(doom) video is a **music video** for the song *"I'm Upping My P(doom)"*: lyrics by osmarks and Claude, first generated in Udio in 2024. It became a chain of remakes, all made with Opus 5.5 in Claude Code in September 2026.

- **John Heibel (@other__reality), Sep 22.** The canonical code-rendered version, ~2.5M views. [post](https://x.com/other__reality/status/2102514581684052169) · [repo](https://github.com/JohnHeibel/PDoomVideo)
  - **Stack:** p5.js + p5.brush for a watercolour look. `studio.html` is rendered in headless Chrome by a Node `render.mjs` with parallel workers, then encoded with ffmpeg.
  - **Human direction was minimal.** Opus wrote its own `STORYBOARD.md` and an `ANIMATION_GUIDE.md` that served as a **style guide for parallel subagents**, one per chapter.
  - **Pacing:** 88 BPM, shots 1.4–4 s. "Put the important action on beat times." "Every shot has a push, pan, tilt, whip, zoom-out or on-beat shake." Transitions are motivated match-cuts.
  - **The number is a prop, not an overlay.** A painted thermometer is pumped each chorus: 8 → 34 → 61 → 86 → 99.9%.
- **Donald Jewkes (@donaldjewkes), Sep 23.** About 3.2M views: a ~9.5k-character voice-dictated prompt plus 12 hours of work. It layered JS "papery" animation over generated clips and added self-verification loops: watch the video, screenshot, iterate. [prompt](https://x.com/donaldjewkes/status/2102801469976248500) (how much generated footage survived to the final cut is unverified).
- **mexicat.** A three.js kinetic-typography version. [repo](https://github.com/mexicat/pdoom-video)
  - **Palette:** ink `#0A0A0B`, bone `#EEE9DF`, one hazard orange `#FF4D12`.
  - **Type:** Archivo, IBM Plex Mono, Cormorant italic.
  - **Motion and sync:** word-level karaoke from forced alignment, hard cuts on downbeats, "holds then snaps" (outExpo) easing.
  - **The number** blows up full-screen and rolls 0.02 → 0.99 → NaN.
  - **Banned list:** neon cyberpunk, glowing brains, Matrix rain, lens flare.

**Shared traits:** one escalating number as the spine, cuts on the beat, a recurring character or motif, deterministic rendering (no `Math.random()`, every frame a pure function of `t`), and explicit rejection of "AI slop" looks.

## Other widely shared examples (Sep 2026)

| Video | Length | Notes |
|---|---|---|
| "Western civilization / PROMETHEUS" (@IterIntellectus) | 136 s | ~13.4M views. Flash-forward cold open; setup line plus large payoff word; ~2.6 s mean cut; music only. Model version unconfirmed. |
| "15-second motion designer showreel" meme (5+ posters) | 15 s | One-line prompt. **Converged on the same look:** lone vermilion dot on near-black, heavy grotesk, mono HUD corners, "Claude." lockup. |
| "How browsers work in 40 seconds" (@addyosmani) | 40 s | 16 labelled stages (~2.5 s each). Two alternating visual registers, story versus mechanism. |
| History of AI, "Attention → AGI" (@kimmonismus) | 180 s | Remotion, ~7.4k lines. Narrated at ~165 wpm within phrases, median 1.5 s pause between lines. Zero hard cuts: one continuous camera. |
| "muda" startup launch (@deedydas) | 26 s | Waffle grid of GPU utilisation 31% → 76% → 94%, ticking counters, word-by-word headlines; ~$2 and ~1 minute. |
| Negroni recipe (@Ror_Fly) | 30 s | One focal glass, persistent 6-step progress rail. **More bookmarks than likes**, which signals practical reuse value. |

## Measured craft patterns

- **Pacing:** social pieces run 2–3 s per beat (measured mean cut intervals of 1.5–3.2 s). Narrated explainers slow to ~4 s per line.
- **Hooks** are content in frame 1: a flash-forward, a running timer, a character mid-action. Never a logo.
- **Text:** headlines of 2–6 words held ~2–3 s. One community director's guide codifies **hold ≈ letters ÷ 15 + 1.5 s** and title cards ≥ 4 s.
- **Colour:** across 350 classified motion videos, neutral canvases dominate: light `#EFEDE9` (~65% of pixels) or dark `#131315`. **Accents sit at ~2–4% of pixels.**
- **Type pairings:** grotesk + italic serif + tiny mono; classical serif + mono; plain grotesk + mono labels. **Mono is near-universal** for dates, units and sources.
- **Data forms:** unit/waffle grids, ticking counters, step rails with fill bars, self-drawing lines, node graphs, a persistent progress or timeline rail.
- **Audio:** most viral pieces were music-only (loud, −12 to −13 LUFS). Narrated ones used Gemini TTS, ElevenLabs, edge-tts or Kokoro, with the voice ~10 dB over the music.

## What critics called slop

- "Without a reference, opus falls back to its default look: **centered text, gradient background, everything fading in**" ([@rexan_wong](https://x.com/rexan_wong/status/2103707054108299437)).
- **Too fast to read**, and **flashy slide decks** that "look good but aren't very informative" and "kept repeating the same point" ([HN thread](https://news.ycombinator.com/item?id=49836374)).
- **Pithy sayings strung together** without an argument.
- **Triumphal "we"** and omissions in history pieces.
- **No fact-check pass** ([OrcaRouter](https://www.orcarouter.ai/blog/claude-opus-5-5-code-rendered-ai-history-film)).
- **Visible AI-ness** reads as unprofessional.

**Praised:** a real storyline and direction, recurring motifs, practical formats (recipes, how-tos), and tasteful restraint. The consistent lesson was that good results come from references, storyboards, style guides and review loops.

## How ClearFrame encodes this

| Finding | ClearFrame default |
|---|---|
| Opus wrote STORYBOARD + ANIMATION_GUIDE for parallel subagents | `storyboard.json` + optional `STYLE.md`; one scene module per file so subagents can't collide |
| Deterministic, seek-based rendering | One paused GSAP timeline, `__CF.seek(t)`, seeded `rand()`, a warm-up pass, a stray-tween warning |
| Self-verification loops made the difference | `clearframe sheet` (contact sheet to read), `still`, `check` (automated taste and safety QA) |
| One escalating number as the spine | Number-reveal and "unpack the number" blueprints, chained `kit.counter().to()` |
| Waffle grids, counters, step rails, progress rails | `kit.waffle`, `kit.counter`, `kit.steps`, orientation chrome in the examples |
| Neutral canvas, accent at 2–4% | Themes with one accent; the doctrine caps it at ≤ 5% with one meaning |
| Mono for facts | `.cf-kicker`, `kit.source` in JetBrains Mono |
| Word-level sync | Voice-first timing, silence-detected phrase alignment, `b.say('word')` |
| "Default look" and slop tics | An explicit anti-slop list; `check` flags walls of text, stillness and tiny text |
| Too fast to read | Professional pacing: 3–5 s beats, hold ≥ letters ÷ 15 + 2 s, 140–160 wpm |
| No fact-check | `sources` with as-of dates, `data.json` binding, the integrity skill's pre-delivery review |
| Music-only, −13 LUFS | Narration-led, music ducked under voice, −14 LUFS master |

## Sources

- p(doom): [Heibel repo](https://github.com/JohnHeibel/PDoomVideo) ([ANIMATION_GUIDE](https://github.com/JohnHeibel/PDoomVideo/blob/main/ANIMATION_GUIDE.md), [STORYBOARD](https://github.com/JohnHeibel/PDoomVideo/blob/main/STORYBOARD.md)) · [mexicat repo](https://github.com/mexicat/pdoom-video) ([TREATMENT](https://github.com/mexicat/pdoom-video/blob/main/docs/TREATMENT.md)) · [original song](https://www.youtube.com/watch?v=uEB5E67vcPA)
- Round-up: [OfficeChai](https://officechai.com/ai/claude-opus-5-5-motion-graphic-videos/) · dataset: [awesome-opus-5-5-videos](https://github.com/athemeroy/awesome-opus-5-5-videos) ([colour modes](https://github.com/athemeroy/awesome-opus-5-5-videos/blob/main/docs/color-modes.md), [statistics](https://github.com/athemeroy/awesome-opus-5-5-videos/blob/main/docs/statistics.md))
- Posts: [IterIntellectus](https://x.com/IterIntellectus/status/2103212539895017864) · [stephanlivera](https://x.com/stephanlivera/status/2103315922098470926) · [addyosmani](https://x.com/addyosmani/status/2103009037164110327) · [kimmonismus](https://x.com/kimmonismus/status/2102844654169575547) · [deedydas](https://x.com/deedydas/status/2102787937482252537) · [Ror_Fly](https://x.com/Ror_Fly/status/2102853258582880547) · [rexan_wong](https://x.com/rexan_wong/status/2103707054108299437) · [arambarnett](https://x.com/arambarnett/status/2104011150471917838)
- Discussion: [Hacker News](https://news.ycombinator.com/item?id=49836374) · [OrcaRouter](https://www.orcarouter.ai/blog/claude-opus-5-5-code-rendered-ai-history-film) · [Lemo-Opuscar director guide](https://github.com/lemomo-ai/lemo-opuscar)
- Frameworks: [HyperFrames](https://github.com/heygen-com/hyperframes) · [Remotion](https://github.com/remotion-dev/remotion) · [Motion Canvas](https://github.com/motion-canvas/motion-canvas)
