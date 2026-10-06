// Sticky notes: a moment (or a scene, or the whole film), an optional spot on the picture, and
// words for the agent. Saved in the film's review record when served; kept in this browser otherwise.
// States: open; changed (the agent says it acted, with one line on what it did); done.
const localKey = f => `cf-notes:${f.id}`;
const versionOf = (f, id) => f.versions.find(v => v.id === id) ?? null;
const STATE = { open: 'open', question: 'open', applied: 'changed', accepted: 'done', dismissed: 'done' };

/** Every note on the film, from every version, plus the ones kept in this browser. */
function notesOf(f) {
  const seen = new Set(), out = [];
  for (const v of f.versions) for (const n of v.notes ?? []) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    out.push({ ...n, version: n.earlier ?? v.id, at: n.earlier ? n.earlierAt ?? null : n.at, state: STATE[n.status] ?? (n.resolved ? 'done' : 'open') });
  }
  for (const n of store.get(localKey(f.id), [])) if (n.state !== 'removed') out.push({ ...n, local: true });
  return out;
}
const timeIn = (f, v, n) => (n.at == null || !v ? null : n.at);
const sceneAt = (v, t) => v?.scenes?.find(s => t >= s.start && t < s.end) ?? (t != null ? v?.scenes?.at(-1) : null) ?? null;
// Whole-film notes first, then by moment (or by scene on boards).
const sortKey = (f, v, n) => timeIn(f, v, n) ?? (n.scene ? f.boards?.find(b => b.id === n.scene)?.number ?? 1e6 : -1);
const sortNotes = (f, v, list) => [...list].sort((a, b) => sortKey(f, v, a) - sortKey(f, v, b));

/** Replace a saved note in its version's list with the server's copy. */
function keepNote(f, saved, versionId) {
  const v = versionOf(f, versionId) ?? f.versions.at(-1);
  if (!v) return;
  v.notes ??= [];
  const i = v.notes.findIndex(x => x.id === saved.id);
  if (i >= 0) v.notes[i] = { ...v.notes[i], ...saved }; else v.notes.push(saved);
}

async function addNote(f, note) {
  // Notes on a saved version go into the film when served; boards and loose cuts stay in this browser.
  if (server && f.notesTo && note.version && note.version !== 'latest') {
    const by = await askName('Notes saved in the film record who left them.');
    if (!by) return null;
    const saved = await call('/api/notes', { film: f.id, version: note.version, text: note.text, by, ...(note.at == null ? { scope: 'film' } : { at: note.at }),
      ...(note.spot ? { pin: { x: note.spot.x, y: note.spot.y, on: note.on ?? undefined } } : {}), ...(note.element ? { element: note.element } : {}) });
    keepNote(f, saved, note.version);
    return saved;
  }
  const list = store.get(localKey(f.id), []), saved = { ...note, by: myName() || null, id: `local-${Date.now()}`, state: 'open', createdAt: new Date().toISOString() };
  list.push(saved); store.set(localKey(f.id), list);
  return saved;
}

/** done, open (again) or removed. A note saved in the film records who closed it. */
async function setState(f, n, state) {
  if (n.local) {
    const list = store.get(localKey(f.id), []), x = list.find(y => y.id === n.id);
    if (x) { x.state = state; store.set(localKey(f.id), list); }
    return;
  }
  if (!server) throw new Error('Open the viewer with --serve to change notes saved in the film.');
  const by = state === 'open' ? myName() : await askName('Closing a note records who decided.');
  if (state !== 'open' && !by) return;
  const saved = await call('/api/notes/state', { film: f.id, id: n.id, resolved: state !== 'open', dismiss: state === 'removed', by });
  keepNote(f, saved, n.version);
}

// ---------------------------------------------------------------- notes in words, for the agent

const stampTime = t => `${Math.floor(t / 60)}:${(t % 60).toFixed(2).padStart(5, '0')}`;
const shellQuote = s => JSON.stringify(s).replace(/[$`]/g, c => `\\${c}`);
function spotWords({ x, y }) {
  const row = y < 1 / 3 ? 'top' : y > 2 / 3 ? 'bottom' : 'middle', col = x < 1 / 3 ? 'left' : x > 2 / 3 ? 'right' : 'centre';
  return row === 'middle' && col === 'centre' ? 'centre' : `${row} ${col}`;
}
const spotOf = n => n.spot ?? n.pin ?? null;
const placeOf = n => [spotOf(n) && spotWords(spotOf(n)), n.on && `on “${n.on}”`].filter(Boolean).join(', ');

/** One line a person can read and the agent can act on: which note, when, which scene, where, what. */
function noteLine(f, n, i) {
  const v = versionOf(f, n.version), s = n.at != null ? sceneAt(v, n.at) : null, b = n.scene ? f.boards?.find(x => x.id === n.scene) : null;
  const when = n.at != null ? `${clock(n.at)}${v && f.versions.length > 1 ? ` in version ${v.number}` : ''}` : b ? `Scene ${b.number} (${b.kind})` : 'Whole film';
  const bits = [n.local ? null : n.id, when, s && `scene ${s.number} (${s.kind}${s.id ? `, ${s.id}` : ''})`, placeOf(n) && `pinned ${placeOf(n)}`].filter(Boolean).join(' · ');
  return `${i + 1}. ${bits}: ${n.text}`;
}

/** The message that hands notes to the agent: the notes, then what to do with them. */
function notesMessage(f, v, notes) {
  const head = f.kind === 'brief' ? `Please make a film from the brief in ${f.folder}.`
    : !v ? `Here are my notes on the storyboard for “${f.title}”.`
    : `Here are my notes on version ${v.number}${v.id !== 'latest' ? ` (${v.id})` : ''} of “${f.title}”.`;
  const lines = notes.map((n, i) => noteLine(f, n, i)).join('\n');
  const saved = notes.filter(n => !n.local);
  const how = f.kind === 'brief' ? 'Show me a rough cut first.'
    : !v ? 'Change only the scenes these notes are about, then render a rough cut.'
    : `${saved.length ? 'They are saved as review notes (clearframe_notes lists them, with where each is pinned). ' : ''}Change only what each note points at, render a new cut, then answer each note you acted on.`;
  return `${head}\n\n${lines}${lines ? '\n\n' : ''}${how}`;
}

/** Opened as a file there is no agent on the page: the same notes as a message to paste, with the commands to record them. */
function pastePrompt(f, v, notes) {
  const where = f.folder, by = myName() ? ` --by ${shellQuote(myName())}` : '';
  const head = !v ? `Here are my notes on the storyboard for “${f.title}”.` : `Here are my notes on version ${v.number}${v.id !== 'latest' ? ` (${v.id})` : ''} of “${f.title}”.`;
  const saved = notes.filter(n => !n.local), record = notes.filter(n => n.local && n.version && n.version !== 'latest').map(n => n.at != null
    ? `node engine/cli.mjs note ${where} ${shellQuote(`[ClearFrame ${n.version} @ ${stampTime(n.at)}${sceneAt(versionOf(f, n.version), n.at)?.id ? ` · ${sceneAt(versionOf(f, n.version), n.at).id}` : ''}${placeOf(n) ? ` · ${placeOf(n)}` : ''}] ${n.text}`)}${by}`
    : `node engine/cli.mjs note ${where} ${shellQuote(n.text)} --rev ${n.version}${by}`);
  return [head, '', notes.map((n, i) => noteLine(f, n, i)).join('\n'), '', `The film is in ${where}.`,
    saved.length ? `${saved.map(n => n.id).join(', ')} ${saved.length === 1 ? 'is' : 'are'} saved in its review record (\`node engine/cli.mjs notes ${where}\` shows where each is now).` : null,
    f.kind === 'clearframe' && record.length ? `Record ${saved.length ? 'the others' : 'them'} first:\n${record.join('\n')}` : null,
    f.kind === 'clearframe' ? 'Then follow skills/clearframe-review: change only what each note points at, render a new cut, and tell me what you changed for each note.' : 'Tell me what you would change for each note.']
    .filter(x => x != null).join('\n');
}

async function copy(text, button) {
  try { await navigator.clipboard.writeText(text); }
  catch { const t = document.createElement('textarea'); t.value = text; document.body.append(t); t.select(); document.execCommand('copy'); t.remove(); }
  if (button) { const was = button.textContent; button.textContent = 'Copied ✓'; setTimeout(() => { button.textContent = was; }, 1800); }
}
function pasteSheet(f, v, notes) {
  const card = sheet(`<h2>Hand your notes to your agent</h2>
    <p class="muted">Paste this into Claude Code (or another coding agent) in the ClearFrame folder. Each note carries its moment and its spot on the picture, so the agent can find the exact frame.</p>
    <textarea class="prompt" spellcheck="false">${esc(pastePrompt(f, v, notes))}</textarea>
    <div class="row"><button class="btn" data-close>Close</button><button class="btn primary" data-copy>Copy</button></div>`);
  card.querySelector('[data-copy]').onclick = e => copy(card.querySelector('textarea').value, e.currentTarget);
}

// ---------------------------------------------------------------- the notes list

/**
 * The notes beside a film or its boards.
 *   anchor()      what a new note is about now: {version, at} for a video, {scene} on boards
 *   anchorLabel() how the composer chip reads ("At 0:12", "Scene 3")
 *   seek(n)       show a note's moment or scene
 *   changed()     redraw what shows notes elsewhere (filmstrip markers, stickies on the picture)
 *   send(notes)   hand open notes to the agent
 */
function notesColumn(el, { f, v, anchor, anchorLabel, seek, changed, onTyping, send, placeholder }) {
  let wholeFilm = false, showDone = false, active = null;
  el.innerHTML = `<div class="composer">
      <textarea rows="2" placeholder="${esc(placeholder)}" aria-label="New note"></textarea>
      <div class="crow"><button class="anchor" type="button" title="What this note is about: click for the whole film"></button><span class="grow"></span>
        <button class="btn small primary" data-save>Add note</button></div></div>
    <div class="list" aria-live="polite"></div><div class="send"></div>`;
  const text = el.querySelector('textarea'), anchorBtn = el.querySelector('.anchor'), list = el.querySelector('.list'), sendEl = el.querySelector('.send');
  const drawAnchor = () => { anchorBtn.textContent = wholeFilm ? 'Whole film' : anchorLabel(); anchorBtn.classList.toggle('film', wholeFilm); };
  anchorBtn.onclick = () => { wholeFilm = !wholeFilm; drawAnchor(); text.focus(); };
  text.addEventListener('focus', () => onTyping?.());
  text.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); save(); } if (e.key === 'Escape') text.blur(); });
  el.querySelector('[data-save]').onclick = () => save();

  async function save(extra = {}) {
    const words = (extra.text ?? text.value).trim();
    if (!words) return false;
    const a = wholeFilm && !extra.spot ? { version: v?.id ?? null, at: null } : anchor();
    try { if (!(await addNote(f, { ...a, ...extra, text: words }))) return false; }
    catch (x) { toast(esc(x.message), 5000); return false; }
    if (extra.text == null) text.value = '';
    wholeFilm = false; redraw(); changed?.();
    return true;
  }

  function sticky(n, num) {
    const t = timeIn(f, v, n), from = versionOf(f, n.version), b = n.scene ? f.boards?.find(x => x.id === n.scene) : null;
    const label = t != null ? clock(t) : b ? `Scene ${b.number}` : 'Whole film';
    const other = from && v && from.id !== v.id ? `<span class="from" title="Left on version ${from.number}">v${from.number}</span>` : '';
    const changedIn = n.changedIn && versionOf(f, n.changedIn);
    const foot = n.state === 'open' ? '<button class="link" data-act="done">✓ Done</button>'
      : n.state === 'changed' ? `<span class="changedby">The agent changed this${changedIn ? ` in v${changedIn.number}` : ''}</span><span class="grow"></span><button class="link" data-act="done">Looks good</button><button class="link" data-act="open">Not yet</button>`
      : '<span class="muted">Done</span><span class="grow"></span><button class="link" data-act="open">Reopen</button>';
    return `<article class="sticky ${n.state} ${n.id === active ? 'active' : ''}" data-id="${esc(n.id)}">
      <div class="shead"><button class="when" data-act="seek" ${t == null && !b ? 'disabled' : ''}>${num ? `<b class="num">${num}</b>` : ''}${esc(label)}</button>${other}
        <span class="by">${esc(n.by ?? '')}</span><span class="grow"></span>${n.state === 'open' ? '<button class="x" data-act="removed" title="Remove this note" aria-label="Remove this note">×</button>' : ''}</div>
      <p>${esc(n.text)}</p>${placeOf(n) ? `<div class="where">${esc(placeOf(n))}</div>` : ''}
      ${n.state === 'changed' && n.answer ? `<div class="answer"><b>Agent:</b> ${esc(n.answer)}</div>` : ''}
      <div class="sfoot">${foot}</div></article>`;
  }

  function numbers() { let k = 0; return new Map(sortNotes(f, v, notesOf(f)).filter(n => spotOf(n)).map(n => [n.id, ++k])); }
  function redraw() {
    const all = sortNotes(f, v, notesOf(f)), nums = numbers();
    const live = all.filter(n => n.state !== 'done'), done = all.filter(n => n.state === 'done'), shown = showDone ? all : live;
    list.innerHTML = shown.length ? shown.map(n => sticky(n, nums.get(n.id))).join('')
      : `<div class="empty">${v ? 'No notes yet. Click anywhere on the picture to leave one right there, or type above.' : f.boards?.length ? 'No notes yet. Click a scene to leave a note on it, or type above.' : 'No notes yet.'}</div>`;
    if (done.length) list.insertAdjacentHTML('beforeend', `<button class="link showdone">${showDone ? 'Hide done notes' : `Show ${plural(done.length, 'done note')}`}</button>`);
    const open = all.filter(n => n.state === 'open'), latest = f.versions.at(-1);
    sendEl.innerHTML = open.length ? `<button class="btn agent" data-send>Send ${plural(open.length, 'note')} to the agent</button>`
      : v && v === latest && v.id !== 'latest' && !v.approved && f.kind === 'clearframe' && server && !all.some(n => n.state === 'changed') ? `<button class="btn" data-approve>Approve version ${v.number}</button>`
      : v?.approved ? `<div class="approved">✓ Approved${v.approved.by ? ` by ${esc(v.approved.by)}` : ''}${v.approved.said ? ` — “${esc(v.approved.said)}”` : ''}</div>` : '';
    drawAnchor();
  }

  list.addEventListener('click', async e => {
    if (e.target.closest('.showdone')) { showDone = !showDone; return redraw(); }
    const card = e.target.closest('.sticky'), act = e.target.closest('[data-act]')?.dataset.act;
    if (!card) return;
    const n = notesOf(f).find(x => x.id === card.dataset.id);
    if (!n) return;
    if (!act || act === 'seek') { active = n.id; seek(n); return redraw(); }
    try { await setState(f, n, act); } catch (x) { return toast(esc(x.message), 5000); }
    redraw(); changed?.();
  });
  sendEl.addEventListener('click', async e => {
    if (e.target.closest('[data-approve]')) return approveSheet(f, v);
    if (!e.target.closest('[data-send]')) return;
    if (text.value.trim() && !(await save())) return;
    send(sortNotes(f, v, notesOf(f).filter(n => n.state === 'open')));
  });
  redraw();
  return { redraw, save, numbers, focus: () => text.focus(), anchorMoved: () => { if (!wholeFilm) drawAnchor(); },
    highlight(id) { active = id; redraw(); list.querySelector(`[data-id="${CSS.escape(id)}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } };
}

/** Approval is the person's own words, recorded as `accept --by --said` does. */
function approveSheet(f, v) {
  const card = sheet(`<h2>Approve version ${v.number}</h2>
    <p class="muted">This records that you approve this cut, in your own words. The agent can then make the final.</p>
    <input class="field" id="ap-by" placeholder="Your name" value="${esc(myName())}" autocomplete="name">
    <textarea class="field" id="ap-said" rows="2" placeholder="In your words, for example: Looks great, ready to share."></textarea>
    <p class="muted small" id="ap-msg" role="status"></p>
    <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="ap-go">Approve</button></div>`);
  card.querySelector('#ap-said').focus();
  card.querySelector('#ap-go').onclick = async () => {
    const by = card.querySelector('#ap-by').value.trim(), said = card.querySelector('#ap-said').value.trim();
    if (!by || !said) { card.querySelector('#ap-msg').textContent = 'Your name and your words are both recorded with the approval.'; return; }
    store.set('cf-name', by);
    try { await call('/api/studio/accept', { film: f.id, revision: v.id, by, said }); }
    catch (e) { card.querySelector('#ap-msg').textContent = e.message; return; }
    v.approved = { by, said }; closeSheet(); toast(`Version ${v.number} approved.`); route();
  };
}
