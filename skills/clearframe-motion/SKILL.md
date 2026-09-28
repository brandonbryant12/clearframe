---
name: clearframe-motion
description: The ClearFrame visual doctrine for calm, precise, professional motion graphics — pacing numbers, composition, typography, color, motion tokens, voice sync, transitions, texture, orientation chrome, scene blueprints and an explicit anti-slop list derived from what made 2026's viral code-rendered videos land (and what critics hated). Use for any visual or timing decision in a ClearFrame video.
---

# Motion doctrine

**The look in one sentence:** an editorial page that thinks in time. There is a quiet neutral field, a confident serif for statements, a clean grotesk for information and a mono for facts, with one accent colour that means one thing. Motion settles instead of bouncing, and every movement answers the narration.

This is deliberately calmer than the viral social reels. It keeps their best ideas (motif, rhythm, exact numbers, voice sync) and drops their tics (glow, whip pans, slogans). See `docs/research/` for the evidence.

## 1. Pacing

| | Professional (default) | Social / vertical |
|---|---|---|
| Beat length | 3–5 s | 2–3 s |
| Hook | subject clear by 3 s | by 1.5 s |
| Headline hold | ≥ letters ÷ 15 + 2 s | ≥ letters ÷ 15 + 1.5 s |
| Title / recap card | 4–6 s | 3–4 s |
| Source / end card | 3–4 s | 2–3 s |
| Counter lands → hold | ≥ 2 s | ≥ 1.2 s |
| Silence before the key takeaway | 0.6–1.0 s | 0.3–0.5 s |
| Longest stillness | ~4 s (`check` flags more) | ~2.5 s |

**Rhythm is contrast.** Alternate dense and spare beats: build, hold, release. A film where every beat has the same energy feels long even when it's short.

## 2. Composition

- **One focal point per frame.** If two things compete, dim one to 30–40% opacity or remove it.
- **The accent covers ≤ 5% of pixels and carries one meaning** (e.g. cobalt = the thing we're talking about). Everything else is ink, ink-2 and line.
- **Scale contrast:** the hero element is 4–6× body size. A big number next to a small label reads instantly.
- **Left-aligned for reading** (lists, charts, arguments). **Centred only for single statements** (a number, a question, a title card). A film that is centred throughout is the "default AI look".
- **Stay inside the safe area.** Landscape keeps 6% sides and 8% top and bottom. Vertical keeps 11% top and 20% bottom, where platform UI and captions go. Press `S` in preview to see it.
- Use negative space as a signal: an empty half-frame beside a number is a choice, not a gap.

## 3. Typography

| Role | Face | Size @1080 | Notes |
|---|---|---|---|
| Statement / hero | Instrument Serif | 120–440 px | ≤ 6 words; tight tracking (−0.02em) |
| Headline | Inter 600 | 56–80 px | sentence case; ≤ 40 characters per line |
| Body / labels | Inter 420–500 | 30–42 px | never below 24 px (`check` flags it) |
| Facts, units, sources, kickers | JetBrains Mono | 22–30 px | uppercase + 0.14em for kickers |
| Changing numbers | Inter 600 `.cf-num` | any | **tabular figures**, or the digits jitter |

- At most ~15 words on screen. Use one headline plus one support line.
- **Setup small, payoff big**: a small mono kicker ("100 launches · same forecast") above a large statement.
- Emphasis comes from **one word** in the accent colour or italic serif, never a whole sentence.
- Italic serif for the human word ("not"). Mono for the machine fact ("as of Sep 2026").

## 4. Colour

Use the themes in `cf.css`: `paper` (default light, cobalt), `ink` (its dark twin), `ember` (dark, amber), `editorial` (newsprint, vermilion), `slate` (navy, mint) and `signal` (ink/bone/one hazard orange).
- Semantic `--up` / `--down` exist, but **never rely on colour alone**. Pair it with a sign (+/−), an arrow or a label.
- Text contrast should be ≥ 4.5:1. Dim (`--dim`) is for chrome, never for content.
- One theme per film. Changing the theme mid-film means a chapter change, and only if you mean it.

## 5. Motion grammar (tokens in `CF.kit.tokens`)

| Move | Duration | Ease | Distance |
|---|---|---|---|
| Enter (text, cards) | 0.5–0.6 s | `power3.out` | 16–24 px rise + fade |
| Exit | 0.3 s | `power2.in` | fade, −8 px |
| Word stagger | 40–60 ms/word | — | — |
| List/bar stagger | 80–120 ms/item | — | — |
| Scene transition | 0.4–0.6 s | `power3.inOut` | fade / rise / push |
| Camera drift per scene | whole beat | `none` | scale 1.00 → 1.03 |
| Counter | 1.0–1.5 s | `power3.out` | — |
| Line / bar draw | 0.8–1.6 s | `power2.inOut` | — |
| The one "snap" moment (hero number) | 0.6 s | `expo.out` | masked rise |

- **One easing family.** Entrances settle, exits get out of the way, moves are smooth. Use linear only for progress and time.
- **One thing moves at a time.** Sequence reveals in reading order; don't scatter them.
- **Exits are quicker and quieter than entrances.**
- **Nothing is ever perfectly still for long.** A 3% drift or a slow grid is enough, and ambient motion should be felt, not seen.
- Scale pops stay ≤ 1.04, with no bounces on text. `back.out` is only for small markers (dots, pins).

## 6. Sync with the voice

- Land reveals **on the spoken word**: `kit.reveal(el, b.say('seventy') - 0.15)`.
- **A spoiler is worse than lag.** Don't show the answer before the narrator asks the question.
- **J-cut:** the next scene's picture may arrive 0.2–0.4 s before its line (`lead`). **L-cut:** hold the picture 0.5–1 s after the line ends (`tail`) so it can be read.
- Keep captions in the bottom safe zone for vertical and optional for landscape. Always export SRT (`clearframe captions`).

## 7. Transitions

Prefer **motivated continuity**: the element that ends a scene becomes the start of the next. The "70%" shrinks and becomes a heading, a row of tiles becomes a grid, a line becomes an axis. When there's no natural bridge:
- `fade` or `rise` (0.5 s) between chapters
- `push` for sequence (step 1 → step 2)
- `wipe` for before/after
- a hard cut on a strong beat. A cut is a transition too; don't fade everything.

Never use glitch, whip pans, zoom-blur, spins, shakes or "light leaks".

## 8. Texture and chrome

- **Grain** at 6–9% overlay, **vignette**, and a faint **grid or dot field** drifting at 2–6 px/s. Remove any of them and the frame feels synthetic; exaggerate them and it feels like a filter.
- **Orientation layer:** a chapter label (mono, top-left), `02 / 05` (top-right) and a thin progress rail. Mark it `data-ambient data-safe="margin"`.
- **No fake chrome:** no timecodes, crop marks, "REC" dots or scanlines unless the film is *about* cameras.

## 9. Scene blueprints

| Blueprint | Recipe |
|---|---|
| **Number reveal** | Kicker enters (0.05 s) → hero number rises out of a mask on the spoken word (`expo.out`, 0.6 s) → caption line reveals by words → slow 2.5% drift. |
| **Unpack the number** | Hero shrinks up (`power3.inOut`, 0.9 s) → units appear (tiles, waffle) → the meaningful subset takes the accent on its word → label. |
| **Countable probability** | 10×10 waffle blooms from the centre → fill n in ink → fill the rest in accent → counters beside it. |
| **Build a chart, then point** | Axes (0.5 s) → data draws (1–1.6 s) → dim context → mark the point with a ring and label → takeaway line. |
| **Before / after** | Old claim reveals → strike-through on the word "not" or "wasn't" → dim to 40% → new claim rises beneath with the key phrase highlighted. |
| **Step rail** | Boxes appear in sequence with connectors drawing between them → focus each step as it's named → the rail persists as orientation. |
| **Recap** | Numbered rows, each entering on its spoken phrase; hold 1–1.5 s after the last. |
| **End card** | Title in serif (masked word reveal) + source/footnote in mono at the bottom, held ≥ 3 s. |

## 10. Anti-slop list (don't)

1. Centred text on a gradient with everything fading in: the "default look".
2. Neon, cyberpunk, glowing brains, particle swarms, lens flares, "Matrix rain", holograms.
3. Glitch, whip-pan, shake, spin or zoom-blur transitions.
4. Extended 900-weight display type everywhere; all-caps paragraphs.
5. Fake HUD chrome: timecodes, crop marks, REC dots, random hex codes, "SYSTEM ONLINE".
6. Scale pops above 1.05, elastic or bounce on text, everything moving at once.
7. Text walls (> 15 words), text on screen for less time than it takes to read twice.
8. Generated images or video containing text, numbers, charts, logos, UI or people's faces.
9. Stock clichés: handshakes, lightbulbs, rockets, puzzle pieces, chess pieces, arrows hitting targets.
10. Triumphal slogans, collective "we", emoji.
11. Music-only films with no argument. If there's no narration, the on-screen text must carry a real argument.
12. A slide deck with transitions. If every beat is "title + bullet list", rethink the visuals.
