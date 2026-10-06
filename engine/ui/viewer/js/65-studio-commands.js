// Command palette, keyboard shortcuts and drag and drop: every way in reaches the same actions.

function paletteEntries() {
  const b = beatById(S.sel.beat), A = (name, run, keys = '', group = 'Studio') => ({ name, run, keys, group });
  return [
    A('Undo', () => ACTIONS.undo(), '⌘Z'), A('Redo', () => ACTIONS.redo(), '⇧⌘Z'),
    A('Render a still of the selected scene', () => ACTIONS.still(), '⌘↩', 'Preview'), A('Preview the selected section with sound', () => previewSection(), '⇧⌘↩', 'Preview'),
    A('Render the frame under the playhead', () => ACTIONS.stillAt(), '', 'Preview'), A('Render a rough cut', () => confirmJob('draft'), '', 'Preview'),
    A('Run the native check', () => ACTIONS.check(), '', 'Deliver'), A('Render the final film', () => confirmJob('final'), '', 'Deliver'), A('Show render jobs', () => openJobs(), '', 'Preview'),
    A(`${S.auto ? 'Turn off' : 'Turn on'} live stills`, () => { S.auto = !S.auto; store.set('cf-studio-auto', S.auto); invalidate(['status']); autoStill(); }, '', 'Preview'),
    ...Object.entries(LAYOUTS).map(([k, l], i) => A(`Workspace: ${l.name}`, () => setLayout(k), String(i + 1), 'View')),
    A('Monitor: working copy', () => setSource('working'), '', 'View'), A('Monitor: rendered version', () => setSource('rendered'), '', 'View'), A('Monitor: compare', () => setSource('compare'), '', 'View'),
    A('Film settings', () => { S.right = 'film'; invalidate(['right']); }, '', 'View'), A('Keyboard shortcuts', () => openHelp(), '?', 'View'),
    ...(b ? [A(`Duplicate “${sceneName(b)}”`, () => ACTIONS.duplicate({ dataset: { beat: b.id } }), '⌘D', 'Scene'), A(`Delete “${sceneName(b)}”`, () => cmd({ command: 'delete', beat: b.id }).catch(() => {}), '⌫', 'Scene'),
      A(`Move “${sceneName(b)}” earlier`, () => ACTIONS.move({ dataset: { beat: b.id, dir: '-1' } }), '⌥↑', 'Scene'), A(`Move “${sceneName(b)}” later`, () => ACTIONS.move({ dataset: { beat: b.id, dir: '1' } }), '⌥↓', 'Scene')] : []),
    A(`${S.agent.open ? 'Hide' : 'Show'} the agent`, () => toggleChat(), '⌘J', 'Agent'), A('Ask the agent about the whole film', () => pinScope('film'), '', 'Agent'),
    ...(b ? [A(`Ask the agent about “${sceneName(b)}”`, () => pinScope('scene'), '', 'Agent')] : []), A('Ask the agent about the moment under the playhead', () => pinScope('moment'), '', 'Agent'),
    A('Agent model and providers', () => openAgentSettings(), '', 'Agent'),
    A('Add a note on the picture', () => toggleNoting(), 'N', 'Review'), A('Add a whole-cut note', () => composeNote(null), '', 'Review'),
    ...beatsOf().map((x, i) => A(`Go to scene ${i + 1}: ${sceneName(x)}`, () => select(x.id), '', 'Go to')),
    ...S.f.versions.map(v => A(`Watch ${versionName(v)} (${v.quality})`, () => { S.monitor.rev = v.id; setSource('rendered'); }, '', 'Go to')),
    ...S.schema.blocks.map(x => A(`Insert ${x.name} — ${x.summary}`, () => cmd({ command: 'insert', block: x.name, after: S.sel.beat }).catch(() => {}), '', 'Insert')),
    ...S.schema.sketches.filter(x => !x.art).map(x => A(`Insert drawing: ${x.id}`, () => cmd({ command: 'insert', sketch: x.id, after: S.sel.beat }).catch(() => {}), '', 'Insert')),
    ...S.schema.palettes.map(p => A(`Palette: ${p.id}`, () => applyPreset({ kind: 'palette', value: p.id }), '', 'Look')),
    ...S.schema.types.map(t => A(`Type voice: ${t.title ?? t.id}`, () => applyPreset({ kind: 'type', value: t.id }), '', 'Look')),
    ...S.schema.treatments.map(t => A(`Treatment: ${t.title ?? t.id}`, () => cmd({ command: 'treatment', id: t.id }).catch(() => {}), '', 'Look')),
  ];
}
function openPalette() {
  const all = paletteEntries();
  let shown = all, cursor = 0;
  overlay(`<div class="st-palette" role="dialog" aria-modal="true" aria-label="Command palette"><input class="st-palette-q" placeholder="Type a command, a scene, a block, a palette…" aria-label="Search commands" aria-controls="st-palette-list" autofocus><ul class="st-palette-list" id="st-palette-list" role="listbox"></ul></div>`);
  const q = document.querySelector('.st-palette-q'), ul = document.getElementById('st-palette-list');
  const draw = () => {
    ul.innerHTML = shown.slice(0, 60).map((x, i) => `<li role="option" id="pal-${i}" aria-selected="${i === cursor}" data-i="${i}"><span class="st-muted">${esc(x.group)}</span>${esc(x.name)}${x.keys ? `<kbd>${esc(x.keys)}</kbd>` : ''}</li>`).join('') || '<li class="st-muted">No matching command</li>';
    q.setAttribute('aria-activedescendant', `pal-${cursor}`);
    ul.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  };
  const run = i => { const x = shown[i]; if (!x) return; closeOverlay(); x.run(); };
  q.oninput = () => { const words = q.value.toLowerCase().split(/\s+/).filter(Boolean); shown = all.filter(x => words.every(w => `${x.group} ${x.name}`.toLowerCase().includes(w))); cursor = 0; draw(); };
  q.onkeydown = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); cursor = Math.min(shown.length - 1, cursor + 1); draw(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); cursor = Math.max(0, cursor - 1); draw(); }
    if (e.key === 'Enter') { e.preventDefault(); run(cursor); }
  };
  ul.onclick = e => { const li = e.target.closest('[data-i]'); if (li) run(Number(li.dataset.i)); };
  draw();
}
function openHelp() {
  const keys = [['⌘K', 'Command palette'], ['⌘J', 'Show or hide the agent'], ['↩ in the composer', 'Send (queues while the agent works); ⌘↩ sends now'], ['1 – 4', 'Story · Design · Review · Deliver'], ['Space / K', 'Play or pause'], ['J / L', 'Back / forward one second'], ['← / →', 'One frame (⇧ one second)'], ['↑ / ↓', 'Previous / next scene'],
    ['⌥↑ / ⌥↓', 'Move the scene earlier / later'], ['⌘Z / ⇧⌘Z', 'Undo / redo (shared with automation)'], ['⌘↩', 'Native still of the scene'], ['⇧⌘↩', 'Preview the section with sound'], ['⌘D', 'Duplicate the scene'],
    ['⌫', 'Delete the scene (undo restores it)'], ['N', 'Note on the picture (rendered versions)'], ['= / − / 0', 'Zoom the timeline in / out / fit'], ['⇧-click', 'Select a run of scenes or words'], ['Enter / ⌘↩', 'Save a field'], ['Esc', 'Revert a field, close a dialog, clear the element']];
  overlay(`<div class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="help-t"><h2 id="help-t">Keyboard</h2><dl class="st-keys">${keys.map(([k, d]) => `<dt><kbd>${esc(k)}</kbd></dt><dd>${esc(d)}</dd>`).join('')}</dl>
    <p class="st-hint-text">Fields save when you leave them or press Enter. Each save is one step of undo, shared with agents using the same commands.</p><div class="st-dialog-actions"><button class="st-btn" data-act="close" autofocus>Close</button></div></div>`);
}

function studioKeys(e) {
  if (!S || S.disposed) return;
  const mod = e.metaKey || e.ctrlKey, o = document.getElementById('st-overlay');
  if (mod && e.key.toLowerCase() === 'k') { e.preventDefault(); e.stopPropagation(); return o && !o.hidden ? closeOverlay() : openPalette(); }
  if (o && !o.hidden) { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeOverlay(); } return; }
  if (mod && e.key.toLowerCase() === 'j') { e.preventDefault(); e.stopPropagation(); return toggleChat(); }
  // The agent composer owns Enter, ⌘Enter and Escape; editor shortcuts never swallow its input.
  if (document.activeElement?.id === 'st-chat-input') return;
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
  const handled = () => { e.preventDefault(); e.stopPropagation(); };
  // In a field ⌘↩ saves it (the field's own handler); elsewhere it previews.
  if (mod && e.key === 'Enter' && !typing) { handled(); return e.shiftKey ? previewSection() : ACTIONS.still(); }
  if (mod && e.key === 'Enter') { handled(); if (typing) document.activeElement.blur(); return e.shiftKey ? previewSection() : ACTIONS.still(); }
  if (typing) return;
  const k = e.key;
  if (mod && k.toLowerCase() === 'z') { handled(); return e.shiftKey ? ACTIONS.redo() : ACTIONS.undo(); }
  if (mod && k.toLowerCase() === 'y') { handled(); return ACTIONS.redo(); }
  if (mod && k.toLowerCase() === 'd') { handled(); return S.sel.beat && ACTIONS.duplicate({ dataset: { beat: S.sel.beat } }); }
  if (mod || (e.altKey && !['ArrowUp', 'ArrowDown'].includes(k))) return;
  if (e.altKey && (k === 'ArrowUp' || k === 'ArrowDown')) { handled(); return S.sel.beat && ACTIONS.move({ dataset: { beat: S.sel.beat, dir: k === 'ArrowUp' ? '-1' : '1' } }); }
  const map = {
    ' ': () => togglePlay(), k: () => togglePlay(), j: () => seekTo(S.t - 1), l: () => seekTo(S.t + 1),
    ArrowLeft: () => (e.shiftKey ? seekTo(S.t - 1) : stepFrame(-1)), ArrowRight: () => (e.shiftKey ? seekTo(S.t + 1) : stepFrame(1)),
    ArrowUp: () => stepScene(-1), ArrowDown: () => stepScene(1), Home: () => seekTo(0), End: () => seekTo(clockNow().duration),
    n: () => toggleNoting(), '?': () => openHelp(), '=': () => setZoom(S.zoom * 2), '+': () => setZoom(S.zoom * 2), '-': () => setZoom(S.zoom / 2), 0: () => setZoom(1),
    1: () => setLayout('story'), 2: () => setLayout('design'), 3: () => setLayout('review'), 4: () => setLayout('deliver'),
    Backspace: () => S.sel.beat && cmd({ command: 'delete', beat: S.sel.beat }).catch(() => {}), Delete: () => S.sel.beat && cmd({ command: 'delete', beat: S.sel.beat }).catch(() => {}),
    Escape: () => { if (S.noting) { S.noting = false; invalidate(); } else if (S.sel.element || S.sel.words || S.sel.range) { S.sel = { ...S.sel, element: null, words: null, range: null }; invalidate(); } },
  };
  const fn = map[k] ?? map[k.toLowerCase?.()];
  if (fn) { handled(); fn(); }
}

/** Drag a picture onto the monitor (plate), a block onto the scene list (insert), a scene onto another (reorder). */
function bindDrops(root) {
  root.addEventListener('dragstart', e => {
    const f = e.target.closest?.('[data-dragfile]'), bl = e.target.closest?.('[data-dragblock]'), sc = e.target.closest?.('[data-dragbeat]');
    const payload = f ? { file: f.dataset.dragfile } : bl ? { block: bl.dataset.dragblock } : sc ? { beat: sc.dataset.dragbeat } : null;
    if (!payload) return;
    e.dataTransfer.setData('application/x-clearframe', JSON.stringify(payload)); e.dataTransfer.effectAllowed = 'copyMove';
    root.classList.add(payload.file ? 'dragging-file' : 'dragging-scene');
  });
  root.addEventListener('dragend', () => root.classList.remove('dragging-file', 'dragging-scene'));
  const target = e => e.target.closest?.('#st-stage-wrap, .st-scenes li');
  root.addEventListener('dragover', e => { if (target(e) && e.dataTransfer.types.includes('application/x-clearframe')) { e.preventDefault(); target(e).classList.add('drop-here'); } });
  root.addEventListener('dragleave', e => target(e)?.classList.remove('drop-here'));
  root.addEventListener('drop', e => {
    const t = target(e); if (!t) return;
    e.preventDefault(); t.classList.remove('drop-here'); root.classList.remove('dragging-file', 'dragging-scene');
    let p; try { p = JSON.parse(e.dataTransfer.getData('application/x-clearframe')); } catch { return; }
    const onto = t.querySelector?.('[data-dragbeat]')?.dataset.dragbeat;
    if (p.file && t.id === 'st-stage-wrap') return useAsset(p.file, 'plate');
    if (p.block && onto) return cmd({ command: 'insert', block: p.block, after: onto }).catch(() => {});
    if (p.beat && onto && p.beat !== onto) return cmd({ command: 'move', beat: p.beat, to: beatsOf().findIndex(b => b.id === onto) }).catch(() => {});
    if (p.file && onto) { select(onto, { seek: false }); return useAsset(p.file, 'plate'); }
  });
}
