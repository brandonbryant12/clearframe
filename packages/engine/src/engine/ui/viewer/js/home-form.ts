import { byIdOptional, byId, hit, valueOf } from './00-boundary.js';

import type { FilmForm } from './00-boundary-films.js';
import { esc, store } from './00-core.js';

import { savedForm, FORM_KEY } from './home-model.js';
import { createFilm } from './home-create.js';
import { addSources, syncGo } from './home-uploads.js';

export const FORMATS = [
  ['landscape', 'Wide'],
  ['vertical', 'Tall'],
];

export const fileItem = (name: string) =>
  `<li>${esc(name)} <button type="button" class="link" data-remove="${esc(name)}" aria-label="Remove ${esc(name)}">Remove</button></li>`;

export function homeForm() {
  const el = byIdOptional('home-top', HTMLElement);
  if (!el) return;
  const f: FilmForm = savedForm() ?? {},
    format = f.format ?? 'landscape';
  el.innerHTML = `<form class="make" id="nf" novalidate>
      <h1>What are we making?</h1>
      <textarea id="nf-idea" rows="3" placeholder="A 45-second explainer on why there are two high tides a day, for curious teenagers." aria-label="The idea">${esc(f.idea ?? '')}</textarea>
      <div class="makerow">
        <div class="seg" role="radiogroup" aria-label="Format">${FORMATS.map(([v, l]) => `<label><input type="radio" name="nf-format" value="${v}" ${format === v ? 'checked' : ''}><span>${l}</span></label>`).join('')}</div>
        <button type="button" class="btn small" id="nf-add">Add files…</button><input type="file" id="nf-files" multiple hidden accept=".md,.markdown,.txt,.pdf,.docx,.html,.htm,.rtf,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.svg,.mp4,.mov,.webm,.wav,.mp3,.m4a">
        <span class="grow"></span><button class="btn agent inline" type="submit" id="nf-go">Make it</button></div>
      <ul class="files" id="nf-list">${(f.documents ?? []).map(fileItem).join('')}</ul>
      <p class="muted small progress" id="nf-progress" role="status" aria-live="polite">The agent writes it and renders a first cut you can watch. Reports, scripts or pictures you add are read and used.</p>
    </form>`;
  wireForm();
}

export function wireForm() {
  const form = byId('nf', HTMLFormElement),
    files = byId('nf-files', HTMLInputElement);
  const save = () => {
    store.set(FORM_KEY, { ...(savedForm() ?? {}), ...readForm() });
  };
  form.addEventListener('input', save);
  form.addEventListener('change', save);
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    createFilm();
  });
  form.addEventListener('keydown', (e) => {
    if (
      e.key === 'Enter' &&
      !e.shiftKey &&
      e.target instanceof Element &&
      e.target.id === 'nf-idea'
    ) {
      e.preventDefault();
      createFilm();
    }
  });
  byId('nf-add', HTMLButtonElement).onclick = () => files.click();
  files.onchange = () => {
    const picked = [...(files.files ?? [])];
    files.value = '';
    addSources(picked);
  };
  syncGo();
  byId('nf-list', HTMLElement).onclick = removeSource;
}

export function removeSource(e: MouseEvent) {
  const b = hit(e, '[data-remove]');
  if (!b) return;
  const cur: FilmForm = savedForm() ?? {};
  cur.documents = (cur.documents ?? []).filter((d) => d !== b.dataset.remove);
  store.set(FORM_KEY, cur);
  b.closest('li')?.remove();
}

export function readForm(): FilmForm {
  return {
    idea: valueOf(document.getElementById('nf-idea')) ?? '',
    title: '',
    playbook: '',
    treatment: '',
    audience: '',
    takeaway: '',
    format:
      valueOf(document.querySelector('input[name="nf-format"]:checked')) ??
      'landscape',
    mode: 'oneshot',
  };
}

export const progress = (message: string, tone = '') => {
  const p = document.getElementById('nf-progress');
  if (p) {
    p.textContent = message;
    p.dataset.tone = tone;
  }
};
