// One scene for the whole short: a "document" of lines where the decision moves from buried to first.
export const css = `
.ds { position: absolute; inset: var(--safe-top) var(--safe-x) var(--safe-bottom); }
.ds .doc { position: absolute; left: 0; right: 0; top: 14%; display: flex; flex-direction: column; gap: calc(26px * var(--u)); }
.ds .ln { height: calc(34px * var(--u)); border-radius: calc(8px * var(--u)); background: var(--line); }
.ds .ask { height: auto; background: var(--accent); color: var(--accent-ink); font-weight: 650; font-size: var(--t-h3); padding: calc(22px * var(--u)) calc(28px * var(--u)); letter-spacing: -0.02em; }
.ds .words { position: absolute; left: 0; right: 0; top: 18%; display: flex; flex-direction: column; gap: calc(10px * var(--u)); }
.ds .w { font-family: var(--cf-display); font-size: calc(250px * var(--u)); line-height: 0.9; letter-spacing: -0.03em; }
.ds .w.b { color: var(--ink-2); font-style: italic; }
`;
const widths = [92, 78, 88, 64, 84, 72, 90, 58];
export const html = `
<div class="ds">
  <div class="doc">${widths.map((w) => `<div class="ln" style="width:${w}%"></div>`).join('')}<div class="ln ask">Can we ship Friday? Need a yes by 3pm.</div></div>
  <div class="words"><div class="w a">Decision.</div><div class="w b">Context.</div></div>
</div>`;

export default function ({ el, b, beat, kit, tl }) {
  el.dataset.until = 'end';
  const fix = beat('fix'), end = beat('end');
  const $ = (s) => el.querySelector(s);
  const lines = [...el.querySelectorAll('.ln:not(.ask)')];
  const ask = $('.ask');

  // hook: the buried ask
  tl.from(lines, { scaleX: 0, transformOrigin: '0 50%', duration: 0.5, stagger: 0.05, ease: kit.tokens.ease.in }, b.at(0.05));
  kit.enter(ask, b.say('bury') - 0.1, { y: 16 });

  // fix: move the ask to the top (FLIP-style: measure, then tween the offset)
  const dy = ask.offsetTop - lines[0].offsetTop;
  const rowH = ask.offsetHeight + parseFloat(getComputedStyle($('.doc')).gap);
  tl.to(ask, { y: -dy, duration: 0.9, ease: kit.tokens.ease.move }, fix.say('put') - 0.1);
  tl.to(lines, { y: rowH, duration: 0.9, ease: kit.tokens.ease.move }, fix.say('put') - 0.1);
  kit.hit(ask, fix.say('first'), { scale: 1.03 });

  // end: the rule
  tl.to($('.doc'), { opacity: 0, y: -30, duration: 0.4, ease: kit.tokens.ease.out }, end.at(0));
  kit.reveal($('.w.a'), end.say('decision') - 0.1, { by: 'chars', mask: true, stagger: 0.03 });
  kit.reveal($('.w.b'), end.say('context') - 0.1, { by: 'chars', mask: true, stagger: 0.03 });
}
