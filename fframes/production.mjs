// Public surface of the native production pipeline. The work lives in:
//   native-build.mjs  compile and locate the renderer      job.mjs      storyboard → job
//   prepare.mjs       stage media, levels, manifests       render.mjs   film, stills, sheets
//   glyphs.mjs        font coverage checks                 sound.mjs    picture-synced sfx
//   registry.mjs      per-block runtime rules              constants    shared timing values
export { ROOT, REPO, sha256, nativeEnv, binary, run, rendererHash, buildNative, doctor } from './native-build.mjs';
export { ENTRANCE, COVER } from './constants.mjs';
export { missingGlyph } from './glyphs.mjs';
export { createJob } from './job.mjs';
export { soundDesign } from './sound.mjs';
export { prepareProject, nativeCommand, checkProject } from './prepare.mjs';
export { validateVideo, renderProject, stillProject, sheetProject, lookbookProject, worldMap } from './render.mjs';
