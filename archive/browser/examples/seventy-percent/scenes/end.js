// Beat: end. Title card and a plain-language footnote, held long enough to read.
export const css = `
.en { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center; }
.en .t { font-family: var(--cf-display); font-size: calc(128px * var(--u)); line-height: 1; letter-spacing: -0.02em; max-width: calc(1400px * var(--u)); }
.en .t em { font-style: italic; color: var(--accent); }
`;

export const html = `<div class="en"><div class="t">Seventy percent is <em>not</em> a promise.</div></div>`;

export default function ({ el, b, kit }) {
  kit.reveal(el.querySelector('.t'), b.at(0.3), { by: 'words', mask: true, stagger: 0.07, dur: 0.8 });
  kit.footnote(el, 'Hypothetical illustration — figures are explanatory, not real-world data.', b.at(0.9));
}
