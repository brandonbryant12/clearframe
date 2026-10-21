import path from 'node:path';
import * as Schema from 'effect/Schema';
import type {
  SessionMessageInfo,
  SessionMessageAssistantTool,
  SessionStructuredError,
  SessionMessageAssistant,
  SessionMessageUser,
} from '@opencode/client';
import { isRecord } from '../harness/contracts.mjs';
import { ScopeSchema } from './contracts.mjs';
import { clip } from './tool-common.mjs';
const metadataSchema = Schema.Struct({
  text: Schema.optionalKey(Schema.String),
  scope: Schema.optionalKey(ScopeSchema),
  hash: Schema.optionalKey(Schema.NullOr(Schema.String)),
  revision: Schema.optionalKey(Schema.NullOr(Schema.String)),
  mode: Schema.optionalKey(Schema.String),
});
export const contextMetadata = (value: unknown) => {
  try {
    return Schema.decodeUnknownSync(metadataSchema)(value ?? {});
  } catch {
    return {};
  }
};

function renderTitle(input: Record<string, unknown>) {
  let suffix = '';
  if (Array.isArray(input.beats)) suffix = ` of ${input.beats.join(', ')}`;
  if (input.beat) suffix = ` of ${input.beat}`;
  return `Queued ${input.kind}${suffix}`;
}
function soundTitle(input: Record<string, unknown>) {
  if (input.action === 'request')
    return `Asked to approve Google ${input.kind === 'music' ? 'music' : 'narration'}`;
  if (typeof input.action === 'string' && input.action.startsWith('draft'))
    return `Queued a free ${input.action === 'draft-music' ? 'music bed' : 'draft voice'}`;
  return 'Checked the sound';
}

/** What one tool step looks like in the transcript: its name, a short title, status, never raw output. */
function toolView(part: SessionMessageAssistantTool, dir: string) {
  const st = part.state,
    input = 'input' in st && isRecord(st.input) ? st.input : {};
  const relp = (p: unknown) => {
    if (typeof p !== 'string') return '';
    return path.isAbsolute(p) && p.startsWith(dir)
      ? path.relative(dir, p) || '.'
      : p;
  };
  const name = part.name.replace(/^clearframe_/, '');
  const titles = {
    state: () => (input.beat ? `Read scene ${input.beat}` : 'Read the film'),
    catalog: () =>
      `Looked up ${input.topic}${input.name ? ` ${input.name}` : ''}`,
    edit: () => input.label ?? 'Edited the film',
    render: () => renderTitle(input),
    job: () => 'Checked a render',
    notes: () => 'Read review notes',
    files: () => (input.read ? `Read ${input.read}` : 'Listed project files'),
    write: () =>
      `Rewrote ${input.file === 'brief' ? 'the brief' : 'direction notes'}`,
    sound: () => soundTitle(input),
    guide: () => `Read the ${input.topic} guide`,
  };
  const builtin = {
    read: () => `Read ${relp(input.filePath ?? input.path)}`,
    glob: () => `Searched files ${clip(input.pattern, 80)}`,
    grep: () => `Searched for ${clip(input.pattern, 80)}`,
    shell: () => `Shell: ${clip(input.command, 160)}`,
    bash: () => `Shell: ${clip(input.command, 160)}`,
    webfetch: () => `Fetched ${clip(input.url, 120)}`,
    websearch: () => `Searched the web: ${clip(input.query, 120)}`,
    skill: () => `Used skill ${input.name ?? input.id ?? ''}`,
    execute: () => 'Ran tool code',
    edit: () => `Edit ${relp(input.filePath)}`,
    write: () => `Write ${relp(input.filePath)}`,
  };
  const own = part.name.startsWith('clearframe_');
  let title;
  try {
    const options = own ? titles : builtin;
    const nameToFind = own ? name : part.name;
    title =
      Object.entries(options).find(([key]) => key === nameToFind)?.[1]() ??
      part.name;
  } catch {
    title = part.name;
  }
  const meta = 'metadata' in st ? (st.metadata ?? {}) : {};
  return {
    type: 'tool',
    id: part.id,
    tool: own ? name : part.name,
    own,
    title: clip(title, 200),
    status: st.status ?? 'streaming',
    summary:
      own && st.status === 'completed' && typeof meta.summary === 'string'
        ? clip(meta.summary, 400)
        : null,
    job: own && typeof meta.job === 'string' ? meta.job : null,
    beats: own && Array.isArray(meta.beats) ? meta.beats.slice(0, 50) : null,
    error:
      st.status === 'error' ? clip(st.error?.message ?? 'Failed', 600) : null,
  };
}

function errorHint(error: SessionStructuredError): string | null {
  if (error.type === 'provider.auth' && /free tier/i.test(error.message))
    return "OpenCode's free tier refused this request. The studio keeps the shell tool behind approval because the free tier requires it; if this persists, choose another model in Agent settings.";
  if (error.type.startsWith('provider'))
    return 'The model provider refused or failed this request. Check the provider connection in Agent settings, or choose another model.';
  return null;
}
const errorView = (error: SessionStructuredError | undefined) =>
  error &&
  error.type !== 'aborted' && {
    type: error.type,
    message: clip(error.message, 600),
    status: error.status ?? null,
    hint: errorHint(error),
  };
function messagePart(
  part: SessionMessageAssistant['content'][number],
  dir: string,
) {
  switch (part.type) {
    case 'text':
      return { type: 'text', text: part.text };
    case 'reasoning':
      return { type: 'reasoning', text: clip(part.text, 2000) };
    case 'tool':
      return toolView(part, dir);
    default:
      return null;
  }
}
function assistantMessage(message: SessionMessageAssistant, dir: string) {
  return {
    id: message.id,
    role: 'assistant',
    at: message.time.created,
    done: !!message.time.completed,
    parts: message.content
      .map((part) => messagePart(part, dir))
      .filter(Boolean),
    error: errorView(message.error) || null,
    stopped: message.error?.type === 'aborted',
    model: message.model
      ? `${message.model.providerID}/${message.model.id}`
      : null,
    cost: message.cost ?? 0,
    retry: message.retry
      ? {
          attempt: message.retry.attempt,
          message: clip(message.retry.error?.message, 300),
        }
      : null,
  };
}
function userMessage(message: SessionMessageUser) {
  const metadata = contextMetadata(message.metadata?.clearframe);
  return {
    id: message.id,
    role: 'user',
    at: message.time.created,
    text:
      metadata.text ??
      message.text.replace(
        /\n*<clearframe-context>[\s\S]*<\/clearframe-context>\s*$/,
        '',
      ),
    scope: metadata.scope ?? null,
    hash: metadata.hash ?? null,
    revision: metadata.revision ?? null,
    mode: metadata.mode ?? null,
  };
}
/** The persisted conversation as the browser shows it. */
export function transcript(
  messages: readonly SessionMessageInfo[] | null | undefined,
  dir: string,
) {
  const out = [];
  for (const m of messages ?? []) {
    if (m.type === 'user') out.push(userMessage(m));
    else if (m.type === 'assistant') out.push(assistantMessage(m, dir));
    else if (m.type === 'idle')
      out.push({
        id: m.id,
        role: 'idle',
        at: m.time?.created,
        outcome: m.outcome,
      });
    else if (m.type === 'synthetic' && m.description)
      out.push({
        id: m.id,
        role: 'note',
        at: m.time?.created,
        text: clip(m.description, 300),
      });
    else if (m.type === 'compaction')
      out.push({
        id: m.id,
        role: 'note',
        at: m.time?.created,
        text: "Summarised earlier conversation to keep within the model's context.",
      });
  }
  return out;
}
