import type { Film, Version } from './00-boundary-films.js';
import { find, failureOf, hit } from './00-boundary.js';
import {
  store,
  myName,
  call,
  sheet,
  esc,
  plural,
  toast,
  closeSheet,
} from './00-core.js';
import { route } from './90-main.js';
import type {
  NotesColumnOptions,
  NotesColumn,
  NoteExtra,
  NoteAnchor,
} from './notes-model.js';
import {
  addNote,
  sortNotes,
  notesOf,
  noteAct,
  setState,
} from './notes-storage.js';
import {
  noteNumbers,
  stickyHTML,
  emptyWords,
  sendHTML,
} from './notes-cards.js';

/** The notes beside a film or its boards. */
export function notesColumn(
  el: HTMLElement,
  o: NotesColumnOptions,
): NotesColumn {
  const { f, v } = o;
  let wholeFilm = false,
    showDone = false,
    active: string | null = null;
  el.innerHTML = `<div class="composer">
      <textarea rows="2" placeholder="${esc(o.placeholder)}" aria-label="New note"></textarea>
      <div class="crow"><button class="anchor" type="button" title="What this note is about: click for the whole film"></button><span class="grow"></span>
        <button class="btn small primary" data-save>Add note</button></div></div>
    <div class="list" aria-live="polite"></div><div class="send"></div>`;
  const input = find(el, 'textarea', HTMLTextAreaElement),
    anchorBtn = find(el, '.anchor', HTMLButtonElement),
    list = find(el, '.list', HTMLElement),
    sendEl = find(el, '.send', HTMLElement);
  const drawAnchor = () => {
    anchorBtn.textContent = wholeFilm ? 'Whole film' : o.anchorLabel();
    anchorBtn.classList.toggle('film', wholeFilm);
  };
  anchorBtn.onclick = () => {
    wholeFilm = !wholeFilm;
    drawAnchor();
    input.focus();
  };
  input.addEventListener('focus', () => o.onTyping?.());
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      save();
    }
    if (e.key === 'Escape') input.blur();
  });
  find(el, '[data-save]', HTMLButtonElement).onclick = () => save();

  async function save(extra: NoteExtra = {}): Promise<boolean> {
    const said = (extra.text ?? input.value).trim();
    if (!said) return false;
    const a: NoteAnchor =
      wholeFilm && !extra.spot
        ? { version: v?.id ?? null, at: null }
        : o.anchor();
    try {
      if (!(await addNote(f, { ...a, ...extra, text: said }))) return false;
    } catch (x) {
      toast(esc(failureOf(x).message), 5000);
      return false;
    }
    if (extra.text == null) input.value = '';
    wholeFilm = false;
    redraw();
    o.changed?.();
    return true;
  }
  const numbers = () => noteNumbers(f, v);
  function redraw() {
    const all = sortNotes(f, v, notesOf(f)),
      nums = numbers();
    const done = all.filter((n) => n.state === 'done'),
      shown = showDone ? all : all.filter((n) => n.state !== 'done');
    list.innerHTML = shown.length
      ? shown
          .map((n) => stickyHTML(f, v, n, nums.get(n.id), n.id === active))
          .join('')
      : `<div class="empty">${emptyWords(f, v)}</div>`;
    if (done.length)
      list.insertAdjacentHTML(
        'beforeend',
        `<button class="link showdone">${showDone ? 'Hide done notes' : `Show ${plural(done.length, 'done note')}`}</button>`,
      );
    sendEl.innerHTML = sendHTML(f, v, all);
    drawAnchor();
  }

  list.addEventListener('click', async (e) => {
    if (hit(e, '.showdone')) {
      showDone = !showDone;
      return redraw();
    }
    const card = hit(e, '.sticky'),
      act = hit(e, '[data-act]')?.dataset.act;
    if (!card) return;
    const n = notesOf(f).find((x) => x.id === card.dataset.id);
    if (!n) return;
    if (!act || act === 'seek') {
      active = n.id;
      o.seek(n);
      return redraw();
    }
    const state = noteAct(act);
    if (!state) return;
    try {
      await setState(f, n, state);
    } catch (x) {
      return toast(esc(failureOf(x).message), 5000);
    }
    redraw();
    o.changed?.();
  });
  sendEl.addEventListener('click', async (e) => {
    if (hit(e, '[data-approve]')) {
      if (v) approveSheet(f, v);
      return;
    }
    if (!hit(e, '[data-send]')) return;
    if (input.value.trim() && !(await save())) return;
    o.send(
      sortNotes(
        f,
        v,
        notesOf(f).filter((n) => n.state === 'open'),
      ),
    );
  });
  redraw();
  return {
    redraw,
    save,
    numbers,
    focus: () => input.focus(),
    anchorMoved: () => {
      if (!wholeFilm) drawAnchor();
    },
    highlight(id) {
      active = id;
      redraw();
      list
        .querySelector(`[data-id="${CSS.escape(id)}"]`)
        ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    },
  };
}

/** Approval is the person's own words, recorded as `accept --by --said` does. */
export function approveSheet(f: Film, v: Version): void {
  const card = sheet(`<h2>Approve version ${v.number}</h2>
    <p class="muted">This records that you approve this cut, in your own words. The agent can then make the final.</p>
    <input class="field" id="ap-by" placeholder="Your name" value="${esc(myName())}" autocomplete="name">
    <textarea class="field" id="ap-said" rows="2" placeholder="In your words, for example: Looks great, ready to share."></textarea>
    <p class="muted small" id="ap-msg" role="status"></p>
    <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ap-go">Approve</button></div>`);
  const byIn = find(card, '#ap-by', HTMLInputElement),
    saidIn = find(card, '#ap-said', HTMLTextAreaElement),
    msg = find(card, '#ap-msg', HTMLElement);
  saidIn.focus();
  find(card, '#ap-go', HTMLButtonElement).onclick = async () => {
    const by = byIn.value.trim(),
      said = saidIn.value.trim();
    if (!by || !said) {
      msg.textContent =
        'Your name and your words are both recorded with the approval.';
      return;
    }
    store.set('cf-name', by);
    try {
      await call('/api/studio/accept', {
        film: f.id,
        revision: v.id,
        by,
        said,
      });
    } catch (e) {
      msg.textContent = failureOf(e).message;
      return;
    }
    v.approved = { by, said };
    closeSheet();
    toast(`Version ${v.number} approved.`);
    route();
  };
}
