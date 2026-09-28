// The number reveal blueprint: hero figure lands on its spoken word, caption follows, slow drift.
export const css = `
.hk { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; }
.hk .big { font-family: var(--cf-display); font-size: calc(440px * var(--u)); line-height: 0.86; letter-spacing: -0.035em; }
.hk .sub { margin-top: calc(24px * var(--u)); font-size: var(--t-h3); color: var(--ink-2); letter-spacing: -0.02em; }
`;
export const html = `<div class="hk"><div class="big">90%</div><div class="sub">of capacity, booked</div></div>`;

export default function ({ el, b, kit }) {
  kit.reveal(el.querySelector('.big'), b.say('ninety') - 0.15, { by: 'chars', mask: true, stagger: 0.06, dur: 0.7, ease: kit.tokens.ease.snap });
  kit.reveal(el.querySelector('.sub'), b.say('busy'), { by: 'words' });
  kit.drift(el.querySelector('.hk'), b.start, b.end + 0.5, { scale: 1.03 });
}
