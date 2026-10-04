// One film: player with lens and pins, scrub timeline with lanes, and the live panels.
function film(id, selected, panel = 'moment') {
  tabs('films');
  const f = data.films.find(x => x.id === id);
  if (!f) return films();
  if (!f.versions.length) return preview(f, panel);
  const v = f.versions.find(x => x.id === selected) ?? f.versions.at(-1);
  const lensOn = store.get('cf-lens', true), open = n => notesFor(f, n).filter(x => !x.resolved).length, diff = changes(f, v);
  app.innerHTML = `<a class="back" href="#/films">← Studio</a>
    <div class="filmhead"><div><h1>${esc(f.title)}</h1><p class="lede">${plural(f.versions.length, 'version')} · ${plural(v.scenes.length, 'scene')} · ${plural(f.files.length, 'file')} · <span>${esc(f.folder)}</span></p>${f.about ? `<p class="lede">${esc(f.about)}</p>` : ''}</div>
    <div class="toolbar">
      <button class="btn ${lensOn ? 'on' : ''}" id="lens" aria-pressed="${lensOn}" title="Outline the text on screen with its font, size and colour (L)">◎ Lens</button>
      <button class="btn primary" id="addnote" title="Pause and click on the picture to pin a note (N)">+ Note</button>
      ${f.versions.length > 1 ? `<a class="btn" href="#/compare/${f.id}">Compare</a>` : ''}
      <a class="btn" href="${esc(v.video)}" download>Download</a></div></div>
    ${stepper(f)}
    <div class="film">
      <div class="left">
        <div class="stage ${f.shape}" id="stage">
          <video id="video" preload="auto" playsinline poster="${esc(v.poster ?? '')}" src="${esc(v.video)}"></video>
          <div class="overlay" id="overlay"><div class="content" id="content"></div></div>
        </div>
        <div class="transport"><button class="btn icon" id="play" aria-label="Play (space)">▶</button>
          <button class="btn icon" id="back1" aria-label="Back one frame (,)" title="Back one frame (,)">‹</button><button class="btn icon" id="fwd1" aria-label="Forward one frame (.)" title="Forward one frame (.)">›</button>
          <span class="time" id="time">0:00 / ${length(v.seconds)}</span><span class="meta frameno" id="frameno"></span>
          <button class="btn small" id="speed" title="Playback speed">1×</button><button class="btn small" id="loop" aria-pressed="false" title="Loop this scene (O)">⟲ Scene</button>
          <span class="now"><span class="name">${versionName(v)}</span> ${qualityChip(v)} ${approvedChip(v)}</span></div>
        <div class="timeline" id="timeline" aria-label="Timeline: drag to scrub"></div>
        <div class="panels">
          <div class="subnav" role="tablist">${[['moment', 'In this moment'], ['scenes', 'Scenes'], ['files', 'Files'], ['fonts', 'Fonts'], ['notes', `Notes (${open(v)} open)`], ...(diff ? [['changes', `What changed (${diff.count})`]] : []), ...(f.brief ? [['brief', 'Brief']] : [])]
            .map(([k, t]) => `<button data-panel="${k}" aria-pressed="${k === panel}">${t}</button>`).join('')}</div>
          <div id="panel"></div>
        </div>
      </div>
      <aside class="versions" aria-label="Versions">${[...f.versions].reverse().map(x => `
        <a class="version" href="#/film/${f.id}/${x.id}" aria-current="${x.id === v.id}">
          <img src="${esc(x.poster ?? '')}" alt="">
          <div><div class="v">Version ${x.number}${x === f.versions.at(-1) ? ' <span class="meta">(latest)</span>' : ''}</div>
          ${x.label ? `<div class="label">${esc(x.label)}</div>` : ''}
          <div class="meta">${when(x.createdAt)} · ${length(x.seconds)}</div>
          <div>${qualityChip(x)} ${approvedChip(x)} ${open(x) ? `<span class="chip">${plural(open(x), 'open note')}</span>` : ''} ${changes(f, x)?.count ? `<span class="chip changed">${plural(changes(f, x).count, 'change')}</span>` : ''}</div></div>
        </a>`).join('')}</aside>
    </div>`;
  workspace(f, v, panel);
}

function workspace(f, v, initialPanel) {
  const video = document.getElementById('video'), stage = document.getElementById('stage'), content = document.getElementById('content');
  const timeline = document.getElementById('timeline'), panelEl = document.getElementById('panel');
  let panel = initialPanel, lens = store.get('cf-lens', true), noting = false, last = -1, hoverEl = null, filter = 'open';
  const T = v.seconds || video.duration || 1;
  const sceneAt = t => v.scenes.find(s => t >= s.start && t < s.end) ?? v.scenes.at(-1);
  const visible = t => { const s = sceneAt(t); return s ? s.elements.filter(e => e.box && e.at <= t + 0.05) : []; };
  const seek = t => { video.currentTime = Math.max(0, Math.min(T, t)) + 0.01; };

  // Fit the overlay to the picture inside the letterbox.
  function fit() {
    const r = video.getBoundingClientRect(), aspect = v.frame.width / v.frame.height;
    let w = r.width, h = r.width / aspect;
    if (h > r.height) { h = r.height; w = h * aspect; }
    Object.assign(content.style, { left: `${(r.width - w) / 2}px`, top: `${(r.height - h) / 2}px`, width: `${w}px`, height: `${h}px` });
  }
  new ResizeObserver(fit).observe(video);
  video.addEventListener('loadedmetadata', fit);

  // ---- timeline
  const pct = t => `${Math.max(0, Math.min(100, t / T * 100))}%`;
  const notesLane = () => notesFor(f, v).map(n => `<button class="pinmark ${n.resolved ? 'done' : ''}" style="left:${pct(n.at ?? 0)}" data-seek="${n.at ?? 0}" title="${esc(n.text)}">●</button>`).join('');
  const changed = new Map((changes(f, v)?.scenes ?? []).map(c => [c.scene, c.change]));
  const lanes = [['Scenes', v.scenes.map(s => `<button class="seg scene ${s.placeholder ? 'todo' : ''} ${changed.has(s) ? 'changed' : ''}" style="left:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${esc(s.placeholder ? `${s.number}. To design: ${s.placeholder}` : `${s.number}. ${s.kind}`)}"><span>${s.number}. ${esc(s.kind)}</span></button>`).join('')]];
  if (v.lanes.narration.length) lanes.push(['Narration', v.lanes.narration.map(n => `<span class="seg voice" style="left:${pct(n.start)};width:${pct(n.end - n.start)}" title="${esc(n.text)}"></span>`).join('')]);
  if (v.lanes.music.length) lanes.push(['Music', v.lanes.music.map(m => `<span class="seg music" style="left:${pct(m.start)};width:${pct(m.end - m.start)}" title="${esc(m.name)}"><span>${esc(m.name)}</span></span>`).join('')]);
  if (v.lanes.sfx.length) lanes.push(['Sound', v.lanes.sfx.map(s => `<span class="tick" style="left:${pct(s.t)}" title="${esc(s.name)} at ${clock(s.t)}"></span>`).join('')]);
  const media = v.scenes.filter(s => s.media?.length);
  if (media.length) lanes.push(['Media', media.map(s => `<span class="seg media" style="left:${pct(s.start)};width:${pct(s.end - s.start)}" title="${esc(s.media.join(', '))}"><span>${esc(s.media.map(m => m.split('/').pop()).join(', '))}</span></span>`).join('')]);
  lanes.push(['Notes', notesLane()]);
  timeline.innerHTML = `<div class="lanes">${lanes.map(([name, html]) => `<div class="lane"><div class="lname">${name}</div><div class="track" data-lane="${name}">${html}</div></div>`).join('')}
    <div class="playhead" id="playhead"></div><div class="hovertime" id="hovertime" hidden></div></div>`;
  const tracks = timeline.querySelector('.lanes'), playhead = document.getElementById('playhead'), hovertime = document.getElementById('hovertime');
  const timeFromX = x => { const r = timeline.querySelector('.track').getBoundingClientRect(); return Math.max(0, Math.min(T, (x - r.left) / r.width * T)); };
  let dragging = false;
  tracks.addEventListener('pointerdown', e => { if (e.target.closest('.pinmark')) return; dragging = true; tracks.setPointerCapture(e.pointerId); video.currentTime = timeFromX(e.clientX); });
  tracks.addEventListener('pointermove', e => {
    const t = timeFromX(e.clientX), r = timeline.querySelector('.track').getBoundingClientRect();
    hovertime.hidden = e.clientX < r.left; hovertime.style.left = `${e.clientX - tracks.getBoundingClientRect().left}px`;
    const s = sceneAt(t); hovertime.innerHTML = `${s?.thumb ? `<img src="${esc(s.thumb)}" alt="">` : ''}<span>${clock(t)}${s ? ` · ${esc(s.kind)}` : ''}</span>`;
    if (dragging) video.currentTime = t;
  });
  tracks.addEventListener('pointerleave', () => { hovertime.hidden = true; });
  tracks.addEventListener('pointerup', () => { dragging = false; });
  timeline.addEventListener('click', e => { const b = e.target.closest('.pinmark'); if (b) { const n = notesFor(f, v).find(x => Math.abs((x.at ?? 0) - Number(b.dataset.seek)) < 1e-6); seek(Number(b.dataset.seek)); if (n) showThread(n); } });

  // ---- lens and pins
  function drawOverlay(t) {
    const els = lens ? visible(t) : [], W = v.frame.width, H = v.frame.height;
    const pins = notesFor(f, v).filter(n => n.pin && Math.abs((n.at ?? 0) - t) <= 2);
    content.innerHTML = els.map(e => `<div class="lensbox ${hoverEl === e.id ? 'hot' : ''}" data-el="${esc(e.id)}" style="left:${e.box[0] / W * 100}%;top:${e.box[1] / H * 100}%;width:${e.box[2] / W * 100}%;height:${e.box[3] / H * 100}%">
        <span class="tag"><i style="background:${esc(e.color.hex ?? 'transparent')}"></i>${esc(e.font ? fontName(e.font) : 'Text')}${e.size ? ` · ${e.size}px` : ''}</span></div>`).join('')
      + pins.map(n => `<button class="pin ${n.resolved ? 'done' : ''}" data-note="${esc(n.id)}" style="left:${n.pin.x * 100}%;top:${n.pin.y * 100}%" title="${esc(n.text)}">${n.resolved ? '✓' : esc((n.by ?? '?').slice(0, 1).toUpperCase())}</button>`).join('');
    content.classList.toggle('noting', noting);
  }
  content.addEventListener('mouseover', e => { hoverEl = e.target.closest('.lensbox')?.dataset.el ?? null; if (panel === 'moment') drawPanel(true); });
  content.addEventListener('click', e => {
    const pin = e.target.closest('.pin');
    if (pin) { const n = notesFor(f, v).find(x => x.id === pin.dataset.note); if (n) showThread(n); return; }
    if (!noting) { video.paused ? video.play() : video.pause(); return; }
    const r = content.getBoundingClientRect(), el = e.target.closest('.lensbox'), s = stage.getBoundingClientRect();
    compose({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, el?.dataset.el ?? null, e.clientX - s.left, e.clientY - s.top);
  });

  function compose(pin, element, px, py) {
    setNoting(false);
    const at = video.currentTime, card = document.createElement('div');
    card.className = 'composer';
    card.style.left = `${Math.min(px, stage.clientWidth - 320)}px`; card.style.top = `${Math.min(py + 12, stage.clientHeight - 190)}px`;
    card.innerHTML = `<div class="meta">Note at ${clock(at)}${element ? ` · on “${esc(v.scenes.flatMap(s => s.elements).find(x => x.id === element)?.text ?? '')}”` : ''}</div>
      <textarea rows="3" placeholder="What should change here? Add #tags to group notes."></textarea>
      <div class="row"><input placeholder="Your name" value="${esc(store.get('cf-name', ''))}"><button class="btn" data-x>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    stage.appendChild(card);
    card.querySelector('textarea').focus();
    card.querySelector('[data-x]').onclick = () => card.remove();
    card.querySelector('[data-save]').onclick = async () => {
      const text = card.querySelector('textarea').value.trim(), by = card.querySelector('input').value.trim();
      if (!text) return;
      store.set('cf-name', by);
      try { await addNoteTo(f, v, { version: v.id, at, text, by: by || null, element, pin }); }
      catch (x) { card.querySelector('.meta').textContent = x.message; return; }
      card.remove(); refreshNotes();
    };
  }
  function showThread(n) {
    video.pause(); seek(n.at ?? 0);
    lightbox(`<div class="notecard">${thread(n, {})}<div class="row" style="margin-top:10px"><span></span><button class="btn" data-close>Close</button></div></div>`);
    bindThreads(box.querySelector('.notecard'), f, v, () => { refreshNotes(); const m = notesFor(f, v).find(x => x.id === n.id); if (m) box.querySelector('.thread').outerHTML = thread(m); }, null);
  }
  function refreshNotes() {
    timeline.querySelector('[data-lane="Notes"]').innerHTML = notesLane();
    document.querySelector('[data-panel="notes"]').textContent = `Notes (${notesFor(f, v).filter(x => !x.resolved).length} open)`;
    drawOverlay(video.currentTime); drawPanel();
  }
  const setNoting = on => { noting = on; document.getElementById('addnote').classList.toggle('on', on); drawOverlay(video.currentTime); };

  // ---- panels
  function drawPanel(soft) {
    const t = video.currentTime, s = sceneAt(t);
    if (panel === 'moment') {
      const els = visible(t), line = v.lanes.narration.find(n => t >= n.start && t < n.end), music = v.lanes.music.find(m => t >= m.start && t < m.end);
      const sound = v.lanes.sfx.filter(x => Math.abs(x.t - t) < 0.6), fonts = [...new Set(els.map(e => e.font).filter(Boolean))];
      const colors = [...new Map(els.filter(e => e.color.hex).map(e => [e.color.hex, e.color])).values()];
      const files = (s?.media ?? []).map(m => f.files.find(x => x.name === m) ?? { name: m });
      panelEl.innerHTML = s ? `<div class="moment">
        <div class="mrow"><div class="mlabel">Scene</div><div><b>${s.number}. ${esc(s.kind)}</b> <span class="meta">${clock(s.start)}–${clock(s.end)}</span>${s.placeholder ? `<div class="todoline">To design: ${esc(s.placeholder)}</div>` : ''}${s.onScreen.length ? `<div>${s.onScreen.map(x => `<span class="quote">${esc(x)}</span>`).join(' ')}</div>` : ''}${s.description ? `<div class="meta">${esc(s.description)}</div>` : ''}</div></div>
        <div class="mrow"><div class="mlabel">Narration</div><div>${line ? `“${esc(line.text)}”` : s.narration ? `<span class="meta">${esc(s.narration)}</span>` : '<span class="meta">None</span>'}</div></div>
        <div class="mrow"><div class="mlabel">Music</div><div>${music ? esc(music.name) : '<span class="meta">None</span>'}${sound.length ? ` · <span class="meta">sound: ${sound.map(x => esc(x.name)).join(', ')}</span>` : ''}</div></div>
        <div class="mrow"><div class="mlabel">On screen</div><div class="els">${els.length ? els.map(e => `<div class="el ${hoverEl === e.id ? 'hot' : ''}"><span class="swatch" style="background:${esc(e.color.hex ?? 'transparent')}"></span><span class="txt" style="font-family:'${esc(e.font)}'">${esc(e.text)}</span><span class="meta">${esc(fontName(e.font))}${e.size ? ` · ${e.size}px` : ''} · ${esc(e.color.token ?? '')} ${esc(e.color.hex ?? '')}</span></div>`).join('') : '<span class="meta">No text outlined in this shot</span>'}</div></div>
        ${fonts.length ? `<div class="mrow"><div class="mlabel">Fonts</div><div>${fonts.map(id => `<span class="fontchip" style="font-family:'${esc(id)}'">${esc(fontName(id))}</span>`).join(' ')}</div></div>` : ''}
        ${colors.length ? `<div class="mrow"><div class="mlabel">Colours</div><div>${colors.map(c => `<span class="colorchip"><i style="background:${esc(c.hex)}"></i>${esc(c.token ?? '')} ${esc(c.hex)}</span>`).join(' ')}</div></div>` : ''}
        ${files.length ? `<div class="mrow"><div class="mlabel">Media</div><div class="minifiles">${files.map(x => fileCard(x, true)).join('')}</div></div>` : ''}
      </div>` : '<div class="meta">Play or scrub to see what is on screen.</div>';
      if (!soft) bindFiles(panelEl);
    } else if (!soft && panel === 'scenes') {
      panelEl.innerHTML = `<div class="scenes">${v.scenes.map(x => `<button class="scenecard ${x === s ? 'current' : ''}" data-seek="${x.start}">
        <img src="${esc(x.thumb ?? '')}" alt=""><div><div><b>${x.number}. ${esc(x.kind)}</b> <span class="meta">${clock(x.start)} · ${length(x.end - x.start)}</span></div>
        ${x.placeholder ? `<div class="todoline">To design: ${esc(x.placeholder)}</div>` : ''}${x.onScreen.map(q => `<div class="quote">${esc(q)}</div>`).join('')}${x.narration ? `<div class="meta">“${esc(x.narration)}”</div>` : ''}${x.description ? `<div class="meta">${esc(x.description)}</div>` : ''}
        ${x.source ? `<div class="meta">Source: ${esc(x.source)}</div>` : ''}</div></button>`).join('') || '<div class="meta">No storyboard for this version.</div>'}</div>`;
      panelEl.onclick = e => { const b = e.target.closest('[data-seek]'); if (b) seek(Number(b.dataset.seek)); };
    } else if (!soft && panel === 'files') {
      const groups = [...new Set(f.files.map(x => x.group))];
      panelEl.onclick = null;
      panelEl.innerHTML = groups.length ? groups.map(g => `<h3>${esc(g)}</h3><div class="files">${f.files.filter(x => x.group === g).map(x => fileCard(x)).join('')}</div>`).join('') : '<div class="meta">No files in this project folder.</div>';
      bindFiles(panelEl);
    } else if (!soft && panel === 'fonts') {
      panelEl.onclick = null;
      panelEl.innerHTML = v.fonts.length ? `<input class="sample" value="${esc(store.get('cf-sample', 'The quick brown fox jumps over the lazy dog'))}" aria-label="Sample text">
        <div class="specimens">${v.fonts.map(u => specimen(fontById[u.font], u.roles)).join('')}</div>` : '<div class="meta">No font information for this version.</div>';
      bindSample(panelEl);
    } else if (!soft && panel === 'notes') {
      panelEl.innerHTML = notesPanel(f, v, filter);
      bindThreads(panelEl, f, v, refreshNotes, seek);
      panelEl.querySelectorAll('[data-filter]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); filter = b.dataset.filter; drawPanel(); }));
      document.getElementById('export')?.addEventListener('click', e => { e.stopPropagation(); exportLocal(f, v); });
    } else if (!soft && panel === 'changes') {
      panelEl.innerHTML = changesPanel(f, v);
      panelEl.onclick = e => { const b = e.target.closest('[data-seek]'); if (b) seek(Number(b.dataset.seek)); };
    } else if (!soft && panel === 'brief') {
      panelEl.onclick = null;
      panelEl.innerHTML = `<div class="brief">${markdown(f.brief)}</div>`;
    }
  }
  for (const b of app.querySelectorAll('[data-panel]')) b.onclick = () => {
    panel = b.dataset.panel;
    for (const x of app.querySelectorAll('[data-panel]')) x.setAttribute('aria-pressed', String(x === b));
    drawPanel();
  };

  // ---- transport
  const play = document.getElementById('play'), time = document.getElementById('time');
  play.onclick = () => video.paused ? video.play() : video.pause();
  video.addEventListener('play', () => { play.textContent = '❚❚'; });
  video.addEventListener('pause', () => { play.textContent = '▶'; });
  const fps = v.look?.fps ?? 30, frameno = document.getElementById('frameno');
  const step = n => { video.pause(); video.currentTime = Math.max(0, Math.min(T, (Math.round(video.currentTime * fps) + n) / fps + 0.001)); };
  document.getElementById('back1').onclick = () => step(-1);
  document.getElementById('fwd1').onclick = () => step(1);
  const speeds = [1, 0.5, 0.25, 2], speedBtn = document.getElementById('speed');
  speedBtn.onclick = () => { video.playbackRate = speeds[(speeds.indexOf(video.playbackRate) + 1) % speeds.length]; speedBtn.textContent = `${video.playbackRate}×`; };
  let loopScene = null;
  const loopBtn = document.getElementById('loop');
  const toggleLoop = () => { loopScene = loopScene ? null : sceneAt(video.currentTime); loopBtn.setAttribute('aria-pressed', String(!!loopScene)); loopBtn.classList.toggle('on', !!loopScene); loopBtn.textContent = loopScene ? `⟲ Scene ${loopScene.number}` : '⟲ Scene'; };
  loopBtn.onclick = toggleLoop;
  const toggleLens = () => { lens = !lens; store.set('cf-lens', lens); const b = document.getElementById('lens'); b.classList.toggle('on', lens); b.setAttribute('aria-pressed', String(lens)); drawOverlay(video.currentTime); };
  document.getElementById('lens').onclick = toggleLens;
  document.getElementById('addnote').onclick = () => { video.pause(); setNoting(!noting); };
  workspaceKeys = { lens: toggleLens, note: () => { video.pause(); setNoting(!noting); }, step, loop: toggleLoop };
  let raf = 0;
  const tick = () => {
    const t = video.currentTime;
    if (loopScene && !video.paused && (t >= loopScene.end - 0.02 || t < loopScene.start)) video.currentTime = loopScene.start + 0.01;
    if (t !== last) {
      last = t;
      playhead.style.left = `calc(var(--lname) + (100% - var(--lname)) * ${t / T})`;
      time.textContent = `${clock(t)} / ${length(T)}`;
      frameno.textContent = `frame ${Math.round(t * fps)}`;
      drawOverlay(t);
      if (panel === 'moment') drawPanel(true);
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  stopLoop = () => { cancelAnimationFrame(raf); workspaceKeys = null; };
  drawPanel();
  fit();
}
let workspaceKeys = null;

/** A film before its first render: its storyboard frames, its brief and its files. */
function preview(f, initial) {
  const views = [...(f.boards.length ? [['boards', 'Boards']] : []), ...(f.brief ? [['brief', 'Brief']] : []), ...(f.files.length ? [['files', 'Files']] : [])];
  let view = views.some(([k]) => k === initial) ? initial : views[0]?.[0];
  const total = f.boards.reduce((s, b) => s + b.seconds, 0), todo = f.boards.filter(b => b.placeholder).length;
  let start = 0;
  const timed = f.boards.map(b => { const x = { ...b, start }; start += b.seconds; return x; });
  app.innerHTML = `<a class="back" href="#/films">← Studio</a>
    <div class="filmhead"><div><h1>${esc(f.title)}</h1><p class="lede">${f.boards.length ? `${plural(f.boards.length, 'scene')} · about ${length(total)}${todo ? ` · ${plural(todo, 'scene')} still to design` : ''} · ` : ''}<span>${esc(f.folder)}</span></p></div></div>
    ${stepper(f)}
    ${views.length > 1 ? `<div class="subnav" role="tablist">${views.map(([k, t]) => `<button data-view="${k}" aria-pressed="${k === view}">${t}</button>`).join('')}</div>` : ''}
    <div id="view"></div>`;
  const el = document.getElementById('view');
  const draw = () => {
    if (view === 'boards') {
      el.innerHTML = `<div class="boards ${f.shape}">${timed.map((b, i) => `<figure class="boardcard ${b.placeholder ? 'todo' : ''}">
        <button class="thumb ${f.shape}" data-board="${i}" aria-label="Open scene ${b.number}">${b.image ? `<img src="${esc(b.image)}" alt="" loading="lazy">` : `<span class="briefglyph">${esc(b.kind)}</span>`}<span class="badge chip">${b.number}</span></button>
        <figcaption><div><b>${esc(b.kind)}</b> <span class="meta">${clock(b.start)} · ${length(b.seconds)}</span></div>
          ${b.placeholder ? `<div class="todoline">To design: ${esc(b.placeholder)}</div>` : b.onScreen.map(q => `<div class="quote">${esc(q)}</div>`).join('')}
          ${b.narration ? `<div class="vo">“${esc(b.narration)}”</div>` : ''}
          ${b.source ? `<div class="meta">Source: ${esc(b.source)}</div>` : ''}</figcaption></figure>`).join('')}</div>`;
      el.onclick = e => {
        const b = timed[e.target.closest('[data-board]')?.dataset.board];
        if (b?.image) lightbox(`<img src="${esc(b.image)}" alt=""><div class="row" style="margin-top:10px"><span class="meta">${b.number}. ${esc(b.kind)}${b.narration ? ` · “${esc(b.narration)}”` : ''}</span><button class="btn" data-close>Close</button></div>`);
      };
    } else if (view === 'brief') {
      el.onclick = null;
      el.innerHTML = `<div class="brief">${markdown(f.brief)}</div>`;
    } else if (view === 'files') {
      el.onclick = null;
      const groups = [...new Set(f.files.map(x => x.group))];
      el.innerHTML = groups.map(g => `<h3>${esc(g)}</h3><div class="files">${f.files.filter(x => x.group === g).map(x => fileCard(x)).join('')}</div>`).join('');
      bindFiles(el);
    } else el.innerHTML = '<div class="empty">Nothing to show yet. Add a brief.md or a storyboard to this folder.</div>';
  };
  for (const b of app.querySelectorAll('[data-view]')) b.onclick = () => {
    view = b.dataset.view;
    for (const x of app.querySelectorAll('[data-view]')) x.setAttribute('aria-pressed', String(x === b));
    draw();
  };
  draw();
}

/** What changed from the previous version: scenes added, removed, reworded, redesigned or retimed, and notes answered. */
function changes(f, v) {
  const i = f.versions.indexOf(v), prev = f.versions[i - 1];
  if (!prev || !prev.scenes.length || !v.scenes.length) return null;
  const key = s => s.id ?? `#${s.number}`, before = new Map(prev.scenes.map(s => [key(s), s]));
  const len = s => s.end - s.start, same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const scenes = v.scenes.map(s => {
    const p = before.get(key(s));
    if (!p) return { scene: s, change: 'added', what: ['New scene'] };
    const what = [];
    if (p.placeholder && !s.placeholder) what.push('Designed (was a placeholder)');
    else if (p.kind !== s.kind) what.push(`Now a ${s.kind.toLowerCase()} (was a ${p.kind.toLowerCase()})`);
    if (!same(p.onScreen, s.onScreen)) what.push({ was: p.onScreen.join(' · '), now: s.onScreen.join(' · '), label: 'Words' });
    if (!same(p.narration, s.narration)) what.push({ was: p.narration ?? '', now: s.narration ?? '', label: 'Narration' });
    if (!same(p.media, s.media)) what.push('Different media');
    if (Math.abs(len(p) - len(s)) > 0.05) what.push(`${len(s) > len(p) ? 'Longer' : 'Shorter'}: ${len(p).toFixed(1)}s → ${len(s).toFixed(1)}s`);
    return what.length ? { scene: s, change: 'changed', what } : null;
  }).filter(Boolean);
  const removed = prev.scenes.filter(p => !v.scenes.some(s => key(s) === key(p)));
  const answered = notesFor(f, prev).filter(n => n.resolved).length, asked = notesFor(f, prev).length;
  return { prev, scenes, removed, answered, asked, count: scenes.length + removed.length };
}

function changesPanel(f, v) {
  const d = changes(f, v);
  const item = w => typeof w === 'string' ? `<div>${esc(w)}</div>` : `<div><span class="mlabel">${esc(w.label)}</span> <del>${esc(w.was) || '—'}</del> <ins>${esc(w.now) || '—'}</ins></div>`;
  return `<div class="changes"><p class="meta">Compared with ${versionName(d.prev)}: ${plural(d.count, 'scene change')}, length ${length(d.prev.seconds)} → ${length(v.seconds)}${d.asked ? `, ${d.answered} of ${plural(d.asked, 'note')} on that version resolved` : ''}.</p>
    ${d.scenes.map(c => `<button class="change" data-seek="${c.scene.start}"><span class="ttime">${clock(c.scene.start)}</span><div><div><b>${c.scene.number}. ${esc(c.scene.kind)}</b> <span class="chip ${c.change}">${c.change === 'added' ? 'Added' : 'Changed'}</span></div>${c.what.map(item).join('')}</div></button>`).join('')}
    ${d.removed.map(p => `<div class="change"><span class="ttime">—</span><div><div><b>${esc(p.kind)}</b> <span class="chip removed">Removed</span></div>${p.onScreen.length ? `<div><del>${esc(p.onScreen.join(' · '))}</del></div>` : ''}</div></div>`).join('')}
    ${d.count ? '' : '<div class="meta">Same scenes as before; the changes are in the picture or sound.</div>'}</div>`;
}
