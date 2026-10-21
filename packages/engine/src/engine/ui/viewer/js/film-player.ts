import type { Film, Version, Scene } from './00-boundary-films.js';

import { esc, clock } from './00-core.js';

import { sceneAt, notesColumn, timeIn } from './10-notes.js';
import type { Note, NotesColumn } from './10-notes.js';
import { whatsNew } from './35-boards.js';
import { byId } from './00-boundary.js';

import { browserState } from './state.js';
import { marksHTML, wireStrip } from './film-strip.js';
import { S, showTab } from './film-page.js';
import type { PictureView, PicturePins } from './film-model.js';
import { picturePins } from './film-pins.js';

export function player(
  f: Film,
  v: Version,
  send: (notes: Note[]) => void,
): NotesColumn {
  const T = v.seconds || 1,
    { width: W, height: H } = v.frame ?? { width: 1920, height: 1080 };
  byId('watch', HTMLElement).innerHTML = playerHTML(f, v, W, H);
  const video = byId('video', HTMLVideoElement),
    marks = byId('marks', HTMLElement);
  const seek = (t: number) => {
    video.currentTime = Math.max(0, Math.min(T - 0.01, t)) + 0.001;
  };
  const drawMarks = () => {
    marks.innerHTML = marksHTML(f, v, T);
  };
  const notes = notesColumn(byId('notes', HTMLElement), {
    f,
    v,
    send,
    placeholder: 'Leave a note…',
    anchor: () => ({
      version: v.id,
      at: Math.round(video.currentTime * 100) / 100,
    }),
    anchorLabel: () => `At ${clock(video.currentTime)}`,
    seek: (n) => {
      const t = timeIn(v, n);
      if (t != null) {
        video.pause();
        seek(t);
      }
    },
    changed: () => {
      drawMarks();
      pins.draw(true);
      S?.notesChanged?.();
    },
    onTyping: () => video.pause(),
  });
  const view: PictureView = {
    f,
    v,
    T,
    W,
    H,
    notes,
    seek,
    video,
    layer: byId('layer', HTMLElement),
    bigplay: byId('bigplay', HTMLButtonElement),
  };
  wireStrip(view);
  const pins = picturePins(view);
  if (S)
    S.drawMarks = () => {
      drawMarks();
      pins.draw(true);
    };
  wireTransport(view, pins);
  drawMarks();
  const stop = playhead(view, pins);
  browserState.stopPage = () => {
    stop();
    browserState.pageKeys = null;
  };
  return notes;
}

export function playerHTML(f: Film, v: Version, W: number, H: number): string {
  const latest = f.versions.at(-1);
  const top =
    latest && v !== latest
      ? `<div class="banner">You're watching version ${v.number}. <a href="#/film/${esc(f.id)}">Watch the latest (version ${latest.number})</a></div>`
      : whatsNew(f, v);
  return `
    <div class="banner" id="newversion" hidden></div>
    ${top}
    <div class="stage" id="stage" style="--ar:${W / H}">
      <video id="video" preload="auto" playsinline poster="${esc(v.poster ?? '')}" src="${esc(v.video)}"></video>
      <div class="layer" id="layer" title="Click to leave a note here"></div>
      <button class="bigplay" id="bigplay" aria-label="Play">▶</button>
    </div>
    <div class="controls"><button class="play" id="play" aria-label="Play (space)">▶</button><span class="time" id="time">0:00</span>
      <div class="strip" id="strip" aria-label="Drag to move through the film">${filmstrip(v)}<div class="marks" id="marks"></div><div class="head" id="head"></div><div class="hover" id="hover" hidden></div></div></div>
    <div class="nowline" id="nowline"></div>`;
}

// ---- transport
export function wireTransport(
  { video, bigplay, notes, seek }: PictureView,
  pins: PicturePins,
) {
  const play = byId('play', HTMLButtonElement);
  const toggle = () => {
    pins.close();
    if (video.paused) video.play();
    else video.pause();
  };
  play.onclick = toggle;
  bigplay.onclick = toggle;
  video.addEventListener('play', () => {
    play.textContent = '❚❚';
    bigplay.hidden = true;
  });
  video.addEventListener('pause', () => {
    play.textContent = '▶';
  });
  video.addEventListener('seeked', () => {
    if (video.currentTime > 0.05) bigplay.hidden = true;
  });
  browserState.pageKeys = {
    toggle,
    nudge: (s) => seek(video.currentTime + s),
    note: () => {
      video.pause();
      showTab('notes');
      notes.focus();
    },
  };
  if (S) S.time = () => video.currentTime;
}

export function sceneLine(s: Scene): string {
  if (s.placeholder)
    return ` · <span class="todo">still to design: ${esc(s.placeholder)}</span>`;
  return s.narration
    ? ` · <span class="muted">“${esc(s.narration)}”</span>`
    : '';
}

/** Follow the playhead every frame; returns what stops it. */
export function playhead(
  { v, T, video, notes }: PictureView,
  pins: PicturePins,
): () => void {
  const head = byId('head', HTMLElement),
    time = byId('time', HTMLElement),
    nowline = byId('nowline', HTMLElement);
  let last = -1,
    lastScene: Scene | null = null,
    raf = 0;
  const tick = () => {
    const t = video.currentTime;
    if (t !== last) {
      last = t;
      head.style.left = `${(t / T) * 100}%`;
      time.textContent = `${clock(t)} / ${clock(T)}`;
      pins.draw();
      notes.anchorMoved();
      const s = sceneAt(v, t);
      if (s !== lastScene) {
        lastScene = s;
        nowline.innerHTML = s
          ? `<b>Scene ${s.number} of ${v.scenes?.length ?? 0}</b> · ${esc(s.kind)}${sceneLine(s)}`
          : '';
      }
    }
    raf = requestAnimationFrame(tick);
  };
  tick();
  return () => cancelAnimationFrame(raf);
}

export function filmstrip(v: Version): string {
  const T = v.seconds || 1,
    scenes = v.scenes ?? [];
  if (!scenes.length)
    return '<div class="frames"><span class="seg plain" style="width:100%"></span></div>';
  return `<div class="frames">${scenes.map((s) => `<span class="seg ${s.placeholder ? 'todo' : ''}" style="width:${((s.end - s.start) / T) * 100}%;${s.thumb ? `background-image:url('${esc(s.thumb)}')` : ''}"></span>`).join('')}</div>`;
}
