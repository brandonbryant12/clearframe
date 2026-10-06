# Direction: ClearFrame, made with ClearFrame

Treatment: **midnight** (dark, calm and precise — indigo night with periwinkle, matching the studio itself). Type: default. Motion: gentle, transition fade, handheld off so the captures stay still and readable.

## Audience and takeaway
- Who is watching: people new to ClearFrame who want to make explainer films; interested but wary of losing control to an agent.
- What they should understand afterwards: you direct; the agent builds; nothing changes or costs money without you.

## Reference
- The studio's own interface: flat dark panels, one accent, numbered pins, no decoration. Keep: measured pins/focus taken from `source/captures.json`, quiet captions under each picture. Change: none needed — every picture is a real capture, never redrawn.

## Story spine
- The question the film answers: how do I direct a film in ClearFrame without handing over control?
- The tension: an agent building your film sounds like losing control of scope, edits and spend.
- The turn: scope travels with every message; manual fields and one-step undo stay live; paid sound needs explicit approval.
- The payoff, and the last image: the deliver screen — readiness, the rendered film, the download — then the end card "Describe it. Direct it. Export it."

## Beat plan (follows source/document.md scene by scene)
| Beat | Purpose | Picture | Landing |
|---|---|---|---|
| 01 Title | hook: the film is its own evidence | title block | talking to it |
| 02 Describe | where a film starts | stage · home.mp4 (full-frame clip: typing the brief) | the look |
| 03 Two ways | choose the collaboration mode | stage · modes-2.mp4 (full-frame clip: selects Make it for me, then Build it together, each as its line is spoken) | each step |
| 04 Conversation | runs locally, saved with the film | stage · conversation.mp4 (full-frame clip: saved reply + film status) | happened |
| Stop | you stay in control | stage · stop.mp4 offset 4.3s, 1.0s tail (Stop pressed, composer back at rest) | any moment |
| 05 Scope | point at exactly what to change | stage · scope.mp4 (full-frame clip: agent pins the scene, typing) | refused |
| 06 By hand | your hands stay on the controls | stage · undo.mp4 (full-frame clip: hand edit, ⌘Z, ⇧⌘Z) | undo |
| 07 Review | watch, note, hand over | stage · review.mp4 (full-frame clip: a review note and its Ask the agent link) | the agent |
| 08 Sound | free drafts vs paid generation | stage · sound.mp4 (full-frame clip: takes, draft voice, priced button) | cost money |
| 09 Approval | nothing spends without you | stage · approval-2.mp4 (full-frame clip: approval dialog with a real $0.50 film budget, then cancelled) | budget |
| 10 Export | readiness and download | stage · deliver.mp4 (full-frame clip: Render final, Download) | download it |
| 11 End | takeaway | endcard | export it |

No numbers or prices appear on screen as drawn copy — the only figure is inside the real approval capture itself ($0.50 budget shown in the studio UI), so the spoken line "within the film's budget" is literally true of the picture. Clip scenes draw no title, kicker or caption over the picture — the narration names what is on screen. Every clip is a real 16:9 screen recording of the ClearFrame studio, drawn full-frame (x 0, y 0, w 1920, h 1080, fit contain, hold true) so nothing is cropped. Sound: free local draft narration (OS voice) on every line and a free local draft music bed ducked under it at level 0.22.

## Decisions (one-shot mode)
- `decide DIR r001` — first rough cut taken as the watchable cut: 11 scenes, 63.7s (within the 60–75s brief), free local draft voice bound to every scene, engine check 0 errors. All pictures are real captures; **no scene is a placeholder**.
- Held back pending the person's notes: the music bed (free draft available) and the final full-size render (paid Google voice/music only on explicit approval).
- `decide DIR r004` — replaced the seven small-UI stills with the person's real 16:9 screen recordings (`source/clips.json`, plus home.mp4), added the Stop scene after 04, and rebuilt every clip scene as a full-frame video stage (one video element at x 0, y 0, w 1920, h 1080, fit contain, offset 0, hold true, no overlay text) after r003's band-cropped video block cut off the approval dialog, scope chip and Google button on a phone. Narration and scene order unchanged. Rough cut r004: 960×540, 67.1s (half-size rough; the film itself is 1920×1080).
- `decide DIR r005` — 07 Review converted from the review-thread still to a full-frame `review.mp4` stage, same treatment as the other clip scenes (every product picture is now a real recording). Free draft music bed added under the narration (made on this computer; no Google music requested). Check 0 errors; rough cut r005: 960×540, 65.6s as encoded (film is 1920×1080, 65.6s). Narration as made: 12 lines, take-01 free draft voice (os-tts, unrecorded OS voice — never a Google voice). Music as made: free draft bed, level 0.22, ducked under the voice.
- `decide DIR r006` — fresh review of r005 fixed three things: 03 Two ways now uses the re-recorded `modes-2.mp4` (Make it for me selects as that line is spoken, Build it together as its line is spoken), 09 Approval now uses the re-recorded `approval-2.mp4` showing a real $0.50 film budget so "within the film's budget" is true of the picture, and the Stop scene gained a 1.0s tail with clip offset 4.3 so Stop is visible, pressed and the composer at rest before the cut. Only video files and the Stop timing changed; narration untouched. Check 0 errors; rough cut r006: 960×540, 66.6s as encoded (film is 1920×1080, 66.6s). Sound unchanged from r005: free draft OS voice on 12 lines, free local draft bed at 0.22 ducked under the voice. Paid Google voice/music remain available on explicit approval only.

## Before rendering
- `sheet` at three moments per beat; `critique` for rhythm; a fresh reviewer reads the sheet against BRIEF.md.
