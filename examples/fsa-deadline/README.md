# FSA deadline: the plan says it, then you do it

A 30-second benefits film whose evidence is the plan document itself and whose step is done in the app. It is the worked example for three pieces: a canvas `document` (a page of real text that scrolls to the clause the voice reads), `marks` on that text (the clause highlighted and the amount circled as they are said), and a `pointer` that presses each control by id. Captions are on, as on every narrated film. Everything (Kestrel, the plan, the figures) is fictional.

| Beat | Narration (moments in bold) | Picture | Piece |
|---|---|---|---|
| `stakes` | "You have three **thousand** two hundred dollars in your flexible spending account. On **December** thirty-first, only six hundred forty **carries** over. The rest is gone." | Five coins fill the jar; year end drops a line through it; one coin is kept, four are lost | `expire` (`total 5, keep 1, each 640`) |
| `plan` | "It is all in your plan document. **Up** to six hundred **forty** dollars carries over. **Anything** above that you have not claimed is **forfeited** at the end of the plan year." | The plan document scrolls to Carryover and circles "640 dollars", then to The deadline and highlights "forfeited at the end of the plan year" | `document` with `scroll` and `marks` |
| `claim` | "So claim it before then. Open **Benefits**, choose **Claims**, add your **receipt**, and press **Submit**." | The pointer (a fingertip on the tall frame) presses Benefits, then Claims; the receipt card rises; it is pressed; Submit, and "Claim sent" | `pointer` with four `steps` |
| `close` | "Claim it by **December thirty-first**." | Poster type, built word by word | `kinetic` stack |

`node examples/fsa-deadline/build.mjs` writes `storyboard-landscape.json` and `storyboard-vertical.json` from one storyboard. Copy one into a project directory as `storyboard.json` and run `node engine/cli.mjs draft DIR`.

## What to copy

- **Quote the document, don't paraphrase it on a card.** The `document` holds the plan's own sections; the voice reads the clause while it is marked. Nothing is placed by coordinates: the renderer lays the paragraphs out and finds the words.
- **Give every control an id.** The `pointer` goes to `benefits`, `claims`, `receipt` and `submit` by id, arrives just before each word, rests beside the label, and the control dips as it is pressed. Move a button or change its label and the pointer follows.
- **Keep the page off the caption band.** The page stops above the source line; captions sit below it, or move to the top for a caption whose picture has type in the bottom band.

## Checks and limits

- Drafted with the local OS voice; no synthesis was paid for. `check` passes in both frames.
- The figures come from the fictional plan document named in each beat's source line.
