import type { ComposeMoments } from '../drawing/contracts.mjs';
import { cueWriter } from '../drawing/cues.mjs';

import type {
  CanvasElement,
  ElementFields,
} from '../../../film/contracts/canvas.mjs';

import { round, tall } from '../../../film/sketch-kit.mjs';
import type { BuildOptions } from './common.mjs';

export function composeFrame(
  w: number,
  h: number,
  { params = {} }: BuildOptions = {},
) {
  const { device = 'auto', expires = false, send = false } = params;

  // A desktop window in a 9:16 frame is cropped and tiny; a tall frame gets the phone unless asked.
  const phone = device === 'phone' || (device !== 'desktop' && h > w * 1.2);

  const T = tall(w, h);

  // Moments, a second and a half apart by default; EXPIRES and SEND only when drawn.
  const AT: ComposeMoments = { OLD: 1.2, NEW: 2.8, LINK: 4.4 };

  if (expires) AT.EXPIRES = 6.2;

  if (send) AT.SEND = round((expires ? 6.2 : AT.LINK) + 1.8);

  const cued = cueWriter(AT);

  const text = (
    t: string,
    x: number,
    y: number,
    size: number,
    font: string,
    fill: string,
    extra: ElementFields = {},
  ): CanvasElement =>
    ({
      type: 'text',
      text: t,
      x: round(x),
      y: round(y),
      size: round(size),
      font,
      fill,
      enter: 'none',
      ...extra,
    }) satisfies CanvasElement;

  // Room for the picture: clear of the frame edges and of the source line at the bottom.
  const room = frameRoom(w, h, T);

  const roomH = room.b - room.y;

  // Sizes at scale k (type and rows grow together, so a bigger frame reads bigger, never sparser).
  const sizes = (k: number) => {
    const s = phone
      ? {
          top: 56,
          bar: 104,
          row: 96,
          label: 30,
          value: 32,
          subject: 34,
          body: 32,
          chip: 100,
          chipFs: 30,
          tag: 64,
          tagFs: 28,
          tile: 120,
          tileFs: 30,
          icon: 40,
          toast: 88,
          toastFs: 32,
          pad: 40,
          gap: 30,
          foot: 40,
          tb: 20,
        }
      : {
          top: 0,
          bar: 66,
          row: 88,
          label: 30,
          value: 32,
          subject: 34,
          body: 32,
          chip: 92,
          chipFs: 30,
          tag: 60,
          tagFs: 28,
          tile: 112,
          tileFs: 30,
          icon: 38,
          toast: 84,
          toastFs: 32,
          pad: 48,
          gap: 28,
          foot: 0,
          tb: 18,
        };
    return Object.fromEntries(
      Object.entries(s).map(([n, v]) => [n, round(v * k)]),
    );
  };

  // The window's width; its height follows the rows.
  const winW = windowWidth(w, h, roomH, phone, T);

  // The tag sits beside the link text in a wide window, on its own row under it otherwise.
  const stackTag = phone || winW < 1200;

  const height = (s: ReturnType<typeof sizes>) => {
    const chipSlot = s.chip + (expires && stackTag ? s.tag + 16 : 0);
    return (
      s.top +
      s.bar +
      2 * s.row +
      s.gap +
      2 * round(s.body * 1.32) +
      s.gap +
      chipSlot +
      (send ? s.gap + s.toast : 0) +
      s.gap +
      s.tile +
      2 * s.tb +
      s.foot
    );
  };

  // A phone keeps a phone's proportions and grows its type to fill them (up to 30% larger), with
  // a little air left above the toolbar; a window keeps to its rows, a little larger where the
  // frame has the room.
  const clamp = (v: number, lo: number, hi: number) =>
    Math.max(lo, Math.min(hi, v));

  let k, winH;

  if (phone) {
    const full = Math.min(roomH, round(winW * (T ? 1.8 : 1.75)));
    k = clamp((full - 48) / height(sizes(1)), 0.85, T ? 1.3 : 1.05);
    winH = Math.max(
      Math.min(full, height(sizes(k)) + round(70 * k)),
      height(sizes(k)) + 24,
    );
  } else {
    k = clamp((0.94 * roomH) / height(sizes(1)), 0.85, 1.1);
    winH = height(sizes(k)) + sizes(k).gap;
  }

  const s = sizes(k);

  const win = {
    x: round((w - winW) / 2),
    y: round(room.y + (roomH - winH) / 2),
    w: winW,
    h: winH,
  };

  const innerX = win.x + s.pad;

  const innerW = win.w - 2 * s.pad;

  const inner = { x: innerX, w: innerW, r: innerX + innerW };

  const corner = phone ? round(56 * k) : 22;
  return {
    expires,
    send,
    phone,
    AT,
    cued,
    text,
    stackTag,
    k,
    s,
    win,
    inner,
    corner,
  };
}

function frameRoom(w: number, h: number, isTall: boolean) {
  if (!isTall) return { y: round(h * 0.055), b: h - round(h * 0.135) };
  const phoneTall = h > w * 1.5;
  return {
    y: round(h * (phoneTall ? 0.075 : 0.045)),
    b: h - round(h * (phoneTall ? 0.12 : 0.125)),
  };
}

function windowWidth(
  w: number,
  h: number,
  roomH: number,
  phone: boolean,
  isTall: boolean,
) {
  if (phone) {
    if (isTall) return Math.min(820, w - 260, round(roomH * 0.62));
    return Math.min(560, round(roomH * 0.6));
  }
  if (isTall) return Math.min(920, w - 160);
  if (w > h * 1.25) return Math.min(1360, w - 400);
  return Math.min(960, w - 120);
}
