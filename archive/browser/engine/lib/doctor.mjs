// `clearframe doctor` — verify every dependency ClearFrame uses, and say how to fix what's missing.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { ffmpegBin, require } from './util.mjs';

const FILTERS = ['scale', 'format', 'loudnorm', 'sidechaincompress', 'silencedetect', 'silenceremove', 'adelay', 'amix', 'apad', 'atrim', 'asetpts', 'aresample', 'aformat', 'asplit', 'afade', 'aecho', 'lowpass', 'highpass', 'volume', 'areverse', 'aevalsrc'];
const ENCODERS = ['libx264', 'aac', 'pcm_s16le'];
const DECODERS = ['mjpeg', 'png'];

export async function doctor() {
  const rows = [];
  const add = (level, what, detail, fix) => rows.push({ level, what, detail, fix });

  const [major] = process.versions.node.split('.').map(Number);
  if (major >= 22) add('ok', 'Node.js', `v${process.versions.node}`);
  else if (major >= 20) add('warn', 'Node.js', `v${process.versions.node} — fine; Node ≥ 22 needed only for Lyria RealTime (WebSocket)`);
  else add('fail', 'Node.js', `v${process.versions.node}`, 'Install Node 20+ (22 recommended): https://nodejs.org');

  let bin = null;
  try { bin = ffmpegBin(); } catch { /* reported below */ }
  if (!bin) add('fail', 'ffmpeg', 'not found', 'macOS: brew install ffmpeg · Debian/Ubuntu: sudo apt install ffmpeg · Windows: winget install ffmpeg · or npm i ffmpeg-static');
  else {
    const ver = spawnSync(bin, ['-version']).stdout.toString().split('\n')[0];
    add('ok', 'ffmpeg', `${ver.replace('ffmpeg version ', '').split(' ')[0]} (${bin})`);
    const filters = spawnSync(bin, ['-hide_banner', '-filters']).stdout.toString();
    const missingF = FILTERS.filter((f) => !new RegExp(`\\s${f}\\s`).test(filters));
    const enc = spawnSync(bin, ['-hide_banner', '-encoders']).stdout.toString();
    const missingE = ENCODERS.filter((e) => !new RegExp(`\\s${e}\\s`).test(enc));
    const dec = spawnSync(bin, ['-hide_banner', '-decoders']).stdout.toString();
    const missingD = DECODERS.filter((d) => !new RegExp(`\\s${d}\\s`).test(dec));
    if (missingF.length || missingE.length || missingD.length) add('fail', 'ffmpeg features', `missing: ${[...missingF, ...missingE, ...missingD].join(', ')}`, 'Install a full ffmpeg build (with libx264), e.g. brew install ffmpeg');
    else add('ok', 'ffmpeg features', `libx264, aac, ${FILTERS.length} audio/video filters`);
  }

  try {
    const puppeteer = (await import('puppeteer')).default;
    const exe = await puppeteer.executablePath();
    if (fs.existsSync(exe)) add('ok', 'Headless Chrome', exe.replace(process.env.HOME ?? '', '~'));
    else add('fail', 'Headless Chrome', 'not downloaded', 'npx puppeteer browsers install chrome');
  } catch (e) { add('fail', 'puppeteer', e.message, 'npm install'); }

  for (const [pkg, what] of [['gsap', 'GSAP (animation)'], ['lucide-static', 'Lucide icons'], ['@fontsource-variable/inter', 'Font: Inter'], ['@fontsource/instrument-serif', 'Font: Instrument Serif'], ['@fontsource-variable/jetbrains-mono', 'Font: JetBrains Mono'], ['@fontsource-variable/fraunces', 'Font: Fraunces']]) {
    try { const v = require(`${pkg}/package.json`).version; add('ok', what, `${pkg}@${v}`); } catch { add('fail', what, `${pkg} missing`, 'npm install'); }
  }

  const say = process.platform === 'darwin' && spawnSync('say', ['-v', '?']).status === 0;
  const espeak = ['espeak-ng', 'espeak'].find((b) => spawnSync(b, ['--version']).status === 0);
  if (say) add('ok', 'Draft voice', 'macOS say');
  else if (espeak) add('ok', 'Draft voice', espeak);
  else add('warn', 'Draft voice', 'no local TTS (`voice --draft` unavailable)', 'Linux: sudo apt install espeak-ng — or skip drafts and use Gemini TTS');

  if (process.env.GEMINI_API_KEY) add('ok', 'GEMINI_API_KEY', 'set (only used by voice / music / images / clips)');
  else add('warn', 'GEMINI_API_KEY', 'not set — drafts and rendering work; paid generation will not', 'export GEMINI_API_KEY=… (https://aistudio.google.com/apikey)');

  return rows;
}
