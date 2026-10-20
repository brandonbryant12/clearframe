import { decodeConversation } from './00-boundary-agent.js';
import type { Conversation } from './00-boundary-agent.js';
import { S } from './30-film.js';
import type { FilmSession } from './30-film.js';
import { call, toast, esc } from './00-core.js';
import { failureOf, byIdOptional } from './00-boundary.js';

import type { AgentState } from './agent-model.js';
import { saveOutbox } from './agent-outbox.js';
import { drawAgent } from './agent-pane.js';

export const AGENT_POLL_BUSY = 1200,
  AGENT_POLL_IDLE = 5000;

export function conversationBusy(c: Conversation): boolean {
  return (
    c.running ||
    c.queued.length > 0 ||
    c.pending.some((p) => p.state === 'sending') ||
    c.permissions.length > 0 ||
    c.forms.length > 0 ||
    c.runtime?.state === 'starting' ||
    c.runtime?.catalog === 'loading'
  );
}

export const agentBusy = (a: AgentState | undefined) =>
  (!!a?.conv && conversationBusy(a.conv)) || !!a?.outbox.length;

/** Poll the persisted conversation: fast while something is in flight, slow when idle, never in a hidden tab. */
export async function refreshAgent(force = false) {
  const session = S,
    a = session?.agent;
  if (!session || !a || a.polling || (document.hidden && !force)) return;
  if (
    !force &&
    Date.now() - a.lastPoll < (agentBusy(a) ? AGENT_POLL_BUSY : AGENT_POLL_IDLE)
  )
    return;
  a.polling = true;
  a.lastPoll = Date.now();
  try {
    const conv = decodeConversation(
      await call(
        `/api/agent/conversation?film=${encodeURIComponent(session.id)}`,
      ),
      '/api/agent/conversation',
    );
    if (!currentSession(session)) return;
    takeConversation(session, a, conv);
  } catch (e) {
    if (!currentSession(session)) return;
    a.error = failureOf(e).message;
    invalidate();
  } finally {
    a.polling = false;
  }
}

export const assistantCount = (c: Conversation) =>
  c.messages.filter((m) => m.role === 'assistant').length;

export function takeConversation(
  session: FilmSession,
  a: AgentState,
  conv: Conversation,
) {
  a.error = null;
  if (
    a.conv &&
    assistantCount(conv) > assistantCount(a.conv) &&
    byIdOptional('agent', HTMLElement)?.hidden
  )
    a.unseen = true;
  a.conv = conv;
  // Anything the server now knows about leaves the outbox.
  const known = new Set([
    ...conv.messages.filter((m) => m.role === 'user').map((m) => m.id),
    ...conv.queued.map((q) => q.id),
    ...conv.pending.map((p) => p.id),
  ]);
  if (a.outbox.some((o) => known.has(o.id))) {
    a.outbox = a.outbox.filter((o) => !known.has(o.id));
    saveOutbox(session);
  }
  invalidate();
}

// ------------------------------------------------------------------ the conversation on the page

export const currentSession = (session: FilmSession | null) =>
  !!session && S === session && !session.disposed;

export const invalidate = () => drawAgent();

export const notify = (msg: string, tone?: string) =>
  toast(esc(msg), tone === 'error' ? 6000 : 3000);
