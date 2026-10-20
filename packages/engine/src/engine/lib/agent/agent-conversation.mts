import path from 'node:path';
import * as Schema from 'effect/Schema';
import type {
  SessionInboxInfo,
  SessionInboxUser,
  PermissionRequest,
} from '@opencode/client';
import { JsonValueSchema } from '../../schemas.mjs';
import { errorMessage } from '../harness/contracts.mjs';
import { readLink, updateLink, checkSubmission } from './links.mjs';
import { DEFAULT_MODEL } from './runtime.mjs';
import type { AgentOptions, PromptRequest } from './contracts.mjs';
import type { AgentSessions } from './agent-session.mjs';
import { contextMetadata, transcript } from './messages.mjs';
import {
  modeOf,
  resolveScope,
  cleanScope,
  contextBlock,
} from './agent-scope.mjs';
import { clip, fail } from './agent-common.mjs';
function queuedMessages(items: readonly SessionInboxInfo[]) {
  return items
    .filter((i): i is SessionInboxUser => i.type === 'user')
    .map((i) => ({
      id: i.id,
      text:
        contextMetadata(i.payload?.metadata?.clearframe).text ??
        clip(i.payload?.text, 2000),
      scope: contextMetadata(i.payload?.metadata?.clearframe).scope ?? null,
      delivery: i.delivery,
    }));
}

function markSubmission(dir: string, id: string, state: 'sent') {
  updateLink(dir, (link) => {
    const entry = link.submissions.find((item) => item.id === id);
    if (entry) {
      entry.state = state;
      delete entry.error;
    }
  });
}
function permissionView(permission: PermissionRequest) {
  return {
    id: permission.id,
    action: permission.action,
    resources: permission.resources
      .slice(0, 8)
      .map((resource) => clip(resource, 300)),
    message: clip(permission.message, 400),
    save: permission.save ?? [],
  };
}
export function createConversation(
  { base = process.cwd(), runtime, filmOf }: AgentOptions,
  sessions: AgentSessions,
) {
  const { guard, history, session } = sessions;
  async function conversation(dir: string) {
    const status = runtime.status();
    const link = readLink(dir);
    const pending = (link.submissions ?? [])
      .filter((s) => s.state !== 'sent')
      .map(({ id, text, scope, state, error, at, delivery }) => ({
        id,
        text,
        scope,
        state,
        error,
        at,
        delivery,
      }));
    const base = {
      runtime: status,
      linked: !!link.sessionID,
      mode: modeOf(link),
      spend: (link.spend ?? []).slice(-10),
      model: link.model
        ? `${link.model.providerID}/${link.model.id}`
        : `${DEFAULT_MODEL.providerID}/${DEFAULT_MODEL.id}`,
      pending,
      lost: (link.previous ?? []).length ? link.previous.at(-1) : null,
    };
    if (!link.sessionID)
      return {
        ...base,
        messages: [],
        running: false,
        queued: [],
        permissions: [],
        forms: [],
      };
    return guard(async (c) => {
      await session(dir, { create: false });
      const sid = readLink(dir).sessionID;
      if (!sid)
        return {
          ...base,
          linked: false,
          messages: [],
          running: false,
          queued: [],
          permissions: [],
          forms: [],
        };
      const [{ messages: ctx, more }, active, inbox, perms, forms, info] =
        await Promise.all([
          history(c, sid),
          c.session.active(),
          c.session.inbox.list({ sessionID: sid }).catch(() => []),
          c.permission.list({ sessionID: sid }).catch(() => []),
          c.session.form.list({ sessionID: sid }).catch(() => []),
          c.session.get({ sessionID: sid }).catch(() => null),
        ]);
      const messages = transcript(ctx, dir);
      const seen = new Set(
        messages.filter((m) => m.role === 'user').map((m) => m.id),
      );
      const queued = queuedMessages(inbox);
      const inQueue = new Set(queued.map((q) => q.id));
      return {
        ...base,
        sessionID: sid,
        messages,
        earlier: more,
        running: !!active?.[sid],
        queued,
        cost: info?.cost ?? 0,
        outcome: info?.outcome ?? null,
        pending: base.pending.filter(
          (p) => !seen.has(p.id) && !inQueue.has(p.id),
        ),
        permissions: (perms ?? []).map(permissionView),
        forms: (forms ?? []).map((f) => ({
          id: f.id,
          title: clip(f.title, 300),
          fields: f.fields,
        })),
      };
    });
  }

  async function prompt(dir: string, body: PromptRequest) {
    const id = checkSubmission(body.submission);
    const text = typeof body.text === 'string' ? body.text.trim() : '';
    if (!text || text.length > 20000)
      throw fail('Write a message (up to 20,000 characters).');
    const scope = resolveScope(dir, cleanScope(body.scope)),
      delivery = body.delivery === 'steer' ? 'steer' : 'queue';
    const hash = typeof body.hash === 'string' ? body.hash.slice(0, 64) : null,
      revision =
        typeof body.revision === 'string' ? body.revision.slice(0, 20) : null;
    const t =
      typeof body.t === 'number' && Number.isFinite(body.t)
        ? Math.round(body.t * 100) / 100
        : null;
    const existing = readLink(dir).submissions.find((s) => s.id === id);
    if (existing?.state === 'sent')
      return { submission: id, state: 'sent', duplicate: true };
    updateLink(dir, (l) => {
      l.submissions = [
        ...l.submissions.filter((s) => s.id !== id),
        {
          id,
          text,
          scope,
          delivery,
          hash,
          revision,
          t,
          at: existing?.at ?? new Date().toISOString(),
          state: 'sending',
        },
      ];
    });
    const film = filmOf(dir) ?? {
      title: path.basename(dir),
      folder: path.relative(base, dir),
    };
    try {
      return await guard(async (c) => {
        const { sessionID } = await session(dir);
        if (!sessionID) throw fail('The conversation was not created.', 502);
        const mode = modeOf(readLink(dir));
        await c.session.prompt({
          sessionID,
          id,
          text: text + contextBlock({ film, scope, hash, revision, t, mode }),
          delivery,
          metadata: {
            clearframe: Schema.decodeUnknownSync(JsonValueSchema)({
              text,
              scope,
              hash,
              revision,
              t,
              mode,
              film: path.relative(base, dir),
            }),
          },
        });
        markSubmission(dir, id, 'sent');
        return { submission: id, state: 'sent' };
      });
    } catch (e) {
      updateLink(dir, (l) => {
        const s = l.submissions.find((x) => x.id === id);
        if (s) {
          s.state = 'failed';
          s.error = clip(errorMessage(e), 400);
        }
      });
      throw e;
    }
  }

  return { conversation, prompt };
}
