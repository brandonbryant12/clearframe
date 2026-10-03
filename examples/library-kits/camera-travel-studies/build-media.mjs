// One bounded Blender process at a time, under codex-heavy.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';import {renderSculpture} from '../../../engine/lib/sculptures.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../..'),args=process.argv.slice(2),looks=args.includes('--looks'),prune=args.includes('--prune-frames'),resume=args.includes('--resume'),requested=args.filter(a=>!a.startsWith('--'));
const cases=['inspection-orbit-landscape','inspection-orbit-vertical','parallax-truck-landscape','parallax-truck-vertical'];const names=requested.length?requested:cases,sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
function run(bin,args,log){const r=spawnSync(bin,args,{cwd:repo,encoding:'utf8',maxBuffer:16*1024*1024});fs.writeFileSync(log,(r.stdout??'')+'\n'+(r.stderr??''));if(r.status!==0)throw Error(`${bin} failed: see ${log}`);}
for(const name of names){
 if(!cases.includes(name))throw Error('Unknown source '+name);const id=name.replace(/-(landscape|vertical)$/,''),out=path.join(root,looks?'build/looks':'build/renders',name,id),target=path.join(root,'media',name),evidence=path.join(root,'evidence',name);
 if(!looks&&(fs.existsSync(target)||fs.existsSync(evidence)))throw Error('Retained evidence exists: '+name);
 let receipt;
 if(resume&&fs.existsSync(path.join(out,'receipt.json'))){
  receipt=JSON.parse(fs.readFileSync(path.join(out,'receipt.json')));if(receipt.status!=='ready-for-review'||receipt.config.still!==looks||receipt.config.fps!==24||!receipt.config.draft)throw Error('Cannot resume incompatible render');
  for(const[f,h]of Object.entries(receipt.sourceHashes))if(sha(path.join(repo,f))!==h||sha(path.join(out,'source',path.basename(f)))!==h)throw Error('Cannot resume changed source '+f);
  for(const[f,v]of Object.entries(receipt.outputs))if(sha(path.join(out,f))!==v.sha256)throw Error('Cannot resume changed output '+f);
 }else receipt=await renderSculpture(id,out,{draft:true,still:looks,vertical:name.endsWith('vertical'),fps:24});
 if(!looks)run(process.execPath,['scripts/verify-sculptures.mjs',evidence,'--assets',path.dirname(out)],path.join(out,'verification.log'));
 const checkOut=looks?path.join(out,'camera.json'):path.join(evidence,'camera.json');
 run(process.env.BLENDER_BIN||'blender',['--background','--factory-startup','--disable-autoexec',path.join(out,'scene.blend'),'--threads','2','--python-exit-code','1','--python',path.join(root,'check-cameras.py'),'--','--receipt',path.join(out,'receipt.json'),'--out',checkOut],path.join(out,'camera.log'));
 if(looks){console.log(JSON.stringify({name,status:'still-and-frame-geometry-checked',poster:path.join(out,'poster.png')}));continue;}
 fs.mkdirSync(target,{recursive:true});for(const f of ['clip.mp4','poster.png','scene.blend','asset.json','receipt.json','render-config.json','blender.json','README.md'])fs.copyFileSync(path.join(out,f),path.join(target,f));fs.cpSync(path.join(out,'source'),path.join(target,'source'),{recursive:true,filter:f=>path.basename(f)!=='__pycache__'});
 for(const[f,v]of Object.entries(receipt.outputs))if(sha(path.join(target,f))!==v.sha256)throw Error('Output copy differs '+f);for(const[f,h]of Object.entries(receipt.sourceHashes))if(sha(path.join(target,'source',path.basename(f)))!==h)throw Error('Source copy differs '+f);
 if(prune&&fs.existsSync(path.join(out,'frames')))fs.rmSync(path.join(out,'frames'),{recursive:true});console.log(JSON.stringify({name,frames:receipt.config.frames,status:'rendered-and-verified',rawFramesPruned:prune}));
}
