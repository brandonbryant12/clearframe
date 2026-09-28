import { head, animateHead, finish, formatter, esc, md } from './_lib.js';
export const meta = {
  tail: 1.3, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Bar comparison — bars grow in, then everything but the story dims and a note lands.',
  use: 'Compare 2–8 values. Horizontal automatically when labels are long or the frame is vertical. Bars start at zero.',
  props: { data: '[{ label, value }] (finite, nonnegative)', format: "{ prefix, suffix, decimals } or a suffix string like '%'", focus: '{ label | index, say, note, dim (0–1, default 0.28), dur (seconds, default 0.5) }; index refers to displayed order after sorting', growSay: 'word that starts the growth', orientation: "'auto' | 'vertical' | 'horizontal'", sort: "'none' | 'desc'", kicker: '', title: '', source: '', max: 'positive axis max, at least the largest value' },
  defaults: { orientation: 'auto', sort: 'none' },
  example: { vo: 'Wait time does not grow in a straight line. At ninety percent busy, work waits nine times longer than at half capacity.', props: { title: 'Wait time *vs.* how busy you are', data: [{ label: '50% busy', value: 1 }, { label: '80% busy', value: 4 }, { label: '90% busy', value: 9 }, { label: '95% busy', value: 19 }], format: '×', growSay: 'grow', focus: { label: '90% busy', say: 'ninety', note: '9× the wait' }, source: 'M/M/1 queue model — illustrative' } },
};
export const css = `
.b-bars .body { flex: 1; min-height: 0; position: relative; padding: 0 calc(40px * var(--u)); display: flex; flex-direction: column; }
.b-bars .chart { flex: 1; min-height: 0; }
.b-bars .note { flex: none; text-align: right; margin-bottom: calc(24px * var(--u)); }
:root[data-format='vertical'] .b-bars.has-source .body { padding-bottom: calc(64px * var(--u)); }
`;
export const html = (p) => `<div class="blk b-bars${p.source ? ' has-source' : ''}">${head(p)}<div class="body blk-body">${p.focus?.note ? `<div class="note blk-note">${md(p.focus.note)}</div>` : ''}<div class="chart"></div></div></div>`;
export default function (ctx) {
  const { el, b, kit, cue, format, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  let data = [...(p.data ?? [])];
  if (p.sort === 'desc') data.sort((x, y) => y.value - x.value);
  const longLabels = data.some((d) => String(d.label).length > 12);
  const orientation = p.orientation !== 'auto' ? p.orientation : format === 'vertical' || longLabels || data.length > 6 ? 'horizontal' : 'vertical';
  const dec = typeof p.format === 'object' && p.format?.decimals != null ? p.format.decimals : Math.max(0, ...data.map((d) => (String(d.value).split('.')[1] ?? '').length));
  const bars = kit.bars(el.querySelector('.chart'), { data, format: formatter(p.format, dec), orientation, max: p.max });
  const tGrow = cue(p.growSay, 0.6);
  bars.grow(tGrow, { stagger: 0.1 });
  if (p.focus) {
    const i = p.focus.index ?? data.findIndex((d) => d.label === p.focus.label);
    const t = cue(p.focus.say, () => tGrow + 1.6);
    bars.focus(i, t, { dim: p.focus.dim ?? 0.28, dur: p.focus.dur ?? 0.5 });
    const note = el.querySelector('.note');
    if (note) kit.enter(note, t + 0.2, { y: 12 });
    sound('tick', t + 0.1, { volume: 0.3 });
  }
  finish(ctx);
}
