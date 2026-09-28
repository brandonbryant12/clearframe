// Matched native/JS fixture. Read the same scene data the Rust exporter consumes.
const spec = await fetch('/fframes.json').then((r) => r.json());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const html = '';
export default function ({ el, b, tl }) {
  const s = spec.beats[b.id];
  const rows = s.rows ?? [];
  el.innerHTML = `<svg class="paired-svg" viewBox="0 0 1920 1080" xmlns="http://www.w3.org/2000/svg">
    <rect width="1920" height="1080" fill="#f5f3ed"/>
    <text x="180" y="180" font-weight="400" font-size="30" fill="#505966">RENDERER COMPARISON</text>
    <g class="head">
      <text x="180" y="330" font-weight="600" font-size="76" fill="#222831">${esc(s.headline)}</text>
      <text x="180" y="890" font-weight="400" font-size="38" fill="#505966">${esc(s.support)}</text>
    </g>
    ${rows.map((r, i) => `<g>
      <text x="180" y="${486 + i * 120}" font-weight="400" font-size="36" fill="#222831">${esc(r.label)}</text>
      <rect class="bar" x="530" y="${450 + i * 120}" width="0.01" height="48" fill="#315cce"/>
      <text x="1590" y="${486 + i * 120}" font-weight="400" font-size="36" fill="#222831">${esc(r.value)} h</text>
    </g>`).join('')}
    <text x="180" y="978" font-weight="400" font-size="28" fill="#505966">${esc(s.source)}</text>
  </svg>`;
  // Native ease_out is cubic; GSAP power2.out is the matching cubic equation.
  const cue = Math.max(b.start, b.say(s.cue) - 0.15);
  tl.fromTo(el.querySelector('.head'), { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', immediateRender: false }, cue);
  el.querySelectorAll('.bar').forEach((bar, i) => {
    tl.fromTo(bar, { attr: { width: 0.01 } }, { attr: { width: 1000 * rows[i].value / s.max }, duration: 1.2, ease: 'power2.out', immediateRender: false }, cue + i * 0.1);
  });
}
