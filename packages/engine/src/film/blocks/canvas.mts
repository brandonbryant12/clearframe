import { b } from './definition.mjs';

export const canvasBlock = b(
  'canvas',
  'graphics',
  'Draw anything: shapes, paths, text, icons and images that draw on, pop, travel along paths, loop and leave on spoken cues.',
  {
    view: '"auto" (fit the drawing into the content area, up to 2×), [width, height] author units fitted below the header, a camera rect [x, y, width, height] framed across the whole frame, {on: element id(s), pad?, state?} (a camera rect framed on what is drawn), or omit for frame pixels (1920×1080 landscape)',
    viewFrom:
      'Camera rect the view travels from (set automatically between world beats); like view, it can be {on: id(s), pad, state}',
    reveal:
      'Open close on a detail and pull back to the whole picture on a word: {from: element id or [ids], pad?, state?: start|end, say|cue|at, dur?}. The detail is framed from the element’s own geometry (a rect, card, group, document, row), widened to the frame’s aspect; text is framed through its container. See docs/target-camera.md.',
    viewAt: 'Scene seconds the camera move starts (default 0)',
    viewDur: 'Seconds the camera move takes (default 1.2)',
    viewDrift:
      'After arriving, the camera keeps easing in by this fraction of the view (worlds default 0.03)',
    viewTall:
      'Camera rect for tall (vertical) frames; otherwise the view is re-framed on the beat’s own foreground',
    world:
      'Name shared by consecutive canvas beats that form one continuous drawing: each inherits what came before, cuts invisibly, and the camera travels between their views',
    elements:
      '[{type: rect|circle|ellipse|line|path|poly|text|icon|image|group|meter|spotlight|particles|solid|document|pointer|receipt|app|crumbs, geometry, fill, stroke, width, enter, say|at, dur, keys, loop, along, exit, exitSay|exitAt, z, blur, shine, tilt, material, mosaic, print}] (≤ 600); text takes marks: [{words, style: highlight|underline|circle|box|strike|cross|stamp, say|at, label (stamp)}] drawn on its own words; document is a page of real sections that scrolls to one on a word; pointer {to: an element id, say} presses it — see docs/canvas.md',
    stagger: 'Seconds between top-level elements without a cue (0–3)',
    rough:
      'Hand-drawn strokes for every shape: true or {amount, passes, boil, fill: hachure|solid, gap} (an element can set rough: false)',
    mosaic:
      'Lay every shape in tiles: true or {tile, gap, jitter, flow: rows|rings|contour, style: tesserae|pixel|stitch, outline, build: sweep|radial|random, shade, shine, grout, axis} (an element can set mosaic: false)',
    print:
      'Print every shape: benday|halftone|engraving|newsprint|letterpress or {screen: dots|lines|none, cell, angle, tone, axis, register: [dx, dy], wear, ink} (an element can set print: false)',
    dolly:
      'Fly the camera through depth: keys [{say|at, z, dur, ease}]. Elements with z are drawn in perspective; the camera passes them as its z reaches theirs',
    focus:
      'Depth of field for elements with z: {z (the focus plane), aperture 0–3 (1 natural), keys [{say|at, z, dur}] for a rack focus}',
    chart:
      'A chart drawn as canvas shapes with stable ids, so consecutive canvas charts morph into each other (a number into its bar, a stacked bar into bars): {kind: bars|stack|number, values: [{label, value, highlight, id, say}], box: [x, y, w, h], max, prefix, suffix, decimals, id, note: {text, to, say}} (say lands a value on its spoken word; a number with several cued values steps through them; the note replaces a heading: an annotation on the stressed word)',
    sourceElement:
      'Id of a top-level static native text element used as the visible source instead of the automatic footer. Requires storyboard sources, at:0, enter:none, size >=28, opaque ink fill, no effects/exits/keys/transforms. Frame audit still verifies bounds and overlap.',
    sourceSize:
      'Canvas source font size, 14–72 px (default 22, or 30 in a tall frame); reserves a three-line footer when set.',
    plot: 'Sourced multiseries line plot: {title, x:{type:linear|date,label,domain,ticks,...}, y:{type:linear|log,label,domain,ticks,...}, series:[{id,label,values:[{x,y}]}], asOf, source?, motion?:none|{at,duration}, annotation?}. Dates preserve elapsed spacing, null y leaves a gap, all series share explicit scales and a linear reveal clock. See docs/quantitative-plots.md.',
    bars: 'Signed editorial bar chart: {title, unit, values:[{label, value, highlight?}], domain:[min≤0, max≥0], ticks, decimals?, prefix?, suffix?, orientation?: vertical|horizontal, reference?: {value, label}, colors?: sign|single, asOf, source?, motion?: none|{at,duration}}. Bars grow from zero in order; negative values take the negative colour. See docs/bars.md.',
    bridge:
      'Metric bridge (waterfall): {title, unit, start:{label, value}, steps:[1–10 {label, value} drivers or {label, total:true} subtotals, each with say?], end:{label, value, say?}, domain:[min≤0, max≥0], ticks, decimals?, prefix?, suffix?, good?: up|down, orientation?: auto|vertical|horizontal, asOf, source?, motion?: none|{at,duration}}. Totals stand on zero; drivers float from the running total and must reconcile to end exactly (add an explicit Other step rather than hide a gap); say cues a driver to its spoken word. See docs/bridge.md.',
    breakdown:
      'Part-to-whole that reconciles and drills down: {id (shared by every beat of it), title, unit, asOf, source?, decimals?, prefix?, suffix?, total:{label, value}, parts:[2–8 {id?, label, value>0, say|cue|at?, highlight?, parts?:[2–8 {id?, label, value, say|cue|at?}], residual?}], residual?: true|label, open?:{part, say|cue|at} | focus?: part | gather?: part, motion?: none}. Rows on one scale (the total is the full bar). Every parent must equal its parts within display rounding, or carry residual: true (an explicit "Not explained" share; a negative remainder is refused — use a bridge). open breaks a part\u2019s bar into its parts on the word; focus starts opened (its parts come out of the part\u2019s bar in the beat before); gather slides them back. See docs/breakdown.md.',
    process:
      'Where work waits, as a serial flow modelled period by period: {id?, title, unit (e.g. "requests"), period (e.g. "day"), arrivals (whole items per period), stages:[2–5 {id, label, capacity}], start?:{stageId: already waiting}, runs:[1–4 {periods, dur (seconds on screen, ≥0.4 per period), say|cue|at?, set?:{stageId: new capacity}}], token? (items per square), done?, source? (default: an illustrative model, not a forecast), asOf?}. Each period arrivals join the first queue and each stage takes up to its capacity; queues are one square per item with the exact count and its change per period, the period clock and what is done. A later run with set starts from the state the last one left (a raised capacity drains a queue at the computed rate). Mass-conserving; branching flows are not modelled. See docs/process.md.',
    decision:
      'A stated rule as a path, walked by a case and its counterfactual: {id?, title, source? (default: an example rule), asOf?, ask:[1–4 {id, label, yes?, no?}], tree:{ask, yes: tree|outcome id, no: tree|outcome id}, outcomes:[2–5 {id, label, tone?: positive|negative|accent|muted}], cases:[1–2 {label, answers:{askId: yes|no}, say|cue|at}], return?:{say|cue|at}}. Every question and outcome must be reachable and each case must answer what its path asks. The case walks its path; a second case (one answer changed) keeps the first as a ghost, diverges where the answer changed and lands on its own outcome; return brings the first back. See docs/decision.md.',
    table:
      'A native table, optionally seen by different audiences: {id, title, source, asOf?, columns:[1–6 {id, label, align?: left|right, weight?}], rows:[1–8 {id, cells:{columnId: text}}], views?:[{id, label, hide?:[columnIds]}], show?:[{view, say|cue|at, after?}]}. Cells keep stable slots (tbl-ID-ROW-COL rects, so a camera can frame one); a hidden column shows a neutral redaction with no text of its value in the picture while that view is shown. This is presentation, not access control: the storyboard still holds every value. Portrait frames take at most 3 columns. See docs/table.md.',
    cast: 'A cast of objects that persists across consecutive canvas beats and re-forms as the idea develops, instead of a new card per line: {look?: tiles|drawn|print (first beat), objects:[1–16 {id, icon|word|shape: doc|bubble|phone|card|person|ticket|box|server|database|cloud|coin|lock|bulb|clock|envelope|truck|flag|paycheck|calendar|jar|house|badge|umbrella|receipt, color, label?, size?, float?, enter?: pop|drop|rise|left|right|fade|none}] (declared in the first cast beat; later beats may add more), formations:[1–12 {form: scatter|line|row|column|ring|cluster|hero|swap|wave|merge|split|travel|mark|camera|fill|emerge|exit, say|at, ids?, hero?, word?, on?, beside?, out?, in?, by?, into?, from?, via?, trail?, mark?: circle|underline|cross|arrow, to?, color?, zoom?, thread?, center?, spread?, scale?, dur?, stagger?, ease?}]}. merge folds ids into one object (into) and split bursts them back out of one (from); travel sends ids along a curved route (via waypoints) to another object (to) or a point, a pen trail sketching ahead; camera zooms the whole cast (carried across cuts); fill grows one object into the frame so the next scene of any block plays on its colour (the job sets the tone of that scene and the cuts), and emerge brings it back in a later cast beat. Each beat starts where the last one left every object, so consecutive cast beats cut invisibly (transition cut, camera still). hero brings one forward and quiets the rest; swap turns one object into another in place, with by naming what causes it; wave runs through a sequence where it stands; mark draws a pen mark on objects (an arrow to others); exit sends objects off-frame. drawn is pen on paper, print a two-colour press. Positions come from the frame and stay title-safe, so one storyboard serves landscape and vertical. See docs/cast.md.',
    multiples:
      'Small multiples: {title, unit, x, y (one shared scale, as plot), series:[2–9 {id,label,values:[{x,y}]}], highlight?: id, asOf, source?, motion?}. One small line per series in a grid; ticks on the outer edges; the highlighted panel takes accent2 and the others recede. See docs/small-multiples.md.',
    distribution:
      'Editorial histogram: {title, unit, observations:[number|null], edges:[2–12 equal bins], threshold:{value, relation: lt|lte|gt|gte, label}, marker?:{value, label}, prefix?, suffix?, decimals?, tone?: negative|highlight, asOf, source?, motion?}. Counts sit on the bars; the threshold line states how many outcomes qualify. See docs/distribution-charts.md.',
    stat: 'A headline figure: {kicker?, value, decimals?, prefix?, suffix?, label, change?: {value, decimals?, suffix?, context, good?: up|down|neutral}, count?, asOf, source?, motion?}. The value counts up natively; the change line is green or red by whether a rise is good news for this measure. See docs/stat.md.',
    teaching:
      'Editable pause/answer/explanation: {form:choice|gap, phase:question|answer, prompt, explanation, layout?:full|split, motion?:fade|none, revealAt?, explainAt?, source?}. Choice uses options:[2–3 strings] and correctIndex; gap uses before, answer and optional after. Use separate beats for reading and answer holds. Split reserves landscape right-half imagery. See docs/teaching-sequences.md.',
    sketch:
      'A library sketch drawn under any elements, redrawn for this frame (clearframe sketch lists them); its camera (view, dolly, focus) applies unless the beat sets its own',
    diagram:
      'Native system diagram whose components keep their identity while the story changes it: {direction?:auto|horizontal|vertical, area?:[x,y,w,h], nodes:[{id,label,kind?:service|database|user|queue|state|external,status?:neutral|active|added|removed|error,x?,y?,replaces?,at?|say?,exitAt?|exitSay?}], edges:[{id?,from,to,label?,status?,style?:solid|dashed,flow?,at?|say?}], steps?:[{at|say, add|remove|replace+with|set:{id:status}|send:[node ids] (+label, dur)}], groups?:[{id,label,nodes}]}. Up to 8 nodes, laid out in ranks along the edges; connectors wait for both ends, leave with removed components and route around others. Shared ids morph across consecutive canvas beats. clearframe sketch architecture|component-change|state-machine prints a starting diagram. See docs/system-diagrams.md.',
    moments:
      'Named moments of this beat, so one event drives many responses: {NAME: "a spoken word" | {say, after} | {at} | {cue: OTHER, after}}. Any element, key, along route, exit (exitCue), mark, document scroll or structured step (breakdown, process, decision, table show, reveal) lands on one with cue: NAME (+ after, negative to anticipate). Words are measured like every spoken cue; unknown names and loops are refused; sounds on those elements and keys move with them. See docs/moments.md.',
    sketchText:
      'Replacement words for a sketch’s placeholder type: {"TITLE": "Your words"}',
    sketchSay:
      'Spoken words for a sketch’s named moments, so they land on the voice: {"FIRST": "logs"} (each sketch’s use lists its cues)',
    sketchParams:
      'Numbers a sketch draws from (`clearframe sketch NAME` lists them): {"you": 5, "match": 4} draws five tokens and four, so the picture agrees with the figures',
    graph:
      'How an input changes an output: {fn:{kind: linear (m,b)|power (a·x^p)|exponential (a·e^(kx))|logistic (L,k,x0)|saturating (L(1−e^(−kx)))|log (a·ln(1+kx))|queue (M/M/1 at utilisation 0≤x<1; measure: inSystem ρ/(1−ρ)|waiting ρ²/(1−ρ)|time 1/(1−ρ))|wave (A,period,phase)|bell (mu,sigma)|constant (c)}, x:{domain:[a,b], label}, y?:{domain, label}, box?, draw?:{say|at,dur}, sweep?:{from,to,say|at,dur}, marks?:[{x,label,say|at}]}. The curve draws; on sweep the input moves and a point rides the curve with guides to both axes. Computed from the formula; no tick numbers, so it shows a shape, not data (film/explain.mjs)',
    accumulate:
      'Small amounts adding up: {rate:{kind,…}|number, x:{domain,label}, rateLabel?, totalLabel?, steps?:4–24, box?, fill?:{say|at,dur}, stack?:{say|at,dur}}. The rate curve is cut into equal steps (midpoint amounts) that appear in order, then lift and stack into a column whose height is their sum, normalised to the plot height (not on the rate axis) (film/explain.mjs)',
    estimate:
      'Noisy measurements settling: {value?, spread?, bias?, count?:8–60, seed?, label?, meanLabel?, trueLabel?, box?, show?:{say|at,dur}, band?, gather?:{say|at,dur}}. Seeded simulated measurements arrive; the running average and its ±1 standard-error band (spread/√n, for these independent samples) narrow — not a confidence guarantee; more samples shrink random error only, not bias; gather slides the same dots into a histogram of the spread. bias centres the samples off the true value, so the average settles in the wrong place. Labelled Simulated (film/explain.mjs)',
    field:
      'Where things flow: {kind: drift|swirl|source|sink|saddle|valley, box?, arrows?, particles?:6–40, seed?, show?:{say|at}, flow?:{say|at,dur}, labels?:[{text, pos:[u,v] (−1…1), say|at}]}. Arrows show the push everywhere; particles follow numerically integrated streamlines (RK4, sampled) at a constant pace over dur: routes follow the field, speeds do not. A chosen shape: a qualitative picture, not a fitted model of a crowd or market (film/explain.mjs)',
    place:
      'Draw this beat’s picture (its sketch and its own elements) as one panel of a world at [x, y] world pixels, or [x, y, scale]: give consecutive beats one world, a panel each and a view on it, then pull back to show them all (a board)',
    seed: 'Varies a sketch’s seeded layout (buildings, ridges, swell)',
    plates:
      'A generated depth plate set staged in depth: the id of an image asset declared with layers: true (its far, mid and near layers at z 6, 1.2 and -0.35), under any elements; adds a slow dolly unless the beat sets a camera',
  },
  {
    title: 'How an idea spreads',
    view: [1600, 640],
    stagger: 0.12,
    elements: [
      {
        type: 'circle',
        cx: 170,
        cy: 470,
        r: 70,
        fill: 'none',
        stroke: 'accent',
        width: 3,
        opacity: 0.5,
        enter: 'pop',
        loop: { type: 'pulse', period: 1.8, amount: 0.12 },
      },
      {
        type: 'path',
        d: 'M 170 470 C 520 470 640 150 1030 170 S 1350 160 1430 150',
        stroke: 'accent',
        width: 8,
        arrow: 'end',
        dur: 1.4,
      },
      { type: 'circle', cx: 170, cy: 470, r: 36, fill: 'accent' },
      {
        type: 'text',
        text: 'One idea',
        x: 170,
        y: 590,
        size: 40,
        anchor: 'middle',
        fill: 'ink',
      },
      {
        type: 'group',
        at: 1.2,
        stagger: 0.18,
        children: [
          { type: 'circle', cx: 700, cy: 300, r: 22, fill: 'accent2' },
          { type: 'circle', cx: 900, cy: 190, r: 22, fill: 'accent2' },
          { type: 'circle', cx: 1180, cy: 160, r: 22, fill: 'accent2' },
        ],
      },
      { type: 'circle', cx: 1430, cy: 150, r: 48, fill: 'accent2', at: 1.9 },
      {
        type: 'text',
        text: 'Adopted',
        x: 1430,
        y: 260,
        size: 40,
        anchor: 'middle',
        fill: 'ink',
        at: 2.1,
      },
      {
        type: 'circle',
        cx: 170,
        cy: 470,
        r: 12,
        fill: 'ink',
        enter: 'fade',
        at: 1.6,
        along: {
          d: 'M 170 470 C 520 470 640 150 1030 170 S 1350 160 1430 150',
          dur: 1.6,
        },
      },
    ],
  },
);
