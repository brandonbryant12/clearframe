import { decodeCatalog } from './00-boundary-agent.js';
import { decodeFilmListing } from './00-boundary-films.js';
import type { FilmListing } from './00-boundary-films.js';
import { data, call } from './00-core.js';
/** Fresh films from the server: a film made a moment ago is listed without rebuilding the page. */
export async function refreshFilms(): Promise<FilmListing | null> {
  const r = await fetch('/api/films')
    .then((x) => (x.ok ? x.json() : null))
    .then((j: unknown) =>
      j === null ? null : decodeFilmListing(j, '/api/films'),
    )
    .catch(() => null);
  if (r) {
    data.films = r.films;
    data.roots = r.roots;
  }
  return r;
}

export const loadCatalog = () =>
  call('/api/agent/catalog')
    .then((j) => decodeCatalog(j, '/api/agent/catalog'))
    .catch(() => null);
