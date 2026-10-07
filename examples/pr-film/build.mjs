// A pull-request explainer made from this repository's own history: commit 92b0762, which keeps
// stage code editors and actors inside the frame. Every figure is from a recorded run (see
// README.md); the code is read from the commit at render time. One storyboard per frame shape,
// each with positions authored for its own frame.
// usage: node examples/pr-film/build.mjs
import fs from 'node:fs';

const dir = new URL('.', import.meta.url);
const COMMIT = '92b0762';

function storyboard(shape) {
  const tall = shape === 'vertical';
  // One centre for the frame-swap beats; the miniature frames and actors are laid out around it.
  const c = tall ? { x: 540, y: 820 } : { x: 960, y: 610 };
  const wide = tall ? { w: 860, h: 480 } : { w: 1480, h: 560 };
  const narrow = tall ? { w: 440, h: 820 } : { w: 380, h: 600 };
  const row = tall ? [-290, 0, 290] : [-520, 0, 520];
  const column = tall ? [-260, 0, 260] : [-190, 0, 190];
  const frameRect = (id, size, extra) => ({ type: 'rect', id, x: c.x - size.w / 2, y: c.y - size.h / 2, w: size.w, h: size.h, r: 26, fill: 'none', stroke: 'muted', width: 3, dash: [14, 10], ...extra });
  const actor = (id, label, i) => ({ id, label, kind: ['client', 'service', 'process'][i], x: c.x + row[i], y: c.y, w: 250, at: 0.3 + i * 0.2 });

  // The symptom: a phone-sized frame whose code runs past its edge, beside the audit's finding.
  // The overflow has to cross the drawn phone's edge while staying inside the real frame's safe area.
  const phone = tall ? { x: 200, y: 330, w: 420, h: 820 } : { x: 360, y: 150, w: 420, h: 800 }, codeSize = tall ? 24 : 26;
  const codeLines = ['let angle = (w[1].1 - w[0].1)', '  .atan2(w[1].0 - w[0].0);', 'return Some(((w[0].0 + (w[1].0 - w[0].0) * t,', '  w[0].1 + (w[1].1 - w[0].1) * t), angle));'];
  // The audit's finding sits clear of the overflowing lines: below the phone on both shapes.
  const audit = tall ? { x: 140, y: 1330, w: 800 } : { x: 860, y: 690, w: 940 };
  const symptom = [
    // The phone is the establishing picture: on screen from the first frame.
    { type: 'rect', id: 'phone', x: phone.x, y: phone.y, w: phone.w, h: phone.h, r: 48, fill: 'surface', stroke: 'ink', width: 4, at: 0, enter: 'none' },
    { type: 'rect', id: 'phone-notch', x: phone.x + phone.w / 2 - 50, y: phone.y + 18, w: 100, h: 14, r: 7, fill: 'line', at: 0, enter: 'none' },
    ...codeLines.map((text, i) => ({ type: 'text', id: `code-${i}`, text, x: phone.x + 34, y: phone.y + 150 + i * 46, size: codeSize, font: 'mono', fill: i > 1 ? 'negative' : 'ink', at: 0.6 + i * 0.25, enter: 'type' })),
    { type: 'line', id: 'edge', x1: phone.x + phone.w, y1: phone.y + 110, x2: phone.x + phone.w, y2: phone.y + 360, stroke: 'negative', width: 5, say: 'phone', enter: 'draw' },
    { type: 'rect', id: 'audit-card', x: audit.x, y: audit.y, w: audit.w, h: 200, r: 18, fill: 'ink', say: 'flagged', enter: 'fade' },
    { type: 'text', id: 'audit-head', text: 'clearframe check', x: audit.x + 36, y: audit.y + 58, size: 24, font: 'mono', fill: 'muted', say: 'flagged', enter: 'fade' },
    { type: 'text', id: 'audit-error', text: 'error: code cut off by the frame edge', x: audit.x + 36, y: audit.y + 112, size: 30, font: 'mono', fill: 'bg', say: 'flagged', enter: 'type', fit: audit.w - 72 },
    { type: 'text', id: 'audit-warn', text: '+ 7 title-safe warnings', x: audit.x + 36, y: audit.y + 160, size: 26, font: 'mono', fill: 'accent2', say: 'flagged', enter: 'fade', fit: audit.w - 72 },
  ];
  // The bookend: the same phone, its code now set by the editor that fits its longest line.
  const fixed = [
    { type: 'rect', id: 'phone', x: phone.x, y: phone.y, w: phone.w, h: phone.h, r: 48, fill: 'surface', stroke: 'ink', width: 4, at: 0, enter: 'none' },
    { type: 'rect', id: 'phone-notch', x: phone.x + phone.w / 2 - 50, y: phone.y + 18, w: 100, h: 14, r: 7, fill: 'line', at: 0, enter: 'none' },
  ];

  return {
    version: 2,
    title: 'Code that fits the phone',
    logline: 'A pull-request explainer from ClearFrame commit 92b0762: the symptom, the cause, the new layout, the code that measures, the checks and the limits.',
    format: { preset: shape, fps: 30 },
    theme: 'paper', type: 'inter', motion: { preset: 'gentle', intensity: 0.6 }, transition: 'cut', backdrop: 'none', camera: 'none', lens: { handheld: 0 },
    texture: { grain: 0.25, vignette: 0.3 },
    captions: false, music: false,
    sources: [
      { id: 'commit', title: `ClearFrame commit ${COMMIT} (scene/code.mjs, scene/recipes.mjs, scene/compile.mjs)` },
      { id: 'audit', title: 'clearframe check --draft on examples/stage-pr shown vertically: 1 error and 7 title-safe warnings at b2b7540, none at 92b0762' },
      { id: 'tests', title: 'node --test test/stage-fit.test.mjs at 92b0762: 3 of 3 pass' },
    ],
    stages: [{
      id: 'frames', from: 'cause', to: 'relayout', z: 'under',
      actors: ['CLI', 'Daemon', 'Child'].map((label, i) => actor(label.toLowerCase(), label, i)),
      links: [{ from: 'cli', to: 'daemon', route: 'straight' }, { from: 'daemon', to: 'child', route: 'straight' }],
      under: [
        frameRect('wide-frame', wide, { at: 0.1, enter: 'fade', exitSay: { beat: 'cause', say: 'tall' }, exit: 'fade' }),
        frameRect('tall-frame', narrow, { say: { beat: 'cause', say: 'tall' }, enter: 'fade', stroke: 'ink' }),
      ],
      events: [
        { do: 'state', actor: 'cli', status: 'error', say: { beat: 'cause', say: 'fall' } },
        { do: 'state', actor: 'child', status: 'error', say: { beat: 'cause', say: 'fall' } },
        { do: 'callout', actor: 'child', text: 'off the screen', side: tall ? 'bottom' : 'top', say: { beat: 'cause', say: 'sides' }, untilSay: { beat: 'relayout', say: 'Now' } },
        ...['cli', 'daemon', 'child'].map((id, i) => ({ do: 'move', actor: id, x: c.x, y: c.y + column[i], dur: 1.1, say: { beat: 'relayout', say: 'laid' } })),
        ...['cli', 'daemon', 'child'].map(id => ({ do: 'state', actor: id, status: 'done', say: { beat: 'relayout', say: 'order' } })),
      ],
    }],
    beats: [
      { id: 'symptom', block: 'stage', min: 6,
        vo: 'Why did the code in our pull-request videos run off a phone screen? The frame audit flagged it, and it was right.',
        props: { source: 'Reproduced with clearframe check at b2b7540', elements: symptom } },
      { id: 'cause', block: 'stage', min: 6,
        vo: 'The stage was drawn for a wide frame. In a tall one, the same positions fall off both sides.',
        props: { title: 'Positions were drawn for a wide frame', source: `scene/recipes.mjs before ${COMMIT}` } },
      { id: 'relayout', block: 'stage', min: 6, tail: 0.8,
        vo: 'Now a stage drawn wide is laid down the tall frame in the same order, so every actor stays on screen.',
        props: { source: `scene/recipes.mjs at ${COMMIT}` } },
      { id: 'measure', block: 'stage', min: 8, transition: 'panel',
        vo: 'The code editor measures its longest line in the mono face, and never sets type below twenty-four pixels. A longer line wraps instead of disappearing.',
        props: { title: 'The editor measures its longest line', source: `git show ${COMMIT} -- scene/code.mjs`,
          code: { commit: COMMIT, file: 'scene/code.mjs', repo: '../..', window: [118, 124], say: 'measures', x: tall ? 108 : 160, y: tall ? 440 : 320, w: tall ? 864 : 1600, size: 30 } } },
      { id: 'checked', block: 'delta', min: 7, tail: 1,
        vo: 'On the same example, one error and seven warnings went to none, and three new tests keep it that way.',
        props: { title: 'Checked on the same example', from: { value: 8, label: 'audit findings at b2b7540' }, to: { value: 0, label: `at ${COMMIT}` }, better: 'down', land: 'error', change: 'all cleared',
          support: '1 error and 7 title-safe warnings on stage-pr shown vertically; 3 new tests pass', source: 'clearframe check on examples/stage-pr (vertical); test/stage-fit.test.mjs' } },
      { id: 'fits', block: 'stage', min: 7, tail: 1.2, transition: 'fade',
        vo: 'Now the code fits the phone. The fit keeps order, not exact placement, and a slow camera push can still drift edge text. That is next.',
        props: { source: `scene/code.mjs at ${COMMIT}: a line too long for the editor wraps with a hanging indent`, elements: fixed,
          code: { id: 'fitted', x: phone.x + 20, y: phone.y + 90, w: phone.w - 40, size: 30, gutter: false, say: 'fits',
            before: codeLines.slice(0, 2).join('\n'), after: [...codeLines.slice(0, 2), 'return Some(((w[0].0 + (w[1].0 - w[0].0) * t, w[0].1 + (w[1].1 - w[0].1) * t), angle));'].join('\n') },
          over: [{ type: 'text', id: 'limit', text: 'Keeps order, not placement', x: tall ? 540 : phone.x + phone.w + 120, y: tall ? 1340 : 560, size: tall ? 44 : 52, font: 'display', fill: 'ink', anchor: tall ? 'middle' : 'start', say: 'order', enter: 'fade', fit: tall ? 860 : 900 }] } },
    ],
  };
}

for (const shape of ['landscape', 'vertical']) fs.writeFileSync(new URL(`storyboard-${shape}.json`, dir), JSON.stringify(storyboard(shape), null, 1) + '\n');
console.log('wrote storyboard-landscape.json and storyboard-vertical.json');
