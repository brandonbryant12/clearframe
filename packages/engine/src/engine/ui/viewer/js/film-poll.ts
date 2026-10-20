import { decodeFreshFilm } from './00-boundary-films.js';
import type { Film, Version } from './00-boundary-films.js';
import { decodeJobs } from './00-boundary-agent.js';

import { drawAgent, currentSession, agentBusy } from './40-agent.js';

import { data, esc, call } from './00-core.js';

import { byIdOptional, typingIn } from './00-boundary.js';
import { route } from './90-main.js';
import { browserState } from './state.js';
import { S } from './film-page.js';
import { LIVE_JOBS } from './film-model.js';
import type { FilmSession } from './film-model.js';

/** Keep the film current while the agent works: new versions, answered notes, render progress. */
export function watchFilm(f: Film, v: Version | null) {
  const session = S,
    seen = { latest: f.versions.at(-1)?.id ?? null };
  if (!session) return;
  let timer = 0;
  const tick = async () => {
    if (!currentSession(session)) return;
    const busy =
      agentBusy(session.agent) ||
      session.jobs.some((j) => LIVE_JOBS.includes(j.status));
    try {
      if (!(await pollFilm(session, f, v, seen))) return;
    } catch {
      /* the server may be busy or restarting: look again later */
    }
    timer = setTimeout(tick, busy ? 3000 : 12000);
  };
  timer = setTimeout(tick, 1500);
  const stop = browserState.stopPage;
  browserState.stopPage = () => {
    clearTimeout(timer);
    stop?.();
  };
}

/** One look at the film and its jobs. False when watching should stop (the page moved on). */
export async function pollFilm(
  session: FilmSession,
  f: Film,
  v: Version | null,
  seen: { latest: string | null },
): Promise<boolean> {
  const [film, jobs] = await Promise.all([
    call(`/api/studio/film?film=${encodeURIComponent(f.id)}`).then((j) =>
      decodeFreshFilm(j, '/api/studio/film'),
    ),
    call(`/api/studio/jobs?film=${encodeURIComponent(f.id)}`)
      .then((j) => decodeJobs(j, '/api/studio/jobs'))
      .catch(() => []),
  ]);
  if (!currentSession(session)) return false;
  session.jobs = jobs;
  if (film && !takeFilm(session, f, v, film, seen)) return false;
  drawAgent();
  return true;
}

/** Notes answered or closed elsewhere: take the film's own record. False when the page shows the first cut instead. */
export function takeFilm(
  session: FilmSession,
  f: Film,
  v: Version | null,
  film: Film,
  seen: { latest: string | null },
): boolean {
  const i = data.films.findIndex((x) => x.id === f.id);
  if (i >= 0) data.films[i] = { ...f, ...film };
  f.versions.forEach((x, k) => {
    const y = film.versions.find((z) => z.id === x.id);
    if (y) f.versions[k].notes = y.notes;
  });
  const now = film.versions.at(-1)?.id ?? null;
  if (now && now !== seen.latest) {
    seen.latest = now;
    // No cut on screen yet: show the first one straight away. Otherwise offer it.
    if (!v && !typingIn(/input|textarea/i)) {
      route();
      return false;
    }
    const banner = byIdOptional('newversion', HTMLElement);
    if (banner) {
      banner.hidden = false;
      banner.innerHTML = `The agent made version ${film.versions.length}. <a href="#/film/${esc(f.id)}">Watch it</a>`;
    }
  }
  session.notesChanged?.();
  session.drawMarks?.();
  return true;
}
