import fs from 'node:fs';
import path from 'node:path';
import type {
  OpenCodeClient,
  SessionMessageInfo,
  SessionMessagesResponse,
} from '@opencode/client';
import { errorMessage, errorStatus } from '../harness/contracts.mjs';
import { readLink, updateLink, sessionIndex } from './links.mjs';
import { DEFAULT_MODEL } from './runtime.mjs';
import type {
  AgentOptions,
  ConversationLink,
  CurrentScope,
} from './contracts.mjs';
import { contextMetadata } from './messages.mjs';
import { clip, fail } from './agent-common.mjs';
export function createSessionStore({
  base = process.cwd(),
  runtime,
  dirs,
  filmOf,
}: AgentOptions) {
  let index = new Map<string, string>();
  const verified = new Set<string>();
  /**
   * The persisted conversation, oldest first. session.context is what the model sees and loses the
   * person's earlier messages when OpenCode compacts; message.list keeps everything.
   */
  async function history(
    c: OpenCodeClient,
    sessionID: string,
    {
      until = null,
      limit = 300,
      pages = 10,
    }: {
      until?: ((messages: readonly SessionMessageInfo[]) => boolean) | null;
      limit?: number;
      pages?: number;
    } = {},
  ) {
    const out: SessionMessageInfo[] = [];
    let cursor: string | null | undefined;
    for (let i = 0; i < pages; i++) {
      // The first page sets the order; OpenCode refuses an order alongside a cursor.
      const r: SessionMessagesResponse = await c.message.list({
        sessionID,
        limit: Math.min(limit, 200),
        ...(cursor ? { cursor } : { order: 'desc' }),
      });
      const page: SessionMessageInfo[] = Array.isArray(r) ? r : (r.data ?? []);
      out.push(...page);
      cursor = r?.cursor?.next;
      if (
        !cursor ||
        !page.length ||
        out.length >= limit ||
        (until && until(out))
      )
        return { messages: out.reverse(), more: !!cursor };
    }
    return { messages: out.reverse(), more: !!cursor };
  }
  const reindex = () => {
    index = sessionIndex(dirs());
    return index;
  };
  const client = (): Promise<OpenCodeClient> => runtime.client();
  const guard = async <A,>(
    fn: (client: OpenCodeClient) => Promise<A>,
  ): Promise<A> => {
    try {
      return await fn(await client());
    } catch (e) {
      runtime.lost(e);
      throw errorStatus(e) ? e : fail(errorMessage(e), 502);
    }
  };

  /** One promise chain per project: work that reads, then writes, a project's link never interleaves. */
  const chains = new Map<string, Promise<void>>();
  function serial<A>(dir: string, fn: () => Promise<A>): Promise<A> {
    let key;
    try {
      key = fs.realpathSync(dir);
    } catch {
      key = path.resolve(dir);
    }
    const run = (chains.get(key) ?? Promise.resolve()).then(fn, fn);
    const tail = run.then(
      () => {},
      () => {},
    );
    chains.set(key, tail);
    tail.then(() => {
      if (chains.get(key) === tail) chains.delete(key);
    });
    return run;
  }

  /**
   * The project's one conversation, created on first use. Creation is serialised per project in this
   * server, and the link is written compare-and-set: if another studio process linked the project
   * meanwhile, its session wins and the one made here is removed, so a project never has two.
   */
  function session(
    dir: string,
    { create = true }: { create?: boolean } = {},
  ): Promise<ConversationLink> {
    return serial(dir, async () => {
      const link = readLink(dir);
      const c = await client();
      if (link.sessionID && !verified.has(link.sessionID)) {
        const ok = await c.session.get({ sessionID: link.sessionID }).then(
          () => true,
          (e: unknown) =>
            /not found|404/i.test(errorMessage(e)) ? false : Promise.reject(e),
        );
        if (ok) verified.add(link.sessionID);
        else
          updateLink(dir, (l) =>
            l.sessionID === link.sessionID
              ? {
                  ...l,
                  previous: [
                    ...(l.previous ?? []),
                    {
                      sessionID: l.sessionID,
                      lostAt: new Date().toISOString(),
                    },
                  ],
                  sessionID: null,
                }
              : l,
          );
      }
      const now = readLink(dir);
      if (now.sessionID || !create) return now;
      const film = filmOf(dir);
      const model = now.model ?? DEFAULT_MODEL;
      const s = await c.session.create({
        location: { directory: dir },
        title: clip(film?.title ?? path.basename(dir), 120),
        model: { providerID: model.providerID, id: model.id },
        metadata: { clearframe: { folder: path.relative(base, dir) } },
      });
      let won = true;
      const l = updateLink(dir, (x) => {
        if (x.sessionID) {
          won = false;
          return x;
        }
        return {
          ...x,
          sessionID: s.id,
          model,
          createdAt: x.createdAt ?? new Date().toISOString(),
        };
      });
      if (!won) {
        await c.session.remove({ sessionID: s.id }).catch(() => {});
        if (l.sessionID) {
          verified.add(l.sessionID);
          index.set(l.sessionID, dir);
        }
        return l;
      }
      verified.add(s.id);
      index.set(s.id, dir);
      return l;
    });
  }

  async function currentScope(
    sessionID: string,
    messageID: string | null,
  ): Promise<CurrentScope> {
    let ctx;
    // From the persisted history, not the model's (compactable) context: the request survives compaction.
    const answered = (list: readonly SessionMessageInfo[]) => {
      const k = list.findIndex((m) => m.id === messageID);
      return k >= 0 && list.slice(k + 1).some((m) => m.type === 'user');
    };
    try {
      ctx = (
        await history(await client(), sessionID, {
          limit: 2000,
          pages: 20,
          until: answered,
        })
      ).messages;
    } catch {
      throw fail(
        'Could not confirm which request this edit answers (OpenCode did not respond), so nothing was changed. Try the edit again.',
        503,
      );
    }
    const i =
      typeof messageID === 'string'
        ? ctx.findIndex((m) => m.id === messageID)
        : -1;
    if (i < 0)
      throw fail(
        "This edit does not come from a reply in this film's conversation, so nothing was changed.",
        409,
      );
    const user = ctx
      .slice(0, i)
      .reverse()
      .find((m) => m.type === 'user');
    if (!user)
      throw fail(
        'This edit answers no request from the person, so nothing was changed.',
        409,
      );
    return {
      scope: contextMetadata(user.metadata?.clearframe).scope ?? {
        kind: 'film',
      },
      run: user.id,
    };
  }
  return {
    reindex,
    client,
    guard,
    serial,
    session,
    currentScope,
    history,
    directory: (id: string) => index.get(id) ?? reindex().get(id),
  };
}
export type AgentSessions = ReturnType<typeof createSessionStore>;
