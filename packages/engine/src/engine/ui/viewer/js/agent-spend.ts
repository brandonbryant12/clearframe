import { call, closeSheet, esc, myName, sheet, store } from './00-core.js';
import { failureOf, find } from './00-boundary.js';
import { decodeSound } from './00-boundary-agent.js';
import type { SpendAsk } from './00-boundary-agent.js';
import { S } from './30-film.js';
import { currentSession, notify, refreshAgent } from './40-agent.js';
import { money } from './agent-log.js';

/** Approval records the person's name and the exact sound basis read before opening the sheet. */
export async function spendSheet(request: SpendAsk | undefined): Promise<void> {
  const session = S;
  if (!request || !session) return;
  let sound;
  try {
    const url = `/api/studio/sound?film=${encodeURIComponent(session.id)}`;
    sound = decodeSound(await call(url), url);
  } catch (error) {
    notify(failureOf(error).message, 'error');
    return;
  }
  if (!currentSession(session)) return;
  const cap = Math.ceil(request.estimate * 100 - 1e-9) / 100 || 0.01;
  const card =
    sheet(`<h2>Approve Google ${request.kind === 'voice' ? 'narration' : 'music'}</h2>
    <p>${esc(request.detail ?? '')}</p><p>Estimated cost <b>${money(request.estimate)}</b>. You approve up to <b>${money(cap)}</b>; nothing more can be spent.</p>
    ${request.reason ? `<p class="muted">The agent's reason: “${esc(request.reason)}”</p>` : ''}
    <input class="field" id="pay-by" placeholder="Your name (recorded with the approval)" value="${esc(myName())}" autocomplete="name">
    <label class="check"><input type="checkbox" id="pay-ok"> I approve spending up to ${money(cap)} on Google for this film</label>
    <p class="muted small" id="pay-msg" role="status"></p>
    <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="pay-go">Approve</button></div>`);
  const basis = sound.basis?.[request.kind];
  find(card, '#pay-go', HTMLButtonElement).onclick = async () => {
    const by = find(card, '#pay-by', HTMLInputElement).value.trim();
    const message = find(card, '#pay-msg', HTMLElement);
    if (!by || !find(card, '#pay-ok', HTMLInputElement).checked) {
      message.textContent =
        'Enter your name and tick the approval to continue.';
      return;
    }
    store.set('cf-name', by);
    try {
      await call('/api/agent/spend', {
        film: session.id,
        id: request.id,
        decision: 'approve',
        by,
        approve: cap,
        basis,
      });
      closeSheet();
      notify('Approved. The agent can go ahead.');
      void refreshAgent(true);
    } catch (error) {
      const failure = failureOf(error);
      message.textContent = `${failure.message}${!failure.status || failure.status >= 500 ? ' (trying again will not charge twice)' : ''}`;
    }
  };
}
