import { esc, clock } from './00-core.js';

import { sceneAt, timeIn, notesOf, spotOf } from './10-notes.js';

import { hit, find } from './00-boundary.js';

import type { PictureView, PicturePins } from './film-model.js';
import { showTab } from './film-page.js';

// ---- sticky notes on the picture
export function pinsHTML({ f, v, notes }: PictureView, t: number): string {
  const nums = notes.numbers();
  return notesOf(f)
    .flatMap((n) => {
      const spot = spotOf(n);
      if (
        !spot ||
        n.state === 'done' ||
        n.version !== v.id ||
        Math.abs((timeIn(v, n) ?? -99) - t) > 1.5
      )
        return [];
      return [
        `<button class="pin ${n.state}" data-id="${esc(n.id)}" style="left:${spot.x * 100}%;top:${spot.y * 100}%" title="${esc(n.text)}">${nums.get(n.id) ?? ''}</button>`,
      ];
    })
    .join('');
}

export const within = (
  [bx, by, bw, bh]: readonly number[],
  px: number,
  py: number,
) => px >= bx - 12 && px <= bx + bw + 12 && py >= by - 12 && py <= by + bh + 12;

/** The words on the picture under a spot at the current moment, when the scene knows them. */
export function wordsAt(
  { v, W, H, video }: PictureView,
  x: number,
  y: number,
): { on?: string; element?: string } {
  const t = video.currentTime,
    s = sceneAt(v, t);
  const found = (s?.elements ?? []).find(
    (e) =>
      e.box && e.at != null && e.at <= t + 0.05 && within(e.box, x * W, y * H),
  );
  if (!found) return {};
  return {
    on: String(found.text).slice(0, 80),
    ...(found.id ? { element: found.id } : {}),
  };
}

export function picturePins(view: PictureView): PicturePins {
  const { f, v, video, layer, notes, seek } = view;
  let composer: HTMLElement | null = null,
    shownAt = -1;
  const close = () => {
    composer?.remove();
    composer = null;
  };
  function draw(force = false) {
    const bucket = Math.round(video.currentTime * 4);
    if (!force && bucket === shownAt) return;
    shownAt = bucket;
    const html = pinsHTML(view, video.currentTime);
    layer.querySelectorAll('.pin').forEach((p) => p.remove());
    layer.insertAdjacentHTML('afterbegin', html);
  }
  function compose(x: number, y: number) {
    video.pause();
    view.bigplay.hidden = true;
    const under = wordsAt(view, x, y),
      keep = composer
        ? find(composer, 'textarea', HTMLTextAreaElement).value
        : '';
    composer?.remove();
    const box = document.createElement('div');
    composer = box;
    box.className = `pinnote${x > 0.62 ? ' flipx' : ''}${y > 0.55 ? ' flipy' : ''}`;
    box.style.left = `${x * 100}%`;
    box.style.top = `${y * 100}%`;
    box.innerHTML = `<span class="dot"></span><div class="pcard"><textarea rows="3" placeholder="What should change here?" aria-label="Note on this spot"></textarea>
      <div class="prow"><span class="muted">${clock(video.currentTime)}${under.on ? ` · on “${esc(under.on)}”` : ''}</span><span class="grow"></span><button class="btn small" data-x>Cancel</button><button class="btn small primary" data-add>Add</button></div></div>`;
    layer.append(box);
    const ta = find(box, 'textarea', HTMLTextAreaElement);
    ta.value = keep;
    ta.focus();
    const done = async () => {
      if (
        await notes.save({
          text: ta.value,
          spot: {
            x: Math.round(x * 1000) / 1000,
            y: Math.round(y * 1000) / 1000,
          },
          ...under,
        })
      ) {
        close();
        showTab('notes');
      }
    };
    find(box, '[data-add]', HTMLButtonElement).onclick = done;
    find(box, '[data-x]', HTMLButtonElement).onclick = close;
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
        e.preventDefault();
        done();
      }
      if (e.key === 'Escape') close();
    });
    box.addEventListener('click', (e) => e.stopPropagation());
  }
  // On click (not pointerdown), so the browser's own focus handling doesn't pull focus from the new sticky.
  layer.addEventListener('click', (e) => {
    const pin = hit(e, '.pin');
    if (pin) {
      video.pause();
      const n = notesOf(f).find((x) => x.id === pin.dataset.id);
      if (n) {
        seek(timeIn(v, n) ?? 0);
        notes.highlight(n.id);
        showTab('notes');
      }
      return;
    }
    if (hit(e, '.pinnote')) return;
    const r = layer.getBoundingClientRect();
    compose((e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height);
  });
  return { draw, close };
}
