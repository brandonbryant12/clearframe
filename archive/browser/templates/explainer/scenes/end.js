// End card: the verdict in serif, held long enough to read.
export const css = `
.ed { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(28px * var(--u)); text-align: center; }
.ed .t { font-family: var(--cf-display); font-size: calc(150px * var(--u)); line-height: 1; letter-spacing: -0.02em; }
.ed .t em { color: var(--accent); }
.ed .s { font-size: var(--t-h3); color: var(--ink-2); }
`;
export const html = `<div class="ed"><div class="t">Slack is <em>not</em> waste.</div><div class="s">It’s what keeps work moving.</div></div>`;

export default function ({ el, b, kit }) {
  kit.reveal(el.querySelector('.t'), b.say('leave') - 0.1, { by: 'words', mask: true, stagger: 0.07, dur: 0.8 });
  kit.reveal(el.querySelector('.s'), b.say('it’s'), { by: 'words' });
}
