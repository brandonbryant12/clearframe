import path from 'node:path';
import { errorMessage } from '../harness/contracts.mjs';
import type { ViewerFilm } from './contracts.mjs';
import type { ViewerApi, Reply, BuiltViewer } from './api-contracts.mjs';
import { loadViewerNotes } from './notes.mjs';
import { readDecisions, readKeeps } from '../notes.mjs';
import { studioState, studioSchema } from './studio.mjs';
import { filmData } from './build.mjs';
import { soundState } from './sound.mjs';
import { spendLog } from './spend.mjs';
/** Notes remain live while playback and the built film metadata stay stable. */
function freshNotes(film: ViewerFilm, dirs: BuiltViewer['dirs']) {
  const dir = dirs[film.id];
  if (!dir || film.kind !== 'clearframe' || !film.versions.length) return film;
  let notes;
  try {
    notes = loadViewerNotes(dir);
  } catch {
    return film;
  }
  const ids = new Set(film.versions.map((version) => version.id)),
    latest = film.versions[film.versions.length - 1].id;
  return {
    ...film,
    versions: film.versions.map((version) => ({
      ...version,
      notes: [
        ...notes.filter((note) => note.version === version.id),
        ...(version.id === latest
          ? notes
              .filter((note) => note.version && !ids.has(note.version))
              .map((note) => ({
                ...note,
                earlier: note.version,
                earlierAt: note.at,
                at: null,
                pin: null,
                element: null,
              }))
          : []),
      ],
    })),
  };
}
async function startCatalog() {
  const [{ playbooks }, { treatments }, { directions }] = await Promise.all([
    import('../../../film/playbooks.mjs'),
    import('../../../film/treatments.mjs'),
    import('../../../film/directions.mjs'),
  ]);
  return {
    playbooks: playbooks().map((p) => ({
      id: p.id,
      title: p.title,
      audience: p.audience,
      inputs: p.inputs,
    })),
    treatments: treatments().map((t) => ({
      id: t.id,
      title: t.title,
      when: t.when ?? '',
    })),
    directions: directions().map((d) => ({
      id: d.id,
      title: d.title,
      when: d.when,
      materials: d.materials,
    })),
  };
}
async function checkpointsOf(dir: string) {
  try {
    const { checkpoints } = await import('../checkpoints.mjs');
    return { checkpoints: checkpoints(dir, { mode: 'guided' }) };
  } catch (error) {
    return { checkpoints: [], checkpointsError: errorMessage(error) };
  }
}
function listJobs(ctx: ViewerApi, url: URL, reply: Reply) {
  const harness = ctx.jobs.health();
  try {
    return reply(200, {
      jobs: ctx.jobs.list(url.searchParams.get('film') ?? undefined),
      harness,
    });
  } catch (error) {
    return reply(503, { error: errorMessage(error), harness });
  }
}
async function readFilm(ctx: ViewerApi, url: URL, reply: Reply) {
  const dir = ctx.dirOf(url.searchParams.get('film'));
  if (!dir) return reply(404, { error: 'Unknown film' });
  switch (url.pathname) {
    case '/api/notes':
      return reply(200, { notes: loadViewerNotes(dir) });
    case '/api/studio/state':
      return reply(200, { ...studioState(dir), paused: ctx.pauseOf(dir) });
    case '/api/studio/film':
      return reply(200, await filmData(dir, { out: ctx.out }));
    case '/api/studio/sound':
      return reply(200, {
        ...soundState(dir, ctx.base),
        spend: spendLog(dir).slice(-20),
      });
    case '/api/studio/review':
      return reply(200, {
        decisions: readDecisions(dir),
        keeps: readKeeps(dir),
        ...(await checkpointsOf(dir)),
      });
    case '/api/agent/conversation':
      if (ctx.agent) return reply(200, await ctx.agent.conversation(dir));
      break;
  }
  return reply(404, { error: 'Unknown studio endpoint' });
}
export async function get(ctx: ViewerApi, url: URL, reply: Reply) {
  const built = ctx.built(),
    projects = path.relative(ctx.base, ctx.projectRoot) || '.';
  switch (url.pathname) {
    case '/api/ping':
      return reply(200, { ok: true, studio: true });
    case '/api/studio/schema':
      return reply(200, studioSchema());
    case '/api/studio/jobs':
      return listJobs(ctx, url, reply);
    case '/api/studio/jobs/events':
      return reply(200, {
        events: ctx.jobs.events({
          after: Number(url.searchParams.get('after') ?? 0),
          jobId: url.searchParams.get('jobId') ?? undefined,
        }),
      });
    case '/api/films':
      return reply(200, {
        generatedAt: built.data.generatedAt,
        roots: built.data.roots,
        films: built.data.films.map((film) => freshNotes(film, built.dirs)),
        projects,
        agent: !!ctx.agent,
      });
    case '/api/agent/status':
      return reply(200, {
        enabled: !!ctx.agent,
        disabled: ctx.agentOff,
        runtime: ctx.runtime?.status() ?? null,
        projects,
      });
    case '/api/agent/catalog':
      return reply(200, await startCatalog());
    case '/api/agent/models':
      if (ctx.agent) return reply(200, { models: await ctx.agent.models() });
      break;
    case '/api/agent/integrations':
      if (ctx.agent)
        return reply(200, { integrations: await ctx.agent.integrations() });
      break;
  }
  return readFilm(ctx, url, reply);
}
