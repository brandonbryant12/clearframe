import type {
  Conversation,
  MessagePart,
  ToolPart,
  TextPart,
  AssistantMessage,
  UserMessage,
} from './00-boundary-agent.js';

import { esc, plural, markdown, clock } from './00-core.js';

// ---- one request's replies
export function isTool(p: MessagePart): p is ToolPart {
  return p.type === 'tool';
}

export function isText(p: MessagePart): p is TextPart {
  return p.type === 'text';
}

export function isOwnEdit(p: ToolPart): boolean {
  return !!p.own && p.tool === 'edit' && p.status === 'completed';
}

export function stepMark(status: string): string {
  if (status === 'completed') return '✓';
  return status === 'error' ? '✕' : '…';
}

export function stepsSummary(
  steps: readonly ToolPart[],
  edits: readonly ToolPart[],
  live: boolean,
): string {
  if (live)
    return `<i class="spin"></i>${esc(steps.filter((p) => p.status !== 'completed' && p.status !== 'error').at(-1)?.title ?? 'Working…')}`;
  return `${plural(steps.length, 'step')}${edits.length ? ` · ${plural(edits.length, 'change')} to the film` : ''}`;
}

export function stepsHTML(steps: readonly ToolPart[], live: boolean): string {
  if (!steps.length)
    return live ? '<div class="steps"><i class="spin"></i>Thinking…</div>' : '';
  return `<details class="steps"><summary>${stepsSummary(steps, steps.filter(isOwnEdit), live)}</summary>
    <ul>${steps.map((p) => `<li class="${p.status}">${stepMark(p.status)} ${esc(p.title)}${p.error ? ` <span class="bad">${esc(p.error)}</span>` : ''}</li>`).join('')}</ul></details>`;
}

/** One request's replies: every step folded into one line (open it to see them), then the words. */
export function runHTML(
  msgs: readonly AssistantMessage[],
  _conv: Conversation,
  live: boolean,
): string {
  const steps = msgs.flatMap((m) => m.parts).filter(isTool);
  const said = msgs
      .map((m) =>
        m.parts
          .filter(isText)
          .map((p) => p.text)
          .join('\n\n'),
      )
      .filter((t) => t.trim())
      .join('\n\n'),
    last = msgs.at(-1);
  const errors = msgs
    .flatMap((m) =>
      m.error
        ? [
            `<div class="ask bad"><b>${esc(m.error.message)}</b>${m.error.hint ? `<p>${esc(m.error.hint)}</p>` : ''}</div>`,
          ]
        : [],
    )
    .join('');
  return `<article class="msg agentmsg">${stepsHTML(steps, live)}${said ? `<div class="reply">${markdown(said)}</div>` : ''}${errors}
    ${last?.retry ? `<p class="sys">Retrying (attempt ${last.retry.attempt}): ${esc(last.retry.message)}</p>` : ''}</article>`;
}

/** A live step says how long it has been silent, and what to do if the provider stalls. */
export function waiting(m: UserMessage, label: string): string {
  const secs = Math.max(
    0,
    Math.round((Date.now() - (m.at ?? Date.now())) / 1000),
  );
  return `<div class="steps"><i class="spin"></i>${label} <span class="muted">${clock(secs)}</span>${secs > 90 ? '<p class="muted small">No answer for a while: the model may be slow or stalled. Stop, then Send now (or write again) to retry.</p>' : ''}</div>`;
}

/** Before the model's first word: say so, timed from the server's send time (a reload keeps the clock). */
export function firstResponse(conv: Conversation | null): string {
  const last = conv?.messages.at(-1);
  if (!conv?.running || last?.role !== 'user') return '';
  return waiting(last, 'Sent. Waiting for the model’s first response…');
}
