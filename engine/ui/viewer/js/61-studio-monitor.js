// Monitor: the working copy (native stills and section previews), a rendered version (with its
// notes pinned to the picture), or the two compared. A badge always says which, and whether it
// matches the working copy.

function frameSize() { const t = S.st.timing, v = shownVersion(); return v?.frame ?? { width: t?.width ?? 1920, height: t?.height ?? 1080 }; }

function monitorHTML() {
  const src = S.monitor.source, v = versionOf(S.monitor.rev), fs = frameSize(), ar = `${fs.width} / ${fs.height}`;
  const versions = S.f.versions;
  const seg = [['working', 'Working copy'], ['rendered', 'Rendered'], ['compare', 'Compare']].map(([k, t]) => `<button data-act="source" data-source="${k}" aria-pressed="${src === k}" ${k !== 'working' && !versions.length ? 'disabled title="Nothing rendered yet"' : ''}>${t}</button>`).join('');
  const picker = src !== 'working' && versions.length ? `<select class="st-select" aria-label="Rendered version" data-onchange="pickRev">${[...versions].reverse().map(x => `<option value="${esc(x.id)}" ${x.id === v?.id ? 'selected' : ''}>${esc(versionName(x))} · ${esc(x.quality)}${x.approved ? ' · accepted' : ''}</option>`).join('')}</select>` : '';
  let body = '', badge = '', tools = '';
  if (src === 'working') ({ body, badge, tools } = workingView());
  else if (src === 'rendered') ({ body, badge, tools } = renderedView(v));
  else ({ body, badge, tools } = compareView(v));
  return `<div class="st-mon-bar"><div class="st-seg" role="group" aria-label="Monitor source">${seg}</div>${picker}<div class="st-mon-tools">${tools}</div></div>
    <div class="st-stage-wrap" id="st-stage-wrap" style="--narrow-ar:${Math.min(1.9, Math.max(0.56, fs.height / fs.width * 1.78)).toFixed(3)}"><div class="st-stage ${S.noting ? 'noting' : ''}" id="st-stage" style="aspect-ratio:${ar};--ar:${(fs.width / fs.height).toFixed(4)}">${body}</div></div>
    <div class="st-badge-row">${badge}</div>${failureHTML()}
    ${transportHTML()}`;
}
ACTIONS.pickRev = el => { S.monitor.rev = el.value; invalidate(); };

function workingView() {
  const b = beatById(S.sel.beat);
  if (S.monitor.section) {
    const j = S.jobs.find(x => x.id === S.monitor.section);
    if (j?.url) {
      const fresh = j.hash === S.st.hash && j.matches !== false;
      return { body: `<video id="st-video" data-keep="sec-${esc(j.id)}" src="${esc(j.url)}" playsinline preload="auto"></video>`,
        badge: `<span class="st-chip ${fresh ? 'ok' : 'warn'}">${fresh ? 'Matches the working copy' : 'Made before your latest edits'}</span><span>Section preview · ${esc(j.beats.join(', '))} · ${j.range ? `${timecode(j.range[0], fpsOf())}–${timecode(j.range[1], fpsOf())} of the film` : ''}${j.verified ? ' · clock checked against frames drawn directly' : ''}${j.hasAudio ? ' · the film’s own mix' : ' · no sound yet'}</span>`,
        tools: `<button class="st-btn small" data-act="section" title="Render again (⇧⌘↩)">Re-render</button><button class="st-btn small" data-act="closeSection">Back to stills</button>` };
    }
    S.monitor.section = null;
  }
  const at = S.monitor.atJob && S.jobs.find(j => j.id === S.monitor.atJob && j.status === 'complete');
  const s = b ? stillFor(b.id) : {};
  const shot = at ?? s.current ?? s.latest;
  const fresh = shot && shot.hash === S.st.hash && shot.matches !== false;
  const W = S.st.timing?.width ?? 1920, H = S.st.timing?.height ?? 1080;
  const boxes = !at && b ? (S.st.boxes[b.id] ?? []) : [];
  const tools = `<button class="st-btn small" data-act="still" title="Render this scene's native still (⌘↩)">Still</button><button class="st-btn small" data-act="stillAt" title="Render the exact frame under the playhead">Frame at playhead</button>`;
  if (!b) return { body: '<div class="st-empty">Select a scene.</div>', badge: '', tools };
  if (!shot) return {
    body: `<div class="st-empty">${s.running ? '<div class="st-spinner" aria-hidden="true"></div><p>Drawing a native still of this scene…</p>' : `<p>No still of “${esc(sceneName(b))}” yet.</p><button class="st-btn primary" data-act="still">Render still</button>`}</div>`,
    badge: S.st.errors.length ? `<span class="st-chip bad">The engine refuses this working copy: ${esc(S.st.errors[0])}</span>` : `<span class="st-muted">Stills are drawn by the native renderer from the saved working copy.</span>`, tools };
  const sel = S.sel.element, selEl = sel && elementAt(b, sel), selBox = selEl && !boxes.some(x => x.path === sel) ? shapeBox(selEl) : null;
  const outline = selBox ? `<div class="st-box on shape" style="left:${selBox[0] / W * 100}%;top:${selBox[1] / H * 100}%;width:${selBox[2] / W * 100}%;height:${selBox[3] / H * 100}%" aria-hidden="true"></div>` : '';
  const overlay = outline + boxes.map((x, i) => `<button class="st-box ${x.path && x.path === sel ? 'on' : ''} ${x.path ? '' : 'derived'}" data-act="${x.path ? 'element' : 'derivedBox'}" data-element="${esc(x.path ?? '')}" data-beat="${esc(b.id)}"
      style="left:${x.box[0] / W * 100}%;top:${x.box[1] / H * 100}%;width:${x.box[2] / W * 100}%;height:${x.box[3] / H * 100}%" title="${esc(x.path ? `Edit “${x.text}”` : `“${x.text}” is drawn from the scene's data`)}" aria-label="${esc(x.text)}"></button>`).join('');
  return {
    body: `<img src="${esc(shot.url)}" alt="Native still of ${esc(sceneName(b))}" draggable="false"><div class="st-boxes ${fresh ? '' : 'stale'}">${overlay}</div>${s.running ? '<div class="st-rendering" role="status"><div class="st-spinner"></div>Updating…</div>' : ''}`,
    badge: `<span class="st-chip ${fresh ? 'ok' : 'warn'}">${fresh ? 'Matches the working copy' : 'Before your latest edits'}</span><span>${at ? `Frame at ${timecode(at.at, fpsOf())}` : `Native still · ${esc(sceneName(b))} at ${Math.round((shot.pos ?? 0.6) * 100)}% of the scene`}${s.previous && !at ? ' · <button class="st-link" data-act="source" data-source="compare" data-mode="before">compare with before</button>' : ''}</span>`,
    tools,
  };
}
ACTIONS.derivedBox = () => status('That text is drawn from the scene’s data: change it in the inspector’s content fields.', 'warn');

function renderedView(v) {
  if (!v) return { body: '<div class="st-empty"><p>Nothing rendered yet.</p><button class="st-btn primary" data-act="draft">Make a rough cut</button></div>', badge: '', tools: '' };
  const ch = S.st.changes, latest = S.f.versions.at(-1)?.id === v.id;
  const pins = notesFor(S.f, v).filter(n => n.pin && Math.abs((n.at ?? 0) - S.t) <= 1.5);
  const edits = ch && ch.revision === v.id ? ch.edited.length + ch.added.length + ch.removed.length + (ch.film ? 1 : 0) : null;
  return {
    body: `<video id="st-video" data-keep="v-${esc(v.id)}" src="${esc(v.video)}" poster="${esc(v.poster ?? '')}" playsinline preload="auto"></video>
      <div class="st-pins">${pins.map(n => `<button class="st-pin ${n.resolved ? 'done' : ''}" data-act="thread" data-op="open" data-note="${esc(n.id)}" style="left:${n.pin.x * 100}%;top:${n.pin.y * 100}%" title="${esc(n.text)}">${n.resolved ? '✓' : esc((n.by ?? '•').slice(0, 1).toUpperCase())}</button>`).join('')}</div>`,
    badge: `<span class="st-chip">${esc(versionName(v))} · ${esc(v.quality)}</span>${v.approved ? `<span class="st-chip ok">Accepted by ${esc(v.approved.by ?? 'a person')}</span>` : ''}<span>${latest ? edits == null ? 'Rendered; immutable' : edits ? `${plural(edits, 'change')} in the working copy since this render` : 'Matches the working copy' : 'An earlier render; immutable'}${v.placeholders?.length ? ` · ${plural(v.placeholders.length, 'placeholder')}` : ''}</span>`,
    tools: `<button class="st-btn small ${S.noting ? 'on' : ''}" data-act="note" aria-pressed="${S.noting}" title="Pause, then click the picture to pin a note (N)">+ Note</button><button class="st-btn small" data-act="wholeNote">Whole-cut note</button><a class="st-btn small" href="${esc(v.video)}" download>Download</a>`,
  };
}

function compareView(v) {
  const b = beatById(S.sel.beat), s = b ? stillFor(b.id) : {}, mode = S.monitor.compare;
  const modes = `<div class="st-seg small" role="group" aria-label="Compare">${[['rendered', 'Render vs working'], ['before', 'Before vs after edit'], ...(S.monitor.passage ? [['passage', 'Candidate passage']] : [])].map(([k, t]) => `<button data-act="compareMode" data-mode="${k}" aria-pressed="${mode === k}">${t}</button>`).join('')}</div><button class="st-btn small ${S.monitor.side ? 'on' : ''}" data-act="side" aria-pressed="${S.monitor.side}">Side by side</button>`;
  let A = null, B = null, la = '', lb = '';
  if (mode === 'passage' && S.monitor.passage) {
    A = `<video class="st-cmp-a" data-keep="pa-${esc(S.monitor.passage.before)}" src="${esc(S.monitor.passage.before)}" playsinline preload="auto"></video>`;
    B = `<video class="st-cmp-b" data-keep="pb-${esc(S.monitor.passage.after)}" src="${esc(S.monitor.passage.after)}" playsinline preload="auto"></video>`;
    la = 'Before (the revision the note was made on)'; lb = 'After (the candidate)';
  } else if (mode === 'before') {
    const cur = s.current ?? s.latest;
    if (cur && s.previous) { A = `<img src="${esc(s.previous.url)}" alt="Before">`; B = `<img src="${esc(cur.url)}" alt="After">`; la = `Before · ${when(s.previous.finishedAt)}`; lb = cur === s.current ? 'Now (matches the working copy)' : `After · ${when(cur.finishedAt)}`; }
  } else {
    const cur = s.current ?? s.latest, vs = v?.scenes.find(x => x.id === b?.id);
    if (v && vs) { A = `<video id="st-video" class="st-cmp-a" data-keep="cv-${esc(v.id)}" src="${esc(v.video)}" playsinline preload="auto" muted></video>`; la = `${versionName(v)} as rendered`; }
    if (cur) { B = `<img src="${esc(cur.url)}" alt="Working copy">`; lb = cur === s.current ? 'Working copy (still, current)' : 'Working copy (still, before latest edits)'; }
    if (v && b && !vs) la = `“${sceneName(b)}” is new since ${versionName(v)}`;
  }
  if (!A || !B) return { body: `<div class="st-empty"><p>${mode === 'before' ? 'This scene needs two stills — one before and one after an edit — to compare.' : mode === 'rendered' ? (la || 'Render this scene’s still to compare it with the cut.') : 'Choose a candidate passage in Review.'}</p>${mode !== 'passage' && b ? '<button class="st-btn" data-act="still">Render still</button>' : ''}</div>`, badge: '', tools: modes };
  const wipe = Math.round(S.monitor.wipe * 100);
  const body = S.monitor.side
    ? `<div class="st-side"><figure>${A}<figcaption>${esc(la)}</figcaption></figure><figure>${B}<figcaption>${esc(lb)}</figcaption></figure></div>`
    : `<div class="st-wipe" style="--wipe:${wipe}%"><div class="st-wipe-a">${A}</div><div class="st-wipe-b">${B}</div><input class="st-wipe-handle" type="range" min="0" max="100" value="${wipe}" aria-label="Wipe between before and after" data-oninput="wipe"><span class="st-wipe-l">${esc(la)}</span><span class="st-wipe-r">${esc(lb)}</span></div>`;
  return { body, badge: `<span class="st-muted">${mode === 'passage' ? 'Both passages play together. Applied is not accepted: record the person’s verdict in Review.' : 'Drag across the picture to wipe between them.'}</span>`, tools: modes };
}
ACTIONS.wipe = el => { S.monitor.wipe = Number(el.value) / 100; el.closest('.st-wipe')?.style.setProperty('--wipe', `${el.value}%`); };
const _source = ACTIONS.source;
ACTIONS.source = el => { if (el.dataset.mode) S.monitor.compare = el.dataset.mode; _source(el); };

function transportHTML() {
  const c = clockNow(), video = monitorVideo(), playable = !!video || S.monitor.source !== 'working' || !!S.monitor.section;
  return `<div class="st-transport" role="toolbar" aria-label="Transport">
    <button class="st-icon" data-act="scene" data-dir="-1" title="Previous scene (↑)" aria-label="Previous scene">⏮</button>
    <button class="st-icon" data-act="stepf" data-dir="-1" title="Back one frame (←)" aria-label="Back one frame">‹</button>
    <button class="st-icon play" data-act="play" ${playable ? '' : 'disabled title="The working copy plays once it is rendered: Preview section (⇧⌘↩)"'} aria-label="Play or pause (space)" id="st-play">▶</button>
    <button class="st-icon" data-act="stepf" data-dir="1" title="Forward one frame (→)" aria-label="Forward one frame">›</button>
    <button class="st-icon" data-act="scene" data-dir="1" title="Next scene (↓)" aria-label="Next scene">⏭</button>
    <span class="st-tc" id="st-tc" title="minutes:seconds:frames at ${c.fps} fps">${timecode(S.t, c.fps)} <span>/ ${timecode(c.duration, c.fps)}</span></span>
    <span class="st-muted st-tc-note">${video ? 'browser video seeking is approximate (≈ one frame)' : S.monitor.source === 'working' ? 'stills are frame-exact' : ''}</span>
    <button class="st-btn small ${S.loop ? 'on' : ''}" data-act="loop" aria-pressed="${!!S.loop}" title="Loop the selected scene">Loop scene</button>
  </div>`;
}

// ------------------------------------------------------------------ playback and the playhead

const monitorVideo = () => document.getElementById('st-video') ?? document.querySelector('#st-stage video.st-cmp-a');
function videoOffset() { if (S.monitor.section) { const j = S.jobs.find(x => x.id === S.monitor.section); return j?.range?.[0] ?? 0; } return 0; }
function bindMonitor() {
  const stage = document.getElementById('st-stage');
  if (stage && !stage._b) {
    stage._b = true;
    stage.addEventListener('click', e => {
      if (!S.noting || e.target.closest('.st-pin')) return;
      const r = stage.getBoundingClientRect();
      composeNote({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
    });
  }
  const videos = [...document.querySelectorAll('#st-stage video')];
  for (const v of videos) {
    if (v._b) continue;
    v._b = true;
    const lead = v.id === 'st-video' || v.classList.contains('st-cmp-a');
    v.addEventListener('loadedmetadata', () => { if (lead) syncVideo(v); });
    if (!lead) continue;
    v.addEventListener('play', () => { setPlayIcon(true); videos.filter(x => x !== v).forEach(x => x.play().catch(() => {})); loopTick(); });
    v.addEventListener('pause', () => { setPlayIcon(false); videos.filter(x => x !== v).forEach(x => x.pause()); });
    v.addEventListener('seeked', () => { videos.filter(x => x !== v).forEach(x => { if (Math.abs(x.currentTime - v.currentTime) > 0.05) x.currentTime = v.currentTime; }); });
    v.addEventListener('timeupdate', () => { if (!v.paused) return; onVideoTime(v); });
  }
}
function syncVideo(v) {
  // Show the same moment of the selected scene the playhead is on.
  if (S.monitor.compare === 'rendered' && S.monitor.source === 'compare') { const vs = versionOf(S.monitor.rev)?.scenes.find(x => x.id === S.sel.beat); if (vs) v.currentTime = vs.start + 0.6 * (vs.end - vs.start); return; }
  if (S.monitor.compare === 'passage' && S.monitor.source === 'compare') return;
  const t = S.t - videoOffset();
  if (t >= 0 && t <= (v.duration || Infinity)) v.currentTime = t;
}
function setPlayIcon(on) { const b = document.getElementById('st-play'); if (b) b.textContent = on ? '❚❚' : '▶'; }
function onVideoTime(v) {
  const t = v.currentTime + videoOffset();
  if (S.monitor.source === 'compare') return paintPlayhead();
  S.t = t;
  const c = clockNow(), b = beatAt(c, t);
  if (S.loop && !v.paused) { const sel = c.beats.find(x => x.id === S.sel.beat); if (sel && (t >= sel.end - 0.03 || t < sel.start - 0.1)) { v.currentTime = sel.start - videoOffset() + 0.01; } }
  if (b && b.id !== S.sel.beat && !v.paused) { S.sel = { ...S.sel, beat: b.id, element: null, words: null }; invalidate(['left', 'right', 'timeline']); }
  paintPlayhead();
}
function loopTick() { const v = monitorVideo(); if (!S || !v || v.paused) return; onVideoTime(v); requestAnimationFrame(loopTick); }
function pauseVideo() { document.querySelectorAll('#st-stage video').forEach(v => v.pause()); }
function togglePlay() {
  const v = monitorVideo();
  if (!v) { status('The working copy plays once rendered: Preview section (⇧⌘↩) renders the selected scenes with their sound.', 'warn'); return; }
  if (v.paused) { const c = clockNow(); if (S.t >= c.duration - 0.05) seekTo(0); v.play().catch(() => {}); } else v.pause();
}
function seekTo(t) {
  const c = clockNow();
  S.t = Math.max(0, Math.min(c.duration - 1 / c.fps, t));
  const v = monitorVideo();
  if (v && S.monitor.source !== 'compare') { const local = S.t - videoOffset(); if (local >= 0 && local <= (v.duration || Infinity)) v.currentTime = local; }
  if (!v || v.paused) {
    const b = beatAt(c, S.t);
    if (b && b.id !== S.sel.beat) { S.sel = { ...S.sel, beat: b.id, element: null, words: null }; store.set(`cf-studio-sel:${S.id}`, b.id); invalidate(['left', 'right', 'monitor', 'timeline']); autoStill(); }
  }
  S.monitor.atJob = null;
  paintPlayhead();
}
function paintPlayhead() {
  const c = clockNow(), tc = document.getElementById('st-tc');
  if (tc) tc.firstChild.nodeValue = `${timecode(S.t, c.fps)} `;
  const ph = document.querySelector('.st-playhead');
  if (ph) ph.style.left = `${S.t * pxPerSecond()}px`;
  const pins = document.querySelector('.st-pins');
  if (pins && S.monitor.source === 'rendered') { const v = shownVersion(); if (v) pins.innerHTML = notesFor(S.f, v).filter(n => n.pin && Math.abs((n.at ?? 0) - S.t) <= 1.5).map(n => `<button class="st-pin ${n.resolved ? 'done' : ''}" data-act="thread" data-op="open" data-note="${esc(n.id)}" style="left:${n.pin.x * 100}%;top:${n.pin.y * 100}%" title="${esc(n.text)}">${n.resolved ? '✓' : esc((n.by ?? '•').slice(0, 1).toUpperCase())}</button>`).join(''); }
}
function stepFrame(dir) {
  const c = clockNow(), v = monitorVideo(); if (v) v.pause();
  seekTo((Math.round(S.t * c.fps) + dir) / c.fps + 0.0005);
}
function stepScene(dir) {
  const list = beatsOf(), i = list.findIndex(b => b.id === S.sel.beat), next = list[Math.max(0, Math.min(list.length - 1, i + dir))];
  if (next) select(next.id);
}

/** The newest failed render, in the engine's words, with a way to the scene it names. */
function failureHTML() {
  const j = S.jobs.filter(x => ['draft', 'final', 'section', 'check', 'revise'].includes(x.kind)).at(-1);
  if (!j || j.status !== 'failed' || S.dismissed === j.id) return '';
  const items = (j.errors?.length ? j.errors : ['See the job log for details.']).slice(0, 4);
  return `<div class="st-failure" role="alert"><div><b>${esc(j.label)} stopped</b>${items.map(e => { const id = /^([\w-]+):/.exec(e)?.[1]; return `<p>${esc(e)}${id && beatById(id) ? ` <button class="st-link" data-act="select" data-beat="${esc(id)}">Go to scene</button>` : ''}</p>`; }).join('')}</div>
    <div class="st-failure-actions"><button class="st-btn small" data-act="jobs">Log</button><button class="st-icon small" data-act="dismiss" data-job="${esc(j.id)}" aria-label="Dismiss">×</button></div></div>`;
}
ACTIONS.dismiss = el => { S.dismissed = el.dataset.job; invalidate(['monitor']); };

/** Where a shape sits on the frame, from its authored geometry (text boxes come from the engine). */
function shapeBox(el) {
  const n = v => (typeof v === 'number' ? v : null);
  if (n(el.w) != null && n(el.x) != null) return [el.x, el.y ?? 0, el.w, el.h ?? 0];
  if (n(el.cx) != null) { const rx = el.rx ?? el.r ?? (el.size ?? 0) / 2, ry = el.ry ?? el.r ?? (el.size ?? 0) / 2; return [el.cx - rx, el.cy - ry, rx * 2, ry * 2]; }
  if (n(el.x1) != null) return [Math.min(el.x1, el.x2), Math.min(el.y1, el.y2), Math.max(4, Math.abs(el.x2 - el.x1)), Math.max(4, Math.abs(el.y2 - el.y1))];
  if (Array.isArray(el.points) && el.points.length) { const xs = el.points.map(p => p[0]), ys = el.points.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]; }
  return null;
}
