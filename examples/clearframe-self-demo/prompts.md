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


## 2. Together: one scene, proposal first

After watching rough cut r001. In the Agent column: **Build it together**. In the scene list: scene
"06 By hand", then **Ask the agent** in the inspector (scope: that scene).

```text
This picture is a tall, narrow column and reads tiny, especially on a phone. Propose how to make it readable without changing the narration, and wait for my answer.
```

The agent asked to run a shell command to read the picture's size; **Deny**. It proposed without
changing anything. Quick reply button:

```text
Yes — go with your recommendation.
```

Then **Undo these edits** on the change card (the scene went back exactly) and ⇧⌘Z to restore it.

## 3. A review note, handed to the agent

Review layout; scene "Conversation" selected; **+ Note**; clicked the picture. Note by "Demo director":

```text
On a phone this screenshot is unreadable: the UI is a quarter of the frame. Show the conversation itself big.
```

**Ask the agent** on the note (scope: the note), **Make it for me**:

```text
Fix this note: use the conversation close-up (assets/uploads/conversation-column.png) for this scene so the conversation fills the frame and reads on a phone. Keep the narration. Then render a still of the scene to check it.
```

## 4. The same fix, whole film

Scope menu: **Whole film** (still Make it for me):

```text
Good. Do the same for the other scenes whose screenshot is small: Scope (scope-composer.png), Review (review-thread.png), Sound (sound-panel.png) and Export (deliver-panel.png) — use the close-up so the UI reads on a phone; pins only where they still point at something in the close-up. Keep the narration. Then render a new rough cut and tell me when it is ready.
```

## 5. Together: the tall close-ups

Assets → **Add files…**: the second capture pass's `captures.json` (saved as `source/captures-2.json`,
with each close-up's crop and the pins measured inside it). **Build it together**, scope Whole film:

```text
r002 reads much better in the wide close-ups (Scope, Review). The tall ones still read small: Conversation, By hand, Sound and Export are tall columns in a wide frame, and their pins sit at the centre instead of on the controls. I added the capture manifest again (source/captures-2.json): each close-up now has its crop and the pins measured inside it. Propose how to make these four scenes readable on a phone, for example the beat camera pushing in on the part each line talks about, using the measured pins. Keep the narration. Wait for my answer; after it, apply and render a new rough cut.
```

The agent proposed (nothing changed before the answer). Quick reply: `Yes — go with your recommendation.`
The engine refused the render (the push threw the annotate legend off-frame); the agent ran a check
instead of rendering blind and asked the person to choose between three options.

## 6. Recorded clips instead of zoomed screenshots

Assets → **Add files…**: `modes.mp4`, `conversation.mp4`, `scope.mp4`, `undo.mp4`, `stop.mp4`,
`sound.mp4`, `approval.mp4`, `deliver.mp4` and `clips.json` (from `scripts/demo-clips.mjs`). Still
Build it together, Whole film:

```text
None of the three exactly. I recorded short 16:9 screen clips of the real controls at 2×, so they fill the frame with real pixels and no zoom; they are in assets/uploads and source/clips.json says what each one shows: modes.mp4 (switching modes), conversation.mp4 (a saved reply and its film status), scope.mp4 (Ask the agent pins a scene, then typing), undo.mp4 (a hand edit, ⌘Z, ⇧⌘Z), stop.mp4 (a request sent, then Stop), sound.mp4 (takes, free draft voice, priced Google button), approval.mp4 (the approval dialog opened and cancelled) and deliver.mp4 (Render final, Download). Use them as video scenes, fit cover, no camera push and no pins, in place of the pictures in 03 Two ways (modes), 04 Conversation, 05 Scope, 06 By hand (undo), 08 Sound, 09 Approval and 10 Export, keeping each scene's narration and title; drop the camera pushes that failed. After 04, add one short scene for stop.mp4 with the narration "And you can stop it at any moment." Keep 02 and 07 Review as they are. Check, then render a new rough cut.
```

The agent answered with eight clip scenes and the stop scene, checked (the conversation clip was at
first shorter than its estimated beat; binding the real draft narration fixed it) and rendered r003.

## 7. Full-frame clips (Make it for me)

Assets → **Add files…**: `home.mp4`. In the Agent column: **Make it for me**, scope Whole film:

```text
r003 is a big step: the clips read. One problem on a phone: the video block draws each clip in a wide band above its title, so fit cover crops the top and bottom off. Approval never shows the dialog, Scope shows the reply instead of the scope chip, and Sound cuts off the Google button. Make every clip scene a full-frame stage instead: one video element at x 0, y 0, w 1920, h 1080, fit contain (the clips are exactly 16:9, so nothing is cropped), offset 0 and hold true (the clip holds its last frame once the action ends), with no title, kicker or caption drawn over it; the narration names what is on screen. Replace the picture in 02 Start with what you want with home.mp4 (just added: a person typing the brief) the same way. Keep the narration and the order. Check, then render a new rough cut and tell me its actual size and length.
```

## 8. The review scene and the music bed (Make it for me)

Assets → **Add files…**: `review.mp4`. Make it for me, Whole film:

```text
r004 reads on a phone. Two last things: make 07 Watch, note, hand it over a full-frame clip stage like the others, with review.mp4 (just added: a review note and its Ask the agent link), and add the free draft music bed under the narration (no Google music). Check, then render a new rough cut and tell me its actual size, length and what the narration and music actually are.
```

## 9. A hand edit (no agent)

Watching r005: the stop scene (1.7 s) ended before the clip reached its Stop press. Design layout,
scene "Stop", layer 0 (the video), the **offset** field: typed `4.7`, ⌘Enter. One undo step
("Change elements offset in Stop"), engine clean.

## 10. Close the note, render the final

Review: **Resolve…** on note n001 (fixed in r002–r004), name `Demo director`, **Resolved**.
Deliver: **Render final**. No Google sound: the final keeps the free draft narration and music bed.
