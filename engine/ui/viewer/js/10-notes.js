// Notes: one list per version, merged from the film's record and notes kept in this browser.
// Resolve, reopen and reply go to the local server when it runs; browser notes change in place.
const tagsOf = text => [...new Set((String(text).match(/#[\p{L}\p{N}_-]+/gu) ?? []).map(t => t.slice(1).toLowerCase()))];
const localKey = film => `cf-notes:${film}`;
const localView = n => ({ ...n, local: true, resolved: !!n.resolved, state: n.resolved ? 'Resolved' : 'Open', tags: tagsOf(n.text), replies: n.replies ?? [] });

function notesFor(f, v) {
  const local = store.get(localKey(f.id), []).filter(n => n.version === v.id).map(localView);
  return [...v.notes, ...local].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));
}

function editLocal(f, id, change) {
  const list = store.get(localKey(f.id), []), n = list.find(x => x.id === id);
  if (!n) throw new Error('This note is not in this browser.');
  change(n); store.set(localKey(f.id), list);
  return localView(n);
}
/** Replace a note from the film's record with the server's updated copy. */
function swapNote(v, updated) { const i = v.notes.findIndex(x => x.id === updated.id); if (i >= 0) v.notes[i] = updated; else v.notes.push(updated); }

async function addNoteTo(f, v, note) {
  if (server) { const saved = await api('/api/notes', { film: f.id, ...note }); v.notes.push(saved); return saved; }
  const list = store.get(localKey(f.id), []), saved = { ...note, id: `local-${Date.now()}`, createdAt: new Date().toISOString(), replies: [] };
  list.push(saved); store.set(localKey(f.id), list);
  return localView(saved);
}
async function resolveNote(f, v, n, resolved) {
  const by = store.get('cf-name', '') || null;
  if (n.local) return editLocal(f, n.id, x => { x.resolved = resolved; });
  if (!server) throw new Error('Run the viewer with --serve to resolve notes saved in the film.');
  const updated = await api('/api/notes/state', { film: f.id, id: n.id, resolved, by }); swapNote(v, updated); return updated;
}
async function replyNote(f, v, n, text) {
  const by = store.get('cf-name', '') || null;
  if (n.local) return editLocal(f, n.id, x => { (x.replies ??= []).push({ text, by, at: new Date().toISOString() }); });
  if (!server) throw new Error('Run the viewer with --serve to reply to notes saved in the film.');
  const updated = await api('/api/notes/reply', { film: f.id, id: n.id, text, by }); swapNote(v, updated); return updated;
}

const linkTags = text => esc(text).replace(/#([\p{L}\p{N}_-]+)/gu, '<span class="tag-chip">#$1</span>');
function thread(n, { open = false } = {}) {
  return `<div class="thread ${n.resolved ? 'resolved' : ''}" data-note="${esc(n.id)}">
    <div class="thead"><button class="ttime" data-seek="${n.at ?? 0}">${clock(n.at ?? 0)}</button><b>${esc(n.by ?? 'Note')}</b>
      <span class="chip ${n.resolved ? 'approved' : ''}">${esc(n.state)}</span>${n.local ? '<span class="chip">this browser</span>' : ''}
      <span class="tactions">${n.resolved ? '<button class="link" data-act="reopen">Reopen</button>' : '<button class="link" data-act="resolve">✓ Resolve</button>'}
      <button class="link" data-act="reply">Reply</button></span></div>
    <div class="ttext">${linkTags(n.text)}</div>
    ${n.replies.map(r => `<div class="reply"><b>${esc(r.by ?? 'Reply')}</b> ${linkTags(r.text)} <span class="meta">${when(r.at)}</span></div>`).join('')}
    <div class="replybox" ${open ? '' : 'hidden'}><textarea rows="2" placeholder="Reply…"></textarea><button class="btn primary" data-act="send">Reply</button></div>
    <div class="terror meta" hidden></div></div>`;
}

/** Wire resolve/reopen/reply on threads inside `root`; `changed` redraws the workspace. */
function bindThreads(root, f, v, changed, seek) {
  root.onclick = async e => {
    const s = e.target.closest('[data-seek]');
    if (s && seek) { seek(Number(s.dataset.seek)); return; }
    const act = e.target.closest('[data-act]')?.dataset.act, t = e.target.closest('.thread');
    if (!act || !t) return;
    const n = notesFor(f, v).find(x => x.id === t.dataset.note), err = t.querySelector('.terror');
    try {
      if (act === 'reply') { const b = t.querySelector('.replybox'); b.hidden = !b.hidden; b.querySelector('textarea').focus(); return; }
      if (act === 'send') { const text = t.querySelector('textarea').value.trim(); if (!text) return; await replyNote(f, v, n, text); }
      if (act === 'resolve' || act === 'reopen') await resolveNote(f, v, n, act === 'resolve');
      changed();
    } catch (x) { err.hidden = false; err.textContent = x.message; }
  };
}

function notesPanel(f, v, filter) {
  const notes = notesFor(f, v), tags = [...new Set(notes.flatMap(n => n.tags))];
  const shown = notes.filter(n => filter === 'all' ? true : filter === 'resolved' ? n.resolved : filter === 'open' ? !n.resolved : n.tags.includes(filter.slice(1)));
  const count = k => notes.filter(n => k === 'open' ? !n.resolved : n.resolved).length;
  return `<div class="subnav notefilter">${[['open', `Open (${count('open')})`], ['resolved', `Resolved (${count('resolved')})`], ['all', `All (${notes.length})`], ...tags.map(t => [`#${t}`, `#${t}`])]
      .map(([k, t]) => `<button data-filter="${esc(k)}" aria-pressed="${k === filter}">${esc(t)}</button>`).join('')}</div>
    ${shown.length ? shown.map(n => thread(n)).join('') : `<div class="meta">${notes.length ? 'Nothing here with this filter.' : 'No notes yet. Press + Note, then click on the picture. Add #tags like #type or #pacing to group them.'}</div>`}
    ${!server && store.get(localKey(f.id), []).some(n => n.version === v.id) ? `<div class="row" style="margin-top:12px"><span class="meta">Notes made here are kept in this browser. Send them to the film:</span><button class="btn" id="export">Download notes</button></div>` : ''}`;
}

function exportLocal(f, v) {
  const notes = store.get(localKey(f.id), []).filter(n => n.version === v.id).map(n => ({ revision: n.version, at: n.at, text: n.text, by: n.by, element: n.element, pin: n.pin, replies: n.replies }));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify({ film: f.id, notes }, null, 2)], { type: 'application/json' }));
  a.download = `${f.id}-${v.id}-notes.json`; a.click();
}
