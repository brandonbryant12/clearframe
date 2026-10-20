import {
  checkRecordedVideo,
  checkProjectInputs,
  checkTimeline,
  checkRenderer,
  checkFonts,
  checkFinishing,
  checkPreparedJob,
} from './evidence-checks.mjs';
import { errorMessage, isRecord } from './errors.mjs';
import { decodeReceipt } from './evidence-contracts.mjs';
import type {
  VideoEvidence,
  VideoReceipt,
  EvidenceOptions,
  IdentityFinding,
} from './evidence-contracts.mjs';
export type { VideoEvidence, EvidenceOptions } from './evidence-contracts.mjs';
// Which film a measurement is about. A render receipt (VIDEO.json) binds an MP4 to the inputs it
// was made from; `qa` and `review` trust it only after checking it against the file's own bytes and
// the working copy, and say what they checked in what they write. A video with no receipt can still
// be measured, as itself (unbound); a receipt that does not describe the video, or describes an
// older state of the project, is reported, never quietly trusted or quietly ignored.
// Which film a measurement is about. A render receipt (VIDEO.json) binds an MP4 to the inputs it
// was made from; `qa` and `review` trust it only after checking it against the file's own bytes and
// the working copy, and say what they checked in what they write. A video with no receipt can still
// be measured, as itself (unbound); a receipt that does not describe the video, or describes an
// older state of the project, is reported, never quietly trusted or quietly ignored.
import fs from 'node:fs';
import path from 'node:path';
import { sha256File } from './store.mjs';

/**
 * Bind a video to its receipt and the working copy.
 * scope: 'bound' (the receipt describes these bytes and the project as it is now), 'unbound' (no
 * receipt: the measurements describe this file only), 'stale' (the receipt describes these bytes,
 * but the project has changed since: render again) or 'invalid' (the receipt is unreadable, is not
 * a film receipt, or does not describe these bytes).
 * `timing` is the working copy's timing (frames, fps); `probe` the video's ffprobe streams, when read.
 */
export function bindVideo(
  root: string,
  video: string,
  { timing, probe }: EvidenceOptions = {},
): VideoEvidence {
  root = fs.realpathSync(root);
  const file = path.resolve(video);
  const receiptFile = `${file}.json`;
  const evidence: VideoEvidence = {
    scope: 'unbound',
    video: file,
    videoSha256: sha256File(file),
    receipt: null,
    checked: ['video bytes hashed'],
    unchecked: [],
    problems: [],
  };
  const invalid: string[] = [],
    stale: string[] = [];
  const done = () => finishEvidence(evidence, invalid, stale);
  if (!fs.existsSync(receiptFile)) {
    evidence.unchecked.push(
      'no render receipt beside the video: nothing binds it to a state of the project',
    );
    return done();
  }
  evidence.receipt = receiptFile;
  evidence.receiptSha256 = sha256File(receiptFile);
  const r = readReceipt(receiptFile, invalid);
  if (!r) return done();
  if (r.kind === 'range-preview') {
    invalid.push(
      `this is a range preview (frames ${r.range?.frames?.join('–') ?? '?'}), not the film: qa and review read a whole render`,
    );
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
    invalid.push(
      'the render receipt records no output hash, so it cannot say which video it describes',
    );
    return done();
  }
  if (r.outputSha256 !== evidence.videoSha256) {
    invalid.push(
      `Video changed since rendering: its bytes (sha256 ${evidence.videoSha256.slice(0, 12)}…) are not the ones its receipt records (${r.outputSha256.slice(0, 12)}…)`,
    );
    return done();
  }
  evidence.checked.push('video bytes match the receipt');
  if (
    !r.hashes ||
    typeof r.hashes !== 'object' ||
    Array.isArray(r.hashes) ||
    typeof r.hashes['storyboard.json'] !== 'string'
  ) {
    invalid.push(
      'the render receipt records no input hashes (not even storyboard.json), so it cannot say which state of the project it shows',
    );
    return done();
  }
  const state = { root, evidence, invalid, stale };
  checkRecordedVideo(r, state, probe);
  checkProjectInputs(r, state);
  checkTimeline(r, state, timing);
  checkRenderer(r, state);
  checkFonts(r, state);
  checkFinishing(r, state);
  checkPreparedJob(r, state);
  return done();
}

/**
 * After a long read (decoding every frame, metering the sound), check that the video and its
 * receipt are still the bytes that were bound: a file replaced mid-analysis must not lend its
 * measurements to the new one. Marks the evidence invalid and returns the problem, or null.
 */
export function recheck(evidence: VideoEvidence): string | null {
  const now = fs.existsSync(evidence.video) ? sha256File(evidence.video) : null;
  const receipt = fs.existsSync(`${evidence.video}.json`)
    ? sha256File(`${evidence.video}.json`)
    : null;
  let problem = null;
  if (now !== evidence.videoSha256)
    problem = 'the video changed while it was being measured';
  else if (receipt !== (evidence.receiptSha256 ?? null))
    problem = 'the render receipt changed while the video was being measured';
  if (problem) {
    evidence.problems.push(problem);
    evidence.scope = 'invalid';
    evidence.coverage = 'none';
    evidence.checked.push('bytes rechecked after analysis: changed');
  } else evidence.checked.push('bytes rechecked after analysis');
  return problem;
}

/** The findings `qa` reports for its evidence: an unbound film is a warning, a bad binding an error. */
export function identityFindings(evidence: VideoEvidence): IdentityFinding[] {
  if (evidence.scope === 'bound') return [];
  if (evidence.scope === 'unbound')
    return [
      {
        level: 'warn',
        kind: 'identity',
        message:
          'no render receipt beside this video: these measurements describe this file only, not a revision of the film (render it here, or keep its receipt beside it)',
      },
    ];
  return evidence.problems.map((message) => ({
    level: 'error',
    kind: 'identity',
    message: `${message}. ${evidence.scope === 'stale' ? 'Render again before relying on this QA.' : 'This QA describes the file, not the receipt.'}`,
  }));
}

/** A one-line account of what a measurement is bound to. */
export function evidenceLine(evidence: VideoEvidence): string {
  const sha = evidence.videoSha256.slice(0, 12);
  if (evidence.scope === 'bound')
    return `evidence: bound${evidence.coverage === 'partial' ? ' (partial: an older receipt)' : ''} · ${evidence.profile} render${evidence.revision ? ` ${evidence.revision}` : ''} · input ${String(evidence.inputId ?? '?').slice(0, 12)} · video ${sha}${evidence.unchecked.length ? ` · not checked: ${evidence.unchecked.join('; ')}` : ''}`;
  if (evidence.scope === 'unbound')
    return `evidence: UNBOUND · video ${sha} has no render receipt: diagnostics for this file only`;
  return `evidence: ${evidence.scope.toUpperCase()} · video ${sha}: ${evidence.problems[0]}`;
}

function finishEvidence(
  evidence: VideoEvidence,
  invalid: string[],
  stale: string[],
): VideoEvidence {
  evidence.problems = [...invalid, ...stale];
  if (invalid.length) evidence.scope = 'invalid';
  else if (stale.length) evidence.scope = 'stale';
  else evidence.scope = evidence.receipt ? 'bound' : 'unbound';
  evidence.coverage = 'none';
  if (evidence.scope === 'bound')
    evidence.coverage = evidence.unchecked.length ? 'partial' : 'full';
  return evidence;
}

function readReceipt(file: string, invalid: string[]): VideoReceipt | null {
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    invalid.push(
      `the render receipt ${path.basename(file)} is not readable JSON (${errorMessage(e).split('\n')[0]})`,
    );
    return null;
  }
  if (!isRecord(raw)) {
    invalid.push(
      `the render receipt ${path.basename(file)} is not a receipt object`,
    );
    return null;
  }
  try {
    return decodeReceipt(raw);
  } catch (e) {
    invalid.push(
      `the render receipt ${path.basename(file)} has invalid fields (${errorMessage(e).split('\n')[0]})`,
    );
    return null;
  }
}
