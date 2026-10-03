// Gate externally with codex-heavy; verify each recipe independently and retain failures.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {runPipeline} from '../../../engine/lib/pipeline.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const inspect=process.argv.includes('--inspect');
const selected=process.argv.slice(2).filter(v=>v!=='--inspect');
const dirs=fs.readdirSync(path.join(root,'specimens')).filter(d=>!selected.length||selected.includes(d));
const file=path.join(root,'build',inspect?'inspection.json':'renders.json');
fs.mkdirSync(path.dirname(file),{recursive:true});
const results=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')).filter(r=>!dirs.includes(r.project)):[];
for(const project of dirs){
  let r;
  try { r=await runPipeline(path.join(root,'specimens',project),{draft:true,noRender:inspect}); }
  catch(error){
    const report=error.message.match(/\nReport: (.*)\/REPORT\.md$/)?.[1];
    if(!report)throw error;
    r=JSON.parse(fs.readFileSync(path.join(report,'report.json'),'utf8'));
  }
  const result={project,dir:r.dir,status:r.status,error:r.error,check:r.check,qa:r.qa?.summary};
  results.push(result);fs.writeFileSync(file,JSON.stringify(results,null,2)+'\n');
  console.log(JSON.stringify(result));
}
if(results.some(r=>r.status==='failed'))process.exitCode=1;
