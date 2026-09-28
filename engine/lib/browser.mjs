// Headless Chrome helpers: open a composition in render mode and wait until it is ready.
import os from 'node:os';

let puppeteer;
async function lib() {
  puppeteer ??= (await import('puppeteer')).default;
  return puppeteer;
}

export async function launch({ scale = 1 } = {}) {
  const p = await lib();
  return p.launch({
    headless: true,
    args: [
      // Pin the device scale factor: on HiDPI hosts (e.g. Retina Macs) the display's DPR can otherwise
      // leak into long captures and return 2× frames.
      `--force-device-scale-factor=${scale}`,
      '--hide-scrollbars', '--mute-audio', '--force-color-profile=srgb', '--font-render-hinting=none',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows',
      '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage',
    ],
    protocolTimeout: 180_000,
  });
}

/** Open url in render mode. Collects console errors, failed requests and runtime warnings. */
export async function openComposition(browser, url, { width, height, scale = 1 }) {
  const page = await browser.newPage();
  const issues = { errors: [], failed: [], console: [] };
  page.on('pageerror', (e) => issues.errors.push(String(e.message ?? e)));
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') issues.console.push(`${m.type()}: ${m.text()}`); });
  page.on('response', (r) => { if (r.status() >= 400) issues.failed.push(`${r.status()} ${new URL(r.url()).pathname}`); });
  page.on('requestfailed', (r) => issues.failed.push(`failed ${new URL(r.url()).pathname}`));
  await page.setViewport({ width, height, deviceScaleFactor: scale });
  const sep = url.includes('?') ? '&' : '?';
  await page.goto(`${url}${sep}render=1`, { waitUntil: 'load', timeout: 60_000 });
  await page.waitForFunction('window.__CF_READY === true || !!window.__CF_ERROR', { timeout: 120_000 });
  const err = await page.evaluate('window.__CF_ERROR || null');
  if (err) throw new Error(`Composition failed to build:\n${err}`);
  const info = await page.evaluate(() => ({ duration: __CF.duration, fps: __CF.fps, width: __CF.width, height: __CF.height, frames: __CF.frames, warnings: __CF.warnings }));
  const cdp = await page.createCDPSession();
  return { page, cdp, info, issues };
}

export async function seek(page, t) {
  await page.evaluate((x) => window.__CF.seek(x), t);
}

/** Capture the current frame. format 'png' (lossless) or 'jpeg'. */
export async function capture(cdp, { format = 'png', quality = 92, clip } = {}) {
  const params = { format, captureBeyondViewport: false, optimizeForSpeed: true, fromSurface: true };
  if (format === 'jpeg') params.quality = quality;
  if (clip) params.clip = clip;
  const { data } = await cdp.send('Page.captureScreenshot', params);
  return Buffer.from(data, 'base64');
}

/** Pixel size of a PNG or JPEG buffer (header parse, no decode). */
export function imageSize(buf) {
  if (buf[0] === 0x89 && buf[1] === 0x50) return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  let i = 2;
  while (i + 9 < buf.length) {
    if (buf[i] !== 0xff) { i++; continue; }
    const m = buf[i + 1];
    if (m >= 0xc0 && m <= 0xc3) return { width: buf.readUInt16BE(i + 7), height: buf.readUInt16BE(i + 5) };
    i += 2 + buf.readUInt16BE(i + 2);
  }
  return null;
}

/**
 * Seek to t and capture, verifying the pixel size. Chrome can silently drop viewport emulation during
 * long sessions (frames come back at the window's surface size); when that happens, re-pin and recapture.
 */
export async function captureAt(page, cdp, t, { width, height, scale = 1, shot = {}, onFix } = {}) {
  const expect = shot.clip ? { w: shot.clip.width * (shot.clip.scale ?? 1) * scale, h: shot.clip.height * (shot.clip.scale ?? 1) * scale } : { w: width * scale, h: height * scale };
  await seek(page, t);
  let buf = await capture(cdp, shot);
  for (let retry = 0; retry < 3; retry++) {
    const sz = imageSize(buf);
    if (!sz || (Math.abs(sz.width - expect.w) <= 1.5 && Math.abs(sz.height - expect.h) <= 1.5)) break;
    onFix?.(`captured ${sz.width}×${sz.height} at ${t.toFixed(2)}s; re-pinned the viewport and recaptured`);
    await page.setViewport({ width, height, deviceScaleFactor: scale });
    await seek(page, t);
    buf = await capture(cdp, shot);
  }
  return buf;
}

export function defaultWorkers() {
  return Math.max(1, Math.min(6, Math.floor(os.cpus().length / 2)));
}
