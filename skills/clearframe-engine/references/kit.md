# CF.kit — full API

Every `at` accepts seconds or a time spec (`"beatId"`, `"beatId+0.4"`, `"beatId@0.5"`, `"beatId:end"`). Selectors can be elements or CSS strings (resolved against `document`, so prefer passing elements from `el.querySelector`). All sizes are at 1080p and scale by `--u`.

## Tokens
`kit.tokens` = `{ fast: 0.3, base: 0.5, slow: 1.0, stagger: { chars: .02, words: .05, lines: .1, items: .1 }, ease: { in: 'power3.out', out: 'power2.in', move: 'power3.inOut', snap: 'expo.out', settle: 'back.out(1.2)', linear: 'none' } }`

## Text
| Call | Notes |
|---|---|
| `kit.split(el, 'words'\|'chars'\|'lines', { mask })` | GSAP SplitText; returns parts |
| `kit.reveal(el, at, { by, mask, dur, stagger, y, blur, ease, scale })` | `by: 'words'` (default) \| `'chars'` \| `'lines'` \| `'block'`. `mask: true` slides up from behind a clean edge. Returns `{ parts, end }` |
| `kit.enter(el, at, { dur, y, x, scale, blur, stagger, ease })` | fade + rise for blocks |
| `kit.exit(el, at, { dur, y, blur, stagger })` | quick, quiet exit |
| `kit.hit(el, at, { scale, dur, color })` | subtle emphasis on a spoken word (≤ 1.04) |
| `kit.mark(el, at, { kind: 'highlight'\|'underline'\|'strike', color, dur })` | marker stroke under / through an inline element |
| `kit.counter(el, at, { from, to, dur, ease, decimals, prefix, suffix, format, grouping })` | tabular; returns `{ to(value, at, dur), proxy }` for escalating numbers |
| `kit.scramble(el, at, { dur, chars, seed })` | seeded decode-to-text |
| `kit.type(el, at, { cps, caret })` | typewriter; returns `{ end }` |
| `kit.fit(el, { min })` | shrink font until the text fits its box |

## Scene & camera
| Call | Notes |
|---|---|
| `kit.drift(el, from, to, { scale, x, y, rotate })` | linear push across an interval (default 1.03). Put it on an inner wrapper, not the scene root, if the root also transitions |
| `kit.transition(kind, fromEl, toEl, at, { dur, ease })` | `fade`, `dip`, `push`, `rise`, `wipe`, `blur`, `zoom`. Extends the outgoing scene's visibility by `dur` |

## Texture & chrome
| Call | Notes |
|---|---|
| `kit.grain(parent, { opacity, fps, tile, seed })` | seeded noise tiles, 12 fps |
| `kit.vignette(parent)` | theme-aware |
| `kit.gridlines(parent, { size, drift: [x, y], opacity, dots, fade })` | line or dot grid drifting slowly |
| `kit.marquee(el, items, { speed, gap, separator })` | seamless ticker |
| `kit.captions(parent, { maxWords, maxChars, mode: 'karaoke'\|'phrase', beats })` | word-synced captions from narration timing |

## Data
| Call | Notes |
|---|---|
| `kit.lineChart(el, { data, width, height, pad, min, max, color, strokeWidth, area, grid, yTicks, yFormat, xLabels: [[i, 'label']], smooth, tip, tipFormat })` | → `.axes(at)`, `.draw(at, { dur, ease, to })`, `.mark(i, at, { label, color, dy })`, `.band(i0, i1, at, { label })`, `.hideTip(at)`, `.point(i)`, `.sx/.sy` scales |
| `kit.bars(el, { data: [{ label, value, color }], max, format, orientation, gap, color, accent, highlight })` | → `.grow(at, { dur, stagger })`, `.focus(i, at, { dim })` |
| `kit.waffle(el, { total, cols, size, gap, shape, color, seed })` | → `.show(at, { from: 'center'\|'rows'\|'random' })`, `.fill(n, at, { color, order, start, each })`, `.pulse(n, at)` |
| `kit.donut(el, { size, thickness, color, track })` | → `.sweep(at, { to, dur })` |
| `kit.meter(el, { value, label, format, color })` | → `.fill(at)` |
| `kit.milestones(el, { items: [{ label, sub }], color })` | → `.play(at, { step })`, `.focus(i, at)` |
| `kit.steps(el, { items: [{ label, sub }], vertical })` | → `.play(at, { step })`, `.focus(i, at)` |
| `kit.draw(svgEls, at, { dur, ease })` | stroke draw-on for path / line / circle |
| `kit.arrow(parent, {x,y}, {x,y}, { curve, color, width, head })` | → `.draw(at)` |
| `kit.niceTicks(min, max, count)` | round tick values |
| `kit.fmt(v, { decimals, prefix, suffix, grouping })` | number formatting |
| `kit.color('--accent')` | resolve a theme token to a concrete color (for tweening) |

## Credibility
| Call | Notes |
|---|---|
| `kit.source(sceneEl, text, at, { position: 'bottom-left' })` | mono source line in the margin |
| `kit.footnote(sceneEl, text, at)` | same, returns the minimum comfortable hold in seconds |
