// Building blocks: chart templates, fonts, 3D elements and palettes.
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
