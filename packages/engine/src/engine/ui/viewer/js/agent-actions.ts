import { call, myName } from './00-core.js';
import { failureOf, hit, valueOf } from './00-boundary.js';
import { decodeStudioHash } from './00-boundary-agent.js';
import { S } from './30-film.js';
import {
  currentSession,
  flushOutbox,
  hasAgent,
  invalidate,
  notify,
  refreshAgent,
  saveOutbox,
  say,
} from './40-agent.js';
import { spendSheet } from './agent-spend.js';

interface AgentPostBody {
  [key: string]: unknown;
}
export async function agentPost(
  path: string,
  body: AgentPostBody,
  done?: (reply: unknown) => void,
): Promise<unknown> {
  const session = S;
  if (!session) return;
  try {
    const reply = await call(path, { film: session.id, ...body });
    if (currentSession(session)) {
      done?.(reply);
      void refreshAgent(true);
    }
    return reply;
  } catch (error) {
    if (currentSession(session)) notify(failureOf(error).message, 'error');
    void refreshAgent(true);
  }
}

function fieldAnswer(field: HTMLElement): string | number | boolean | string[] {
  if (field instanceof HTMLInputElement && field.dataset.type === 'bool')
    return field.checked;
  if (field instanceof HTMLSelectElement && field.multiple)
    return [...field.selectedOptions].map((option) => option.value);
  const value = valueOf(field) ?? '';
  return field.dataset.type === 'number' ? Number(value) : value;
}

function answerForm(button: HTMLElement): Promise<unknown> {
  const answer: AgentPostBody = {};
  if (!button.dataset.cancel)
    for (const field of button
      .closest('form')
      ?.querySelectorAll<HTMLElement>('[data-key]') ?? []) {
      if (field.dataset.key) answer[field.dataset.key] = fieldAnswer(field);
    }
  return agentPost('/api/agent/form', {
    id: button.dataset.id,
    answer,
    cancel: !!button.dataset.cancel,
  });
}

function retryMessage(id: string | undefined): void {
  if (!S || !hasAgent(S)) return;
  const message = S.agent.outbox.find((entry) => entry.id === id);
  if (!message) return;
  delete message.failed;
  saveOutbox(S);
  invalidate();
  void flushOutbox();
}

function discardMessage(id: string | undefined): void {
  if (!S || !hasAgent(S)) return;
  S.agent.outbox = S.agent.outbox.filter((entry) => entry.id !== id);
  saveOutbox(S);
  void agentPost('/api/agent/discard', { submission: id });
  invalidate();
}

async function undoRun(run: string | undefined): Promise<void> {
  const session = S;
  if (!session) return;
  try {
    const url = `/api/studio/state?film=${encodeURIComponent(session.id)}`;
    const hash = decodeStudioHash(await call(url), url);
    await call('/api/studio/command', {
      film: session.id,
      hash,
      command: 'undoRun',
      run,
    });
    notify(
      'Undid those changes. Ask the agent for a new cut when you are ready.',
    );
  } catch (error) {
    notify(failureOf(error).message, 'error');
  }
}

export async function onLogClick(event: Event): Promise<unknown> {
  const button = hit(event, '[data-act]');
  if (!button || !S) return;
  const { act, id } = button.dataset;
  switch (act) {
    case 'suggest':
    case 'quick':
      return say(button.dataset.text ?? '');
    case 'start':
      return call('/api/agent/start', {})
        .then(() => refreshAgent(true))
        .catch((error) => notify(failureOf(error).message, 'error'));
    case 'permit':
      return agentPost(
        '/api/agent/permission',
        { id, decision: button.dataset.decision },
        () =>
          notify(
            button.dataset.decision === 'reject'
              ? 'Not allowed.'
              : 'Allowed once.',
          ),
      );
    case 'steer':
      return agentPost('/api/agent/queue/steer', { id });
    case 'unqueue':
      return agentPost('/api/agent/queue/cancel', { id });
    case 'answer':
      return answerForm(button);
    case 'resend':
      return retryMessage(id);
    case 'discard':
      return discardMessage(id);
    case 'decline':
      return agentPost(
        '/api/agent/spend',
        { id, decision: 'decline', by: myName() || 'the person' },
        () => notify('Declined.'),
      );
    case 'spend':
      return spendSheet(
        S.agent?.conv?.spend?.find((request) => request.id === id),
      );
    case 'undo':
      return undoRun(button.dataset.run);
  }
}
