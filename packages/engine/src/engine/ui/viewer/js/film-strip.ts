import type { Film, Version } from './00-boundary-films.js';

import { esc, clock } from './00-core.js';

import { sceneAt, timeIn, notesOf } from './10-notes.js';

import { byId, hit } from './00-boundary.js';

import type { PictureView } from './film-model.js';
import { showTab } from './film-page.js';

// ---- the filmstrip: drag to scrub, notes as markers
export function wireStrip({ v, T, video, notes, seek }: PictureView) {
  const strip = byId('strip', HTMLElement),
    hover = byId('hover', HTMLElement);
  const tAt = (x: number) => {
    const r = strip.getBoundingClientRect();
    return Math.max(0, Math.min(T, ((x - r.left) / r.width) * T));
  };
  let dragging = false;
  strip.addEventListener('pointerdown', (e) => {
    const m = hit(e, '.mark');
    if (m) {
      video.pause();
      seek(Number(m.dataset.t));
      notes.highlight(m.dataset.id ?? '');
      showTab('notes');
      return;
    }
    dragging = true;
    strip.setPointerCapture(e.pointerId);
    seek(tAt(e.clientX));
  });
  strip.addEventListener('pointermove', (e) => {
    const t = tAt(e.clientX),
      s = sceneAt(v, t),
      r = strip.getBoundingClientRect();
    hover.hidden = false;
    hover.style.left = `${e.clientX - r.left}px`;
    hover.innerHTML = `${s?.thumb ? `<img src="${esc(s.thumb)}" alt="">` : ''}<span>${clock(t)}${s ? ` · Scene ${s.number}` : ''}</span>`;
    if (dragging) seek(t);
  });
  strip.addEventListener('pointerleave', () => {
    hover.hidden = true;
  });
  strip.addEventListener('pointerup', () => {
    dragging = false;
  });
}

export function marksHTML(f: Film, v: Version, T: number): string {
  return notesOf(f)
    .flatMap((n) => {
      const t = timeIn(v, n);
      if (n.state === 'done' || n.version !== v.id || t == null) return [];
      return [
        `<button class="mark ${n.state}" data-t="${t}" data-id="${esc(n.id)}" style="left:${(t / T) * 100}%" title="${esc(`${clock(t)} · ${n.text}`)}" aria-label="Note at ${clock(t)}"></button>`,
      ];
    })
    .join('');
}
