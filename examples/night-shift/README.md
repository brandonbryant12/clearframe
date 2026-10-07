# Night shift

A 25-second study, curated by hand as a capability demonstration (not the output of the studio agent). It tells a small story in one continuous picture. At 2:14 a.m. a report slips out of someone's phone and travels to the one person awake. She opens it: the report grows into the whole screen, and the screen becomes the code that fixes it, the real lines from commit `f0bcc0b`. The report comes back as a check, travels home and folds into the phone. By 6:00, nobody knows it broke.

| Beat | Narration | Picture |
|---|---|---|
| `two` | "Two in the morning." | The time set huge over a dark room: a lamplit desk drawn by hand, a person, a phone. The phone lifts twice. An intentional hold. |
| `report` | "A report slips out of someone's phone and finds the one person awake." | A bubble splits out of the phone (`split`), then travels up to her along a pen route (`travel`, `via`). |
| `dive` | "She opens it." | The camera leans toward the report (`camera`), and the report fills the screen in amber (`fill`). |
| `code` | "One stray comma, and the line that drops it." | Not a cast scene: a stage that holds only code, on the amber the fill hands it (tone and cut set by the job). It shows lines 34–39 of `tools.mjs` read from git at `f0bcc0b`, landing on "comma". A hold for reading. |
| `back` | "Back on her desk," | The report shrinks back out of the amber onto her desk (`emerge`) and the camera settles. It is its own scene because the flood has to draw over everything. |
| `fixed` | "it turns into the fix, then travels home." | She works at it and it becomes a check on "fix" (`swap` `by`; she is drawn over what she works on). She straightens up, and the check travels home on "home". The cut from `back` is invisible. |
| `morning` | "By six, nobody knows it broke." | The check folds into the phone (`merge`), and "6:00" settles where "2:14" was. A closing hold. |

## What carries it

- **The same objects and room throughout.** The phone, the person, the desk and the lamplight stay; the report becomes the code, comes back, and becomes the check.
- **A shift of scale and role.** The small amber report becomes the whole screen and then the actual code. The cut into the code scene and the cut back are on one flat colour.
- **Type as story.** "2:14" and "6:00" bookend the night in the same place.
- **Action against stillness.** Two holds frame the night and one holds for reading the code. The moves happen on the words that name them.

Everything is native and reusable: a cast in the `drawn` look on the `ink` palette, composed `phone`, `person` and `bubble` shapes, `split`, `travel`, `camera`, `fill`/`emerge`, `swap` `by`, `merge`, and a code-only `stage` reading git. No generated media and no new primitives.

## Make it

```sh
node examples/night-shift/build.mjs
mkdir -p build/night-shift && cp examples/night-shift/storyboard-vertical.json build/night-shift/storyboard.json
# the code beat reads this repository: point repo at it from the new folder
sed -i '' 's#"repo": "../.."#"repo": "'"$PWD"'"#' build/night-shift/storyboard.json
node engine/cli.mjs draft build/night-shift
node engine/cli.mjs qa build/night-shift
```

## Measured

Measured on the 8 GB iMac, with free local draft voice:

- **Render time.** 747 frames in about 8.5 s in each shape.
- **Phone.** The vertical code is set at 34 px across the full stage width: the commit's real lines, with the two long ones wrapped. It used to be 24 px in a narrower editor.
- **Checks.** `check`: 0 errors in both shapes. Its only warnings say the clock times are digits ("if they are figures, add a source"); they are times, not figures.
- **`qa`.** 0 pops. The hard changes are the fill and the emerge, as intended, and the holds are the reading and closing holds.
- **Critique.** 89.
