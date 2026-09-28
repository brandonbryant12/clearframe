---
name: clearframe-script
description: Write narration and beat structure for professional explainer, update and short-form videos — structures, hooks, writing for the ear, pacing math, vocal points (the word each visual lands on), Gemini TTS style + voice casting, and phrases to avoid. Use when drafting or editing the `vo` lines of a ClearFrame storyboard or any voiceover script.
---

# Writing the script

The script is the spine. Visuals are timed to it and the voice is generated from it. Write it first, in `storyboard.json`, one beat per idea.

## Pick a structure

| Structure | Use for | Beats (in order) |
|---|---|---|
| **Explainer** | a concept people misunderstand | Hook (surprising framing) → Intuition → Mechanism → Example → Implication → Recap |
| **Update** | results, status, a period in review | Headline number → Context (vs target / last period) → 2–3 drivers → What to watch → Next steps |
| **Decision** | a proposal, a trade-off | The problem → Cost of doing nothing → Options → Recommendation → The ask |
| **How-to** | a process | The outcome → 3–5 steps → The common mistake → Checklist |
| **Myth-buster** | a widespread wrong belief | The belief → Why it's intuitive → The evidence → The better model → A rule of thumb |

Every structure ends the same way: a **recap or verdict** (hold it 4–6 s), then the **source / next step** card (3–4 s).

## The hook (first ~3 seconds)

Lead with content, never a logo, a greeting or "In this video". Proven openings:
- **The number:** "Seventy percent." Then the tension: "It sounds like a sure thing."
- **The contradiction:** "Our fastest team ships the least code."
- **The stakes:** "This one setting decides how long every customer waits."
- **The question they already have**, stated better than they would.

## Writing for the ear

- 8–14 words per sentence. One idea per sentence. Subject, verb, object.
- **One idea per beat.** 5–15 words per beat and 45 at most (`clearframe check` flags more).
- No parentheticals, no nested clauses, no lists longer than three.
- Concrete over abstract: "three launches in ten slip", not "a meaningful minority of outcomes deviate".
- Round the numbers you say ("about thirty-seven times"). Show the exact figure on screen.
- Name the source aloud for the one or two figures that matter: "according to last quarter's survey".
- Put the payoff at the end of the sentence, which is where the voice lands stress naturally.
- Contrast is the engine of explanation: *not X, but Y*; *before / after*; *said / happened*.

## Pacing math

- Calm professional narration runs at **140–160 wpm**, and 150 is the default. A 60 s film is about 125–140 spoken words once pauses and holds are counted.
- Leave air: ~0.6–1.0 s of silence **before the main takeaway** (use `<short pause>`). The pause is what makes it land.
- Beats last 3–5 s in professional pieces. Social cuts run 2–3 s; don't copy that pace for serious content.
- The engine derives every beat's length as `lead + voice + tail`. Defaults are 0.25 s + voice + 0.6 s. Raise `tail` on beats whose visual needs time to be read (charts, recaps).

## Vocal points: where picture meets word

Each beat has a **landing word**: the word the key visual hits on. Write it where the stress falls, then land the visual with `b.say('word')` in the scene module. Rules:
- Keep one landing word per beat and at most two.
- Start the reveal 0.1–0.2 s **before** the word, so the settle coincides with the stress.
- `say()` matches the text as written. If you wrote "seventy", match `'seventy'`, not `'70'`. A missing word logs a warning and falls back to the start of the line.
- Numbers you want *heard* a specific way should be written the way they're spoken ("twenty twenty-six", "a quarter point"). Simple figures can stay as digits, and they read better in captions.

## Delivery markup (Gemini 3.8 TTS)

The text is spoken **verbatim**; stage directions in the text will be read aloud. Steer delivery with:
- **`voice.style`** in the storyboard: a short, constant descriptor applied to every line. Good: `calm, measured, quietly confident`. Bad: a paragraph of director's notes, which causes voice drift.
- **Per-beat `style`** only for a deliberate shift, e.g. `slower, softer` for the takeaway.
- **Inline tags:** `<short pause>`, `<long pause>`, `<breath>`. Use them sparingly; they're stripped from captions and timing math. Avoid performative tags (`<laugh>`, `<sigh>`) in professional pieces.
- **Emphasis:** word order and punctuation first. CAPS forces stress, but it shows up in captions, so use it only when captions are off.
- Ellipses and `--` create hesitation. Avoid them unless hesitation is the point.

## Voice casting (prebuilt Gemini voices)

| Tone | Voices |
|---|---|
| Informative, neutral (default) | **Charon**, Rasalgethi, Sadaltager (knowledgeable), Schedar (even) |
| Clear, precise | Iapetus, Erinome |
| Warm, reassuring | Sulafat, Achird (friendly), Vindemiatrix (gentle) |
| Firm, authoritative | Kore, Orus, Alnilam |
| Mature, grounded | Gacrux |
| Lively (launches, internal hype, used sparingly) | Laomedeia, Puck, Sadachbia |

Accent, age and gender are properties of the *voice*, not the style string: pick the voice that fits. List them all with `node skills/gemini-tts/scripts/tts.mjs --list-voices`.

## Language to avoid

- Hype: revolutionary, game-changing, unlock, supercharge, seamless, cutting-edge, "the future of".
- Filler: "In today's fast-paced world", "Let's dive in", "It's no secret that", "Imagine a world".
- Promises about uncertain outcomes ("will", "guaranteed"). Use calibrated verbs: *tends to, about, likely*.
- Triumphal "we" and slogans. Viewers of the viral AI videos called this out as slop.
- Pithy lines strung together with no argument between them. Each beat must *follow* from the last. Read the `vo` lines alone, in order: they should make a complete argument without the pictures.
- Repeating the same point in new words. If a beat adds nothing, delete it.

## Self-check before recording

1. Read only the `vo` lines top to bottom. Is it a coherent argument a listener could follow with eyes closed?
2. Does the hook land in ≤ 3 s, and does the ending give a clear verdict?
3. Does every number have a source in `storyboard.sources`, or is it labelled hypothetical?
4. `clearframe voice --draft` then `clearframe timing`: are all beats between 2 and 8 s, at 140–165 wpm?
