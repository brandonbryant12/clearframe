// Timeline: the engine's own timing for the working copy (or a rendered version's frames), with
// picture, narration, notes and music lanes. Drag the ruler to scrub, a scene to reorder it and
// its right edge to set its duration; zoom with the buttons or ⌘-scroll.

function pxPerSecond() {
  const el = document.getElementById('st-tl-scroll'), c = clockNow();
  const w = Math.max(320, (el?.clientWidth ?? 900) - 16);
  return (w / Math.max(1, c.duration)) * S.zoom;
}
function setZoom(z) {
  const el = document.getElementById('st-tl-scroll'), before = pxPerSecond();
  S.zoom = Math.max(1, Math.min(64, z)); store.set('cf-studio-zoom', S.zoom);
  render(['timeline']);
  if (el) el.scrollLeft = Math.max(0, S.t * pxPerSecond() - el.clientWidth / 2 + (el.scrollLeft - S.t * before + el.clientWidth / 2) * 0);
}
function tickStep(pps) { for (const s of [1 / 30, 0.1, 0.25, 0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300]) if (s * pps >= 64) return s; return 600; }

function timelineHTML() {
  const c = clockNow(), pps = pxPerSecond(), W = Math.ceil(c.duration * pps) + 40, working = c.kind === 'working';
  const step = tickStep(pps), ticks = [];
  for (let t = 0; t <= c.duration + 1e-6; t += step) ticks.push(t);
  const fmt = t => step < 1 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(step < 0.1 ? 2 : 1).padStart(step < 0.1 ? 5 : 4, '0')}` : clock(t);
  const changed = changedBeats(), selected = S.sel.beat;
  const v = shownVersion() ?? (working ? S.f.versions.at(-1) : null);
  const thumbOf = id => { const s = working ? stillFor(id) : null, r = (v ?? S.f.versions.at(-1))?.scenes.find(x => x.id === id)?.thumb; return s?.current?.url ?? (!working || (!changed.has(id) && !S.st.changes?.film) ? r : null) ?? s?.latest?.url ?? r ?? null; };
  const clips = c.beats.map((x, i) => {
    const b = beatById(x.id), errs = beatErrors(x.id).length, thumb = thumbOf(x.id), w = (x.end - x.start) * pps;
    const notes = v ? notesFor(S.f, v).filter(n => (!n.resolved || /^Applied/.test(n.state ?? '')) && n.at != null && v.scenes.find(s => s.id === x.id && n.at >= s.start && n.at < s.end)).length : 0;
    return `<div class="st-clip ${x.id === selected ? 'on' : ''} ${S.sel.range?.includes(x.id) ? 'inrange' : ''} ${b?.placeholder ? 'todo' : ''} ${errs ? 'bad' : ''} ${!b ? 'gone' : ''}" data-key="c-${esc(x.id)}" data-clip="${esc(x.id)}" style="left:${x.start * pps}px;width:${Math.max(2, w)}px" role="button" tabindex="-1" aria-pressed="${x.id === selected}" aria-label="${esc(`Scene ${i + 1}: ${sceneName(b) || x.id}, ${(x.end - x.start).toFixed(2)} seconds`)}">
      ${thumb && w > 48 ? `<img src="${esc(thumb)}" alt="" draggable="false" loading="lazy">` : ''}<span class="st-clip-name">${esc(sceneName(b) || x.id)}</span><span class="st-clip-meta">${esc(b?.block ?? 'removed since')}${w > 120 ? ` · ${(x.end - x.start).toFixed(1)}s` : ''}</span>
      ${changed.has(x.id) && working ? '<i class="st-dot edited" title="Edited since the latest render"></i>' : ''}${notes ? `<i class="st-dot note" title="${plural(notes, 'open note')}">${notes}</i>` : ''}
      ${working && b ? `<span class="st-trim" data-trim="${esc(x.id)}" title="Drag to set the duration" aria-hidden="true"></span>` : ''}</div>`;
  }).join('');
  const narration = working ? (S.st.timing?.beats ?? []).filter(b => b.vo).map(b => {
    const rec = S.st.narration[b.id]?.kind === 'recording', w = (b.vo.end - b.vo.start) * pps, sel = S.sel.words?.beat === b.id ? S.sel.words : null;
    const words = w / Math.max(1, b.vo.words.length) > 44 ? b.vo.words.map(x => `<span class="st-tw ${sel && x.k >= Math.min(sel.a, sel.b) && x.k <= Math.max(sel.a, sel.b) ? 'on' : ''}" ${rec ? `data-act="word" data-beat="${esc(b.id)}" data-k="${x.k}" data-t="${x.t0}"` : ''} style="left:${(x.t0 - b.vo.start) * pps}px;width:${Math.max(2, (x.t1 - x.t0) * pps)}px" title="${esc(x.w)}">${(x.t1 - x.t0) * pps > x.w.length * 5.5 ? esc(x.w) : ''}</span>`).join('') : `<span class="st-vo-text">${esc(beatById(b.id)?.vo ?? '')}</span>`;
    return `<div class="st-vo ${rec ? 'rec' : ''} ${b.vo.wordTiming === 'measured' ? 'measured' : 'estimated'}" data-key="vo-${esc(b.id)}" style="left:${b.vo.start * pps}px;width:${Math.max(2, w)}px" title="${esc(`${b.vo.wordTiming === 'measured' ? 'Measured' : 'Estimated'} word timing${rec ? ' · recording' : ''}`)}">${words}</div>`;
  }).join('') : (v?.lanes.narration ?? []).map((n, i) => `<div class="st-vo measured" data-key="vn-${i}" style="left:${n.start * pps}px;width:${Math.max(2, (n.end - n.start) * pps)}px" title="${esc(n.text)}"><span class="st-vo-text">${esc(n.text)}</span></div>`).join('');
  // Notes belong to a rendered version; on the working clock they follow their scene (approximately).
  const nv = v, noteMarks = nv ? notesFor(S.f, nv).filter(n => n.at != null).map(n => {
    let at = n.at, approx = false;
    if (working) { const s = nv.scenes.find(x => n.at >= x.start && n.at < x.end), wb = s && workingBeat(s.id); if (!wb) return ''; at = wb.start + (n.at - s.start) / (s.end - s.start) * wb.dur; approx = true; }
    return `<button class="st-notemark ${n.resolved && !/^Applied/.test(n.state ?? '') ? 'done' : ''} ${S.sel.note === n.id ? 'on' : ''}" data-key="n-${esc(n.id)}" data-act="thread" data-op="open" data-note="${esc(n.id)}" style="left:${at * pps}px" title="${esc(`${approx ? '≈ ' : ''}${n.by ?? 'Note'}: ${n.text}`)}" aria-label="${esc(`Note: ${n.text}`)}"></button>`;
  }).join('') : '';
  const music = working ? (S.st.storyboard.music ? `<div class="st-music" style="left:0;width:${c.duration * pps}px">Music bed${S.st.storyboard.music.volume != null ? ` · level ${S.st.storyboard.music.volume}` : ''}</div>` : '') : (v?.lanes.music ?? []).map(m => `<div class="st-music" style="left:${m.start * pps}px;width:${(m.end - m.start) * pps}px">${esc(m.name)}</div>`).join('');
  const chapters = working ? (S.st.timing?.beats ?? []).filter((b, i, a) => b.chapter && b.chapter !== a[i - 1]?.chapter).map(b => `<span class="st-chapter" style="left:${b.start * pps}px">${esc(b.chapter)}</span>`).join('') : '';
  const lanes = [['Picture', `<div class="st-lane pic">${clips}</div>`], ['Narration', `<div class="st-lane voice">${narration}</div>`], ...(noteMarks ? [['Notes', `<div class="st-lane notes">${noteMarks}</div>`]] : []), ...(music ? [['Music', `<div class="st-lane music">${music}</div>`]] : [])];
  return `<div class="st-tl-bar"><b>Timeline</b><span class="st-chip ${working ? c.estimated ? 'warn' : '' : 'ok'}" title="${working ? 'From the engine’s own timing of the saved working copy' : 'The frames of that render'}">${esc(c.label)}</span>
      <span class="st-muted">${clock(c.duration)} · ${c.beats.length} scenes</span><span class="st-spacer"></span>
      <button class="st-btn small ${S.followPlayhead ? 'on' : ''}" data-act="follow" aria-pressed="${!!S.followPlayhead}" title="Keep the playhead in view">Follow</button>
      <button class="st-icon small" data-act="zoom" data-zoom="0.5" aria-label="Zoom out (−)">−</button><button class="st-btn small" data-act="zoom" data-zoom="fit" title="Fit the film (0)">Fit</button><button class="st-icon small" data-act="zoom" data-zoom="2" aria-label="Zoom in (=)">+</button></div>
    <div class="st-tl-body"><div class="st-tl-names">${['', ...lanes.map(l => l[0])].map((n, i) => `<div class="${i ? 'st-lane-name' : 'st-ruler-name'}">${n}</div>`).join('')}</div>
      <div class="st-tl-scroll" id="st-tl-scroll"><div class="st-tl-inner" style="width:${W}px">
        <div class="st-ruler" data-scrub="1">${ticks.map(t => `<span class="st-tick" style="left:${t * pps}px">${fmt(t)}</span>`).join('')}${chapters}</div>
        ${lanes.map(l => l[1]).join('')}
        <div class="st-playhead" style="left:${S.t * pps}px" aria-hidden="true"><span class="st-playhead-cap" data-scrub="1"></span></div>
        <div class="st-drop" id="st-drop" hidden></div>
      </div></div></div>`;
}

function bindTimeline(root) {
  root.addEventListener('wheel', e => {
    if (!e.target.closest('.st-tl-scroll') || !(e.metaKey || e.ctrlKey)) return;
    e.preventDefault(); setZoom(S.zoom * (e.deltaY < 0 ? 1.25 : 0.8));
  }, { passive: false });
  root.addEventListener('pointerdown', e => {
    const tl = e.target.closest('.st-tl-inner'); if (!tl || e.button !== 0) return;
    const scroll = document.getElementById('st-tl-scroll'), x0 = e.clientX, pps = pxPerSecond();
    const timeAt = cx => (cx - tl.getBoundingClientRect().left) / pps;
    const trim = e.target.closest('[data-trim]'), clip = e.target.closest('[data-clip]');
    if (e.target.closest('[data-scrub]') || (!clip && !e.target.closest('[data-act]'))) {
      e.preventDefault(); pauseVideo(); tl.setPointerCapture(e.pointerId); seekTo(timeAt(e.clientX));
      tl.onpointermove = ev => seekTo(timeAt(ev.clientX)); tl.onpointerup = tl.onpointercancel = () => { tl.onpointermove = null; };
      return;
    }
    if (trim) {
      e.preventDefault(); e.stopPropagation();
      const id = trim.dataset.trim, el = trim.parentElement, wb = workingBeat(id), w0 = el.offsetWidth, fps = fpsOf();
      tl.setPointerCapture(e.pointerId);
      let dur = wb.dur;
      tl.onpointermove = ev => { dur = Math.max(0.1, Math.round((wb.dur + (ev.clientX - x0) / pps) * fps) / fps); el.style.width = `${dur * pps}px`; el.dataset.dur = `${dur.toFixed(2)} s`; status(`Duration ${dur.toFixed(2)} s — release to set`); };
      tl.onpointerup = () => { tl.onpointermove = null; if (Math.abs(dur - wb.dur) > 1e-3) cmd({ command: 'set', target: 'beat', beat: id, path: 'duration', value: Number(dur.toFixed(3)) }).catch(() => { el.style.width = `${w0}px`; }); else el.style.width = `${w0}px`; };
      return;
    }
    if (clip) {
      const id = clip.dataset.clip; let dragging = false;
      const c = clockNow();
      tl.setPointerCapture(e.pointerId);
      tl.onpointermove = ev => {
        if (!dragging && Math.abs(ev.clientX - x0) < 6) return;
        if (c.kind !== 'working') return;
        dragging = true; clip.classList.add('dragging');
        const t = timeAt(ev.clientX), drop = document.getElementById('st-drop'), at = dropIndex(c, t);
        drop.hidden = false; drop.style.left = `${(at < c.beats.length ? c.beats[at].start : c.duration) * pps}px`;
      };
      tl.onpointerup = ev => {
        tl.onpointermove = null; clip.classList.remove('dragging'); const drop = document.getElementById('st-drop'); if (drop) drop.hidden = true;
        if (!dragging) { if (ev.shiftKey) extendRange(id); else { S.sel.range = null; select(id, { seek: S.monitor.source !== 'working' || !S.sel.beat }); } return; }
        const from = beatsOf().findIndex(b => b.id === id); let to = dropIndex(c, timeAt(ev.clientX)); if (to > from) to--;
        if (to !== from) cmd({ command: 'move', beat: id, to }).catch(() => {});
      };
    }
  });
}
function dropIndex(c, t) { const i = c.beats.findIndex(b => t < (b.start + b.end) / 2); return i < 0 ? c.beats.length : i; }
function extendRange(id) {
  const list = beatsOf().map(b => b.id), a = list.indexOf(S.sel.beat), b = list.indexOf(id);
  S.sel.range = list.slice(Math.min(a, b), Math.max(a, b) + 1);
  status(`${plural(S.sel.range.length, 'scene')} selected for a section preview (⇧⌘↩)`);
  invalidate(['timeline', 'left']);
}
