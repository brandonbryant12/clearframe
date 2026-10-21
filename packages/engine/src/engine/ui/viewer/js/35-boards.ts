import type { Scene, Version, Film, Board } from './00-boundary-films.js';
import { notesOf, notesColumn } from './10-notes.js';
import type { Note, NotesColumn } from './10-notes.js';
import { plural, esc, clock, markdown, app } from './00-core.js';
import { S, showTab } from './30-film.js';
import { byId, find, hit } from './00-boundary.js';
import { browserState } from './state.js';
// What changed in a new cut, and the film before its first cut: the brief and a still per scene.

interface SceneChange {
  s: Scene;
  what: string;
}
const same = (
  a: readonly string[] | string | null | undefined,
  b: readonly string[] | string | null | undefined,
) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
/** How one scene differs from the same scene in the version before. */
function changesIn(p: Scene, s: Scene): string[] {
  const what: string[] = [];
  if (p.placeholder && !s.placeholder) what.push('now designed');
  else if (p.kind !== s.kind) what.push(`now a ${s.kind.toLowerCase()}`);
  if (!same(p.onScreen, s.onScreen))
    what.push(
      s.onScreen?.length
        ? `new words: “${s.onScreen.join(' · ')}”`
        : 'words removed',
    );
  if (!same(p.narration, s.narration)) what.push('narration changed');
  const d = s.end - s.start - (p.end - p.start);
  if (Math.abs(d) > 0.05)
    what.push(`${Math.abs(d).toFixed(1)}s ${d > 0 ? 'longer' : 'shorter'}`);
  return what;
}
/** What changed since the version before: scenes and words, and the notes the agent acted on. */
function sceneChanges(
  prev: Version,
  v: Version,
): { scenes: SceneChange[]; removed: Scene[] } {
  const before = new Map(
      (prev.scenes ?? []).map((s): [string, Scene] => [s.id, s]),
    ),
    out: SceneChange[] = [];
  for (const s of v.scenes ?? []) {
    const p = before.get(s.id);
    if (!p) {
      out.push({ s, what: 'new scene' });
      continue;
    }
    const what = changesIn(p, s);
    if (what.length) out.push({ s, what: what.join(', ') });
  }
  return {
    scenes: out,
    removed: (prev.scenes ?? []).filter(
      (p) => !(v.scenes ?? []).some((s) => s.id === p.id),
    ),
  };
}
export function whatsNew(f: Film, v: Version): string {
  const prev: Version | undefined = f.versions[f.versions.indexOf(v) - 1];
  if (!prev?.scenes?.length || !v.scenes?.length) return '';
  const { scenes, removed } = sceneChanges(prev, v),
    acted = notesOf(f).filter((n) => n.changedIn === v.id),
    check = acted.filter((n) => n.state === 'changed').length;
  if (!scenes.length && !removed.length && !acted.length) return '';
  const changed = scenes.length + removed.length;
  const summary = [
    changed && `${plural(changed, 'scene')} changed`,
    acted.length && `${plural(acted.length, 'note')} acted on`,
  ]
    .filter(Boolean)
    .join(' · ');
  return `<details class="banner news" ${check ? 'open' : ''}><summary><b>New in version ${v.number}</b> <span class="muted">${summary}${check ? ' — check them in your notes' : ''}</span></summary>
    <ul>${scenes.map((c) => `<li><a href="#/film/${esc(f.id)}?t=${c.s.start}">Scene ${c.s.number} · ${esc(c.s.kind)}</a> <span class="muted">${esc(c.what)}</span></li>`).join('')}
    ${removed.map((p) => `<li>${esc(p.kind)} <span class="muted">removed</span></li>`).join('')}</ul></details>`;
}

// ---------------------------------------------------------------- before the first cut

function boardHTML(f: Film, b: Board): string {
  const words = b.placeholder
    ? `<div class="todo">Still to design: ${esc(b.placeholder)}</div>`
    : (b.onScreen ?? [])
        .map((q) => `<div class="onscreen">${esc(q)}</div>`)
        .join('');
  return `<li class="scene ${b.placeholder ? 'todo' : ''}" data-scene="${esc(b.id)}" tabindex="0">
      <div class="still ${f.aspect}">${b.image ? `<img src="${esc(b.image)}" alt="" loading="lazy">` : `<span>${esc(b.kind)}</span>`}</div>
      <div class="words"><div><b>Scene ${b.number}</b> <span class="muted">${esc(b.kind)} · ${b.seconds}s</span></div>
        ${words}
        ${b.narration ? `<p class="vo">“${esc(b.narration)}”</p>` : ''}</div></li>`;
}
const noVideo = () =>
  S?.withAgent
    ? 'No video yet. The agent is making the first cut: follow along in the Agent tab.'
    : 'No video yet.';
function boardsHTML(f: Film): string {
  const list = f.boards ?? [],
    total = list.reduce((s, b) => s + b.seconds, 0),
    briefOpen = list.length ? '' : 'open';
  return `<div class="banner" id="newversion" hidden></div>
    ${
      list.length
        ? `<p class="lede">${plural(list.length, 'scene')}, about ${clock(total)} long. No video yet: these are stills of each scene. Click one to leave a note on it.</p>`
        : `<div class="empty big">${noVideo()}</div>`
    }
    ${f.brief ? `<details class="brief" ${briefOpen}><summary>The brief</summary><div class="md">${markdown(f.brief)}</div></details>` : ''}
    <ol class="scenes">${list.map((b) => boardHTML(f, b)).join('')}</ol>`;
}

export function boards(f: Film, send: (notes: Note[]) => void): NotesColumn {
  let scene: Board | null = null;
  byId('watch', HTMLElement).innerHTML = boardsHTML(f);
  const list = find(app, '.scenes', HTMLElement);
  const pick = (id: string | null | undefined) => {
    scene = f.boards?.find((b) => b.id === id) ?? null;
    list
      .querySelectorAll('.scene')
      .forEach((x) =>
        x.classList.toggle('picked', x.getAttribute('data-scene') === id),
      );
    notes.anchorMoved();
  };
  const notes = notesColumn(byId('notes', HTMLElement), {
    f,
    v: null,
    send,
    placeholder:
      f.kind === 'brief'
        ? 'Anything to add before the agent starts…'
        : 'Leave a note…',
    anchor: () => (scene ? { scene: scene.id } : {}),
    anchorLabel: () => (scene ? `Scene ${scene.number}` : 'Whole film'),
    seek: (n) => {
      if (n.scene) {
        pick(n.scene);
        list
          .querySelector(`[data-scene="${CSS.escape(n.scene)}"]`)
          ?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    },
    changed: () => S?.notesChanged?.(),
  });
  list.addEventListener('click', (e) => {
    const s = hit(e, '.scene');
    if (s) {
      pick(s.dataset.scene);
      showTab('notes');
      notes.focus();
    }
  });
  browserState.pageKeys = {
    note: () => {
      showTab('notes');
      notes.focus();
    },
  };
  browserState.stopPage = () => {
    browserState.pageKeys = null;
  };
  return notes;
}
