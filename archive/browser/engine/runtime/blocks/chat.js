import { head, animateHead, finish, itemTime, esc, md } from './_lib.js';
export const meta = {
  tail: 1.1, // default seconds held after the last spoken word (a beat's own "tail" wins)
  summary: 'Chat thread — messages arrive in order (with a typing indicator for replies), the thread scrolls as it grows.',
  use: 'Support conversations, assistant interactions, Slack-style decisions. 3–6 short messages. Use fictional names.',
  props: { messages: "[{ from: 'me' | name, text, say }]", me: "the sender shown on the right (default 'me')", kicker: '', title: '' },
  defaults: { me: 'me' },
  example: { vo: 'A customer asks when their order ships. The assistant checks, answers with a date, and flags the risk.', props: { messages: [{ from: 'me', text: 'When will my order ship?', say: 'asks' }, { from: 'Assistant', text: 'Checking your order #4821…', say: 'checks' }, { from: 'Assistant', text: 'It ships **Thursday** — there’s a 30% chance it slips to Friday.', say: 'answers' }, { from: 'me', text: 'Thanks for the heads-up!', say: 'flags' }] } },
};
export const css = `
.b-chat .view { flex: 1; position: relative; overflow: hidden; max-width: calc(1300px * var(--u)); width: 100%; align-self: center; }
.b-chat .stack { position: absolute; left: 0; right: 0; top: 0; display: flex; flex-direction: column; gap: calc(22px * var(--u)); padding-top: calc(20px * var(--u)); }
.b-chat .msg { display: flex; flex-direction: column; gap: calc(8px * var(--u)); max-width: 72%; }
.b-chat .msg.me { align-self: flex-end; align-items: flex-end; }
.b-chat .who { font-family: var(--cf-mono); font-size: calc(24px * var(--u)); color: var(--dim); letter-spacing: 0.06em; text-transform: uppercase; }
.b-chat .bub { padding: calc(28px * var(--u)) calc(36px * var(--u)); border-radius: calc(34px * var(--u)); font-size: calc(50px * var(--u)); line-height: 1.3; letter-spacing: -0.015em; background: var(--surface); border: calc(2px * var(--u)) solid var(--line); border-bottom-left-radius: calc(8px * var(--u)); }
.b-chat .me .bub { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); border-bottom-left-radius: calc(30px * var(--u)); border-bottom-right-radius: calc(8px * var(--u)); }
.b-chat .me .bub strong { color: inherit; }
.b-chat .typing { display: inline-flex; gap: calc(10px * var(--u)); padding: calc(26px * var(--u)) calc(30px * var(--u)); border-radius: calc(30px * var(--u)); background: var(--surface); border: calc(2px * var(--u)) solid var(--line); align-self: flex-start; }
.b-chat .typing i { width: calc(14px * var(--u)); height: calc(14px * var(--u)); border-radius: 50%; background: var(--dim); display: block; }
`;
export function html(p) {
  let prev = null;
  const items = (p.messages ?? []).map((m) => {
    const me = m.from === p.me;
    const who = !me && m.from !== prev ? `<span class="who">${esc(m.from)}</span>` : '';
    prev = m.from;
    return `${me ? '' : '<div class="typing"><i></i><i></i><i></i></div>'}<div class="msg${me ? ' me' : ''}">${who}<div class="bub">${md(m.text)}</div></div>`;
  }).join('');
  return `<div class="blk b-chat">${head(p)}<div class="view"><div class="stack">${items}</div></div></div>`;
}
export default function (ctx) {
  const { el, b, kit, tl, props: p, sound } = ctx;
  animateHead(ctx, b.at(0.05));
  const view = el.querySelector('.view'), stack = el.querySelector('.stack');
  const msgs = [...stack.querySelectorAll('.msg')], typing = [...stack.querySelectorAll('.typing')];
  const H = view.offsetHeight;
  let ti = 0;
  const dots = [];
  const msgsData = p.messages ?? [];
  // Collapse typing indicators out of the layout until they're shown, so the scroll math is right.
  typing.forEach((ty) => { ty.style.display = 'none'; });
  const bottoms = msgs.map((m) => m.offsetTop + m.offsetHeight);
  msgs.forEach((m, i) => {
    const t = itemTime(ctx, msgsData[i], i, msgs.length, { from: 0.02, to: 0.8 });
    const me = msgsData[i].from === p.me;
    if (!me) {
      const ty = typing[ti++];
      ty.style.display = 'inline-flex';
      ty.style.position = 'absolute';
      ty.style.top = `${m.offsetTop}px`;
      tl.fromTo(ty, { opacity: 0 }, { opacity: 1, duration: 0.2, immediateRender: true }, t - 0.75);
      tl.to(ty, { opacity: 0, duration: 0.1 }, t - 0.05);
      dots.push({ el: ty, from: t - 0.75, to: t });
    }
    tl.from(m, { opacity: 0, y: 24, scale: 0.97, transformOrigin: me ? '100% 100%' : '0% 100%', duration: 0.45, ease: 'power3.out' }, t);
    const over = bottoms[i] - H + 30;
    if (over > 0) tl.to(stack, { y: -over, duration: 0.5, ease: 'power3.inOut' }, t - 0.1);
    sound('pop', t, { volume: 0.2 });
  });
  window.CF.onFrame((time) => dots.forEach((d) => { if (time < d.from || time > d.to) return; [...d.el.children].forEach((dot, k) => { dot.style.transform = `translateY(${(-Math.max(0, Math.sin((time - d.from) * 9 - k * 0.9)) * 8).toFixed(2)}px)`; }); }));
  finish(ctx, { driftTarget: view });
}
