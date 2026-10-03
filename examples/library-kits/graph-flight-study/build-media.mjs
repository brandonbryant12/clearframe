// Prepare exact source clips, then remove only their verified PNG intermediates.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {renderSculpture} from '../../../engine/lib/sculptures.mjs';

const root=path.dirname(fileURLToPath(import.meta.url)), repo=path.resolve(root,'../../..');
const inputs=JSON.parse(fs.readFileSync(path.join(root,'inputs.json')));
const phaseSeconds=JSON.parse(fs.readFileSync(path.join(root,'timing.json')));
const candidates=inputs.cases.flatMap(item=>['landscape','vertical'].map(format=>({item,format,name:`${item.id}-${format}`})));
const requested=process.argv.slice(2);
if(requested.some(name=>!candidates.some(c=>c.name===name)))throw Error('Unknown graph-flight specimen');
const selected=requested.length?candidates.filter(c=>requested.includes(c.name)):candidates;
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
for(const {item,format,name} of selected){
  const out=path.join(root,'build/slow-context-renders',name), media=path.join(root,'media',name);
  if(fs.existsSync(out)||fs.existsSync(media))throw Error('Existing evidence: choose a fresh revision before rerendering '+name);
  const receipt=await renderSculpture(item.mechanism,out,{draft:true,vertical:format==='vertical',fps:24,phaseSeconds});
  const rendered=JSON.parse(fs.readFileSync(path.join(out,'blender.json'))).cameraReview;
  if(JSON.stringify(rendered.values)!==JSON.stringify(item.values)||JSON.stringify(rendered.ticks)!==JSON.stringify(item.ticks))throw Error('Rendered data differs from declared inputs');
  const check=spawnSync(process.env.BLENDER_BIN||'blender',['--background','--factory-startup','--disable-autoexec',path.join(out,'scene.blend'),'--threads','2','--python-exit-code','1','--python',path.join(root,'check-scene.py'),'--','--receipt',path.join(out,'receipt.json'),'--out',path.join(out,'scene-checks.json')],{cwd:repo,encoding:'utf8',maxBuffer:4*1024*1024});
  fs.writeFileSync(path.join(out,'scene-checks.log'),(check.stdout??'')+'\n'+(check.stderr??''));
  if(check.status!==0)throw Error('Baked scene check failed: '+name);
  fs.mkdirSync(media,{recursive:true});
  for(const file of ['clip.mp4','poster.png','scene.blend','asset.json','receipt.json','render-config.json','blender.json','scene-checks.json'])fs.copyFileSync(path.join(out,file),path.join(media,file));
  fs.cpSync(path.join(out,'source'),path.join(media,'source'),{recursive:true,filter:p=>!p.split(path.sep).includes('__pycache__')&&!p.endsWith('.pyc')});
  for(const [file,metadata] of Object.entries(receipt.outputs))if(sha(path.join(media,file))!==metadata.sha256)throw Error('Changed output copy: '+file);
  for(const [file,hash] of Object.entries(receipt.sourceHashes))if(sha(path.join(repo,file))!==hash||sha(path.join(media,'source',path.basename(file)))!==hash)throw Error('Changed source copy: '+file);
  fs.rmSync(path.join(out,'frames'),{recursive:true});
  console.log(JSON.stringify({name,status:'source-rendered-and-checked',frames:receipt.config.frames,pngIntermediatesPruned:true}));
}
