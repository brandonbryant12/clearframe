(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const app = document.getElementById('app'), box = document.getElementById('lightbox');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const when = iso => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const clock = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
  const length = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const bytes = n => n > 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
  const fontById = Object.fromEntries(data.library.fonts.map(f => [f.id, f]));
  const fontName = id => fontById[id] ? `${fontById[id].family} ${fontById[id].style}` : 'Unknown font';
  const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
  let server = false, stopLoop = null;
  if (location.protocol.startsWith('http')) fetch('/api/ping').then(r => { server = r.ok; }).catch(() => {});
  document.getElementById('stamp').textContent = `Updated ${when(data.generatedAt)}`;
  const tabs = active => { for (const a of document.querySelectorAll('.tabs a')) a.setAttribute('aria-selected', String(a.dataset.tab === active)); };
  const qualityChip = v => `<span class="chip ${v.quality === 'Final' ? 'final' : ''}">${esc(v.quality)}</span>`;
  const approvedChip = v => v.approved ? `<span class="chip approved">✓ Approved${v.approved.by ? ` by ${esc(v.approved.by)}` : ''}</span>` : '';
  const versionName = v => `Version ${v.number}${v.label ? ` · ${esc(v.label)}` : ''}`;
  const localNotes = (film, version) => store.get(`cf-notes:${film}`, []).filter(n => n.version === version);
  const allNotes = (f, v) => [...v.notes, ...localNotes(f.id, v.id).map(n => ({ ...n, local: true }))].sort((a, b) => (a.at ?? 0) - (b.at ?? 0));

  // ---------------------------------------------------------------- films
  function films() {
    tabs('films');
    if (!data.films.length) {
      app.innerHTML = `<h1>Films</h1><div class="empty">No films found in ${esc(data.roots.join(', '))} yet. Render a film, then run the viewer again.</div>`;
      return;
    }
    app.innerHTML = `<h1>Films</h1><p class="lede">Every film and each version of it. Open one to watch, scrub through what it is made of, compare versions and leave notes on the picture.</p>
      <div class="grid">${data.films.map(f => {
        const v = f.versions.at(-1);
        return `<a class="card" href="#/film/${f.id}">
          <div class="thumb">${v.poster ? `<img src="${esc(v.poster)}" alt="">` : ''}${v.approved ? `<span class="badge chip approved">✓ Approved</span>` : ''}${f.kind === 'external' ? '<span class="badge right chip">Outside project</span>' : ''}</div>
          <div class="body"><div class="title">${esc(f.title)}</div>
          <div class="meta">${plural(f.versions.length, 'version')} · latest ${when(v.createdAt)} · ${length(v.seconds)}</div></div></a>`;
      }).join('')}</div>`;
  }

  function film(id, selected, panel = 'moment') {
    tabs('films');
    const f = data.films.find(x => x.id === id);
    if (!f) return films();
    const v = f.versions.find(x => x.id === selected) ?? f.versions.at(-1);
    const lensOn = store.get('cf-lens', true);
    app.innerHTML = `<a class="back" href="#/films">← All films</a>
      <div class="filmhead"><div><h1>${esc(f.title)}</h1><p class="lede">${plural(f.versions.length, 'version')} · ${plural(v.scenes.length, 'scene')} · ${plural(f.files.length, 'file')} · <span>${esc(f.folder)}</span></p>${f.about ? `<p class="lede">${esc(f.about)}</p>` : ''}</div>
      <div class="toolbar">
        <button class="btn ${lensOn ? 'on' : ''}" id="lens" aria-pressed="${lensOn}" title="Outline the text on screen with its font, size and colour">◎ Lens</button>
        <button class="btn primary" id="addnote" title="Pause and click on the picture to pin a note">+ Note</button>
        ${f.versions.length > 1 ? `<a class="btn" href="#/compare/${f.id}">Compare</a>` : ''}
        <a class="btn" href="${esc(v.video)}" download>Download</a></div></div>
      <div class="film">
        <div class="left">
          <div class="stage ${f.shape}" id="stage">
            <video id="video" preload="auto" playsinline poster="${esc(v.poster ?? '')}" src="${esc(v.video)}"></video>
            <div class="overlay" id="overlay"><div class="content" id="content"></div></div>
          </div>
          <div class="transport"><button class="btn icon" id="play" aria-label="Play">▶</button><span class="time" id="time">0:00 / ${length(v.seconds)}</span>
            <span class="now"><span class="name">${versionName(v)}</span> ${qualityChip(v)} ${approvedChip(v)}</span></div>
          <div class="timeline" id="timeline" aria-label="Timeline: drag to scrub"></div>
          <div class="panels">
            <div class="subnav" role="tablist">${[['moment', 'In this moment'], ['scenes', 'Scenes'], ['files', 'Files'], ['fonts', 'Fonts'], ['notes', `Notes (${allNotes(f, v).length})`]]
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
            <div>${qualityChip(x)} ${approvedChip(x)} ${allNotes(f, x).length ? `<span class="chip">${plural(allNotes(f, x).length, 'note')}</span>` : ''}</div></div>
          </a>`).join('')}</aside>
      </div>`;
    workspace(f, v, panel);
  }

  /** Player, lens, timeline, notes and the live panel for one version. */
  function workspace(f, v, initialPanel) {
    const video = document.getElementById('video'), stage = document.getElementById('stage'), content = document.getElementById('content');
    const timeline = document.getElementById('timeline'), panelEl = document.getElementById('panel');
    let panel = initialPanel, lens = store.get('cf-lens', true), noting = false, last = -1, hoverEl = null;
    const T = v.seconds || video.duration || 1;
    const sceneAt = t => v.scenes.find(s => t >= s.start && t < s.end) ?? v.scenes.at(-1);
    const visible = t => { const s = sceneAt(t); return s ? s.elements.filter(e => e.box && e.at <= t + 0.05) : []; };

    // Fit the overlay to the video picture inside its letterbox.
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
    const lanes = [];
    lanes.push(['Scenes', v.scenes.map(s => `<button class="seg scene" style="left:${pct(s.start)};width:${pct(s.end - s.start)}" data-seek="${s.start}" title="${esc(`${s.number}. ${s.kind}`)}"><span>${s.number}. ${esc(s.kind)}</span></button>`).join('')]);
    if (v.lanes.narration.length) lanes.push(['Narration', v.lanes.narration.map(n => `<span class="seg voice" style="left:${pct(n.start)};width:${pct(n.end - n.start)}" title="${esc(n.text)}"></span>`).join('')]);
    if (v.lanes.music.length) lanes.push(['Music', v.lanes.music.map(m => `<span class="seg music" style="left:${pct(m.start)};width:${pct(m.end - m.start)}" title="${esc(m.name)}"><span>${esc(m.name)}</span></span>`).join('')]);
    if (v.lanes.sfx.length) lanes.push(['Sound', v.lanes.sfx.map(s => `<span class="tick" style="left:${pct(s.t)}" title="${esc(s.name)} at ${clock(s.t)}"></span>`).join('')]);
    const media = v.scenes.filter(s => s.media?.length);
    if (media.length) lanes.push(['Media', media.map(s => `<span class="seg media" style="left:${pct(s.start)};width:${pct(s.end - s.start)}" title="${esc(s.media.join(', '))}"><span>${esc(s.media.map(m => m.split('/').pop()).join(', '))}</span></span>`).join('')]);
    const drawNotesLane = () => allNotes(f, v).map(n => `<button class="pinmark" style="left:${pct(n.at ?? 0)}" data-seek="${n.at ?? 0}" title="${esc(n.text)}">●</button>`).join('');
    lanes.push(['Notes', drawNotesLane()]);
    timeline.innerHTML = `<div class="lanes">${lanes.map(([name, html]) => `<div class="lane"><div class="lname">${name}</div><div class="track" data-lane="${name}">${html}</div></div>`).join('')}
      <div class="playhead" id="playhead"></div><div class="hovertime" id="hovertime" hidden></div></div>`;
    const tracks = timeline.querySelector('.lanes'), playhead = document.getElementById('playhead'), hovertime = document.getElementById('hovertime');
    const timeFromX = x => { const r = timeline.querySelector('.track').getBoundingClientRect(); return Math.max(0, Math.min(T, (x - r.left) / r.width * T)); };
    let dragging = false;
    tracks.addEventListener('pointerdown', e => { if (e.target.closest('[data-seek]') && !e.target.closest('.scene')) return; dragging = true; tracks.setPointerCapture(e.pointerId); video.currentTime = timeFromX(e.clientX); });
    tracks.addEventListener('pointermove', e => {
      const t = timeFromX(e.clientX), r = timeline.querySelector('.track').getBoundingClientRect();
      hovertime.hidden = false; hovertime.style.left = `${e.clientX - tracks.getBoundingClientRect().left}px`;
      const s = sceneAt(t); hovertime.innerHTML = `${s?.thumb ? `<img src="${esc(s.thumb)}" alt="">` : ''}<span>${clock(t)}${s ? ` · ${esc(s.kind)}` : ''}</span>`;
      if (dragging) video.currentTime = t;
      if (e.clientX < r.left) hovertime.hidden = true;
    });
    tracks.addEventListener('pointerleave', () => { hovertime.hidden = true; });
    tracks.addEventListener('pointerup', () => { dragging = false; });
    timeline.addEventListener('click', e => { const b = e.target.closest('[data-seek]'); if (b && !dragging) video.currentTime = Number(b.dataset.seek) + 0.01; });

    // ---- lens and pins
    function drawOverlay(t) {
      const els = lens ? visible(t) : [];
      const W = v.frame.width, H = v.frame.height;
      const pins = allNotes(f, v).filter(n => n.pin && Math.abs((n.at ?? 0) - t) <= 2);
      content.innerHTML = els.map(e => `<div class="lensbox ${hoverEl === e.id ? 'hot' : ''}" data-el="${esc(e.id)}" style="left:${e.box[0] / W * 100}%;top:${e.box[1] / H * 100}%;width:${e.box[2] / W * 100}%;height:${e.box[3] / H * 100}%">
          <span class="tag"><i style="background:${esc(e.color.hex ?? 'transparent')}"></i>${esc(e.font ? fontName(e.font) : 'Text')}${e.size ? ` · ${e.size}px` : ''}</span></div>`).join('')
        + pins.map(n => `<button class="pin" data-note="${esc(n.id)}" style="left:${n.pin.x * 100}%;top:${n.pin.y * 100}%" title="${esc(n.text)}">${esc((n.by ?? '?').slice(0, 1).toUpperCase())}</button>`).join('');
      content.classList.toggle('noting', noting);
    }
    content.addEventListener('mouseover', e => { const b = e.target.closest('.lensbox'); hoverEl = b?.dataset.el ?? null; if (panel === 'moment') drawPanel(true); });
    content.addEventListener('click', e => {
      const pin = e.target.closest('.pin');
      if (pin) { const n = allNotes(f, v).find(x => x.id === pin.dataset.note); if (n) showNote(n); return; }
      if (!noting) { video.paused ? video.play() : video.pause(); return; }
      const r = content.getBoundingClientRect(), el = e.target.closest('.lensbox');
      compose({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height }, el?.dataset.el ?? null, e.clientX - stage.getBoundingClientRect().left, e.clientY - stage.getBoundingClientRect().top);
    });

    function compose(pin, element, px, py) {
      noting = false; document.getElementById('addnote').classList.remove('on');
      const at = video.currentTime, name = store.get('cf-name', '');
      const card = document.createElement('div');
      card.className = 'composer';
      card.style.left = `${Math.min(px, stage.clientWidth - 320)}px`; card.style.top = `${Math.min(py + 12, stage.clientHeight - 190)}px`;
      card.innerHTML = `<div class="meta">Note at ${clock(at)}${element ? ` · on “${esc(v.scenes.flatMap(s => s.elements).find(x => x.id === element)?.text ?? '')}”` : ''}</div>
        <textarea rows="3" placeholder="What should change here?"></textarea>
        <div class="row"><input placeholder="Your name" value="${esc(name)}"><button class="btn" data-x>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
      stage.appendChild(card);
      card.querySelector('textarea').focus();
      card.querySelector('[data-x]').onclick = () => card.remove();
      card.querySelector('[data-save]').onclick = async () => {
        const text = card.querySelector('textarea').value.trim(), by = card.querySelector('input').value.trim();
        if (!text) return;
        store.set('cf-name', by);
        const note = { version: v.id, at, text, by: by || null, element, pin };
        let saved = null;
        if (server) {
          const r = await fetch('/api/notes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ film: f.id, ...note }) });
          const body = await r.json();
          if (!r.ok) { card.querySelector('.meta').textContent = body.error ?? 'Could not save'; return; }
          saved = body; v.notes.push(saved);
        } else {
          const list = store.get(`cf-notes:${f.id}`, []);
          saved = { ...note, id: `local-${Date.now()}`, createdAt: new Date().toISOString() };
          list.push(saved); store.set(`cf-notes:${f.id}`, list);
        }
        card.remove();
        timeline.querySelector('[data-lane="Notes"]').innerHTML = drawNotesLane();
        document.querySelector('[data-panel="notes"]').textContent = `Notes (${allNotes(f, v).length})`;
        drawOverlay(video.currentTime); drawPanel();
      };
    }
    function showNote(n) {
      video.pause(); video.currentTime = n.at ?? 0;
      lightbox(`<div class="notecard"><div class="meta">${esc(n.by ?? 'Note')} · ${clock(n.at ?? 0)}${n.local ? ' · saved in this browser' : ''}</div><p>${esc(n.text)}</p><button class="btn" data-close>Close</button></div>`);
    }

    // ---- live panel
    function drawPanel(soft) {
      const t = video.currentTime, s = sceneAt(t);
      if (panel === 'moment') {
        const els = visible(t), line = v.lanes.narration.find(n => t >= n.start && t < n.end), music = v.lanes.music.find(m => t >= m.start && t < m.end);
        const sound = v.lanes.sfx.filter(x => Math.abs(x.t - t) < 0.6), fonts = [...new Set(els.map(e => e.font).filter(Boolean))];
        const colors = [...new Map(els.filter(e => e.color.hex).map(e => [e.color.hex, e.color])).values()];
        const files = (s?.media ?? []).map(m => f.files.find(x => x.name === m) ?? { name: m });
        panelEl.innerHTML = s ? `<div class="moment">
          <div class="mrow"><div class="mlabel">Scene</div><div><b>${s.number}. ${esc(s.kind)}</b> <span class="meta">${clock(s.start)}–${clock(s.end)}</span>${s.onScreen.length ? `<div>${s.onScreen.map(x => `<span class="quote">${esc(x)}</span>`).join(' ')}</div>` : ''}${s.description ? `<div class="meta">${esc(s.description)}</div>` : ''}</div></div>
          <div class="mrow"><div class="mlabel">Narration</div><div>${line ? `“${esc(line.text)}”` : s.narration ? `<span class="meta">${esc(s.narration)}</span>` : '<span class="meta">None</span>'}</div></div>
          <div class="mrow"><div class="mlabel">Music</div><div>${music ? esc(music.name) : '<span class="meta">None</span>'}${sound.length ? ` · <span class="meta">sound: ${sound.map(x => esc(x.name)).join(', ')}</span>` : ''}</div></div>
          <div class="mrow"><div class="mlabel">On screen</div><div class="els">${els.length ? els.map(e => `<div class="el ${hoverEl === e.id ? 'hot' : ''}" data-el="${esc(e.id)}"><span class="swatch" style="background:${esc(e.color.hex ?? 'transparent')}"></span><span class="txt" style="font-family:'${esc(e.font)}'">${esc(e.text)}</span><span class="meta">${esc(fontName(e.font))}${e.size ? ` · ${e.size}px` : ''} · ${esc(e.color.token ?? '')} ${esc(e.color.hex ?? '')}</span></div>`).join('') : '<span class="meta">No text outlined in this shot</span>'}</div></div>
          ${fonts.length ? `<div class="mrow"><div class="mlabel">Fonts</div><div>${fonts.map(id => `<span class="fontchip" style="font-family:'${esc(id)}'">${esc(fontName(id))}</span>`).join(' ')}</div></div>` : ''}
          ${colors.length ? `<div class="mrow"><div class="mlabel">Colours</div><div>${colors.map(c => `<span class="colorchip"><i style="background:${esc(c.hex)}"></i>${esc(c.token ?? '')} ${esc(c.hex)}</span>`).join(' ')}</div></div>` : ''}
          ${files.length ? `<div class="mrow"><div class="mlabel">Media</div><div class="minifiles">${files.map(x => fileCard(x, true)).join('')}</div></div>` : ''}
        </div>` : '<div class="meta">Play or scrub to see what is on screen.</div>';
        if (!soft) bindFiles(panelEl);
      } else if (!soft && panel === 'scenes') {
        panelEl.innerHTML = `<div class="scenes">${v.scenes.map(s => `<button class="scenecard ${s === sceneAt(t) ? 'current' : ''}" data-seek="${s.start}">
          <img src="${esc(s.thumb ?? '')}" alt=""><div><div><b>${s.number}. ${esc(s.kind)}</b> <span class="meta">${clock(s.start)} · ${length(s.end - s.start)}</span></div>
          ${s.onScreen.map(x => `<div class="quote">${esc(x)}</div>`).join('')}${s.narration ? `<div class="meta">“${esc(s.narration)}”</div>` : ''}${s.description ? `<div class="meta">${esc(s.description)}</div>` : ''}
          ${s.source ? `<div class="meta">Source: ${esc(s.source)}</div>` : ''}</div></button>`).join('') || '<div class="meta">No storyboard for this version.</div>'}</div>`;
        panelEl.onclick = e => { const b = e.target.closest('[data-seek]'); if (b) video.currentTime = Number(b.dataset.seek) + 0.01; };
      } else if (!soft && panel === 'files') {
        const groups = [...new Set(f.files.map(x => x.group))];
        panelEl.innerHTML = groups.length ? groups.map(g => `<h3>${esc(g)}</h3><div class="files">${f.files.filter(x => x.group === g).map(x => fileCard(x)).join('')}</div>`).join('') : '<div class="meta">No files in this project folder.</div>';
        bindFiles(panelEl);
      } else if (!soft && panel === 'fonts') {
        panelEl.innerHTML = v.fonts.length ? `<input class="sample" id="sample" value="${esc(store.get('cf-sample', 'The quick brown fox jumps over the lazy dog'))}" aria-label="Sample text">
          <div class="specimens">${v.fonts.map(u => specimen(fontById[u.font], u.roles)).join('')}</div>` : '<div class="meta">No font information for this version.</div>';
        bindSample(panelEl);
      } else if (!soft && panel === 'notes') {
        const notes = allNotes(f, v);
        panelEl.innerHTML = `${notes.length ? notes.map(n => `<button class="noteitem" data-seek="${n.at ?? 0}"><span class="meta">${clock(n.at ?? 0)}</span> <b>${esc(n.by ?? 'Note')}</b> ${esc(n.text)} ${n.local ? '<span class="chip">this browser</span>' : ''}</button>`).join('') : '<div class="meta">No notes yet. Press + Note, then click on the picture.</div>'}
          ${!server && localNotes(f.id, v.id).length ? `<div class="row" style="margin-top:12px"><span class="meta">Notes made here are saved in this browser. Send them to the film:</span><button class="btn" id="export">Download notes</button></div>` : ''}`;
        panelEl.onclick = e => { const b = e.target.closest('[data-seek]'); if (b) video.currentTime = Number(b.dataset.seek) + 0.01; };
        document.getElementById('export')?.addEventListener('click', () => {
          const notes = localNotes(f.id, v.id).map(n => ({ revision: n.version, at: n.at, text: n.text, by: n.by, element: n.element, pin: n.pin }));
          const a = document.createElement('a');
          a.href = URL.createObjectURL(new Blob([JSON.stringify({ film: f.id, notes }, null, 2)], { type: 'application/json' }));
          a.download = `${f.id}-${v.id}-notes.json`; a.click();
        });
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
    document.getElementById('lens').onclick = e => { lens = !lens; store.set('cf-lens', lens); e.currentTarget.classList.toggle('on', lens); e.currentTarget.setAttribute('aria-pressed', String(lens)); drawOverlay(video.currentTime); };
    document.getElementById('addnote').onclick = e => { video.pause(); noting = !noting; e.currentTarget.classList.toggle('on', noting); drawOverlay(video.currentTime); };
    let raf = 0;
    const tick = () => {
      const t = video.currentTime;
      if (t !== last) {
        last = t;
        playhead.style.left = `calc(var(--lname) + (100% - var(--lname)) * ${t / T})`;
        time.textContent = `${clock(t)} / ${length(T)}`;
        drawOverlay(t);
        if (panel === 'moment') drawPanel(true);
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    stopLoop = () => cancelAnimationFrame(raf);
    drawPanel();
    fit();
  }

  // ---------------------------------------------------------------- files and fonts
  function fileCard(x, small) {
    const t = x.type;
    const preview = t === 'image' || t === 'svg' ? `<img src="${esc(x.path)}" alt="" loading="lazy">`
      : t === 'video' ? `<img src="${esc(x.poster ?? '')}" alt=""><span class="play">▶</span>`
      : t === 'audio' ? (x.wave ? `<img class="wave" src="${esc(x.wave)}" alt="">` : '<span class="glyph">♪</span>')
      : t === 'font' ? `<span class="glyph" style="font-family:'${esc(x.font)}'">Aa</span>`
      : `<span class="glyph">${{ text: '{ }', document: 'PDF', model: '3D' }[t] ?? 'File'}</span>`;
    return `<button class="filecard ${small ? 'small' : ''} t-${t}" data-file="${esc(x.path ?? '')}" ${!x.path ? 'disabled' : ''}>
      <div class="fthumb">${preview}</div><div class="fname">${esc(x.name.split('/').pop())}</div>
      <div class="meta">${esc(x.group ?? '')}${x.seconds ? ` · ${length(x.seconds)}` : ''}${x.size ? ` · ${bytes(x.size)}` : ''}</div></button>`;
  }
  function bindFiles(root) {
    root.querySelectorAll('[data-file]').forEach(b => b.onclick = () => {
      const x = data.films.flatMap(f => f.files).find(y => y.path === b.dataset.file);
      if (x) openFile(x);
    });
  }
  function openFile(x) {
    const t = x.type;
    const body = t === 'image' || t === 'svg' ? `<img src="${esc(x.path)}" alt="">`
      : t === 'video' ? `<video controls autoplay src="${esc(x.path)}"></video>`
      : t === 'audio' ? `${x.wave ? `<img class="wave" src="${esc(x.wave)}" alt="">` : ''}<audio controls autoplay src="${esc(x.path)}"></audio>`
      : t === 'font' ? specimen(fontById[x.font], [])
      : t === 'text' ? `<pre>${esc(x.preview ?? '')}</pre>`
      : `<div class="empty">This ${t === 'model' ? '3D or simulation' : ''} file opens in its own application.</div>`;
    lightbox(`${body}<div class="row"><div><div class="title">${esc(x.name)}</div><div class="meta">${esc(x.group)} · ${bytes(x.size)}${x.seconds ? ` · ${length(x.seconds)}` : ''}</div></div>
      <div style="display:flex;gap:8px"><a class="btn" href="${esc(x.path)}" download>Download</a><button class="btn" data-close>Close</button></div></div>`);
  }
  function specimen(font, roles) {
    if (!font) return '';
    const sample = store.get('cf-sample', 'The quick brown fox jumps over the lazy dog');
    return `<div class="specimen"><div class="sphead"><b>${esc(font.family)} ${esc(font.style)}</b><span class="meta">${esc(font.name)} · ${bytes(font.size)}${font.license ? ` · ${esc(font.license)}` : ''}${font.origin ? ` · ${esc(font.origin)}` : ''}</span></div>
      ${roles?.length ? `<div class="meta">Used for ${esc(roles.join(', ').toLowerCase())}</div>` : font.films?.length ? `<div class="meta">Used in ${esc(font.films.join(', '))}</div>` : ''}
      <div class="big" style="font-family:'${esc(font.id)}'">Aa Gg 123</div>
      <div class="line" data-sample style="font-family:'${esc(font.id)}'">${esc(sample)}</div>
      <div class="line nums" style="font-family:'${esc(font.id)}'">$1,234.56 −7.8% +12 pts 2025</div>
      <a class="meta" href="${esc(font.path)}" download>Download font file</a></div>`;
  }
  function bindSample(root) {
    const input = root.querySelector('.sample');
    if (input) input.oninput = () => { store.set('cf-sample', input.value); root.querySelectorAll('[data-sample]').forEach(n => { n.textContent = input.value; }); };
  }

  // ---------------------------------------------------------------- compare
  function compare(id) {
    tabs('films');
    const f = data.films.find(x => x.id === id);
    if (!f || f.versions.length < 2) return film(id);
    const options = sel => f.versions.map(x => `<option value="${x.id}" ${x.id === sel ? 'selected' : ''}>${versionName(x)} — ${when(x.createdAt)}</option>`).join('');
    const a = f.versions.at(-2), b = f.versions.at(-1);
    app.innerHTML = `<a class="back" href="#/film/${f.id}">← ${esc(f.title)}</a><h1>Compare versions</h1>
      <p class="lede">Choose two versions. Play both keeps them in step, so you can watch the same moment side by side.</p>
      <div class="toolbar"><button class="btn primary" id="both">Play both</button><button class="btn" id="restart">Start over</button></div>
      <div class="compare">${[a, b].map((v, i) => `<div class="side"><select data-side="${i}">${options(v.id)}</select>
        <div class="stage ${f.shape}"><video data-side="${i}" preload="metadata" poster="${esc(v.poster ?? '')}" src="${esc(v.video)}" controls></video></div></div>`).join('')}</div>`;
    const vids = [...app.querySelectorAll('video')];
    for (const s of app.querySelectorAll('select')) s.onchange = () => {
      const v = f.versions.find(x => x.id === s.value), vid = vids[s.dataset.side];
      vid.poster = v.poster ?? ''; vid.src = v.video;
    };
    let syncing = false;
    const follow = (lead, other) => () => { if (syncing) return; syncing = true; other.currentTime = lead.currentTime; syncing = false; };
    vids[0].addEventListener('seeked', follow(vids[0], vids[1])); vids[1].addEventListener('seeked', follow(vids[1], vids[0]));
    document.getElementById('both').onclick = () => {
      const playing = !vids[0].paused;
      for (const v of vids) playing ? v.pause() : v.play();
      document.getElementById('both').textContent = playing ? 'Play both' : 'Pause both';
    };
    document.getElementById('restart').onclick = () => { for (const v of vids) v.currentTime = 0; };
  }

  // ---------------------------------------------------------------- library
  function library(section = 'charts', shape = 'landscape') {
    tabs('library');
    const L = data.library;
    const sections = [['charts', `Charts (${L.charts.filter(c => c.shape === 'landscape').length})`], ['fonts', `Fonts (${L.fonts.length})`], ['elements', `3D elements (${L.elements.length})`], ['palettes', `Colour palettes (${L.palettes.length})`]];
    let body = '';
    if (section === 'charts') {
      const list = L.charts.filter(c => c.shape === shape);
      body = `<div class="subnav">${[['landscape', 'Wide (16:9)'], ['vertical', 'Tall (9:16)']].map(([k, t]) => `<button data-shape="${k}" aria-pressed="${k === shape}">${t}</button>`).join('')}</div>
        <div class="grid ${shape === 'vertical' ? 'tall' : ''}">${list.map((c, i) => `
          <button class="card" data-chart="${i}" style="text-align:left;padding:0">
            <div class="thumb">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy">` : '<span class="meta">Preview not rendered</span>'}</div>
            <div class="body"><div class="title">${esc(c.title)}</div>${c.pattern ? `<div class="use">${esc(c.pattern)}</div>` : ''}${c.use ? `<div class="use"><b>Use it for</b> ${esc(c.use)}</div>` : ''}</div>
          </button>`).join('')}</div>`;
    } else if (section === 'fonts') {
      body = `<p class="lede">Every typeface available to films, drawn live. Type your own sample text.</p>
        <input class="sample" value="${esc(store.get('cf-sample', 'The quick brown fox jumps over the lazy dog'))}" aria-label="Sample text">
        <div class="specimens">${L.fonts.map(fn => specimen(fn, [])).join('')}</div>`;
    } else if (section === 'elements') {
      body = `<p class="lede">Prepared 3D clips. Hover to play; open one to watch it at full size.</p><div class="grid">${L.elements.map((e, i) => `
        <button class="card" data-element="${i}" style="text-align:left;padding:0">
          <div class="thumb"><video muted loop playsinline preload="none" poster="${esc(e.poster)}" src="${esc(e.video)}"></video></div>
          <div class="body"><div class="title">${esc(e.title)}</div><div class="use"><b>Use it for</b> ${esc(e.use)}</div></div></button>`).join('')}</div>`;
    } else {
      body = `<p class="lede">Each palette sets the background, text, accents and the colours for gains and losses.</p><div class="grid">${L.palettes.map(p => `
        <div class="palette"><div class="swatches">${['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'positive', 'negative'].map(k => `<span title="${k} ${esc(p.colors[k] ?? '')}" style="background:${esc(p.colors[k] ?? 'transparent')}"></span>`).join('')}</div>
          <div class="body"><div class="title">${esc(p.id)}</div><div class="use">${esc(p.notes)}</div></div></div>`).join('')}</div>`;
    }
    app.innerHTML = `<h1>Building blocks</h1><p class="lede">The pieces every film is made from. Charts take your own data; fonts, 3D elements and palettes set the look.</p>
      <div class="subnav">${sections.map(([k, t]) => `<button data-section="${k}" aria-pressed="${k === section}">${t}</button>`).join('')}</div>${body}`;
    for (const b of app.querySelectorAll('[data-section]')) b.onclick = () => { location.hash = `#/library/${b.dataset.section}`; };
    for (const b of app.querySelectorAll('[data-shape]')) b.onclick = () => { location.hash = `#/library/charts/${b.dataset.shape}`; };
    bindSample(app);
    const charts = L.charts.filter(c => c.shape === shape);
    for (const b of app.querySelectorAll('[data-chart]')) b.onclick = () => openChart(charts[b.dataset.chart]);
    for (const b of app.querySelectorAll('[data-element]')) {
      const vid = b.querySelector('video');
      b.onmouseenter = () => vid.play().catch(() => {}); b.onmouseleave = () => { vid.pause(); vid.currentTime = 0; };
      b.onclick = () => openElement(L.elements[b.dataset.element]);
    }
  }

  function lightbox(html) { box.innerHTML = `<div class="frame">${html}</div>`; box.hidden = false; box.querySelector('[data-close]')?.focus(); }
  function close() { box.querySelectorAll('video,audio').forEach(m => m.pause()); box.hidden = true; box.innerHTML = ''; }
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && !box.hidden) close();
    const v = document.getElementById('video');
    if (v && box.hidden && !/input|textarea|select/i.test(document.activeElement?.tagName)) {
      if (e.key === ' ') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      if (e.key === 'ArrowRight') v.currentTime += e.shiftKey ? 5 : 1 / 30 * 10;
      if (e.key === 'ArrowLeft') v.currentTime -= e.shiftKey ? 5 : 1 / 30 * 10;
    }
  });
  function openChart(c) {
    lightbox(`${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}">` : ''}
      <div class="row"><div><div class="title">${esc(c.title)}</div><div class="use">${esc(c.use)}</div></div>
      <div style="display:flex;gap:8px"><button class="btn" data-copy>Copy for an editor</button><button class="btn" data-close>Close</button></div></div>
      <details><summary class="meta">What an editor changes</summary><pre>${esc(c.snippet)}</pre></details>`);
    box.querySelector('[data-copy]').onclick = async e => { try { await navigator.clipboard.writeText(c.snippet); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Copy failed'; } };
  }
  function openElement(el) {
    lightbox(`<video controls autoplay muted ${el.loop ? 'loop' : ''} poster="${esc(el.poster)}" src="${esc(el.video)}"></video>
      <div class="row"><div><div class="title">${esc(el.title)}</div><div class="use">${esc(el.description)}</div></div><button class="btn" data-close>Close</button></div>`);
  }

  function route() {
    close(); stopLoop?.(); stopLoop = null;
    const [route_, query] = location.hash.split('?'), [, page, a, b, c] = route_.split('/');
    const start = Number(new URLSearchParams(query ?? '').get('t'));
    if (page === 'film') { film(a, b, c); if (start > 0) { const v = document.getElementById('video'); const go = () => { v.currentTime = start; }; v.readyState ? go() : v.addEventListener('loadedmetadata', go, { once: true }); } }
    else if (page === 'compare') compare(a);
    else if (page === 'library') library(a, b);
    else films();
    scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();
})();
