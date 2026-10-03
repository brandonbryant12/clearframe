// Retain exact evidence and build a portable, non-autoplay preview + hash manifest.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const read=f=>JSON.parse(fs.readFileSync(path.join(root,f),'utf8'));
const write=(f,v)=>fs.writeFileSync(path.join(root,f),JSON.stringify(v,null,2)+'\n');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const runs=read('build/renders.json').sort((a,b)=>a.project.localeCompare(b.project));
if(runs.length!==18||new Set(runs.map(r=>r.project)).size!==18)throw Error('Need all 18 unique variants');
const summary=[];
for(const r of runs){
  if(r.status!=='ready-for-review'||r.check.errors.length||r.check.warnings.length||r.qa.pops)throw Error(`Unresolved native check: ${r.project}`);
  const receipt=JSON.parse(fs.readFileSync(path.join(r.dir,'video.mp4.json'),'utf8'));
  if(receipt.hashes['storyboard.json']!==hash(fs.readFileSync(path.join(root,'specimens',r.project,'storyboard.json'))))throw Error(`Stale render: ${r.project}`);
  const dest=path.join(root,'evidence',r.project);fs.mkdirSync(dest,{recursive:true});
  for(const file of ['video.mp4','video.mp4.json','sheet.png','phone.png','timeline.png','check.json','qa.json','seek.json'])fs.copyFileSync(path.join(r.dir,file),path.join(dest,file));
  if(fs.existsSync(path.join(r.dir,'boundaries')))fs.cpSync(path.join(r.dir,'boundaries'),path.join(dest,'boundaries'),{recursive:true});
  summary.push({project:r.project,status:'prototype',pipelineId:path.basename(r.dir),inputId:r.check.inputId,check:r.check,qa:r.qa,files:`evidence/${r.project}`});
}
fs.copyFileSync(path.join(root,'build/encoded-rectangles.json'),path.join(root,'evidence/encoded-rectangles.json'));
fs.copyFileSync(path.join(root,'build/seek.json'),path.join(root,'evidence/seek.json'));
write('evidence/summary.json',{status:'prototype',variants:summary,continuousPlayback:'unverified',sourceChecks:'See test/retirement-kit.test.mjs and REVIEW.md; no claim of exhaustive future-input validation.'});
const cards=runs.map(r=>`<article><h2>${r.project.toUpperCase().replace('-',' · ')}</h2><video controls playsinline preload="none" src="evidence/${r.project}/video.mp4"></video><p><a href="evidence/${r.project}/phone.png">Phone sheet</a> · <a href="evidence/${r.project}/timeline.png">Timeline</a> · <a href="specimens/${r.project}/storyboard.json">Native source</a></p></article>`).join('\n');
fs.writeFileSync(path.join(root,'preview.html'),`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Retirement mechanisms</title><style>body{margin:0;background:#f5f3ed;color:#222831;font:17px/1.5 system-ui}main{max-width:1200px;padding:40px;margin:auto}h1{font-size:42px}h2{font-size:18px}a{color:#2445a2}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:32px}article{padding:20px;border:1px solid #c9c7bf}video{display:block;width:100%;height:430px;background:#e9e7df;object-fit:contain}p{max-width:850px}</style><main><h1>Retirement mechanisms</h1><p>Original editable native scenes. Nine recipes, two fictional cases each, landscape and vertical. <strong>Prototype:</strong> calculations, native checks and bounded encoded geometry are reviewed; subjective continuous playback remains unverified.</p><p>Silent reading holds are intentional. Sample amounts and plan rules are illustrative. <a href="README.md">Use and limits</a> · <a href="REVIEW.md">Independent review</a> · <a href="kit.json">Hashes and provenance</a></p><div class="grid">${cards}</div></main></html>\n`);
function walk(dir,rel=''){
  return fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
    if(e.name==='build'||e.name==='kit.json')return [];
    const file=path.join(dir,e.name),p=path.posix.join(rel,e.name);
    if(e.isDirectory())return walk(file,p);
    const bytes=fs.readFileSync(file);return [{path:p,bytes:bytes.length,sha256:hash(bytes)}];
  });
}
write('kit.json',{schemaVersion:1,id:'retirement-mechanisms',version:'0.1.0',kind:'story-kit',title:'Retirement mechanisms',
  purpose:'Explain retirement cashflows, ownership, benefit formulas and purchasing power with auditable native proportions.',status:'prototype',
  tags:{purpose:['compare','reconcile','explain'],appearance:['paper','geometric','native'],movement:['fade','shared-clock-reveal','reading-hold'],format:['landscape','vertical'],subject:['retirement','cashflow','ownership']},
  includes:{source:'source',specimens:runs.map(r=>`specimens/${r.project}/storyboard.json`),preview:'preview.html'},
  requires:{replay:['ClearFrame native canvas.props.plot','canvas.sourceSize','engine/lib/finance.mjs'],fonts:'Bundled geometric type voice; existing OFL font provenance',preparation:['Node.js','FFmpeg','native renderer setup'],blender:false},
  editable:{native:['all amounts and assumptions','labels','palette','timing','scales','layout'],requiresNewAssetPass:[],fixedClip:['rendered MP4 pixels; regenerate after source edits']},
  evidence:{review:'REVIEW.md',summary:'evidence/summary.json',ratios:'evidence/encoded-rectangles.json',seek:'evidence/seek.json',continuousPlayback:'unverified'},
  provenance:{original:'Original procedural native compositions; no third-party charts or logos copied.',inputs:'All fixtures fictional, as-of 2026-10-02; source calculation contract in docs/finance-calculations.md.'},license:'MIT; see LICENSE; bundled fonts retain their own licenses',files:walk(root)});
console.log(JSON.stringify({variants:runs.length,files:read('kit.json').files.length,bytes:read('kit.json').files.reduce((s,f)=>s+f.bytes,0),status:'prototype'}));
