import { esc, when } from './00-core.js';
import { firstResponse, runHTML } from './40-agent.js';
import type { AgentState } from './40-agent.js';
import type {
  AgentMessage,
  AssistantMessage,
  Conversation,
  PermissionAsk,
  PendingMessage,
  SpendAsk,
} from './00-boundary-agent.js';
import { formHTML, quickReplies } from './agent-forms.js';

export const money = (value: number): string =>
  `$${value.toFixed(value < 0.01 ? 4 : 2)}`;

function messageHTML(message: AgentMessage): string {
  if (message.role === 'user')
    return `<article class="msg you"><div class="bubble">${esc(message.text).replace(/\n/g, '<br>')}</div><div class="meta">${message.at ? esc(when(new Date(message.at).toISOString())) : ''}</div></article>`;
  if (message.role === 'note') return `<p class="sys">${esc(message.text)}</p>`;
  if (message.role !== 'idle' || message.outcome === 'succeeded') return '';
  return `<p class="sys">${message.outcome === 'interrupted' ? 'Stopped.' : 'That reply did not finish.'}</p>`;
}

function messagesHTML(conversation: Conversation): string {
  let body = '';
  let run: AssistantMessage[] = [];
  const flush = (live: boolean) => {
    if (run.length) body += runHTML(run, conversation, live);
    run = [];
  };
  for (const message of conversation.messages) {
    if (message.role === 'assistant') run.push(message);
    else {
      flush(false);
      body += messageHTML(message);
    }
  }
  flush(conversation.running);
  return body;
}

function undoHTML(conversation: Conversation): string {
  if (conversation.running) return '';
  const lastUser = conversation.messages
    .map((message) => message.role)
    .lastIndexOf('user');
  const request = conversation.messages[lastUser];
  if (lastUser < 0 || !request) return '';
  const changed = conversation.messages
    .slice(lastUser + 1)
    .some(
      (message) =>
        message.role === 'assistant' &&
        message.parts.some(
          (part) =>
            part.type === 'tool' &&
            part.own &&
            part.tool === 'edit' &&
            part.status === 'completed',
        ),
    );
  return changed
    ? `<button class="link small undo" data-act="undo" data-run="${esc(request.id)}">Undo the agent's last changes</button>`
    : '';
}

function helloHTML(agent: AgentState, conversation: Conversation): string {
  if (
    conversation.messages.length ||
    agent.outbox.length ||
    conversation.pending.length
  )
    return '';
  const prompts = [
    'Make the opening more gripping',
    'Tighten it to under a minute',
    'Make it feel less like slides',
  ];
  return `<div class="hello"><p>Tell the agent what to change, or leave notes on the picture and send them. It edits the film and makes a new version for you to watch.</p><div class="suggest">${prompts.map((prompt) => `<button class="chip" data-act="suggest" data-text="${esc(prompt)}">${esc(prompt)}</button>`).join('')}</div></div>`;
}

function pendingHTML(message: PendingMessage): string {
  const status =
    message.state === 'failed'
      ? `Not sent: ${esc(message.error ?? '')} <button class="link" data-act="resend" data-id="${esc(message.id)}">Try again</button> <button class="link" data-act="discard" data-id="${esc(message.id)}">Discard</button>`
      : 'Sending…';
  return `<article class="msg you pending"><div class="bubble">${esc(message.text).replace(/\n/g, '<br>')}</div><div class="meta">${status}</div></article>`;
}

function permissionHTML(permission: PermissionAsk): string {
  const labels = new Map([
    ['shell', 'run a command on this computer'],
    ['bash', 'run a command on this computer'],
    ['webfetch', 'open a web page'],
    ['websearch', 'search the web'],
  ]);
  const action = labels.get(permission.action) ?? `use ${permission.action}`;
  return `<div class="ask"><b>The agent asks to ${esc(action)}</b>${permission.resources.map((resource) => `<pre class="code">${esc(resource)}</pre>`).join('')}${permission.message ? `<p>${esc(permission.message)}</p>` : ''}<p class="muted small">Commands can change files outside the film's undo history, or spend money. Allow only what you understand.</p><div class="row left"><button class="btn small" data-act="permit" data-id="${esc(permission.id)}" data-decision="once">Allow once</button><button class="btn small danger" data-act="permit" data-id="${esc(permission.id)}" data-decision="reject">Don't allow</button></div></div>`;
}

function spendHTML(request: SpendAsk): string {
  const reason = request.reason ? ` — “${esc(request.reason)}”` : '';
  return `<div class="ask"><b>The agent asks to spend about ${money(request.estimate)} on Google ${request.kind === 'voice' ? 'narration' : 'music'}</b><p>${esc(request.detail ?? '')}${reason}</p><div class="row left"><button class="btn small primary" data-act="spend" data-id="${esc(request.id)}">Review and approve…</button><button class="btn small" data-act="decline" data-id="${esc(request.id)}">No thanks</button></div></div>`;
}

function queuedHTML(conversation: Conversation): string {
  if (!conversation.queued.length) return '';
  return `<div class="queued"><p class="muted small">${conversation.running ? 'Next, after this reply:' : 'Waiting (the agent is stopped):'}</p>${conversation.queued.map((message) => `<div class="msg you"><div class="bubble">${esc(message.text)}</div><div class="meta"><button class="link" data-act="steer" data-id="${esc(message.id)}">Send now</button> <button class="link" data-act="unqueue" data-id="${esc(message.id)}">Remove</button></div></div>`).join('')}</div>`;
}

function failureHTML(
  agent: AgentState,
  conversation: Conversation | null,
): string {
  let body = '';
  if (agent.error && !conversation)
    body += `<div class="ask bad"><b>${esc(agent.error)}</b><p>The studio server may have stopped. Start it with <code>clearframe viewer --serve</code>.</p></div>`;
  const runtime = conversation?.runtime;
  if (runtime?.state === 'error')
    body += `<div class="ask bad"><b>The agent did not start: ${esc(runtime.error)}</b>${runtime.hint ? `<p>${esc(runtime.hint)}</p>` : ''}<p class="muted small">Run <code>clearframe agent doctor</code> in a terminal for details.</p><button class="btn small" data-act="start">Try again</button></div>`;
  if (conversation?.lost)
    body +=
      '<p class="sys">The earlier conversation for this film is no longer available; a new one starts with your next message.</p>';
  return body;
}

export function logHTML(
  agent: AgentState,
  conversation: Conversation | null,
): string {
  const unsent: PendingMessage[] = agent.outbox.map((message) => ({
    ...message,
    state:
      agent.sending.has(message.id) || !message.failed ? 'sending' : 'failed',
    error: message.failed,
  }));
  unsent.push(
    ...(conversation?.pending ?? []).filter(
      (message) => !agent.outbox.some((outgoing) => outgoing.id === message.id),
    ),
  );
  const body = [failureHTML(agent, conversation)];
  if (conversation)
    body.push(
      messagesHTML(conversation),
      undoHTML(conversation),
      helloHTML(agent, conversation),
    );
  body.push(unsent.map(pendingHTML).join(''));
  if (!conversation) return body.join('');
  body.push(
    firstResponse(conversation),
    conversation.permissions.map(permissionHTML).join(''),
    conversation.forms.map(formHTML).join(''),
    (conversation.spend ?? [])
      .filter((request) => request.state === 'pending')
      .map(spendHTML)
      .join(''),
    queuedHTML(conversation),
    quickReplies(conversation),
  );
  return body.join('');
}
