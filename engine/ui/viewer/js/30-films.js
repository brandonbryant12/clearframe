// The poster wall of films and side-by-side version comparison.
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
