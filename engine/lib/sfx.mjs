// A small, tasteful sound-cue library synthesized with ffmpeg (no samples to license, fully reproducible).
// Professional register: soft ticks for counters, a quiet pop for arrivals, a low air "whoosh" for chapter
// changes, a gentle chime for a key landing. Everything sits well under a voiceover.
import fs from 'node:fs';
import path from 'node:path';
import { ffmpeg, REPO_DIR } from './util.mjs';

export const SFX_DIR = process.env.CF_SFX_CACHE ?? path.join(REPO_DIR, 'node_modules', '.cache', 'clearframe', 'sfx');

const noise = '(random(0)*2-1)';
/** name → { expr, dur, filters, about } — mono expression, rendered to 48 kHz stereo WAV. */
export const SFX = {
  tick: {
    dur: 0.12,
    expr: '0.45*sin(2*PI*2200*t)*exp(-70*t)',
    filters: 'highpass=f=500',
    about: 'tiny high tick — counters landing, small markers',
  },
  tock: {
    dur: 0.2,
    expr: '0.5*sin(2*PI*1150*t)*exp(-45*t)+0.18*sin(2*PI*2300*t)*exp(-80*t)',
    filters: 'highpass=f=300',
    about: 'rounder tick — list items, steps',
  },
  pop: {
    dur: 0.22,
    expr: '0.55*sin(2*PI*(520*t-900*t*t))*exp(-28*t)',
    filters: 'highpass=f=120',
    about: 'soft pop — a card or bubble arriving',
  },
  click: {
    dur: 0.05,
    expr: `0.5*${noise}*exp(-300*t)`,
    filters: 'highpass=f=1200,lowpass=f=6000',
    about: 'UI click — cursor clicks, toggles',
  },
  type: {
    dur: 0.035,
    expr: `0.35*${noise}*exp(-450*t)`,
    filters: 'highpass=f=1500,lowpass=f=4500',
    about: 'key tap — typing (used sparsely)',
  },
  whoosh: {
    dur: 0.55,
    expr: `0.3*${noise}*pow(sin(PI*t/0.55),2)`,
    filters: 'highpass=f=250,lowpass=f=1600',
    about: 'low air — chapter transitions (quiet)',
  },
  chime: {
    dur: 1.4,
    expr: '0.28*sin(2*PI*1318.5*t)*exp(-4*t)+0.2*sin(2*PI*1975.5*t)*exp(-5*t)+0.07*sin(2*PI*2637*t)*exp(-7*t)',
    filters: 'afade=t=in:d=0.004',
    about: 'gentle chime — the one key reveal',
  },
  thud: {
    dur: 0.35,
    expr: '0.7*sin(2*PI*(90*t-60*t*t))*exp(-14*t)+0.2*sin(2*PI*180*t)*exp(-25*t)',
    filters: 'lowpass=f=500',
    about: 'soft low hit — a hero number landing',
  },
  // Cinema: the trailer grammar of a swell, a cut to silence, a hit.
  hit: {
    dur: 2.4,
    expr: `0.55*sin(2*PI*(52*t-6*t*t))*exp(-1.8*t)+0.3*sin(2*PI*104*t)*exp(-2.6*t)+0.18*sin(2*PI*78*t)*exp(-2.2*t)+0.4*${noise}*exp(-22*t)`,
    filters: 'lowpass=f=2200,afade=t=in:d=0.003',
    about: 'deep impact — a flash cut, a title landing after a silence',
  },
  riser: {
    dur: 2.5,
    expr: `(0.2*sin(2*PI*(180*t+140*t*t))+0.12*sin(2*PI*(270*t+210*t*t)))*pow(t/2.5,2.2)+0.22*${noise}*pow(t/2.5,3)`,
    filters: 'highpass=f=120,lowpass=f=5000',
    about: 'swell that ends where the silence begins',
  },
  drone: {
    dur: 3,
    expr: '0.16*sin(2*PI*55*t)+0.09*sin(2*PI*82.4*t)+0.05*sin(2*PI*110.3*t)*(0.6+0.4*sin(2*PI*0.7*t))',
    filters: 'lowpass=f=420,afade=t=in:d=0.5,afade=t=out:st=2.3:d=0.7',
    about: 'low room tone under a silent beat',
  },
  shimmer: {
    dur: 1.3,
    expr: '(0.08*sin(2*PI*2637*t)+0.06*sin(2*PI*3951*t)+0.05*sin(2*PI*5274*t))*sin(PI*t/1.3)',
    filters: 'highpass=f=1500,afade=t=in:d=0.2',
    about: 'soft glint as light sweeps a title',
  },
  // Subject sounds: name them in a beat's sfx, cued to a word ({src: 'brake', at: 'catches'}).
  brake: {
    dur: 0.9,
    expr: `0.5*${noise}*exp(-3.5*t)*(1-exp(-80*t))+0.05*sin(2*PI*180*t)*exp(-10*t)`,
    filters: 'highpass=f=1800,lowpass=f=9000',
    about: 'an air brake hissing (a bus stopping)',
  },
  drop: {
    dur: 0.45,
    expr: '0.5*sin(2*PI*(1400*t-1700*t*t))*exp(-14*t)',
    filters: 'highpass=f=250,aecho=0.6:0.4:60:0.25',
    about: 'a water drop',
  },
  rise: {
    dur: 0.9,
    expr: '(0.2*sin(2*PI*330*t)+0.14*sin(2*PI*495*t)+0.09*sin(2*PI*660*t))*pow(t/0.9,2)',
    filters: 'lowpass=f=2400,afade=t=out:st=0.82:d=0.08',
    about: 'short swell into a reveal (use at most once)',
  },
};

/** Path to a built-in cue, synthesizing it on first use. */
export async function sfxFile(name) {
  const def = SFX[name];
  if (!def) throw new Error(`Unknown sfx "${name}". Built-ins: ${Object.keys(SFX).join(', ')}`);
  const file = path.join(SFX_DIR, `${name}.wav`);
  if (fs.existsSync(file)) return file;
  fs.mkdirSync(SFX_DIR, { recursive: true });
  const tmp = `${file}.${process.pid}.tmp.wav`;
  await ffmpeg([
    '-y',
    '-f',
    'lavfi',
    '-i',
    `aevalsrc=exprs='${def.expr}|${def.expr}':s=48000:d=${def.dur}`,
    '-af',
    `${def.filters},afade=t=out:st=${Math.max(0, def.dur - 0.01)}:d=0.01`,
    '-c:a',
    'pcm_s16le',
    tmp,
  ]);
  fs.renameSync(tmp, file);
  return file;
}

/** Resolve a cue name or project-relative path to an absolute file. */
export async function resolveCue(root, name) {
  if (SFX[name]) return sfxFile(name);
  const file = path.join(root, name);
  return fs.existsSync(file) ? file : null;
}
