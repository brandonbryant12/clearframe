import { data, app, header, server, serverReady, agentOn } from './00-core.js';

import { drawFilms } from './home-cards.js';
import { homeState, savedForm } from './home-model.js';
import { homeForm } from './home-form.js';
import { createFilm } from './home-create.js';

export function home() {
  document.title = 'ClearFrame';
  app.innerHTML = `${header()}<section class="page"><div id="home-top"></div>
    <h2 class="films-h">${data.films.length ? 'Films' : ''}</h2><div class="grid" id="films"></div></section>`;
  drawFilms();
  mountHome();
}

export async function mountHome() {
  let alive = true;
  homeState.cleanup = () => {
    alive = false;
    homeState.cleanup = null;
  };
  await serverReady;
  if (!alive || !server) return;
  const [films, catalog] = await Promise.all([
    refreshFilms(),
    agentOn ? loadCatalog() : null,
  ]);
  if (!alive || !document.getElementById('home-top')) return;
  homeState.project = { agent: agentOn, catalog, projects: films?.projects };
  drawFilms();
  if (!homeState.project.agent) return;
  homeForm();
  // A create interrupted by a refresh finishes with the same ids.
  const f = savedForm();
  if (f?.request && f.started) createFilm(true);
}

export { refreshFilms } from './home-api.js';
import { refreshFilms, loadCatalog } from './home-api.js';
