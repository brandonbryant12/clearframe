// Beats: hundred → seventy → thirty. A unit chart makes "70%" countable.
export const css = `
.hd { position: absolute; inset: var(--safe-top) var(--safe-x) var(--safe-bottom); display: grid; grid-template-columns: calc(680px * var(--u)) 1fr; gap: calc(140px * var(--u)); align-items: center; }
.hd .waffle { width: calc(680px * var(--u)); height: calc(680px * var(--u)); }
.hd .col { display: flex; flex-direction: column; gap: calc(34px * var(--u)); }
.hd .stat { display: flex; align-items: baseline; gap: calc(28px * var(--u)); }
.hd .stat .n { font-size: calc(200px * var(--u)); line-height: 0.9; min-width: 2.1ch; }
.hd .stat .l { font-size: var(--t-h3); color: var(--ink-2); letter-spacing: -0.02em; }
.hd .stat.slip .n { color: var(--accent); }
.hd .note { font-size: var(--t-h3); line-height: 1.25; letter-spacing: -0.02em; color: var(--ink-2); margin-top: calc(10px * var(--u)); }
.hd .note .w { color: var(--ink); }
`;

export const html = `
<div class="hd">
  <div class="waffle"></div>
  <div class="col">
    <div class="cf-kicker k">100 launches · same 70% forecast</div>
    <div class="stat ship"><span class="n">0</span><span class="l">ship on time</span></div>
    <div class="stat slip"><span class="n">0</span><span class="l">slip</span></div>
    <div class="note"><div class="l1">That’s not the forecast failing.</div><div class="l2">It’s the forecast <span class="w">working.</span></div></div>
  </div>
</div>`;

export default function ({ el, b, beat, kit }) {
  el.dataset.until = 'thirty';
  const seventy = beat('seventy'), thirty = beat('thirty');
  const $ = (s) => el.querySelector(s);

  const grid = kit.waffle($('.waffle'), { total: 100, cols: 10, color: 'var(--line)' });
  grid.show(b.at(0.15), { from: 'center', each: 0.008 });
  grid.pulse(100, b.say('hundred'));
  kit.enter($('.k'), b.at(0.1), { y: 12 });

  grid.fill(70, seventy.say('seventy') - 0.05, { color: 'var(--ink)', order: 'rows', each: 0.011 });
  kit.enter($('.ship'), seventy.say('seventy') - 0.1, { y: 16 });
  kit.counter($('.ship .n'), seventy.say('seventy') - 0.05, { to: 70, dur: 0.85 });

  grid.fill(30, thirty.say('thirty') - 0.05, { color: 'var(--accent)', order: 'rows', start: 70, each: 0.02 });
  kit.enter($('.slip'), thirty.say('thirty') - 0.1, { y: 16 });
  kit.counter($('.slip .n'), thirty.say('thirty') - 0.05, { to: 30, dur: 0.7 });
  kit.reveal($('.note .l1'), thirty.say('that’s'), { by: 'words' });
  kit.reveal($('.note .l2'), thirty.say('it’s'), { by: 'words' });
  kit.mark($('.note .w'), thirty.say('working'), { kind: 'underline', color: 'var(--accent)' });
}
