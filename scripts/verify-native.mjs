// Native integration checks. Run through codex-heavy, after the Node contract suite.
import fs from 'node:fs';
import path from 'node:path';
import { writeGallery } from '../fframes/playbooks.mjs';
import { checkProject, sheetProject, renderProject, stillProject, lookbookProject, buildNative, run, ROOT } from '../fframes/production.mjs';
import { reviewProject } from '../engine/lib/review.mjs';
import { blockByName } from '../fframes/catalog.mjs';
import { writeJSON, ffmpeg } from '../engine/lib/util.mjs';
const out=path.resolve(process.argv[2]??'build/native-verified');if(fs.existsSync(out))throw new Error('Verification output exists; retain or move it before rerunning.');fs.mkdirSync(out,{recursive:true});
const reports=[];
await buildNative();
await run('cargo',['test','--manifest-path',ROOT+'/native/Cargo.toml','--release','--locked','--jobs','1','--lib','--','--test-threads=2']);
for(const [name,vertical,theme] of [['landscape',false,'paper'],['vertical',true,'ink']]){
 const dir=path.join(out,name);await writeGallery(dir,{vertical,theme});
 // Time-varying test pattern distinguishes real decoded footage from a static placeholder.
 await ffmpeg(['-y','-f','lavfi','-i','testsrc2=s=960x540:r=30:d=4','-an','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',path.join(dir,'assets/demo.mp4')]);
 const check=await checkProject(dir,{draft:true});if(check.errors.length)throw new Error(check.errors.join('\n'));
 await sheetProject(dir,{draft:true,per:1,columns:4,thumb:vertical?240:440});
 reports.push({name,check});
 if(!vertical){const sb=JSON.parse(fs.readFileSync(path.join(dir,'storyboard.json'),'utf8'));const transitions=['cut','fade','rise','wipe','push','zoom'];sb.beats.forEach((b,i)=>b.transition=transitions[i%transitions.length]);writeJSON(path.join(dir,'storyboard.json'),sb);reports.push({name:'all-blocks-render',report:await renderProject(dir,{draft:true,noAudio:true})});reports.push({name:'encoded-boundaries',path:await reviewProject(dir)});reports.push({name:'palette-comparison',path:await lookbookProject(dir,{beat:'flow',draft:true})});}
}
for(const [name,preset] of [['square','square'],['portrait','portrait']]){
 const source=path.join(out,'vertical'),dir=path.join(out,name);fs.mkdirSync(dir);const sb=JSON.parse(fs.readFileSync(path.join(source,'storyboard.json'),'utf8'));fs.cpSync(path.join(source,'assets'),path.join(dir,'assets'),{recursive:true});sb.format={preset,fps:25};sb.beats=sb.beats.filter(b=>['bars','kpis','timeline','matrix','kinetic','ring','flow','cycle','breathing','icon-grid','chapter','highlight','donut','magnitude','checklist','annotate'].includes(b.block));writeJSON(path.join(dir,'storyboard.json'),sb);const check=await checkProject(dir,{draft:true});if(check.errors.length)throw new Error(check.errors.join('\n'));await sheetProject(dir,{draft:true,per:1,columns:3,thumb:320});reports.push({name,check});
}
const compact=path.join(out,'compact-60');fs.mkdirSync(compact);writeJSON(path.join(compact,'storyboard.json'),{version:2,title:'60 fps timing check',format:{width:640,height:360,fps:60},theme:'signal',music:false,captions:false,sources:[{title:'Synthetic verification'}],beats:[{id:'a',block:'title',duration:.8,props:{text:'Frame timing'}},{id:'b',block:'stat',duration:2.2,props:{value:60,suffix:' fps',label:'Frame rate',source:'Synthetic verification'}}]});reports.push({name:'compact-60',report:await renderProject(compact)});
// Regression: at some lengths the upstream MP4 edit list ended one frame early.
const lengths=path.join(out,'final-frame-451');fs.mkdirSync(lengths);writeJSON(path.join(lengths,'storyboard.json'),{version:2,title:'Final frame check',format:{width:640,height:360,fps:30},theme:'paper',music:false,captions:false,sources:[],beats:[{id:'a',block:'statement',duration:451/30,props:{text:'Every frame survives muxing'}}]});reports.push({name:'final-frame-451',report:await renderProject(lengths,{noAudio:true})});
for(const preset of ['landscape','vertical']){
 const dir=path.join(out,`dense-${preset}`);fs.mkdirSync(dir);
 const items=Array.from({length:8},(_,i)=>({icon:['leaf','camera','music','pencil'][i%4],label:`Observation ${i+1}`,detail:'Keep one useful detail.'}));
 const source='Synthetic layout verification';
 const sb={version:2,title:'Dense layout review',format:{preset,fps:30},theme:'signal',music:false,captions:true,chrome:true,sources:[{title:source}],beats:[
  {id:'cycle-six',block:'cycle',duration:8,props:{...structuredClone(blockByName('cycle').example),nodes:items.slice(0,6).map(({icon,label})=>({icon,label})),support:'Six nodes with caption and source space.',source}},
  {id:'grid-eight',block:'icon-grid',duration:5,props:{title:'Eight related observations',items,columns:4,support:'A dense grid still needs readable labels.',source}},
  {id:'grid-one',block:'icon-grid',duration:5,props:{title:'One continuous list',items,columns:1,source}},
  {id:'flow-six',block:'flow',duration:5,props:{title:'Six connected observations',nodes:items.slice(0,6),source}}
 ]};writeJSON(path.join(dir,'storyboard.json'),sb);const check=await checkProject(dir);if(check.errors.length)throw new Error(check.errors.join('\n'));await sheetProject(dir,{per:2,columns:2,thumb:preset==='vertical'?300:500});reports.push({name:`dense-${preset}`,check});
}
const speech=path.resolve('build/speech-smoke');if(fs.existsSync(speech)){
 const check=await checkProject(speech);if(check.errors.length)throw new Error(check.errors.join('\n'));const report=await renderProject(speech);reports.push({name:'measured-speech-final',check,report,review:await reviewProject(speech)});
 const captions=path.join(out,'captions');fs.mkdirSync(captions);fs.cpSync(path.join(speech,'assets'),path.join(captions,'assets'),{recursive:true});
 const sb=JSON.parse(fs.readFileSync(path.join(speech,'storyboard.json'),'utf8'));sb.beats=sb.beats.slice(0,1);sb.beats[0].block='title';sb.beats[0].props={text:'Let the voice lead',support:'A native caption follows the recording.'};sb.captions=true;sb.theme='editorial';writeJSON(path.join(captions,'storyboard.json'),sb);
 const captionCheck=await checkProject(captions);if(captionCheck.errors.length)throw new Error(captionCheck.errors.join('\n'));const captionReport=await renderProject(captions);await stillProject(captions,{at:.35});reports.push({name:'measured-caption-overlay',check:captionCheck,report:captionReport,review:await reviewProject(captions)});
}
writeJSON(path.join(out,'verification.json'),reports);console.log(`Verified native fixtures: ${out}`);
