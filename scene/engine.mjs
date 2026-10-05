// The render-engine boundary. ClearFrame draws every film with the scene engine
// (`scene/native`, Skia on Metal, driven by build/native/plan.json); the FFFrames renderer
// (`fframes/native`) remains selectable for comparison and for recovering older projects.
//
//   CLEARFRAME_ENGINE=fframes | storyboard "engine": "fframes" | --engine fframes
//
// Both engines take the same prepared job; the scene engine also reads the plan, whose native
// stage layers only it can draw. Commands keep one vocabulary: render [A..B], frame LIST,
// inspect, audit.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { ROOT as FFRAMES, REPO, sha256, nativeEnv, run, rendererHash, buildNative, binary as fframesBinary } from '../fframes/native-build.mjs';
import { readJSON, writeJSON, log } from '../engine/lib/util.mjs';

export const SCENE = path.dirname(fileURLToPath(import.meta.url));
export const ENGINES = ['scene', 'fframes'];
export const DEFAULT_ENGINE = 'scene';

/** Which engine draws this project: the environment, then the storyboard, then the default. */
export function engineFor(sb = {}) {
  const chosen = process.env.CLEARFRAME_ENGINE || sb.engine || DEFAULT_ENGINE;
  if (!ENGINES.includes(chosen)) throw new Error(`engine must be ${ENGINES.join(' or ')}, not ${chosen}`);
  return chosen;
}

const TARGET = () => path.join(SCENE, '.cache/target');
export const sceneBinary = () => path.join(TARGET(), 'release/clearframe-scene');
const walk = dir =>
  fs.existsSync(dir)
    ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]))
    : [];
function sceneSources() {
  const crate = path.join(SCENE, 'native');
  return [...walk(path.join(crate, 'src')), path.join(crate, 'Cargo.toml'), path.join(crate, 'Cargo.lock')].sort();
}
/** The scene engine's identity: its own sources plus the block layers it draws (fframes/native). */
export function sceneHash() {
  const crate = path.join(SCENE, 'native');
  const own = sha256(Buffer.concat(sceneSources().map(f => Buffer.concat([Buffer.from(path.relative(crate, f) + '\0'), fs.readFileSync(f)]))));
  return sha256(`${own}\0${rendererHash()}`);
}
export const engineHash = engine => (engine === 'fframes' ? rendererHash() : sceneHash());

export const sceneEnv = () => ({ ...nativeEnv(), CARGO_TARGET_DIR: TARGET() });

function lockHolder() {
  try {
    const pid = Number(fs.readFileSync(`/private/tmp/codex-heavy-${os.userInfo().uid}.lock`, 'utf8').trim());
    return Number.isInteger(pid) && pid > 0 && pid !== process.pid ? pid : null;
  } catch {
    return null;
  }
}

/** Build the scene engine when its sources (or the block layers') changed. One Cargo job. */
export async function buildScene({ force = false } = {}) {
  const hash = sceneHash();
  const marker = path.join(SCENE, '.cache/build.json');
  if (!force && fs.existsSync(sceneBinary()) && readJSON(marker, null)?.hash === hash) return sceneBinary();
  const st = fs.statfsSync(SCENE),
    free = (st.bavail * st.bsize) / 2 ** 30;
  const warm = fs.existsSync(path.join(TARGET(), 'release/deps'));
  // A cold target reuses the FFFrames dependency cache when there is one: same lock graph.
  if (!warm && fs.existsSync(path.join(FFRAMES, '.cache/metal/release/deps'))) {
    fs.mkdirSync(path.dirname(TARGET()), { recursive: true });
    log.step('Seeding the scene engine cache from the FFFrames build cache (copy-on-write where the disk supports it)');
    fs.cpSync(path.join(FFRAMES, '.cache/metal'), TARGET(), { recursive: true, mode: fs.constants.COPYFILE_FICLONE });
  }
  if (free < (warm ? 10 : 25)) throw new Error(`The scene engine build needs ${warm ? 10 : 25} GiB free; ${free.toFixed(1)} GiB available.`);
  log.step(`Building the scene engine ${warm ? 'with the existing dependency cache' : 'from a cold cache'} (one Cargo job)`);
  const gate = path.join(os.homedir(), '.local/bin/codex-heavy');
  const cargo = ['build', '--manifest-path', path.join(SCENE, 'native/Cargo.toml'), '--release', '--locked', '--jobs', '1'];
  if (fs.existsSync(gate) && process.env.CLEARFRAME_HEAVY_HELD !== '1') {
    const holder = lockHolder();
    if (holder) log.warn(`Heavy-job lock is held by PID ${holder}; the build starts when it finishes.`);
    await run(gate, ['--', 'cargo', ...cargo], { env: sceneEnv() });
  } else await run('cargo', cargo, { env: sceneEnv() });
  const built = fs.statSync(sceneBinary()).mtimeMs;
  const current = [...sceneSources(), path.join(FFRAMES, 'constants.json')].every(f => fs.statSync(f).mtimeMs <= built);
  writeJSON(marker, { hash: current ? sceneHash() : hash, backend: process.platform === 'darwin' ? 'skia-metal' : 'skia-raster' });
  return sceneBinary();
}

export const buildEngine = engine => (engine === 'fframes' ? buildNative() : buildScene());
export const engineBinary = engine => (engine === 'fframes' ? fframesBinary() : sceneBinary());

/**
 * Run a command on the prepared project with its engine. Arguments use the FFFrames CLI form
 * (`render [A..B] --draft --scale S -o OUT`, `frame LIST -o DIR`, `inspect --fail-on error`,
 * `--audit FILE`); the scene engine takes the same words after `--plan`.
 */
export async function engineCommand(ctx, command, args = [], capture = false) {
  const engine = ctx.manifest?.renderer === 'fframes' ? 'fframes' : 'scene';
  const bin = await buildEngine(engine);
  if (engine === 'fframes')
    return run(bin, ['--job', path.join(ctx.dir, 'job.json'), '--media', ctx.media, command, ...args], { capture, cwd: ctx.dir });
  const flags = [];
  const rest = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--draft') flags.push('--draft');
    else if (args[i] === '--scale') flags.push('--scale', args[++i]);
    else rest.push(args[i]);
  }
  const words = command === '--audit' ? ['audit', ...rest] : [command, ...rest];
  return run(bin, ['--plan', path.join(ctx.dir, 'plan.json'), ...flags, ...words], { capture, cwd: ctx.dir, env: sceneEnv() });
}

export const backendOf = engine => (engine === 'fframes' ? 'fframes skia-metal' : process.platform === 'darwin' ? 'scene skia-metal' : 'scene skia-raster');
export { REPO };
