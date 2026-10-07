# Checkout at night: one brief, composed and adapted

A 30-second film built for one specific brief from library pieces, each adapted to it. It was curated by hand to show composition and adaptation; it is not agent output, and its causes and services are illustrative.

**The brief:** "Checkout slowed down every night for a month. For the engineering all-hands, show what we found, what we changed and why it is faster, in under 30 seconds."

| Beat | Narration | Picture | Library piece and how it was adapted |
|---|---|---|---|
| `search` | "Every **night**, checkout slowed to a crawl, so we went looking. First, stale **logs**. Then a retry **storm**. Then a **cron** job. **Lights** on." | A torch sweeps a dark storeroom, finds three things in turn and labels each, then the lamps come on and a thread joins them. A slow push into the room runs throughout. | `searchlight`: the words from the brief (`sketchText`), five moments on the voice (`sketchSay`), plus a `dolly` of the beat's own. |
| `turn` | "It was **one** problem, not three." | A colour-block statement on the accent, entered with a panel transition. | A `statement` with `tone: accent`. It is the punctuation that breaks a run of three drawings, which critique flags. |
| `fix` | "Each order hopped between six services. We **pulled** them into one path, and now it **flows**." | Scattered cards and crossing curves glide into one row; a clean line draws through them and a packet flows along it. | `untangle`, **copied and adapted beyond its slots**. Its six cards carry this checkout's own pieces: a cart, logs, the database, the cron clock, retry settings and done. See below. |
| `result` | "So checkout **skips** the waits. Both **leave** together, at the same speed. The new path is there **first**." | The old route winds through four waiting clocks; the direct one draws across; two trailed tokens race at the same speed, and the direct one arrives first. A push lands on the race. | `shortcut`: words, cues and a `dolly` on "leave". It claims fewer steps, never a measured speed-up. |

## Copying a sketch to change its picture

The words and moments of a sketch are slots. Its objects are not, so this film copies the drawn elements and edits them in [build.mjs](build.mjs):

```js
import { sketch } from '../../film/sketches.mjs';
const { elements } = sketch('untangle', 'vertical', { text: { BEFORE: 'Six hops', AFTER: 'One path' }, say: { UNTANGLE: 'pulled', FLOW: 'flows' } });
// swap each card's icon for this checkout's pieces, then use props.elements instead of props.sketch
```

By hand, `node engine/cli.mjs sketch untangle --vertical` prints the same elements to paste and edit. Copy once per frame shape. Change only what the brief needs; here that is the six objects, while the motion that tells the story stays as drawn.

## Checks

- **`check`:** both shapes report 0 errors and 0 warnings (893 frames each, about 8.5 s to render on this Mac).
- **Critique:** the cinema score is 100/100.
- **`qa`:** three "picture barely changes" advisories remain:
  - the dark search before the first find, about 4 s (the torch sweeps on "night", and the voice reaches the first cause at about 5.5 s);
  - the colour-block statement, a deliberate hold of about 3 s;
  - the sparse race, where trails make the motion legible on the phone sheet.

## Make it

```sh
node examples/checkout-at-night/build.mjs     # writes storyboard-{landscape,vertical}.json
mkdir -p build/night && cp examples/checkout-at-night/storyboard-vertical.json build/night/storyboard.json
node engine/cli.mjs draft build/night && node engine/cli.mjs qa build/night
```
