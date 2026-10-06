// One film: the picture, a filmstrip to find your place, sticky notes, and the agent.
// Click anywhere on the picture to leave a note on that spot at that moment; send your notes to
// the agent; watch the version it makes. Before the first cut, the film shows its brief and boards.
let pageKeys = null, S = null;

function filmPage(id, versionId) {
  const f = data.films.find(x => x.id === id);
  if (!f) return home();
  document.title = f.title;
  const latest = f.versions.at(-1), v = versionOf(f, versionId) ?? latest ?? null;
  const withAgent = server && agentOn && f.kind === 'clearframe';
  app.innerHTML = `${header(f)}<section class="film ${f.shape}">
    <div class="watch" id="watch"></div>
    <aside class="side" aria-label="Notes and the agent">
      ${withAgent ? `<div class="tabs" role="tablist"><button role="tab" data-tab="notes">Notes <span class="count" id="notecount"></span></button><button role="tab" data-tab="agent">Agent <span class="dot" id="agentdot"></span></button></div>` : ''}
      <div class="pane" id="notes"></div>${withAgent ? '<div class="pane" id="agent" hidden></div>' : ''}</aside></section>`;
  if (v) document.getElementById('barright').innerHTML = `${f.versions.length > 1 ? `<select id="versions" aria-label="Version">${[...f.versions].reverse().map(x => `<option value="${esc(x.id)}" ${x === v ? 'selected' : ''}>Version ${x.number}${x === latest ? ' (latest)' : ''} · ${esc(when(x.createdAt))}</option>`).join('')}</select>` : `<span class="muted">Version ${v.number} · ${esc(when(v.createdAt))}</span>`}
    <a class="btn small" href="${esc(v.video)}" download>Download</a>`;
  document.getElementById('versions')?.addEventListener('change', e => { location.hash = `#/film/${f.id}/${e.target.value}`; });

  S = { id: f.id, f, v, withAgent, time: () => 0, disposed: false, jobs: [] };
  const send = notes => {
    if (!withAgent) return pasteSheet(f, v, notes);
    const one = notes.length === 1 && !notes[0].local ? notes[0] : null, s = one ? sceneAt(versionOf(f, one.version), one.at) : null;
    const scope = one ? { kind: 'note', note: one.id, noteText: one.text, beats: s ? [s.id] : [], ...(one.at != null ? { t: one.at } : {}), label: `Note ${one.id}` } : { kind: 'film' };
    say(notesMessage(f, v, notes), scope);
    showTab('agent');
  };
  const notes = v ? player(f, v, send) : boards(f, send);
  if (withAgent) {
    agentInit(S);
    agentPane(document.getElementById('agent'));
    // A film the agent is still making opens on the conversation; one with a cut opens on its notes.
    showTab(store.get(`cf-tab:${f.id}`, v ? 'notes' : 'agent'));
    for (const b of app.querySelectorAll('[data-tab]')) b.onclick = () => showTab(b.dataset.tab);
    flushOutbox(); refreshAgent(true); watchFilm(f, v);
  }
  const count = () => { const n = notesOf(f).filter(x => x.state === 'open').length, el = document.getElementById('notecount'); if (el) el.textContent = n || ''; };
  S.notesChanged = () => { count(); notes.redraw(); };
  count();
  const stop = stopPage;
  stopPage = () => { stop?.(); if (S) S.disposed = true; S = null; };
}

function showTab(tab) {
  if (!S?.withAgent) return;
  store.set(`cf-tab:${S.id}`, tab);
  for (const b of app.querySelectorAll('[data-tab]')) b.setAttribute('aria-selected', String(b.dataset.tab === tab));
  document.getElementById('notes').hidden = tab !== 'notes';
  document.getElementById('agent').hidden = tab !== 'agent';
  if (tab === 'agent') { S.agent.unseen = false; drawAgent(); }
}

/** Keep the film current while the agent works: new versions, answered notes, render progress. */
function watchFilm(f, v) {
  const session = S;
  let timer = 0, latest = f.versions.at(-1)?.id ?? null;
  const tick = async () => {
    if (!currentSession(session)) return;
    const busy = agentBusy(session.agent) || session.jobs.some(j => ['queued', 'waiting', 'running'].includes(j.status));
    try {
      const [film, jobs] = await Promise.all([call(`/api/studio/film?film=${encodeURIComponent(f.id)}`), call(`/api/studio/jobs?film=${encodeURIComponent(f.id)}`).catch(() => ({ jobs: [] }))]);
      if (!currentSession(session)) return;
      session.jobs = jobs.jobs ?? [];
      // Notes answered or closed elsewhere: take the film's own record.
      const i = data.films.findIndex(x => x.id === f.id);
      if (film?.versions) {
        const fresh = { ...f, ...film };
        if (i >= 0) data.films[i] = fresh;
        f.versions.forEach((x, k) => { const y = film.versions.find(z => z.id === x.id); if (y) f.versions[k].notes = y.notes; });
        const now = film.versions.at(-1)?.id ?? null;
        if (now && now !== latest) {
          latest = now;
          const typing = /input|textarea/i.test(document.activeElement?.tagName);
          // No cut on screen yet: show the first one straight away. Otherwise offer it.
          if (!v && !typing) return route();
          const banner = document.getElementById('newversion');
          if (banner) { banner.hidden = false; banner.innerHTML = `The agent made version ${film.versions.length}. <a href="#/film/${esc(f.id)}">Watch it</a>`; }
        }
        session.notesChanged?.(); session.drawMarks?.();
      }
      drawAgent();
    } catch {}
    timer = setTimeout(tick, busy ? 3000 : 12000);
  };
  timer = setTimeout(tick, 1500);
  const stop = stopPage;
  stopPage = () => { clearTimeout(timer); stop?.(); };
}

// ---------------------------------------------------------------- the picture

function player(f, v, send) {
  const T = v.seconds || 1, latest = f.versions.at(-1), { width: W, height: H } = v.frame ?? { width: 1920, height: 1080 };
  document.getElementById('watch').innerHTML = `
    <div class="banner" id="newversion" hidden></div>
    ${v !== latest ? `<div class="banner">You're watching version ${v.number}. <a href="#/film/${esc(f.id)}">Watch the latest (version ${latest.number})</a></div>` : whatsNew(f, v)}
    <div class="stage" id="stage" style="--ar:${W / H}">
      <video id="video" preload="auto" playsinline poster="${esc(v.poster ?? '')}" src="${esc(v.video)}"></video>
      <div class="layer" id="layer" title="Click to leave a note here"></div>
      <button class="bigplay" id="bigplay" aria-label="Play">▶</button>
    </div>
    <div class="controls"><button class="play" id="play" aria-label="Play (space)">▶</button><span class="time" id="time">0:00</span>
      <div class="strip" id="strip" aria-label="Drag to move through the film">${filmstrip(v)}<div class="marks" id="marks"></div><div class="head" id="head"></div><div class="hover" id="hover" hidden></div></div></div>
    <div class="nowline" id="nowline"></div>`;
  const video = document.getElementById('video'), layer = document.getElementById('layer'), strip = document.getElementById('strip');
  const head = document.getElementById('head'), marks = document.getElementById('marks'), hover = document.getElementById('hover');
  const time = document.getElementById('time'), nowline = document.getElementById('nowline'), play = document.getElementById('play'), bigplay = document.getElementById('bigplay');
  const seek = t => { video.currentTime = Math.max(0, Math.min(T - 0.01, t)) + 0.001; };
  const notes = notesColumn(document.getElementById('notes'), {
    f, v, send, placeholder: 'Leave a note…',
    anchor: () => ({ version: v.id, at: Math.round(video.currentTime * 100) / 100 }),
    anchorLabel: () => `At ${clock(video.currentTime)}`,
    seek: n => { const t = timeIn(f, v, n); if (t != null) { video.pause(); seek(t); } },
    changed: () => { drawMarks(); drawPins(true); S?.notesChanged?.(); },
    onTyping: () => video.pause(),
  });

  // ---- the filmstrip: drag to scrub, notes as markers
  const tAt = x => { const r = strip.getBoundingClientRect(); return Math.max(0, Math.min(T, (x - r.left) / r.width * T)); };
  let dragging = false;
  strip.addEventListener('pointerdown', e => {
    const m = e.target.closest('.mark');
    if (m) { video.pause(); seek(Number(m.dataset.t)); notes.highlight(m.dataset.id); showTab('notes'); return; }
    dragging = true; strip.setPointerCapture(e.pointerId); seek(tAt(e.clientX));
  });
  strip.addEventListener('pointermove', e => {
    const t = tAt(e.clientX), s = sceneAt(v, t), r = strip.getBoundingClientRect();
    hover.hidden = false; hover.style.left = `${e.clientX - r.left}px`;
    hover.innerHTML = `${s?.thumb ? `<img src="${esc(s.thumb)}" alt="">` : ''}<span>${clock(t)}${s ? ` · Scene ${s.number}` : ''}</span>`;
    if (dragging) seek(t);
  });
  strip.addEventListener('pointerleave', () => { hover.hidden = true; });
  strip.addEventListener('pointerup', () => { dragging = false; });
  function drawMarks() {
    marks.innerHTML = notesOf(f).filter(n => n.state !== 'done' && n.version === v.id && timeIn(f, v, n) != null).map(n => {
      const t = timeIn(f, v, n);
      return `<button class="mark ${n.state}" data-t="${t}" data-id="${esc(n.id)}" style="left:${t / T * 100}%" title="${esc(`${clock(t)} · ${n.text}`)}" aria-label="Note at ${clock(t)}"></button>`;
    }).join('');
  }
  if (S) S.drawMarks = () => { drawMarks(); drawPins(true); };

  // ---- sticky notes on the picture
  let composer = null, shownAt = -1;
  function drawPins(force) {
    const t = video.currentTime, bucket = Math.round(t * 4);
    if (!force && bucket === shownAt) return;
    shownAt = bucket;
    const nums = notes.numbers();
    const near = notesOf(f).filter(n => spotOf(n) && n.state !== 'done' && n.version === v.id && Math.abs((timeIn(f, v, n) ?? -99) - t) <= 1.5);
    layer.querySelectorAll('.pin').forEach(p => p.remove());
    layer.insertAdjacentHTML('afterbegin', near.map(n => `<button class="pin ${n.state}" data-id="${esc(n.id)}" style="left:${spotOf(n).x * 100}%;top:${spotOf(n).y * 100}%" title="${esc(n.text)}">${nums.get(n.id) ?? ''}</button>`).join(''));
  }
  /** The words on the picture under a spot at the current moment, when the scene knows them. */
  function wordsAt(x, y) {
    const t = video.currentTime, s = sceneAt(v, t);
    const hit = (s?.elements ?? []).filter(e => e.box && e.at <= t + 0.05).find(e => { const [bx, by, bw, bh] = e.box, px = x * W, py = y * H; return px >= bx - 12 && px <= bx + bw + 12 && py >= by - 12 && py <= by + bh + 12; });
    return hit ? { on: String(hit.text).slice(0, 80), ...(hit.id ? { element: hit.id } : {}) } : {};
  }
  function compose(x, y) {
    video.pause(); bigplay.hidden = true;
    const under = wordsAt(x, y), keep = composer?.querySelector('textarea').value ?? '';
    composer?.remove();
    composer = document.createElement('div');
    composer.className = `pinnote${x > .62 ? ' flipx' : ''}${y > .55 ? ' flipy' : ''}`;
    composer.style.left = `${x * 100}%`; composer.style.top = `${y * 100}%`;
    composer.innerHTML = `<span class="dot"></span><div class="pcard"><textarea rows="3" placeholder="What should change here?" aria-label="Note on this spot"></textarea>
      <div class="prow"><span class="muted">${clock(video.currentTime)}${under.on ? ` · on “${esc(under.on)}”` : ''}</span><span class="grow"></span><button class="btn small" data-x>Cancel</button><button class="btn small primary" data-add>Add</button></div></div>`;
    layer.append(composer);
    const ta = composer.querySelector('textarea'); ta.value = keep; ta.focus();
    const close = () => { composer?.remove(); composer = null; };
    const done = async () => { if (await notes.save({ text: ta.value, spot: { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 }, ...under })) { close(); showTab('notes'); } };
    composer.querySelector('[data-add]').onclick = done;
    composer.querySelector('[data-x]').onclick = close;
    ta.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); done(); } if (e.key === 'Escape') close(); });
    composer.addEventListener('click', e => e.stopPropagation());
  }
  // On click (not pointerdown), so the browser's own focus handling doesn't pull focus from the new sticky.
  layer.addEventListener('click', e => {
    const pin = e.target.closest('.pin');
    if (pin) { video.pause(); const n = notesOf(f).find(x => x.id === pin.dataset.id); if (n) { seek(timeIn(f, v, n)); notes.highlight(n.id); showTab('notes'); } return; }
    if (e.target.closest('.pinnote')) return;
    const r = layer.getBoundingClientRect();
    compose((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });

  // ---- transport
  const toggle = () => { composer?.remove(); composer = null; video.paused ? video.play() : video.pause(); };
  play.onclick = toggle; bigplay.onclick = toggle;
  video.addEventListener('play', () => { play.textContent = '❚❚'; bigplay.hidden = true; });
  video.addEventListener('pause', () => { play.textContent = '▶'; });
  video.addEventListener('seeked', () => { if (video.currentTime > 0.05) bigplay.hidden = true; });
  pageKeys = { toggle, nudge: s => seek(video.currentTime + s), note: () => { video.pause(); showTab('notes'); notes.focus(); } };
  if (S) S.time = () => video.currentTime;
  let last = -1, lastScene = null, raf = 0;
  const tick = () => {
    const t = video.currentTime;
    if (t !== last) {
      last = t;
      head.style.left = `${t / T * 100}%`;
      time.textContent = `${clock(t)} / ${clock(T)}`;
      drawPins(); notes.anchorMoved();
      const s = sceneAt(v, t);
      if (s !== lastScene) {
        lastScene = s;
        nowline.innerHTML = s ? `<b>Scene ${s.number} of ${v.scenes.length}</b> · ${esc(s.kind)}${s.placeholder ? ` · <span class="todo">still to design: ${esc(s.placeholder)}</span>` : s.narration ? ` · <span class="muted">“${esc(s.narration)}”</span>` : ''}` : '';
      }
    }
    raf = requestAnimationFrame(tick);
  };
  drawMarks(); tick();
  stopPage = () => { cancelAnimationFrame(raf); pageKeys = null; };
  return notes;
}

function filmstrip(v) {
  const T = v.seconds || 1;
  if (!v.scenes?.length) return '<div class="frames"><span class="seg plain" style="width:100%"></span></div>';
  return `<div class="frames">${v.scenes.map(s => `<span class="seg ${s.placeholder ? 'todo' : ''}" style="width:${(s.end - s.start) / T * 100}%;${s.thumb ? `background-image:url('${esc(s.thumb)}')` : ''}"></span>`).join('')}</div>`;
}

/** What changed since the version before: scenes and words, and the notes the agent acted on. */
function sceneChanges(prev, v) {
  const before = new Map(prev.scenes.map(s => [s.id, s])), same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  const out = [];
  for (const s of v.scenes) {
    const p = before.get(s.id);
    if (!p) { out.push({ s, what: 'new scene' }); continue; }
    const what = [];
    if (p.placeholder && !s.placeholder) what.push('now designed');
    else if (p.kind !== s.kind) what.push(`now a ${s.kind.toLowerCase()}`);
    if (!same(p.onScreen, s.onScreen)) what.push(s.onScreen?.length ? `new words: “${s.onScreen.join(' · ')}”` : 'words removed');
    if (!same(p.narration, s.narration)) what.push('narration changed');
    const d = (s.end - s.start) - (p.end - p.start);
    if (Math.abs(d) > 0.05) what.push(`${Math.abs(d).toFixed(1)}s ${d > 0 ? 'longer' : 'shorter'}`);
    if (what.length) out.push({ s, what: what.join(', ') });
  }
  return { scenes: out, removed: prev.scenes.filter(p => !v.scenes.some(s => s.id === p.id)) };
}
function whatsNew(f, v) {
  const prev = f.versions[f.versions.indexOf(v) - 1];
  if (!prev?.scenes?.length || !v.scenes?.length) return '';
  const { scenes, removed } = sceneChanges(prev, v), acted = notesOf(f).filter(n => n.changedIn === v.id), check = acted.filter(n => n.state === 'changed').length;
  if (!scenes.length && !removed.length && !acted.length) return '';
  const summary = [scenes.length + removed.length && `${plural(scenes.length + removed.length, 'scene')} changed`, acted.length && `${plural(acted.length, 'note')} acted on`].filter(Boolean).join(' · ');
  return `<details class="banner news" ${check ? 'open' : ''}><summary><b>New in version ${v.number}</b> <span class="muted">${summary}${check ? ' — check them in your notes' : ''}</span></summary>
    <ul>${scenes.map(c => `<li><a href="#/film/${esc(f.id)}?t=${c.s.start}">Scene ${c.s.number} · ${esc(c.s.kind)}</a> <span class="muted">${esc(c.what)}</span></li>`).join('')}
    ${removed.map(p => `<li>${esc(p.kind)} <span class="muted">removed</span></li>`).join('')}</ul></details>`;
}

// ---------------------------------------------------------------- before the first cut

function boards(f, send) {
  let scene = null;
  const total = (f.boards ?? []).reduce((s, b) => s + b.seconds, 0);
  document.getElementById('watch').innerHTML = `<div class="banner" id="newversion" hidden></div>
    ${f.boards?.length ? `<p class="lede">${plural(f.boards.length, 'scene')}, about ${clock(total)} long. No video yet: these are stills of each scene. Click one to leave a note on it.</p>`
      : `<div class="empty big">${S?.withAgent ? 'No video yet. The agent is making the first cut: follow along in the Agent tab.' : 'No video yet.'}</div>`}
    ${f.brief ? `<details class="brief" ${f.boards?.length ? '' : 'open'}><summary>The brief</summary><div class="md">${markdown(f.brief)}</div></details>` : ''}
    <ol class="scenes">${(f.boards ?? []).map(b => `<li class="scene ${b.placeholder ? 'todo' : ''}" data-scene="${esc(b.id)}" tabindex="0">
      <div class="still ${f.shape}">${b.image ? `<img src="${esc(b.image)}" alt="" loading="lazy">` : `<span>${esc(b.kind)}</span>`}</div>
      <div class="words"><div><b>Scene ${b.number}</b> <span class="muted">${esc(b.kind)} · ${b.seconds}s</span></div>
        ${b.placeholder ? `<div class="todo">Still to design: ${esc(b.placeholder)}</div>` : (b.onScreen ?? []).map(q => `<div class="onscreen">${esc(q)}</div>`).join('')}
        ${b.narration ? `<p class="vo">“${esc(b.narration)}”</p>` : ''}</div></li>`).join('')}</ol>`;
  const list = app.querySelector('.scenes');
  const pick = id => { scene = f.boards.find(b => b.id === id) ?? null; list.querySelectorAll('.scene').forEach(x => x.classList.toggle('picked', x.dataset.scene === id)); notes.anchorMoved(); };
  const notes = notesColumn(document.getElementById('notes'), {
    f, v: null, send, placeholder: f.kind === 'brief' ? 'Anything to add before the agent starts…' : 'Leave a note…',
    anchor: () => (scene ? { scene: scene.id } : {}),
    anchorLabel: () => (scene ? `Scene ${scene.number}` : 'Whole film'),
    seek: n => { if (n.scene) { pick(n.scene); list.querySelector(`[data-scene="${CSS.escape(n.scene)}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
    changed: () => S?.notesChanged?.(),
  });
  list.addEventListener('click', e => { const s = e.target.closest('.scene'); if (s) { pick(s.dataset.scene); showTab('notes'); notes.focus(); } });
  pageKeys = { note: () => { showTab('notes'); notes.focus(); } };
  stopPage = () => { pageKeys = null; };
  return notes;
}
