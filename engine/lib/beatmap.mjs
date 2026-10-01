// Beat map: tempo and the drop of a music track, measured from the audio itself.
// Automatic beat grids are often a beat or two off, or at double tempo, so the drop is found by
// energy: the bass band in 20 ms windows, where it jumps and stays up. Independent
// implementation of the method in Raphaël Aubry's motion-design pipeline write-up (2026).
import fs from 'node:fs';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { ffmpegBin } from './util.mjs';

const SR = 8000;
const WIN = 0.02; // seconds per energy window
const r3 = n => Math.round(n * 1000) / 1000;

/** Mono samples at 8 kHz, optionally a slice. */
function samples(file, { start = 0, duration } = {}) {
  const r = spawnSync(
    ffmpegBin(),
    [
      '-v',
      'error',
      ...(start > 0 ? ['-ss', String(start)] : []),
      '-i',
      file,
      ...(duration ? ['-t', String(duration)] : []),
      '-vn',
      '-ac',
      '1',
      '-ar',
      String(SR),
      '-f',
      'f32le',
      '-',
    ],
    { maxBuffer: 2 ** 30 },
  );
  if (r.status !== 0) throw new Error(`ffmpeg could not read ${file}: ${r.stderr}`);
  const b = r.stdout;
  return new Float32Array(b.buffer, b.byteOffset, Math.floor(b.length / 4));
}

/** Bass energy per 20 ms window: two one-pole low-passes at 150 Hz. */
export function energies(x) {
  const n = Math.floor(x.length / (SR * WIN)),
    per = Math.round(SR * WIN);
  const a = 1 - Math.exp((-2 * Math.PI * 150) / SR);
  const bass = new Float64Array(n);
  let l1 = 0,
    l2 = 0;
  for (let w = 0; w < n; w++) {
    let sb = 0;
    for (let k = w * per; k < (w + 1) * per; k++) {
      l1 += a * (x[k] - l1);
      l2 += a * (l1 - l2);
      sb += l2 * l2;
    }
    bass[w] = sb / per;
  }
  return { bass };
}

const db = e => 10 * Math.log10(e + 1e-12);
const mean = (arr, a, b) => {
  let s = 0;
  for (let i = a; i < b; i++) s += arr[i];
  return s / Math.max(1, b - a);
};

/**
 * The drop: the window where the bass jumps most from the two seconds before to the two
 * seconds after, among jumps that reach the track's loud level, refined to the first 20 ms
 * window that crosses halfway. Pure, so it can be tested on synthetic energies.
 */
export function findDrop(bass, { from = 0, to = bass.length, span = 2, gate = true } = {}) {
  const S = Math.round(span / WIN);
  const lo = Math.max(S, from),
    hi = Math.min(bass.length - S, to);
  if (hi <= lo) return null;
  // The loud level: the 90th percentile of two-second means across the track.
  const levels = [];
  for (let i = S; i < bass.length - S; i += 5) levels.push(db(mean(bass, i, i + S)));
  levels.sort((a, b) => a - b);
  const loud = levels[Math.floor(levels.length * 0.9)] ?? 0;
  let best = null;
  for (let i = lo; i < hi; i++) {
    const before = db(mean(bass, i - S, i)),
      after = db(mean(bass, i, i + S));
    const jump = after - before;
    if (gate && after < loud - 6) continue;
    if (!best || jump > best.jump) best = { i, jump, before, after };
  }
  if (!best || best.jump < 3) return null;
  // Refine: the first window within ±0.3 s whose energy crosses the midpoint.
  const mid = (best.before + best.after) / 2,
    R = Math.round(0.3 / WIN);
  let at = best.i;
  for (let i = Math.max(1, best.i - R); i <= Math.min(bass.length - 1, best.i + R); i++)
    if (db(bass[i]) >= mid && db(bass[i - 1]) < mid) {
      at = i;
      break;
    }
  return { t: r3(at * WIN), jump: Math.round(best.jump * 10) / 10 };
}

/**
 * Tempo from a comb over the autocorrelation of the onset envelope (rises in loudness every
 * 5 ms), scoring each tempo at one, two and four beats so off-beat hats don't read as the
 * pulse; 60–180 BPM, with the phase of the grid. Half and double tempo stay listed: a 74 BPM
 * half-time track is easily read as 148. On synthetic tracks at 74–140 BPM it finds the
 * tempo or its double; the drop is the measurement to trust.
 */
export function findTempo(onsets, hop = HOP) {
  const n = onsets.length;
  const on = Float64Array.from(onsets);
  let m = 0;
  for (const v of on) m += v;
  m /= n || 1;
  for (let i = 0; i < n; i++) on[i] -= m;
  const memo = new Map();
  const ac = L => {
    if (!memo.has(L)) {
      let s = 0;
      for (let i = 0; i + L < n; i++) s += on[i] * on[i + L];
      memo.set(L, s / Math.max(1, n - L));
    }
    return memo.get(L);
  };
  const at = l => {
    const k = Math.floor(l),
      f = l - k;
    return ac(k) * (1 - f) + ac(k + 1) * f;
  };
  const scores = [];
  for (let bpm = 60; bpm <= 180; bpm += 0.25) {
    const L = 60 / bpm / hop;
    if (4 * L + 2 >= n) continue;
    // A mild prior, one octave wide around 120 BPM, breaks the tie between a tempo and its half.
    const prior = Math.exp(-0.5 * Math.log2(bpm / 120) ** 2);
    scores.push({ bpm, score: (at(L) + 0.5 * at(2 * L) + 0.25 * at(4 * L)) * prior });
  }
  if (!scores.length) return null;
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0];
  // A second, distinct reading (not a neighbour of the first), then half and double.
  const other = scores.find(s => Math.abs(s.bpm - best.bpm) > 3)?.bpm;
  const period = 60 / best.bpm;
  // Phase: the offset whose grid collects the most onset energy.
  let phase = 0,
    top = -Infinity;
  for (let p = 0; p < period; p += hop) {
    let s = 0;
    for (let t = p; t < n * hop; t += period) s += on[Math.round(t / hop)] ?? 0;
    if (s > top) ((top = s), (phase = p));
  }
  const alternatives = [...new Set([other, best.bpm / 2, best.bpm * 2])].filter(b => b && b >= 40 && b <= 240);
  return { bpm: best.bpm, alternatives, phase: r3(phase) };
}

const HOP = 0.005;
/** Onset envelope: positive change in loudness over 10 ms, every 5 ms. */
export function onsets(x) {
  const per = Math.round(SR * HOP),
    n = Math.floor(x.length / per);
  const e = new Float64Array(n),
    on = new Float64Array(n);
  for (let w = 0; w < n; w++) {
    let s = 0;
    for (let k = w * per; k < (w + 1) * per; k++) s += x[k] * x[k];
    e[w] = db(s / per);
  }
  for (let i = 2; i < n; i++) on[i] = Math.max(0, e[i] - e[i - 2]);
  return on;
}

const cache = new Map();
/** Tempo and drop of a track, cached by content hash (timing reads it on every call). */
export function analyseTrack(file) {
  const hash = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  if (cache.has(hash)) return cache.get(hash);
  const x = samples(file);
  const { bass } = energies(x);
  const result = { seconds: r3(bass.length * WIN), tempo: findTempo(onsets(x)), drop: findDrop(bass) };
  cache.set(hash, result);
  return result;
}

/**
 * The drop as heard in a finished film's mix: the strongest jump of the bass from the 0.4 s
 * before to the 0.4 s after, within half a second of the planned moment. Measure the result,
 * not the plan (voice, ducking and hits all sit on top of the song).
 */
export function measureDrop(file, { near, window = 0.5 }) {
  const start = Math.max(0, near - window - 1);
  const { bass } = energies(samples(file, { start, duration: 2 * window + 2 }));
  const d = findDrop(bass, {
    from: Math.round((near - window - start) / WIN),
    to: Math.round((near + window - start) / WIN),
    span: 0.4,
    gate: false,
  });
  return d ? { ...d, t: r3(d.t + start) } : null;
}

/** Where each cut sits against the track's beat grid, in milliseconds (positive: after the beat). */
export function cutsOnGrid(beats, { bpm, phase }, offset = 0) {
  const period = 60 / bpm;
  return beats.slice(1).map(b => {
    const songT = b.start + offset - phase;
    const k = Math.round(songT / period);
    return { id: b.id, t: r3(b.start), ms: Math.round((songT - k * period) * 1000), beat: k + 1 };
  });
}
