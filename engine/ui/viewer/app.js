(() => {
  const data = JSON.parse(document.getElementById('data').textContent);
  const app = document.getElementById('app'), box = document.getElementById('lightbox');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const when = iso => iso ? new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';
  const length = s => s == null ? '' : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
  const qualityChip = v => `<span class="chip ${v.quality === 'Final' ? 'final' : ''}">${esc(v.quality)}</span>`;
  const approvedChip = v => v.approved ? `<span class="chip approved" title="${esc(v.approved.said ?? '')}">✓ Approved${v.approved.by ? ` by ${esc(v.approved.by)}` : ''}</span>` : '';
  const versionName = v => `Version ${v.number}${v.label ? ` · ${esc(v.label)}` : ''}`;
  document.getElementById('stamp').textContent = `Updated ${when(data.generatedAt)}`;

  function tabs(active) {
    for (const a of document.querySelectorAll('.tabs a')) a.setAttribute('aria-selected', String(a.dataset.tab === active));
  }

  function films() {
    tabs('films');
    if (!data.films.length) {
      app.innerHTML = `<h1>Films</h1><div class="empty">No films have been rendered in <b>${esc(data.root)}</b> yet. Render a film, then refresh this page by running the viewer again.</div>`;
      return;
    }
    app.innerHTML = `<h1>Films</h1><p class="lede">Every film and each version of it. Open a film to watch the latest version, step back through earlier ones, or compare two side by side.</p>
      <div class="grid">${data.films.map(f => {
        const v = f.versions.at(-1);
        return `<a class="card" href="#/film/${f.id}">
          <div class="thumb">${v.poster ? `<img src="${esc(v.poster)}" alt="">` : ''}${v.approved ? `<span class="badge chip approved">✓ Approved</span>` : ''}</div>
          <div class="body"><div class="title">${esc(f.title)}</div>
          <div class="meta">${plural(f.versions.length, 'version')} · latest ${when(v.createdAt)} · ${length(v.seconds)}</div></div></a>`;
      }).join('')}</div>`;
  }

  function film(id, selected) {
    tabs('films');
    const f = data.films.find(x => x.id === id);
    if (!f) return films();
    const v = f.versions.find(x => x.id === selected) ?? f.versions.at(-1);
    app.innerHTML = `<a class="back" href="#/films">← All films</a>
      <h1>${esc(f.title)}</h1><p class="lede">${plural(f.versions.length, 'version')} · ${plural(f.beats, 'scene')} · <span title="${esc(f.folder)}">${esc(f.folder)}</span></p>
      <div class="toolbar">${f.versions.length > 1 ? `<a class="btn" href="#/compare/${f.id}">Compare two versions</a>` : ''}
        <a class="btn" href="${esc(v.video)}" download>Download this version</a></div>
      <div class="film">
        <div>
          <div class="stage ${f.shape}"><video controls preload="metadata" poster="${esc(v.poster ?? '')}" src="${esc(v.video)}"></video></div>
          <div class="now"><span class="name">${versionName(v)}</span>${qualityChip(v)}${approvedChip(v)}<span class="meta">${when(v.createdAt)} · ${length(v.seconds)}</span></div>
          ${v.notes.length ? `<div class="notes">${v.notes.map(n => `<div class="note"><div>${esc(n.text)}</div><div class="who">${esc(n.by ?? 'Note')}${n.status && n.status !== 'open' ? ` · ${esc(n.status)}` : ''}</div></div>`).join('')}</div>` : ''}
        </div>
        <div class="versions" aria-label="Versions">${[...f.versions].reverse().map(x => `
          <a class="version" href="#/film/${f.id}/${x.id}" aria-current="${x.id === v.id}">
            <img src="${esc(x.poster ?? '')}" alt="">
            <div><div class="v">Version ${x.number}${x === f.versions.at(-1) ? ' <span class="meta">(latest)</span>' : ''}</div>
            ${x.label ? `<div class="label">${esc(x.label)}</div>` : ''}
            <div class="meta">${when(x.createdAt)} · ${length(x.seconds)}</div>
            <div>${qualityChip(x)} ${approvedChip(x)} ${x.notes.length ? `<span class="chip">${plural(x.notes.length, 'note')}</span>` : ''}</div></div>
          </a>`).join('')}</div>
      </div>`;
  }

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
    document.getElementById('restart').onclick = () => { for (const v of vids) { v.currentTime = 0; } };
  }

  function library(section = 'charts', shape = 'landscape') {
    tabs('library');
    const L = data.library;
    const sections = [['charts', `Charts (${L.charts.filter(c => c.shape === 'landscape').length})`], ['elements', `3D elements (${L.elements.length})`], ['palettes', `Colour palettes (${L.palettes.length})`]];
    let body = '';
    if (section === 'charts') {
      const list = L.charts.filter(c => c.shape === shape);
      body = `<div class="subnav">${[['landscape', 'Wide (16:9)'], ['vertical', 'Tall (9:16)']].map(([k, t]) => `<button data-shape="${k}" aria-pressed="${k === shape}">${t}</button>`).join('')}</div>
        <div class="grid ${shape === 'vertical' ? 'tall' : ''}">${list.map((c, i) => `
          <button class="card" data-chart="${i}" style="text-align:left;padding:0">
            <div class="thumb">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}" loading="lazy">` : '<span class="meta">Preview not rendered</span>'}</div>
            <div class="body"><div class="title">${esc(c.title)}</div>${c.pattern ? `<div class="use">${esc(c.pattern)}</div>` : ''}${c.use ? `<div class="use"><b>Use it for</b> ${esc(c.use)}</div>` : ''}</div>
          </button>`).join('')}</div>`;
    } else if (section === 'elements') {
      body = `<p class="lede">Prepared 3D clips. Hover to play; open one to watch it with sound off at full size.</p><div class="grid">${L.elements.map((e, i) => `
        <button class="card" data-element="${i}" style="text-align:left;padding:0">
          <div class="thumb"><video muted loop playsinline preload="none" poster="${esc(e.poster)}" src="${esc(e.video)}"></video></div>
          <div class="body"><div class="title">${esc(e.title)}</div><div class="use"><b>Use it for</b> ${esc(e.use)}</div></div></button>`).join('')}</div>`;
    } else {
      body = `<p class="lede">Each palette sets the background, text, accents and the colours for gains and losses.</p><div class="grid">${L.palettes.map(p => `
        <div class="palette"><div class="swatches">${['bg', 'surface', 'ink', 'muted', 'accent', 'accent2', 'positive', 'negative'].map(k => `<span title="${k} ${esc(p.colors[k] ?? '')}" style="background:${esc(p.colors[k] ?? 'transparent')}"></span>`).join('')}</div>
          <div class="body"><div class="title">${esc(p.id)}</div><div class="use">${esc(p.notes)}</div></div></div>`).join('')}</div>`;
    }
    app.innerHTML = `<h1>Building blocks</h1><p class="lede">The pieces every film is made from. Charts take your own data; 3D elements and palettes set the look.</p>
      <div class="subnav">${sections.map(([k, t]) => `<button data-section="${k}" aria-pressed="${k === section}">${t}</button>`).join('')}</div>${body}`;
    for (const b of app.querySelectorAll('[data-section]')) b.onclick = () => { location.hash = `#/library/${b.dataset.section}`; };
    for (const b of app.querySelectorAll('[data-shape]')) b.onclick = () => { location.hash = `#/library/charts/${b.dataset.shape}`; };
    const charts = L.charts.filter(c => c.shape === shape);
    for (const b of app.querySelectorAll('[data-chart]')) b.onclick = () => openChart(charts[b.dataset.chart]);
    for (const b of app.querySelectorAll('[data-element]')) {
      const vid = b.querySelector('video');
      b.onmouseenter = () => vid.play().catch(() => {}); b.onmouseleave = () => { vid.pause(); vid.currentTime = 0; };
      b.onclick = () => openElement(L.elements[b.dataset.element]);
    }
  }

  function lightbox(html) {
    box.innerHTML = `<div class="frame">${html}</div>`;
    box.hidden = false;
    box.querySelector('[data-close]')?.focus();
  }
  function close() { box.hidden = true; box.innerHTML = ''; }
  box.addEventListener('click', e => { if (e.target === box || e.target.closest('[data-close]')) close(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && !box.hidden) close(); });

  function openChart(c) {
    lightbox(`${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.title)}">` : ''}
      <div class="row"><div><div class="title" style="font-weight:650;font-size:18px">${esc(c.title)}</div><div class="use">${esc(c.use)}</div></div>
      <div style="display:flex;gap:8px"><button class="btn" data-copy>Copy for an editor</button><button class="btn" data-close>Close</button></div></div>
      <details><summary class="meta">What an editor changes</summary><pre>${esc(c.snippet)}</pre></details>`);
    box.querySelector('[data-copy]').onclick = async e => {
      try { await navigator.clipboard.writeText(c.snippet); e.target.textContent = 'Copied'; } catch { e.target.textContent = 'Copy failed'; }
    };
  }
  function openElement(el) {
    lightbox(`<video controls autoplay muted ${el.loop ? 'loop' : ''} poster="${esc(el.poster)}" src="${esc(el.video)}"></video>
      <div class="row"><div><div class="title" style="font-weight:650;font-size:18px">${esc(el.title)}</div><div class="use">${esc(el.description)}</div></div>
      <button class="btn" data-close>Close</button></div>`);
  }

  function route() {
    close();
    const [, page, a, b] = location.hash.split('/');
    if (page === 'film') film(a, b);
    else if (page === 'compare') compare(a);
    else if (page === 'library') library(a, b);
    else films();
    if (page !== 'compare') scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  route();
})();
