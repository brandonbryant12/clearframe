// Bounded native review evidence for reusable pieces. Pixel change and passing diagnostics
// are mechanical checks; the report deliberately leaves visual judgement open.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { prepareProject, preparedJob, nativeCommand, checkProject } from '../../film/prepare.mjs';
import { renderProject } from '../../film/render.mjs';
import { qaProject } from './qa.mjs';
import { ffmpeg, ffmpegBin } from './util.mjs';
import { sha256, sha256File, writeJSONAtomic } from './store.mjs';
import { REPO, sceneHash } from '../../scene/engine.mjs';

const ID = /^[a-z][a-z0-9-]{0,63}$/;
const escapeHTML = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const inside = (root, rel) => {
  const file = path.resolve(root, rel);
  if (!file.startsWith(path.resolve(root) + path.sep)) throw new Error(`Fixture file must stay inside its project: ${rel}`);
  return file;
};

export function validateBarFixture(value) {
  if (!value || typeof value !== 'object' || !ID.test(value.name ?? '')) throw new Error('Library bar needs a lowercase name');
  if (!Array.isArray(value.cases) || value.cases.length < 1 || value.cases.length > 12) throw new Error('Library bar needs 1–12 focused cases');
  if (!Array.isArray(value.refusals ?? []) || (value.refusals?.length ?? 0) > 24) throw new Error('Use at most 24 named refusals');
  if (!Array.isArray(value.sensitivities ?? []) || (value.sensitivities?.length ?? 0) > 24) throw new Error('Use at most 24 prop sensitivities');
  const ids = new Set();
  for (const entry of [...value.cases, ...(value.refusals ?? [])]) {
    if (!entry || !ID.test(entry.id ?? '') || ids.has(entry.id)) throw new Error('Case and refusal ids must be unique lowercase names');
    ids.add(entry.id);
    if (!(typeof entry.storyboard === 'string' || (entry.storyboard && typeof entry.storyboard === 'object' && !Array.isArray(entry.storyboard))))
      throw new Error(`${entry.id}: storyboard must be an object or JSON file path`);
    if (entry.at != null && (!Array.isArray(entry.at) || !entry.at.length || entry.at.length > 6 || entry.at.some(n => !Number.isFinite(n) || n < 0)))
      throw new Error(`${entry.id}: at needs 1–6 nonnegative sample times`);
    if (entry.minPsnr != null && (!Number.isFinite(entry.minPsnr) || entry.minPsnr < 20 || entry.minPsnr > 80))
      throw new Error(`${entry.id}: minPsnr must be 20–80 dB`);
    if (entry.files != null && (typeof entry.files !== 'object' || Array.isArray(entry.files) || Object.values(entry.files).some(f => typeof f !== 'string')))
      throw new Error(`${entry.id}: files must map project paths to source file paths`);
  }
  for (const entry of value.refusals ?? []) {
    if (typeof entry.match !== 'string' || !entry.match.trim()) throw new Error(`${entry.id}: refusal needs a specific error pattern`);
    new RegExp(entry.match);
  }
  const cases = new Set(value.cases.map(c => c.id)), sensitivityIds = new Set();
  for (const s of value.sensitivities ?? []) {
    if (!ID.test(s.id ?? '') || sensitivityIds.has(s.id) || !cases.has(s.base) || !cases.has(s.changed) || s.base === s.changed)
      throw new Error('Sensitivity needs a unique id and two distinct case ids');
    sensitivityIds.add(s.id);
    if (!Number.isFinite(s.at) || s.at < 0) throw new Error(`${s.id}: sensitivity needs a nonnegative at time`);
    if (s.minChangedFraction != null && (!Number.isFinite(s.minChangedFraction) || s.minChangedFraction <= 0 || s.minChangedFraction > 1))
      throw new Error(`${s.id}: minChangedFraction must be greater than zero and at most one`);
  }
  return value;
}

/** RGB byte comparison: a pixel changes when any channel differs by more than tolerance. */
export function comparePixels(a, b, tolerance = 3) {
  if (!a.length || a.length !== b.length || a.length % 3) throw new Error('Pixel comparisons need equally sized RGB images');
  let changed = 0, squared = 0;
  for (let i = 0; i < a.length; i += 3) {
    let different = false;
    for (let c = 0; c < 3; c++) {
      const d = a[i + c] - b[i + c];
      squared += d * d;
      different ||= Math.abs(d) > tolerance;
    }
    if (different) changed++;
  }
  return { changedPixels: changed, pixels: a.length / 3, changedFraction: changed / (a.length / 3),
    psnr: squared ? 10 * Math.log10(255 ** 2 / (squared / a.length)) : Infinity };
}

function rgb(file) {
  const result = spawnSync(ffmpegBin(), ['-v', 'error', '-threads', '2', '-i', file, '-frames:v', '1', '-threads', '2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 64 * 2 ** 20 });
  if (result.status !== 0) throw new Error(`Could not decode ${file}: ${result.error?.message ?? result.stderr?.toString()}`);
  return result.stdout;
}
function project(entry, dir, base) {
  const storyboard = typeof entry.storyboard === 'string'
    ? JSON.parse(fs.readFileSync(path.resolve(base, entry.storyboard), 'utf8')) : structuredClone(entry.storyboard);
  fs.mkdirSync(dir, { recursive: true });
  for (const [rel, source] of Object.entries(entry.files ?? {})) {
    if (rel === 'storyboard.json' || /^(build|review)(\/|$)/.test(rel)) throw new Error(`${entry.id}: files may only supply source inputs`);
    const dest = inside(dir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(path.resolve(base, source), dest);
  }
  writeJSONAtomic(path.join(dir, 'storyboard.json'), storyboard);
}
const listPngs = dir => fs.readdirSync(dir).filter(f => f.endsWith('.png')).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).map(f => path.join(dir, f));
const relative = (out, file) => path.relative(out, file).split(path.sep).join('/');

function implementation() {
  const files = [];
  const walk = (dir, recursive) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, e.name);
      if (e.isDirectory() && recursive) walk(file, true);
      else if (e.isFile() && /\.(mjs|json)$/.test(e.name)) files.push(file);
    }
  };
  walk(path.join(REPO, 'film'), false);
  walk(path.join(REPO, 'engine/lib'), true);
  walk(path.join(REPO, 'library'), true);
  const hashes = Object.fromEntries(files.sort().map(f => [relative(REPO, f), sha256File(f)]));
  return { hashes, sha256: sha256(JSON.stringify(hashes)) };
}

async function phoneSheet(files, dir) {
  const tiles = path.join(dir, 'phone-tiles');
  fs.mkdirSync(tiles);
  for (const [i, file] of files.entries()) fs.copyFileSync(file, path.join(tiles, `tile-${String(i).padStart(3, '0')}.png`));
  const columns = Math.min(3, files.length), output = path.join(dir, 'phone.png');
  await ffmpeg(['-y', '-framerate', '1', '-i', path.join(tiles, 'tile-%03d.png'), '-vf',
    `scale=360:-2,tile=${columns}x${Math.ceil(files.length / columns)}:padding=8:margin=8:color=0x161b22`, '-frames:v', '1', '-threads', '2', output]);
  fs.rmSync(tiles, { recursive: true, force: true });
  return output;
}

function writeReport(out, report) {
  writeJSONAtomic(path.join(out, 'report.json'), report);
  const link = (file, title) => file ? `<a href="${escapeHTML(file)}">${escapeHTML(title)}</a>` : '';
  fs.writeFileSync(path.join(out, 'index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHTML(report.name)} — library review</title>
<style>body{max-width:1160px;margin:40px auto;padding:0 20px;background:#f5f2eb;color:#20242b;font:17px/1.5 system-ui}h1{font-size:40px;letter-spacing:-.035em}article{border-top:1px solid #b5b5af;padding:28px 0}img{display:block;max-width:100%;height:auto}video{max-width:720px;width:100%;max-height:640px;background:#171b22}a{color:#1c5baa}pre{white-space:pre-wrap}small{color:#52565d}</style>
<h1>${escapeHTML(report.name)}</h1><p>Mechanical result: <strong>${escapeHTML(report.status)}</strong>. Visual judgement: <strong>open</strong>.</p>
<p>Read the intended takeaway, inspect every phone frame, and watch each complete short film. Check hierarchy, legibility, quantity conservation, meaningful change and both sides of each transition. Pixel differences are not visual quality or comprehension proof.</p>
<p>Reference: ${escapeHTML(report.reference ?? 'not supplied')}. ${link('report.json', 'Full report')} · ${link('blind.html', 'Review without the intended takeaway')}</p>
${report.cases.map(c => `<article><h2>${escapeHTML(c.id)} · ${escapeHTML(c.status)}</h2><p>${escapeHTML(c.takeaway ?? 'Takeaway not supplied')}</p><p>${escapeHTML((c.errors ?? []).join('\n'))}</p>${c.phone ? `<img src="${escapeHTML(c.phone)}" alt="360 pixel samples for ${escapeHTML(c.id)}">` : ''}<p><small>Sample times: ${(c.samples ?? []).map(s => `${s.time.toFixed(3)} s`).join(', ')}. ${link(c.qaPhone, 'Complete one-second phone strip')} · ${link(c.project, 'Storyboard')}</small></p>${c.video ? `<video controls preload="metadata" src="${escapeHTML(c.video)}"></video>` : ''}<details><summary>Measurements and warnings</summary><pre>${escapeHTML(JSON.stringify({ samples: c.samples, warnings: c.warnings }, null, 2))}</pre></details></article>`).join('\n')}
<h2>Refusals and prop changes</h2><pre>${escapeHTML(JSON.stringify({ refusals: report.refusals, sensitivities: report.sensitivities }, null, 2))}</pre></html>`);
  // The answer key is absent from this page, not hidden with CSS. This provides a
  // comprehension review surface; it does not claim anyone has completed that review.
  fs.writeFileSync(path.join(out, 'blind.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Library comprehension review</title>
<style>body{max-width:960px;margin:40px auto;padding:0 20px;font:18px/1.5 system-ui;color:#20242b;background:#f5f2eb}article{border-top:1px solid #aaa;padding:28px 0}video{width:100%;max-height:680px}img{max-width:100%;height:auto}</style>
<h1>What does the picture explain?</h1><p>For each film, write what changed, what stayed the same, and the conclusion you would take away. Name any label or transition you could not follow. Then compare your answer with the intended takeaway in the <a href="index.html">main report</a>.</p>
${report.cases.filter(c => c.video).map((c, i) => `<article><h2>Film ${i + 1}</h2><video controls preload="metadata" src="${escapeHTML(c.video)}"></video>${c.phone ? `<p>Phone-size samples</p><img src="${escapeHTML(c.phone)}" alt="Phone samples for film ${i + 1}">` : ''}</article>`).join('\n')}</html>`);
}

export async function runLibraryBar(fixtureFile, { out } = {}) {
  fixtureFile = path.resolve(fixtureFile);
  const fixture = validateBarFixture(JSON.parse(fs.readFileSync(fixtureFile, 'utf8'))), base = path.dirname(fixtureFile);
  out = path.resolve(out ?? path.join(REPO, 'build/library-bar', fixture.name));
  if (fs.existsSync(out)) throw new Error('Library bar output exists; choose a new directory to preserve prior evidence');
  const space = fs.statfsSync(REPO);
  if (space.bavail * space.bsize < 20 * 2 ** 30) throw new Error('Keep 20 GiB free before the library bar');
  fs.mkdirSync(out, { recursive: true });
  const source = implementation();
  writeJSONAtomic(path.join(out, 'implementation.json'), source.hashes);
  const report = { version: 1, name: fixture.name, reference: fixture.reference, status: 'running', visualJudgement: 'open', comprehensionJudgement: 'open',
    fixtureSha256: sha256File(fixtureFile), implementationSha256: source.sha256, rendererSourceHash: sceneHash(), cases: [], refusals: [], sensitivities: [] };
  const prepared = new Map();
  const save = () => writeReport(out, report);
  save();
  const workerKeys = ['CLEARFRAME_RENDER_WORKERS', 'CLEARFRAME_ENCODER_THREADS'];
  const originalWorkers = Object.fromEntries(workerKeys.map(k => [k, process.env[k]]));
  for (const key of workerKeys) process.env[key] = String(Math.max(1, Math.min(2, Number(process.env[key]) || 2)));
  try {
    for (const entry of fixture.cases) {
      const root = path.join(out, entry.id), result = { id: entry.id, takeaway: entry.takeaway, status: 'running', errors: [], warnings: [], samples: [] };
      report.cases.push(result); save();
      try {
        project(entry, root, base);
        result.project = relative(out, path.join(root, 'storyboard.json'));
        const { result: source } = preparedJob(root, { draft: true }), job = source.job;
        if (job.frames / job.fps > 30 || job.width * job.height > 1920 * 1920) throw new Error('Library bar cases are limited to 30 seconds and at most 1920×1920 pixels');
        const extra = (fixture.sensitivities ?? []).filter(s => s.base === entry.id || s.changed === entry.id).map(s => s.at);
        const times = [...new Set([...(entry.at ?? [job.frames / job.fps * 0.25, job.frames / job.fps * 0.75]), ...extra])].sort((a, b) => a - b);
        if (times.length > 6 || times.some(t => t < 0 || t >= job.frames / job.fps)) throw new Error(`${entry.id}: at most six sample/sensitivity times, all inside the film`);
        const indices = [...new Set(times.map(t => Math.min(job.frames - 1, Math.round(t * job.fps))))];
        const checks = await checkProject(root, { draft: true });
        result.errors.push(...checks.errors); result.warnings.push(...checks.warnings);
        writeJSONAtomic(path.join(root, 'checks.json'), checks);
        const video = path.join(root, 'video.mp4');
        const receipt = await renderProject(root, { draft: true, out: video, noAudio: entry.audio !== true, revision: false });
        result.video = relative(out, video); result.videoSha256 = receipt.outputSha256;
        const qa = await qaProject(root, { video });
        result.errors.push(...qa.findings.filter(f => f.level === 'error').map(f => `${f.kind}: ${f.message}`));
        result.warnings.push(...qa.findings.filter(f => f.level === 'warn').map(f => `${f.kind}: ${f.message}`));
        result.qaPhone = relative(out, path.join(qa.dir, 'phone.png'));
        const ctx = await prepareProject(root, { draft: true }), nativeDir = path.join(root, 'native-frames'), decodedDir = path.join(root, 'decoded-frames');
        fs.mkdirSync(nativeDir); fs.mkdirSync(decodedDir);
        await nativeCommand(ctx, 'frame', [indices.join(','), '-o', nativeDir]);
        const nativeFiles = listPngs(nativeDir);
        await ffmpeg(['-y', '-i', video, '-vf', `select=${indices.map(n => `eq(n\\,${n})`).join('+')}`, '-fps_mode', 'vfr', '-start_number', '0', '-threads', '2', path.join(decodedDir, 'frame-%03d.png')]);
        const decodedFiles = listPngs(decodedDir);
        if (nativeFiles.length !== indices.length || decodedFiles.length !== indices.length) throw new Error('The native and encoded sample frame counts differ');
        const frames = new Map();
        for (const [i, frame] of indices.entries()) {
          const metrics = comparePixels(rgb(nativeFiles[i]), rgb(decodedFiles[i]));
          const psnr = metrics.psnr;
          if (psnr < (entry.minPsnr ?? 32)) result.errors.push(`Frame ${frame}: native/encoded PSNR ${psnr.toFixed(2)} dB is below ${entry.minPsnr ?? 32}`);
          result.samples.push({ frame, time: frame / job.fps, native: relative(out, nativeFiles[i]), decoded: relative(out, decodedFiles[i]), psnr: Number.isFinite(psnr) ? psnr : 'identical' });
          frames.set(frame, nativeFiles[i]);
        }
        result.phone = relative(out, await phoneSheet(nativeFiles, root));
        prepared.set(entry.id, { job, frames });
        result.status = result.errors.length ? 'failed' : 'passed';
      } catch (e) { result.errors.push(e.message); result.status = 'failed'; }
      console.log(`${entry.id}: ${result.status}`); save();
    }
    for (const entry of fixture.refusals ?? []) {
      const root = path.join(out, entry.id);
      let errors;
      try { project(entry, root, base); errors = (await checkProject(root, { draft: true })).errors; }
      catch (e) { errors = [e.message]; }
      report.refusals.push({ id: entry.id, status: errors.length && new RegExp(entry.match).test(errors.join('\n')) ? 'passed' : 'failed', expected: entry.match, errors });
      save();
    }
    for (const spec of fixture.sensitivities ?? []) {
      const a = prepared.get(spec.base), b = prepared.get(spec.changed), result = { ...spec, status: 'failed' };
      try {
        if (!a || !b) throw new Error('Sensitivity needs two rendered cases');
        if (a.job.width !== b.job.width || a.job.height !== b.job.height || a.job.fps !== b.job.fps) throw new Error('Sensitivity cases must share dimensions and frame rate');
        const frame = Math.min(a.job.frames - 1, Math.round(spec.at * a.job.fps));
        if (!a.frames.has(frame) || !b.frames.has(frame)) throw new Error('Sensitivity frame is unavailable in one case');
        const metrics = comparePixels(rgb(a.frames.get(frame)), rgb(b.frames.get(frame)));
        result.changedFraction = metrics.changedFraction; result.changedPixels = metrics.changedPixels;
        result.status = metrics.changedFraction >= (spec.minChangedFraction ?? 0.001) ? 'passed' : 'failed';
        if (result.status === 'failed') result.error = 'The declared prop change did not change enough pixels; inspect whether it is actually drawn.';
      } catch (e) { result.error = e.message; }
      report.sensitivities.push(result); save();
    }
    if (sha256File(fixtureFile) !== report.fixtureSha256 || sceneHash() !== report.rendererSourceHash || implementation().sha256 !== report.implementationSha256)
      throw new Error('Fixture or implementation sources changed during the bar run; rerun once the implementation is stable');
    report.status = [...report.cases, ...report.refusals, ...report.sensitivities].every(c => c.status === 'passed') ? 'passed' : 'failed';
    save(); return { directory: out, ...report };
  } catch (e) { report.status = 'failed'; report.error = e.message; save(); throw e; }
  finally {
    for (const [key, value] of Object.entries(originalWorkers))
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
