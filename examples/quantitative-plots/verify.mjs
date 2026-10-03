// Run through codex-heavy with CLEARFRAME_HEAVY_HELD=1 after checking disk reserve.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runPipeline } from '../../engine/lib/pipeline.mjs';
import { prepareProject, nativeCommand, sha256 } from '../../fframes/production.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const variants=process.argv.slice(2);
if(!variants.length)variants.push('landscape','vertical','stress-landscape','stress-vertical','stress-square','stress-portrait');
const reportFile=path.join(root,'build/verification.json');
const reports=fs.existsSync(reportFile)?JSON.parse(fs.readFileSync(reportFile,'utf8')).filter(r=>!variants.includes(r.variant)):[];
for(const name of variants) {
  if(!/^(stress-)?(landscape|vertical|square|portrait)$/.test(name))throw Error('Unknown specimen');
  const project=path.join(root,name), run=await runPipeline(project,{draft:true});
  if(run.status!=='ready-for-review')throw Error(`${name}: ${run.error??run.status}`);
  const ctx=await prepareProject(project,{draft:true});
  const sequence=['1s','3s','5s','9s','12s'];
  const shuffled=['12s','1s','9s','3s','5s'];
  const hashes=[];
  for(const [i,order] of [sequence,shuffled].entries()) {
    const out=path.join(run.dir,`seek-${i}`);
    await nativeCommand(ctx,'frame',[...order,'-o',out],true);
    hashes.push(Object.fromEntries(fs.readdirSync(out).filter(f=>f.endsWith('.png')).sort().map(f=>[f,sha256(fs.readFileSync(path.join(out,f)))])));
  }
  if(JSON.stringify(hashes[0])!==JSON.stringify(hashes[1]))throw Error(`${name}: seek order changes pixels`);
  const seek={sequence,shuffled,hashes:hashes[0],equal:true};
  fs.writeFileSync(path.join(run.dir,'seek.json'),JSON.stringify(seek,null,2)+'\n');
  reports.push({variant:name,dir:run.dir,inputId:run.inputs.inputId,check:run.check,qa:run.qa.summary,seek});
  fs.mkdirSync(path.join(root,'build'),{recursive:true});
  fs.writeFileSync(path.join(root,'build/verification.json'),JSON.stringify(reports,null,2)+'\n');
  console.log(JSON.stringify({variant:name,warnings:run.check.warnings,pops:run.qa.summary.pops,seekEqual:true}));
}
