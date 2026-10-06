# Prompts and selections, exactly as entered

Everything the person typed or chose in the studio while making this film, in order. Nothing here
was sent by any other route. The agent's replies are kept in the OpenCode session (not committed).

## 1. Home page (new film)

| Field | Value |
|---|---|
| Title | ClearFrame, made with ClearFrame |
| The idea | A 60–75 second product demo that teaches a new person how to direct a film in the ClearFrame studio while staying in control: describe the film, choose how to collaborate, point at exactly what to change, edit by hand, review, check sound and costs, export. Follow script.md scene by scene. The interface pictures are real captures in assets/uploads/; captures.json gives every control's measured position for pins and focus regions. |
| Format | Landscape 16:9 |
| Kind of film | Show a workflow and its payoff (playbook `product-walkthrough`) |
| Look | Let the agent choose |
| How should the agent work? | Make it for me |
| Who it is for | People new to ClearFrame who want to make explainer films |
| What they should remember | You direct; the agent builds; nothing changes or costs money without you. |
| Sources and pictures | `script.md`, `captures.json` and the 15 PNG captures listed in it |

**First message** (composed by the home page from the form and sent as the conversation's first
message; scope: whole film):

```text
Make this film: A 60–75 second product demo that teaches a new person how to direct a film in the ClearFrame studio while staying in control: describe the film, choose how to collaborate, point at exactly what to change, edit by hand, review, check sound and costs, export. Follow script.md scene by scene. The interface pictures are real captures in assets/uploads/; captures.json gives every control's measured position for pins and focus regions.
Title: ClearFrame, made with ClearFrame
Format: landscape 16:9
Audience: People new to ClearFrame who want to make explainer films
Takeaway: You direct; the agent builds; nothing changes or costs money without you.
Starting structure: Show a workflow and its payoff
Files I gave (script.md, captures.json, conversation-column.png, deliver-panel.png, home-modes.png, layer-inspector.png, home.png, review-thread.png, scope-composer.png, conversation.png, sound-approval.png, deliver.png, layer.png, review.png, sound-panel.png, scope.png, sound.png) are in the project: documents as source/document.md, source/original.md (summarised in BRIEF.md and EVIDENCE.md), pictures and media in assets/uploads/conversation-column.png, assets/uploads/conversation.png, assets/uploads/deliver-panel.png, assets/uploads/deliver.png, assets/uploads/home-modes.png, assets/uploads/home.png, assets/uploads/layer-inspector.png, assets/uploads/layer.png, assets/uploads/review-thread.png, assets/uploads/review.png, assets/uploads/scope-composer.png, assets/uploads/scope.png, assets/uploads/sound-approval.png, assets/uploads/sound-panel.png, assets/uploads/sound.png. Read the documents with clearframe_files before writing; tie every number to its source.

The project "ClearFrame, made with ClearFrame" starts from a playbook with sample scenes, narration, numbers and sources. Replace all of it with this film's own: rewrite or replace every scene and its narration, remove sample figures and sources, keep it a film rather than slides, and group the work into a few clearly labelled edits. Where a picture is not designed yet, mark that scene "placeholder" with what it should become; never leave sample content.
Start with clearframe_guide topic authoring (short). Then make the first cut I can watch: queue a rough cut with clearframe_render (kind draft), follow it with clearframe_job until it finishes, fix any engine errors it reports and queue it again if needed. Finish by telling me briefly what the cut contains, which scenes are placeholders, and what you need from me.
```

