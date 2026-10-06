// Inspector: the selected scene, element or the whole film, as fields built from the storyboard
// schema and the block catalog. Each field commits one validated command; a refusal stays beside
// the field and nothing is saved. Values the studio cannot edit are shown, never dropped.

let fieldSeq = 0;
/** One field. type: text | textarea | number | range | enum | bool | list | numbers | json | combo */
function field(o) {
  const { scope = 'beat', beat = S.sel.beat, path, label, type = 'text', hint = '', tip = '', placeholder = '', options = [], min, max, step, rows = 3, value, clear = false, readonly = false, list } = o;
  const id = `f${++fieldSeq}`, key = fieldKey(scope, scope === 'film' ? undefined : beat, path), err = S.fieldErrors[key], draft = S.drafts[key];
  const data = `data-scope="${scope}" ${scope === 'beat' ? `data-beat="${esc(beat)}"` : ''} data-path="${esc(path)}" id="${id}" ${readonly ? 'readonly aria-readonly="true"' : ''} ${err ? `aria-invalid="true" aria-describedby="${id}-e"` : ''} ${draft != null ? 'data-dirty="1"' : ''}`;
  // A refused value stays in the field (marked) until it is fixed, reset or reverted with Esc.
  const show = v => (draft != null ? draft : v == null ? '' : typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));
  let control;
  if (type === 'textarea' || type === 'json' || type === 'list') control = `<textarea ${data} data-type="${type === 'textarea' ? 'text' : type}" rows="${rows}" class="${type === 'json' ? 'mono' : ''}" placeholder="${esc(placeholder)}">${esc(type === 'list' && draft == null ? (value ?? []).join('\n') : show(value))}</textarea>`;
  else if (type === 'enum') control = `<select ${data} data-type="enum" ${options.some(x => typeof x.value === 'number') ? 'data-numeric="1"' : ''}><option value="" ${value == null ? 'selected' : ''}>${esc(placeholder || 'Default')}</option>${options.map(x => `<option value="${esc(String(x.value))}" ${String(value) === String(x.value) && value != null ? 'selected' : ''}>${esc(x.label ?? x.value)}</option>`).join('')}${value != null && !options.some(x => String(x.value) === String(value)) ? `<option value="${esc(show(value))}" selected>${esc(show(value))}</option>` : ''}</select>`;
  else if (type === 'bool') control = `<input type="checkbox" ${data} data-type="bool" ${value ? 'checked' : ''}>`;
  else if (type === 'range') control = `<div class="st-range"><input type="range" ${data} data-type="number" min="${min}" max="${max}" step="${step ?? 0.05}" value="${esc(show(value ?? ''))}"><output for="${id}">${value == null ? '—' : esc(show(value))}</output></div>`;
  else control = `<input ${data} data-type="${type === 'number' ? 'number' : type === 'numbers' ? 'numbers' : 'text'}" type="${type === 'number' ? 'number' : 'text'}" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} ${step != null ? `step="${step}"` : type === 'number' ? 'step="any"' : ''} value="${esc(type === 'numbers' && draft == null ? (value ?? []).join(', ') : show(value))}" placeholder="${esc(placeholder)}" ${list ? `list="${list}"` : ''} autocomplete="off">`;
  const clr = clear && value != null && !readonly ? `<button class="st-link" data-act="clear" data-scope="${scope}" ${scope === 'beat' ? `data-beat="${esc(beat)}"` : ''} data-path="${esc(path)}" title="Remove this setting (use the default)">Reset</button>` : '';
  return `<div class="st-field ${type === 'bool' ? 'inline' : ''} ${err ? 'invalid' : ''}" data-key="${esc(key)}"><div class="st-field-head"><label for="${id}" ${tip ? `title="${esc(tip)}"` : ''}>${esc(label)}${tip ? ' <span class="st-tip" aria-hidden="true">?</span>' : ''}</label>${clr}</div>${control}${hint ? `<p class="st-hint-text">${hint}</p>` : ''}${err ? `<p class="st-err" id="${id}-e" role="alert">${esc(err)}${draft != null ? ' <span class="st-muted">Esc restores the saved value.</span>' : ''}</p>` : ''}</div>`;
}
const enumOf = list => list.filter(x => x != null).map(v => ({ value: v, label: String(v) }));
const schemaEnum = s => s?.enum ?? s?.oneOf?.find(x => x.enum)?.enum ?? null;
function section(id, title, body, { open = true, count } = {}) {
  if (!body) return '';
  const isOpen = S.open[id] ?? open;
  return `<details class="st-sec" data-section="${id}" data-key="sec-${id}" ${isOpen ? 'open' : ''}><summary>${esc(title)}${count != null ? ` <span class="st-count">${count}</span>` : ''}</summary><div class="st-sec-body">${body}</div></details>`;
}

function rightHTML() {
  fieldSeq = 0;
  const tabs = `<div class="st-tabs" role="tablist" aria-label="Inspector">${RIGHT_TABS.map(([k, t]) => `<button role="tab" data-act="right" data-tab="${k}" aria-selected="${S.right === k}">${t}${k === 'review' ? openNotesBadge() : ''}</button>`).join('')}</div>`;
  const body = S.right === 'film' ? filmInspector() : S.right === 'review' ? reviewPanel() : S.right === 'deliver' ? deliverPanel() : sceneInspector();
  return `${tabs}<div class="st-panel-body" id="st-right-body">${body}</div>`;
}
function openNotesBadge() { const v = shownVersion() ?? S.f.versions.at(-1); const n = v ? notesFor(S.f, v).filter(x => /^Applied/.test(x.state ?? '') || !x.resolved).length : 0; return n ? ` <span class="st-count">${n}</span>` : ''; }

// ------------------------------------------------------------------ the selected scene

function sceneInspector() {
  const b = beatById(S.sel.beat);
  if (!b) return '<div class="st-empty-panel">Select a scene in the timeline or the scene list.</div>';
  const meta = S.schema.blocks.find(x => x.name === b.block), i = beatsOf().indexOf(b), wb = workingBeat(b.id), n = S.st.narration[b.id];
  const errs = beatErrors(b.id);
  const head = `<div class="st-sel-head"><div class="st-sel-kind">${esc(b.block)}${meta ? ` · <span class="st-muted">${esc(meta.category)}</span>` : ''}</div>
    <h2>${esc(sceneName(b))}</h2>
    <div class="st-sel-meta"><span>Scene ${i + 1} of ${beatsOf().length}</span><span>${wb ? `${wb.dur.toFixed(2)} s${b.duration == null ? ' (from narration)' : ''}` : ''}</span><span class="st-mono">${esc(b.id)}</span></div>
    <div class="st-sel-actions"><button class="st-btn small" data-act="move" data-beat="${esc(b.id)}" data-dir="-1" ${i === 0 ? 'disabled' : ''} title="Move earlier (⌥↑)">↑</button><button class="st-btn small" data-act="move" data-beat="${esc(b.id)}" data-dir="1" ${i === beatsOf().length - 1 ? 'disabled' : ''} title="Move later (⌥↓)">↓</button>
      <button class="st-btn small" data-act="duplicate" data-beat="${esc(b.id)}" title="Duplicate (⌘D)">Duplicate</button><button class="st-btn small danger" data-act="remove" data-beat="${esc(b.id)}" title="Delete (⌫); undo brings it back">Delete</button>
      <button class="st-btn small" data-act="askScene" title="Pin this scene as the agent's scope and write to it">Ask the agent</button></div>
    ${errs.length ? `<div class="st-alert bad" role="alert">${errs.map(esc).join('<br>')}</div>` : ''}
    ${b.placeholder ? `<div class="st-alert warn">Placeholder: ${esc(b.placeholder)} — renders as a labelled slate in rough cuts. <button class="st-link" data-act="clear" data-scope="beat" data-beat="${esc(b.id)}" data-path="placeholder">Mark designed</button></div>` : ''}</div>`;
  const sel = S.sel.element && elementAt(b, S.sel.element);
  return head
    + (sel ? `<div class="st-addrow"><button class="st-btn small" data-act="askLayer">Ask the agent about this layer</button></div>${elementEditor(b, S.sel.element, sel)}` : '')
    + section('content', 'Content', contentFields(b, meta))
    + section('layers', 'Layers', layersPanel(b), { count: layerCount(b) || undefined })
    + section('narration', 'Narration', narrationFields(b, n, wb))
    + section('timing', 'Timing and motion', timingFields(b, wb))
    + section('look', 'Look', lookFields(b), { open: false })
    + section('media', 'Media', mediaFields(b), { open: !!b.plate })
    + section('raw', 'Scene source', `<pre class="st-json">${esc(JSON.stringify(b, null, 2))}</pre><p class="st-hint-text">Exactly what <code>storyboard.json</code> holds for this scene. Anything without a field above is still saved and rendered as written.</p>`, { open: false });
}

const LONG = new Set(['text', 'support', 'context', 'caption', 'explanation', 'quote', 'detail', 'description', 'result', 'verdict', 'action']);
const LAYER_KEYS = new Set(['elements', 'actors', 'links', 'events', 'code', 'under', 'over', 'ground', 'world', 'plates']);
const ENUM_PROPS = { align: ['left', 'center'], emphasisStyle: ['accent', 'serif'], anchor: ['start', 'middle', 'end'], fit: ['cover', 'contain'] };
function propOptions(key, desc) {
  if (ENUM_PROPS[key]) return ENUM_PROPS[key];
  const m = /^([a-z0-9-]+(?:\|[a-z0-9-]+)+)$/i.exec(String(desc).trim());
  return m ? m[1].split('|') : null;
}
function contentFields(b, meta) {
  const props = b.props ?? {}, known = meta?.props ?? {};
  const isDrawn = ['canvas', 'stage'].includes(b.block);
  const rank = k => ['title', 'text', 'kicker', 'support', 'label', 'value'].includes(k) ? ['title', 'text', 'kicker', 'support', 'label', 'value'].indexOf(k) : ['emphasis', 'emphasisStyle', 'align', 'land', 'source'].includes(k) ? 50 + ['emphasis', 'emphasisStyle', 'align', 'land', 'source'].indexOf(k) : 10;
  const keys = Object.keys(known).filter(k => props[k] !== undefined && !(isDrawn && LAYER_KEYS.has(k))).sort((a, b) => rank(a) - rank(b));
  const extra = Object.keys(props).filter(k => !(k in known) && !(isDrawn && LAYER_KEYS.has(k)));
  const html = keys.map(k => propField(b, k, props[k], known[k])).join('')
    + extra.map(k => field({ path: `props.${k}`, label: `${k} (not in the catalog)`, type: 'json', value: props[k], readonly: true, hint: 'The engine will refuse this property; remove it in storyboard.json.' })).join('');
  const missing = Object.keys(known).filter(k => props[k] === undefined && !(isDrawn && LAYER_KEYS.has(k)));
  const add = missing.length ? `<div class="st-addprop"><select class="st-select" aria-label="Add a property">${missing.map(k => `<option value="${esc(k)}">${esc(k)} — ${esc(String(known[k]).slice(0, 60))}</option>`).join('')}</select><button class="st-btn small" data-act="addprop">Add</button></div>` : '';
  return (html || `<p class="st-muted">${meta ? 'No content properties set.' : `“${esc(b.block)}” is not a catalog block.`}</p>`) + add;
}
function propField(b, k, v, desc = '') {
  const path = `props.${k}`, label = k.split('.').at(-1).replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()), hint = '', tip = desc;
  const opts = propOptions(k, desc);
  if (opts && (v == null || typeof v === 'string')) return field({ path, label, type: 'enum', value: v, options: enumOf(opts), tip, clear: true });
  if (typeof v === 'boolean') return field({ path, label, type: 'bool', value: v, tip });
  if (typeof v === 'number') return field({ path, label, type: 'number', value: v, tip, clear: true });
  if (typeof v === 'string') return field({ path, label, type: LONG.has(k) || v.length > 60 ? 'textarea' : 'text', rows: v.length > 120 ? 4 : 2, value: v, tip, clear: true });
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) return field({ path, label, type: 'list', value: v, tip, hint: 'One per line.', rows: Math.min(6, v.length + 1), clear: true });
  if (Array.isArray(v) && v.every(x => typeof x === 'number')) return field({ path, label, type: 'numbers', value: v, tip, hint: 'Separate with commas.', clear: true });
  if (Array.isArray(v) && v.length && v.every(x => x && typeof x === 'object' && !Array.isArray(x) && Object.values(x).every(y => y == null || typeof y !== 'object'))) return tableField(b, path, label, v, esc(tip));
  // Objects (a chart's data, a figure's spec) open as fields, one level at a time; deeper values stay JSON.
  if (v && typeof v === 'object' && !Array.isArray(v) && k.split('.').length < 4)
    return `<fieldset class="st-group"><legend>${esc(label)} <button class="st-link" data-act="clear" data-scope="beat" data-beat="${esc(b.id)}" data-path="${esc(path)}">Remove</button></legend>${Object.entries(v).map(([sk, sv]) => propField(b, `${k}.${sk}`, sv, '')).join('')}${tip ? `<p class="st-hint-text">${esc(tip)}</p>` : ''}</fieldset>`;
  return field({ path, label, type: 'json', value: v, rows: 6, tip, hint: 'Edited as JSON.', clear: true });
}
/** Rows of objects (chart data, KPI items, sources): a small table with add and remove. */
function tableField(b, path, label, rows, hint, scope = 'beat') {
  const cols = [...new Set(rows.flatMap(r => Object.keys(r)))];
  const numeric = c => rows.every(r => r[c] == null || typeof r[c] === 'number');
  const beatAttr = scope === 'beat' ? `data-beat="${esc(b.id)}"` : '';
  const err = rows.map((_, i) => cols.map(c => S.fieldErrors[fieldKey(scope, scope === 'beat' ? b.id : undefined, `${path}.${i}.${c}`)]).filter(Boolean)).flat();
  return `<div class="st-field" data-key="${esc(`t:${path}`)}"><div class="st-field-head"><span class="st-label">${esc(label)}</span></div>
    <div class="st-table-wrap"><table class="st-table"><thead><tr>${cols.map(c => `<th scope="col">${esc(c)}</th>`).join('')}<th><span class="sr">Row</span></th></tr></thead><tbody>
    ${rows.map((r, i) => `<tr data-key="r${i}">${cols.map(c => `<td><input data-scope="${scope}" ${beatAttr} data-path="${esc(`${path}.${i}.${c}`)}" data-type="${numeric(c) ? 'number' : 'text'}" type="${numeric(c) ? 'number' : 'text'}" step="any" value="${esc(r[c] ?? '')}" aria-label="${esc(`${c}, row ${i + 1}`)}"></td>`).join('')}
      <td><button class="st-icon small" data-act="row" data-op="remove" data-scope="${scope}" ${beatAttr} data-path="${esc(path)}" data-i="${i}" title="Remove row" aria-label="Remove row ${i + 1}">×</button></td></tr>`).join('')}</tbody></table></div>
    <button class="st-link" data-act="row" data-op="add" data-scope="${scope}" ${beatAttr} data-path="${esc(path)}">+ Add row</button>${hint ? `<p class="st-hint-text">${hint}</p>` : ''}${err.map(e => `<p class="st-err" role="alert">${esc(e)}</p>`).join('')}</div>`;
}
function editRow(d) {
  const owner = d.scope === 'film' ? S.st.storyboard : beatById(d.beat), rows = getPath(owner, d.path) ?? [];
  if (d.op === 'remove') return cmd({ command: 'set', target: d.scope, beat: d.beat, path: `${d.path}.${d.i}`, value: null }).catch(() => {});
  const last = rows.at(-1) ?? {}, next = Object.fromEntries(Object.entries(last).map(([k, v]) => [k, typeof v === 'number' ? v : k === 'id' ? `${v}-${rows.length + 1}` : v]));
  cmd({ command: 'set', target: d.scope, beat: d.beat, path: `${d.path}.${rows.length}`, value: next }).catch(() => {});
}
function addProp(k) {
  const b = beatById(S.sel.beat), meta = S.schema.blocks.find(x => x.name === b.block);
  const example = meta?.example?.[k], desc = String(meta?.props?.[k] ?? '');
  const value = example ?? (propOptions(k, desc)?.[0]) ?? (/number|seconds|value|0–|\d/i.test(desc) && !/text|word|label/i.test(desc) ? 0 : '');
  if (value === '') { S.fieldErrors[fieldKey('beat', b.id, `props.${k}`)] = null; }
  cmd({ command: 'set', target: 'beat', beat: b.id, path: `props.${k}`, value: value === '' ? (k === 'emphasis' ? [] : ' ') : value }).catch(() => {});
}

// ------------------------------------------------------------------ layers: canvas elements, stage actors, art

function layerLists(b) {
  const out = [];
  const add = (path, list, label) => Array.isArray(list) && out.push({ path, list, label });
  if (b.block === 'canvas') add('props.elements', b.props?.elements, 'Canvas');
  if (b.block === 'stage') { add('props.actors', b.props?.actors, 'Actors'); add('props.elements', b.props?.elements, 'Stage elements'); add('props.under', b.props?.under, 'Under'); add('props.over', b.props?.over, 'Over'); }
  add('art.under', b.art?.under, 'Art under the block'); add('art.over', b.art?.over, 'Art over the block');
  return out;
}
const layerCount = b => layerLists(b).reduce((n, l) => n + l.list.length, 0);
const elLabel = el => el.text ?? el.label ?? el.id ?? el.icon ?? el.shape ?? `${el.type ?? 'element'}${el.x != null ? ` at ${Math.round(el.x)}, ${Math.round(el.y ?? 0)}` : el.cx != null ? ` at ${Math.round(el.cx)}, ${Math.round(el.cy ?? 0)}` : ''}${typeof el.fill === 'string' && el.fill !== 'none' ? ` · ${el.fill}` : typeof el.stroke === 'string' ? ` · ${el.stroke} line` : ''}`;
function layersPanel(b) {
  const lists = layerLists(b);
  const derived = ['kpi', 'plot', 'chart', 'bars', 'multiples', 'distribution', 'stat', 'teaching', 'diagram'].filter(k => b.props?.[k] != null);
  const add = b.block === 'canvas' || b.art ? `<div class="st-addrow"><span class="st-muted">Add</span>${['text', 'rect', 'circle', 'line'].map(t => `<button class="st-btn small" data-act="addel" data-type="${t}" data-list="${b.block === 'canvas' ? 'props.elements' : b.art?.over ? 'art.over' : 'art.under'}">${t}</button>`).join('')}</div>` : '';
  if (!lists.length && !derived.length) return b.block === 'canvas' ? add : '';
  const q = (S.layerFilter ?? '').toLowerCase(), many = layerCount(b) > 12;
  const match = el => !q || JSON.stringify(el).toLowerCase().includes(q);
  return (many ? `<input class="st-filter" type="search" placeholder="Filter layers (text, type, colour…)" aria-label="Filter layers" value="${esc(S.layerFilter ?? '')}" data-oninput="layerFilter">` : '')
    + lists.map(({ path, list, label }) => `<div class="st-layers"><div class="st-layers-h">${esc(label)} <span class="st-muted">${list.length}</span></div>
      <ol class="st-layer-list">${list.map((el, i) => { const p = `${path}.${i}`; if (!match(el)) return ''; return `<li data-key="${esc(p)}"><button class="st-layer ${S.sel.element === p ? 'on' : ''}" data-act="element" data-element="${esc(p)}" data-beat="${esc(b.id)}" aria-pressed="${S.sel.element === p}">
        <span class="st-layer-type">${esc(el.type ?? el.kind ?? '')}</span><span class="st-layer-name">${esc(String(elLabel(el)).slice(0, 48))}</span>${el.at != null ? `<span class="st-muted">${esc(typeof el.at === 'number' ? `${el.at}s` : String(el.say ?? el.at))}</span>` : el.say ? `<span class="st-muted">“${esc(String(el.say).slice(0, 16))}”</span>` : ''}${el.unfinished ? '<span class="st-chip warn">unfinished</span>' : ''}</button></li>`; }).join('')}</ol></div>`).join('')
    + (derived.length ? `<p class="st-hint-text">Drawn from data (${derived.map(esc).join(', ')}): edit the data in Content and the picture follows.</p>` : '')
    + add;
}
const COMMON_EL = ['id', 'at', 'say', 'dur', 'enter', 'exit', 'exitSay', 'fill', 'stroke', 'width', 'opacity', 'unfinished'];
function elementEditor(b, p, el) {
  const geo = S.schema.canvas.geometry[el.type] ?? [], C = S.schema.canvas;
  const keys = [...new Set([...geo, ...COMMON_EL])];
  const present = Object.keys(el).filter(k => k !== 'type'), missing = keys.filter(k => el[k] === undefined);
  const f = k => {
    const path = `${p}.${k}`, v = el[k], label = k;
    if (['fill', 'stroke'].includes(k) && (v == null || typeof v === 'string')) return field({ path, label, type: 'text', value: v, list: 'st-colors', hint: 'A palette token (accent, ink, muted…) or #RRGGBB', clear: true });
    if (k === 'enter' && (v == null || typeof v === 'string')) return field({ path, label, type: 'enum', value: v, options: enumOf(C.enters), clear: true });
    if (k === 'exit' && (v == null || typeof v === 'string')) return field({ path, label, type: 'enum', value: v, options: enumOf(C.exits), clear: true });
    if (k === 'font' && (v == null || typeof v === 'string')) return field({ path, label, type: 'enum', value: v, options: enumOf(C.fonts), clear: true });
    if (k === 'anchor') return field({ path, label, type: 'enum', value: v, options: enumOf(['start', 'middle', 'end']), clear: true });
    if (k === 'opacity' && (v == null || typeof v === 'number')) return field({ path, label, type: 'range', min: 0, max: 1, step: 0.05, value: v, clear: true });
    if (typeof v === 'boolean') return field({ path, label, type: 'bool', value: v });
    if (typeof v === 'number') return field({ path, label, type: 'number', value: v, clear: true });
    if (typeof v === 'string') return field({ path, label, type: k === 'text' || v.length > 50 ? 'textarea' : 'text', rows: 2, value: v, clear: k !== 'text' });
    return field({ path, label, type: 'json', value: v, rows: 4, clear: true });
  };
  return `<div class="st-element" data-key="el-${esc(p)}"><div class="st-element-h"><b>${esc(el.type ?? 'element')}</b> <span class="st-muted">${esc(String(elLabel(el)).slice(0, 40))}</span>
      <span class="st-spacer"></span><button class="st-icon small" data-act="elmove" data-element="${esc(p)}" data-dir="-1" title="Draw earlier (behind)" aria-label="Move layer back">↓</button><button class="st-icon small" data-act="elmove" data-element="${esc(p)}" data-dir="1" title="Draw later (in front)" aria-label="Move layer forward">↑</button>
      <button class="st-icon small" data-act="elcopy" data-element="${esc(p)}" title="Duplicate element" aria-label="Duplicate element">⧉</button><button class="st-icon small" data-act="elremove" data-element="${esc(p)}" title="Remove element" aria-label="Remove element">×</button><button class="st-icon small" data-act="element" data-element="" title="Back to the scene" aria-label="Close element">✓</button></div>
    ${present.map(f).join('')}
    ${missing.length ? `<div class="st-addprop"><select class="st-select" aria-label="Add an element setting" id="st-el-add">${missing.map(k => `<option>${esc(k)}</option>`).join('')}</select><button class="st-btn small" data-act="eladd" data-element="${esc(p)}">Add</button></div>` : ''}
    <datalist id="st-colors">${C.colors.map(c => `<option value="${esc(c)}">`).join('')}</datalist></div>`;
}
ACTIONS.eladd = el => {
  const k = document.getElementById('st-el-add')?.value; if (!k) return;
  const b = beatById(S.sel.beat), C = S.schema.canvas;
  const value = { at: 0, dur: 0.6, opacity: 1, width: 2, enter: C.enters[0], exit: 'fade', fill: 'accent', stroke: 'ink', say: '', id: `el${Date.now() % 1e5}`, unfinished: true, size: 48, anchor: 'start', font: 'text', r: 12, text: 'Text' }[k] ?? 0;
  cmd({ command: 'set', target: 'beat', beat: b.id, path: `${el.dataset.element}.${k}`, value }).catch(() => {});
};
function listAt(p) { const parts = p.split('.'), i = Number(parts.pop()); return { listPath: parts.join('.'), i }; }
function moveElement(p, dir) {
  const b = beatById(S.sel.beat), { listPath, i } = listAt(p), list = getPath(b, listPath); const j = i + dir;
  if (!list || j < 0 || j >= list.length) return;
  const next = [...list]; [next[i], next[j]] = [next[j], next[i]];
  cmd({ command: 'set', target: 'beat', beat: b.id, path: listPath, value: next, label: `Reorder ${elLabel(list[i])}` }).then(() => { S.sel.element = `${listPath}.${j}`; invalidate(); }).catch(() => {});
}
function removeElement(p) { const b = beatById(S.sel.beat); S.sel.element = null; cmd({ command: 'set', target: 'beat', beat: b.id, path: p, value: null }).catch(() => {}); }
function copyElement(p) {
  const b = beatById(S.sel.beat), { listPath } = listAt(p), list = getPath(b, listPath), el = structuredClone(elementAt(b, p));
  if (el.id) el.id = `${el.id}-copy`;
  for (const k of ['x', 'cx', 'x1', 'x2']) if (typeof el[k] === 'number') el[k] += 24;
  for (const k of ['y', 'cy', 'y1', 'y2']) if (typeof el[k] === 'number') el[k] += 24;
  cmd({ command: 'set', target: 'beat', beat: b.id, path: `${listPath}.${list.length}`, value: el }).then(() => { S.sel.element = `${listPath}.${list.length}`; invalidate(); }).catch(() => {});
}
function addElement(type, listPath) {
  const b = beatById(S.sel.beat), list = getPath(b, listPath) ?? [], W = S.st.timing?.width ?? 1920, H = S.st.timing?.height ?? 1080;
  const el = { text: { type: 'text', text: 'New words', x: W * 0.1, y: H * 0.5, size: 64, fill: 'ink', at: 0.3 }, rect: { type: 'rect', x: W * 0.35, y: H * 0.35, w: W * 0.3, h: H * 0.3, r: 18, fill: 'none', stroke: 'accent', width: 3, at: 0.3 },
    circle: { type: 'circle', cx: W / 2, cy: H / 2, r: Math.min(W, H) * 0.12, fill: 'accent', at: 0.3 }, line: { type: 'line', x1: W * 0.25, y1: H / 2, x2: W * 0.75, y2: H / 2, stroke: 'accent', width: 4, at: 0.3 } }[type];
  if (!el) return;
  el.x = el.x && Math.round(el.x); el.y = el.y && Math.round(el.y);
  for (const k of Object.keys(el)) if (el[k] === undefined) delete el[k];
  cmd({ command: 'set', target: 'beat', beat: b.id, path: `${listPath}.${list.length}`, value: el, label: `Add ${type} to ${sceneName(b)}` }).then(() => { S.sel.element = `${listPath}.${list.length}`; invalidate(); }).catch(() => {});
}

// ------------------------------------------------------------------ narration, timing, look, media

function narrationFields(b, n, wb) {
  const kind = { recording: 'The source recording', imported: 'Imported audio', voice: 'Recorded voice take', script: 'Script (no audio yet)', none: 'Silent scene' }[n?.kind ?? 'none'];
  const vo = wb?.vo, timing = vo ? vo.wordTiming === 'measured' ? '<span class="st-chip ok">measured word timing</span>' : '<span class="st-chip warn">estimated timing</span>' : '';
  const head = `<div class="st-narr-head"><span class="st-chip">${esc(kind)}</span>${timing}${vo?.stale ? '<span class="st-chip warn">audio no longer matches the words</span>' : ''}</div>`;
  if (n?.kind === 'recording') return head + transcriptHTML(b, wb) + `<p class="st-hint-text">This narration <em>is</em> the recording: select words to cut them (rebuilt from the master, undoable exactly), split the scene before a word, or merge it with the next. Edits record your name.</p>`;
  if (n?.kind === 'imported') return head + `<blockquote class="st-quote">${esc(b.vo)}</blockquote><p class="st-hint-text">Imported with its own audio; editing the words here would no longer match what is heard. Re-import with <code>speech</code> to change it.</p>`;
  return head + field({ path: 'vo', label: 'Narration', type: 'textarea', rows: 4, value: b.vo, placeholder: 'What the voice says over this scene', clear: true,
    hint: n?.kind === 'voice' ? 'Changing the words re-records this take (its whole continuous take) the next time narration is made; the rough cut uses a free local draft voice.' : 'Free draft narration is made for rough cuts; paid voices are made only when you run them.' })
    + field({ path: 'chapter', label: 'Chapter', value: b.chapter, clear: true, placeholder: 'No chapter' })
    + field({ path: 'label', label: 'Frame label', value: b.label, clear: true, hint: 'Up to 40 characters; the film frame’s section label.' });
}
function transcriptHTML(b, wb) {
  const words = wb?.vo?.words ?? [], sel = S.sel.words?.beat === b.id ? S.sel.words : null;
  const inSel = k => sel && k >= Math.min(sel.a, sel.b) && k <= Math.max(sel.a, sel.b);
  const cuts = S.st.narration[b.id]?.cuts ?? [];
  return `<div class="st-transcript" role="group" aria-label="Transcript words: click to select, shift-click to extend">${words.map(w => `<button class="st-word ${inSel(w.k) ? 'on' : ''}" data-act="word" data-beat="${esc(b.id)}" data-k="${w.k}" data-t="${w.t0}" title="${timecode(w.t0, fpsOf())}">${esc(w.w)}</button>`).join(' ')}</div>
    <div class="st-addrow">${sel ? `<button class="st-btn small danger" data-act="cut">Cut ${plural(Math.abs(sel.b - sel.a) + 1, 'word')}</button><button class="st-btn small" data-act="split" ${Math.min(sel.a, sel.b) === 0 ? 'disabled title="Split before a word that is not the first"' : ''}>Split before “${esc(words[Math.min(sel.a, sel.b)]?.w ?? '')}”</button>` : '<span class="st-muted">Select words to cut or split.</span>'}
      <span class="st-spacer"></span><button class="st-btn small" data-act="merge" data-beat="${esc(b.id)}" ${beatsOf().at(-1) === b ? 'disabled' : ''} title="Merge with the next scene (both must play the recording)">Merge with next</button></div>
    ${cuts.length ? `<div class="st-cuts"><span class="st-muted">Cut from this scene:</span>${cuts.map(c => `<span class="st-chip" title="${c.seconds.toFixed(2)} s">${esc(c.id)} · “${esc(String(c.words).slice(0, 40))}”</span>`).join('')}</div>` : ''}`;
}
function pickWord(el, e) {
  const k = Number(el.dataset.k), beat = el.dataset.beat;
  if (e.shiftKey && S.sel.words?.beat === beat) S.sel.words = { ...S.sel.words, b: k };
  else S.sel.words = { beat, a: k, b: k };
  if (beat !== S.sel.beat) select(beat, { seek: false, words: S.sel.words });
  if (S.monitor.source === 'working' || !S.monitor.source) seekTo(Number(el.dataset.t));
  invalidate(['right', 'left', 'timeline']);
}
async function recordingEdit(command, beatId) {
  const session = S;
  const w = S.sel.words, beat = beatId ?? w?.beat ?? S.sel.beat;
  const base = command === 'recording.cut' ? { from: { beat, k: Math.min(w.a, w.b) }, to: { beat, k: Math.max(w.a, w.b) } } : command === 'recording.split' ? { k: Math.min(w.a, w.b) } : {};
  let plan = '';
  if (command === 'recording.cut') {
    try { const r = await call('/api/studio/command', { film: S.id, hash: S.st.hash, command, beat, ...base, by: S.name || 'preview', dryRun: true }); plan = `<p>Cut “${esc(r.plan.words)}” — ${r.plan.seconds.toFixed(2)} s of recording${r.plan.beats.some(x => x.deleted) ? '; a scene left without words goes with it' : ''}. Later scenes move earlier by the same amount. Undo puts back the exact audio.</p>`; }
    catch (e) { if (currentSession(session)) status(e.message, 'error'); return; }
  }
  if (!currentSession(session)) return;
  const title = { 'recording.cut': 'Cut from the recording', 'recording.split': 'Split this scene', 'recording.merge': 'Merge with the next scene' }[command];
  const detail = { 'recording.split': '<p>The scene splits in the pause before the selected word, on a frame boundary. The edit log keeps it; a merge joins them again.</p>', 'recording.merge': '<p>The next scene’s recording joins this one; its picture is dropped. The edit log keeps it; split again to separate them.</p>' }[command] ?? '';
  overlay(`<form class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="rec-t"><h2 id="rec-t">${title}</h2>${plan}${detail}
    <label class="st-field"><span>Your name (recorded with the edit)</span><input name="by" required value="${esc(S.name)}" autocomplete="name" autofocus></label>
    <div class="st-dialog-actions"><button type="button" class="st-btn" data-act="close">Cancel</button><button class="st-btn primary" data-act="do">${command === 'recording.cut' ? 'Cut' : command === 'recording.split' ? 'Split' : 'Merge'}</button></div></form>`, {
    do: a => {
      const by = a.form.by.value.trim(); if (!by) { a.form.by.focus(); return; }
      S.name = by; store.set('cf-name', by); closeOverlay();
      cmd({ command, beat, ...base, by }).then(() => { S.sel.words = null; invalidate(); }).catch(() => {});
    } });
}

function timingFields(b, wb) {
  const sch = S.schema.beat, auto = wb && b.duration == null ? `${wb.dur.toFixed(2)} s from ${b.vo ? 'narration' : 'the silent-scene default'}` : '';
  const m = b.motion ?? {};
  return field({ path: 'duration', label: 'Duration (seconds)', type: 'number', min: 0.1, max: 3600, step: 0.1, value: b.duration, placeholder: auto ? `Auto · ${auto}` : 'Auto', clear: true,
      hint: b.vo ? 'Leave empty to follow the narration. A set duration must not clip it; the engine refuses one that does.' : '' })
    + `<div class="st-grid2">${['lead', 'tail', 'hold'].map(k => field({ path: k, label: { lead: 'Lead-in', tail: 'Tail', hold: 'Hold' }[k], type: 'number', min: 0, step: 0.05, value: b[k], placeholder: 'Default', clear: true })).join('')}</div>`
    + field({ path: 'transition', label: 'Transition in', type: 'enum', value: b.transition, options: enumOf(schemaEnum(sch.transition) ?? S.schema.transitions), placeholder: `Film default (${S.st.storyboard.transition ?? 'fade'})`, clear: true })
    + field({ path: 'exit', label: 'Exit', type: 'enum', value: b.exit, options: enumOf(schemaEnum(sch.exit) ?? []), placeholder: 'auto (mirror the next entrance)', clear: true })
    + field({ path: 'motion.preset', label: 'Motion', type: 'enum', value: m.preset, options: enumOf(S.schema.motions), placeholder: `Film (${S.st.storyboard.motion?.preset ?? 'gentle'})`, clear: true })
    + field({ path: 'motion.intensity', label: 'Motion intensity', type: 'range', min: 0, max: 1, step: 0.05, value: m.intensity, clear: true })
    + field({ path: 'textMotion', label: 'Type reveal', type: 'enum', value: b.textMotion, options: enumOf(schemaEnum(sch.textMotion) ?? []), placeholder: 'Film default', clear: true })
    + field({ path: 'pace', label: 'Hold the picture for the voice', type: 'enum', value: b.pace, options: [{ value: 'hold', label: 'hold — keep a deliberate wait' }], placeholder: 'Pull forward (default)', clear: true });
}
function lookFields(b) {
  const sch = S.schema.beat;
  const camera = typeof b.camera === 'object' && b.camera ? field({ path: 'camera', label: 'Camera', type: 'json', value: b.camera, rows: 4, clear: true })
    : field({ path: 'camera', label: 'Camera move', type: 'enum', value: b.camera, options: enumOf(schemaEnum(sch.camera) ?? []), placeholder: 'Film default', clear: true });
  return field({ path: 'tone', label: 'Colour block', type: 'enum', value: b.tone, options: enumOf(schemaEnum(sch.tone) ?? []), placeholder: 'None', clear: true, hint: esc(sch.tone?.description ?? '') })
    + field({ path: 'type', label: 'Type voice', type: 'enum', value: b.type, options: S.schema.types.map(t => ({ value: t.id, label: t.title ?? t.id })), placeholder: 'Film type voice', clear: true })
    + field({ path: 'heading', label: 'Title position', type: 'enum', value: b.heading, options: enumOf(schemaEnum(sch.heading) ?? []), placeholder: 'Film default', clear: true })
    + camera
    + field({ path: 'transitionColor', label: 'Transition colour', type: 'enum', value: b.transitionColor, options: enumOf(schemaEnum(sch.transitionColor) ?? []), placeholder: 'Default', clear: true })
    + (b.art?.sketch ? field({ path: 'art.opacity', label: `Background art (${b.art.sketch}) opacity`, type: 'range', min: 0, max: 1, step: 0.05, value: b.art.opacity, clear: true }) + `<button class="st-link" data-act="clear" data-scope="beat" data-beat="${esc(b.id)}" data-path="art">Remove background art</button>` : '');
}
function mediaFields(b) {
  const images = S.f.files.filter(x => ['image', 'video'].includes(x.type) && !/^(review|build)\//.test(x.name));
  const plate = b.plate ?? {}, sch = S.schema.beat.plate?.properties ?? {};
  const media = ['image', 'video', 'annotate'].includes(b.block);
  return (media ? field({ path: 'props.file', label: b.block === 'video' ? 'Clip' : 'Image', type: 'enum', value: b.props?.file, options: images.filter(x => (b.block === 'video') === (x.type === 'video')).map(x => ({ value: x.name, label: x.name })), placeholder: b.props?.asset ? `Asset ${b.props.asset}` : 'Choose a project file', clear: true }) : '')
    + field({ path: 'plate.file', label: 'Plate (picture behind the block)', type: 'enum', value: plate.file, options: images.map(x => ({ value: x.name, label: x.name })), placeholder: plate.asset ? `Asset ${plate.asset}` : 'No plate', clear: true, hint: 'Or drag a file from Assets onto the picture.' })
    + (b.plate ? field({ path: 'plate.side', label: 'Plate side', type: 'enum', value: plate.side, options: enumOf(sch.side?.enum ?? []), placeholder: 'full', clear: true })
      + field({ path: 'plate.treatment', label: 'Plate treatment', type: 'enum', value: plate.treatment, options: enumOf(sch.treatment?.enum ?? []), placeholder: 'none', clear: true }) : '');
}

// ------------------------------------------------------------------ the whole film

function filmInspector() {
  const sb = S.st.storyboard, sch = S.schema.film, F = o => field({ scope: 'film', ...o });
  const music = sb.music, tex = sb.texture, lens = sb.lens ?? {}, frame = sb.frame;
  const palette = typeof sb.theme === 'string' ? sb.theme : sb.theme?.base ?? 'paper';
  const swatches = `<div class="st-swatches" role="group" aria-label="Palette">${S.schema.palettes.map(p => `<button class="st-swatch ${p.id === palette ? 'on' : ''}" data-act="apply" data-kind="palette" data-value="${esc(p.id)}" aria-pressed="${p.id === palette}" title="${esc(`${p.id}: ${p.notes}`)}" style="--bg:${esc(p.colors.bg)};--ink:${esc(p.colors.ink)};--accent:${esc(p.colors.accent)};--accent2:${esc(p.colors.accent2 ?? p.colors.accent)}"><span></span><em>${esc(p.id)}</em></button>`).join('')}</div>`;
  return section('film-story', 'Film', F({ path: 'title', label: 'Title', value: sb.title }) + F({ path: 'logline', label: 'Logline', type: 'textarea', rows: 2, value: sb.logline, clear: true }) + F({ path: 'audience', label: 'Audience', value: sb.audience, clear: true }))
    + section('film-format', 'Format', F({ path: 'format.preset', label: 'Shape', type: 'enum', value: sb.format?.preset, options: Object.entries(S.schema.presets).map(([k, p]) => ({ value: k, label: `${k} · ${p.width}×${p.height}` })), placeholder: 'landscape', hint: 'Changing shape re-lays out every scene; check the stills.' })
      + F({ path: 'format.fps', label: 'Frame rate', type: 'enum', value: sb.format?.fps, options: enumOf(sch.format.properties.fps.enum), placeholder: '30' }))
    + section('film-look', 'Look', `<div class="st-field"><span class="st-label">Palette</span>${swatches}</div>`
      + F({ path: 'type', label: 'Type voice', type: 'enum', value: sb.type, options: S.schema.types.map(t => ({ value: t.id, label: `${t.title ?? t.id}` })), placeholder: 'inter', clear: true, hint: esc(S.schema.types.find(t => t.id === sb.type)?.when ?? '') })
      + F({ path: 'backdrop', label: 'Backdrop', type: 'enum', value: sb.backdrop, options: enumOf(S.schema.backdrops), placeholder: 'none', clear: true })
      + (tex && typeof tex === 'object' ? F({ path: 'texture.grain', label: 'Grain', type: 'range', min: 0, max: 1, step: 0.05, value: tex.grain, clear: true }) + F({ path: 'texture.vignette', label: 'Vignette', type: 'range', min: 0, max: 1, step: 0.05, value: tex.vignette, clear: true })
        : F({ path: 'texture', label: 'Texture', type: 'enum', value: tex, options: enumOf(schemaEnum(sch.texture) ?? []), placeholder: 'none', clear: true }))
      + F({ path: 'heading', label: 'Title position', type: 'enum', value: sb.heading, options: enumOf(schemaEnum(sch.heading) ?? []), placeholder: 'top', clear: true })
      + F({ path: 'chrome', label: 'Slide chrome (counters; keep off for films)', type: 'bool', value: sb.chrome }))
    + section('film-motion', 'Motion and cutting', F({ path: 'motion.preset', label: 'Motion preset', type: 'enum', value: sb.motion?.preset, options: enumOf(S.schema.motions), placeholder: 'gentle', clear: true })
      + F({ path: 'motion.intensity', label: 'Motion intensity', type: 'range', min: 0, max: 1, step: 0.05, value: sb.motion?.intensity, clear: true })
      + F({ path: 'transition', label: 'Default transition', type: 'enum', value: sb.transition, options: enumOf(schemaEnum(sch.transition) ?? S.schema.transitions), placeholder: 'fade', clear: true })
      + F({ path: 'textMotion', label: 'Type reveal', type: 'enum', value: sb.textMotion, options: enumOf(schemaEnum(sch.textMotion) ?? []), placeholder: 'lines', clear: true })
      + (typeof sb.camera === 'object' && sb.camera ? F({ path: 'camera', label: 'Camera', type: 'json', value: sb.camera, clear: true }) : F({ path: 'camera', label: 'Camera', type: 'enum', value: sb.camera, options: enumOf(schemaEnum(sch.camera) ?? []), placeholder: 'auto', clear: true, hint: '“none” makes a steady film.' })))
    + section('film-lens', 'Lens', F({ path: 'lens.letterbox', label: 'Letterbox (picture aspect)', type: 'number', min: 1.5, max: 3, step: 0.01, value: typeof lens.letterbox === 'number' ? lens.letterbox : null, placeholder: 'Off (2.39 is scope)', clear: true })
      + F({ path: 'lens.grade', label: 'Grade', type: 'enum', value: lens.grade, options: enumOf(S.schema.lens.grades), placeholder: 'none', clear: true })
      + S.schema.lens.keys.filter(k => !['letterbox', 'grade'].includes(k)).map(k => F({ path: `lens.${k}`, label: { gradeAmount: 'Grade amount', bloom: 'Bloom', aberration: 'Aberration', leak: 'Light leak', handheld: 'Handheld sway (0 for business)', blur: 'Motion blur' }[k] ?? k, type: 'range', min: 0, max: 1, step: 0.05, value: lens[k], clear: true })).join(''), { open: false })
    + section('film-frame', 'Frame and captions', F({ path: 'captions', label: 'Captions', type: 'enum', value: sb.captions, options: [{ value: 'auto', label: 'auto' }, { value: true, label: 'on' }, { value: 'pop', label: 'pop' }, { value: false, label: 'off' }], placeholder: 'auto', clear: true })
      + (frame && typeof frame === 'object' ? ['brand', 'left', 'right'].map(k => F({ path: `frame.${k}`, label: `Frame ${k}`, value: frame[k], clear: true })).join('') + F({ path: 'frame.label', label: 'Section label', type: 'bool', value: frame.label !== false }) + F({ path: 'frame.progress', label: 'Progress rail', type: 'bool', value: frame.progress !== false })
        : F({ path: 'frame', label: 'Editorial frame', type: 'bool', value: !!frame })), { open: false })
    + section('film-sound', 'Sound', (music === false ? `<p class="st-muted">No music. <button class="st-link" data-act="setv" data-scope="film" data-path="music" data-value='{}'>Add a music bed</button> (made with <code>music DIR --draft</code> for free, or Lyria when you choose).</p>`
        : F({ path: 'music.volume', label: 'Music level', type: 'range', min: 0, max: 1, step: 0.01, value: music?.volume, clear: true, hint: `Default ${S.schema.defaults.music.volume}` }) + F({ path: 'music.duck', label: 'Duck under the voice', type: 'bool', value: music?.duck ?? true }) + `<button class="st-link" data-act="setv" data-scope="film" data-path="music" data-value="false">No music</button>`)
      + F({ path: 'sfx', label: 'Sound effects', type: 'enum', value: sb.sfx, options: enumOf(['off', 'subtle', 'normal', 'punchy']), placeholder: 'off', clear: true })
      + F({ path: 'mix.loudness', label: 'Loudness (LUFS)', type: 'number', min: -30, max: -8, step: 0.5, value: sb.mix?.loudness, placeholder: String(S.schema.defaults.mix.loudness), clear: true })
      + F({ path: 'voice.voice', label: 'Voice', value: sb.voice?.voice, placeholder: S.schema.defaults.voice.voice, clear: true, hint: 'Used when narration is generated (paid); rough cuts use a free local draft voice.' })
      + F({ path: 'voice.style', label: 'Voice style', value: sb.voice?.style, clear: true }), { open: false })
    + section('film-sources', 'Sources', tableField(null, 'sources', 'Sources', (sb.sources ?? []).map(s => typeof s === 'string' ? { title: s } : s), 'Every displayed number cites one of these, visibly.', 'film'), { open: false })
    + section('film-treatments', 'Treatments', `<p class="st-hint-text">A treatment sets the film’s look, motion, voice style and scene defaults in one undoable step.</p><div class="st-list">${S.schema.treatments.map(t => `<div class="st-li"><div><b>${esc(t.title ?? t.id)}</b>${sb.treatment === t.id ? ' <span class="st-chip ok">applied</span>' : ''}<p class="st-muted">${esc(t.when ?? '')}</p></div><button class="st-btn small" data-act="treatment" data-id="${esc(t.id)}">Apply</button></div>`).join('')}</div>`, { open: false });
}

ACTIONS.layerFilter = el => { S.layerFilter = el.value; invalidate(['right']); };
