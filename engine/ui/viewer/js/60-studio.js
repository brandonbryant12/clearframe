// Editing surface: one working storyboard, shared selection, command history, native previews.
let studioCleanup = null;
async function studio(id) {
  studioCleanup?.(); studioCleanup = null;
  const f = data.films.find(x => x.id === id); if (!f) return films();
  tabs('films'); document.body.classList.add('editing');
  app.innerHTML = '<div class="studio-loading">Opening your working copy…</div>';
  let state, selected, tab = 'scene', zoom = 1, mode = 'Design', disposed = false, timer, imageURL = null, previewHash = null, lastJob = null;
  const cleanup = () => { disposed = true; clearTimeout(timer); document.body.classList.remove('editing'); };
  studioCleanup = cleanup; stopLoop = cleanup;
  const get = async url => { const r = await fetch(url); const j = await r.json(); if (!r.ok) throw Error(j.error || 'Could not load'); return j; };
  try { await serverReady; if (!server) throw Error('Open the local studio server to edit this film.'); state = await get(`/api/studio/state?film=${encodeURIComponent(id)}`); }
  catch (e) { if (!disposed) app.innerHTML = `<div class="studio-loading"><h1>Open the editing studio</h1><p>${esc(e.message)}</p><a class="btn" href="#/film/${id}/${f.versions.at(-1)?.id ?? 'review'}">View film and notes</a></div>`; return; }
  if (disposed) return;
  selected = state.storyboard.beats[0]?.id;
  const notice = (s, error = false) => { const el = document.getElementById('studio-status'); if (el) { el.textContent = s; el.classList.toggle('error', error); } };
  async function command(body) {
    try { state = await api('/api/studio/command', { film: id, hash: state.hash, ...body }); draw(); notice('Saved to working copy'); }
    catch (e) { notice(e.message, true); }
  }
  async function render(kind) {
    notice(kind === 'still' ? 'Preparing scene preview…' : 'Preparing a rough cut…');
    try { const j = await api('/api/studio/jobs', { film: id, hash: state.hash, beat: selected, kind }); lastJob = j.id; poll(); }
    catch (e) { notice(e.message, true); }
  }
  async function poll() {
    clearTimeout(timer); if (disposed) return;
    try {
      const { jobs } = await get('/api/studio/jobs'); const j = jobs.find(x => x.id === lastJob) ?? jobs.filter(x => x.film === id).at(-1);
      if (j) {
        const el = document.getElementById('studio-job');
        if (el) el.innerHTML = `<b>${j.kind === 'still' ? 'Scene preview' : 'Rough cut'} · ${esc(j.status)}</b><details><summary>Render details</summary><pre>${esc(j.log)}</pre></details>${j.status === 'complete' && j.kind === 'draft' ? '<button class="btn" id="refresh-cut">Open new cut</button>' : ''}`;
        document.getElementById('refresh-cut')?.addEventListener('click', () => location.reload());
        if (j.status === 'complete' && j.url && imageURL !== j.url) { imageURL = j.url; previewHash = j.hash; drawPreview(); notice('Scene preview ready'); }
        if (j.status === 'failed') notice('Preview failed. Open Render details to see what needs attention.', true);
        if (j.status === 'running') timer = setTimeout(poll, 1200);
      }
    } catch (e) { notice(e.message, true); }
  }
  const beats = () => {
    let t = 0;
    return state.storyboard.beats.map((b, i) => {
      const old = f.versions.at(-1)?.scenes.find(s => s.id === b.id), seconds = b.duration ?? (old ? old.end - old.start : 4);
      const item = { ...b, i, start: t, end: t + seconds, seconds, thumb: old?.thumb ?? f.boards.find(s => s.id === b.id)?.image }; t += seconds; return item;
    });
  };
  const label = b => b.label || b.props?.title || b.props?.text || b.id;
  function select(id) { selected = id; drawScenes(); drawInspector(); drawTimeline(); const v = document.getElementById('studio-video'); const b = f.versions.at(-1)?.scenes.find(b => b.id === id); if (v && b) v.currentTime = b.start; }
  function draw() {
    const sb = state.storyboard, latest = f.versions.at(-1);
    app.innerHTML = `<div class="studio-shell" style="--browser-width:${store.get('cf-browser-width', 244)}px;--inspector-width:${store.get('cf-inspector-width', 300)}px">
      <header class="studio-bar"><a href="#/films" class="studio-back" aria-label="Back to studio">‹</a><div class="studio-name"><strong>${esc(sb.title || f.title)}</strong><span>Working copy</span></div>
        <nav class="studio-modes" aria-label="Workspace">${['Story','Design','Review'].map(x => `<button data-mode="${x}" aria-pressed="${mode === x}">${x}</button>`).join('')}</nav>
        <div class="studio-actions"><button class="btn small" data-command="undo" ${state.canUndo ? '' : 'disabled'} title="Undo">↶ Undo</button><button class="btn small" data-command="redo" ${state.canRedo ? '' : 'disabled'} title="Redo">↷</button><button class="btn primary small" id="render-draft">Render rough cut</button></div></header>
      <div class="studio-workarea">
        <aside class="studio-browser"><div class="studio-panel-tabs"><button data-browser="scene" aria-pressed="${tab === 'scene'}">Scenes</button><button data-browser="assets" aria-pressed="${tab === 'assets'}">Assets</button><button data-browser="brief" aria-pressed="${tab === 'brief'}">Brief</button></div><div id="studio-scenes"></div><div class="studio-browser-foot">${plural(sb.beats.length, 'scene')}<a href="#/library">Explore library</a></div></aside>
        <div class="studio-resizer" data-resize="browser" role="separator" aria-label="Resize scene browser"></div>
        <section class="studio-view"><div class="studio-view-bar"><span id="studio-preview-label">${imageURL ? 'Scene preview' : latest ? 'Latest rendered cut' : 'Your picture starts here'}</span><button class="btn small" id="render-still">Preview selected scene</button></div><div class="studio-monitor" id="studio-monitor"></div><div class="studio-monitor-foot"><span>${esc(sb.format?.preset || 'landscape')} · ${sb.format?.fps || 30} fps</span><span id="studio-preview-status"></span></div><div id="studio-job" class="studio-job" aria-live="polite"></div></section>
        <div class="studio-resizer" data-resize="inspector" role="separator" aria-label="Resize inspector"></div>
        <aside class="studio-inspector"><div class="studio-panel-heading">${mode === 'Review' ? 'Review this film' : mode === 'Story' ? 'Story and narration' : 'Scene properties'}</div><div id="studio-inspector"></div></aside>
      </div>
      <section class="studio-timeline"><div class="studio-timeline-tools"><b>Sequence</b><span>Working timing · narration may determine final length</span><label>Zoom <input id="studio-zoom" type="range" min="1" max="8" step=".25" value="${zoom}" aria-label="Timeline zoom"></label></div><div class="studio-timeline-scroll" id="studio-timeline-scroll"><div id="studio-tracks"></div></div></section>
      <footer class="studio-status"><span id="studio-status" role="status">${state.externalChanges ? 'Working copy changed outside the studio. History will restart with your next edit.' : 'All changes saved'}</span><span>Native preview · local project</span></footer>
    </div>`;
    drawScenes(); drawPreview(); drawInspector(); drawTimeline();
    app.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; draw(); });
    app.querySelectorAll('[data-browser]').forEach(b => b.onclick = () => { tab = b.dataset.browser; draw(); });
    app.querySelectorAll('[data-command]').forEach(b => b.onclick = () => command({ command: b.dataset.command }));
    document.getElementById('render-still').onclick = () => render('still'); document.getElementById('render-draft').onclick = () => render('draft');
    document.getElementById('studio-zoom').oninput = e => { zoom = Number(e.target.value); drawTimeline(); };
    app.querySelectorAll('[data-resize]').forEach(handle => handle.onpointerdown = e => {
      e.preventDefault(); handle.setPointerCapture(e.pointerId); const k = handle.dataset.resize;
      const start = e.clientX, initial = store.get(`cf-${k}-width`, k === 'browser' ? 244 : 300);
      handle.onpointermove = ev => { const width = Math.max(190, Math.min(460, initial + (ev.clientX - start) * (k === 'browser' ? 1 : -1))); app.querySelector('.studio-shell').style.setProperty(`--${k}-width`, `${width}px`); store.set(`cf-${k}-width`, width); };
      handle.onpointerup = () => { handle.onpointermove = null; handle.releasePointerCapture(e.pointerId); };
    });
    if (lastJob) poll();
  }
  function drawScenes() {
    const root = document.getElementById('studio-scenes');
    if (tab === 'brief') { root.innerHTML = `<div class="studio-brief">${markdown(f.brief || 'Add a brief.md to this project to keep the direction beside the film.')}</div>`; return; }
    if (tab === 'assets') { root.innerHTML = `<div class="studio-assets">${f.files.map(x => fileCard(x, true)).join('') || '<p class="studio-empty">No assets yet. Project assets appear here.</p>'}</div>`; bindFiles(root); return; }
    root.innerHTML = beats().map(b => `<button class="studio-scene" data-select="${esc(b.id)}" aria-pressed="${b.id === selected}"><div class="studio-scene-thumb">${b.thumb ? `<img src="${esc(b.thumb)}" alt="" loading="lazy">` : `<span>${String(b.i + 1).padStart(2, '0')}</span>`}</div><div><strong>${esc(label(b))}</strong><span>${esc(b.block)} · ${b.seconds.toFixed(1)}s</span></div></button>`).join('');
    root.querySelectorAll('[data-select]').forEach(b => b.onclick = () => select(b.dataset.select));
  }
  function drawPreview() {
    const root = document.getElementById('studio-monitor'), latest = f.versions.at(-1);
    if (imageURL) root.innerHTML = `<img src="${esc(imageURL)}" alt="Native preview of selected scene">`;
    else if (latest) root.innerHTML = `<video id="studio-video" controls playsinline preload="metadata" src="${esc(latest.video)}" poster="${esc(latest.poster || '')}"></video>`;
    else root.innerHTML = `<div class="studio-preview-empty"><div class="studio-frame-icon">▣</div><h2>See your scene take shape</h2><p>Select a scene, adjust its properties,<br>then render a native preview.</p><button class="btn" id="empty-preview">Preview this scene</button></div>`;
    document.getElementById('empty-preview')?.addEventListener('click', () => render('still'));
    document.getElementById('studio-preview-status').textContent = imageURL ? previewHash === state.hash ? 'Matches saved working copy' : 'Preview needs refreshing' : latest ? 'Rendered revision; edits appear after a new preview' : 'No preview yet';
    document.getElementById('studio-preview-label').textContent = imageURL ? 'Scene preview' : latest ? 'Latest rendered cut' : 'Preview';
  }
  function drawInspector() {
    const root = document.getElementById('studio-inspector'), b = state.storyboard.beats.find(b => b.id === selected), latest = f.versions.at(-1);
    if (!b) { root.innerHTML = '<p>Select a scene.</p>'; return; }
    if (mode === 'Review') {
      root.innerHTML = `<div class="studio-field"><h3>Versions and feedback</h3><p>Review a rendered cut to pin notes to the exact version you watched.</p>${latest ? `<a class="btn primary" href="#/film/${id}/${latest.id}">Review latest cut</a>` : '<p>Render a rough cut to start a review.</p>'}</div>${[...f.versions].reverse().map(v => `<a class="studio-revision" href="#/film/${id}/${v.id}"><b>${esc(versionName(v))}</b><span>${esc(v.quality)} · ${when(v.createdAt)}</span></a>`).join('')}<div class="studio-field"><h3>Edit history</h3>${state.history.slice(-12).reverse().map(h => `<p class="studio-history ${h.applied ? '' : 'undone'}">${esc(h.label)}</p>`).join('') || '<p>No edits yet.</p>'}</div>`; return;
    }
    const field = (name, title, value, type = 'text') => `<label class="studio-field"><span>${title}</span>${type === 'textarea' ? `<textarea data-field="${name}" rows="4">${esc(value || '')}</textarea>` : `<input data-field="${name}" type="${type}" ${type === 'number' ? 'min="0.1" max="3600" step="0.1"' : ''} value="${esc(value ?? '')}">`}</label>`;
    root.innerHTML = `<div class="studio-selection"><span>${esc(b.block)}</span><h2>${esc(b.label || b.id)}</h2><div class="studio-move"><button class="btn small" data-move="-1" ${b === state.storyboard.beats[0] ? 'disabled' : ''}>Move earlier</button><button class="btn small" data-move="1" ${b === state.storyboard.beats.at(-1) ? 'disabled' : ''}>Move later</button></div></div>${field('label', 'Scene name', b.label || b.id)}${mode === 'Story' ? field('vo', 'Narration', b.vo, 'textarea') : Object.entries(b.props || {}).filter(([k,v]) => ['text','title','kicker','support','source'].includes(k) && typeof v === 'string').map(([k,v]) => field(`props.${k}`, { text: 'On-screen text', title: 'Title', kicker: 'Eyebrow', support: 'Supporting text', source: 'Source' }[k], v, 'textarea')).join('')}${field('duration', 'Scene duration (seconds)', b.duration ?? '', 'number')}<div class="studio-field studio-help">Changes save when you leave a field. Preview the scene to see the native result.${b.duration == null ? ' Narration currently determines duration.' : ''}</div>`;
    root.querySelectorAll('[data-field]').forEach(el => el.onchange = () => command({ command: 'beat.set', beat: selected, field: el.dataset.field, value: el.type === 'number' ? Number(el.value) : el.value }));
    root.querySelectorAll('[data-move]').forEach(el => el.onclick = () => command({ command: 'beat.move', beat: selected, direction: Number(el.dataset.move) }));
  }
  function drawTimeline() {
    const all = beats(), total = all.at(-1)?.end || 1, root = document.getElementById('studio-tracks');
    root.style.width = `${zoom * 100}%`;
    const pct = t => (t / total * 100).toFixed(4);
    root.innerHTML = `<div class="studio-ruler">${Array.from({length: 11}, (_, i) => `<span style="left:${i * 10}%">${clock(i * total / 10)}</span>`).join('')}</div><div class="studio-track" aria-label="Scene timeline">${all.map(b => `<button data-select="${esc(b.id)}" aria-pressed="${b.id === selected}" style="left:${pct(b.start)}%;width:${pct(b.seconds)}%"><strong>${esc(label(b))}</strong><span>${esc(b.block)}</span></button>`).join('')}</div><div class="studio-voice-track" aria-label="Narration">${all.filter(b => b.vo).map(b => `<button data-select="${esc(b.id)}" style="left:${pct(b.start)}%;width:${pct(b.seconds)}%">${esc(b.vo)}</button>`).join('')}</div>`;
    root.querySelectorAll('[data-select]').forEach(b => b.onclick = () => select(b.dataset.select));
  }
  draw(); poll();
}
