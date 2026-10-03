import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {vintageSnapshot,maturityCurves,scenarioEnvelope,EXPECTATIONS_VERSION} from '../../../engine/lib/expectations.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
import {frame,method,chart} from './source/scene.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex'),audits=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const F=frame(preset),beats=[],scenes=[];let result;
 const y={type:'linear',label:c.unit,domain:c.domain,ticks:c.ticks,decimals:c.recipe==='C06'?1:0};
 const base=(x,series,title=c.title)=>({title,source:'Original fictional inputs; explicit methods in SOURCES.md.',asOf:input.asOf,x,y,series,motion:{at:.6,duration:4}});
 const add=scene=>{beats.push(scene.beat);scenes.push(scene);};
 if(c.recipe==='C04'){
  result=c.cutoffs.map(asOf=>vintageSnapshot({asOf,vintages:c.vintages,releases:c.releases}));
  for(const [i,snapshot]of result.entries()){
   const x={type:'date',label:'Forecast target / observed quarter end · 2024',dateFormat:'month',domain:c.targetDomain,ticks:[c.targetDomain[0],'2024-06-30',c.targetDomain[1]]};
   const series=snapshot.vintages.map((v,j)=>({id:`vintage-${j}`,label:`Issued ${v.issuedAt.slice(5)}`,values:v.values.map(p=>({x:p.targetDate,y:p.value}))}));
   if(snapshot.actuals.some(p=>p.value!==null))series.push({id:'actual',label:'Actual released',values:snapshot.actuals.map(p=>({x:p.targetDate,y:p.value}))});
   add(chart(`${c.id}-${i}`,base(x,series),{cutoff:snapshot.asOf,takeaway:c.takeaways[i],source:`Fictional · 2024. Forecasts keep issue dates. Actuals: latest released by ${snapshot.asOf}. Values: last available target.`},F));
  }
 }else if(c.recipe==='C06'){
  result=maturityCurves({tenors:c.tenors,snapshots:c.snapshots,kind:c.kind,unit:'percent-per-year'});
  beats.push(method(`${c.id}-basis`,'Position each quote by its maturity',[
   '1 month = 1/12 year; 10 years = 120 months.',
   'Each line contains quotes from one observation date.',
   'Dots are supplied quotes; connecting lines are visual guides.',
   'No fitted rates, implied forwards or future-rate forecast.'
  ],'Fictional 2024 yield quotes. The horizontal axis is remaining maturity.',F));
  const x={type:'linear',label:'Remaining maturity · years',domain:[0,10],ticks:[0,2,5,10],decimals:0},series=result.snapshots.map((s,i)=>({id:`date-${i}`,label:s.date,values:s.values.map(p=>({x:p.years,y:p.value}))}));
  add(chart(c.id,base(x,series),{takeaway:c.takeaway,source:'Fictional quotes · 2024. Remaining maturity uses true spacing. Null quotes break the line; no curve fitting.'},F));
 }else{
  result=scenarioEnvelope({history:c.history,scenarios:c.scenarios,band:c.band});
  const isRange=c.band.kind==='range';
  beats.push(method(`${c.id}-basis`,isRange?'Name the scenarios before the band':'Define the ensemble before the interval',isRange?[
   'Three supplied paths begin at the same observed origin.',
   'At each date: band lower = minimum; upper = maximum.',
   'Paths have equal weight. No likelihoods are assigned.',
   'The range describes these inputs, not all possible outcomes.'
  ]:[
   'Five supplied paths, each with equal weight.',
   'Band: 25th to 75th empirical percentiles. Middle line: median.',
   'Type 7: interpolate at sorted rank (n − 1) × p.',
   'One missing path leaves a gap. This is not a confidence interval.'
  ],'Original fictional 2024 paths. Descriptive ensemble; no probability forecast.',F));
  const x={type:'date',label:'Observed dates, then scenario dates · 2024',dateFormat:'month',domain:[c.history[0].date,result.observations.at(-1).date],ticks:[c.history[0].date,result.origin.date,result.observations.at(-1).date]},series=[{id:'history',label:'Observed history',values:c.history.map(p=>({x:p.date,y:p.value}))}];
  if(isRange)series.push(...result.scenarios.map(s=>({id:s.id,label:s.label,values:s.values.map(p=>({x:p.date,y:p.value}))})));
  else for(const [id,label]of [['lower','25th percentile'],['median','Median'],['upper','75th percentile']])series.push({id,label,values:result.observations.map(p=>({x:p.date,y:p[id]}))});
  add(chart(c.id,base(x,series),{band:result.observations,origin:result.origin.date,takeaway:c.takeaway,source:`Fictional · 2024. History ends Mar 31. ${isRange?'Three equal-weight scenarios; descriptive range.':'Five equal-weight paths; full set required at every date.'}`},F));
 }
 const name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const storyboard={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.35},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' Displayed data derive from inputs.json under the explicit chronology, maturity and scenario rules in audit.json.',source:'Original inputs.json; engine/lib/expectations.mjs version 1; SOURCES.md.',asOf:input.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(storyboard,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 audits.push({project:name,recipe:c.recipe,caseId:c.id,preset,result,scenes:scenes.map(({beat,...rest})=>({beat:beat.id,...rest}))});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({modelVersion:EXPECTATIONS_VERSION,inputSha256:sha(bytes),results:audits},null,2)+'\n');console.log('Prepared 12 native expectations specimens');
