// Left browser (scenes, script, library, assets, brief) and the Review and Deliver panels.

function leftHTML() {
  const tabs = `<div class="st-tabs" role="tablist" aria-label="Browser">${LEFT_TABS.map(([k, t]) => `<button role="tab" data-act="left" data-tab="${k}" aria-selected="${S.left === k}">${t}</button>`).join('')}</div>`;
  const body = { scenes: scenesPanel, script: scriptPanel, library: libraryPanel, assets: assetsPanel, brief: briefPanel }[S.left]?.() ?? '';
  return `${tabs}<div class="st-panel-body" id="st-left-body">${body}</div>`;
}

function scenesPanel() {
  const changed = changedBeats(), v = S.f.versions.at(-1);
  const rows = beatsOf().map((b, i) => {
    const wb = workingBeat(b.id), s = stillFor(b.id), rendered = !changed.has(b.id) && !S.st.changes?.film ? v?.scenes.find(x => x.id === b.id)?.thumb : null;
    const thumb = s.current?.url ?? rendered ?? s.latest?.url ?? v?.scenes.find(x => x.id === b.id)?.thumb ?? S.f.boards?.find(x => x.id === b.id)?.image;
    const errs = beatErrors(b.id).length, n = S.st.narration[b.id];
    return `<li data-key="s-${esc(b.id)}"><button class="st-scene ${b.id === S.sel.beat ? 'on' : ''} ${S.sel.range?.includes(b.id) ? 'inrange' : ''}" data-act="select" data-beat="${esc(b.id)}" data-scene-row="${esc(b.id)}" aria-current="${b.id === S.sel.beat}" draggable="true" data-dragbeat="${esc(b.id)}">
      <span class="st-thumb">${thumb ? `<img src="${esc(thumb)}" alt="" loading="lazy" draggable="false">` : `<span>${String(i + 1).padStart(2, '0')}</span>`}</span>
      <span class="st-scene-text"><strong>${esc(sceneName(b))}</strong><span>${esc(b.block)} · ${wb ? `${wb.dur.toFixed(1)}s` : '—'}${n?.kind === 'recording' ? ' · recorded' : ''}</span>
        ${b.vo ? `<em>${esc(b.vo.slice(0, 80))}</em>` : ''}</span>
      <span class="st-flags">${errs ? '<i class="st-dot bad" title="The engine refuses this scene"></i>' : ''}${changed.has(b.id) ? '<i class="st-dot edited" title="Edited since the latest render"></i>' : ''}${b.placeholder ? '<i class="st-dot todo" title="Placeholder"></i>' : ''}</span></button></li>`;
  }).join('');
  return `<ol class="st-scenes" aria-label="Scenes (drag to reorder)">${rows}</ol>
    <div class="st-panel-foot"><button class="st-btn small" data-act="left" data-tab="library">+ Add scene</button><span class="st-muted">${plural(beatsOf().length, 'scene')} · ${clock(S.st.timing?.duration ?? 0)}</span></div>`;
}

function scriptPanel() {
  return `<div class="st-script">${beatsOf().map((b, i) => {
    const n = S.st.narration[b.id], wb = workingBeat(b.id), on = b.id === S.sel.beat;
    const body = n?.kind === 'recording' ? `<div class="st-script-rec">${transcriptHTML(b, wb)}</div>`
      : n?.kind === 'imported' ? `<blockquote class="st-quote">${esc(b.vo)}</blockquote>`
      : field({ beat: b.id, path: 'vo', label: `Narration for scene ${i + 1}`, type: 'textarea', rows: Math.min(6, Math.max(2, Math.ceil((b.vo ?? '').length / 48))), value: b.vo, placeholder: 'Silent — write what the voice says' });
    return `<section class="st-script-beat ${on ? 'on' : ''}" data-key="sc-${esc(b.id)}"><button class="st-script-h" data-act="select" data-beat="${esc(b.id)}"><span class="st-num">${i + 1}</span><b>${esc(sceneName(b))}</b><span class="st-muted">${esc(b.block)} · ${wb ? `${wb.dur.toFixed(1)}s` : ''}${wb?.vo?.wordTiming === 'measured' ? ' · measured' : wb?.vo ? ' · estimated' : ''}</span></button>${body}</section>`;
  }).join('')}<p class="st-hint-text">⌘↩ saves a line. Generated narration is re-recorded as one take; a recording is edited by cutting its words.</p></div>`;
}

function libraryPanel() {
  const L = S.schema, tab = S.lib, b = beatById(S.sel.beat);
  const tabs = [['blocks', 'Blocks'], ['drawings', 'Drawings'], ['palettes', 'Palettes'], ['type', 'Type'], ['motion', 'Motion']];
  const head = `<div class="st-seg small wrap" role="group" aria-label="Library">${tabs.map(([k, t]) => `<button data-act="libtab" data-lib="${k}" aria-pressed="${tab === k}">${t}</button>`).join('')}</div>`;
  const after = b ? `after “${esc(sceneName(b))}”` : 'at the end';
  let body = '';
  if (tab === 'blocks') {
    const cats = [...new Set(L.blocks.map(x => x.category))];
    body = `<p class="st-hint-text">Insert a native block ${after}. It arrives with the catalog’s sample content (labelled as sample); replace the words and data, then preview.</p>`
      + cats.map(c => `<h3 class="st-h3">${esc(c)}</h3><div class="st-list">${L.blocks.filter(x => x.category === c).map(x => `<div class="st-li" draggable="true" data-dragblock="${esc(x.name)}"><div><b>${esc(x.name)}</b><p class="st-muted">${esc(x.summary)}</p></div><button class="st-btn small" data-act="insert" data-block="${esc(x.name)}" aria-label="Insert ${esc(x.name)} ${after}">Insert</button></div>`).join('')}</div>`).join('');
  } else if (tab === 'drawings') {
    body = `<p class="st-hint-text">Canvas starting compositions. A drawing becomes a new scene; scenery goes behind the selected scene.</p><div class="st-list">${L.sketches.map(x => `<div class="st-li"><div><b>${esc(x.id)}</b>${x.art ? ' <span class="st-chip">scenery</span>' : ''}<p class="st-muted">${esc(x.summary ?? '')}</p></div>${x.art ? `<button class="st-btn small" data-act="art" data-sketch="${esc(x.id)}" ${b ? '' : 'disabled'}>Use behind scene</button>` : `<button class="st-btn small" data-act="insert" data-sketch="${esc(x.id)}">Insert</button>`}</div>`).join('')}</div>`;
  } else if (tab === 'palettes') {
    const theme = typeof S.st.storyboard.theme === 'string' ? S.st.storyboard.theme : S.st.storyboard.theme?.base;
    body = `<p class="st-hint-text">Set the film’s palette (every scene follows), or colour-block the selected scene.</p><div class="st-list">${L.palettes.map(p => `<div class="st-li"><div class="st-pal"><span class="st-pal-sw">${['bg', 'surface', 'ink', 'accent', 'accent2', 'positive', 'negative'].map(k => `<i style="background:${esc(p.colors[k] ?? 'transparent')}" title="${k}"></i>`).join('')}</span><b>${esc(p.id)}</b>${p.id === theme ? ' <span class="st-chip ok">film</span>' : ''}<p class="st-muted">${esc(p.notes)}</p></div><button class="st-btn small" data-act="apply" data-kind="palette" data-value="${esc(p.id)}">Use for film</button></div>`).join('')}</div>`;
  } else if (tab === 'type') {
    body = `<div class="st-list">${L.types.map(t => `<div class="st-li"><div><b>${esc(t.title ?? t.id)}</b>${S.st.storyboard.type === t.id ? ' <span class="st-chip ok">film</span>' : ''}<p class="st-muted">${esc(t.when ?? '')}</p></div><div class="st-li-actions"><button class="st-btn small" data-act="apply" data-kind="type" data-value="${esc(t.id)}">Film</button><button class="st-btn small" data-act="apply" data-kind="type" data-scope="beat" data-value="${esc(t.id)}" ${b ? '' : 'disabled'}>Scene</button></div></div>`).join('')}</div>`;
  } else {
    body = `<h3 class="st-h3">Motion presets</h3><div class="st-list">${L.motions.map(m => `<div class="st-li"><b>${esc(m)}</b><div class="st-li-actions"><button class="st-btn small" data-act="apply" data-kind="motion" data-value="${esc(m)}">Film</button><button class="st-btn small" data-act="apply" data-kind="motion" data-scope="beat" data-value="${esc(m)}" ${b ? '' : 'disabled'}>Scene</button></div></div>`).join('')}</div>
      <h3 class="st-h3">Transitions</h3><div class="st-list">${L.transitions.map(m => `<div class="st-li"><b>${esc(m)}</b><div class="st-li-actions"><button class="st-btn small" data-act="apply" data-kind="transition" data-value="${esc(m)}">Film default</button><button class="st-btn small" data-act="apply" data-kind="transition" data-scope="beat" data-value="${esc(m)}" ${b ? '' : 'disabled'}>Into scene</button></div></div>`).join('')}</div>
      <h3 class="st-h3">Treatments</h3><p class="st-hint-text">Look, motion and voice style together; one undo.</p><div class="st-list">${L.treatments.map(t => `<div class="st-li"><div><b>${esc(t.title ?? t.id)}</b><p class="st-muted">${esc(t.when ?? '')}</p></div><button class="st-btn small" data-act="treatment" data-id="${esc(t.id)}">Apply</button></div>`).join('')}</div>`;
  }
  return head + body;
}

function assetsPanel() {
  const files = S.f.files.filter(x => !/^(review|build)\//.test(x.name));
  const b = beatById(S.sel.beat);
  const usable = x => ['image', 'video'].includes(x.type);
  const groups = [...new Set(files.map(x => x.group))];
  return files.length ? `<p class="st-hint-text">Drag a picture or clip onto the monitor to make it the selected scene’s plate, or use the buttons.</p>${groups.map(g => `<h3 class="st-h3">${esc(g)}</h3><div class="st-assets">${files.filter(x => x.group === g).map(x => `<div class="st-asset" ${usable(x) ? `draggable="true" data-dragfile="${esc(x.name)}"` : ''}>
      <span class="st-asset-thumb">${x.type === 'image' || x.type === 'svg' ? `<img src="${esc(x.path)}" alt="" loading="lazy">` : x.type === 'video' ? `<img src="${esc(x.poster ?? '')}" alt="" loading="lazy"><i>▶</i>` : x.type === 'audio' && x.wave ? `<img src="${esc(x.wave)}" alt="">` : `<i>${esc(x.type)}</i>`}</span>
      <span class="st-asset-name" title="${esc(x.name)}">${esc(x.name.split('/').pop())}</span>
      ${usable(x) ? `<span class="st-li-actions"><button class="st-btn small" data-act="useAsset" data-file="${esc(x.name)}" data-as="plate" ${b ? '' : 'disabled'}>Plate</button>${b && ['image', 'video', 'annotate'].includes(b.block) && (b.block === 'video') === (x.type === 'video') ? `<button class="st-btn small" data-act="useAsset" data-file="${esc(x.name)}" data-as="file">Use in scene</button>` : ''}</span>` : `<a class="st-link" href="${esc(x.path)}" target="_blank" rel="noopener">Open</a>`}</div>`).join('')}</div>`).join('')}`
    : '<div class="st-empty-panel"><p>No project assets yet.</p><p class="st-hint-text">Put images and clips in <code>assets/</code> (or <code>media/</code>) beside the storyboard; they appear here, ready to place. Generated stills come from <code>images DIR</code> after <code>plan DIR</code>.</p></div>';
}
ACTIONS.useAsset = el => useAsset(el.dataset.file, el.dataset.as);
function useAsset(file, as = 'plate') {
  const b = beatById(S.sel.beat); if (!b) return;
  if (as === 'file') return cmd({ command: 'set', target: 'beat', beat: b.id, path: 'props.file', value: file }).catch(() => {});
  cmd({ command: 'set', target: 'beat', beat: b.id, path: 'plate', value: { ...(b.plate ?? {}), file, asset: undefined }, label: `Plate ${file.split('/').pop()} behind ${sceneName(b)}` }).catch(() => {});
}

function briefPanel() {
  const sources = S.st.storyboard.sources ?? [];
  return `${S.f.brief ? `<div class="st-brief">${markdown(S.f.brief)}</div>` : '<p class="st-muted">No brief.md, BRIEF.md or DIRECTION.md beside this film.</p>'}
    <h3 class="st-h3">Sources</h3>${sources.length ? `<ol class="st-sources">${sources.map(s => `<li>${esc(typeof s === 'string' ? s : `${s.id ? `[${s.id}] ` : ''}${s.title ?? ''}${s.date ? ` · ${s.date}` : ''}`)}</li>`).join('')}</ol>` : '<p class="st-muted">No sources yet. Every displayed number needs one (Film → Sources).</p>'}`;
}

// ------------------------------------------------------------------ review: versions, notes, candidates, verdicts

/** open, applied (a candidate exists: awaiting a person's verdict) or resolved. */
const noteStatus = n => (/^Applied/.test(n.state ?? '') ? 'applied' : n.resolved ? 'resolved' : 'open');
const isOpen = n => noteStatus(n) !== 'resolved';
function reviewPanel() {
  const versions = [...S.f.versions].reverse();
  if (!versions.length) return `<div class="st-empty-panel"><p>Nothing to review yet.</p><p class="st-hint-text">Notes, candidates and verdicts belong to rendered versions. Make a rough cut, then watch it here.</p><button class="st-btn primary" data-act="draft">Make a rough cut</button></div>`;
  const v = versionOf(S.monitor.rev) ?? versions[0], notes = notesFor(S.f, v);
  const shown = notes.filter(n => S.filter === 'all' || (S.filter === 'resolved' ? !isOpen(n) : isOpen(n)));
  const candidates = S.jobs.filter(j => j.kind === 'revise' && j.status === 'complete' && j.result);
  const decisions = (S.review?.decisions ?? []).slice(-8).reverse();
  return section('rev-versions', 'Versions', `<div class="st-versions">${versions.map(x => `<button class="st-version ${x.id === v.id ? 'on' : ''}" data-act="rev" data-rev="${esc(x.id)}" aria-pressed="${x.id === v.id}">
        ${x.poster ? `<img src="${esc(x.poster)}" alt="" loading="lazy">` : '<span class="st-thumb"></span>'}<span><b>${esc(versionName(x))}</b> <span class="st-chip">${esc(x.quality)}</span>${x.approved ? ` <span class="st-chip ok">accepted by ${esc(x.approved.by ?? 'a person')}</span>` : ''}
        <span class="st-muted">${when(x.createdAt)} · ${length(x.seconds)}${notesFor(S.f, x).filter(n => !n.resolved).length ? ` · ${plural(notesFor(S.f, x).filter(n => !n.resolved).length, 'open note')}` : ''}</span></span></button>`).join('')}</div>
      ${S.f.versions.length > 1 ? `<a class="st-link" href="#/compare/${esc(S.id)}">Side-by-side page for two versions ↗</a>` : ''}`)
    + section('rev-notes', `Notes on ${versionName(v)}`, `<div class="st-addrow"><button class="st-btn small primary ${S.noting ? 'on' : ''}" data-act="note">+ Note on the picture</button><button class="st-btn small" data-act="wholeNote">Whole-cut note</button></div>
      <div class="st-seg small" role="group" aria-label="Filter notes">${[['open', `Open ${notes.filter(isOpen).length}`], ['resolved', `Resolved ${notes.filter(n => !isOpen(n)).length}`], ['all', `All ${notes.length}`]].map(([k, t]) => `<button data-act="filter" data-filter="${k}" aria-pressed="${S.filter === k}">${t}</button>`).join('')}</div>
      <div class="st-threads">${shown.map(n => threadHTML(v, n)).join('') || `<p class="st-muted">${notes.length ? 'Nothing with this filter.' : 'No notes on this version. Press N, then click the picture.'}</p>`}</div>`, { count: notes.filter(isOpen).length })
    + section('rev-candidates', 'Candidates', candidates.length ? candidates.map(j => { const verdict = (S.review?.decisions ?? []).filter(d => d.revision === j.result.revision && ['accept', 'reject'].includes(d.action)).at(-1); return `<div class="st-candidate"><div><b>${esc(j.result.revision ?? 'Candidate')}</b> for ${esc(j.note)} ${verdict ? `<span class="st-chip ${verdict.action === 'accept' ? 'ok' : 'bad'}">${verdict.action === 'accept' ? 'accepted' : 'rejected'} by ${esc(verdict.by)}</span><p class="st-muted">“${esc(verdict.said)}” · ${when(verdict.at)}</p>` : '<span class="st-chip warn">applied, not accepted</span>'}</div>
        ${j.result.passages.map((p, i) => `<button class="st-btn small" data-act="passage" data-before="${esc(p.before ?? '')}" data-after="${esc(p.after ?? '')}" ${p.before && p.after ? '' : 'disabled'}>Passage ${i + 1}: ${esc(p.beats.join(', '))}</button>`).join('')}
        ${j.result.page ? `<a class="st-link" href="${esc(j.result.page)}" target="_blank" rel="noopener">Compare page ↗</a>` : ''}
        ${verdict ? '' : `<div class="st-addrow"><button class="st-btn small primary" data-act="accept" data-rev="${esc(j.result.revision)}" data-note="${esc(j.note)}">Record acceptance…</button><button class="st-btn small" data-act="reject" data-rev="${esc(j.result.revision)}" data-note="${esc(j.note)}">Record rejection…</button></div>`}</div>`; }).join('')
      : '<p class="st-hint-text">Edit the scenes a note is about, then <b>Make candidate</b> on the note: the engine checks the edit stays inside the note’s scenes, saves a candidate revision and renders before/after passages. A person then accepts or rejects it in their own words.</p>')
    + section('rev-decisions', 'Decisions', decisions.length ? `<ul class="st-decisions">${decisions.map(d => `<li><b>${esc(d.action === 'decide' ? 'Agent decision' : d.action)}</b> ${esc(d.revision)}${d.scope?.note ? ` · ${esc(d.scope.note)}` : ''}${d.by ? ` by ${esc(d.by)}` : ''}${d.said ? ` — “${esc(d.said)}”` : d.reason ? ` — ${esc(d.reason)}` : ''} <span class="st-muted">${when(d.at)}</span></li>`).join('')}</ul>` : '<p class="st-muted">No decisions recorded. Applied is not accepted: only a person’s words, recorded here or with <code>accept --by --said</code>, accept a cut.</p>', { open: false })
    + (v ? `<div class="st-panel-foot"><button class="st-btn small" data-act="accept" data-rev="${esc(v.id)}">Record acceptance of ${esc(versionName(v))}…</button></div>` : '');
}
function threadHTML(v, n) {
  const scene = n.at != null ? v.scenes.find(s => n.at >= s.start && n.at < s.end) : null;
  const editable = scene && beatById(scene.id), changed = scene && changedBeats().has(scene.id), status = noteStatus(n), cand = /in (r\d{3,})/.exec(n.state ?? '')?.[1];
  return `<article class="st-thread ${status === 'resolved' ? 'done' : ''} ${S.sel.note === n.id ? 'on' : ''}" data-key="t-${esc(n.id)}">
    <header>${n.at == null ? '<span class="st-chip">whole cut</span>' : `<button class="st-time" data-act="thread" data-op="seek" data-note="${esc(n.id)}">${timecode(n.at, v.look?.fps ?? 30)}</button>`}<b>${esc(n.by ?? 'Note')}</b><span class="st-chip ${status === 'resolved' ? 'ok' : status === 'applied' ? 'warn' : ''}">${esc(status === 'applied' ? `${n.state} · awaiting a verdict` : n.state)}</span>${scene ? `<span class="st-muted">${esc(sceneName(beatById(scene.id)) || scene.kind)}</span>` : ''}</header>
    <p>${linkTags(n.text)}</p>
    ${n.replies.map(r => `<p class="st-reply"><b>${esc(r.by ?? 'Reply')}</b> ${linkTags(r.text)} <span class="st-muted">${when(r.at)}</span></p>`).join('')}
    <footer>${editable ? `<button class="st-link" data-act="thread" data-op="edit" data-note="${esc(n.id)}">Edit this scene</button>` : ''}
      ${status === 'open' && changed ? `<button class="st-link" data-act="revise" data-note="${esc(n.id)}" title="Save a candidate revision for this note and render before/after passages">Make candidate</button>` : ''}
      ${status === 'applied' && cand ? `<button class="st-link" data-act="accept" data-rev="${esc(cand)}" data-note="${esc(n.id)}">Record acceptance…</button><button class="st-link" data-act="reject" data-rev="${esc(cand)}" data-note="${esc(n.id)}">Record rejection…</button>` : ''}
      <button class="st-link" data-act="thread" data-op="reply" data-note="${esc(n.id)}">Reply</button>
      ${status === 'resolved' ? `<button class="st-link" data-act="thread" data-op="reopen" data-note="${esc(n.id)}">Reopen</button>` : status === 'open' ? `<button class="st-link" data-act="thread" data-op="resolve" data-note="${esc(n.id)}">Resolve…</button>` : ''}</footer></article>`;
}
function threadAction(el) {
  const v = versionOf(S.monitor.rev) ?? S.f.versions.at(-1), n = v && notesFor(S.f, v).find(x => x.id === el.dataset.note);
  if (!n) { // a note from another version: show it on its own version
    const owner = S.f.versions.find(x => notesFor(S.f, x).some(y => y.id === el.dataset.note)); if (owner) { S.monitor.rev = owner.id; invalidate(); } return;
  }
  const op = el.dataset.op;
  S.sel.note = n.id;
  if (op === 'open' || op === 'seek') {
    if (S.monitor.source === 'working' && op === 'seek') setSource('rendered');
    if (S.right !== 'review') S.right = 'review';
    if (n.at != null) { const s = v.scenes.find(x => n.at >= x.start && n.at < x.end); if (S.monitor.source !== 'working') seekTo(n.at); if (s && beatById(s.id)) select(s.id, { seek: false }); }
    invalidate(); requestAnimationFrame(() => document.querySelector(`[data-key="t-${CSS.escape(n.id)}"]`)?.scrollIntoView({ block: 'nearest' }));
    return;
  }
  if (op === 'edit') { const s = v.scenes.find(x => n.at >= x.start && n.at < x.end); setSource('working'); S.right = 'inspect'; if (s) select(s.id); return; }
  if (op === 'reply') return noteDialog({ title: 'Reply', placeholder: 'Your reply', go: (text, by) => api('/api/notes/reply', { film: S.id, id: n.id, text, by }) });
  if (op === 'reopen') return api('/api/notes/state', { film: S.id, id: n.id, resolved: false, by: S.name || null }).then(refreshNotes).catch(e => status(e.message, 'error'));
  if (op === 'resolve') return overlay(`<form class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="res-t"><h2 id="res-t">Resolve this note</h2><p class="st-quote">${esc(n.text)}</p>
      <p class="st-hint-text">A resolution records who decided. Use “Won’t change” to close it without a change.</p>
      <label class="st-field"><span>Your name</span><input name="by" required value="${esc(S.name)}" autocomplete="name" autofocus></label>
      <div class="st-dialog-actions"><button type="button" class="st-btn" data-act="close">Cancel</button><button class="st-btn" data-act="wont">Won’t change</button><button class="st-btn primary" data-act="ok">Resolved</button></div></form>`, {
    ok: a => resolve(a, false), wont: a => resolve(a, true) });
  function resolve(a, dismiss) { const by = a.form.by.value.trim(); if (!by) return a.form.by.focus(); S.name = by; store.set('cf-name', by); closeOverlay(); api('/api/notes/state', { film: S.id, id: n.id, resolved: true, dismiss, by }).then(refreshNotes).catch(e => status(e.message, 'error')); }
}
function noteDialog({ title, placeholder, context = '', go }) {
  overlay(`<form class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="nd-t"><h2 id="nd-t">${esc(title)}</h2>${context}
    <label class="st-field"><span>${esc(placeholder)}</span><textarea name="text" rows="3" required autofocus></textarea></label>
    <label class="st-field"><span>Your name</span><input name="by" value="${esc(S.name)}" autocomplete="name"></label>
    <div class="st-dialog-actions"><button type="button" class="st-btn" data-act="close">Cancel</button><button class="st-btn primary" data-act="ok">Save</button></div></form>`, {
    ok: a => { const text = a.form.text.value.trim(), by = a.form.by.value.trim(); if (!text) return a.form.text.focus(); if (by) { S.name = by; store.set('cf-name', by); } closeOverlay(); Promise.resolve(go(text, by || null)).then(refreshNotes).then(() => status('Note saved')).catch(e => status(e.message, 'error')); } });
}
function toggleNoting() {
  if (!S.f.versions.length) return status('Notes belong to a rendered version: make a rough cut first.', 'warn');
  if (S.monitor.source !== 'rendered') setSource('rendered');
  pauseVideo(); S.noting = !S.noting; S.right = 'review'; invalidate();
  status(S.noting ? 'Click the picture where the note belongs' : 'Note mode off');
}
function composeNote(pin) {
  const v = versionOf(S.monitor.rev) ?? S.f.versions.at(-1); if (!v) return toggleNoting();
  pauseVideo(); S.noting = false;
  const at = pin === null ? null : S.t, scene = at != null && v.scenes.find(s => at >= s.start && at < s.end);
  noteDialog({ title: pin === null ? 'Whole-cut note' : `Note at ${timecode(at, v.look?.fps ?? 30)}`, placeholder: 'What should change here? #tags group notes',
    context: `<p class="st-muted">On ${esc(versionName(v))} — the version you are watching, not the working copy${scene ? ` · ${esc(scene.kind)}` : ''}.</p>`,
    go: (text, by) => api('/api/notes', { film: S.id, version: v.id, at, scope: pin === null ? 'film' : 'beat', text, by, pin: pin ?? undefined }) });
  invalidate();
}
/** A person's verdict on a candidate or a cut: their name and their own words, typed here. */
function decide(action, d) {
  const rev = d.rev, note = d.note || null;
  overlay(`<form class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="dc-t"><h2 id="dc-t">${action === 'accept' ? 'Record an acceptance' : 'Record a rejection'}</h2>
    <p>${esc(rev)}${note ? ` for ${esc(note)}` : ''}. ${action === 'accept' ? 'This records a person’s acceptance in their own words. Write what they actually said; nothing is filled in for them.' : 'The candidate’s changes go back where nothing was edited since; a restore point is saved first. Editing pauses while it runs.'}</p>
    <label class="st-field"><span>Who decided</span><input name="by" required value="${esc(S.name)}" autocomplete="name" autofocus></label>
    <label class="st-field"><span>What they said</span><textarea name="said" rows="3" required placeholder="Their words, e.g. “yes, much clearer”"></textarea></label>
    <div class="st-dialog-actions"><button type="button" class="st-btn" data-act="close">Cancel</button><button class="st-btn primary" data-act="ok">${action === 'accept' ? 'Record acceptance' : 'Reject'}</button></div></form>`, {
    ok: async a => {
      const session = S;
      const by = a.form.by.value.trim(), said = a.form.said.value.trim();
      if (!by) return a.form.by.focus(); if (!said) return a.form.said.focus();
      S.name = by; store.set('cf-name', by); closeOverlay();
      try {
        if (action === 'accept') { await call('/api/studio/accept', { film: S.id, revision: rev, note, by, said }); requireSession(session); status(`Recorded: ${by} accepted ${rev}`); await Promise.all([refreshFilm(), refreshNotes(), loadReview()]); }
        else await startJob('reject', { revision: rev, note, by, said });
      } catch (e) { if (currentSession(session)) status(e.message, 'error'); }
    } });
}

// ------------------------------------------------------------------ deliver: readiness and exports

function deliverPanel() {
  const latest = S.f.versions.at(-1), ch = S.st.changes, check = S.jobs.filter(j => j.kind === 'check' && j.status === 'complete' && j.result).at(-1);
  const estimated = (S.st.timing?.beats ?? []).filter(b => b.vo && b.vo.wordTiming !== 'measured').length, placeholders = beatsOf().filter(b => b.placeholder).length;
  const matches = latest && ch && !ch.edited.length && !ch.added.length && !ch.removed.length && !ch.film && !ch.reordered;
  const row = (ok, title, detail, action = '') => `<li class="st-ready ${ok === true ? 'ok' : ok === false ? 'bad' : 'warn'}"><span class="st-ready-dot" aria-hidden="true"></span><div><b>${title}</b><p class="st-muted">${detail}</p>${action}</div></li>`;
  const cps = S.review?.checkpoints ?? [];
  return section('del-ready', 'Readiness', `<ul class="st-readylist">
      ${row(!S.st.errors.length, S.st.errors.length ? `${plural(S.st.errors.length, 'engine error')}` : 'The engine accepts the working copy', S.st.errors.length ? esc(S.st.errors.slice(0, 3).join(' · ')) : `${plural(S.st.warnings.length, 'warning')} — advice, not blockers`)}
      ${row(check ? !check.result.errors.length && check.hash === S.st.hash : null, check ? check.result.errors.length ? `Check found ${plural(check.result.errors.length, 'problem')}` : check.hash === S.st.hash ? 'Native check passed for this working copy' : 'Native check passed for an earlier working copy' : 'Native check not run', check ? esc([...check.result.errors, ...check.result.warnings].slice(0, 3).join(' · ') || 'Fonts, cues, sources and the frame audit.') : 'Fonts, cues, sources and the frame audit, in about a minute.', `<button class="st-btn small" data-act="check">Run check</button>`)}
      ${row(estimated ? null : true, estimated ? `${plural(estimated, 'scene')} with estimated narration timing` : 'Narration timing measured', estimated ? 'Fine for rough cuts; final captions and kinetic type need measured word timings (<code>align DIR --whisper</code>, free).' : 'Word timings are tied to the current audio.')}
      ${row(placeholders ? false : true, placeholders ? `${plural(placeholders, 'placeholder')} still to design` : 'No placeholders', placeholders ? 'They render as labelled slates in rough cuts; a final refuses them.' : '')}
      ${row(latest ? matches : null, latest ? `${versionName(latest)} · ${latest.quality}` : 'Not rendered yet', latest ? matches ? 'Matches the working copy.' : 'The working copy has changed since — render again to deliver what you see.' : 'Make a rough cut to watch the film.')}
      ${row(latest?.approved ? true : null, latest?.approved ? `Accepted by ${esc(latest.approved.by ?? 'a person')}` : 'No person has accepted the newest render', latest?.approved?.said ? `“${esc(latest.approved.said)}”` : 'An unaccepted render is not approved, whatever its quality.')}
    </ul>`)
    + section('del-checkpoints', 'Checkpoints', cps.length ? `<ul class="st-readylist">${cps.map(c => row(c.done ? true : null, esc(c.name), esc(c.detail ?? ''))).join('')}</ul>` : `<p class="st-muted">${S.review?.checkpointsError ? esc(S.review.checkpointsError) : 'Loading…'}</p>`, { open: false })
    + section('del-export', 'Export', `<div class="st-exports">
      <div class="st-export"><b>Rough cut</b><p class="st-muted">Full length, half size, free local draft narration; placeholders as slates. Saves a revision.</p><button class="st-btn" data-act="draft">Render rough cut</button></div>
      <div class="st-export"><b>Final</b><p class="st-muted">Full size from prepared narration (no paid generation). The engine refuses estimated timing where it matters and any placeholder.</p><button class="st-btn" data-act="final" ${placeholders ? 'disabled title="Design the placeholders first"' : ''}>Render final</button></div>
      <div class="st-export"><b>Captions</b><p class="st-muted">SRT and VTT in <code>build/</code>. ${estimated ? 'Draft captions use estimated timing.' : 'From measured word timing.'}</p><button class="st-btn" data-act="captions" data-draft="${estimated ? 'true' : 'false'}">Write ${estimated ? 'draft ' : ''}captions</button></div>
      ${latest ? `<div class="st-export"><b>Download</b><p class="st-muted">${esc(versionName(latest))} · ${esc(latest.quality)} · ${length(latest.seconds)}</p><a class="st-btn" href="${esc(latest.video)}" download>Download MP4</a></div>` : ''}
    </div>`);
}
