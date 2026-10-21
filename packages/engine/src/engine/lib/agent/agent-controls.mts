import type { OpenCodeClient, IntegrationInfo } from '@opencode/client';
import { readLink, updateLink, checkSubmission } from './links.mjs';
import { parseModel, isFree } from './runtime.mjs';
import type { AgentOptions } from './contracts.mjs';
import type { AgentSessions } from './agent-session.mjs';
import { fail } from './agent-common.mjs';
const hasKeyMethod = (integration: IntegrationInfo) =>
  (integration.methods ?? []).some((method) => method.type === 'key');
function integrationView(integration: IntegrationInfo) {
  return {
    id: integration.id,
    name: integration.name,
    connected: (integration.connections ?? []).length > 0,
    via: (integration.connections ?? []).map((connection) =>
      connection.type === 'env'
        ? `environment ${connection.name}`
        : `saved ${connection.method}`,
    ),
  };
}

export function createControls(
  { base = process.cwd(), runtime }: AgentOptions,
  { guard }: AgentSessions,
) {
  const sid = (dir: string) => {
    const s = readLink(dir).sessionID;
    if (!s) throw fail('This film has no conversation yet.', 409);
    return s;
  };
  const ownsForm = async (c: OpenCodeClient, sessionID: string, id: string) =>
    (await c.session.form.list({ sessionID })).some((f) => f.id === id);

  return {
    setMode(dir: string, mode: unknown) {
      if (mode !== 'oneshot' && mode !== 'together')
        throw fail('Choose one-shot or together.');
      updateLink(dir, (l) => ({ ...l, mode }));
      return { mode };
    },
    discard(dir: string, id: string) {
      checkSubmission(id);
      updateLink(dir, (l) => {
        l.submissions = l.submissions.filter(
          (s) => s.id !== id || s.state === 'sent',
        );
      });
      return { ok: true };
    },
    interrupt: (dir: string) =>
      guard((c) => c.session.interrupt({ sessionID: sid(dir), resume: false })),
    cancelQueued: (dir: string, inboxID: string) =>
      guard((c) =>
        c.session.inbox.cancel({
          sessionID: sid(dir),
          inboxID: String(inboxID),
        }),
      ).then(() => ({ ok: true })),
    steerQueued: (dir: string, inboxID: string) =>
      guard((c) =>
        c.session.inbox.update({
          sessionID: sid(dir),
          inboxID: String(inboxID),
          delivery: 'steer',
        }),
      ).then(() => ({ ok: true })),
    async permission(
      dir: string,
      { id, decision }: { id: string; decision: string },
    ) {
      if (decision !== 'once' && decision !== 'always' && decision !== 'reject')
        throw fail('Choose allow once, always, or reject.');
      return guard(async (c) => {
        const s = sid(dir),
          list = await c.permission.list({ sessionID: s });
        if (!list.some((p) => p.id === id))
          throw fail('That request was already answered.', 409);
        // A refusal says why, so the agent can carry on without the command instead of stopping.
        await c.permission.reply({
          sessionID: s,
          requestID: id,
          decision,
          ...(decision === 'reject'
            ? {
                message:
                  'The person declined this. Do not retry it; continue with the ClearFrame tools (clearframe_guide has the docs), or explain what you need and why.',
              }
            : {}),
        });
        return { ok: true };
      });
    },
    async form(
      dir: string,
      {
        id,
        answer,
        cancel,
      }: {
        id: string;
        answer?: Parameters<
          OpenCodeClient['session']['form']['reply']
        >[0]['answer'];
        cancel?: boolean;
      },
    ) {
      return guard(async (c) => {
        const s = sid(dir);
        if (!(await ownsForm(c, s, id)))
          throw fail('That question was already answered.', 409);
        if (cancel) await c.session.form.cancel({ sessionID: s, formID: id });
        else
          await c.session.form.reply({
            sessionID: s,
            formID: id,
            answer: answer ?? {},
          });
        return { ok: true };
      });
    },
    async models() {
      const list = await guard(() => runtime.models({ refresh: true }));
      return list
        .filter(
          (m) =>
            m.enabled &&
            m.capabilities?.tools !== false &&
            (m.capabilities?.output ?? ['text']).includes('text'),
        )
        .map((m) => ({
          id: `${m.providerID}/${m.id}`,
          name: m.name,
          provider: m.providerID,
          free: isFree(m),
          status: m.status,
          context: m.limit?.context ?? null,
        }))
        .sort(
          (a, b) =>
            Number(b.free) - Number(a.free) ||
            a.provider.localeCompare(b.provider) ||
            a.name.localeCompare(b.name),
        );
    },
    async setModel(dir: string, value: unknown) {
      const model = parseModel(value);
      if (!model) throw fail('Choose a model.');
      const list = await guard(() => runtime.models());
      if (
        !list.some(
          (m) =>
            m.providerID === model.providerID && m.id === model.id && m.enabled,
        )
      )
        throw fail('That model is not available in this runtime.');
      const link = readLink(dir);
      if (link.sessionID)
        await guard((c) =>
          c.session.switchModel({
            sessionID: sid(dir),
            model: { providerID: model.providerID, id: model.id },
          }),
        );
      updateLink(dir, (l) => ({ ...l, model }));
      return { model: `${model.providerID}/${model.id}` };
    },
    async integrations() {
      return guard(async (c) => {
        const r = await c.integration.list({ location: { directory: base } });
        const integrations: IntegrationInfo[] = Array.isArray(r)
          ? r
          : (r.data ?? []);
        return integrations.filter(hasKeyMethod).map(integrationView);
      });
    },
    async connectKey({
      integrationID,
      key,
    }: {
      integrationID?: string;
      key?: string;
    }) {
      if (
        typeof integrationID !== 'string' ||
        !/^[\w.-]{1,60}$/.test(integrationID)
      )
        throw fail('Choose a provider.');
      if (typeof key !== 'string' || key.trim().length < 8 || key.length > 4000)
        throw fail("Paste the provider's API key.");
      // The key goes straight to OpenCode's own credential store in the studio runtime; ClearFrame keeps no copy.
      await guard((c) =>
        c.integration.connect.key({
          integrationID,
          key: key.trim(),
          location: { directory: base },
        }),
      );
      return { ok: true };
    },
  };
}
