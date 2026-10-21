import type { Catalog } from './00-boundary-agent.js';
import { stored } from './00-boundary.js';
import { decodeFilmForm } from './00-boundary-films.js';
import type { FilmForm } from './00-boundary-films.js';

// Home: say what you want made, and see every film. With the local server, making one creates a
// project folder, links an agent conversation to it and sends your words as the first message,
// then opens the film. Every step carries a durable id (the create request, the first message)
// kept until it is confirmed, so a refresh or a retry never makes two films or sends twice.
export interface HomeState {
  agent: boolean;
  catalog: Catalog | null;
  projects?: string | null;
}

export const homeState: {
  project: HomeState;
  cleanup: (() => void) | null;
  creating: boolean;
} = {
  project: { agent: false, catalog: null },
  cleanup: null,
  creating: false,
};

export const newId = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(12)), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('');

export const FORM_KEY = 'cf-new-film';

export const savedForm = () =>
  stored<FilmForm | null>(FORM_KEY, decodeFilmForm, null);
