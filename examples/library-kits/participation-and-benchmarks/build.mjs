import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {summarizeMembership,benchmarkDifferences,DATA_MODEL_VERSION} from '../../../engine/lib/data-transforms.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
import {frame,participation,branches} from './source/scenes.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),audit=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const result=c.recipe==='C05'?summarizeMembership({membershipDate:c.membershipDate,metricAsOf:c.metricAsOf,condition:c.condition,members:c.members}):benchmarkDifferences({benchmark:c.benchmark,items:c.items});
 const F=frame(preset),beats=c.recipe==='C05'?participation(c,result,F):branches(c,result,F),name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);
 const storyboard={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.35},transition:'cut',sfx:'off',captions:false,music:false,
  sources:[{claim:`${input.provenance} ${c.basis}`,source:'Original inputs.json; engine/lib/data-transforms.mjs version 1.',asOf:input.asOf}],beats};
 fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(storyboard,null,2)+'\n');
 const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 audit.push({name,recipe:c.recipe,caseId:c.id,preset,result});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({modelVersion:DATA_MODEL_VERSION,inputSha256:crypto.createHash('sha256').update(bytes).digest('hex'),asOf:input.asOf,results:audit},null,2)+'\n');
console.log(`Prepared ${audit.length} count/weight and signed-position/area specimens.`);
