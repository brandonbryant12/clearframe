import { logHTML } from './agent-log.js';
import { agentPost, onLogClick } from './agent-actions.js';
import { agentSettings } from './agent-settings.js';

import type { Job } from './00-boundary-agent.js';
import { S, LIVE_JOBS } from './30-film.js';

import { store, esc } from './00-core.js';
import { byIdOptional, find, hit } from './00-boundary.js';
import { browserState } from './state.js';
import { say } from './agent-outbox.js';
import { notify, refreshAgent } from './agent-runtime.js';
import type { AgentState } from './agent-model.js';

/** The pane: a status line, the conversation, and a composer that is never redrawn under your typing. */
export function agentPane(el: HTMLElement) {
  const session = S,
    a = session?.agent;
  if (!session || !a) return;
  el.innerHTML = `<div class="cstate" id="cstate" role="status"></div><div class="log" id="clog" aria-live="polite" aria-label="Conversation"></div>
    <form class="ccompose" id="ccompose" aria-label="Message the agent"><textarea id="cin" rows="2" placeholder="Ask the agent to change anything…" aria-label="Message">${esc(a.draft)}</textarea>
      <div class="crow"><span class="muted small" id="chint">↩ send · ⇧↩ new line</span><span class="grow"></span><button type="button" class="btn small danger" id="cstop" hidden>Stop</button><button type="submit" class="btn small primary" id="csend">Send</button></div></form>`;
  const input = find(el, '#cin', HTMLTextAreaElement),
    log = find(el, '#clog', HTMLElement);
  const send = () => {
    const t = input.value;
    input.value = '';
    a.draft = '';
    store.set(`cf-agent-draft:${session.id}`, '');
    say(t);
  };
  find(el, '#ccompose', HTMLFormElement).addEventListener('submit', (e) => {
    e.preventDefault();
    send();
  });
  input.addEventListener('input', () => {
    a.draft = input.value;
    store.set(`cf-agent-draft:${session.id}`, input.value);
  });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      send();
    }
  });
  find(el, '#cstop', HTMLButtonElement).onclick = () =>
    agentPost('/api/agent/interrupt', {}, () => notify('Stopping…'));
  log.addEventListener(
    'scroll',
    () => {
      a.scrolledUp = log.scrollHeight - log.scrollTop - log.clientHeight > 40;
    },
    { passive: true },
  );
  log.addEventListener('click', onLogClick);
  find(el, '#cstate', HTMLElement).addEventListener('click', (e) => {
    if (hit(e, '[data-act=settings]')) agentSettings();
  });
  const timer = setInterval(() => {
    refreshAgent();
    if (a.conv?.running) drawAgent();
  }, 1000);
  const stop = browserState.stopPage;
  browserState.stopPage = () => {
    clearInterval(timer);
    stop?.();
  };
  drawAgent();
}

export const renderWords = (job: Job, live: boolean) =>
  `Rendering the new cut${job.progress != null && live ? ` · ${Math.round(job.progress * 100)}%` : '…'}`;

export function agentStatus(
  a: AgentState,
  job: Job | undefined,
  waitingOnYou: number,
): string {
  const conv = a.conv;
  if (!conv) return a.error ? 'Can’t reach the agent' : 'Connecting…';
  if (conv.runtime?.state === 'error') return 'Needs attention';
  if (waitingOnYou) return 'Waiting for you';
  if (conv.running)
    return job ? renderWords(job, job.status === 'running') : 'Working…';
  return job ? renderWords(job, true) : 'Ready';
}

export function statusTone(
  a: AgentState,
  busy: boolean,
  waitingOnYou: number,
): string {
  if (busy) return 'busy';
  if (waitingOnYou) return 'ask';
  return a.conv?.runtime?.state === 'error' || a.error ? 'bad' : 'ok';
}

export function dotTone(
  a: AgentState,
  busy: boolean,
  waitingOnYou: number,
): string {
  if (waitingOnYou) return 'd-ask';
  if (busy) return 'd-busy';
  return a.unseen ? 'd-new' : '';
}

/** The status line, the tab's dot and the composer's buttons. */
export function drawAgentState(a: AgentState, jobs: readonly Job[]) {
  const conv = a.conv,
    job = jobs.find(
      (j) =>
        ['draft', 'final'].includes(j.kind) && LIVE_JOBS.includes(j.status),
    );
  const waitingOnYou =
      (conv?.permissions.length ?? 0) +
      (conv?.forms.length ?? 0) +
      (conv?.spend ?? []).filter((x) => x.state === 'pending').length,
    busy = !!conv?.running || !!job;
  const cs = byIdOptional('cstate', HTMLElement);
  if (cs)
    cs.innerHTML = `<i class="sdot s-${statusTone(a, busy, waitingOnYou)}"></i>${esc(agentStatus(a, job, waitingOnYou))}<span class="grow"></span><button class="link small muted" data-act="settings">Settings</button>`;
  const dot = byIdOptional('agentdot', HTMLElement);
  if (dot) dot.className = `dot ${dotTone(a, busy, waitingOnYou)}`;
  const stop = byIdOptional('cstop', HTMLButtonElement);
  if (stop) stop.hidden = !conv?.running;
  const sendBtn = byIdOptional('csend', HTMLButtonElement);
  if (sendBtn) sendBtn.textContent = conv?.running ? 'Queue' : 'Send';
}

export function drawAgent() {
  const a = S?.agent,
    log = byIdOptional('clog', HTMLElement);
  if (!S || !a || !log) return;
  drawAgentState(a, S.jobs);
  const html = logHTML(a, a.conv);
  if (html === browserState.lastLog && log.childElementCount) return;
  browserState.lastLog = html;
  log.innerHTML = html;
  if (!a.scrolledUp) log.scrollTop = log.scrollHeight;
}
