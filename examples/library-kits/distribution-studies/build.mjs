import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {distributionScene} from '../../../fframes/distributions.mjs';import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),results=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const [width,height]=preset==='landscape'?[1920,1080]:[1080,1920],{id:caseId,...data}=c,beats=[],stages=[];
 for(const [i,id]of ['distribution','threshold'].entries()){
  const r=distributionScene(data,{width,height,id,focus:i===1,reveal:i===0});
  beats.push({id,block:'canvas',duration:32,camera:'none',exit:'none',props:r.props});stages.push({id,model:r.model,geometry:r.geometry});
 }
 const name=`${caseId}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const sb={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' Bins include their left edge and exclude their right, except the final bin includes both. Counts and threshold membership are computed directly from non-null observations. Density is count divided by observed sample size and bin width. Dot y positions separate marks only.',source:'inputs.json; fframes/distribution-data.mjs v1. Density method: NIST histogram reference (see SOURCES.md).',asOf:c.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 results.push({name,caseId,recipe:'C13',preset,storyboardSha256:sha(fs.readFileSync(path.join(dir,'storyboard.json'))),stages});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({version:1,inputSha256:sha(bytes),results},null,2)+'\n');console.log(`Prepared ${results.length} distribution specimens.`);
