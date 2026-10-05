---
name: gemini-omni
description: Generate sparse Gemini Omni Flash 1.1 video inserts for a ClearFrame film, using its palette and continuity references while keeping factual graphics and the soundtrack native. Use only when an approved brief needs generated footage.
---

# Gemini Omni inserts

Read `docs/continuity.md` and the official [Omni contract](https://ai.google.dev/gemini-api/docs/omni). The model ID is `gemini-omni-1.1-flash`; `scripts/omni.mjs` implements the Interactions request/MP4 download contract.

Use an insert only when it adds a useful setting, physical visual or atmosphere. Native text, numbers, charts, captions and source labels remain native. Start with a short shot and aim for <=20% generated runtime unless the brief calls for more.

Declare an asset with kind `clip`, prompt, seconds, resolution `720p`, optional one/two image `refs` and optional `previousInteractionId`. Set the root continuity treatment, lighting, camera, movement and motif. The framework adds the palette and shared constraints; reference bytes are hashed for cache invalidation. Two references describe first/last compositions. Keep these within the project and inspect them before generation.

Run `plan`, then `clips DIR --only ID --budget N` only within authorized paid scope. Duration is steered in the prompt; the estimate is not a hard billing cap. Output can be shorter or stylistically wrong. Metadata records actual duration, interaction ID and usage. Do not repeat an uncertain paid call automatically.

Review the take, both joins and the full film. Use native video captions/source labels and a continuous shared narration/music mix; the generated clip's audio is excluded. Never use model-generated labels, data, logos or fabricated evidence. `check` rejects clips too short for the authored duration/offset. Keep the output or choose a shorter beat deliberately.

Choose background (`plate.side: full`) or half-screen (`left|right`) before generating. Request enough footage for the beat plus source offset and handles. Never loop a short take: obtain longer coverage or shorten/restructure the beat. `plan` prints `footage` problems (take shorter than beat + offset, beat longer than one 10 s take, the same seconds shown twice) and `clips` refuses to pay for a take that cannot cover its beats. When a beat outruns one take, cut it into different shots rather than reusing one. For business films request a locked camera and restrained subject motion. Inspect native text over moving footage at the start, middle, end and lighting changes, both full size and 360 px; blur is not a contrast guarantee. Use a scrim or opaque panel, or switch to split placement. Record this review before advancing beyond the rough cut. See the B-roll section in `docs/continuity.md`.
