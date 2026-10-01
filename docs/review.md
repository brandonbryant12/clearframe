# Honest review protocol

ClearFrame's score in `docs/scorecard.md` comes from an independent reviewer: a fresh agent that did not build the work and judges only the rendered evidence. The builder never grades their own work. The loop runs until the reviewer's overall score reaches **4.9 out of 5**.

## Each round

1. `node scripts/bench.mjs` scaffolds and drafts the benchmark films from scratch. It writes `build/bench/REPORT.md` with each film's cinema score and check result, a contact sheet and a strip of decoded frames around every cut. It also writes the draft mix's loudness and a waveform image with the cuts (grey) and sound cues (orange) marked. The draft voice is local TTS and the bed is synthesised: judge the mix's structure, not the voice's timbre.
2. A fresh reviewer agent reads this page, the dimension table in `docs/scorecard.md`, `build/bench/REPORT.md`, and every sheet and strip. Sound is judged from the benchmark's loudness numbers and waveforms (cuts and cues marked). A real final counts as evidence only if it was rendered after the benchmark. It doesn't read the code, the changelog or the builder's notes.
3. The reviewer scores each of the 15 dimensions from 1 to 5 in half points, with the evidence for each score. It names the five issues that most block 4.9.
4. The builder records the scores in the scorecard log, fixes the weakest dimensions, commits, and starts the next round.

## The bar

Score against professional work in the same category, not against earlier ClearFrame:

| Score | Means                                                                                                                  |
| ----- | ---------------------------------------------------------------------------------------------------------------------- |
| **5** | Indistinguishable from top studio work: Apple keynote films, Kurzgesagt, Vox, a feature-film trailer house, Saul Bass. |
| **4** | Strong professional work that a demanding client would accept. The flaws are only visible to an expert.                |
| **3** | Competent but visibly templated or flawed. A client would ask for changes.                                             |
| **2** | Amateur, or slides with motion.                                                                                        |
| **1** | Broken.                                                                                                                |

The overall score is the mean of the 15 dimensions. A dimension the reviewer cannot judge from the evidence (sound, from stills) is scored from the measurements and the sound design described in the evidence, and the reviewer says so. Generosity defeats the purpose: if a frame would embarrass a professional, it costs the dimension at least a point.

## Reviewer prompt

> You are a senior motion-design director reviewing a video system's output for a client. Read docs/review.md (this protocol), the dimension table in docs/scorecard.md, then build/bench/REPORT.md and every image it lists (use your Read tool on each sheet, strip and waveform). Open full-size frames (build/bench/NAME/build/review-*/ or render one with `node engine/cli.mjs still DIR --draft --beat ID --pos 0.6`) wherever a thumbnail is too small to judge. Score each of the 15 dimensions 1–5 in half points against the bar in docs/review.md, citing specific frames. Then give the overall mean, and the five issues that most block a 4.9, most important first, each with the frames that show it. Be exacting: you are protecting the client's reputation, not encouraging the builder.
