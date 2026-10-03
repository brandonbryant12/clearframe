import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {phaseScene} from '../../../fframes/phases.mjs';import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),results=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const [width,height]=preset==='landscape'?[1920,1080]:[1080,1920],{id:caseId,...data}=c,beats=[],stages=[];
 for(const id of ['trail','focus']){
  const r=phaseScene(data,{width,height,id,view:id,reveal:true});beats.push({id,block:'canvas',duration:36,camera:'none',exit:'none',props:r.props});stages.push({id,model:r.model,geometry:r.geometry});
 }
 const name=`${caseId}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const sb={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' Both coordinates come from the same dated row. Null in either coordinate leaves a missing pair and breaks all adjacent connections. Positions use explicit linear axes, with no smoothing or inferred intervening states. The reveal clock and lower strip use elapsed calendar days. Lines join only adjacent supplied complete observations and are guides, not a measured continuous path. Reference equality is separate from all four open quadrants. No forecast, causal proof or repeating cycle is inferred.',source:'inputs.json; fframes/phase-data.mjs v1; independent method reference in SOURCES.md.',asOf:c.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 results.push({name,caseId,recipe:'C15',preset,storyboardSha256:sha(fs.readFileSync(path.join(dir,'storyboard.json'))),stages});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({version:1,inputSha256:sha(bytes),results},null,2)+'\n');console.log(`Prepared ${results.length} phase-trail specimens.`);
