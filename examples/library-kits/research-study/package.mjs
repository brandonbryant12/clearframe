// Retain a compact, source-bound study package. Source reference pixels are excluded.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const runs=read('build/verification.json').sort((a,b)=>a.name.localeCompare(b.name));
if(runs.length!==6||new Set(runs.map(r=>r.name)).size!==6)throw Error('Need six unique native variants');
const summary=[];
for(const r of runs){
  if(r.check.errors.length||r.check.warnings.length||r.qa.pops||!r.seek.equal)throw Error(`Unresolved checks: ${r.name}`);
  const receipt=JSON.parse(fs.readFileSync(path.join(r.dir,'video.mp4.json')));
  if(receipt.hashes['storyboard.json']!==sha(fs.readFileSync(path.join(root,r.name,'storyboard.json'))))throw Error(`Stale input: ${r.name}`);
  const dest=path.join(root,'evidence',r.name);fs.mkdirSync(dest,{recursive:true});
  for(const file of ['video.mp4','video.mp4.json','sheet.png','phone.png','timeline.png','check.json','qa.json','seek.json'])fs.copyFileSync(path.join(r.dir,file),path.join(dest,file));
  if(fs.existsSync(path.join(r.dir,'boundaries')))fs.cpSync(path.join(r.dir,'boundaries'),path.join(dest,'boundaries'),{recursive:true});
  summary.push({name:r.name,pipelineId:path.basename(r.dir),check:r.check,qa:r.qa,seekEqual:r.seek.equal});
}
fs.copyFileSync(path.join(root,'build/encoded-proportions.json'),path.join(root,'evidence/encoded-proportions.json'));
fs.copyFileSync(path.join(root,'build/node-tests.txt'),path.join(root,'evidence/source-checks.txt'));
for(const shape of ['landscape','vertical']){
  const report=read(`build/verify-${shape}/verification.json`);if(report.status!=='passed-mechanical-checks')throw Error(`Sculpture verification failed: ${shape}`);
  write(`evidence/sculpture-${shape}.json`,report);
}
write('evidence/summary.json',{status:'prototype',continuousPlayback:'unverified',variants:summary,limitations:['No source chart pixels redistributed','Three inspected images from one publisher page; direct social-post provenance unverified','Blender dimensions are qualitative','Square and 4:5 not reviewed']});
const cards=runs.map(r=>`<article><h2>${r.name.replace('-', ' · ')}</h2><video controls playsinline preload="none" src="evidence/${r.name}/video.mp4"></video><p><a href="${r.name}/storyboard.json">Native source</a> · <a href="evidence/${r.name}/phone.png">Phone sheet</a> · <a href="evidence/${r.name}/timeline.png">Timeline</a></p></article>`).join('\n');
fs.writeFileSync(path.join(root,'preview.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Research studies</title><style>body{margin:0;background:#fafafa;color:#24272c;font:17px/1.5 system-ui}main{max-width:1200px;padding:40px;margin:auto}h1{font-size:42px}h2{font-size:19px}a{color:#914824}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:30px}article{padding:20px;border:1px solid #d8d4de}video{display:block;width:100%;height:430px;object-fit:contain;background:#eeedf2}p{max-width:850px}</style><main><h1>Research studies</h1><p>Two native chart studies and an original porcelain gate. Fictional data and original geometry, informed by three inspected chart reproductions. <strong>Prototype:</strong> subjective continuous playback remains unverified.</p><p><a href="README.md">Use and limits</a> · <a href="SOURCES.md">References and adaptation</a> · <a href="REVIEW.md">Independent review</a> · <a href="kit.json">Hashes</a></p><div class="grid">${cards}</div></main><script>document.querySelectorAll('video').forEach(v=>v.addEventListener('play',()=>document.querySelectorAll('video').forEach(o=>{if(o!==v)o.pause()})))</script></html>\n`);
function walk(dir,rel=''){
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    if(e.name==='build'||e.name==='__pycache__'||e.name==='kit.json')return [];
    const file=path.join(dir,e.name),p=path.posix.join(rel,e.name);
    if(e.isDirectory())return walk(file,p);const bytes=fs.readFileSync(file);return[{path:p,bytes:bytes.length,sha256:sha(bytes)}];
  });
}
write('kit.json',{schemaVersion:1,id:'research-study',version:'0.1.0',kind:'story-kit',title:'Research studies',status:'prototype',
  purpose:'Translate observed research-chart hierarchy into original native graphics and a qualitative 3D access mechanism.',
  tags:{purpose:['compare','annotate','explain-access'],appearance:['white','charcoal','orange','porcelain'],movement:['shared-clock-reveal','controlled-lift','reading-hold'],format:['landscape','vertical'],subject:['research','access']},
  includes:{source:'source/inputs.json',specimens:runs.map(r=>`${r.name}/storyboard.json`),media:'media',preview:'preview.html'},
  requires:{replay:['ClearFrame native compositor','research-paper palette','bundled Inter fonts'],preparation:['Node.js','FFmpeg','native renderer setup'],blender:'Optional; required only to revise or regenerate 3D media'},
  editable:{native:['chart values','dates','annotation','labels','palette','timing'],requiresNewAssetPass:['gate geometry','materials','lighting','camera','baked motion'],fixedClip:['Retained MP4 pixels; regenerate after source edits']},
  evidence:{summary:'evidence/summary.json',review:'REVIEW.md',proportions:'evidence/encoded-proportions.json',sculpture:['evidence/sculpture-landscape.json','evidence/sculpture-vertical.json'],continuousPlayback:'unverified'},
  provenance:{references:'references.json',adaptation:'SOURCES.md',data:'Original fictional inputs; no copied market trajectories',art:'Original procedural geometry; no claim of Timmer 3D practice or endorsement',referencePixelsRedistributed:false},
  license:'MIT for original files; external reference images are not included. Bundled fonts retain OFL notices.',files:walk(root)});
console.log(JSON.stringify({variants:runs.length,files:read('kit.json').files.length,bytes:read('kit.json').files.reduce((s,f)=>s+f.bytes,0),status:'prototype'}));
