// Resource gate is supplied by the caller; no concurrent renderer work.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {runPipeline} from '../../../engine/lib/pipeline.mjs';
import {prepareProject,nativeCommand,sha256} from '../../../fframes/production.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const names=process.argv.slice(2);if(!names.length)names.push(...fs.readdirSync(path.join(root,'specimens')).sort());
const file=path.join(root,'build/verification.json');fs.mkdirSync(path.dirname(file),{recursive:true});
const results=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).filter(r=>!names.includes(r.name)):[];
for(const name of names){
 const disk=fs.statfsSync(root);if(disk.bavail*disk.bsize<20*1024**3)throw Error('Restore the 20 GiB render reserve before continuing');
 const project=path.join(root,'specimens',name),r=await runPipeline(project,{draft:true});if(r.status!=='ready-for-review')throw Error(r.error??r.status);
 const ctx=await prepareProject(project,{draft:true});
 const sequence=ctx.job.beats.flatMap(b=>[.5,1.5,Math.min(3.5,b.frames/ctx.job.fps-.25),b.frames/ctx.job.fps-.4].map(dt=>((b.start_frame+Math.round(dt*ctx.job.fps))/ctx.job.fps).toFixed(4)+'s'));
 const shuffled=[...sequence.filter((_,i)=>i%2===1).reverse(),...sequence.filter((_,i)=>i%2===0)],hashes=[];
 for(const [i,order] of [sequence,shuffled].entries()){
  const out=path.join(r.dir,`seek-${i}`);await nativeCommand(ctx,'frame',[...order,'-o',out],true);
  hashes.push(Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort().map(f=>[f,sha256(fs.readFileSync(path.join(out,f)))])));
 }
 if(JSON.stringify(hashes[0])!==JSON.stringify(hashes[1]))throw Error(`${name}: seek mismatch`);
 const seek={sequence,shuffled,hashes:hashes[0],equal:true};fs.writeFileSync(path.join(r.dir,'seek.json'),JSON.stringify(seek,null,2)+'\n');
 const compact=path.join(root,'evidence',name);fs.mkdirSync(compact,{recursive:true});
 for(const file of ['video.mp4','video.mp4.json','sheet.png','phone.png','timeline.png','check.json','qa.json','seek.json']){
  const source=path.join(r.dir,file),dest=path.join(compact,file);fs.copyFileSync(source,dest);
  if(sha256(fs.readFileSync(source))!==sha256(fs.readFileSync(dest)))throw Error('Compact evidence copy mismatch');
 }
 if(fs.existsSync(path.join(r.dir,'boundaries')))fs.cpSync(path.join(r.dir,'boundaries'),path.join(compact,'boundaries'),{recursive:true});
 fs.writeFileSync(path.join(compact,'native-job.json'),JSON.stringify(ctx.job,null,2)+'\n');
 const pipelineId=path.basename(r.dir);
 results.push({name,dir:compact,pipelineId,check:r.check,qa:r.qa.summary,seek});fs.writeFileSync(file,JSON.stringify(results,null,2)+'\n');
 // This exact specimen build was created above; retain verified compact evidence before pruning it.
 fs.rmSync(path.join(project,'build'),{recursive:true});
 console.log(JSON.stringify({name,errors:r.check.errors,warnings:r.check.warnings,pops:r.qa.summary.pops,seekEqual:true}));
}
