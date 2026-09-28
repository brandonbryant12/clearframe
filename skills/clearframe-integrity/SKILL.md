---
name: clearframe-integrity
description: Accuracy, sourcing, disclosure, accessibility and AI-transparency standards for professional videos made with ClearFrame — how to source and date every figure, label hypotheticals, write balanced claims, size and hold footnotes, caption, disclose synthetic voice/imagery, avoid rights problems, and run a pre-delivery review. Use before delivering any video, and whenever a script makes a factual or numeric claim.
---

# Integrity: make it trustworthy

Professional audiences forgive plain design. They don't forgive a wrong number. The most common criticism of 2026's viral AI-made videos was that nobody fact-checked them. ClearFrame treats verification as part of the render.

> This is a general professional standard, not legal advice. If your organisation works under specific rules for public communications, route the storyboard and final render through that review. The storyboard plus its `sources` list is designed to be the audit trail.

## 1. Every figure has a source

- Record each one in `storyboard.sources`: `{ "claim": "Revenue grew 42%", "source": "FY2026 annual report, p.12", "asOf": "2026-06-30" }`.
- Keep figures in `data.json`, not typed into scenes (see `clearframe-dataviz`).
- Put a **source line on screen** for every data scene (`kit.source`), with the period or as-of date.
- **Illustrative numbers are labelled on screen** ("Hypothetical illustration"), in the footnote *and* the storyboard.
- Round honestly. Precision should match the source, and "about" in the narration is fine when the screen shows the exact figure.
- Check narration against the screen: the number spoken, the number shown and the number in `sources` must agree.

## 2. Claims are balanced

- If you state a benefit, state its material limitation or risk with similar prominence (size, duration, position). Don't leave it only in a fine-print footnote.
- Use no guarantees or promissory language about uncertain outcomes. Use calibrated verbs (*likely*, *about*, *tends to*).
- Use no superlatives ("best", "fastest", "#1") without a named, dated basis on screen.
- Comparisons name what's compared: the same period, the same basis, the same units.
- Past results are not presented as predictions.

## 3. Disclosures people can actually read

- Body size must be ≥ 24 px at 1080p (`clearframe check` enforces it) with contrast ≥ 4.5:1. Never use `--dim` for a disclosure.
- Hold time is at least `words ÷ 3 + 1` seconds, and never under 2.5 s. `kit.footnote` returns this number, so make the beat at least that long.
- If a disclosure is required, say it in the narration too, not only on screen.

## 4. Accessibility

- Export captions for every deliverable (`clearframe captions`). Burn them in for vertical and social (`kit.captions`).
- Never encode meaning in colour alone. Pair colour with a sign, an arrow or a label.
- No flashing: nothing faster than 3 flashes per second, and no full-frame strobes.
- Narration should describe the key visual ("the line doubles by year three"), so the film works for listeners too.

## 5. AI transparency

- **Voice:** Gemini TTS is synthetic. Say so in the delivery notes and, where the audience would care, in the end card or description ("Narration: AI-generated voice").
- **Imagery and footage** from Gemini image, Lyria and Veo carry SynthID watermarks. Don't strip or obscure them, and label generated imagery when it could be mistaken for real documentation.
- **Never** generate or imitate real people (faces or voices), real logos, real documents, receipts, screenshots or data "evidence". Never clone a real person's voice without explicit consent.
- Generated visuals are **illustration, never evidence**.

## 6. Rights

- Fonts ship with the engine under open licences (Inter, Instrument Serif, JetBrains Mono, Fraunces: SIL OFL).
- GSAP is distributed under its Standard "no charge" licence (<https://gsap.com/standard-license>). It is free for almost every use, but read it if you're building a product that competes with Webflow's visual tooling. ClearFrame installs it from npm and doesn't redistribute it.
- Don't prompt music "in the style of" a named artist. Lyria blocks it, and you shouldn't want it.
- Only use brand assets (logos, marks, colours) the requester owns or is authorised to use.

## 7. Pre-delivery review (do all of it)

1. `clearframe check <dir>` shows 0 errors, and the missing-sources warning is resolved.
2. Read the `vo` lines in order and underline every factual claim. Each one appears in `sources`.
3. Read the final contact sheet: each on-screen number matches `sources` and the narration.
4. Hypotheticals are labelled on screen, and the source or as-of line is present on every data scene.
5. Footnotes and disclosures meet size and hold time.
6. `clearframe captions` has been exported. Vertical deliverables have captions burned in.
7. The delivery message lists the sources, what was AI-generated (voice, music, images, footage) and the spend.
