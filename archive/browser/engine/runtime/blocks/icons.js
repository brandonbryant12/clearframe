import { head, animateHead, finish, itemTime, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Icon grid — 3–6 items, each an icon that draws itself on, a label and a line of detail.',
  use: 'Pillars, features, principles, "what\'s included". Lucide icon names — search with `clearframe icons <query>`.',
  props: { items: "[{ icon, label, sub, say }]", kicker: '', title: '', columns: 'auto' },
  defaults: {},
  example: { vo: 'The platform gives every team three things: security by default, fast deploys, and clear costs.', props: { title: 'What every team gets', items: [{ icon: 'shield-check', label: 'Secure by default', sub: 'SSO, audit logs, least privilege', say: 'security' }, { icon: 'rocket', label: 'Fast deploys', sub: 'Merge to live in minutes', say: 'fast' }, { icon: 'receipt', label: 'Clear costs', sub: 'Per-team spend, weekly', say: 'costs' }] } },
};
export const css = `
.b-icons .grid { flex: 1; display: grid; gap: calc(56px * var(--u)); align-content: center; }
.b-icons .it { display: flex; flex-direction: column; gap: calc(22px * var(--u)); }
:root[data-format='vertical'] .b-icons .it { flex-direction: row; align-items: center; gap: calc(30px * var(--u)); }
.b-icons .ic { width: calc(170px * var(--u)); height: calc(170px * var(--u)); border-radius: calc(30px * var(--u)); display: grid; place-items: center; color: var(--accent); flex: none; }
.b-icons .lab { font-size: calc(62px * var(--u)); font-weight: 620; letter-spacing: -0.03em; line-height: 1.05; }
.b-icons .sub { margin-top: calc(12px * var(--u)); font-size: calc(36px * var(--u)); color: var(--ink-2); line-height: 1.3; max-width: 24ch; }
`;
export function html(p, ctx) {
  const n = (p.items ?? []).length;
  const cols = p.columns ?? (ctx.format === 'vertical' ? 1 : n <= 4 ? n : 3);
  return `<div class="blk b-icons">${head(p)}<div class="grid" style="grid-template-columns: repeat(${cols}, 1fr)">${(p.items ?? []).map((it) => `<div class="it"><div class="ic blk-card"></div><div><div class="lab">${md(it.label)}</div>${it.sub ? `<div class="sub">${md(it.sub)}</div>` : ''}</div></div>`).join('')}</div></div>`;
}
export default async function (ctx) {
  const { el, b, kit, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const items = [...el.querySelectorAll('.it')];
  for (const [i, node] of items.entries()) {
    const it = p.items[i];
    const t = itemTime(ctx, it, i, items.length, { from: 0.02, to: 0.75 });
    kit.enter(node, t, { y: 20 });
    if (it.icon) kit.drawIcon(await kit.icon(node.querySelector('.ic'), it.icon, { size: 84, stroke: 1.5 }), t + 0.1, { dur: 0.7 });
    sound('pop', t + 0.05, { volume: 0.22 });
  }
  finish(ctx, { driftTarget: el.querySelector('.grid') });
}
