import { crisp, round, tall } from '../../film/sketch-kit.mjs';

// The same email, one different button: a message being written (To, Subject, a body line and
// an attached file, all there from the first frame) in a desktop mail window or a phone. The
// pointer reaches for the old button out of habit as the scene opens; on OLD that button is
// struck through and the attachment shakes and greys; on NEW the new button lights and is
// pressed; on LINK the file lights, lifts as it uploads and turns into a link chip with a lock;
// optionally a tag lands on the link (EXPIRES) and Send pulses with a confirmation (SEND). Each
// moment changes a large part of the picture on its word (a lit button, a lit chip, a solid
// tag), so it reads on a phone and in a pale palette. The window is crisp UI in any film look;
// the strike keeps the film's hand. Drawn, not a screenshot: it carries the product's words,
// never its figures.

/** A paperclip (no such icon in the set), drawn in a 24-unit box centred on (cx, cy). */
const clipPath = (cx, cy, s) => {
  const P = (x, y) => `${round(cx + ((x - 12) * s) / 24)} ${round(cy + ((y - 12) * s) / 24)}`,
    R = r => round((r * s) / 24);
  return `M ${P(15.5, 7)} L ${P(15.5, 16.5)} A ${R(3.5)} ${R(3.5)} 0 0 1 ${P(8.5, 16.5)} L ${P(8.5, 5.5)} A ${R(2.5)} ${R(2.5)} 0 0 1 ${P(13.5, 5.5)} L ${P(13.5, 15.5)} A ${R(1.5)} ${R(1.5)} 0 0 1 ${P(10.5, 15.5)} L ${P(10.5, 8)}`;
};
/** A paper plane for Send, in the same 24-unit box. */
const planePath = (cx, cy, s) => {
  const P = (x, y) => `${round(cx + ((x - 12) * s) / 24)} ${round(cy + ((y - 12) * s) / 24)}`;
  return `M ${P(21, 3)} L ${P(3, 10)} L ${P(10, 14)} L ${P(14, 21)} Z M ${P(21, 3)} L ${P(10, 14)}`;
};
const cursorPath = (x, y, k) =>
  `M ${x} ${y} L ${x} ${round(y + 40 * k)} L ${round(x + 10 * k)} ${round(y + 31 * k)} L ${round(x + 17 * k)} ${round(y + 47 * k)} L ${round(x + 25 * k)} ${round(y + 44 * k)} L ${round(x + 18 * k)} ${round(y + 28 * k)} L ${round(x + 31 * k)} ${round(y + 28 * k)} Z`;

export default {
  name: 'compose',
  keep: true,
  order: 102,
  summary:
    'The same email, one different button: a draft with an attached file, the old button struck through as the file shakes and greys, the new button lit and pressed, the file lighting up as it uploads and turning into a link with a lock; optionally a tag lands on the link (it expires) and Send pulses with a confirmation.',
  use: 'Compliance and security habits that are "the same email, one different button": send client documents through a secure link instead of attaching them, Encrypt before sending: an email being written and sent (a message received, such as Report phish, is inspect with report: true). Set sketchParams.device to "phone" for a mail app or "desktop" for a mail window (auto, the default, gives a tall frame the phone); expires true adds the tag on the link, send true adds Send and its confirmation. Replace RECIPIENT (who it is to), SUBJECT, BODY (one line of the email), FILE (the attachment, e.g. "Statement_Q2.pdf"), OLD and NEW (the two buttons, e.g. "Attach" and "Share securely"), LINKTEXT (what the file becomes, e.g. "Secure link: client signs in"), EXPIRY (with expires, e.g. "Expires in 7 days") and DONE (with send, e.g. "Sent securely") with sketchText. Keep RECIPIENT, SUBJECT, FILE and LINKTEXT to about 25 characters, the buttons to one or two words and BODY to one short sentence: a longer line shrinks to fit its field and is too small to read on a phone; land OLD (the old button, "instead of Attach"), NEW (the new one, "press Share securely"), LINK ("goes up as a link"), EXPIRES ("expires") and SEND ("send") on words in that order with sketchSay. For a step through several screens of an app, use portal; to point at the parts of a message, inspect.',
  params: {
    device: {
      default: 'auto',
      oneOf: ['auto', 'desktop', 'phone'],
      about: 'desktop: a mail window with a toolbar; phone: a mail app (Send at the top, the two buttons along the bottom); auto (the default): a phone in a tall frame, a desktop window otherwise',
    },
    expires: { default: false, about: 'true: on EXPIRES, a tag (EXPIRY) lands on the link chip' },
    send: { default: false, about: 'true: on SEND, the Send button pulses and a confirmation (DONE) pops up' },
  },
  build(w, h, { params = {} } = {}) {
    const { device = 'auto', expires = false, send = false } = params;
    // A desktop window in a 9:16 frame is cropped and tiny; a tall frame gets the phone unless asked.
    const phone = device === 'phone' || (device !== 'desktop' && h > w * 1.2);
    const T = tall(w, h);
    // Moments, a second and a half apart by default; EXPIRES and SEND only when drawn.
    const AT = { OLD: 1.2, NEW: 2.8, LINK: 4.4 };
    if (expires) AT.EXPIRES = 6.2;
    if (send) AT.SEND = round((expires ? AT.EXPIRES : AT.LINK) + 1.8);
    const cued = (cue, dt = 0, extra = {}) => ({ cue, at: round(AT[cue] + dt), ...(dt ? { after: round(dt) } : {}), ...extra });
    const text = (t, x, y, size, font, fill, extra = {}) => ({ type: 'text', text: t, x: round(x), y: round(y), size: round(size), font, fill, enter: 'none', ...extra });

    // Room for the picture: clear of the frame edges and of the source line at the bottom.
    const room = T
      ? { y: round(h * (h > w * 1.5 ? 0.075 : 0.045)), b: h - round(h * (h > w * 1.5 ? 0.12 : 0.125)) }
      : { y: round(h * 0.055), b: h - round(h * 0.135) };
    room.h = room.b - room.y;

    // Sizes at scale k (type and rows grow together, so a bigger frame reads bigger, never sparser).
    const sizes = k => {
      const s = phone
        ? { top: 56, bar: 104, row: 96, label: 30, value: 32, subject: 34, body: 32, chip: 100, chipFs: 30, tag: 64, tagFs: 28, tile: 120, tileFs: 30, icon: 40, toast: 88, toastFs: 32, pad: 40, gap: 30, foot: 40, tb: 20 }
        : { top: 0, bar: 66, row: 88, label: 30, value: 32, subject: 34, body: 32, chip: 92, chipFs: 30, tag: 60, tagFs: 28, tile: 112, tileFs: 30, icon: 38, toast: 84, toastFs: 32, pad: 48, gap: 28, foot: 0, tb: 18 };
      return Object.fromEntries(Object.entries(s).map(([n, v]) => [n, round(v * k)]));
    };
    // The window's width; its height follows the rows.
    const winW = phone ? (T ? Math.min(820, w - 260, round(room.h * 0.62)) : Math.min(560, round(room.h * 0.6))) : T ? Math.min(920, w - 160) : w > h * 1.25 ? Math.min(1360, w - 400) : Math.min(960, w - 120);
    // The tag sits beside the link text in a wide window, on its own row under it otherwise.
    const stackTag = phone || winW < 1200;
    const height = s => {
      const chipSlot = s.chip + (expires && stackTag ? s.tag + 16 : 0);
      return s.top + s.bar + 2 * s.row + s.gap + 2 * round(s.body * 1.32) + s.gap + chipSlot + (send ? s.gap + s.toast : 0) + s.gap + s.tile + 2 * s.tb + s.foot;
    };
    // A phone keeps a phone's proportions and grows its type to fill them (up to 30% larger), with
    // a little air left above the toolbar; a window keeps to its rows, a little larger where the
    // frame has the room.
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    let k, winH;
    if (phone) {
      const full = Math.min(room.h, round(winW * (T ? 1.8 : 1.75)));
      k = clamp((full - 48) / height(sizes(1)), 0.85, T ? 1.3 : 1.05);
      winH = Math.max(Math.min(full, height(sizes(k)) + round(70 * k)), height(sizes(k)) + 24);
    } else {
      k = clamp((0.94 * room.h) / height(sizes(1)), 0.85, 1.1);
      winH = height(sizes(k)) + sizes(k).gap;
    }
    const s = sizes(k);
    const win = { x: round((w - winW) / 2), y: round(room.y + (room.h - winH) / 2), w: winW, h: winH };
    const inner = { x: win.x + s.pad, w: win.w - 2 * s.pad };
    inner.r = inner.x + inner.w;
    const corner = phone ? round(56 * k) : 22;

    // Rows, top to bottom.
    let y = win.y + s.top;
    const bar = { y, h: s.bar };
    y += s.bar;
    const toRow = { y, h: s.row };
    y += s.row;
    const subRow = { y, h: s.row };
    y += s.row + s.gap;
    const body = { y, h: 2 * round(s.body * 1.32) };
    y += body.h + s.gap;
    const fileW = phone ? inner.w : Math.min(inner.w, round(680 * k));
    const file = { x: inner.x, y, w: fileW, h: s.chip };
    const tagW = stackTag ? Math.min(inner.w - 2 * s.tb - s.chip, round(380 * k)) : round(360 * k);
    const link = { x: inner.x, y, w: phone || stackTag ? inner.w : Math.min(inner.w, round((expires ? 1040 : 720) * k)), h: s.chip + (expires && stackTag ? s.tag + 16 : 0) };
    y += link.h;
    const toast = send ? { w: Math.min(inner.w, round(560 * k)), h: s.toast, y: y + s.gap } : null;
    if (toast) toast.x = round(win.x + (win.w - toast.w) / 2);
    // The toolbar: along the window's foot (and above a phone's home bar).
    const tb = { y: win.y + win.h - s.foot - s.tile - 2 * s.tb, h: s.tile + 2 * s.tb };
    const tileY = tb.y + s.tb;
    // Desktop: Send, a gap, the old button and the new one, narrowed together in a narrow window.
    const [sw, g1, ow, g2, nw] = [176, 44, 240, 28, 340].map(v => v * k);
    const fit = Math.min(1, inner.w / (sw + g1 + ow + g2 + nw));
    const sendTile = phone ? null : { x: inner.x, y: tileY, w: round(sw * fit), h: s.tile };
    const oldTile = phone
      ? { x: inner.x, y: tileY, w: round((inner.w - s.tb) / 2), h: s.tile }
      : { x: round(inner.x + (sw + g1) * fit), y: tileY, w: round(ow * fit), h: s.tile };
    const newTile = phone
      ? { x: oldTile.x + oldTile.w + s.tb, y: tileY, w: inner.r - (oldTile.x + oldTile.w + s.tb), h: s.tile }
      : { x: round(inner.x + (sw + g1 + ow + g2) * fit), y: tileY, w: round(nw * fit), h: s.tile };
    // Send on a phone: a round button at the right of the app bar.
    const sendDot = phone ? { cx: inner.r - round(36 * k), cy: round(bar.y + bar.h / 2), r: round(36 * k) } : null;
    const centre = r => [round(r.x + r.w / 2), round(r.y + r.h / 2)];

    // A toolbar button: its icon over its label, both centred, so any word sits right in it.
    const tileFace = (r, label, icon, color) => {
      const [cx] = centre(r);
      const iy = round(r.y + r.h * 0.36),
        ly = round(r.y + r.h * 0.8);
      return [
        icon(cx, iy, color),
        text(label, cx, ly, s.tileFs, 'semibold', color, { anchor: 'middle', fit: r.w - 28 }),
      ];
    };
    const clipIcon = (cx, cy, color) => ({ type: 'path', d: clipPath(cx, cy, s.icon), fill: 'none', stroke: color, width: round(2.6 * k), cap: 'round', join: 'round', enter: 'none', rotate: 40, origin: [cx, cy] });
    const lockIcon = (cx, cy, color) => ({ type: 'icon', name: 'lock', x: cx, y: cy, size: s.icon, stroke: color, enter: 'none' });
    const planeIcon = (cx, cy, color, size = s.icon) => ({ type: 'path', d: planePath(cx, cy, size * 0.9), fill: 'none', stroke: color, width: round(2.6 * k), cap: 'round', join: 'round', enter: 'none' });

    const ui = [];
    // The window: a desktop's title bar or a phone's bezel, notch and app bar.
    ui.push({ type: 'rect', ...win, r: corner, fill: 'surface', stroke: phone ? 'ink' : 'line', width: phone ? round(10 * k) : 2, enter: 'none' });
    if (phone) {
      ui.push({ type: 'rect', x: round(win.x + win.w / 2 - 64 * k), y: win.y + round(18 * k), w: round(128 * k), h: round(16 * k), r: round(8 * k), fill: 'ink', enter: 'none' });
      ui.push(text('Cancel', inner.x, bar.y + bar.h / 2 + s.label * 0.36, s.label, 'semibold', 'muted'));
      ui.push(text('New message', win.x + win.w / 2, bar.y + bar.h / 2 + s.value * 0.36, s.value, 'bold', 'ink', { anchor: 'middle', fit: round(inner.w - 2 * (s.label * 3.4 + 20)) }));
      ui.push({ type: 'rect', x: round(win.x + win.w / 2 - 70 * k), y: win.y + win.h - round(24 * k), w: round(140 * k), h: round(8 * k), r: round(4 * k), fill: 'muted', opacity: 0.5, enter: 'none' });
    } else {
      ui.push({ type: 'rect', x: win.x, y: win.y, w: win.w, h: bar.h, r: corner, fill: 'bg', enter: 'none' });
      ui.push({ type: 'rect', x: win.x, y: win.y + bar.h - corner, w: win.w, h: corner, fill: 'bg', enter: 'none' });
      [0, 1, 2].forEach(i => ui.push({ type: 'circle', cx: win.x + 34 + i * 26, cy: round(bar.y + bar.h / 2), r: 8, fill: 'line', enter: 'none' }));
      ui.push(text('New message', win.x + win.w / 2, bar.y + bar.h / 2 + 28 * k * 0.36, 28 * k, 'semibold', 'muted', { anchor: 'middle', fit: win.w - 240 }));
    }
    ui.push({ type: 'line', x1: win.x, y1: bar.y + bar.h, x2: win.x + win.w, y2: bar.y + bar.h, stroke: 'line', width: 2, enter: 'none' });

    // To and Subject: a label column, the values beside it, a rule under each row.
    const valueX = inner.x + round(s.label * (phone ? 4.2 : 4.6));
    const avatar = round(s.value * 0.62);
    const toY = round(toRow.y + toRow.h / 2);
    ui.push(text('To', inner.x, toY + s.label * 0.36, s.label, 'regular', 'muted'));
    ui.push({ type: 'circle', cx: valueX + avatar, cy: toY, r: avatar, fill: 'wash2', enter: 'none' });
    ui.push({ type: 'icon', name: 'user', x: valueX + avatar, y: toY, size: round(avatar * 1.15), stroke: 'accent2', enter: 'none' });
    ui.push(text('RECIPIENT', valueX + 2 * avatar + 16, toY + s.value * 0.36, s.value, 'regular', 'ink', { fit: inner.r - (valueX + 2 * avatar + 16) }));
    const subY = round(subRow.y + subRow.h / 2);
    ui.push(text('Subject', inner.x, subY + s.label * 0.36, s.label, 'regular', 'muted'));
    ui.push(text('SUBJECT', valueX, subY + s.subject * 0.36, s.subject, 'semibold', 'ink', { fit: inner.r - valueX }));
    for (const r of [toRow, subRow]) ui.push({ type: 'line', x1: inner.x, y1: r.y + r.h, x2: phone ? inner.r : win.x + win.w, y2: r.y + r.h, stroke: 'line', width: 2, enter: 'none' });
    // One line of the message (two when it wraps).
    ui.push(text('BODY', inner.x, body.y + s.body * 0.92, s.body, 'regular', 'ink', { width: inner.w, height: body.h, leading: 1.32 }));

    // The toolbar: a rule over it, then Send (desktop), the old button and the new one.
    ui.push({ type: 'line', x1: phone ? win.x + round(10 * k) : win.x, y1: tb.y, x2: phone ? win.x + win.w - round(10 * k) : win.x + win.w, y2: tb.y, stroke: 'line', width: 2, enter: 'none' });

    // The old button: the pointer reaches for it out of habit as the scene opens (it lights as a
    // hover), then on OLD it is struck through and dimmed.
    ui.push({
      type: 'group',
      enter: 'none',
      at: 0,
      keys: [cued('OLD', 0.05, { dur: 0.45, opacity: 0.42 })],
      children: [
        { type: 'rect', ...oldTile, r: round(18 * k), fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
        { type: 'rect', ...oldTile, r: round(18 * k), fill: 'wash', stroke: 'accent', width: round(3 * k), enter: 'fade', at: 0.95, dur: 0.25, exit: 'fade', exitCue: 'OLD', exitAt: AT.OLD, exitDur: 0.3 },
        ...tileFace(oldTile, 'OLD', clipIcon, 'ink'),
      ],
    });
    // The new button: lit and pressed on NEW.
    const [ncx, ncy] = centre(newTile);
    ui.push({
      type: 'group',
      enter: 'none',
      at: 0,
      origin: [ncx, ncy],
      keys: [cued('NEW', 0, { dur: 0.32, ease: 'thereAndBack', scale: 0.93 })],
      children: [
        { type: 'rect', ...newTile, r: round(18 * k), fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
        ...tileFace(newTile, 'NEW', lockIcon, 'ink'),
        {
          type: 'group',
          enter: 'fade',
          dur: 0.25,
          ...cued('NEW'),
          children: [
            { type: 'rect', ...newTile, r: round(18 * k), fill: 'accent', enter: 'none', glow: { blur: 28, opacity: 0.45 } },
            ...tileFace(newTile, 'NEW', lockIcon, 'bg'),
          ],
        },
      ],
    });
    // Send: a dark button in the toolbar, or a round one in a phone's app bar; it pulses on SEND.
    const sendAt = phone ? [sendDot.cx, sendDot.cy] : centre(sendTile);
    ui.push({
      type: 'group',
      enter: 'none',
      at: 0,
      origin: sendAt,
      ...(send ? { keys: [cued('SEND', 0, { dur: 0.45, ease: 'thereAndBack', scale: 1.12 })] } : {}),
      children: phone
        ? [
            { type: 'circle', cx: sendDot.cx, cy: sendDot.cy, r: sendDot.r, fill: 'ink', enter: 'none' },
            planeIcon(sendDot.cx - round(2 * k), sendDot.cy + round(2 * k), 'bg', round(sendDot.r * 1.05)),
          ]
        : [{ type: 'rect', ...sendTile, r: round(18 * k), fill: 'ink', enter: 'none' }, ...tileFace(sendTile, 'Send', (cx, cy, c) => planeIcon(cx, cy, c), 'bg')],
    });

    // The attachment: shakes and greys on OLD; on LINK it lights, lifts as it uploads, and turns
    // into the link: the link's card fades in over it where it hangs, then settles into place.
    const [fcx, fcy] = centre(file);
    const fileTile = s.chip - 28;
    ui.push({
      type: 'group',
      enter: 'none',
      at: 0,
      origin: [fcx, fcy],
      keys: [
        cued('OLD', 0.15, { dur: 0.6, ease: 'wiggle', x: round(12 * k) }),
        cued('OLD', 0.15, { dur: 0.45, opacity: 0.5 }),
        cued('LINK', 0, { dur: 0.25, opacity: 1, y: round(-10 * k) }),
        cued('LINK', 0.72, { dur: 0, opacity: 0 }),
      ],
      children: [
        { type: 'rect', ...file, r: round(16 * k), fill: 'bg', stroke: 'line', width: 2, enter: 'none' },
        { type: 'rect', x: file.x + 14, y: file.y + 14, w: fileTile, h: fileTile, r: round(12 * k), fill: 'wash2', enter: 'none' },
        { type: 'icon', name: 'file', x: round(file.x + 14 + fileTile / 2), y: fcy, size: round(fileTile * 0.56), stroke: 'accent2', enter: 'none' },
        text('FILE', file.x + 14 + fileTile + 22, fcy + s.chipFs * 0.36, s.chipFs, 'semibold', 'ink', { fit: file.w - fileTile - 36 - 22 - 64 }),
        clipIcon(file.x + file.w - round(36 * k), fcy, 'muted'),
        // The upload: the chip lights in the link's colour and a bar fills along its foot.
        {
          type: 'group',
          enter: 'fade',
          dur: 0.2,
          ...cued('LINK'),
          children: [
            { type: 'rect', ...file, r: round(16 * k), fill: 'accent2', enter: 'none' },
            { type: 'icon', name: 'file', x: round(file.x + 14 + fileTile / 2), y: fcy, size: round(fileTile * 0.56), stroke: 'bg', enter: 'none' },
            text('FILE', file.x + 14 + fileTile + 22, fcy + s.chipFs * 0.36, s.chipFs, 'semibold', 'bg', { fit: file.w - fileTile - 36 - 22 - 64 }),
            clipIcon(file.x + file.w - round(36 * k), fcy, 'bg'),
            { type: 'rect', x: file.x + 16, y: file.y + file.h - round(14 * k), w: file.w - 32, h: round(6 * k), r: round(3 * k), fill: 'bg', opacity: 0.85, enter: 'none', origin: [file.x + 16, file.y + file.h - round(11 * k)], keys: [{ at: 0, dur: 0, scaleX: 0 }, cued('LINK', 0, { dur: 0.45, ease: 'inOut', scaleX: 1 })] },
          ],
        },
      ],
    });
    // The link it comes back as: a lock, the link's words and, with expires, the tag. A tag on a
    // row of its own lands under the words, which sit centred in the chip until it makes room.
    const lockR = round((s.chip - 30) / 2);
    const shift = round((link.h - s.chip) / 2);
    const lcy = round(link.y + s.chip / 2 + shift);
    const linkTextX = link.x + 16 + 2 * lockR + 22;
    const tag = expires
      ? stackTag
        ? { x: linkTextX, y: link.y + s.chip - 6, w: Math.min(tagW, link.x + link.w - 16 - linkTextX), h: s.tag }
        : { x: link.x + link.w - 14 - tagW, y: round(lcy - s.tag / 2), w: tagW, h: s.tag }
      : null;
    ui.push({
      type: 'group',
      enter: 'fade',
      dur: 0.22,
      ...cued('LINK', 0.5),
      keys: [cued('LINK', 0.5, { dur: 0, y: round(-10 * k) }), cued('LINK', 0.72, { dur: 0.3, ease: 'out', y: 0 })],
      children: [
        { type: 'rect', ...link, r: round(18 * k), fill: 'bg', stroke: 'accent2', width: round(3 * k), enter: 'none', shadow: { blur: 18, dy: 8, opacity: 0.12 } },
        {
          type: 'group',
          enter: 'none',
          ...(shift ? { keys: [cued('EXPIRES', 0, { dur: 0.4, ease: 'inOut', y: -shift })] } : {}),
          children: [
            { type: 'group', enter: 'pop', dur: 0.4, origin: [link.x + 16 + lockR, lcy], ...cued('LINK', 0.75), children: [
              { type: 'circle', cx: link.x + 16 + lockR, cy: lcy, r: lockR, fill: 'accent2', enter: 'none' },
              { type: 'icon', name: 'lock', x: link.x + 16 + lockR, y: lcy, size: round(lockR * 1.1), stroke: 'bg', enter: 'none' },
            ] },
            text('LINKTEXT', linkTextX, lcy + s.chipFs * 0.36, s.chipFs, 'semibold', 'ink', { fit: (tag && !stackTag ? tag.x - 20 : link.x + link.w - 20) - linkTextX, enter: 'fade', dur: 0.25, ...cued('LINK', 0.68) }),
          ],
        },
      ],
    });
    if (tag) {
      const tcy = round(tag.y + tag.h / 2);
      ui.push({
        type: 'group',
        // Beside the words it drops onto the chip; under them it pops in as they make room.
        ...(stackTag ? { enter: 'pop', dur: 0.4, ...cued('EXPIRES', 0.15) } : { enter: 'drop', dist: round(34 * k), dur: 0.45, ...cued('EXPIRES') }),
        origin: [round(tag.x + tag.w / 2), tcy],
        keys: [cued('EXPIRES', 0.4, { dur: 0.35, ease: 'thereAndBack', scale: 1.06 })],
        children: [
          { type: 'rect', ...tag, r: round(tag.h / 2), fill: 'accent', enter: 'none' },
          { type: 'icon', name: 'timer', x: tag.x + round(tag.h / 2 + 4), y: tcy, size: round(s.tagFs * 1.15), stroke: 'bg', enter: 'none' },
          text('EXPIRY', tag.x + tag.h + 12, tcy + s.tagFs * 0.36, s.tagFs, 'semibold', 'bg', { fit: tag.w - tag.h - 12 - 22 }),
        ],
      });
    }
    // The confirmation.
    if (toast) {
      const [tcx, tcy] = centre(toast);
      ui.push({
        type: 'group',
        enter: 'pop',
        dur: 0.4,
        origin: [tcx, tcy],
        ...cued('SEND', 0.35),
        children: [
          { type: 'rect', ...toast, r: round(toast.h / 2), fill: 'ink', enter: 'none', shadow: { blur: 24, dy: 10, opacity: 0.18 } },
          { type: 'circle', cx: toast.x + round(toast.h / 2), cy: tcy, r: round(s.toastFs * 0.72), fill: 'positive', enter: 'none' },
          { type: 'icon', name: 'check', x: toast.x + round(toast.h / 2), y: tcy, size: round(s.toastFs * 0.9), stroke: 'bg', enter: 'none' },
          text('DONE', toast.x + toast.h + 6, tcy + s.toastFs * 0.36, s.toastFs, 'semibold', 'bg', { fit: toast.w - toast.h - 6 - 32 }),
        ],
      });
    }

    // A ring where a press lands.
    const ripple = (at, cue) => ({
      type: 'circle',
      cx: at[0],
      cy: at[1],
      r: round(48 * k),
      fill: 'accent',
      enter: 'none',
      at: 0,
      origin: at,
      keys: [{ at: 0, dur: 0, opacity: 0 }, cued(cue, 0, { dur: 0, opacity: 0.35, scale: 0.3 }), cued(cue, 0, { dur: 0.55, ease: 'out', opacity: 0, scale: 1.5 })],
    });
    // The strike through the old button: drawn by hand, so it keeps the film's own line.
    const strike = {
      type: 'path',
      d: `M ${oldTile.x - 8} ${round(oldTile.y + oldTile.h * 0.78)} C ${round(oldTile.x + oldTile.w * 0.3)} ${round(oldTile.y + oldTile.h * 0.62)} ${round(oldTile.x + oldTile.w * 0.62)} ${round(oldTile.y + oldTile.h * 0.42)} ${oldTile.x + oldTile.w + 8} ${round(oldTile.y + oldTile.h * 0.2)}`,
      fill: 'none',
      stroke: 'negative',
      width: round(7 * k),
      cap: 'round',
      enter: 'draw',
      dur: 0.4,
      ...cued('OLD', 0.1),
    };

    // The pointer (a fingertip on a phone): it rests on the old button, moves to the new one and
    // presses it, steps aside while the file goes up, then presses Send (or leaves).
    const [ocx, ocy] = centre(oldTile);
    const start = phone ? [ocx + round(40 * k), ocy - round(150 * k)] : [ocx + round(260 * k), tb.y - round(120 * k)];
    // Out of the way: beside the toolbar's last button when the window has room there, else just above it.
    const rest = phone
      ? [ncx + round(90 * k), tb.y - round(70 * k)]
      : win.x + win.w - (newTile.x + newTile.w) > 200 * k
        ? [newTile.x + newTile.w + round(110 * k), ncy + round(20 * k)]
        : [round(newTile.x + newTile.w * 0.7), tb.y - round(64 * k)];
    const to = ([x, y], extra) => ({ dur: 0.6, ease: 'inOut', x: round(x - start[0] + (phone ? 0 : 6)), y: round(y - start[1] + (phone ? 0 : 8)), ...extra });
    const last = expires ? 'EXPIRES' : 'LINK';
    const pointer = {
      ...(phone
        ? { type: 'circle', cx: start[0], cy: start[1], r: round(32 * k), fill: 'ink', opacity: 0.28, stroke: 'surface', width: 3 }
        : { type: 'path', d: cursorPath(start[0], start[1], 1.15 * k), fill: 'ink', stroke: 'surface', width: 3, join: 'round' }),
      enter: 'fade',
      at: 0.15,
      dur: 0.3,
      keys: [
        { at: 0.3, ...to([ocx, ocy], { dur: 0.75 }) },
        cued('OLD', 0.2, to([ncx, ncy], { dur: 0.5 })),
        cued('NEW', 0.45, to(rest)),
        ...(send ? [cued(last, 0.35, to(sendAt, { dur: 0.7 })), cued('SEND', 0.7, { dur: 0.3, opacity: 0 })] : [cued(last, 0.5, { dur: 0.35, opacity: 0 })]),
      ],
    };

    return {
      elements: [
        ...crisp([
          { type: 'group', enter: 'none', at: 0, shadow: { blur: 48, dy: 24, opacity: 0.2 }, origin: centre(win), keys: [{ at: 0, dur: 0, scale: 0.985 }, { at: 0, dur: 1.2, ease: 'out', scale: 1 }], children: ui },
          ripple([ncx, ncy], 'NEW'),
          ...(send ? [ripple(sendAt, 'SEND')] : []),
        ]),
        strike,
        ...crisp([pointer]),
      ],
    };
  },
};
