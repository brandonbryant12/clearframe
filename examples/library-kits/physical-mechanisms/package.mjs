// Retain source-bound native variants and compact review evidence.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const runs=read('build/verification.json').sort((a,b)=>a.name.localeCompare(b.name));
const probes=read('build/encoded-holds.json'),bindings=read('bindings.json').bindings;
if(runs.length!==8||new Set(runs.map(r=>r.name)).size!==8)throw Error('Need eight unique native variants');
if(probes.length!==8||new Set(probes.map(r=>r.name)).size!==8||probes.some(r=>!r.passed))throw Error('Incomplete or failing encoded holds');
if(!fs.existsSync(path.join(root,'REVIEW.md')))throw Error('Independent review is required');
const summary=[];
for(const r of runs){
  if(r.check.errors.length||r.check.warnings.length||r.qa.pops||!r.seek.equal)throw Error(`Unresolved checks: ${r.name}`);
  const receipt=JSON.parse(fs.readFileSync(path.join(r.dir,'video.mp4.json')));
  const inputHash=sha(fs.readFileSync(path.join(root,'specimens',r.name,'storyboard.json')));
  const binding=bindings.find(b=>b.name===r.name),probe=probes.find(p=>p.name===r.name);
  if(receipt.hashes['storyboard.json']!==inputHash||binding.storyboardSha256!==inputHash||receipt.hashes['media/clip.mp4']!==binding.sourceClipSha256||receipt.hashes['media/final-hold.mp4']!==binding.holdClipSha256)throw Error(`Stale input: ${r.name}`);
  if(probe.storyboardSha256!==inputHash||probe.pipelineId!==path.basename(r.dir)||probe.videoSha256!==sha(fs.readFileSync(path.join(r.dir,'video.mp4'))))throw Error(`Stale encoded check: ${r.name}`);
  const media=path.join(root,'media',binding.mediaName);
  if(sha(fs.readFileSync(path.join(media,'clip.mp4')))!==binding.sourceClipSha256||sha(fs.readFileSync(path.join(media,'final-frame.png')))!==binding.heldImageSha256||sha(fs.readFileSync(path.join(media,'final-hold.mp4')))!==binding.holdClipSha256)throw Error(`Stale media: ${r.name}`);
  const dest=path.join(root,'evidence',r.name);fs.mkdirSync(dest,{recursive:true});
  for(const file of ['video.mp4','video.mp4.json','sheet.png','phone.png','timeline.png','check.json','qa.json','seek.json'])fs.copyFileSync(path.join(r.dir,file),path.join(dest,file));
  if(fs.existsSync(path.join(r.dir,'boundaries')))fs.cpSync(path.join(r.dir,'boundaries'),path.join(dest,'boundaries'),{recursive:true});
  summary.push({name:r.name,pipelineId:path.basename(r.dir),check:r.check,qa:r.qa,seekEqual:r.seek.equal});
}
fs.copyFileSync(path.join(root,'build/encoded-holds.json'),path.join(root,'evidence/encoded-holds.json'));
fs.copyFileSync(path.join(root,'build/node-tests.txt'),path.join(root,'evidence/source-checks.txt'));
write('evidence/summary.json',{status:'prototype',continuousPlayback:'unverified',variants:summary,limitations:['Original qualitative geometry; no fluid or rigid-body simulation','Token count and speed do not encode throughput','Fixed orthographic framing only','Square and 4:5 not reviewed','Reservoir landscape scene reload differs by one channel at most 1/255; other three exact']});
const cards=runs.map(r=>`<article><h2>${r.name.replace('-', ' · ')}</h2><video controls playsinline preload="none" src="evidence/${r.name}/video.mp4"></video><p><a href="specimens/${r.name}/storyboard.json">Native source</a> · <a href="evidence/${r.name}/phone.png">Phone sheet</a> · <a href="evidence/${r.name}/timeline.png">Timeline</a></p></article>`).join('\n');
fs.writeFileSync(path.join(root,'preview.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Physical mechanisms</title><style>body{margin:0;background:#fafafa;color:#24272c;font:17px/1.5 system-ui}main{max-width:1200px;padding:40px;margin:auto}h1{font-size:42px}h2{font-size:19px}a{color:#914824}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:30px}article{padding:20px;border:1px solid #d8d4de}video{display:block;width:100%;height:430px;object-fit:contain;background:#eeedf2}p{max-width:850px}</style><main><h1>Physical mechanisms</h1><p>A reservoir transfer and a conveyor bypass, with two explanatory uses each in landscape and vertical. Native labels follow source phases and retain a final reading hold. <strong>Prototype:</strong> subjective continuous playback remains unverified.</p><p><a href="README.md">Use and limits</a> · <a href="SOURCES.md">Sources and assumptions</a> · <a href="REVIEW.md">Independent review</a> · <a href="kit.json">Hashes</a></p><div class="grid">${cards}</div></main><script>document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(o=>{if(o!==v)o.pause()})))</script></html>\n`);
function walk(dir,rel=''){
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    if(e.name==='build'||e.name==='__pycache__'||e.name==='kit.json'||e.name.endsWith('.log'))return [];
    const file=path.join(dir,e.name),p=path.posix.join(rel,e.name);
    if(e.isDirectory())return walk(file,p);const bytes=fs.readFileSync(file);return[{path:p,bytes:bytes.length,sha256:sha(bytes)}];
  });
}
write('kit.json',{schemaVersion:1,id:'physical-mechanisms',version:'0.1.0',kind:'story-kit',title:'Physical mechanisms',status:'prototype',
  purpose:'Explain gated transfer and alternate-route release with reusable qualitative objects and native labels.',inventoryIds:['B04','B09','M07','T05'],
  tags:{purpose:['transfer','release','queue','bypass'],appearance:['porcelain','transparent-panels','blue','amber'],movement:['staged-gate','one-way-transfer','spaced-path','reading-hold'],format:['landscape','vertical'],subject:['resource-access','tank-operation','warehouse-routing','network-metaphor']},
  includes:{source:'inputs.json',bindings:'bindings.json',media:['media/reservoir-landscape','media/reservoir-vertical','media/conveyor-landscape','media/conveyor-vertical'],specimens:runs.map(r=>`specimens/${r.name}/storyboard.json`),preview:'preview.html'},
  requires:{replay:['ClearFrame native compositor','bundled Inter fonts'],preparation:['Node.js','FFmpeg','Blender for source regeneration','Python 3','native renderer setup']},
  editable:{native:['labels','source text','phase cues','typography'],procedural:['geometry','materials','camera','timing'],fixedClip:['Retained pixels; regenerate and review after procedural edits']},
  evidence:{summary:'evidence/summary.json',review:'REVIEW.md',holds:'evidence/encoded-holds.json',continuousPlayback:'unverified'},
  provenance:{references:'SOURCES.md',data:'Original fictional explanatory scenarios; no measured quantities',inputSha256:read('bindings.json').inputSha256},
  license:'MIT for original files. Bundled fonts retain OFL notices.',files:walk(root)});
console.log(JSON.stringify({variants:runs.length,files:read('kit.json').files.length,bytes:read('kit.json').files.reduce((s,f)=>s+f.bytes,0),status:'prototype'}));
