import { decodeViewerData } from './00-boundary-films.js';
import type { Film } from './00-boundary-films.js';
import {
  byId,
  stored,
  text,
  RequestError,
  serverError,
  find,
  hit,
} from './00-boundary.js';
import { decodePing, decodeAgentStatus } from './00-boundary-agent.js';
// Shared page state and helpers, bundled from explicit ES module dependencies.
// The page does three things: show films, take sticky notes on them, and talk to an agent about them.
type Printable = string | number | boolean | null | undefined;

function parseJSON(source: string): unknown {
  return JSON.parse(source);
}
export const data = decodeViewerData(
  parseJSON(byId('data', HTMLScriptElement).textContent ?? 'null'),
  'page data',
);
export const app = byId('app', HTMLElement),
  sheetEl = byId('sheet', HTMLElement),
  toastEl = byId('toast', HTMLElement);
const ESCAPES = new Map([
  ['&', '&amp;'],
  ['<', '&lt;'],
  ['>', '&gt;'],
  ['"', '&quot;'],
  ["'", '&#39;'],
]);
export const esc = (s: Printable) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES.get(c) ?? c);
export const when = (iso: string | null | undefined) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '';
export const clock = (s: number | null | undefined) =>
  s == null
    ? ''
    : `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
export const plural = (n: number, w: string) =>
  `${n} ${w}${n === 1 ? '' : 's'}`;
/** This browser's storage. Reads come back unchecked: decode them with `stored`. */
export const store = {
  get: (k: string, d: unknown): unknown => {
    try {
      return parseJSON(localStorage.getItem(k) ?? 'null') ?? d;
    } catch {
      return d;
    }
  },
  set: (k: string, v: unknown): void => {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      /* storage full or blocked: the page keeps working */
    }
  },
};
export const myName = () => stored('cf-name', text, '');
// With `viewer --serve` notes save into each film and the agent is one message away; opened as a
// file, notes stay in this browser and travel to your agent as a message you copy.
export let server = false,
  agentOn = false;
export const serverReady: Promise<void> = location.protocol.startsWith('http')
  ? fetch('/api/ping')
      .then((r) => r.json())
      .then((j: unknown) => {
        server = decodePing(j, '/api/ping');
      })
      .then(() => fetch('/api/agent/status'))
      .then((r) => (r.ok ? r.json() : null))
      .then((j: unknown) => {
        agentOn = j !== null && decodeAgentStatus(j, '/api/agent/status');
      })
      .catch(() => undefined)
  : Promise.resolve();

/** GET (no body) or POST JSON to the local server; a refusal carries the server's message and status. The reply is unchecked: decode it. */
export async function call(url: string, body?: unknown): Promise<unknown> {
  const r = await fetch(
    url,
    body === undefined
      ? {}
      : {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
  );
  const j: unknown = await r.json().catch(() => ({}));
  if (!r.ok)
    throw new RequestError(
      serverError(j) ?? `Request failed (${r.status})`,
      r.status,
      j,
    );
  return j;
}

/** A centred sheet over the page; Escape or a click outside closes it. */
export function sheet(html: string): HTMLElement {
  sheetEl.innerHTML = `<div class="sheetcard" role="dialog" aria-modal="true">${html}</div>`;
  sheetEl.hidden = false;
  return find(sheetEl, '.sheetcard', HTMLElement);
}
export const closeSheet = () => {
  sheetEl.hidden = true;
  sheetEl.innerHTML = '';
};
sheetEl.addEventListener('click', (e) => {
  if (e.target === sheetEl || hit(e, '[data-close]')) closeSheet();
});

let toastTimer = 0;
export function toast(html: string, ms = 3000) {
  toastEl.innerHTML = html;
  toastEl.hidden = false;
  clearTimeout(toastTimer);
  if (ms)
    toastTimer = setTimeout(() => {
      toastEl.hidden = true;
    }, ms);
}

/** Your name, asked once: notes and decisions saved in a film record who made them. */
export function askName(
  why = 'Notes and decisions record who made them.',
): Promise<string | null> {
  if (myName()) return Promise.resolve(myName());
  return new Promise((resolve) => {
    const card =
      sheet(`<h2>What's your name?</h2><p class="muted">${esc(why)}</p><input class="field" id="name-in" autocomplete="name" placeholder="Your name">
      <div class="row"><button class="btn" data-close>Cancel</button><button class="btn primary" id="name-ok">Continue</button></div>`);
    const input = find(card, '#name-in', HTMLInputElement),
      ok = () => {
        const n = input.value.trim();
        if (!n) return input.focus();
        store.set('cf-name', n);
        closeSheet();
        resolve(n);
      };
    find(card, '#name-ok', HTMLButtonElement).onclick = ok;
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') ok();
    });
    input.focus();
    sheetEl.addEventListener('click', function gone() {
      if (sheetEl.hidden) {
        sheetEl.removeEventListener('click', gone);
        resolve(myName() || null);
      }
    });
  });
}

/** A small Markdown reader for briefs and the agent's replies: headings, bold, code, lists, paragraphs. */
export function markdown(md: string | null | undefined): string {
  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  const out: string[] = [];
  let list = false;
  for (const line of String(md ?? '').split('\n')) {
    const h = line.match(/^(#{1,3})\s+(.*)/),
      li = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)/);
    if (!li && list) {
      out.push('</ul>');
      list = false;
    }
    if (h)
      out.push(`<h${h[1].length + 2}>${inline(h[2])}</h${h[1].length + 2}>`);
    else if (li) {
      if (!list) {
        out.push('<ul>');
        list = true;
      }
      out.push(`<li>${inline(li[1])}</li>`);
    } else if (line.trim()) out.push(`<p>${inline(line)}</p>`);
  }
  if (list) out.push('</ul>');
  return out.join('');
}

export const header = (f?: Film) =>
  `<header class="bar">${f ? '<a class="home" href="#/">← Films</a>' : '<span class="brand">ClearFrame</span>'}${f ? `<span class="crumb">${esc(f.title)}</span><span class="pill s-${esc(f.stage?.id ?? '')}">${esc(f.stage?.label ?? '')}</span>` : ''}<span class="grow"></span><span id="barright"></span></header>`;
