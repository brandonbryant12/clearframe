import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {valuationScene} from '../../../fframes/valuations.mjs';import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),results=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const [width,height]=preset==='landscape'?[1920,1080]:[1080,1920],{id:caseId,...data}=c,beats=[],stages=[];
 for(const [i,id]of ['grid','slice'].entries()){
  const r=valuationScene(data,{width,height,id,view:id,reveal:true});
  beats.push({id,block:'canvas',duration:36,camera:'none',exit:'none',props:r.props});stages.push({id,model:r.model,geometry:r.geometry});
 }
 const name=`${caseId}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const sb={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' CashFlowNow is the annual time-zero basis, not a time-zero receipt. Future cash flows occur at each year end; first flow = basis times (1+growth). Rates are effective annual percent. Value is discounted future flows minus initial outlay. Finite model has no terminal value; perpetual model requires discount greater than growth. Slice values are the same evaluated grid cells; connecting segments are guides only. Display rounds to declared decimals; audit preserves full precision.',source:'inputs.json; fframes/valuation-data.mjs v1; independent formula references in SOURCES.md.',asOf:c.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 results.push({name,caseId,recipe:'C14',preset,storyboardSha256:sha(fs.readFileSync(path.join(dir,'storyboard.json'))),stages});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({version:1,inputSha256:sha(bytes),results},null,2)+'\n');console.log(`Prepared ${results.length} valuation specimens.`);
