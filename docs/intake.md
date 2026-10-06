# From idea, document and brand to a film

ClearFrame is a standalone, agent-directed proof of concept. Its inputs and outputs are local files, suitable for a future host to call through the CLI. This workflow uses the native renderer (`scene/native`); it adds no HyperFrames dependency, service, browser runtime or Content Studio integration.

```sh
node engine/cli.mjs start film \
  --idea 'What should the viewer understand?' \
  --document report.pdf --brand brand.json \
  --audience 'Business owners' --takeaway 'The decision the evidence supports' \
  --playbook cash-flow --treatment editorial
```

Supply an idea, documents, or both. Repeat `--document` to combine sources. Documents use the existing importer: Markdown, text, HTML, CSV, DOCX/RTF (macOS textutil), or PDF (pdftotext). CSV preserves supplied cells as a table without inferring units. Multiple documents keep their originals and independent reference namespaces under `source/documents/`; the aggregate research brief identifies each source. `--direction ID`, `--vertical`, `--title`, `--theme`, `--seed` and shared `--library DIR` also work. An explicit theme overrides the brand theme; otherwise the brand palette is retained over treatment and seed choices. The brand's type voice and narration style override the treatment. Nothing is generated or purchased during intake.

Use `directions research` or `directions podcast` for contrasting starting forms. They are optional. Override the suggested playbook/treatment independently, author new scenes, or provide a custom direction through `--library DIR`. See [source adaptation](source-playbooks.md).

The destination must be new or empty. Intake validates the inputs and writes to a temporary sibling directory; failure removes the partial project. It never overwrites an existing project.

## A portable brand kit

```json
{
  "name": "Your brand",
  "theme": { "base": "ink", "accent": "#ffb000" },
  "type": "geometric",
  "voiceStyle": "Clear, thoughtful and direct",
  "rules": ["Keep the original logo and its proportions"],
  "assets": [
    { "id": "logo", "kind": "image", "file": "logo.png", "role": "opening or closing identity" },
    { "id": "product", "kind": "clip", "file": "demo.mp4", "role": "approved product footage" }
  ]
}
```

Only `name` is required. `theme` takes a built-in/shared palette or palette overrides. Brand text colours are checked against the background. `type` names an installed type voice; custom font loading is outside this POC. Use a shared library for a reusable palette, type voice or treatment. Shared references used by the film are copied into the project.

Asset paths are relative to the brand JSON, or absolute local paths. PNG/JPEG/WebP images, MP4/MOV clips and WAV/MP3/M4A sounds are copied unchanged into `assets/brand/` under unique IDs. Static self-contained SVG artwork is also accepted on macOS: intake retains its exact original in `source/brand/` and uses `sips` to make a transparent PNG with a maximum side of 2048 pixels. Both files get hashes and a conversion receipt. External references and active content are rejected; SVGs with live text receive a font-review note. Supply an approved PNG on other platforms. `kind` defaults to `image`. The normalized `brand.json` uses copied relative paths, so the project can move without the original kit. Assets are registered in `storyboard.assets`; the director places them using `asset: "logo"` or an appropriate plate. Placement stays a creative decision.

Recording intake also accepts `--brand brand.json`, alongside `--direction` and `--treatment`. It preserves the recording, transcript, word timings and speakers, applies visual brand choices and writes an intake receipt. Brand voice instructions do not replace a real recording. Recording destinations must be new or empty and failures roll back the temporary project.

## The handoff files

| File | Purpose |
| --- | --- |
| `BRIEF.md` | Idea, audience, takeaway, starting arc and next steps |
| `EVIDENCE.md`, `source/research.json` | Document figures, sentences, references, tensions and tables |
| `source/original.*`, `source/document.md` | Original bytes and converted text |
| `BRAND.md`, `brand.json`, `assets/brand/` | Identity rules and portable assets |
| `DIRECTION.md` | Story spine, shot choices and review decisions |
| `storyboard.json` | Renderable illustrative arc for the agent to rewrite |
| `intake.json` | Versioned intake receipt, SHA-256 hashes, asset roles and next stages |

**Intake is preparation, not automatic editorial authorship.** Its status is `starter-needs-direction`. It does not infer approved claims, select a strategy, turn sample figures into the report's results, or place a logo by guessing. The starter keeps its sample attribution; real claims and sources are bound when the agent rewrites its beats. Read the evidence, choose the story and place the assets, then produce a complete draft early.

## Faster review copies

```sh
node engine/cli.mjs preview film --scale 0.5
node engine/cli.mjs draft film --scale 0.5
node engine/cli.mjs qa film
node engine/cli.mjs render film
```

Run full renders/drafts through the local `codex-heavy` gate as described in AGENTS.md. `--scale` accepts 0.25–1 for drafts, default 1. It reduces the output raster, leaving authored coordinates, narration, frame rate, frame count and sound timing unchanged. Dimensions round to even values for H.264; 1080×1350 at 0.5 becomes 540×676. Stills, contact sheets and layout diagnostics keep authored dimensions.

The render receipt records both authored and encoded dimensions, scale, draft state, hashes and elapsed rendering/finishing time. `qa` recognizes a scaled draft only when its receipt matches the actual MP4 hash and current storyboard. It records the review size in `qa.json`. Final rendering rejects reduced scale. A small preview establishes timing and composition; review full-resolution type and assets before delivery.

For a retained production pass use `pipeline DIR --draft --scale 0.5`, then `pipeline DIR` for the final encoder. See [production method and harness](production.md).

Use [the financial fixture](../examples/financial-intake/README.md) for a free end-to-end trial. Future host integration can consume these files; hosted scheduling, storage, access control and model orchestration are separate work.
