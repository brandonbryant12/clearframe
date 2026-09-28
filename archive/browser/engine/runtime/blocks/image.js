import { esc, md } from './_lib.js';
export const meta = {
  tail: 0.9, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Full-bleed image or footage — slow Ken Burns push, a legibility scrim, kicker + title + credit overlaid.',
  use: 'Establishing plates and generated textures (gemini-image / veo-video assets). The words on top carry the meaning.',
  props: { asset: 'storyboard asset id (image or clip)', src: 'or a path', title: 'overlay headline; *word* = accent', kicker: '', credit: "e.g. 'AI-generated image'", position: "'bottom-left' | 'center'", focus: "object-position, e.g. '50% 30%'", push: 'Ken Burns scale (1.07)' },
  defaults: { position: 'bottom-left', push: 1.07, focus: '50% 50%' },
  example: { vo: 'Every plan starts with a forecast — and every forecast starts with an honest question.', props: { kicker: 'Chapter one', title: 'Start with an *honest* question', credit: 'Backdrop: code-rendered placeholder — swap in an image asset' } },
};
export const css = `
.b-img { position: absolute; inset: 0; overflow: hidden; }
.b-img .media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.b-img .ph { position: absolute; inset: 0; background: radial-gradient(120% 90% at 30% 20%, var(--accent-soft), var(--bg-2) 60%, var(--bg)); }
.b-img .scrim { position: absolute; inset: 0; background: linear-gradient(to top, color-mix(in oklab, var(--bg) 92%, transparent) 0%, color-mix(in oklab, var(--bg) 40%, transparent) 45%, transparent 75%); }
.b-img .txt { position: absolute; left: var(--safe-x); right: var(--safe-x); bottom: var(--safe-bottom); display: flex; flex-direction: column; gap: calc(22px * var(--u)); }
.b-img.p-center .txt { top: 0; bottom: 0; justify-content: center; align-items: center; text-align: center; }
.b-img .t { font-family: var(--cf-display); font-size: calc(120px * var(--u)); line-height: 1; letter-spacing: -0.02em; max-width: 16ch; }
:root[data-format='vertical'] .b-img .t { font-size: calc(104px * var(--u)); }
.b-img .credit { position: absolute; right: var(--safe-x); bottom: calc(var(--safe-bottom) * 0.45); font-family: var(--cf-mono); font-size: calc(20px * var(--u)); color: var(--dim); }
`;
export function html(p, ctx) {
  const asset = p.asset ? (ctx.timing.assets ?? []).find((a) => a.id === p.asset) : null;
  const src = p.src ?? asset?.src;
  const media = !src ? '<div class="media ph"></div>' : /\.(mp4|webm|mov)$/i.test(src) ? `<video class="media" src="${esc(src)}" muted playsinline style="object-position:${p.focus}"></video>` : `<img class="media" src="${esc(src)}" alt="" style="object-position:${p.focus}">`;
  return `<div class="b-img p-${p.position}">${media}<div class="scrim"></div><div class="txt">${p.kicker ? `<div class="cf-kicker k">${esc(p.kicker)}</div>` : ''}${p.title ? `<div class="t">${md(p.title)}</div>` : ''}</div>${p.credit ? `<div class="credit" data-safe="margin">${esc(p.credit)}</div>` : ''}</div>`;
}
export default function ({ el, b, kit, tl, cue, props: p }) {
  const media = el.querySelector('.media');
  if (media.tagName === 'VIDEO') media.dataset.start = b.id;
  tl.from(media, { opacity: 0, duration: 0.6 }, b.at(0));
  kit.drift(media, b.start, b.end + 0.6, { scale: p.push, x: -12, y: -6 });
  const t0 = cue(p.land, 0.5);
  const k = el.querySelector('.k'), t = el.querySelector('.t');
  if (k) kit.enter(k, t0 - 0.15, { y: 10 });
  if (t) kit.reveal(t, t0, { by: 'words', mask: true, stagger: 0.06, dur: 0.8 });
  const credit = el.querySelector('.credit');
  if (credit) tl.from(credit, { opacity: 0, duration: 0.5 }, t0 + 0.5);
}
