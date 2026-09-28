// Build a chart, then point: bars grow on the claim, then one bar takes the accent on its number.
export const css = `
.cv { position: absolute; inset: var(--safe-top) var(--safe-x) var(--safe-bottom); display: grid; grid-template-rows: auto 1fr; gap: calc(40px * var(--u)); }
.cv .q { font-family: var(--cf-display); font-size: var(--t-h1); line-height: 1; letter-spacing: -0.015em; }
.cv .q em { color: var(--ink-2); }
.cv .bars { height: 100%; padding: 0 calc(120px * var(--u)); transform-origin: 50% 100%; }
.cv .note { position: absolute; right: 0; top: calc(20px * var(--u)); font-size: var(--t-h3); color: var(--accent); font-weight: 600; }
`;
export const html = `<div class="cv"><div class="q">Wait time <em>vs.</em> how busy you are</div><div class="bars"></div><div class="note">9× the wait</div></div>`;

export default function ({ el, b, beat, kit, data }) {
  el.dataset.until = 'point';
  const point = beat('point');
  const rho = data?.utilisation ?? [0.5, 0.8, 0.9, 0.95];
  const bars = kit.bars(el.querySelector('.bars'), {
    data: rho.map((r) => ({ label: `${Math.round(r * 100)}% busy`, value: r / (1 - r) })),
    format: (v) => `${Math.round(v)}×`,
  });
  kit.reveal(el.querySelector('.q'), b.at(0.1), { by: 'words' });
  kit.drift(el.querySelector('.bars'), b.start, point.end + 0.6, { scale: 1.025, y: -6 });
  bars.grow(b.say('grow'), { stagger: 0.12 });
  bars.focus(2, point.say('ninety'));
  kit.enter(el.querySelector('.note'), point.say('nine'), { y: 12 });
  kit.source(el, 'Model: single-server queue, relative wait ≈ ρ/(1−ρ). Illustrative.', b.at(1.2));
}
