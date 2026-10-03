import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {multipleScene} from '../../../fframes/small-multiples.mjs';import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),results=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const [width,height]=preset==='landscape'?[1920,1080]:[1080,1920],dates=input.dates,
 plot={title:c.title,source:c.source,asOf:input.asOf,x:{type:'date',label:'Observed month',domain:[dates[0],dates.at(-1)],ticks:[dates[0],dates.at(-1)],dateFormat:'month'},y:{type:'linear',label:c.unit,domain:c.domain,ticks:c.ticks,decimals:0},motion:'none',series:c.series.map(s=>({...s,values:s.values.map((y,i)=>({x:dates[i],y}))}))},beats=[],stages=[];
 for(const [i,rankAt]of [dates[0],dates.at(-1),dates.at(-1)].entries()){
  const selected=i===2?c.selected:null,id=['first-rank','last-rank','focus'][i],subtitle=selected?c.focus:`Full Jan–Jun history; rank by ${rankAt} (${c.direction==='ascending'?'low':'high'} first).`,r=multipleScene({plot,rankAt,direction:c.direction},{width,height,id,subtitle,expandedId:selected,reveal:i===0});
  beats.push({id,block:'canvas',duration:i===0?28:i===1?26:24,camera:'none',exit:'none',props:r.props});stages.push({id,rankAt,expandedId:selected,model:r.model,layout:r.layout,local:r.local,geometry:r.geometry});
 }
 const name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const sb={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' Ranks compare an observed same-date value, retain missing members and use shared domains. All stages show the full history.',source:'inputs.json; fframes/multiple-data.mjs version1; native canvas composition.',asOf:input.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 results.push({name,caseId:c.id,recipe:'C18',preset,storyboardSha256:sha(fs.readFileSync(path.join(dir,'storyboard.json'))),stages});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({version:1,inputSha256:sha(bytes),results},null,2)+'\n');console.log(`Prepared ${results.length} ranked-panel specimens.`);
