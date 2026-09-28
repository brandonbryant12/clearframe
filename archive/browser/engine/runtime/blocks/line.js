import { head, animateHead, finish, formatter } from './_lib.js';
export const meta = {
  tail: 1.3, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Trend line — axes, a line that draws itself with the value riding its tip, marks and bands on cue.',
  use: 'Change over time. Say what to watch before it draws. Optional dashed baseline for comparison.',
  props: { series: 'numbers or [{ x, y }]', labels: "x labels: array (first/last used) or [[index, 'label'], …]", min: 'y min (default 0)', max: 'y max', format: "value format ({ prefix, suffix, decimals } or '%')", marks: "[{ i, label, say }]", band: '{ from, to, label, say } (index range)', baseline: "{ series, label } dashed comparison", drawSay: 'word that starts the draw', dur: 'draw seconds (1.6)', kicker: '', title: '', source: '' },
  defaults: { dur: 1.6, min: 0 },
  example: { vo: 'Weekly active teams climbed steadily, then jumped after the September launch.', props: { title: 'Weekly active teams', series: [120, 128, 131, 140, 146, 151, 158, 163, 171, 176, 214, 238, 251], labels: ['Jun', 'Sep'], marks: [{ i: 10, label: 'Launch', say: 'jumped' }], drawSay: 'climbed', source: 'Product analytics (sample data)' } },
};
export const css = `.b-line .blk-body { margin-top: calc(10px * var(--u)); }`;
export const html = (p) => `<div class="blk b-line">${head(p)}<div class="blk-body"></div></div>`;
export default function (ctx) {
  const { el, b, kit, cue, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const body = el.querySelector('.blk-body');
  const pts = (p.series ?? []).map((d, i) => (typeof d === 'number' ? { x: i, y: d } : d));
  const all = [...pts, ...((p.baseline?.series ?? []).map((d, i) => (typeof d === 'number' ? { x: i, y: d } : d)))];
  const max = p.max ?? Math.max(...all.map((d) => d.y)) * 1.1;
  const dec = typeof p.format === 'object' && p.format?.decimals != null ? p.format.decimals : 0;
  const fmt = formatter(p.format, dec);
  let xLabels = p.labels;
  if (Array.isArray(xLabels) && xLabels.length && !Array.isArray(xLabels[0])) {
    xLabels = xLabels.length === pts.length ? xLabels.map((l, i) => [i, l]).filter((_, i) => i === 0 || i === pts.length - 1 || i === Math.floor(pts.length / 2))
      : [[0, xLabels[0]], [pts.length - 1, xLabels.at(-1)]];
  }
  const common = { min: p.min, max, yFormat: fmt, xLabels, pad: { right: 170 } };
  const tDraw = cue(p.drawSay, 0.6);
  if (p.baseline?.series) {
    const base = kit.lineChart(body, { ...common, data: p.baseline.series, grid: false, xLabels: null, area: false, tip: false, color: 'var(--dim)', strokeWidth: 3, dash: '10 9' });
    base.draw(tDraw - 0.3, { dur: 0.8, ease: 'power2.out' });
    if (p.baseline.label) base.mark(base.points.length - 1, tDraw + 0.4, { label: p.baseline.label, color: 'var(--dim)', dy: 44 });
  }
  const chart = kit.lineChart(body, { ...common, data: pts, tipFormat: fmt });
  chart.axes(b.at(0.25)).draw(tDraw, { dur: p.dur });
  sound('tick', tDraw + p.dur, { volume: 0.3 });
  if (p.band) chart.band(p.band.from, p.band.to, cue(p.band.say, () => tDraw + p.dur + 0.3), { label: p.band.label });
  for (const [k, m] of (p.marks ?? []).entries()) {
    const t = cue(m.say, () => tDraw + p.dur + 0.4 + k * 0.6);
    chart.mark(m.i, Math.max(t, tDraw + (m.i / Math.max(1, pts.length - 1)) * p.dur), { label: m.label });
  }
  finish(ctx);
}
