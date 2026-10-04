// File cards and previews for every asset type, and live font specimens.
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
