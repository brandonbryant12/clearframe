import { esc } from './00-core.js';
import type {
  AgentForm,
  Conversation,
  FormChoice,
  FormField,
  TextPart,
} from './00-boundary-agent.js';

export function quickReplies(conversation: Conversation): string {
  if (
    conversation.running ||
    conversation.queued.length ||
    conversation.permissions.length
  )
    return '';
  const last = conversation.messages.findLast(
    (message) => message.role === 'assistant',
  );
  const text =
    last?.parts
      .filter((part): part is TextPart => part.type === 'text')
      .map((part) => part.text)
      .join(' ')
      .trim() ?? '';
  if (
    !/\?[\s*_`"'”)\]]*$/.test(text) ||
    conversation.messages.at(-1)?.role === 'user'
  )
    return '';
  return `<div class="suggest">${['Yes, go ahead.', 'Show me first.', 'Explain the options.'].map((reply) => `<button class="chip" data-act="quick" data-text="${esc(reply)}">${esc(reply)}</button>`).join('')}</div>`;
}

function optionHTML(option: FormChoice): string {
  const value = typeof option === 'string' ? option : (option.value ?? '');
  const label = typeof option === 'string' ? option : (option.label ?? value);
  return `<option value="${esc(value)}">${esc(label)}</option>`;
}

function fieldHTML(form: AgentForm, field: FormField): string {
  const id = `f-${esc(form.id)}-${esc(field.key)}`;
  if (field.type === 'boolean')
    return `<label class="check"><input type="checkbox" id="${id}" data-key="${esc(field.key)}" data-type="bool"> ${esc(field.label ?? field.key)}</label>`;
  if (field.options?.length)
    return `<label>${esc(field.label ?? field.key)}<select class="field" id="${id}" data-key="${esc(field.key)}" ${field.type === 'multiselect' ? 'multiple' : ''}>${field.options.map(optionHTML).join('')}</select></label>`;
  return `<label>${esc(field.label ?? field.key)}<input class="field" id="${id}" data-key="${esc(field.key)}" data-type="${field.type === 'number' || field.type === 'integer' ? 'number' : 'text'}"></label>`;
}

export function formHTML(form: AgentForm): string {
  const fields = (form.fields ?? [])
    .map((field) => fieldHTML(form, field))
    .join('');
  return `<form class="ask" data-form="${esc(form.id)}"><b>${esc(form.title)}</b>${fields}<div class="row left"><button type="button" class="btn small primary" data-act="answer" data-id="${esc(form.id)}">Answer</button><button type="button" class="btn small" data-act="answer" data-id="${esc(form.id)}" data-cancel="1">Skip</button></div></form>`;
}
