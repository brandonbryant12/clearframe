// One continuous scene for the whole short. Three states: the premise (big number),
// the evidence (a chart per direction, each on its own honest scale), the verdict (two numbers).
export const css = `
.sh { position: absolute; inset: 0; }
.sh .top { position: absolute; left: var(--safe-x); right: var(--safe-x); top: var(--safe-top); display: flex; justify-content: space-between; align-items: baseline; }
.sh .day { font-family: var(--cf-mono); font-size: var(--t-label); color: var(--dim); }
.sh .premise { position: absolute; left: var(--safe-x); right: var(--safe-x); top: 26%; text-align: center; }
.sh .hero { font-family: var(--cf-display); font-size: calc(460px * var(--u)); line-height: 0.85; letter-spacing: -0.04em; }
.sh .line2 { margin-top: calc(36px * var(--u)); font-size: var(--t-h2); line-height: 1.05; letter-spacing: -0.03em; font-weight: 600; color: var(--ink-2); }
.sh .chart { position: absolute; left: var(--safe-x); right: var(--safe-x); top: 24%; height: 44%; }
.sh .ctitle { position: absolute; left: var(--safe-x); right: var(--safe-x); top: calc(24% - 110px * var(--u)); font-size: var(--t-h3); font-weight: 600; letter-spacing: -0.02em; }
.sh .ctitle .up { color: var(--accent); } .sh .ctitle .down { color: var(--down); }
.sh .verdict { position: absolute; left: var(--safe-x); right: var(--safe-x); top: 22%; display: flex; flex-direction: column; gap: calc(70px * var(--u)); }
.sh .verdict .n { font-size: calc(260px * var(--u)); line-height: 0.9; }
.sh .verdict .up { color: var(--accent); } .sh .verdict .down { color: var(--down); }
.sh .verdict .l { font-size: var(--t-h3); color: var(--ink-2); margin-top: calc(10px * var(--u)); letter-spacing: -0.02em; }
`;

export const html = `
<div class="sh">
  <div class="top"><span class="cf-kicker">Daily change, compounded</span><span class="day">day <span class="d">1</span> / 365</span></div>
  <div class="premise"><div class="hero">1%</div><div class="line2"><span class="s">not 365% better</span></div></div>
  <div class="ctitle t1"><span class="up">1% better</span> every day</div>
  <div class="chart c1"></div>
  <div class="ctitle t2"><span class="down">1% worse</span> every day</div>
  <div class="chart c2"></div>
  <div class="verdict">
    <div class="a"><div class="n up cf-num">37.8×</div><div class="l">1% better, every day, for a year</div></div>
    <div class="b"><div class="n down cf-num">0.03×</div><div class="l">1% worse, every day, for a year</div></div>
  </div>
</div>`;

export default function ({ el, b, beat, kit, tl }) {
  el.dataset.until = 'end';
  const year = beat('year'), math = beat('math'), worse = beat('worse'), end = beat('end');
  const $ = (s) => el.querySelector(s);
  const days = Array.from({ length: 53 }, (_, i) => Math.round((i * 365) / 52)); // day 0 … day 365 exactly
  const opts = { area: true, grid: true, yTicks: 4, xLabels: [[0, 'day 1'], [52, 'day 365']], pad: { right: 150, left: 96, bottom: 64 } };

  // premise
  kit.enter($('.top'), b.at(0.05), { y: 10 });
  kit.reveal($('.hero'), b.say('one') - 0.1, { by: 'chars', mask: true, stagger: 0.07, dur: 0.6, ease: kit.tokens.ease.snap });
  kit.drift($('.premise'), b.start, year.end, { scale: 1.04 });
  const day = { v: 1 };
  tl.fromTo(day, { v: 1 }, { v: 365, duration: math.end - b.say('every'), ease: 'none', immediateRender: false }, b.say('every'));
  CF.onFrame(() => { const s = String(Math.round(day.v)); if ($('.d').textContent !== s) $('.d').textContent = s; });
  kit.reveal($('.line2'), year.say('three') - 0.1, { by: 'words' });
  kit.mark($('.line2 .s'), year.say('not'), { kind: 'strike', color: 'var(--ink-2)' });

  // evidence 1: better — its own scale, 0–40×
  kit.exit($('.premise'), math.at(0), { dur: 0.3 });
  kit.enter($('.t1'), math.at(0.05), { y: 12 });
  const c1 = kit.lineChart($('.c1'), { ...opts, data: days.map((d) => ({ x: d, y: 1.01 ** d })), min: 0, max: 40, yFormat: (v) => `${v}×`, tipFormat: (v) => `${v.toFixed(1)}×` });
  c1.axes(math.at(0.05)).draw(math.say('about') - 0.1, { dur: 1.5, ease: 'power2.in' });

  // evidence 2: worse — its own scale, 0–1×, so the collapse is visible
  kit.exit([$('.t1'), $('.c1')], worse.at(0), { dur: 0.3 });
  kit.enter($('.t2'), worse.at(0.1), { y: 12 });
  const c2 = kit.lineChart($('.c2'), { ...opts, data: days.map((d) => ({ x: d, y: 0.99 ** d })), min: 0, max: 1, color: 'var(--down)', yFormat: (v) => `${v}×`, tipFormat: (v) => `${v.toFixed(2)}×` });
  c2.axes(worse.at(0.1)).draw(worse.say('you') - 0.2, { dur: 1.4, ease: 'power2.out' });

  // verdict
  kit.exit([$('.t2'), $('.c2')], end.at(0), { dur: 0.3 });
  kit.enter($('.verdict .a'), end.say('small'), { y: 24 });
  kit.enter($('.verdict .b'), end.say('both'), { y: 24 });
}
