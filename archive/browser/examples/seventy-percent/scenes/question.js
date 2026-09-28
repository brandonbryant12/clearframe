// Beat: decide. Swap the wrong question for the useful one.
export const css = `
.qu { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: calc(48px * var(--u)); text-align: center; }
.qu .line { font-family: var(--cf-display); font-size: calc(128px * var(--u)); line-height: 1.02; letter-spacing: -0.015em; }
.qu .old { color: var(--ink-2); }
.qu .hl { color: var(--accent); }
`;

export const html = `
<div class="qu">
  <div class="line old"><span class="s">Was the forecast right?</span></div>
  <div class="line new">Did we plan for <span class="hl">the 30?</span></div>
</div>`;

export default function ({ el, b, kit, tl }) {
  const $ = (s) => el.querySelector(s);
  kit.reveal($('.old'), b.say('don’t') - 0.1, { by: 'words' });
  kit.mark($('.old .s'), b.say('right', { edge: 'end' }), { kind: 'strike', color: 'var(--ink-2)', dur: 0.45 });
  tl.to($('.old'), { opacity: 0.4, duration: 0.5 }, b.say('right', { edge: 'end' }) + 0.3);
  kit.reveal($('.new'), b.say('ask', { nth: 1 }) - 0.05, { by: 'words' });
  kit.mark($('.new .hl'), b.say('thirty'), { kind: 'highlight' });
  kit.drift($('.qu'), b.start, b.end + 0.6, { scale: 1.025 });
}
