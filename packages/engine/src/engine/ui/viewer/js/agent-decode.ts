import {
  Fields,
  text,
  listOf,
  numeric,
  oneOf,
  flag,
  words,
  isRecord,
  DecodeError,
} from './00-boundary.js';
import type {
  MessageScope,
  OutboxEntry,
  MessagePart,
  AgentMessage,
  QueuedMessage,
  PendingMessage,
  PermissionAsk,
  FormChoice,
  FormField,
  AgentForm,
  SpendAsk,
  RuntimeView,
  Conversation,
  Job,
  CatalogEntry,
  Catalog,
  ModelChoice,
  SoundState,
} from './agent-contracts.js';

export function decodeScope(input: unknown, at: string): MessageScope {
  const r = Fields.of(input, at);
  return {
    kind: r.req('kind', text),
    label: r.opt('label', text),
    note: r.opt('note', text),
    noteText: r.opt('noteText', text),
    beats: r.opt('beats', listOf(text)),
    t: r.opt('t', numeric),
  };
}

export function decodeOutboxEntry(input: unknown, at: string): OutboxEntry {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    text: r.req('text', text),
    submission: r.opt('submission', text),
    scope: r.opt('scope', decodeScope),
    delivery: r.opt('delivery', oneOf(['queue', 'steer'])),
    hash: r.opt('hash', text),
    revision: r.opt('revision', text),
    t: r.opt('t', numeric),
    at: r.opt('at', text),
    failed: r.opt('failed', text),
  };
}

export function decodePart(input: unknown, at: string): MessagePart {
  const r = Fields.of(input, at),
    type = r.req('type', text);
  if (type === 'text') return { type, text: r.req('text', text) };
  if (type !== 'tool') return { type: 'quiet', kind: type };
  return {
    type,
    title: r.req('title', text),
    status: r.req('status', text),
    own: r.opt('own', flag),
    tool: r.opt('tool', text),
    error: r.opt('error', text),
  };
}

export function decodeMessageError(
  input: unknown,
  at: string,
): { message: string; hint?: string | null } {
  const r = Fields.of(input, at);
  return { message: r.req('message', text), hint: r.opt('hint', text) };
}

export function decodeRetry(
  input: unknown,
  at: string,
): { attempt: number; message?: string | null } {
  const r = Fields.of(input, at);
  return {
    attempt: r.req('attempt', numeric),
    message: r.opt('message', text),
  };
}

/** One message of the transcript, or null for a kind of message the page does not show. */
export function decodeMessage(input: unknown, at: string): AgentMessage | null {
  const r = Fields.of(input, at),
    role = r.req('role', text),
    id = r.req('id', text),
    when = r.opt('at', numeric);
  if (role === 'user') return { role, id, at: when, text: r.req('text', text) };
  if (role === 'note') return { role, id, at: when, text: r.req('text', text) };
  if (role === 'idle')
    return { role, id, at: when, outcome: r.opt('outcome', text) };
  if (role !== 'assistant') return null;
  return {
    role,
    id,
    at: when,
    parts: r.req('parts', listOf(decodePart)),
    error: r.opt('error', decodeMessageError),
    retry: r.opt('retry', decodeRetry),
  };
}

export function decodeMessages(input: unknown, at: string): AgentMessage[] {
  return listOf(decodeMessage)(input, at).filter((m) => m !== null);
}

export function decodeQueued(input: unknown, at: string): QueuedMessage {
  const r = Fields.of(input, at);
  return { id: r.req('id', text), text: r.req('text', text) };
}

export function decodePending(input: unknown, at: string): PendingMessage {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    text: r.req('text', text),
    state: r.opt('state', text),
    error: r.opt('error', text),
  };
}

export function decodePermission(input: unknown, at: string): PermissionAsk {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    action: r.req('action', text),
    resources: r.req('resources', listOf(words)),
    message: r.opt('message', text),
  };
}

export function decodeChoice(input: unknown, at: string): FormChoice {
  if (!isRecord(input)) return words(input, at);
  const r = Fields.of(input, at);
  return { value: r.opt('value', words), label: r.opt('label', words) };
}

export function decodeField(input: unknown, at: string): FormField {
  const r = Fields.of(input, at);
  return {
    key: r.req('key', text),
    label: r.opt('label', text),
    type: r.opt('type', text),
    options: r.opt('options', listOf(decodeChoice)),
  };
}

export function decodeForm(input: unknown, at: string): AgentForm {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    title: r.req('title', text),
    fields: r.opt('fields', listOf(decodeField)),
  };
}

export function decodeSpend(input: unknown, at: string): SpendAsk {
  const r = Fields.of(input, at);
  return {
    id: r.req('id', text),
    kind: r.req('kind', text),
    estimate: r.req('estimate', numeric),
    state: r.req('state', text),
    detail: r.opt('detail', text),
    reason: r.opt('reason', text),
  };
}

export function decodeRuntime(input: unknown, at: string): RuntimeView {
  const r = Fields.of(input, at);
  return {
    state: r.req('state', text),
    catalog: r.opt('catalog', text),
    error: r.opt('error', text),
    hint: r.opt('hint', text),
  };
}

export function decodeConversation(input: unknown, at: string): Conversation {
  const r = Fields.of(input, at);
  return {
    messages: r.req('messages', decodeMessages),
    running: r.req('running', flag),
    queued: r.req('queued', listOf(decodeQueued)),
    pending: r.req('pending', listOf(decodePending)),
    permissions: r.req('permissions', listOf(decodePermission)),
    forms: r.req('forms', listOf(decodeForm)),
    lost: r.raw.lost != null,
    spend: r.opt('spend', listOf(decodeSpend)),
    runtime: r.opt('runtime', decodeRuntime),
    mode: r.opt('mode', text),
    model: r.opt('model', text),
  };
}

export function decodeJob(input: unknown, at: string): Job {
  const r = Fields.of(input, at);
  return {
    kind: r.req('kind', text),
    status: r.req('status', text),
    progress: r.opt('progress', numeric),
  };
}

export function decodeJobs(input: unknown, at: string): Job[] {
  return Fields.of(input, at).opt('jobs', listOf(decodeJob)) ?? [];
}

export function decodeCatalogEntry(input: unknown, at: string): CatalogEntry {
  const r = Fields.of(input, at);
  return { id: r.req('id', text), title: r.opt('title', text) };
}

export function decodeCatalog(input: unknown, at: string): Catalog {
  const r = Fields.of(input, at);
  return {
    playbooks: r.opt('playbooks', listOf(decodeCatalogEntry)),
    treatments: r.opt('treatments', listOf(decodeCatalogEntry)),
  };
}

export function decodeModels(input: unknown, at: string): ModelChoice[] {
  const model = (x: unknown, where: string): ModelChoice => {
    const r = Fields.of(x, where);
    return {
      id: r.req('id', text),
      name: r.req('name', text),
      free: r.opt('free', flag) ?? false,
    };
  };
  return Fields.of(input, at).opt('models', listOf(model)) ?? [];
}

export function decodeSound(input: unknown, at: string): SoundState {
  const basis = Fields.of(input, at).raw.basis;
  if (basis === undefined || basis === null) return { basis };
  if (!isRecord(basis)) throw new DecodeError(`${at}.basis`, 'an object');
  return { basis };
}

/** `/api/agent/status`: whether this server runs an agent. */
export function decodeAgentStatus(input: unknown, at: string): boolean {
  return Fields.of(input, at).opt('enabled', flag) ?? false;
}

/** `/api/ping`: whether this is the studio server. */
export function decodePing(input: unknown, at: string): boolean {
  return Fields.of(input, at).opt('ok', flag) ?? false;
}

/** `/api/studio/state`: the working copy's hash, which an edit must name. */
export function decodeStudioHash(input: unknown, at: string): string {
  return Fields.of(input, at).req('hash', text);
}
