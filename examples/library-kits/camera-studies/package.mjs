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
if(runs.length!==12||new Set(runs.map(r=>r.name)).size!==12)throw Error('Need twelve unique native variants');
if(probes.length!==12||new Set(probes.map(r=>r.name)).size!==12||probes.some(r=>!r.passed))throw Error('Incomplete or failing encoded holds');
if(!fs.existsSync(path.join(root,'REVIEW.md')))throw Error('Independent review is required');
const focus=read('evidence/focus-sharpness.json');if(focus.length!==6||focus.some(r=>!r.passed))throw Error('Six encoded focus probes required');
for(const f of focus){const run=runs.find(r=>r.name===f.name);const file=run?path.join(run.dir,'video.mp4'):path.join(root,'media',f.name,'clip.mp4');if(sha(fs.readFileSync(file))!==f.videoSha256)throw Error('Stale focus evidence: '+f.name);}
const guards=read('evidence/optical-guards.json');if(guards.length!==2||guards.some(g=>!g.rejected))throw Error('Both optical guards required');
for(const g of guards){if(sha(fs.readFileSync(path.join(root,'evidence',`negative-optics-${g.kind}-config.json`)))!==g.configSha256)throw Error('Stale guard config');for(const [file,hash]of Object.entries(g.sourceHashes))if(sha(fs.readFileSync(path.join(root,'media/focus-depth-landscape/source',file)))!==hash)throw Error('Stale optical guard source');}
if(sha(fs.readFileSync(path.join(root,'inputs.json')))!==read('bindings.json').inputSha256)throw Error('Stale input bindings');
const mediaNames=[...new Set(bindings.map(b=>b.mediaName))];if(mediaNames.length!==6)throw Error('Six source variants required');
for(const name of mediaNames){
 const base=path.join(root,'media',name),receipt=read(`media/${name}/receipt.json`),camera=read(`evidence/${name}/camera.json`),verification=read(`evidence/${name}/verification.json`);
 if(receipt.status!=='ready-for-review'||camera.status!=='passed'||!camera.seekEqual||camera.framesChecked!==193||verification.status!=='passed-mechanical-checks'||camera.clipSha256!==receipt.outputs['clip.mp4'].sha256)throw Error('Incomplete source verification: '+name);
 for(const [file,value]of Object.entries(receipt.outputs))if(sha(fs.readFileSync(path.join(base,file)))!==value.sha256)throw Error('Changed source artifact: '+name+'/'+file);
 for(const [file,hash]of Object.entries(receipt.sourceHashes))if(sha(fs.readFileSync(path.join(base,'source',path.basename(file))))!==hash)throw Error('Changed source recipe: '+name+'/'+file);
}
const summary=[];
for(const r of runs){
  if(r.check.errors.length||r.check.warnings.length||r.qa.pops||!r.seek.equal)throw Error(`Unresolved checks: ${r.name}`);
  const receipt=JSON.parse(fs.readFileSync(path.join(r.dir,'video.mp4.json')));
  const inputHash=sha(fs.readFileSync(path.join(root,'specimens',r.name,'storyboard.json')));
  const binding=bindings.find(b=>b.name===r.name),probe=probes.find(p=>p.name===r.name);
  if(receipt.hashes['storyboard.json']!==inputHash||binding.storyboardSha256!==inputHash||receipt.hashes['media/clip.mp4']!==binding.sourceClipSha256||receipt.hashes['media/final-hold.mp4']!==binding.holdClipSha256)throw Error(`Stale input: ${r.name}`);
  if(probe.storyboardSha256!==inputHash||probe.pipelineId!==(r.pipelineId??path.basename(r.dir))||probe.videoSha256!==sha(fs.readFileSync(path.join(r.dir,'video.mp4'))))throw Error(`Stale encoded check: ${r.name}`);
  const media=path.join(root,'media',binding.mediaName);
  if(sha(fs.readFileSync(path.join(media,'clip.mp4')))!==binding.sourceClipSha256||sha(fs.readFileSync(path.join(media,'final-frame.png')))!==binding.heldImageSha256||sha(fs.readFileSync(path.join(media,'final-hold.mp4')))!==binding.holdClipSha256)throw Error(`Stale media: ${r.name}`);
  const dest=path.join(root,'evidence',r.name);fs.mkdirSync(dest,{recursive:true});
  if(path.resolve(r.dir)!==path.resolve(dest))for(const file of ['video.mp4','video.mp4.json','sheet.png','phone.png','timeline.png','check.json','qa.json','seek.json'])fs.copyFileSync(path.join(r.dir,file),path.join(dest,file));
  if(path.resolve(r.dir)!==path.resolve(dest)&&fs.existsSync(path.join(r.dir,'boundaries')))fs.cpSync(path.join(r.dir,'boundaries'),path.join(dest,'boundaries'),{recursive:true});
  summary.push({name:r.name,pipelineId:(r.pipelineId??path.basename(r.dir)),check:r.check,qa:r.qa,seekEqual:r.seek.equal});
}
fs.copyFileSync(path.join(root,'build/encoded-holds.json'),path.join(root,'evidence/encoded-holds.json'));
fs.copyFileSync(path.join(root,'build/node-tests.txt'),path.join(root,'evidence/source-checks.txt'));
write('evidence/summary.json',{status:'prototype',continuousPlayback:'unverified',variants:summary,limitations:['Original qualitative geometry, apparent size, illustrative count and timing encode no measurements','Framing and sharpness checks do not prove arbitrary occlusion safety or measured optics','Square and 4:5 not reviewed','Draft samples only; master and continuous subjective playback remain pending','Stable close-up surface grain on hero-field marker bases/crowns remains a master surface-quality item']});
const cards=runs.map(r=>`<article><h2>${r.name.replace('-', ' · ')}</h2><video controls playsinline preload="none" src="evidence/${r.name}/video.mp4"></video><p><a href="specimens/${r.name}/storyboard.json">Native source</a> · <a href="evidence/${r.name}/phone.png">Phone sheet</a> · <a href="evidence/${r.name}/timeline.png">Timeline</a></p></article>`).join('\n');
fs.writeFileSync(path.join(root,'preview.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Authored camera studies</title><style>body{margin:0;background:#fafafa;color:#24272c;font:17px/1.5 system-ui}main{max-width:1200px;padding:40px;margin:auto}h1{font-size:42px}h2{font-size:19px}a{color:#914824}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:30px}article{padding:20px;border:1px solid #d8d4de}video{display:block;width:100%;height:430px;object-fit:contain;background:#eeedf2}p{max-width:850px}</style><main><h1>Authored camera studies</h1><p>Two perspective pullbacks and one fixed-camera focus transfer, with two explanatory uses each in landscape and vertical. Native labels follow source phases and retain a final reading hold. <strong>Prototype:</strong> subjective continuous playback remains unverified.</p><p><a href="README.md">Use and limits</a> · <a href="SOURCES.md">Sources and assumptions</a> · <a href="REVIEW.md">Independent review</a> · <a href="kit.json">Hashes</a></p><div class="grid">${cards}</div></main><script>document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(o=>{if(o!==v)o.pause()})))</script></html>\n`);
function walk(dir,rel=''){
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    if(e.name==='build'||e.name==='__pycache__'||e.name==='kit.json'||e.name.endsWith('.log'))return [];
    const file=path.join(dir,e.name),p=path.posix.join(rel,e.name);
    if(e.isDirectory())return walk(file,p);const bytes=fs.readFileSync(file);return[{path:p,bytes:bytes.length,sha256:sha(bytes)}];
  });
}
write('kit.json',{schemaVersion:1,id:'camera-studies',version:'0.1.0',kind:'story-kit',title:'Authored camera studies',status:'prototype',
  purpose:'Reveal connections, surrounding context and depth with reusable authored camera paths and sharp native qualifications.',inventoryIds:['M01','M02','M03','M07','T04','T05'],
  tags:{purpose:['context','selection','focus','connections'],appearance:['porcelain','mineral','blue','amber'],movement:['perspective-pullback','rack-focus','reading-hold'],format:['landscape','vertical'],subject:['infrastructure','dependencies','locations','specimens','inspection','research-context']},
  includes:{source:'inputs.json',bindings:'bindings.json',media:['linked-system','hero-field','focus-depth'].flatMap(id=>['landscape','vertical'].map(p=>`media/${id}-${p}`)),specimens:runs.map(r=>`specimens/${r.name}/storyboard.json`),preview:'preview.html'},
  requires:{replay:['ClearFrame native compositor','bundled Inter fonts'],preparation:['Node.js','FFmpeg','Blender for source regeneration','Python 3','native renderer setup']},
  editable:{native:['labels','source text','phase cues','typography'],procedural:['geometry','materials','camera','timing'],fixedClip:['Retained pixels; regenerate and review after procedural edits']},
  evidence:{summary:'evidence/summary.json',review:'REVIEW.md',holds:'evidence/encoded-holds.json',focus:'evidence/focus-sharpness.json',opticalGuards:'evidence/optical-guards.json',continuousPlayback:'unverified'},
  provenance:{references:'SOURCES.md',data:'Original fictional explanatory scenarios; no measured quantities',inputSha256:read('bindings.json').inputSha256},
  license:'MIT for original files. Bundled fonts retain OFL notices.',files:walk(root)});
console.log(JSON.stringify({variants:runs.length,files:read('kit.json').files.length,bytes:read('kit.json').files.reduce((s,f)=>s+f.bytes,0),status:'prototype'}));
