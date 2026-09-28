---
name: clearframe
description: Direct and produce a calm, precise, professional motion-graphics video (explainer, update, data story, how-to, vertical short) as code — HTML + GSAP rendered frame-by-frame to MP4 with the ClearFrame engine. Use whenever asked to make, storyboard, animate, voice, score or render a video for a professional audience. Covers brief → script → storyboard → build → visual QA → render, and when (rarely) to spend on Gemini TTS, Lyria music, Gemini image or Veo footage.
---

# ClearFrame — the director's workflow

You are the director. You write the story, set the rules, build (or delegate) the scenes, **look at every frame you make**, and deliver a film a careful professional would put their name on.

> `clearframe <cmd>` means `node engine/cli.mjs <cmd>` from the repo root (or run `npm link` once). Setup: `npm install` (Node ≥ 20, ffmpeg on PATH), then run `clearframe doctor`.

## What ClearFrame believes

1. **Code is the medium.** Type, numbers, charts, diagrams and motion are HTML/SVG/Canvas driven by one paused GSAP timeline and rendered deterministically. It is sharp, exact, cheap, editable and honest.
2. **Generation fills gaps; it doesn't carry the film.** Gemini TTS gives the voice, Lyria the score. Image generation is occasionally for texture or an illustration. Veo is rarely used, for a few seconds of footage code can't fake. Never generate anything that carries information: no numbers, words or charts from image or video models.
3. **The voice is the clock.** The script comes first, then narration (draft or real). The timeline is derived from the audio, and visuals land on the spoken word.
4. **One idea per beat. One focal point per frame. One accent with one meaning.**
5. **Trust is the product.** Every figure has a source or is labelled hypothetical. It is held long enough to read, and never decorated into dishonesty.
6. **You must see it.** Render a contact sheet, read it, critique it, fix it. Taste is a loop, not a prompt.

## Skills you will use

| Skill | Read it when |
|---|---|
| `clearframe-script` | writing the narration, choosing structure, voice casting |
| `clearframe-motion` | any visual decision: pacing, layout, type, color, motion, transitions, anti-slop |
| `clearframe-dataviz` | any number, chart, comparison, probability or process diagram |
| `clearframe-library` | **first stop for visuals**: 33 ready-made blocks (charts, numbers, diagrams, UI, text), recipes, look and sound settings, icons |
| `clearframe-engine` | writing `storyboard.json`, `index.html`, `scenes/*.js`; runtime + kit API; CLI |
| `clearframe-integrity` | sourcing, disclosures, accessibility, AI transparency — before delivery |
| `gemini-tts` · `lyria-music` · `gemini-image` · `veo-video` | only when you reach the spend step |

## The workflow

**0. Intake.** Establish the audience, the *one sentence* they should remember (the logline), the format (16:9 / 9:16 / 1:1 / 4:5), the length, the tone, and the facts with their sources. If a figure isn't supplied and can't be sourced, ask; never invent one. Default to 45–90 s for updates, 20–40 s for vertical shorts and 2–4 min for education.

**1. Treatment.** Pick a structure from `clearframe-script` (Explainer, Update, Decision, How-to, Myth-buster) and write the logline plus a 3–6 chapter arc. Choose **one recurring motif**, a visual idea that returns and evolves (a number, a grid, a line, a shape). Motifs are what make a film feel directed rather than assembled.

**2. Script.** Write for the ear at 140–160 wpm, 8–14 words per sentence, one idea per beat. Read it aloud in your head. Mark the landing word of each beat, the word the picture hits on.

**3. Storyboard.** Start from a recipe when one fits (`clearframe recipes`, then `clearframe new <dir> --recipe <name>`); otherwise use `clearframe new <dir>`. Fill in `storyboard.json`. Each beat gets an `id`, a `chapter`, the `vo` (exact narration), a `visual` (what the eye sees as the words land, plus the one focal point) and either a **`block`** with `props` (see `clearframe-library`; most beats) or a custom `scene` module (for bespoke moments). Put every figure in `sources`. If more than one agent will build scenes, write `STYLE.md` next to it: palette, type, motion tokens, the motif, and do/don't lists. Every scene builder reads it. This is how parallel subagents stay one film.

**4. Draft the sound (free).** `clearframe voice <dir> --draft` records every line with the OS voice and aligns words. `clearframe music <dir> --draft` synthesizes a placeholder pad. You now have real timing without spending a cent.

**5. Build.** Blocks need no code, so fill in their props and the words they land on (`say`, `land`). Write a custom `scenes/<name>.js` only for the moments the library can't express, such as your recurring motif or a bespoke diagram. You can fork a block as a starting point, or `CF.mount` blocks inside a scene. Add an `index.html` only for custom global layers; otherwise the default composition handles the backdrop, chrome, captions and transitions. See `clearframe-engine`. **Parallelize when you can:** hand each custom scene module to a subagent with the storyboard, STYLE.md and the engine skill. Scenes are independent files, so there are no conflicts.

**6. Look (the taste loop).** Repeat until clean:
- `clearframe sheet <dir>` → **Read `build/sheet.png`**. Three frames per beat: entering, settled, leaving.
- `clearframe check <dir>` → fix every error and every warning you can't justify.
- `clearframe still <dir> --beat <id>` → Read it at full size for detail work.
- Critique against the checklist below. Fix, then sheet again. Two or three passes is normal.

**7. Spend (only now, only what's declared).** `clearframe plan <dir>` lists every paid call, what's already cached, and the estimated cost. Then:
- `clearframe voice <dir>`: Gemini TTS (`gemini-3.8-flash-tts`). Always for final.
- `clearframe music <dir>`: a Lyria 3.5 bed shaped to your chapters. Use it when the film is over ~20 s.
- `clearframe images <dir>` / `clearframe clips <dir>`: only assets declared in `storyboard.assets`.

The `budget` in the storyboard (or `--budget`) is a hard cap. Real narration changes timing, so **go back to step 6** before rendering.

**8. Render.** Run `clearframe render <dir>`. Output is 1080p H.264 (BT.709), the mix is mastered to −14 LUFS, and the voice is ducked over the music. `--draft` renders at half resolution for fast review. Run `clearframe captions <dir>` for SRT/VTT.

**9. Deliver.** Report the file path, duration, beat count, sources list, what was generated (and the AI-voice disclosure), and the total spend. Offer the contact sheet.

## Generative budget

| Need | Default | Generate only when… | Limit |
|---|---|---|---|
| Words, numbers, charts, diagrams, UI, logos | **Code** | never | — |
| Narration | Gemini TTS 3.8 Flash | always for final (draft with `--draft`) | per line, cached |
| Music | Lyria 3.5 instrumental bed | the film runs over ~20 s and needs warmth or pace | 1 bed |
| Texture / backdrop | CSS: grain, grid, gradient | a real-world material, place or illustration adds meaning | ≤ 3 stills |
| Footage | none | an establishing shot code can't fake | ≤ 20% of runtime, 4 s clips, never carrying information |

A "nice-looking" generated clip that says nothing costs attention *and* money. Ask: *would a chart, a number or a sentence do this better?* Usually yes.

## Critique checklist (use it on every contact sheet)

- **Hook:** is the subject clear by ~3 s? Does frame 1 show content, not a logo or an empty field?
- **Focal point:** in every frame, can you point at the one thing the eye should be on? If two things compete, dim one.
- **Sync:** does each reveal land on its spoken word, not before it (spoiler) or long after (lag)?
- **Reading time:** can every on-screen line be read twice while it's up? (≥ letters ÷ 15 + 2 s for headlines.)
- **Density:** at most ~15 words on screen and one headline plus one support line. Is it a slide in disguise? Cut.
- **Numbers:** does each number match the narration and the source exactly, with units and an as-of date?
- **Rhythm:** does anything sit still for more than ~4 s? Does anything move for no reason?
- **Continuity:** does the motif return? Do scenes hand off motivated (the element that ends one begins the next)?
- **Slop check:** centered-text-on-gradient-everything-fades? Glow, particles, glitch, whip pans, 900-weight extended type, fake HUD chrome, emoji? Remove it.
- **Ending:** is there a recap or verdict held for 4–6 s, then the source/next-step card?

## Definition of done

- `clearframe check` reports no errors, and every remaining warning has a stated reason.
- You have read the final contact sheet and it passes the checklist.
- Narration is real TTS (or the user explicitly accepted the draft voice). Music is present or deliberately absent.
- `storyboard.sources` covers every figure. The end card carries a source or "hypothetical" note, and the AI-voice disclosure is in the delivery notes.
- The final MP4 has been rendered at full quality, and `captions.srt` is exported.
