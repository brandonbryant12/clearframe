# A pull-request film from real history

A 47-second explainer of ClearFrame commit `92b0762` ("Keep stages and code editors inside the frame they are shown in"), made with the same tools it fixes. Use it as the reference for a PR film: problem, mechanism, change, the code itself, the check, and the limits, each with a different kind of picture in one visual language.

| Beat | Picture | What carries the story |
|---|---|---|
| `symptom` | A drawn phone whose code runs past its edge, then the audit's finding | A question as the hook; the defect shown, not described |
| `cause` | A film stage: three actors in a wide frame; the frame turns tall and the outer two go red | The same actors persist into the next beat |
| `relayout` | The same actors move into a column inside the tall frame and turn green | Identity across the cut (film `stages`) |
| `measure` | The code editor reading `scene/code.mjs` at `92b0762`, lines 118–124 | Commit-grounded code; on the vertical cut the long lines wrap, which is the fix |
| `checked` | Before and after: 8 audit findings → 0 | Recorded numbers with their source on screen |
| `fits` | The same phone, its code now set by the fitted editor, with the limit beside it | A bookend that ends on the picture, not a card |

## Evidence

Every figure is from a recorded run, and the sources on screen say which:

- **8 → 0 findings.** `clearframe check --draft` on `examples/stage-pr` re-shaped to vertical: 1 error ("code cut off by the frame edge") and 7 title-safe warnings at `b2b7540`; none at `92b0762` (its only notes are the adaptation notes).
- **3 new tests.** `node --test test/stage-fit.test.mjs` at `92b0762`: 3 of 3 pass.
- **The code.** Read from git at render time (`code: {commit, file, window}`); the plan records the commit and blob ids.
- **The limits.** Stated in the commit and in the last beat: the fit keeps order, not exact placement, and a slow camera push can still drift edge text on vertical films.

The phone in `symptom` and `fits` is an illustration of the defect drawn natively, not a screenshot of a render.

## Make it

```sh
node examples/pr-film/build.mjs          # writes storyboard-landscape.json and storyboard-vertical.json
mkdir -p build/pr-film && cp examples/pr-film/storyboard-vertical.json build/pr-film/storyboard.json
# the code beat reads this repository: point repo at it from the new folder
sed -i '' 's#"repo": "../.."#"repo": "'"$PWD"'"#' build/pr-film/storyboard.json
node engine/cli.mjs critique build/pr-film
node engine/cli.mjs draft build/pr-film  # free local draft voice; renders go to build/
node engine/cli.mjs qa build/pr-film     # open build/pr-film/build/qa/phone.png
```

Measured on the 8 GB iMac (warm renderer cache): first draft pass 42.8 s (the free local voice is most of it), 14.0 s of rendering; a re-draft with the voice cached 15.3 s. `check`: 0 errors, 0 warnings in both shapes; critique cinema score 78.

## Adapting it

Keep the order of questions (what broke, why, what changed, the code, how it was checked, what it does not do) and replace every picture with your PR's own: actors from your architecture, `code: {commit, file, window}` from your repository, numbers from your own runs. Don't keep a beat whose evidence you don't have. `library/playbooks/pr-walkthrough.json` scaffolds the diagram beats (failing sequence, change, states); add the code, check and limits beats from here.
