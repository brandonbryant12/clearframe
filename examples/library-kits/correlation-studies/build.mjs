import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {correlationScene} from '../../../fframes/correlations.mjs';import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),results=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const [width,height]=preset==='landscape'?[1920,1080]:[1080,1920],dates=input.dates,plot={title:c.title,source:c.source,asOf:input.asOf,x:{type:'date',label:'Observed month end',domain:[dates[0],dates.at(-1)],ticks:[dates[0],dates.at(-1)],dateFormat:'month'},y:{type:'linear',label:'Monthly simple return',domain:c.domain,ticks:c.ticks,decimals:0,suffix:'%'},motion:'none',series:c.series.map(s=>({...s,values:s.values.map((y,i)=>({x:dates[i],y}))}))},beats=[],stages=[];
 for(const [i,window]of [input.windows[0],input.windows[1],input.windows[1]].entries()){
  const id=['first-window','last-window','pair-view'][i],view=i===2?'pair':'matrix',r=correlationScene({plot,window,method:'pearson',frequency:'monthly',returnType:'simple-percent',minObservations:c.minObservations},{width,height,id,selectedPair:c.selectedPair,view,reveal:i!==1});
  beats.push({id,block:'canvas',duration:i===0?34:i===1?32:28,camera:'none',exit:'none',props:r.props});stages.push({id,view,model:r.model,selectedCell:r.selectedCell,geometry:r.geometry});
 }
 const name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const sb={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' Pearson correlation uses only paired months in each named inclusive window. Undefined for insufficient pairs or constant series. Matrix coefficients rounded to two decimals; color represents a fixed -1 to +1 domain.',source:'inputs.json; fframes/correlation-data.mjs v1. Pearson method: NIST Dataplot correlation reference (see SOURCES.md).',asOf:input.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 results.push({name,caseId:c.id,recipe:'C07',preset,storyboardSha256:sha(fs.readFileSync(path.join(dir,'storyboard.json'))),stages});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({version:1,inputSha256:sha(bytes),results},null,2)+'\n');console.log(`Prepared ${results.length} correlation specimens.`);
