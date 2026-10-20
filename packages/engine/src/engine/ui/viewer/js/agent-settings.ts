import { call, closeSheet, esc, sheet } from './00-core.js';
import { failureOf, find, valueOf } from './00-boundary.js';
import { decodeModels } from './00-boundary-agent.js';
import { S } from './30-film.js';
import type { FilmSession } from './30-film.js';
import { currentSession, notify, refreshAgent } from './40-agent.js';

async function fillModels(
  card: HTMLElement,
  session: FilmSession,
  current: string,
): Promise<void> {
  const select = find(card, '#ag-model', HTMLSelectElement);
  const message = find(card, '#ag-msg', HTMLElement);
  try {
    const reply = decodeModels(
      await call('/api/agent/models'),
      '/api/agent/models',
    );
    if (!currentSession(session) || !reply.length) return;
    select.innerHTML = [...reply]
      .sort((a, b) => Number(b.free) - Number(a.free))
      .map(
        (model) =>
          `<option value="${esc(model.id)}" data-free="${model.free ? 1 : 0}" ${model.id === current ? 'selected' : ''}>${esc(model.name)}${model.free ? ' · free' : ' · paid'}</option>`,
      )
      .join('');
  } catch {
    message.textContent = 'The model list appears once the agent has started.';
  }
}

async function saveSettings(
  card: HTMLElement,
  session: FilmSession,
  mode: string,
  current: string,
): Promise<void> {
  const select = find(card, '#ag-model', HTMLSelectElement);
  const message = find(card, '#ag-msg', HTMLElement);
  const chosenMode = valueOf(card.querySelector('input[name=ag-mode]:checked'));
  const model = select.selectedOptions[0];
  if (
    model?.dataset.free === '0' &&
    !find(card, '#ag-paid', HTMLInputElement).checked
  ) {
    message.textContent = 'Tick the box to use a paid model.';
    return;
  }
  try {
    if (chosenMode && chosenMode !== mode)
      await call('/api/agent/mode', { film: session.id, mode: chosenMode });
    if (model?.value && model.dataset.free != null && model.value !== current)
      await call('/api/agent/model', { film: session.id, model: model.value });
    closeSheet();
    notify('Saved.');
    void refreshAgent(true);
  } catch (error) {
    message.textContent = failureOf(error).message;
  }
}

export async function agentSettings(): Promise<void> {
  const session = S;
  if (!session?.agent) return;
  const conversation = session.agent.conv;
  const mode = conversation?.mode ?? 'together',
    current = conversation?.model ?? 'opencode/big-pickle';
  const card = sheet(`<h2>Agent settings</h2>
    <fieldset class="choice"><legend>How it works</legend>
      <label><input type="radio" name="ag-mode" value="oneshot" ${mode === 'oneshot' ? 'checked' : ''}><span><b>Just do it</b> It makes the changes and a new cut, then tells you what it did.</span></label>
      <label><input type="radio" name="ag-mode" value="together" ${mode === 'together' ? 'checked' : ''}><span><b>Check with me first</b> It proposes a plan and asks before each step.</span></label></fieldset>
    <label class="muted small" for="ag-model">Model</label><select class="field" id="ag-model"><option>${esc(current)}</option></select>
    <label class="check" id="ag-paidrow" hidden><input type="checkbox" id="ag-paid"> I understand this model is billed by its provider</label>
    <p class="muted small" id="ag-msg" role="status">The default model is free. Paid models bill the provider account connected to the agent; nothing switches to one on its own.</p>
    <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ag-save">Save</button></div>`);
  const select = find(card, '#ag-model', HTMLSelectElement),
    paidRow = find(card, '#ag-paidrow', HTMLElement);
  void fillModels(card, session, current);
  select.onchange = () => {
    paidRow.hidden = select.selectedOptions[0]?.dataset.free !== '0';
  };
  find(card, '#ag-save', HTMLButtonElement).onclick = () =>
    saveSettings(card, session, mode, current);
}
