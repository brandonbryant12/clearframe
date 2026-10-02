// Import brand artwork as a retained SVG original plus a native-renderable PNG.
// This is a deterministic format conversion, not generated or redrawn brand art.
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export function inspectSVG(file) {
  if (fs.statSync(file).size > 8 * 1024 * 1024) throw new Error('SVG brand artwork must be at most 8 MiB; supply a PNG for larger artwork.');
  // XML character references also apply inside CSS-valued attributes. Decode
  // before detecting url()/@import so encoded tokens cannot bypass validation.
  const decode = s => s.replace(/&#x([\da-f]+);|&#(\d+);|&(amp|quot|apos);/gi, (_, hex, dec, named) => hex || dec ? String.fromCodePoint(parseInt(hex ?? dec, hex ? 16 : 10)) : ({ amp: '&', quot: '"', apos: "'" })[named.toLowerCase()]).trim();
  const text = decode(fs.readFileSync(file, 'utf8'));
  if (!/<svg\b/i.test(text)) throw new Error('Brand SVG needs an svg root element.');
  if (/<(?:script|foreignObject)\b|<!DOCTYPE|<!ENTITY|\bon[a-z]+\s*=|\bxml:base\s*=|@import|\\/i.test(text))
    throw new Error('Brand SVG must be self-contained static artwork; export scripts, external styles and embedded web content as a PNG.');
  for (const m of text.matchAll(/\b(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    const ref = decode(m[1] ?? m[2]);
    if (!ref.startsWith('#') && !/^data:image\/(png|jpeg|webp);base64,[a-z\d+/=\s]+$/i.test(ref))
      throw new Error('Brand SVG references an external file or URL; embed its imagery or supply a PNG.');
  }
  for (const m of text.matchAll(/url\s*\(([^)]*)\)/gi)) {
    const ref = m[1].trim().replace(/^(["'])(.*)\1$/, '$2').trim();
    if (!/^#[^\s"'<>]+$/.test(ref)) throw new Error('Brand SVG has an external paint or style reference; use a self-contained export.');
  }
  return { liveText: /<text\b/i.test(text) };
}

export function rasterizeSVG(source, output, { maxSide = 2048 } = {}) {
  const inspected = inspectSVG(source);
  if (process.platform !== 'darwin' || !fs.existsSync('/usr/bin/sips'))
    throw new Error('SVG intake currently needs macOS sips. Supply an approved PNG on other platforms.');
  const r = spawnSync('/usr/bin/sips', ['-s', 'format', 'png', '-Z', String(maxSide), source, '--out', output],
    { encoding: 'utf8', timeout: 30000, maxBuffer: 1024 * 1024 });
  if (r.status !== 0 || !fs.existsSync(output)) throw new Error(`Could not rasterize SVG artwork: ${r.error?.message ?? r.stderr?.trim() ?? 'sips failed'}`);
  const png = fs.readFileSync(output);
  if (png.length < 33 || !png.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])))
    throw new Error('SVG conversion did not produce a PNG.');
  const width = png.readUInt32BE(16), height = png.readUInt32BE(20);
  if (!width || !height || width > maxSide || height > maxSide) throw new Error('SVG conversion produced unexpected dimensions.');
  return { tool: 'macOS sips', width, height, ...inspected };
}
