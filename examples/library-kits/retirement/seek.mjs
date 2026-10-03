// Gate externally; compare the same prepared frames in two seek orders.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {prepareProject,nativeCommand,sha256} from '../../../fframes/production.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const runs=JSON.parse(fs.readFileSync(path.join(root,'build/renders.json'),'utf8'));
const selected=process.argv.slice(2);
const reportFile=path.join(root,'build/seek.json');
const reports=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')).filter(r=>selected.length&&!selected.includes(r.project)):[];
for(const run of runs.filter(r=>!selected.length||selected.includes(r.project))){
  if(run.status!=='ready-for-review')throw Error(`${run.project}: ${run.status}`);
  const ctx=await prepareProject(path.join(root,'specimens',run.project),{draft:true});
  const sequence=['1s','2s','5s','10s','14s'],shuffled=['14s','2s','10s','1s','5s'],hashes=[];
  for(const [i,order] of [sequence,shuffled].entries()){
    const out=path.join(run.dir,`seek-${i}`);
    await nativeCommand(ctx,'frame',[...order,'-o',out],true);
    hashes.push(Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort().map(f=>[f,sha256(fs.readFileSync(path.join(out,f)))])));
  }
  if(JSON.stringify(hashes[0])!==JSON.stringify(hashes[1]))throw Error(`${run.project}: seek mismatch`);
  const record={project:run.project,sequence,shuffled,hashes:hashes[0],equal:true};
  fs.writeFileSync(path.join(run.dir,'seek.json'),JSON.stringify(record,null,2)+'\n');reports.push(record);
}
fs.writeFileSync(path.join(root,'build/seek.json'),JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify({variants:reports.length,framesCompared:reports.length*5,equal:true}));
