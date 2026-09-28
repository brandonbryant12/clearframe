# Block reference

_Generated from each block's `meta` by `clearframe blocks --md` — do not edit by hand._

Use a block by naming it on a beat: `{ "id": "…", "block": "<name>", "vo": "…", "props": { … } }`. Text props accept `*emphasis*` (accent) and `**strong**`. Any prop called `say` / `land` / `…Say` is a word from that beat's narration: the visual lands on it.

## `bars`

Bar comparison — bars grow in, then everything but the story dims and a note lands.

**Use:** Compare 2–8 values. Horizontal automatically when labels are long or the frame is vertical. Bars start at zero.

**Holds** 1.3 s after the last word by default.

| prop | meaning |
|---|---|
| `data` | [{ label, value }] (finite, nonnegative) |
| `format` | { prefix, suffix, decimals } or a suffix string like '%' |
| `focus` | { label \| index, say, note, dim (0–1, default 0.28), dur (seconds, default 0.5) }; index refers to displayed order after sorting |
| `growSay` | word that starts the growth |
| `orientation` | 'auto' \| 'vertical' \| 'horizontal' |
| `sort` | 'none' \| 'desc' |
| `kicker` |  |
| `title` |  |
| `source` |  |
| `max` | positive axis max, at least the largest value |

Defaults: `{"orientation":"auto","sort":"none"}`

```json
{ "id": "bars", "block": "bars",
  "vo": "Wait time does not grow in a straight line. At ninety percent busy, work waits nine times longer than at half capacity.",
  "props": {
    "title": "Wait time *vs.* how busy you are",
    "data": [{"label":"50% busy","value":1},{"label":"80% busy","value":4},{"label":"90% busy","value":9},{"label":"95% busy","value":19}],
    "format": "×",
    "growSay": "grow",
    "focus": {"label":"90% busy","say":"ninety","note":"9× the wait"},
    "source": "M/M/1 queue model — illustrative"
  } }
```

## `browser`

Product / UI walkthrough — a browser window (your screenshot, HTML, or a built-in mock) with spotlight callouts, a cursor that clicks, optional zoom-ins.

**Use:** Feature explainers, onboarding, "where to click". Real screenshots are best; never fake a real company's UI.

**Holds** 1.2 s after the last word by default.

| prop | meaning |
|---|---|
| `url` | address bar text |
| `image` | screenshot path (e.g. assets/img/app.png) |
| `html` | or inline HTML for the page |
| `mock` | 'dashboard' \| 'list' \| 'form' \| 'doc' (skeleton UI when you have no screenshot) |
| `callouts` | [{ x, y, w, h (0–1 of the page), label, say, click: true, zoom: false }] |
| `kicker` |  |
| `title` |  |

Defaults: `{"mock":"dashboard","url":"app.example.com"}`

```json
{ "id": "browser", "block": "browser",
  "vo": "Open the forecast panel, and look at the confidence band. Then set the buffer from the planning menu.",
  "props": {
    "url": "app.example.com/plan",
    "mock": "dashboard",
    "callouts": [{"x":0.27,"y":0.2,"w":0.7,"h":0.44,"label":"Confidence band","say":"confidence"},{"x":0.02,"y":0.36,"w":0.2,"h":0.08,"label":"Planning","say":"planning","click":true}]
  } }
```

## `calendar`

Calendar heatmap — weeks × days of activity, filled column by column; outline a streak or a gap.

**Use:** Habits, deploy frequency, incidents over time. The shape of a year at a glance.

**Holds** 1.2 s after the last word by default.

| prop | meaning |
|---|---|
| `values` | array of 0–4 levels (week-major, 7 per week) or 'demo' |
| `weeks` | 26 |
| `streak` | { from, to, label, say } (week indices) |
| `legend` | true |
| `startLabel` |  |
| `endLabel` |  |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"weeks":26,"legend":true}`

```json
{ "id": "calendar", "block": "calendar",
  "vo": "Deploys used to cluster at the end of each month. Since July, they happen every single day.",
  "props": {
    "title": "Deploys per day",
    "values": "demo",
    "weeks": 26,
    "streak": {"from":17,"to":25,"label":"Daily since July","say":"since"},
    "startLabel": "Apr",
    "endLabel": "Sep",
    "source": "Sample data"
  } }
```

## `chapter`

Chapter divider — a big number, a drawn rule, the chapter name.

**Use:** Films over ~90 s. Gives the viewer a map. Hold 2–3 s.

**Holds** 0.9 s after the last word by default.

| prop | meaning |
|---|---|
| `number` | '02' |
| `title` | chapter name |
| `subtitle` | optional line |

Defaults: `{"number":"01"}`

```json
{ "id": "chapter", "block": "chapter",
  "vo": "Part two: the mechanism.",
  "props": {
    "number": "02",
    "title": "The mechanism",
    "subtitle": "Why waiting grows faster than load"
  } }
```

## `chat`

Chat thread — messages arrive in order (with a typing indicator for replies), the thread scrolls as it grows.

**Use:** Support conversations, assistant interactions, Slack-style decisions. 3–6 short messages. Use fictional names.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `messages` | [{ from: 'me' \| name, text, say }] |
| `me` | the sender shown on the right (default 'me') |
| `kicker` |  |
| `title` |  |

Defaults: `{"me":"me"}`

```json
{ "id": "chat", "block": "chat",
  "vo": "A customer asks when their order ships. The assistant checks, answers with a date, and flags the risk.",
  "props": {
    "messages": [{"from":"me","text":"When will my order ship?","say":"asks"},{"from":"Assistant","text":"Checking your order #4821…","say":"checks"},{"from":"Assistant","text":"It ships **Thursday** — there’s a 30% chance it slips to Friday.","say":"answers"},{"from":"me","text":"Thanks for the heads-up!","say":"flags"}]
  } }
```

## `checklist`

Checklist — items listed, then ticked (or crossed) as they are spoken.

**Use:** How-tos, readiness reviews, requirements. 3–6 items.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ text, say, state: 'done' \| 'fail' \| 'todo' }] |
| `kicker` |  |
| `title` |  |

```json
{ "id": "checklist", "block": "checklist",
  "vo": "Before launch: the forecast is calibrated, the rollback is tested, and the on-call rota is set. The load test is still open.",
  "props": {
    "title": "Launch readiness",
    "items": [{"text":"Forecast calibrated","say":"calibrated"},{"text":"Rollback tested","say":"rollback"},{"text":"On-call rota set","say":"rota"},{"text":"Load test complete","say":"load","state":"todo"}]
  } }
```

## `circles`

Magnitude circles — areas proportional to value, side by side on a baseline.

**Use:** "How big is X next to Y" when the ratio is large (10× and up). Label every circle with its value.

**Holds** 1.4 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ label, value, tone, say }] |
| `format` | { prefix, suffix } or '×' |
| `kicker` |  |
| `title` |  |
| `source` |  |

```json
{ "id": "circles", "block": "circles",
  "vo": "One percent better every day compounds to about thirty-eight times better in a year.",
  "props": {
    "title": "One year of daily 1% changes",
    "items": [{"label":"Where you started","value":1,"tone":"dim"},{"label":"1% better daily","value":37.8,"tone":"accent","say":"thirty"}],
    "format": "×"
  } }
```

## `code`

Code walkthrough — an editor panel; lines type or fade in, then highlighted ranges step through with notes.

**Use:** Technical explainers, API how-tos, changelogs. ≤ 16 lines; highlight 1–3 ranges; say what each does.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `code` | source text |
| `lang` | 'js' \| 'ts' \| 'py' \| 'sql' \| 'go' \| 'sh' \| … |
| `filename` | shown in the title bar |
| `highlight` | [{ lines: '3-5' \| [3,5], say, note }] |
| `type` | false — true types the code in |
| `kicker` |  |
| `title` |  |

Defaults: `{"lang":"js","type":false}`

```json
{ "id": "code", "block": "code",
  "vo": "The whole change is two lines: we read the forecast, and we plan for the miss explicitly.",
  "props": {
    "filename": "plan.ts",
    "lang": "ts",
    "code": "export function plan(forecast: number) {\n  const p = clamp(forecast, 0, 1);\n  const miss = 1 - p; // the thirty\n  return {\n    commit: p >= 0.7,\n    buffer: Math.ceil(miss * 10), // days\n  };\n}",
    "highlight": [{"lines":"2","say":"read","note":"Read the probability"},{"lines":"3","say":"miss","note":"Name the miss"}]
  } }
```

## `compare`

Side-by-side comparison — two cards (A vs B) whose points land one by one; the recommended side highlighted.

**Use:** Decisions and trade-offs. Same criteria on both sides, in the same order. Put the verdict in the narration.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `left` | { tag, title, value, valueLabel, points: [text \| { text, mark: 'check'\|'x'\|'dot', say }] } |
| `right` | same shape |
| `highlight` | 'left' \| 'right' \| none |
| `verdict` | one line under the cards |
| `verdictSay` |  |
| `kicker` |  |
| `title` |  |

Defaults: `{"highlight":"right"}`

```json
{ "id": "compare", "block": "compare",
  "vo": "Build it ourselves, and we control everything but wait nine months. Buy it, and we launch in six weeks with less flexibility.",
  "props": {
    "title": "Build or buy?",
    "left": {"tag":"Option A","title":"Build","points":[{"text":"Full control","mark":"check","say":"control"},{"text":"9 months to launch","mark":"x","say":"nine"}]},
    "right": {"tag":"Option B","title":"Buy","points":[{"text":"Live in 6 weeks","mark":"check","say":"six"},{"text":"Less flexibility","mark":"x","say":"flexibility"}]},
    "highlight": "right"
  } }
```

## `definition`

Dictionary entry — term, pronunciation, part of speech, definition, example.

**Use:** Introduce jargon precisely before using it. One term per card.

**Holds** 1.3 s after the last word by default.

| prop | meaning |
|---|---|
| `term` | the word |
| `phonetic` | /ˈkæl.ɪ.breɪ.tɪd/ |
| `pos` | adjective / noun … |
| `definition` | plain-language definition |
| `example` | optional usage line |
| `land` | spoken word to land the term on |

```json
{ "id": "definition", "block": "definition",
  "vo": "Calibrated: when you say seventy percent, it happens about seventy percent of the time.",
  "props": {
    "term": "calibrated",
    "phonetic": "/ˈkæl.ɪ.breɪ.tɪd/",
    "pos": "adjective",
    "definition": "Of a forecast: events given a 70% chance happen about 70% of the time.",
    "example": "“Our delivery estimates are well calibrated.”"
  } }
```

## `delta`

Before → after — two numbers, an arrow that draws between them, and the change as a chip.

**Use:** Improvements and regressions: "4.2 s → 1.1 s". State the period for both.

**Holds** 1.8 s after the last word by default.

| prop | meaning |
|---|---|
| `from` | { value, label } |
| `to` | { value, label } |
| `prefix` |  |
| `suffix` |  |
| `decimals` |  |
| `change` | override text, e.g. '−74%' (auto % if omitted) |
| `better` | 'down' \| 'up' — which direction is good |
| `fromSay` | word for the old value |
| `toSay` | word for the new value |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"better":"up"}`

```json
{ "id": "delta", "block": "delta",
  "vo": "Page load went from four point two seconds to one point one.",
  "props": {
    "kicker": "Checkout page load",
    "from": {"value":4.2,"label":"Before · March"},
    "to": {"value":1.1,"label":"After · September"},
    "suffix": " s",
    "better": "down",
    "fromSay": "four",
    "toSay": "one",
    "source": "Synthetic monitoring, p50 (sample data)"
  } }
```

## `distribution`

Distribution — a dot histogram: every value is a dot, stacked in bins; a marker line and an optional highlighted range.

**Use:** When the spread matters more than the average ("most tickets close in a day — but look at the tail").

**Holds** 1.5 s after the last word by default.

| prop | meaning |
|---|---|
| `values` | array of numbers (20–300) |
| `bins` | auto |
| `min` |  |
| `max` |  |
| `unit` | axis unit, e.g. 'days' |
| `marker` | { value, label, say } (e.g. median) |
| `highlight` | { from, to, label, say } — dots in range turn accent |
| `kicker` |  |
| `title` |  |
| `source` |  |

```json
{ "id": "distribution", "block": "distribution",
  "vo": "Most requests close within two days. But one in ten takes more than a week — that tail is where customers churn.",
  "props": {
    "title": "Days to close a request",
    "values": "demo",
    "unit": "days",
    "marker": {"value":1.8,"label":"median 1.8 days","say":"most"},
    "highlight": {"from":7,"to":20,"label":"1 in 10 takes > 7 days","say":"tail"},
    "source": "Sample data"
  } }
```

## `end`

End card — the verdict in serif, a next step, sources and disclosures held long enough to read.

**Use:** Always the last beat. Hold ≥ 4 s. disclose: "auto" adds the AI-voice line when narration is Gemini TTS.

**Holds** 1.5 s after the last word by default.

| prop | meaning |
|---|---|
| `title` | verdict; *word* = accent |
| `subtitle` | one line |
| `cta` | next step / URL |
| `source` | footnote (bottom-left) |
| `disclose` | 'auto' \| text \| false (bottom-right) |

Defaults: `{"disclose":"auto"}`

```json
{ "id": "end", "block": "end",
  "vo": "Plan for the thirty.",
  "props": {
    "title": "Seventy percent is *not* a promise.",
    "subtitle": "Plan for the thirty.",
    "cta": "Read the planning guide →",
    "source": "Hypothetical illustration — figures are explanatory."
  } }
```

## `flow`

System diagram — nodes in columns, curved connectors that draw in, packets flowing along them, focus on cue.

**Use:** "How it works": data flows, request paths, org handoffs. ≤ 8 nodes, ≤ 4 columns. Label edges only when needed.

**Holds** 1.4 s after the last word by default.

| prop | meaning |
|---|---|
| `nodes` | [{ id, label, sub, icon, col, row, tone: 'accent'\|'muted', say }] |
| `edges` | [{ from, to, label, say }] |
| `focus` | [{ id, say }] |
| `packets` | true — dots travel along drawn edges |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"packets":true}`

```json
{ "id": "flow", "block": "flow",
  "vo": "A request hits the gateway, is checked by auth, and then served from the cache — or, on a miss, from the database.",
  "props": {
    "title": "Life of a request",
    "nodes": [{"id":"user","label":"Client","icon":"monitor-smartphone","col":0,"say":"request"},{"id":"gw","label":"Gateway","icon":"network","col":1,"say":"gateway"},{"id":"auth","label":"Auth","icon":"shield-check","col":2,"row":0,"say":"auth"},{"id":"cache","label":"Cache","icon":"zap","col":3,"row":0,"tone":"accent","say":"cache"},{"id":"db","label":"Database","icon":"database","col":3,"row":1,"say":"database"}],
    "edges": [{"from":"user","to":"gw"},{"from":"gw","to":"auth"},{"from":"auth","to":"cache"},{"from":"cache","to":"db","label":"on a miss"}],
    "focus": [{"id":"cache","say":"served"}]
  } }
```

## `funnel`

Funnel — stages as centred bars that shrink with each step, conversion rates between them.

**Use:** Pipelines and drop-off: visitors → sign-ups → active. 3–5 stages; the leak you care about gets focus.

**Holds** 1.2 s after the last word by default.

| prop | meaning |
|---|---|
| `stages` | [{ label, value, say }] |
| `format` | value format |
| `rates` | true — show step conversion % |
| `focus` | index of the step whose drop-off is the story |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"rates":true}`

```json
{ "id": "funnel", "block": "funnel",
  "vo": "Of ten thousand visitors, two thousand start a trial, and only four hundred become weekly users.",
  "props": {
    "title": "Where people drop off",
    "stages": [{"label":"Visitors","value":10000,"say":"ten"},{"label":"Started a trial","value":2000,"say":"two"},{"label":"Weekly users","value":400,"say":"four"}],
    "focus": 2,
    "source": "Sample data"
  } }
```

## `gauge`

Gauge — a semicircular scale with labelled zones; the needle swings to the value.

**Use:** Scores and health indices with meaningful bands ("at risk / healthy"). Label the zones.

**Holds** 1.8 s after the last word by default.

| prop | meaning |
|---|---|
| `value` | number |
| `min` | 0 |
| `max` | 100 |
| `zones` | [{ to, label, tone: 'down'\|'dim'\|'up'\|'accent' }] |
| `label` | what is measured |
| `format` | { suffix } or '%' |
| `land` | spoken word |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"min":0,"max":100}`

```json
{ "id": "gauge", "block": "gauge",
  "vo": "Our delivery confidence score now sits at seventy-four — in the healthy band, but only just.",
  "props": {
    "kicker": "Delivery confidence",
    "value": 74,
    "zones": [{"to":50,"label":"At risk","tone":"down"},{"to":70,"label":"Watch","tone":"dim"},{"to":100,"label":"Healthy","tone":"up"}],
    "label": "Healthy — *but only just*",
    "land": "seventy"
  } }
```

## `icons`

Icon grid — 3–6 items, each an icon that draws itself on, a label and a line of detail.

**Use:** Pillars, features, principles, "what's included". Lucide icon names — search with `clearframe icons <query>`.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ icon, label, sub, say }] |
| `kicker` |  |
| `title` |  |
| `columns` | auto |

```json
{ "id": "icons", "block": "icons",
  "vo": "The platform gives every team three things: security by default, fast deploys, and clear costs.",
  "props": {
    "title": "What every team gets",
    "items": [{"icon":"shield-check","label":"Secure by default","sub":"SSO, audit logs, least privilege","say":"security"},{"icon":"rocket","label":"Fast deploys","sub":"Merge to live in minutes","say":"fast"},{"icon":"receipt","label":"Clear costs","sub":"Per-team spend, weekly","say":"costs"}]
  } }
```

## `image`

Full-bleed image or footage — slow Ken Burns push, a legibility scrim, kicker + title + credit overlaid.

**Use:** Establishing plates and generated textures (gemini-image / veo-video assets). The words on top carry the meaning.

**Holds** 0.9 s after the last word by default.

| prop | meaning |
|---|---|
| `asset` | storyboard asset id (image or clip) |
| `src` | or a path |
| `title` | overlay headline; *word* = accent |
| `kicker` |  |
| `credit` | e.g. 'AI-generated image' |
| `position` | 'bottom-left' \| 'center' |
| `focus` | object-position, e.g. '50% 30%' |
| `push` | Ken Burns scale (1.07) |

Defaults: `{"position":"bottom-left","push":1.07,"focus":"50% 50%"}`

```json
{ "id": "image", "block": "image",
  "vo": "Every plan starts with a forecast — and every forecast starts with an honest question.",
  "props": {
    "kicker": "Chapter one",
    "title": "Start with an *honest* question",
    "credit": "Backdrop: code-rendered placeholder — swap in an image asset"
  } }
```

## `kpis`

KPI tiles — 2–4 numbers side by side, each counting up with a delta chip.

**Use:** Status updates and dashboards-in-motion. Name each metric plainly; never more than 4.

**Holds** 1.5 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ value, prefix, suffix, decimals, label, delta, dir, good, deltaLabel, say }] |
| `kicker` |  |
| `title` |  |
| `source` |  |

```json
{ "id": "kpis", "block": "kpis",
  "vo": "Quarter in review: requests up to twelve thousand four hundred, first response down to four hours, and satisfaction at ninety-one percent.",
  "props": {
    "kicker": "Q3 in review",
    "title": "Service desk, at a glance",
    "items": [{"label":"Requests","value":12400,"delta":"+8%","dir":"up","good":"up","say":"requests"},{"label":"First response","value":4,"suffix":" h","delta":"−2.1 h","dir":"down","good":"down","say":"response"},{"label":"Satisfaction","value":91,"suffix":"%","delta":"+3 pts","dir":"up","say":"satisfaction"}],
    "source": "Sample data"
  } }
```

## `line`

Trend line — axes, a line that draws itself with the value riding its tip, marks and bands on cue.

**Use:** Change over time. Say what to watch before it draws. Optional dashed baseline for comparison.

**Holds** 1.3 s after the last word by default.

| prop | meaning |
|---|---|
| `series` | numbers or [{ x, y }] |
| `labels` | x labels: array (first/last used) or [[index, 'label'], …] |
| `min` | y min (default 0) |
| `max` | y max |
| `format` | value format ({ prefix, suffix, decimals } or '%') |
| `marks` | [{ i, label, say }] |
| `band` | { from, to, label, say } (index range) |
| `baseline` | { series, label } dashed comparison |
| `drawSay` | word that starts the draw |
| `dur` | draw seconds (1.6) |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"dur":1.6,"min":0}`

```json
{ "id": "line", "block": "line",
  "vo": "Weekly active teams climbed steadily, then jumped after the September launch.",
  "props": {
    "title": "Weekly active teams",
    "series": [120,128,131,140,146,151,158,163,171,176,214,238,251],
    "labels": ["Jun","Sep"],
    "marks": [{"i":10,"label":"Launch","say":"jumped"}],
    "drawSay": "climbed",
    "source": "Product analytics (sample data)"
  } }
```

## `lower-third`

Lower third — name and role strap, optionally over a full-bleed image or clip.

**Use:** Identify a speaker, place or document over footage. Keep on screen 3–5 s.

**Holds** 1 s after the last word by default.

| prop | meaning |
|---|---|
| `name` | primary line |
| `role` | secondary line |
| `src` | optional image/video path behind it |
| `asset` | or a storyboard asset id |

```json
{ "id": "lower-third", "block": "lower-third",
  "vo": "Maya leads capacity planning for the platform team.",
  "props": {
    "name": "Maya Chen",
    "role": "Capacity planning · Platform team (fictional)"
  } }
```

## `points`

Numbered key points — rows that land one by one on their spoken phrase (the recap).

**Use:** Recaps, principles, "three things to remember". 2–5 items, ≤ 7 words each.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ text, say }] — say = word that brings the row in |
| `kicker` |  |
| `title` |  |
| `numbered` | true |

Defaults: `{"numbered":true}`

```json
{ "id": "points", "block": "points",
  "vo": "Seventy is likely, not certain. Check calibration. And plan for the thirty.",
  "props": {
    "kicker": "Recap",
    "items": [{"text":"Seventy is likely — *not certain*.","say":"seventy"},{"text":"Check the calibration.","say":"check"},{"text":"Plan for the thirty.","say":"plan"}]
  } }
```

## `question`

Question swap — the wrong question is struck through, the better one rises beneath it.

**Use:** The turn of an argument ("not X — Y"). Pair with narration that contrasts the two.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `from` | the old question (struck) |
| `to` | the better question; *phrase* gets a marker highlight |
| `kicker` | optional label |
| `strikeSay` | word that triggers the strike |
| `toSay` | word that brings in the new question |

```json
{ "id": "question", "block": "question",
  "vo": "So don't ask whether the forecast was right. Ask whether you planned for the thirty.",
  "props": {
    "from": "Was the forecast right?",
    "to": "Did we plan for *the 30?*",
    "strikeSay": "right",
    "toSay": "ask"
  } }
```

## `quote`

Pull quote — oversized quotation mark, serif quote, attribution.

**Use:** A customer, expert or document in their own words. Attribute precisely; ≤ 25 words.

**Holds** 1.3 s after the last word by default.

| prop | meaning |
|---|---|
| `text` | the quote; *word* = accent |
| `author` | who said it |
| `role` | title / organisation / date |
| `land` | word to start on |

```json
{ "id": "quote", "block": "quote",
  "vo": "As one planning lead put it: we stopped asking if the forecast was right, and started asking what we would do if it was wrong.",
  "props": {
    "text": "We stopped asking if the forecast was right, and started asking what we’d do *if it was wrong*.",
    "author": "Planning lead",
    "role": "Customer interview, 2026 (paraphrased)"
  } }
```

## `ring`

Ring — a single proportion as a donut that sweeps to its value, the number in the middle.

**Use:** One share or completion rate. For several parts use share or waffle.

**Holds** 1.5 s after the last word by default.

| prop | meaning |
|---|---|
| `value` | 0–1, or 0–max |
| `max` | 1 (or 100) |
| `label` | what the ring measures |
| `sub` | supporting line |
| `land` | spoken word |
| `decimals` | 0 |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"max":1,"decimals":0}`

```json
{ "id": "ring", "block": "ring",
  "vo": "Eighty-two percent of incidents were resolved inside the target window.",
  "props": {
    "value": 0.82,
    "label": "of incidents resolved within target",
    "sub": "Up from 64% a year ago",
    "land": "eighty",
    "kicker": "Resolution rate",
    "source": "Incident log, Jan–Sep 2026 (sample data)"
  } }
```

## `share`

Composition bar — one 100% bar split into parts that slide in one by one, labelled underneath.

**Use:** Where the time / money / effort goes. 2–5 parts; the story part gets the accent.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `parts` | [{ label, value, tone, say }] (values are shares; they're normalised) |
| `focus` | index of the story part (accent) |
| `unit` | '%' (default) — how to print each share |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"focus":0,"unit":"%"}`

```json
{ "id": "share", "block": "share",
  "vo": "Where does an engineer’s week go? Only about a third is building. The rest is meetings, reviews and waiting.",
  "props": {
    "title": "Where the week goes",
    "parts": [{"label":"Building","value":34,"say":"building"},{"label":"Meetings","value":26,"say":"meetings"},{"label":"Reviews","value":18,"say":"reviews"},{"label":"Waiting","value":22,"say":"waiting"}],
    "focus": 0,
    "source": "Time-tracking survey, n = 212 (sample data)"
  } }
```

## `stat`

Hero number — one figure, big, landing on its spoken word; label, context, delta chip, source.

**Use:** The headline number of an update, the hook of an explainer. One number per beat.

**Holds** 1.5 s after the last word by default.

| prop | meaning |
|---|---|
| `value` | number (required) |
| `from` | start value for counters (default 0) |
| `prefix` | '$' |
| `suffix` | '%', '×', ' ms' |
| `decimals` | auto from value |
| `style` | 'serif' (masked editorial reveal) \| 'counter' (counts up) \| 'odometer' (rolling digits) |
| `label` | what the number is |
| `context` | one line of context |
| `delta` | '+12%' |
| `dir` | 'up' \| 'down' \| 'flat' |
| `good` | which direction is good ('up') |
| `deltaLabel` | 'vs last year' |
| `land` | spoken word the number lands on |
| `kicker` |  |
| `source` |  |
| `align` | 'center' \| 'left' |

Defaults: `{"style":"serif","align":"center","from":0,"dir":"up","good":"up"}`

```json
{ "id": "stat", "block": "stat",
  "vo": "Median wait time fell to four point two days this quarter.",
  "props": {
    "kicker": "Median wait",
    "value": 4.2,
    "suffix": " days",
    "label": "from request to first response",
    "delta": "−31%",
    "dir": "down",
    "good": "down",
    "deltaLabel": "vs Q2",
    "land": "four",
    "source": "Service desk export · Q3 2026 (sample data)"
  } }
```

## `statement`

Kinetic statement — the narration itself as big type; each word lights up as it is spoken.

**Use:** The thesis, a key sentence, a takeaway. Defaults to the beat narration. ≤ 18 words.

**Holds** 0.9 s after the last word by default.

| prop | meaning |
|---|---|
| `text` | defaults to the beat narration; *word* = accent |
| `size` | m \| l \| xl |
| `mode` | karaoke (dim → lit on the word) \| reveal (words appear) |
| `align` | left \| center |
| `dim` | opacity of unspoken words (karaoke) |

Defaults: `{"size":"l","mode":"karaoke","align":"left","dim":0.16}`

```json
{ "id": "statement", "block": "statement",
  "vo": "Good forecasts are not always right. They are honest about how often they will be wrong.",
  "props": {
    "text": "Good forecasts are not always right. They are *honest* about how often they will be wrong."
  } }
```

## `steps`

Process steps — numbered cards joined by connectors; each lands on its spoken word, the current one highlighted.

**Use:** How-tos and pipelines with 3–5 stages. Name steps with verbs. Icons optional (Lucide names).

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ label, sub, icon, say }] |
| `active` | 'each' (highlight the step being spoken) \| 'none' |
| `kicker` |  |
| `title` |  |
| `source` |  |

Defaults: `{"active":"each"}`

```json
{ "id": "steps", "block": "steps",
  "vo": "Write the forecast, check it against what happened, then adjust the plan.",
  "props": {
    "title": "The forecasting loop",
    "items": [{"label":"Forecast","sub":"State a probability","icon":"target","say":"write"},{"label":"Check","sub":"Compare with outcomes","icon":"list-checks","say":"check"},{"label":"Adjust","sub":"Re-plan the risk","icon":"sliders-horizontal","say":"adjust"}]
  } }
```

## `table`

Comparison table — up to 4×4, rows landing in sequence; ✓/✗ cells become icons; one column highlighted.

**Use:** Feature or option comparisons where the grid itself is the argument. Keep cells to 1–3 words.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `columns` | ['', 'Option A', 'Option B'] |
| `rows` | [['Criterion', 'yes', 'no'], …] — 'yes'/'no'/'—' become icons |
| `highlight` | { col, say } |
| `rowSay` | ['word', …] per row |
| `kicker` |  |
| `title` |  |
| `source` |  |

```json
{ "id": "table", "block": "table",
  "vo": "Compared side by side, only the managed option gives us audit logs, single sign-on, and a support SLA.",
  "props": {
    "title": "What each option includes",
    "columns": ["","Self-hosted","Managed"],
    "rows": [["Audit logs","no","yes"],["Single sign-on","yes","yes"],["Support SLA","no","yes"],["Setup time","6 wks","2 days"]],
    "highlight": {"col":2,"say":"managed"},
    "rowSay": ["audit","single","support"]
  } }
```

## `timeline`

Timeline — dated milestones along a line that fills as each one is spoken; optional "now" marker.

**Use:** History, roadmaps, incident timelines. 3–6 milestones. Dates in the format your audience uses.

**Holds** 1.1 s after the last word by default.

| prop | meaning |
|---|---|
| `items` | [{ date, label, sub, say }] |
| `now` | index of the current milestone (pulses) |
| `kicker` |  |
| `title` |  |
| `source` |  |

```json
{ "id": "timeline", "block": "timeline",
  "vo": "We piloted in January, rolled out to all teams in May, and hit the service target in September. Next: automation.",
  "props": {
    "title": "The rollout",
    "items": [{"date":"Jan 2026","label":"Pilot","say":"piloted"},{"date":"May 2026","label":"All teams","say":"rolled"},{"date":"Sep 2026","label":"Target met","say":"hit"},{"date":"Q1 2027","label":"Automation","say":"next"}],
    "now": 2
  } }
```

## `title`

Opening or section title — kicker, a serif headline (with *emphasis*), optional subtitle.

**Use:** Cold opens, section openers, the promise of the film. Keep the headline ≤ 8 words.

**Holds** 0.9 s after the last word by default.

| prop | meaning |
|---|---|
| `kicker` | small mono label above |
| `title` | headline; *word* = accent italic |
| `subtitle` | one supporting line |
| `align` | center \| left |
| `size` | l \| xl \| xxl |
| `land` | spoken word the headline lands on |

Defaults: `{"align":"center","size":"xl"}`

```json
{ "id": "title", "block": "title",
  "vo": "Every forecast is a promise with a margin of error.",
  "props": {
    "kicker": "A field guide",
    "title": "Forecasts are *not* promises",
    "subtitle": "How to read a probability — and plan for the rest"
  } }
```

## `waffle`

Unit chart — a 10×10 grid that makes a share countable ("7 in 10"), with counters beside it.

**Use:** Probabilities, shares, risks. Countable beats abstract: prefer this to a pie or a lone percentage.

**Holds** 1.4 s after the last word by default.

| prop | meaning |
|---|---|
| `total` | 100 |
| `cols` | 10 |
| `parts` | [{ n, label, tone: 'ink'\|'accent'\|'down'\|'dim', say }] filled in order |
| `kicker` |  |
| `title` |  |
| `source` |  |
| `order` | 'rows' \| 'random' \| 'center' |

Defaults: `{"total":100,"cols":10,"order":"rows"}`

```json
{ "id": "waffle", "block": "waffle",
  "vo": "Picture a hundred launches with the same forecast. About seventy ship on time. About thirty slip.",
  "props": {
    "kicker": "100 launches · same 70% forecast",
    "parts": [{"n":70,"label":"ship on time","tone":"ink","say":"seventy"},{"n":30,"label":"slip","tone":"accent","say":"thirty"}]
  } }
```

