// A text-free dashboard wireframe PNG in the film palette: an obviously illustrative stand-in
// for a real screenshot in playbooks and the gallery. Pure Node (zlib), deterministic bytes.
import zlib from 'node:zlib';

const rgb = hex =>
  hex
    .slice(1)
    .match(/../g)
    .map(v => parseInt(v, 16));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

const CRC = new Int32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});
const crc32 = buf => {
  let c = -1;
  for (const byte of buf) c = CRC[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};
function chunk(type, data) {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/** Layout in 0–1 image coordinates, so annotate pins can point at named parts. */
export const WIREFRAME = {
  kpis: [
    [0.19, 0.12, 0.21, 0.18],
    [0.43, 0.12, 0.21, 0.18],
    [0.67, 0.12, 0.3, 0.18],
  ],
  chart: [0.19, 0.36, 0.51, 0.56],
  list: [0.73, 0.36, 0.24, 0.56],
  bars: [0.34, 0.52, 0.45, 0.62, 0.9, 0.58, 0.7],
  highlight: 4,
};

export function wireframePNG(colors, width = 1600, height = 1000) {
  const lum = rgb(colors.bg).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0) / 255;
  // Dark palettes get a dark interface; light palettes a bright one.
  const page = lum < 0.35 ? mix(rgb(colors.bg), [255, 255, 255], 0.05) : mix(rgb(colors.bg), [255, 255, 255], 0.55);
  const panel =
    lum < 0.35 ? mix(rgb(colors.surface), [255, 255, 255], 0.06) : mix(rgb(colors.surface), [255, 255, 255], 0.35);
  const ink = rgb(colors.ink),
    accent = rgb(colors.accent),
    line = mix(panel, ink, 0.12),
    faint = mix(panel, ink, 0.2);
  const px = Buffer.alloc(width * height * 3);
  for (let i = 0; i < width * height; i++) px.set(page, i * 3);
  const box = (x, y, w, h, color, r = 0) => {
    const [x0, y0, x1, y1] = [x * width, y * height, (x + w) * width, (y + h) * height].map(Math.round);
    for (let yy = Math.max(0, y0); yy < Math.min(height, y1); yy++)
      for (let xx = Math.max(0, x0); xx < Math.min(width, x1); xx++) {
        const dx = Math.max(x0 + r - xx - 0.5, xx + 0.5 - (x1 - r), 0),
          dy = Math.max(y0 + r - yy - 0.5, yy + 0.5 - (y1 - r), 0);
        if (dx * dx + dy * dy <= r * r) px.set(color, (yy * width + xx) * 3);
      }
  };
  box(0, 0, 1, 0.07, mix(page, ink, 0.07));
  box(0.02, 0.025, 0.08, 0.02, mix(page, ink, 0.25), 6);
  box(0, 0.07, 0.16, 0.93, panel);
  for (let i = 0; i < 6; i++) box(0.02, 0.12 + i * 0.07, i === 1 ? 0.1 : 0.08, 0.022, i === 1 ? accent : faint, 6);
  for (const [i, [x, y, w, h]] of WIREFRAME.kpis.entries()) {
    box(x, y, w, h, panel, 18);
    box(x + 0.02, y + 0.035, w * 0.35, 0.02, faint, 6);
    box(x + 0.02, y + 0.08, w * (i === 0 ? 0.55 : 0.42), 0.055, i === 0 ? accent : mix(panel, ink, 0.55), 8);
  }
  const [cx, cy, cw, ch] = WIREFRAME.chart;
  box(cx, cy, cw, ch, panel, 18);
  box(cx + 0.02, cy + 0.04, 0.12, 0.022, faint, 6);
  const base = cy + ch - 0.07,
    n = WIREFRAME.bars.length,
    slot = (cw - 0.06) / n;
  box(cx + 0.03, base, cw - 0.06, 0.003, line);
  for (const [i, v] of WIREFRAME.bars.entries()) {
    const h = v * (ch - 0.2);
    box(
      cx + 0.03 + slot * i + slot * 0.2,
      base - h,
      slot * 0.6,
      h,
      i === WIREFRAME.highlight ? accent : mix(panel, ink, 0.28),
      8,
    );
  }
  const [lx, ly, lw, lh] = WIREFRAME.list;
  box(lx, ly, lw, lh, panel, 18);
  for (let i = 0; i < 6; i++) {
    const y = ly + 0.06 + i * 0.08;
    box(lx + 0.02, y, 0.03, 0.045, i === 2 ? accent : faint, 12);
    box(lx + 0.065, y + 0.006, lw * (i % 2 ? 0.45 : 0.6), 0.016, mix(panel, ink, 0.35), 5);
    box(lx + 0.065, y + 0.03, lw * 0.35, 0.012, faint, 4);
  }
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) px.copy(raw, y * (width * 3 + 1) + 1, y * width * 3, (y + 1) * width * 3);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
