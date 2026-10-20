import { setDisabled, serverError, failureOf } from './00-boundary.js';
import { decodeUpload } from './00-boundary-films.js';
import type { FilmForm } from './00-boundary-films.js';
import { esc, plural, store } from './00-core.js';

import { savedForm, FORM_KEY, homeState, newId } from './home-model.js';
import { readForm, progress, fileItem } from './home-form.js';

/**
 * Files wait in a draft folder named by the create request until the film exists. Each upload is
 * bound to the draft it started in: its result is recorded only in that draft (never in a newer
 * form after a create), Make it waits for it, and it keeps going if you leave the page and come back.
 */
export interface PendingUpload {
  name: string;
  promise: Promise<void>;
}

export interface Draft {
  pending: Map<string, PendingUpload>;
}

export const drafts = new Map<string, Draft>();

// request -> its uploads still in flight
export function draftOf(request: string): Draft {
  const known = drafts.get(request);
  if (known) return known;
  const draft: Draft = { pending: new Map() };
  drafts.set(request, draft);
  return draft;
}

export function updateDraft(
  request: string,
  fn: (d: FilmForm) => void,
): boolean {
  const cur = savedForm();
  if (!cur || cur.request !== request) return false;
  fn(cur);
  store.set(FORM_KEY, cur);
  return true;
}

export const pendingUploads = (request: string | null | undefined) =>
  (request && drafts.get(request)?.pending.size) || 0;

export function syncGo() {
  const req = savedForm()?.request,
    n = pendingUploads(req),
    go = document.getElementById('nf-go');
  if (go) {
    setDisabled(go, homeState.creating || n > 0);
    go.textContent = n ? `Uploading ${plural(n, 'file')}…` : 'Make it';
  }
  const list = document.getElementById('nf-list');
  if (list) syncPending(list, req ? drafts.get(req) : undefined);
}

/** The list shows a line for each upload still in flight, and drops the lines of finished ones. */
export function syncPending(list: HTMLElement, draft: Draft | undefined) {
  for (const li of list.querySelectorAll('[data-pending]')) {
    const id = li.getAttribute('data-pending');
    if (!id || !draft?.pending.has(id)) li.remove();
  }
  for (const [id, u] of draft?.pending ?? [])
    if (!list.querySelector(`[data-pending="${id}"]`))
      list.insertAdjacentHTML(
        'beforeend',
        `<li data-pending="${id}">${esc(u.name)} <span class="muted">uploading…</span></li>`,
      );
}

export function addSources(files: readonly File[]) {
  const cur: FilmForm = savedForm() ?? {},
    request = cur.request ?? `req-${newId()}`;
  store.set(FORM_KEY, { ...cur, ...readForm(), request });
  const draft = draftOf(request);
  return Promise.all(files.map((f) => startUpload(request, draft, f)));
}

export function startUpload(
  request: string,
  draft: Draft,
  f: File,
): Promise<void> {
  const id = newId(),
    promise = upload(request, f).finally(() => {
      draft.pending.delete(id);
      syncGo();
    });
  draft.pending.set(id, { name: f.name, promise });
  syncGo();
  return promise;
}

/** One file into its draft. Never rejects: a refusal is shown under the form. */
export async function upload(request: string, f: File): Promise<void> {
  try {
    const r = await fetch(
      `/api/upload?draft=${encodeURIComponent(request)}&name=${encodeURIComponent(f.name)}`,
      {
        method: 'POST',
        headers: {
          'x-clearframe-upload': '1',
          'content-type': 'application/octet-stream',
        },
        body: f,
      },
    );
    const j: unknown = await r.json().catch(() => ({}));
    if (!r.ok) {
      progress(`${f.name}: ${serverError(j) ?? 'refused'}`, 'error');
      return;
    }
    const file = decodeUpload(j, '/api/upload');
    if (
      updateDraft(request, (d) => {
        d.documents = [...new Set([...(d.documents ?? []), file])];
      })
    ) {
      document
        .getElementById('nf-list')
        ?.insertAdjacentHTML('beforeend', fileItem(file));
      progress(`Added ${file}.`);
    }
  } catch (e) {
    progress(`${f.name}: ${failureOf(e).message}`, 'error');
  }
}
