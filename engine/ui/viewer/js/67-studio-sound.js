// Sound tab: narration, music and the mix, on the engine's own generation paths. Free local drafts
// run at once; Google generation (Gemini TTS, Lyria) runs only after a person approves an amount that
// covers the current estimate, and the engine refuses anything costlier. A recording is never
// regenerated: it is edited by cutting words.

RIGHT_TABS.splice(1, 0, ['sound', 'Sound']);
const money = n => (n == null ? '—' : n === 0 ? '$0' : n < 0.01 ? `$${n.toFixed(4)}` : `$${n.toFixed(2)}`);
const TAKE_STATUS = { google: ['Google', 'ok'], 'google-changed': ['Google · words changed', 'warn'], draft: ['Free draft', ''], partial: ['Partly recorded', 'warn'], none: ['Not recorded', 'warn'] };

/**
 * Read the film's sound once per working copy: a response is labelled with the hash it was asked
 * for (never the hash that is current when it lands), one request at a time, and a failure is held
 * for that working copy until the person retries or the film changes.
 */
function loadSound({ retry = false } = {}) {
  const session = S; if (!session) return Promise.resolve();
  const hash = S.st.hash, f = S.soundFetch;
  if (f?.inflight) return f.inflight;
  if (!retry && f?.hash === hash && f.error) return Promise.resolve();
  const inflight = call(`/api/studio/sound?film=${encodeURIComponent(S.id)}`).then(r => {
    if (!currentSession(session)) return;
    S.sound = r; S.soundHash = hash; S.soundFetch = { hash };
  }, e => {
    if (!currentSession(session)) return;
    S.soundFetch = { hash, error: e.message };
  }).finally(() => { if (currentSession(session)) invalidate(['right']); });
  S.soundFetch = { hash, inflight };
  return inflight;
}

function soundPanel() {
  const f = S.soundFetch;
  if ((!S.sound || S.soundHash !== S.st.hash) && !f?.inflight && !(f?.hash === S.st.hash && f.error)) loadSound();
  if (f?.error && f.hash === S.st.hash) return `<div class="st-alert bad">Could not read the film’s sound: ${esc(f.error)}</div><button class="st-btn small" data-act="soundRetry">Try again</button>`;
  if (!S.sound) return '<p class="st-muted">Reading the film’s sound…</p>';
  const s = S.sound;
  const stale = S.soundHash !== S.st.hash ? '<p class="st-hint-text">Updating for your latest change…</p>' : '';
  const google = s.providers.speech.find(p => p.id === 'google'), running = activeJobs().filter(j => ['voice', 'music'].includes(j.kind));
  const head = `<div class="st-sound-head"><span class="st-chip ${google.ready ? 'ok' : 'warn'}">${google.ready ? 'Google sound available · paid, with your approval' : 'Google sound not set up'}</span><span class="st-chip">Free drafts always available</span></div>
    ${google.ready ? '' : `<p class="st-hint-text">${esc(google.needs)}</p>`}
    ${running.map(j => `<div class="st-alert"><i class="st-spinner small"></i> ${esc(j.label)} · ${esc(j.status)} <button class="st-link" data-act="cancel" data-job="${esc(j.id)}">Cancel</button></div>`).join('')}`;
  return stale + head + section('snd-voice', 'Narration', narrationSound(s, google)) + section('snd-music', 'Music', musicSound(s)) + section('snd-mix', 'Mix', mixSound(s), { open: true })
    + section('snd-cost', 'Cost and approvals', costSound(s), { open: false });
}

function narrationSound(s, google) {
  const n = s.narration;
  if (n.recorded) return '<p>This film’s narration is the source recording. Edit it by cutting words in the Script tab or the narration lane; it is never regenerated.</p>';
  if (!n.lines) return '<p class="st-muted">No narration yet. Write lines in the Script tab (or ask the agent).</p>';
  const voices = n.voices.map(v => ({ value: v.id, label: `${v.id} — ${v.character}` }));
  const changed = n.takes.filter(t => t.cost > 0);
  return `${field({ scope: 'film', path: 'voice.voice', label: 'Google voice', type: 'enum', value: n.voice, options: voices, hint: 'Casts the speaker (accent, age, timbre). Drafts use this computer’s voice.' })}
    ${field({ scope: 'film', path: 'voice.style', label: 'Delivery', value: n.style, placeholder: 'warm, curious, unhurried', hint: '2–6 words that describe a person talking; leave empty to test plain first.' })}
    <div class="st-takes">${n.takes.map(t => { const [label, tone] = TAKE_STATUS[t.status] ?? [t.status, '']; return `<details class="st-take" data-key="take-${esc(t.id)}"><summary><b>${esc(t.id)}</b> <span class="st-muted">${plural(t.beats.length, 'scene')} · ~${t.seconds}s</span> <span class="st-chip ${tone}">${label}</span>${t.cost ? ` <span class="st-muted">Google ≈ ${money(t.cost)}</span>` : ''}</summary>
      ${t.beats.map(b => `<div class="st-take-line"><button class="st-link" data-act="select" data-beat="${esc(b.id)}">${esc(sceneName(beatById(b.id)) || b.id)}</button><span class="st-muted">${b.made ? (b.made === 'gemini' ? 'Google' : b.made === 'local' ? 'draft' : b.made) : 'not recorded'}${b.measured ? ' · words measured' : ''}</span>${b.audio ? `<audio controls preload="none" src="${esc(b.audio)}?v=${esc(b.at ?? '')}"></audio>` : ''}</div>`).join('')}</details>`; }).join('')}</div>
    <div class="st-addrow"><button class="st-btn small" data-act="soundDraft" data-kind="voice" title="This computer’s voice, free. Keeps any Google take whose words are unchanged.">Record free draft voice</button>
      <button class="st-btn small primary" data-act="soundPaid" data-kind="voice" ${google.ready && changed.length ? '' : 'disabled'} title="${google.ready ? '' : esc(google.needs)}">${changed.length ? `Generate with Google… ${money(n.cost)}` : 'Google narration is current'}</button></div>
    <p class="st-hint-text">Google records ${n.takesMode === 'film' ? 'the whole narration as one continuous take' : `one take per ${n.takesMode}`}, so the voice stays consistent. Only takes whose words, voice, style or model changed are generated again; the rest are kept.</p>`;
}

function musicSound(s) {
  const m = s.music;
  if (m.off) return `<p class="st-muted">No music.</p><button class="st-btn small" data-act="setv" data-scope="film" data-path="music" data-value="{}">Add music</button>`;
  const google = s.providers.music.find(p => p.id === 'google'), models = google.models ?? [];
  return `${field({ scope: 'film', path: 'music.prompt', label: 'Direction', type: 'textarea', rows: 2, value: m.prompt, placeholder: 'calm, warm, sparse piano and soft pads; leave room for the voice', hint: 'Style and instruments. Sections follow the edit automatically (intro, body, outro, silences).' })}
    ${field({ scope: 'film', path: 'music.model', label: 'Google model', type: 'enum', value: m.model, options: models.map(x => ({ value: x.id, label: `${x.id} — ${money(x.price)} · ${x.note}` })) })}
    <div class="st-bed"><span>${m.made ? `<span class="st-chip ${m.made === 'local' ? '' : m.current ? 'ok' : 'warn'}">${m.made === 'local' ? 'Free draft bed' : m.made === 'lyria' ? (m.current ? 'Google bed · current' : 'Google bed · older direction') : esc(m.made)}</span>` : '<span class="st-chip warn">No bed yet</span>'} <span class="st-muted">${m.seconds ? `${m.seconds}s` : ''}</span></span>
      ${m.audio ? `<audio controls preload="none" src="${esc(m.audio)}?v=${esc(m.at ?? '')}"></audio>` : ''}</div>
    <div class="st-addrow"><button class="st-btn small" data-act="soundDraft" data-kind="music" title="A synthesized pad, free. Never replaces a Google bed.">Make free draft bed</button>
      <button class="st-btn small primary" data-act="soundPaid" data-kind="music" ${google.ready ? '' : 'disabled'} title="${google.ready ? '' : esc(google.needs)}">${m.made === 'lyria' && m.current ? 'Generate a new Google bed…' : `Generate with Google… ${money(m.cost)}`}</button></div>
    ${m.made === 'lyria' ? '<p class="st-hint-text">A new Google bed replaces the current one.</p>' : ''}`;
}

function mixSound(s) {
  const m = s.music;
  return `${m.off ? '' : field({ scope: 'film', path: 'music.volume', label: 'Music level', type: 'range', min: 0, max: 1, step: 0.01, value: m.volume, hint: 'Under the voice, about 0.15–0.3 reads well.' })
    + field({ scope: 'film', path: 'music.duck', label: 'Duck the music under the voice', type: 'bool', value: m.duck ?? true })
    + `<div class="st-row2">${field({ scope: 'film', path: 'music.fadeIn', label: 'Fade in (s)', type: 'number', value: m.fadeIn })}${field({ scope: 'film', path: 'music.fadeOut', label: 'Fade out (s)', type: 'number', value: m.fadeOut })}</div>`}
    ${field({ scope: 'film', path: 'sfx', label: 'Sound effects', type: 'enum', value: s.sfx, options: enumOf(['off', 'subtle', 'normal', 'punchy']) })}
    ${field({ scope: 'film', path: 'mix.loudness', label: 'Loudness (LUFS)', type: 'number', min: -30, max: -8, step: 0.5, value: S.st.storyboard.mix?.loudness, placeholder: String(S.schema.defaults.mix?.loudness ?? ''), clear: true, hint: 'The whole mix is normalised to this; streaming platforms expect about −14.' })}
    <div class="st-addrow"><button class="st-btn small" data-act="section" title="Render the selected scenes with the film’s mix (⇧⌘↩)">Hear the selected section</button>${m.off ? '' : '<button class="st-link" data-act="setv" data-scope="film" data-path="music" data-value="false">Turn music off</button>'}</div>`;
}

function costSound(s) {
  const rows = s.plan?.rows ?? [];
  return `${s.planError ? `<p class="st-alert warn">${esc(s.planError)}</p>` : ''}
    <table class="st-table compact"><thead><tr><th>What</th><th>State</th><th>Google cost</th></tr></thead><tbody>${rows.map(r => `<tr><td>${esc(r.kind)} · ${esc(r.id)}</td><td>${esc(r.status)}</td><td>${money(r.cost)}</td></tr>`).join('') || '<tr><td colspan="3" class="st-muted">Nothing to generate.</td></tr>'}</tbody></table>
    <p>Total to generate everything now: <b>${money(s.plan?.total)}</b></p>
    ${field({ scope: 'film', path: 'budget', label: 'Film budget ($)', type: 'number', value: s.budget, hint: 'A ceiling for any single generation run, in addition to each approval.', clear: true })}
    <h3 class="st-h3">Approved spending</h3>${s.spend?.length ? `<ul class="st-decisions">${s.spend.slice().reverse().map(x => `<li><b>${esc(x.kind === 'voice' ? 'Narration' : 'Music')}</b> approved up to ${money(x.approved)} (estimate ${money(x.estimate)}) by ${esc(x.by)} <span class="st-muted">${when(x.at)}${x.request ? ' · asked by the agent' : ''}</span></li>`).join('')}</ul>` : '<p class="st-muted">No paid generation yet.</p>'}`;
}

/** The approval dialog: what will be generated, by whom, for at most how much. */
function approveSound(kind, { request = null } = {}) {
  const s = S.sound, n = s.narration, m = s.music;
  // One approval, one intent: a retry or double-click sends the same id and gets the same job back.
  const intent = request?.id ?? `intent-${crypto.randomUUID()}`, basis = s.basis?.[kind];
  let paying = false;
  const est = kind === 'voice' ? n.cost : (m.made === 'lyria' && m.current ? (s.providers.music.find(p => p.id === 'google').models.find(x => x.id === m.model)?.price ?? 0.08) : m.cost);
  const cap = Math.ceil(est * 100 - 1e-9) / 100 || 0.01;
  const filmCap = Number.isFinite(S.st.storyboard.budget) ? S.st.storyboard.budget : null, blocked = filmCap != null && (filmCap <= 0 || est > filmCap);
  const what = kind === 'voice' ? `${plural(n.takes.filter(t => t.cost > 0).length, 'take')} with Gemini TTS (${esc(n.model)}, voice ${esc(n.voice)}${n.style ? `, “${esc(n.style)}”` : ''}), ~${n.takes.filter(t => t.cost > 0).reduce((a, t) => a + t.seconds, 0).toFixed(0)}s of speech`
    : `a ${m.seconds}s music bed with ${esc(m.model)}${m.prompt ? `: “${esc(m.prompt.slice(0, 80))}”` : ''}`;
  overlay(`<div class="st-dialog" role="dialog" aria-modal="true" aria-labelledby="pay-t"><h2 id="pay-t">Approve Google ${kind === 'voice' ? 'narration' : 'music'}</h2>
    <p>Generate ${what}.</p><p>Estimated cost <b>${money(est)}</b>. You approve up to <b>${money(cap)}</b>; the engine refuses to spend more.</p>
    ${filmCap == null ? '<p class="st-hint-text">No film budget is set (Sound → Cost and approvals); each run is limited by its approval alone.</p>' : blocked ? `<p class="st-alert warn">This film’s budget is ${money(filmCap)}${filmCap <= 0 ? ', so paid generation is off' : `, below this estimate`}. Raise it in Sound → Cost and approvals first.</p>` : `<p class="st-hint-text">Film budget ${money(filmCap)}: the engine’s limit is the smaller of it and your approval.</p>`}
    <p class="st-hint-text">It will generate exactly what is shown here. If the film or these settings change before it runs, nothing is generated or charged and you approve again.</p>
    ${request ? `<p class="st-muted">Asked by the agent: “${esc(request.reason)}”</p>` : ''}
    <div class="st-field"><label for="pay-by">Your name (recorded with the approval)</label><input id="pay-by" value="${esc(S.name ?? '')}" autocomplete="name"></div>
    <label class="st-check"><input type="checkbox" id="pay-ok"> I approve spending up to ${money(cap)} on Google for this film</label>
    <p class="st-hint-text" id="pay-msg" role="status"></p>
    <div class="st-dialog-actions"><button class="st-btn" data-act="close">Cancel</button><button class="st-btn primary" data-act="pay" ${blocked ? 'disabled' : ''}>Approve and generate</button></div></div>`, {
    pay: async btn => {
      const by = document.getElementById('pay-by').value.trim(), ok = document.getElementById('pay-ok').checked, msg = document.getElementById('pay-msg');
      if (paying) return;
      if (!by || !ok) { msg.textContent = 'Enter your name and tick the approval to continue.'; return; }
      S.name = by; store.set('cf-name', by);
      const session = S;
      paying = true; btn.disabled = true; btn.textContent = 'Starting…'; msg.textContent = '';
      try {
        if (request) await call('/api/agent/spend', { film: S.id, id: request.id, decision: 'approve', by, approve: cap, basis });
        else await call('/api/studio/sound', { film: S.id, kind, paid: true, by, approve: cap, intent, basis, force: kind === 'music' && m.made === 'lyria' && m.current });
        if (!currentSession(session)) return;
        closeOverlay(); status(`Google ${kind === 'voice' ? 'narration' : 'music'} queued (approved up to ${money(cap)})`); refreshJobs(); refreshAgent(true); loadSound({ retry: true });
      } catch (e) {
        if (!currentSession(session)) return;
        // A lost reply is safe to retry: the same approval id returns the job it already started.
        msg.textContent = e.status === 409 && /changed since/.test(e.message) ? `${e.message} Close this and open it again.` : `${e.message}${!e.status || e.status >= 500 ? ' (you can try again; it will not charge twice)' : ''}`;
        paying = false; btn.disabled = false; btn.textContent = 'Approve and generate';
      }
    },
  });
}

Object.assign(ACTIONS, {
  soundRetry: () => loadSound({ retry: true }),
  soundDraft: el => { const session = S; call('/api/studio/sound', { film: S.id, kind: el.dataset.kind, paid: false }).then(() => { if (currentSession(session)) { status(el.dataset.kind === 'voice' ? 'Free draft voice queued' : 'Free draft bed queued'); refreshJobs(); } }).catch(e => currentSession(session) && status(e.message, 'error')); },
  soundPaid: el => { if (!S.sound) return; approveSound(el.dataset.kind); },
  spendApprove: el => { const r = S.agent.conv?.spend?.find(x => x.id === el.dataset.id); if (!r) return; const go = () => S.sound && approveSound(r.kind, { request: r }); S.sound && S.soundHash === S.st.hash ? go() : loadSound({ retry: true }).then(go); },
  spendDecline: el => agentPost('/api/agent/spend', { id: el.dataset.id, decision: 'decline', by: S.name || 'the person' }, () => status('Declined.')),
});
