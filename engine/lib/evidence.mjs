// Which film a measurement is about. A render receipt (VIDEO.json) binds an MP4 to the inputs it
// was made from; `qa` and `review` trust it only after checking it against the file's own bytes and
// the working copy, and say what they checked in what they write. A video with no receipt can still
// be measured, as itself (unbound); a receipt that does not describe the video, or describes an
// older state of the project, is reported, never quietly trusted or quietly ignored.
import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from './store.mjs';
import { REPO_DIR } from './util.mjs';
import { FILM, sceneHash } from '../../scene/engine.mjs';
import { preparedJob } from '../../film/prepare.mjs';

/** A repo- or project-relative path that stays inside `base`, else null. */
function inside(base, rel) {
  if (typeof rel !== 'string' || !rel || path.isAbsolute(rel)) return null;
  const file = path.resolve(base, rel);
  return file.startsWith(path.resolve(base) + path.sep) ? file : null;
}

/**
 * Bind a video to its receipt and the working copy.
 * scope: 'bound' (the receipt describes these bytes and the project as it is now), 'unbound' (no
 * receipt: the measurements describe this file only), 'stale' (the receipt describes these bytes,
 * but the project has changed since: render again) or 'invalid' (the receipt is unreadable, is not
 * a film receipt, or does not describe these bytes).
 * `timing` is the working copy's timing (frames, fps); `probe` the video's ffprobe streams, when read.
 */
export function bindVideo(root, video, { timing, probe } = {}) {
  root = fs.realpathSync(root);
  const file = path.resolve(video);
  const receiptFile = `${file}.json`;
  const evidence = {
    scope: 'unbound',
    video: file,
    videoSha256: sha256File(file),
    receipt: null,
    checked: ['video bytes hashed'],
    unchecked: [],
    problems: [],
  };
  const invalid = [],
    stale = [];
  const done = () => {
    evidence.problems = [...invalid, ...stale];
    evidence.scope = invalid.length ? 'invalid' : stale.length ? 'stale' : evidence.receipt ? 'bound' : 'unbound';
    // Bound to every identity a current receipt records, or only to those an older receipt has.
    evidence.coverage = evidence.scope !== 'bound' ? 'none' : evidence.unchecked.length ? 'partial' : 'full';
    return evidence;
  };
  if (!fs.existsSync(receiptFile)) {
    evidence.unchecked.push('no render receipt beside the video: nothing binds it to a state of the project');
    return done();
  }
  evidence.receipt = receiptFile;
  evidence.receiptSha256 = sha256File(receiptFile);
  let r;
  try {
    r = JSON.parse(fs.readFileSync(receiptFile, 'utf8'));
  } catch (e) {
    invalid.push(`the render receipt ${path.basename(receiptFile)} is not readable JSON (${e.message.split('\n')[0]})`);
    return done();
  }
  if (!r || typeof r !== 'object' || Array.isArray(r)) {
    invalid.push(`the render receipt ${path.basename(receiptFile)} is not a receipt object`);
    return done();
  }
  if (r.kind === 'range-preview') {
    invalid.push(`this is a range preview (frames ${r.range?.frames?.join('–') ?? '?'}), not the film: qa and review read a whole render`);
    return done();
  }
  Object.assign(evidence, {
    profile: r.profile ?? (r.draft ? 'draft' : 'final'),
    inputId: r.inputId ?? null,
    revision: r.revision ?? null,
    outputSha256: r.outputSha256 ?? null,
  });
  // The bytes: everything else in the receipt is about the file it hashes.
  if (typeof r.outputSha256 !== 'string' || !r.outputSha256) {
    invalid.push('the render receipt records no output hash, so it cannot say which video it describes');
    return done();
  }
  if (r.outputSha256 !== evidence.videoSha256) {
    invalid.push(`Video changed since rendering: its bytes (sha256 ${evidence.videoSha256.slice(0, 12)}…) are not the ones its receipt records (${r.outputSha256.slice(0, 12)}…)`);
    return done();
  }
  evidence.checked.push('video bytes match the receipt');
  if (!r.hashes || typeof r.hashes !== 'object' || Array.isArray(r.hashes) || typeof r.hashes['storyboard.json'] !== 'string') {
    invalid.push('the render receipt records no input hashes (not even storyboard.json), so it cannot say which state of the project it shows');
    return done();
  }
  if (!Number.isInteger(r.frames) || !Number.isFinite(r.fps)) invalid.push('the render receipt records no frame count or frame rate');
  if (probe) {
    const v = probe.streams?.find(s => s.codec_type === 'video');
    if (v && Number.isInteger(r.width) && Number.isInteger(r.height) && (v.width !== r.width || v.height !== r.height))
      invalid.push(`the video is ${v.width}×${v.height}; its receipt says ${r.width}×${r.height}`);
    if (v && Number(v.nb_frames) > 0 && Number.isInteger(r.frames) && Number(v.nb_frames) !== r.frames)
      invalid.push(`the video has ${v.nb_frames} frames; its receipt says ${r.frames}`);
  }
  // The project as it is now.
  for (const [rel, hash] of Object.entries(r.hashes)) {
    const input = inside(root, rel);
    if (!input || typeof hash !== 'string') invalid.push(`the render receipt names an input outside the project: ${rel}`);
    else if (!fs.existsSync(input)) stale.push(`Input missing since rendering: ${rel}`);
    else if (sha256File(input) !== hash) stale.push(`Input changed since rendering: ${rel}`);
  }
  evidence.checked.push(`${Object.keys(r.hashes).length} hashed inputs (storyboard, media, voice, music, sound cues)`);
  if (timing && Number.isInteger(r.frames) && (timing.frames !== r.frames || timing.fps !== r.fps))
    stale.push(`Timeline differs from the encoded video: it has ${r.frames} frames at ${r.fps} fps, the storyboard now ${timing.frames} at ${timing.fps}`);
  if (typeof r.rendererSourceHash === 'string') {
    if (r.rendererSourceHash !== sceneHash()) stale.push('the renderer source has changed since this render');
    evidence.checked.push('renderer source');
  } else evidence.unchecked.push('renderer source (the receipt does not record it)');
  if (r.fontHashes && typeof r.fontHashes === 'object') {
    for (const [name, hash] of Object.entries(r.fontHashes)) {
      const font = inside(path.join(FILM, 'assets/fonts'), name);
      if (!font || !fs.existsSync(font) || sha256File(font) !== hash) stale.push(`bundled font changed since rendering: ${name}`);
    }
    evidence.checked.push('bundled fonts');
  } else evidence.unchecked.push('bundled fonts (the receipt does not record them)');
  if (r.finishingSourceHashes && typeof r.finishingSourceHashes === 'object') {
    for (const [rel, hash] of Object.entries(r.finishingSourceHashes)) {
      const code = inside(REPO_DIR, rel);
      if (!code || !fs.existsSync(code) || sha256File(code) !== hash) stale.push(`the finishing code that mixes and places the sound has changed since rendering: ${rel}`);
    }
    evidence.checked.push('finishing code (mix and sound placement)');
  } else evidence.unchecked.push('finishing code (the receipt does not record it)');
  // The film the working copy would draw: a library, palette or treatment edit changes it with no
  // hashed file changing. Receipts from before this check carry no job identity.
  if (typeof r.jobSha256 === 'string') {
    try {
      const profile = evidence.profile;
      const now = preparedJob(root, { draft: profile !== 'final', rough: profile === 'rough' }).jobSha256;
      if (now !== r.jobSha256) stale.push('the film the working copy would draw has changed since this render (a library, palette, treatment or engine edit)');
    } catch (e) {
      stale.push(`the working copy no longer prepares: ${e.message.split('\n')[0]}`);
    }
    evidence.checked.push('prepared job');
  } else evidence.unchecked.push('prepared job (a receipt from before job identity: library or engine edits are not detected)');
  return done();
}

/**
 * After a long read (decoding every frame, metering the sound), check that the video and its
 * receipt are still the bytes that were bound: a file replaced mid-analysis must not lend its
 * measurements to the new one. Marks the evidence invalid and returns the problem, or null.
 */
export function recheck(evidence) {
  const now = fs.existsSync(evidence.video) ? sha256File(evidence.video) : null;
  const receipt = fs.existsSync(`${evidence.video}.json`) ? sha256File(`${evidence.video}.json`) : null;
  let problem = null;
  if (now !== evidence.videoSha256) problem = 'the video changed while it was being measured';
  else if (receipt !== (evidence.receiptSha256 ?? null)) problem = 'the render receipt changed while the video was being measured';
  if (problem) {
    evidence.problems.push(problem);
    evidence.scope = 'invalid';
    evidence.coverage = 'none';
    evidence.checked.push('bytes rechecked after analysis: changed');
  } else evidence.checked.push('bytes rechecked after analysis');
  return problem;
}

/** The findings `qa` reports for its evidence: an unbound film is a warning, a bad binding an error. */
export function identityFindings(evidence) {
  if (evidence.scope === 'bound') return [];
  if (evidence.scope === 'unbound')
    return [{
      level: 'warn',
      kind: 'identity',
      message: 'no render receipt beside this video: these measurements describe this file only, not a revision of the film (render it here, or keep its receipt beside it)',
    }];
  return evidence.problems.map(message => ({ level: 'error', kind: 'identity', message: `${message}. ${evidence.scope === 'stale' ? 'Render again before relying on this QA.' : 'This QA describes the file, not the receipt.'}` }));
}

/** A one-line account of what a measurement is bound to. */
export function evidenceLine(evidence) {
  const sha = evidence.videoSha256.slice(0, 12);
  if (evidence.scope === 'bound')
    return `evidence: bound${evidence.coverage === 'partial' ? ' (partial: an older receipt)' : ''} · ${evidence.profile} render${evidence.revision ? ` ${evidence.revision}` : ''} · input ${String(evidence.inputId ?? '?').slice(0, 12)} · video ${sha}${evidence.unchecked.length ? ` · not checked: ${evidence.unchecked.join('; ')}` : ''}`;
  if (evidence.scope === 'unbound') return `evidence: UNBOUND · video ${sha} has no render receipt: diagnostics for this file only`;
  return `evidence: ${evidence.scope.toUpperCase()} · video ${sha}: ${evidence.problems[0]}`;
}
