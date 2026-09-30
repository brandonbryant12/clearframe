// Per-frame voice levels for audio-reactive graphics (speaker tags, meters, level loops).
// Prepared once per render from the exact WAV the mix uses, so frames stay pure functions
// of their inputs.
import fs from 'node:fs';

/** 16-bit mono PCM samples and rate from a WAV file. */
export function readPCM(file) {
  const buf = fs.readFileSync(file);
  if (buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE')
    throw new Error(`${file} is not a WAV file`);
  let offset = 12,
    format = null,
    data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4),
      size = buf.readUInt32LE(offset + 4);
    if (id === 'fmt ')
      format = {
        channels: buf.readUInt16LE(offset + 10),
        rate: buf.readUInt32LE(offset + 12),
        bits: buf.readUInt16LE(offset + 22),
      };
    if (id === 'data') {
      data = buf.subarray(offset + 8, Math.min(buf.length, offset + 8 + size));
      break;
    }
    offset += 8 + size + (size % 2);
  }
  if (!format || !data || format.channels !== 1 || format.bits !== 16)
    throw new Error(`${file}: expected 16-bit mono PCM`);
  return { rate: format.rate, pcm: data };
}

/**
 * Levels 0–100 for `frames` scene frames, with the voice starting `offset` seconds into the
 * scene. Loudness maps −50…−12 dBFS to 0…1 with a fast attack and a slower release, so bars
 * jump with syllables and settle through short gaps.
 */
export function voiceLevels(file, { fps, frames, offset = 0 }) {
  const { rate, pcm } = readPCM(file);
  const samples = pcm.length / 2,
    out = new Array(frames).fill(0);
  let smooth = 0;
  for (let f = 0; f < frames; f++) {
    const t = f / fps - offset;
    let level = 0;
    if (t >= 0) {
      const a = Math.floor(t * rate),
        b = Math.min(samples, Math.floor((t + 1.5 / fps) * rate));
      if (b > a) {
        let sum = 0;
        for (let i = a; i < b; i++) {
          const v = pcm.readInt16LE(i * 2) / 32768;
          sum += v * v;
        }
        const db = 10 * Math.log10(sum / (b - a) + 1e-12);
        level = Math.min(1, Math.max(0, (db + 50) / 38)) ** 1.4;
      }
    }
    smooth = level > smooth ? smooth + (level - smooth) * 0.7 : smooth + (level - smooth) * 0.22;
    out[f] = Math.round(smooth * 100);
  }
  return out;
}
