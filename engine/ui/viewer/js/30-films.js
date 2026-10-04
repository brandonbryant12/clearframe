// The poster wall of films and side-by-side version comparison.
const STAGE_ORDER = ['brief', 'script', 'storyboard', 'rough', 'review', 'final'];
const PHASES = [['Pre-production', 'Plan the film: brief, script, storyboard'], ['Production', 'Make the picture: the rough cut'], ['Post-production', 'Shape and finish: review rounds, final']];
const cover = f => f.versions.at(-1)?.poster ?? f.boards.find(b => b.image)?.image ?? null;
const stageChip = s => `<span class="chip stage s-${esc(s.id)}">${esc(s.label)}</span>`;
/** The brief's one idea, or its first sentence. */
const briefLine = md => { const lines = md.split('\n').map(l => l.replace(/[#*`]/g, '').trim()).filter(Boolean); return (lines.find(l => /^the one idea:/i.test(l)) ?? lines[1] ?? lines[0] ?? '').replace(/^the one idea:\s*/i, ''); };
const openCount = f => f.versions.at(-1)?.notes.filter(n => !n.resolved).length ?? 0;

/** The studio board: every film in its phase of production, newest first within a stage. */
function films(query = store.get('cf-query', '')) {
  tabs('films');
  if (!data.films.length) {
    app.innerHTML = `<h1>Studio</h1><div class="empty">No films found in ${esc(data.roots.join(', '))} yet. Add a brief.md, a storyboard or a film.json, then run the viewer again.</div>`;
    return;
  }
  const q = query.trim().toLowerCase(), shown = data.films.filter(f => !q || `${f.title} ${f.folder} ${f.stage.label}`.toLowerCase().includes(q));
  const counts = STAGE_ORDER.map(id => [id, data.films.filter(f => f.stage.id === id).length]).filter(([, n]) => n);
  app.innerHTML = `<div class="filmhead"><div><h1>Studio</h1><p class="lede">Every film from brief to final. Open one to read its brief, flip through its boards, or watch, scrub and note a cut.</p></div>
    <input class="search" id="search" placeholder="Find a film" value="${esc(query)}" aria-label="Find a film"></div>
    <div class="stagecounts">${counts.map(([id, n]) => `${stageChip(data.films.find(f => f.stage.id === id).stage)} <span class="meta">${n}</span>`).join(' ')}</div>
    <div class="board">${PHASES.map(([phase, about]) => {
      const list = shown.filter(f => f.stage.phase === phase).sort((x, y) => STAGE_ORDER.indexOf(x.stage.id) - STAGE_ORDER.indexOf(y.stage.id));
      return `<section class="column"><h2>${phase}</h2><p class="meta">${about}</p>${list.map(filmCard).join('') || '<div class="meta empty small">Nothing here</div>'}</section>`;
    }).join('')}</div>`;
  const input = document.getElementById('search');
  input.oninput = () => { store.set('cf-query', input.value); const pos = input.selectionStart; films(input.value); const i = document.getElementById('search'); i.focus(); i.setSelectionRange(pos, pos); };
}

function filmCard(f) {
  const img = cover(f), v = f.versions.at(-1), open = openCount(f);
  return `<a class="card filmcard" href="#/film/${f.id}">
    <div class="thumb ${f.shape}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : f.brief ? `<span class="briefsnip">${esc(briefLine(f.brief))}</span>` : '<span class="briefglyph">No preview yet</span>'}
      ${f.kind === 'external' ? '<span class="badge right chip">Outside project</span>' : ''}</div>
    <div class="body"><div class="title">${esc(f.title)}</div>
      <div>${stageChip(f.stage)} ${open ? `<span class="chip">${plural(open, 'open note')}</span>` : ''}</div>
      <div class="meta">${v ? `${plural(f.versions.length, 'version')} · ${length(v.seconds)} · ` : f.boards.length ? `${plural(f.boards.length, 'scene')} · ` : ''}${when(f.updatedAt)}</div>
      <div class="next">Next: ${esc(f.stage.next)}</div></div></a>`;
}

/** Where the film is in its life: done steps, the current one, and what comes next. */
function stepper(f) {
  const at = STAGE_ORDER.indexOf(f.stage.id);
  return `<ol class="stepper">${STAGE_ORDER.map((id, i) => {
    const label = { brief: 'Brief', script: 'Script', storyboard: 'Storyboard', rough: 'Rough cut', review: 'Review', final: 'Final' }[id];
    return `<li class="${i < at ? 'done' : i === at ? 'current' : ''}"><span class="dot">${i < at ? '✓' : i + 1}</span><span class="lbl">${label}</span></li>`;
  }).join('')}</ol><div class="nextstep"><b>Next:</b> ${esc(f.stage.next)}</div>`;
}

/** A tiny Markdown reader for briefs: headings, bold, lists and paragraphs. */
function markdown(md) {
  const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>');
  const out = []; let list = false;
  for (const line of String(md ?? '').split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)/), li = line.match(/^\s*[-*]\s+(.*)/);
    if (!li && list) { out.push('</ul>'); list = false; }
    if (h) out.push(`<h${h[1].length + 1}>${inline(h[2])}</h${h[1].length + 1}>`);
    else if (li) { if (!list) { out.push('<ul>'); list = true; } out.push(`<li>${inline(li[1])}</li>`); }
    else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('');
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
