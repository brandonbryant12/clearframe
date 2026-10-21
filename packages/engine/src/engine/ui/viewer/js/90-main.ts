import {
  sheetEl,
  closeSheet,
  serverReady,
  server,
  data,
  call,
} from './00-core.js';
import { typingIn, byIdOptional } from './00-boundary.js';
import { decodeFreshFilm } from './00-boundary-films.js';
import { homeState, home } from './20-home.js';
import { filmPage } from './30-film.js';
import { browserState } from './state.js';
// Keyboard and routing.
addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !sheetEl.hidden) return closeSheet();
  if (
    !browserState.pageKeys ||
    !sheetEl.hidden ||
    typingIn(/input|textarea|select/i)
  )
    return;
  if (e.key === ' ' && browserState.pageKeys.toggle) {
    e.preventDefault();
    browserState.pageKeys.toggle();
  }
  if (e.key === 'ArrowRight' && browserState.pageKeys.nudge)
    browserState.pageKeys.nudge(e.shiftKey ? 5 : 1);
  if (e.key === 'ArrowLeft' && browserState.pageKeys.nudge)
    browserState.pageKeys.nudge(e.shiftKey ? -5 : -1);
  if (e.key === 'n' || e.key === 'N') {
    e.preventDefault();
    browserState.pageKeys.note?.();
  }
});

async function refreshFilm(id: string | undefined): Promise<void> {
  await serverReady;
  if (
    !id ||
    !server ||
    data.films.find((film) => film.id === id)?.kind !== 'clearframe'
  )
    return;
  const url = `/api/studio/film?film=${encodeURIComponent(id)}`;
  const raw = await call(url).catch(() => null);
  const fresh = decodeFreshFilm(raw, url);
  const index = data.films.findIndex((film) => film.id === id);
  if (fresh && index >= 0)
    data.films[index] = { ...data.films[index], ...fresh };
}

function seekOnLoad(seconds: number): void {
  const video = byIdOptional('video', HTMLVideoElement);
  if (!video || !(seconds > 0)) return;
  const seek = () => {
    video.currentTime = seconds;
  };
  if (video.readyState) seek();
  else video.addEventListener('loadedmetadata', seek, { once: true });
}

export async function route() {
  closeSheet();
  browserState.stopPage?.();
  browserState.stopPage = null;
  homeState.cleanup?.();
  browserState.lastLog = '';
  const [path, query] = location.hash.split('?'),
    [, page, id, version] = path.split('/');
  const start = Number(new URLSearchParams(query ?? '').get('t'));
  if (page === 'film') {
    await refreshFilm(id);
    filmPage(
      decodeURIComponent(id ?? ''),
      version && decodeURIComponent(version),
    );
    seekOnLoad(start);
  } else home();
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();
