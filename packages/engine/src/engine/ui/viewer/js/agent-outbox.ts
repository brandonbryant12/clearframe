import { decodeOutboxEntry } from './00-boundary-agent.js';
import type {
  OutboxEntry,
  MessageScope,
  Delivery,
} from './00-boundary-agent.js';
import { S } from './30-film.js';
import type { FilmSession } from './30-film.js';
import { store, call } from './00-core.js';
import { stored, readableOf, text, failureOf } from './00-boundary.js';

import {
  currentSession,
  invalidate,
  refreshAgent,
  notify,
} from './agent-runtime.js';
import type { AgentState } from './agent-model.js';

export const newSubmission = () =>
  `msg_cf${Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('')}`;

export const outboxKey = (id: string) => `cf-agent-outbox:${id}`;

// Only durable fields are stored: whether a send is in flight is this page's state, never saved,
// so a reload (or a crash mid-send) always retries with the same id.
export const DURABLE: readonly (keyof OutboxEntry)[] = [
  'id',
  'submission',
  'text',
  'scope',
  'delivery',
  'hash',
  'revision',
  't',
  'at',
  'failed',
];

export function keepField<K extends keyof OutboxEntry>(
  to: OutboxEntry,
  from: OutboxEntry,
  key: K,
) {
  to[key] = from[key];
}

export function durable(o: OutboxEntry): OutboxEntry {
  const out: OutboxEntry = { id: o.id, text: o.text };
  for (const key of DURABLE) if (o[key] !== undefined) keepField(out, o, key);
  return out;
}

export const saveOutbox = (session: FilmSession) => {
  if (session.agent)
    store.set(outboxKey(session.id), session.agent.outbox.map(durable));
};

export const loadOutbox = (id: string) =>
  stored(outboxKey(id), readableOf(decodeOutboxEntry), []).map(durable);

export function agentInit(session: FilmSession) {
  session.agent = {
    conv: null,
    draft: stored(`cf-agent-draft:${session.id}`, text, ''),
    outbox: loadOutbox(session.id),
    sending: new Set(),
    lastPoll: 0,
    polling: false,
    error: null,
    scrolledUp: false,
    unseen: false,
  };
}

/** Resend whatever the outbox still holds (same ids: the runtime treats a repeat as the same message). */
export async function flushOutbox() {
  const session = S,
    a = session?.agent;
  if (!session || !a) return;
  for (const o of [...a.outbox]) {
    if (a.sending.has(o.id)) continue;
    a.sending.add(o.id);
    try {
      const { failed: _failed, ...body } = durable(o);
      await call('/api/agent/prompt', { film: session.id, ...body });
      if (!currentSession(session)) return;
      a.outbox = a.outbox.filter((x) => x.id !== o.id);
      saveOutbox(session);
    } catch (e) {
      if (!currentSession(session)) return;
      keepFailure(session, a, o.id, e);
    } finally {
      a.sending.delete(o.id);
    }
  }
  if (currentSession(session)) {
    invalidate();
    refreshAgent(true);
  }
}

export function keepFailure(
  session: FilmSession,
  a: AgentState,
  id: string,
  e: unknown,
) {
  const { message, status } = failureOf(e),
    kept = a.outbox.find((x) => x.id === id);
  if (kept) {
    kept.failed = message;
    saveOutbox(session);
  }
  if (status && status < 500) notify(`Not sent: ${message}`, 'error');
}

/** Send words to the agent about this film (a scope narrows it to a note), with the version and playhead on screen. */
export function say(
  words: string | null | undefined,
  scope: MessageScope = { kind: 'film' },
  delivery: Delivery = 'queue',
) {
  const session = S,
    a = session?.agent,
    message = String(words ?? '').trim();
  if (!session || !a || !message) return;
  const revision =
    session.v?.id && session.v.id !== 'latest' ? session.v.id : null;
  const o: OutboxEntry = {
    id: newSubmission(),
    text: message,
    scope,
    delivery,
    hash: null,
    revision,
    t: Number(session.time().toFixed(2)),
    at: new Date().toISOString(),
  };
  o.submission = o.id;
  a.outbox.push(o);
  saveOutbox(session);
  a.scrolledUp = false;
  invalidate();
  flushOutbox();
}
