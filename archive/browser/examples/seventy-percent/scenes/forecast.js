// Beats: hook → flip. One continuous scene: the number arrives, then gets unpacked into ten tiles.
export const css = `
.fc { position: absolute; inset: 0; }
.fc .group { position: absolute; left: 0; right: 0; top: 50%; display: flex; flex-direction: column; align-items: center; transform: translateY(-50%); }
.fc .big { font-family: var(--cf-display); font-size: calc(440px * var(--u)); line-height: 0.86; letter-spacing: -0.035em; }
.fc .sub { margin-top: calc(26px * var(--u)); font-size: var(--t-h3); color: var(--ink-2); letter-spacing: -0.02em; }
.fc .tiles { position: absolute; left: 50%; top: 61%; display: flex; gap: calc(18px * var(--u)); transform: translateX(-50%); }
.fc .tile { width: calc(104px * var(--u)); height: calc(104px * var(--u)); border-radius: calc(14px * var(--u)); background: var(--ink); }
.fc .legend { position: absolute; left: 50%; top: calc(61% + 140px * var(--u)); width: calc(1256px * var(--u)); transform: translateX(-50%); display: flex; justify-content: space-between; }
.fc .legend .b { color: var(--accent); }
`;

export const html = `
<div class="fc">
  <div class="group">
    <div class="big"><span class="num">70%</span></div>
    <div class="sub">chance the launch ships on time</div>
  </div>
  <div class="tiles">${'<div class="tile"></div>'.repeat(10)}</div>
  <div class="legend cf-h3"><span class="a cf-ink2">7 in 10 ship</span><span class="b">3 in 10 won’t</span></div>
</div>`;

export default function ({ el, b, beat, kit, tl }) {
  el.dataset.until = 'flip';
  const flip = beat('flip');
  const $ = (s) => el.querySelector(s);
  const tiles = [...el.querySelectorAll('.tile')];

  // hook: kicker first, then the number lands exactly on the spoken word.
  kit.reveal($('.big'), b.say('seventy') - 0.15, { by: 'chars', mask: true, stagger: 0.06, dur: 0.7, ease: kit.tokens.ease.snap });
  kit.reveal($('.sub'), b.say('sounds'), { by: 'words' });
  kit.drift($('.group'), b.start, flip.start, { scale: 1.025 });

  // flip: the number steps back and the tiles unpack what it means.
  tl.to($('.group'), { y: -270, scale: 0.56, duration: 0.9, ease: kit.tokens.ease.move }, flip.say('isn’t') - 0.1);
  tl.to($('.sub'), { opacity: 0.55, duration: 0.6 }, flip.say('isn’t'));
  tl.from(tiles, { opacity: 0, y: 24, duration: 0.45, stagger: 0.05, ease: kit.tokens.ease.in }, flip.say('means'));
  tl.to(tiles.slice(7), { backgroundColor: kit.color('--accent'), duration: 0.35, stagger: 0.08, ease: 'power2.out' }, flip.say('three'));
  kit.enter($('.legend .a'), flip.say('three') + 0.1, { y: 10 });
  kit.enter($('.legend .b'), flip.say('three') + 0.25, { y: 10 });
  kit.hit(tiles.slice(7), flip.say('won’t'), { scale: 1.06 });
}
