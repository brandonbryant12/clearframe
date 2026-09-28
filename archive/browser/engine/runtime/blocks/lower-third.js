import { esc } from './_lib.js';
export const meta = {
  tail: 1.0, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Lower third — name and role strap, optionally over a full-bleed image or clip.',
  use: 'Identify a speaker, place or document over footage. Keep on screen 3–5 s.',
  props: { name: 'primary line', role: 'secondary line', src: 'optional image/video path behind it', asset: 'or a storyboard asset id' },
  defaults: {},
  example: { vo: 'Maya leads capacity planning for the platform team.', props: { name: 'Maya Chen', role: 'Capacity planning · Platform team (fictional)' } },
};
export const css = `
.b-lt-media { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.b-lt { position: absolute; left: var(--safe-x); bottom: calc(var(--safe-bottom) + 20px * var(--u)); display: flex; gap: calc(26px * var(--u)); align-items: stretch; }
.b-lt .bar { width: calc(8px * var(--u)); background: var(--accent); border-radius: 4px; transform-origin: 50% 100%; }
.b-lt .txt { display: flex; flex-direction: column; justify-content: center; gap: calc(8px * var(--u)); padding: calc(18px * var(--u)) calc(30px * var(--u)) calc(18px * var(--u)) 0; }
.b-lt .n { font-size: calc(60px * var(--u)); font-weight: 650; letter-spacing: -0.025em; line-height: 1; }
.b-lt .r { font-size: var(--t-label); color: var(--ink-2); }
`;
export function html(p) {
  const src = p.src ?? (p.asset ? `assets/img/${p.asset}.jpg` : null);
  const media = src ? (/\.(mp4|webm|mov)$/i.test(src) ? `<video class="b-lt-media" src="${esc(src)}" muted playsinline></video>` : `<img class="b-lt-media" src="${esc(src)}" alt="">`) : '';
  return `${media}<div class="b-lt"><div class="bar"></div><div class="txt"><div class="n">${esc(p.name ?? '')}</div><div class="r">${esc(p.role ?? '')}</div></div></div>`;
}
export default function ({ el, b, tl, kit, cue, props: p }) {
  const v = el.querySelector('video');
  if (v) v.dataset.start = b.id;
  const media = el.querySelector('.b-lt-media');
  if (media) kit.drift(media, b.start, b.end + 0.5, { scale: 1.05 });
  const t0 = cue(p.at, 0.4);
  tl.from(el.querySelector('.bar'), { scaleY: 0, duration: 0.45, ease: 'power3.out' }, t0);
  tl.from(el.querySelector('.txt'), { clipPath: 'inset(0 100% 0 0)', x: -30, duration: 0.7, ease: 'power3.out' }, t0 + 0.15);
  tl.to(el.querySelector('.b-lt'), { opacity: 0, x: -20, duration: 0.35, ease: 'power2.in' }, b.end - 0.45);
}
