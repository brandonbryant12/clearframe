import type { OutboxEntry } from './00-boundary-agent.js';
import { setDisabled, failureOf } from './00-boundary.js';
import { decodeMadeProject } from './00-boundary-films.js';
import type { FilmForm, MadeFilm } from './00-boundary-films.js';
import { data, plural, call, store } from './00-core.js';

import { newSubmission, outboxKey, loadOutbox } from './40-agent.js';
import { savedForm, homeState, newId, FORM_KEY } from './home-model.js';
import { readForm, progress } from './home-form.js';
import { syncGo, pendingUploads, draftOf, drafts } from './home-uploads.js';
import { refreshFilms } from './home-api.js';
import { firstMessage } from './home-prompt.js';

export const currentForm = (resume: boolean): FilmForm => ({
  ...(savedForm() ?? {}),
  ...(resume ? {} : readForm()),
});

// Files still uploading belong to this draft: wait for them so the film and its brief include them.
export async function waitForUploads(
  request: string,
  resume: boolean,
): Promise<FilmForm> {
  homeState.creating = true;
  syncGo();
  progress(
    `Waiting for ${plural(pendingUploads(request), 'file')} to finish uploading…`,
  );
  await Promise.allSettled(
    [...draftOf(request).pending.values()].map((u) => u.promise),
  );
  homeState.creating = false;
  return currentForm(resume);
}

export async function createFilm(resume = false) {
  if (homeState.creating) return;
  let cur = currentForm(resume);
  if (cur.request && pendingUploads(cur.request))
    cur = await waitForUploads(cur.request, resume);
  if (!cur.idea?.trim() && !cur.documents?.length) {
    progress('Say what the film is about, or add a document.', 'error');
    document.getElementById('nf-idea')?.focus();
    syncGo();
    return;
  }
  homeState.creating = true;
  setDisabled(document.getElementById('nf-go'), true);
  const request = cur.request ?? `req-${newId()}`,
    submission = cur.submission ?? newSubmission();
  cur = {
    ...cur,
    request,
    submission,
    started: true,
    mode: cur.mode ?? 'oneshot',
  };
  store.set(FORM_KEY, cur);
  try {
    await makeFilm(cur, request, submission, resume);
  } catch (e) {
    const { message, status } = failureOf(e);
    progress(
      `${message}${status >= 500 || !status ? ' — your words are kept; try again.' : ''}`,
      'error',
    );
  } finally {
    homeState.creating = false;
    syncGo();
  }
}

export async function makeFilm(
  cur: FilmForm,
  request: string,
  submission: string,
  resume: boolean,
) {
  progress(resume ? 'Finishing the film you started…' : 'Making the project…');
  const made = decodeMadeProject(
    await call('/api/projects', {
      request,
      idea: cur.idea,
      title: cur.title,
      playbook: cur.playbook || undefined,
      treatment: cur.treatment || undefined,
      format: cur.format,
      mode: cur.mode,
      audience: cur.audience,
      takeaway: cur.takeaway,
      documents: cur.documents ?? [],
    }),
    '/api/projects',
  );
  await refreshFilms();
  progress('Starting the agent…');
  const film: MadeFilm = made.film ??
    data.films.find((x) => x.id === made.id) ?? {
      title: cur.title || 'the film',
    };
  const first: OutboxEntry = {
    id: submission,
    submission,
    text: firstMessage(cur, film),
    scope: { kind: 'film' },
    delivery: 'queue',
    hash: null,
    t: 0,
  };
  try {
    await call('/api/agent/prompt', { film: made.id, ...first });
  } catch (e) {
    // The film exists: open it with the message waiting in its outbox (same id), shown as not sent with the reason.
    store.set(outboxKey(made.id), [
      ...loadOutbox(made.id).filter((o) => o.id !== first.id),
      { ...first, failed: failureOf(e).message },
    ]);
  }
  store.set(FORM_KEY, null);
  drafts.delete(request);
  location.hash = `#/film/${made.id}`;
}
