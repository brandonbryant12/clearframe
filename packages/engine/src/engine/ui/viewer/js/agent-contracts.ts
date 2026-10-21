// The agent as the page reads it: the persisted conversation (`/api/agent/conversation`), render
// jobs, the starter catalog, the model list and the sound state, plus the outbox this browser keeps.
// The server's own contracts (engine/lib/agent/contracts.mts, engine/lib/harness/contracts.mts) are wider.

/** What a message is about: the whole film, or one note (with its scenes and moment). */
export interface MessageScope {
  kind: string;
  label?: string | null;
  note?: string | null;
  noteText?: string | null;
  beats?: string[] | null;
  t?: number | null;
}

export type Delivery = 'queue' | 'steer';

/** A message waiting for the server to confirm it. Only these durable fields are ever stored. */
export interface OutboxEntry {
  id: string;
  text: string;
  submission?: string | null;
  scope?: MessageScope | null;
  delivery?: Delivery | null;
  hash?: string | null;
  revision?: string | null;
  t?: number | null;
  at?: string | null;
  failed?: string | null;
}

export interface ToolPart {
  type: 'tool';
  title: string;
  status: string;
  own?: boolean | null;
  tool?: string | null;
  error?: string | null;
}

export interface TextPart {
  type: 'text';
  text: string;
}

/** A part the page does not show (the model's reasoning, or a kind added later). */
export interface QuietPart {
  type: 'quiet';
  kind: string;
}

export type MessagePart = ToolPart | TextPart | QuietPart;

export interface UserMessage {
  role: 'user';
  id: string;
  text: string;
  at?: number | null;
}

export interface AssistantMessage {
  role: 'assistant';
  id: string;
  at?: number | null;
  parts: MessagePart[];
  error?: { message: string; hint?: string | null } | null;
  retry?: { attempt: number; message?: string | null } | null;
}

export interface NoticeMessage {
  role: 'note';
  id: string;
  text: string;
  at?: number | null;
}

export interface IdleMessage {
  role: 'idle';
  id: string;
  at?: number | null;
  outcome?: string | null;
}

export type AgentMessage =
  | UserMessage
  | AssistantMessage
  | NoticeMessage
  | IdleMessage;

export interface QueuedMessage {
  id: string;
  text: string;
}

export interface PendingMessage {
  id: string;
  text: string;
  state?: string | null;
  error?: string | null;
}

export interface PermissionAsk {
  id: string;
  action: string;
  resources: string[];
  message?: string | null;
}

export type FormChoice =
  | string
  | { value?: string | null; label?: string | null };

export interface FormField {
  key: string;
  label?: string | null;
  type?: string | null;
  options?: FormChoice[] | null;
}

export interface AgentForm {
  id: string;
  title: string;
  fields?: FormField[] | null;
}

export interface SpendAsk {
  id: string;
  kind: string;
  estimate: number;
  state: string;
  detail?: string | null;
  reason?: string | null;
}

export interface RuntimeView {
  state: string;
  catalog?: string | null;
  error?: string | null;
  hint?: string | null;
}

export interface Conversation {
  messages: AgentMessage[];
  running: boolean;
  queued: QueuedMessage[];
  pending: PendingMessage[];
  permissions: PermissionAsk[];
  forms: AgentForm[];
  lost: boolean;
  spend?: SpendAsk[] | null;
  runtime?: RuntimeView | null;
  mode?: string | null;
  model?: string | null;
}

export interface Job {
  kind: string;
  status: string;
  progress?: number | null;
}

export interface CatalogEntry {
  id: string;
  title?: string | null;
}

export interface Catalog {
  playbooks?: CatalogEntry[] | null;
  treatments?: CatalogEntry[] | null;
}

export interface ModelChoice {
  id: string;
  name: string;
  free: boolean;
}

/** `/api/studio/sound`: the page passes each kind's basis back with an approval, unread. */
export interface SoundState {
  basis?: Readonly<Record<string, unknown>> | null;
}
