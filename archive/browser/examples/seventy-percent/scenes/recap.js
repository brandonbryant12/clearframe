// Beat: recap. Three takeaways, each landing on its spoken phrase.
export const css = `
.rc { position: absolute; inset: var(--safe-top) var(--safe-x) var(--safe-bottom); display: flex; flex-direction: column; justify-content: center; gap: calc(40px * var(--u)); padding-left: calc(120px * var(--u)); }
.rc .row { display: grid; grid-template-columns: calc(110px * var(--u)) 1fr; align-items: baseline; border-top: 2px solid var(--line); padding-top: calc(30px * var(--u)); max-width: calc(1300px * var(--u)); }
.rc .i { font-family: var(--cf-mono); font-size: var(--t-label); color: var(--accent); }
.rc .t { font-family: var(--cf-display); font-size: calc(108px * var(--u)); line-height: 1; letter-spacing: -0.015em; }
.rc .t em { color: var(--ink-2); font-style: italic; }
`;

export const html = `
<div class="rc">
  <div class="row r1"><span class="i">01</span><span class="t">Seventy is likely — <em>not certain.</em></span></div>
  <div class="row r2"><span class="i">02</span><span class="t">Check the calibration.</span></div>
  <div class="row r3"><span class="i">03</span><span class="t">Plan for the thirty.</span></div>
</div>`;

export default function ({ el, b, kit }) {
  const $ = (s) => el.querySelector(s);
  const rows = [['.r1', 'seventy'], ['.r2', 'check'], ['.r3', 'plan']];
  for (const [sel, word] of rows) {
    const t = b.say(word) - 0.15;
    kit.enter($(`${sel}`), t, { y: 18, dur: 0.55 });
    kit.reveal($(`${sel} .t`), t + 0.05, { by: 'words', stagger: 0.04 });
  }
}
