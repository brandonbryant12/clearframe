import type { Film, Version, Scene } from './00-boundary-films.js';

import type { MessageScope } from './00-boundary-agent.js';
import {
  say,
  agentInit,
  agentPane,
  flushOutbox,
  refreshAgent,
  drawAgent,
} from './40-agent.js';

import {
  data,
  server,
  agentOn,
  app,
  header,
  esc,
  when,
  store,
} from './00-core.js';
import { home, openNotes } from './20-home.js';
import { versionOf, pasteSheet, sceneAt, notesMessage } from './10-notes.js';
import type { Note } from './10-notes.js';
import { boards } from './35-boards.js';
import { byIdOptional, byId, stored, oneOf } from './00-boundary.js';

import { browserState } from './state.js';
import { TABS, tabOf } from './film-model.js';
import type { FilmSession, Tab } from './film-model.js';
import { player } from './film-player.js';
import { watchFilm } from './film-poll.js';

export let S: FilmSession | null = null;

export function filmPage(id: string, versionId: string | null | undefined) {
  const f = data.films.find((x) => x.id === id);
  if (!f) return home();
  document.title = f.title;
  const v = versionOf(f, versionId) ?? f.versions.at(-1) ?? null;
  const withAgent = server && agentOn && f.kind === 'clearframe';
  app.innerHTML = `${header(f)}<section class="film ${f.aspect}">
    <div class="watch" id="watch"></div>
    <aside class="side" aria-label="Notes and the agent">
      ${withAgent ? `<div class="tabs" role="tablist"><button role="tab" data-tab="notes">Notes <span class="count" id="notecount"></span></button><button role="tab" data-tab="agent">Agent <span class="dot" id="agentdot"></span></button></div>` : ''}
      <div class="pane" id="notes"></div>${withAgent ? '<div class="pane" id="agent" hidden></div>' : ''}</aside></section>`;
  if (v) drawVersionPicker(f, v);

  const session: FilmSession = {
    id: f.id,
    f,
    v,
    withAgent,
    time: () => 0,
    disposed: false,
    jobs: [],
  };
  S = session;
  const send = (notes: Note[]) => sendNotes(f, v, withAgent, notes);
  const notes = v ? player(f, v, send) : boards(f, send);
  if (withAgent) startAgent(session, f, v);
  const count = () => {
    const el = byIdOptional('notecount', HTMLElement);
    if (el) el.textContent = String(openNotes(f) || '');
  };
  session.notesChanged = () => {
    count();
    notes.redraw();
  };
  count();
  const stop = browserState.stopPage;
  browserState.stopPage = () => {
    stop?.();
    session.disposed = true;
    S = null;
  };
}

export function drawVersionPicker(f: Film, v: Version) {
  const latest = f.versions.at(-1);
  const options = [...f.versions]
    .reverse()
    .map(
      (x) =>
        `<option value="${esc(x.id)}" ${x === v ? 'selected' : ''}>Version ${x.number}${x === latest ? ' (latest)' : ''} · ${esc(when(x.createdAt))}</option>`,
    )
    .join('');
  byId('barright', HTMLElement).innerHTML =
    `${f.versions.length > 1 ? `<select id="versions" aria-label="Version">${options}</select>` : `<span class="muted">Version ${v.number} · ${esc(when(v.createdAt))}</span>`}
    <a class="btn small" href="${esc(v.video)}" download>Download</a>`;
  const picker = byIdOptional('versions', HTMLSelectElement);
  picker?.addEventListener('change', () => {
    location.hash = `#/film/${f.id}/${picker.value}`;
  });
}

/** One note saved in the film goes as that note; anything else goes as notes on the whole film. */
export function noteScope(n: Note, s: Scene | null): MessageScope {
  return {
    kind: 'note',
    note: n.id,
    noteText: n.text,
    beats: s ? [s.id] : [],
    ...(n.at != null ? { t: n.at } : {}),
    label: `Note ${n.id}`,
  };
}

export function sendNotes(
  f: Film,
  v: Version | null,
  withAgent: boolean,
  notes: Note[],
) {
  if (!withAgent) return pasteSheet(f, v, notes);
  const one = notes.length === 1 && !notes[0].local ? notes[0] : null,
    s = one ? sceneAt(versionOf(f, one.version), one.at) : null;
  say(notesMessage(f, v, notes), one ? noteScope(one, s) : { kind: 'film' });
  showTab('agent');
}

export function startAgent(session: FilmSession, f: Film, v: Version | null) {
  agentInit(session);
  agentPane(byId('agent', HTMLElement));
  // A film the agent is still making opens on the conversation; one with a cut opens on its notes.
  showTab(stored(`cf-tab:${f.id}`, oneOf(TABS), v ? 'notes' : 'agent'));
  for (const b of app.querySelectorAll('[data-tab]'))
    b.addEventListener('click', () => {
      const tab = tabOf(b.getAttribute('data-tab'));
      if (tab) showTab(tab);
    });
  flushOutbox();
  refreshAgent(true);
  watchFilm(f, v);
}

export function showTab(tab: Tab) {
  if (!S?.withAgent) return;
  store.set(`cf-tab:${S.id}`, tab);
  for (const b of app.querySelectorAll('[data-tab]'))
    b.setAttribute('aria-selected', String(b.getAttribute('data-tab') === tab));
  byId('notes', HTMLElement).hidden = tab !== 'notes';
  byId('agent', HTMLElement).hidden = tab !== 'agent';
  if (tab === 'agent' && S.agent) {
    S.agent.unseen = false;
    drawAgent();
  }
}
