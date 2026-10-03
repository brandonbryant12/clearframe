// Resource gate is supplied by the caller; no concurrent renderer work.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {runPipeline} from '../../../engine/lib/pipeline.mjs';
import {prepareProject,nativeCommand,sha256} from '../../../fframes/production.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const names=process.argv.slice(2);if(!names.length)names.push('comparison-landscape','comparison-vertical','interval-landscape','interval-vertical','gate-landscape','gate-vertical');
const file=path.join(root,'build/verification.json');fs.mkdirSync(path.dirname(file),{recursive:true});
const results=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).filter(r=>!names.includes(r.name)):[];
for(const name of names){
 const project=path.join(root,name),r=await runPipeline(project,{draft:true});if(r.status!=='ready-for-review')throw Error(r.error??r.status);
 const ctx=await prepareProject(project,{draft:true}),sequence=['1s','2s','3s','4s','5s'],shuffled=['5s','2s','4s','1s','3s'],hashes=[];
 for(const [i,order] of [sequence,shuffled].entries()){
  const out=path.join(r.dir,`seek-${i}`);await nativeCommand(ctx,'frame',[...order,'-o',out],true);
  hashes.push(Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort().map(f=>[f,sha256(fs.readFileSync(path.join(out,f)))])));
 }
 if(JSON.stringify(hashes[0])!==JSON.stringify(hashes[1]))throw Error(`${name}: seek mismatch`);
 const seek={sequence,shuffled,hashes:hashes[0],equal:true};fs.writeFileSync(path.join(r.dir,'seek.json'),JSON.stringify(seek,null,2)+'\n');
 results.push({name,dir:r.dir,check:r.check,qa:r.qa.summary,seek});fs.writeFileSync(file,JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({name,errors:r.check.errors,warnings:r.check.warnings,pops:r.qa.summary.pops,seekEqual:true}));
}
