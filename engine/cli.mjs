#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { resolveProject } from './lib/project.mjs';
import { writeJSON } from './lib/util.mjs';
import { enterGate } from './lib/resource-gate.mjs';
import { BLOCKS, THEMES, MOTIONS, TRANSITIONS, markdownCatalog } from '../fframes/catalog.mjs';
import { PLAYBOOKS, scaffold, writeGallery } from '../fframes/playbooks.mjs';
import { ICONS, ICON_SOURCE } from '../fframes/icons.mjs';
import * as native from '../fframes/production.mjs';

const HELP=`ClearFrame — FFFrames motion graphics

  new <dir> [--playbook concept-explainer] [--theme ink] [--vertical]
  playbooks | recipes                 narrative starting points
  blocks [name] [--json | --md]        native building blocks and props
  themes | motions                    palette presets and movement choices
  icons                              bundled Tabler vector assets and provenance
  doctor | build                      native dependencies and compiler
  gallery <new-dir> [--vertical] [--theme ink] [--only bars,kinetic]
  plan <dir>                          approximate generation cost and cache state
  voice <dir> [--draft]                local voice or paid Gemini TTS
  music <dir> [--draft]                local bed or paid Lyria MP3
  images | clips <dir> [--only id] [--budget dollars] [--force]
  speech <dir> --beat id --audio recording.wav --transcript text.txt [--words words.json]
  align <dir> --beat id --words words.json     import measured word timestamps
  align <dir> --beat id --transcribe [--budget dollars]  paid Gemini word timestamps
  timing | captions <dir>             timing JSON / SRT and VTT
  check <dir> [--draft]                validate inputs and native diagnostics
  still <dir> --at seconds | --beat id [--pos .6] [--draft] [--out image.png]
  sheet <dir> [--per 1|2|3] [--draft] [--out sheet.png]
  looks <dir> [--beat id] [--draft]    compare the same frame in four palettes
  review <dir> [--beat id] [--video film.mp4]  decoded cut/word-boundary filmstrip
  render | preview <dir> [--draft] [--out film.mp4] [--no-audio] [--force]

FFFrames is the only active renderer. Preview produces a review MP4.
Draft permits estimated narration/word timing; output keeps the authored dimensions.
Native work automatically uses the local codex-heavy gate when available.
Paid generation needs GEMINI_API_KEY; rendering and word-file imports are free.
`;
async function main(){
  const [cmd,...args]=process.argv.slice(2);
  const strings=['title','theme','playbook','recipe','only','budget','at','beat','pos','out','per','columns','thumb','audio','transcript','words','video'];
  const booleans=['draft','force','vertical','json','md','no-audio','transcribe','help'];
  const {values:o,positionals}=parseArgs({args,allowPositionals:true,options:Object.fromEntries([...strings.map(k=>[k,{type:'string'}]),...booleans.map(k=>[k,{type:'boolean'}])])});
  if(!cmd||cmd==='help'||o.help)return console.log(HELP);
  if(['build','gallery','render','preview','sheet','still','looks','review','check','voice','music','speech'].includes(cmd)&&await enterGate())return;
  const num=k=>{if(o[k]==null)return undefined;const n=Number(o[k]);if(!Number.isFinite(n))throw new Error(`--${k} must be a number`);return n;};
  const opts={...o,only:o.only?.split(','),budget:num('budget'),at:num('at'),pos:num('pos'),per:num('per'),columns:num('columns'),thumb:num('thumb'),noAudio:o['no-audio']};
  if(opts.budget!=null&&opts.budget<0)throw new Error('budget must be nonnegative');
  if(cmd==='new'){const dir=path.resolve(positionals[0]??'my-video');scaffold(dir,opts);return console.log(`Created ${dir}. Edit storyboard.json, then voice --draft, sheet --draft, and render --draft.`);}
  if(['playbooks','recipes'].includes(cmd))return console.log(o.json?JSON.stringify(PLAYBOOKS,null,2):PLAYBOOKS.map(p=>`${p.id.padEnd(24)} ${p.title}\n  ${p.audience} · ${p.inputs}`).join('\n'));
  if(cmd==='blocks'){const b=positionals[0]?BLOCKS.find(b=>b.name===positionals[0]):null;if(positionals[0]&&!b)throw new Error('Unknown block');return console.log(o.md?markdownCatalog():o.json||b?JSON.stringify(b??BLOCKS,null,2):BLOCKS.map(b=>`${b.name.padEnd(14)} ${b.summary}`).join('\n'));}
  if(cmd==='themes')return console.log(JSON.stringify(THEMES,null,2));
  if(cmd==='icons')return console.log(JSON.stringify({icons:ICONS,...ICON_SOURCE},null,2));
  if(cmd==='motions')return console.log(JSON.stringify({presets:MOTIONS,intensity:'0–1',transitions:TRANSITIONS},null,2));
  if(cmd==='doctor'){const rows=native.doctor();console.table(rows);if(rows.some(r=>!r.ok))process.exitCode=1;return;}
  if(cmd==='build')return console.log(await native.buildNative(opts));
  if(cmd==='gallery'){const dir=path.resolve(positionals[0]??'build/native-gallery');await writeGallery(dir,opts);return console.log(await native.sheetProject(dir,{...opts,draft:true,per:1,columns:4}));}
  const dir=resolveProject(positionals[0]);
  if(['plan','voice','music','images','clips'].includes(cmd)){const g=await import('./lib/generate.mjs');const result=await g[cmd==='music'?'scoreMusic':cmd](dir,opts);if(result)console.log(JSON.stringify(result,null,2));return;}
  if(cmd==='speech'){if(!o.audio||!o.transcript)throw new Error('speech needs --audio and --transcript (text file)');const {importSpeech}=await import('./lib/speech.mjs');return console.log(await importSpeech(dir,{beat:o.beat,audio:o.audio,transcript:fs.readFileSync(o.transcript,'utf8'),words:o.words?JSON.parse(fs.readFileSync(o.words,'utf8')):undefined}));}
  if(cmd==='align'){if(Boolean(o.words)===Boolean(o.transcribe))throw new Error('Choose --words or --transcribe');const s=await import('./lib/speech.mjs');const result=o.transcribe?await s.transcribeSpeech(dir,opts):s.alignSpeech(dir,{beat:o.beat,words:JSON.parse(fs.readFileSync(o.words,'utf8'))});return console.log(`Aligned ${result.length} words to the current recording.`);}
  if(['timing','captions'].includes(cmd)){const t=await import('./lib/timing.mjs'),timing=t.computeTiming(dir);writeJSON(path.join(dir,'build/timing.json'),timing);if(cmd==='timing')return console.log(JSON.stringify(timing,null,2));if(!o.draft&&timing.beats.some(b=>b.vo&&b.vo.wordTiming!=='measured'))throw new Error('Caption export requires measured word timestamps; align each take, or use --draft for rough captions.');const cues=t.captionCues(timing);fs.writeFileSync(path.join(dir,'build/captions.srt'),t.toSRT(cues));fs.writeFileSync(path.join(dir,'build/captions.vtt'),t.toVTT(cues));return console.log('Wrote captions. Timing quality is recorded in build/timing.json.');}
  if(cmd==='check'){const r=await native.checkProject(dir,opts);console.log(JSON.stringify(r,null,2));if(r.errors.length)process.exitCode=1;return;}
  if(cmd==='still')return console.log(await native.stillProject(dir,opts));
  if(cmd==='sheet')return console.log(await native.sheetProject(dir,opts));
  if(cmd==='looks')return console.log(await native.lookbookProject(dir,opts));
  if(cmd==='review'){const {reviewProject}=await import('./lib/review.mjs');return console.log(await reviewProject(dir,opts));}
  if(cmd==='render'||cmd==='preview')return console.log(JSON.stringify(await native.renderProject(dir,{...opts,draft:cmd==='preview'||o.draft}),null,2));
  throw new Error(`Unknown command ${cmd}. Run clearframe help.`);
}
main().catch(e=>{console.error(`ClearFrame: ${e.message}`);process.exitCode=1;});
