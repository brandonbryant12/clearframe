import { get } from './api-read.mjs';
import type { ViewerApi, Reply, ApiRequest } from './api-contracts.mjs';
export type { ViewerApi, Reply } from './api-contracts.mjs';

import type { IncomingMessage } from 'node:http';
import * as Schema from 'effect/Schema';
import {
  errorMessage,
  errorStatus,
  isRecord,
  JobRequestSchema,
} from '../harness/contracts.mjs';

import {
  ApiRequestSchema,
  BridgeRequestSchema,
  requiredText,
} from './http-contracts.mjs';

import { studioCommand } from './studio.mjs';

import { saveNote, setNoteState, replyToNote } from './notes.mjs';
import { addDecision, setNoteStatus } from '../notes.mjs';
import { checkId } from '../store.mjs';

import { startSound, answerSpend } from './spend.mjs';
import {
  createProject,
  findCreated,
  uploadToProject,
  uploadToDraft,
} from '../agent/projects.mjs';

function readJSON(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 1e6) {
        reject(Object.assign(new Error('Request too large.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(
          Object.assign(new Error('That request is not JSON.'), {
            status: 400,
          }),
        );
      }
    });
    req.on('error', reject);
  });
}
const errorReply = (reply: Reply, error: unknown) =>
  reply(errorStatus(error) ?? 400, {
    error: errorMessage(error),
    ...(isRecord(error) && error.errors ? { errors: error.errors } : {}),
  });

function accept(dir: string, body: ApiRequest) {
  const revision = checkId('revision', body.revision),
    note = body.note;
  if (note != null) checkId('note', note);
  const by = String(body.by ?? '').trim(),
    said = String(body.said ?? '').trim();
  if (!by || !said)
    throw new Error('An acceptance records who accepted and what they said.');
  const decision = addDecision(dir, {
    action: 'accept',
    role: 'human',
    by,
    said,
    revision,
    scope: note ? { note } : {},
  });
  if (note) setNoteStatus(dir, note, 'accepted', { revision, by });
  return { decision };
}
async function bridge(ctx: ViewerApi, req: IncomingMessage, reply: Reply) {
  if (
    !ctx.agent ||
    req.headers.origin ||
    !ctx.bridgeAuth(req.headers.authorization)
  )
    return reply(403, { error: 'Not a ClearFrame studio tool call.' });
  const body = Schema.decodeUnknownSync(BridgeRequestSchema)(
    await readJSON(req),
  );
  try {
    return reply(200, await ctx.agent.bridge(body));
  } catch (error) {
    return errorReply(reply, error);
  }
}
async function upload(
  ctx: ViewerApi,
  req: IncomingMessage,
  url: URL,
  reply: Reply,
) {
  if (req.headers['x-clearframe-upload'] !== '1')
    return reply(403, { error: 'Upload from the studio page.' });
  const name = url.searchParams.get('name'),
    draft = url.searchParams.get('draft');
  try {
    if (draft)
      return reply(
        200,
        await uploadToDraft(ctx.paths.uploads, draft, req, name),
      );
    const dir = ctx.dirOf(url.searchParams.get('film'));
    if (!dir) {
      req.resume();
      return reply(404, { error: 'Unknown film' });
    }
    return reply(200, await uploadToProject(dir, req, name));
  } catch (error) {
    req.resume();
    return errorReply(reply, error);
  }
}
async function project(ctx: ViewerApi, body: ApiRequest, reply: Reply) {
  try {
    const again = findCreated(
      Object.values(ctx.built().dirs),
      body.request ?? '',
    );
    const dir =
      again ?? createProject(ctx.projectRoot, ctx.paths.uploads, body);
    if (!again) await ctx.rebuild();
    const built = ctx.built(),
      id = Object.keys(built.dirs).find((key) => built.dirs[key] === dir);
    return reply(again ? 200 : 201, {
      film: built.data.films.find((film) => film.id === id) ?? null,
      id,
    });
  } catch (error) {
    return errorReply(reply, error);
  }
}
function agentAction(
  agent: NonNullable<ViewerApi['agent']>,
  dir: string,
  verb: string,
  body: ApiRequest,
) {
  switch (verb) {
    case 'prompt':
      return agent.prompt(dir, body);
    case 'discard':
      return agent.discard(dir, requiredText(body.submission, 'Submission id'));
    case 'interrupt':
      return agent.interrupt(dir);
    case 'queue/cancel':
      return agent.cancelQueued(dir, requiredText(body.id, 'Message id'));
    case 'queue/steer':
      return agent.steerQueued(dir, requiredText(body.id, 'Message id'));
    case 'permission':
      return agent.permission(dir, {
        id: requiredText(body.id, 'Permission id'),
        decision: requiredText(body.decision, 'Decision'),
      });
    case 'form':
      return agent.form(dir, { ...body, id: requiredText(body.id, 'Form id') });
    case 'model':
      return agent.setModel(dir, body.model);
    case 'mode':
      return agent.setMode(dir, body.mode);
    case 'session':
      return agent.session(dir).then((link) => ({ linked: !!link.sessionID }));
    default:
      throw Object.assign(new Error('Unknown studio endpoint'), {
        status: 404,
      });
  }
}
function editFilm(ctx: ViewerApi, dir: string, body: ApiRequest, reply: Reply) {
  const paused = ctx.pauseOf(dir);
  if (paused)
    return reply(409, {
      error: `${paused.label} is using the working copy. Cancel it or wait for it to finish before editing.`,
      paused,
    });
  return reply(200, { ...studioCommand(dir, body), paused: null });
}
async function postFilm(
  ctx: ViewerApi,
  p: string,
  body: ApiRequest,
  reply: Reply,
) {
  const dir = ctx.dirOf(body.film);
  if (!dir) return reply(404, { error: 'Unknown film' });
  try {
    switch (p) {
      case '/api/notes':
        return reply(
          200,
          saveNote(dir, {
            ...body,
            scope: typeof body.scope === 'string' ? body.scope : undefined,
          }),
        );
      case '/api/notes/state':
        return reply(
          200,
          setNoteState(dir, requiredText(body.id, 'Note id'), body),
        );
      case '/api/notes/reply':
        return reply(
          200,
          replyToNote(dir, requiredText(body.id, 'Note id'), body),
        );
      case '/api/studio/jobs':
        return reply(
          202,
          ctx.jobs.start(dir, Schema.decodeUnknownSync(JobRequestSchema)(body)),
        );
      case '/api/studio/command':
        return editFilm(ctx, dir, body, reply);
      case '/api/studio/accept':
        return reply(200, accept(dir, body));
      case '/api/studio/sound':
        return reply(202, startSound(dir, body.film, ctx.jobs, body));
      case '/api/agent/spend':
        if (ctx.agent)
          return reply(
            200,
            answerSpend(dir, body.film, ctx.jobs, {
              ...body,
              id: requiredText(body.id, 'Request id'),
              decision: requiredText(body.decision, 'Decision'),
            }),
          );
        break;
    }
    if (ctx.agent && p.startsWith('/api/agent/'))
      return reply(
        200,
        await agentAction(ctx.agent, dir, p.slice('/api/agent/'.length), body),
      );
    return reply(404, { error: 'Unknown studio endpoint' });
  } catch (error) {
    return errorReply(reply, error);
  }
}
async function postJSON(
  ctx: ViewerApi,
  p: string,
  body: ApiRequest,
  reply: Reply,
) {
  if (p === '/api/studio/jobs/cancel')
    return reply(200, ctx.jobs.cancel(requiredText(body.id, 'Job id')));
  if (ctx.agent && p === '/api/projects') return project(ctx, body, reply);
  if (ctx.agent && p === '/api/agent/start') {
    try {
      await ctx.runtime?.client();
    } catch {}
    return reply(200, { runtime: ctx.runtime?.status() });
  }
  if (ctx.agent && p === '/api/agent/connect') {
    try {
      return reply(200, await ctx.agent.connectKey(body));
    } catch (error) {
      return errorReply(reply, error);
    }
  }
  return postFilm(ctx, p, body, reply);
}

/** The private bridge is authenticated separately; browser writes must be same origin. */
export async function serveApi(
  ctx: ViewerApi,
  req: IncomingMessage,
  url: URL,
  reply: Reply,
) {
  if (req.method === 'GET') return get(ctx, url, reply);
  if (req.method !== 'POST') return reply(405, { error: 'Use GET or POST.' });
  if (url.pathname === '/api/agent/bridge') return bridge(ctx, req, reply);
  const origin = req.headers.origin;
  if (origin && origin !== `http://${req.headers.host}`)
    return reply(403, { error: 'Open the studio on this computer to edit.' });
  if (url.pathname === '/api/upload') return upload(ctx, req, url, reply);
  if (!req.headers['content-type']?.startsWith('application/json'))
    return reply(415, { error: 'Expected a JSON request.' });
  const body = Schema.decodeUnknownSync(ApiRequestSchema)(await readJSON(req));
  return postJSON(ctx, url.pathname, body, reply);
}
