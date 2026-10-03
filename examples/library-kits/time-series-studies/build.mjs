import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {deflateSeries,growthSeries,drawdownSeries,rollingStatistics,TIME_SERIES_VERSION} from '../../../engine/lib/time-series.mjs';
import {expandPlotProps} from '../../../fframes/plots.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
import {frame,canvas,text,panels} from './source/panels.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fmt=v=>Number(v.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2}),pct=v=>`${v>0?'+':''}${fmt(v*100)}%`;
const dates=c=>c.dates??c.values.map((_,i)=>{const d=new Date(c.start+'T00:00:00Z');d.setUTCMonth(d.getUTCMonth()+i);return d.toISOString().slice(0,10);});
const audits=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
 const F=frame(preset),ds=dates(c),x={type:'date',label:'Observed date',dateFormat:c.recipe==='C09'?'year':'month',domain:[ds[0],ds.at(-1)],ticks:[ds[0],ds[Math.floor(ds.length/2)],ds.at(-1)]},beats=[],geometry=[];let result;
 const intro=(id,title,lines,source)=>canvas(id,title,lines.map((s,i)=>text(`${id}-${i}`,s,F.margin,F.h*(.29+i*.135),F.size*(i===0?1.1:1),{width:F.w-2*F.margin,height:F.h*.11,font:i===0?'figures':'text',at:i*.55,enter:'fade',dur:.2})),source,F,20);
 if(c.recipe==='C09'){
  result=deflateSeries({baseDate:c.baseDate,observations:ds.map((date,i)=>({date,nominal:c.nominal[i],priceIndex:c.priceIndex[i]}))});const end=result.observations.at(-1);
  beats.push(intro(`${c.id}-basis`,'Convert on the same price basis',[
   'Real = nominal ÷ (price index ÷ base index)',
   `Base: ${c.baseDate.slice(0,4)} · price index ${fmt(result.basePriceIndex)}`,
   `Final: ${fmt(end.nominal)} ÷ (${fmt(end.priceIndex)} ÷ ${fmt(result.basePriceIndex)}) = ${fmt(end.real)}`,
   'Real values use base-year dollars; missing prices stay missing.'
  ],'Fictional annual records, 2020–2024. Values in $ thousands.'));
  const plot={title:c.title,source:'Fictional annual records. Real = nominal / price ratio; no interpolation.',asOf:input.asOf,x,y:{type:'linear',label:c.unit,domain:c.domain,ticks:c.ticks,decimals:2},series:[{id:'nominal',label:'Nominal',values:result.observations.map(p=>({x:p.date,y:p.nominal}))},{id:'real',label:`Real · ${c.baseDate.slice(0,4)} dollars`,values:result.observations.map(p=>({x:p.date,y:p.real}))}],motion:{at:.6,duration:4}};
  const props=expandPlotProps({plot},{width:F.w,height:F.h,duration:20,beatId:c.id});
  for(const e of props.elements)if(e.id.includes('-plot-y-tick-'))e.text=String(Number(e.text));
  delete props.source;delete props.sourceSize;props.sourceElement=`${c.id}-source`;
  props.elements.push(text(`${c.id}-gap`,`Final nominal − real: ${end.gap>0?'+':''}${fmt(end.gap)} ($ thousands)`,F.margin,F.h*.80,F.size,{fit:F.w-2*F.margin,at:4.75,enter:'fade',dur:.2}),
   text(props.sourceElement,`Fictional · 2020–2024. Real: 2020 dollars. ${c.priceIndex.includes(null)?'Missing index stays a gap.':'Difference uses stated price bases.'}`,F.margin,F.h*.89,F.w*.028,{width:F.w-2*F.margin,height:F.h*.085}));
  beats.push({id:c.id,block:'canvas',duration:20,camera:'none',exit:'none',props});
 }else{
  const observations=ds.map((date,i)=>({date,value:c.values[i]})),g=growthSeries({observations,frequency:c.frequency,lag:1,annualize:false});
  const series=(id,values)=>[{id,label:id,values:values.map((y,i)=>({x:ds[i],y}))}];let rows,source;
  if(c.recipe==='C10'){
   result=g;
   beats.push(intro(`${c.id}-basis`,'One record, three different questions',[
    'Growth = (current ÷ previous − 1) × 100',
    'Growth change = current growth − previous growth',
    'Percent growth and percentage-point change use different units.',
    'Missing endpoints break growth; missing growth breaks its change.'
   ],'Fictional monthly records, 2024. One-month growth; not annualized.'));
   rows=[{label:c.unit,values:c.values},{label:'Month-on-month growth · %',values:g.observations.map(p=>p.change===null?null:p.change*100)},{label:'Change in growth · percentage points',values:g.observations.map(p=>p.changeInGrowth===null?null:p.changeInGrowth*100)}].map((r,i)=>({...r,y:{type:'linear',label:r.label,domain:c.domains[i],ticks:c.ticks[i],decimals:0},series:series(['level','growth','change'][i],r.values)}));
   source='Fictional monthly records · 2024. Shared dates; distinct y scales. Gaps are missing, not zero.';
  }else{
   const d=drawdownSeries({observations,frequency:c.frequency}),vol=rollingStatistics({observations:g.observations.map(p=>({date:p.date,value:p.change===null?null:p.change*100})),frequency:c.frequency,window:c.window});result={drawdown:d,growth:g,rolling:vol};
   beats.push(intro(`${c.id}-basis`,'Read observed loss and variability',[
    `Worst observed drawdown: ${pct(d.maxDrawdown)}`,
    `Drawdown = level ÷ highest observed level − 1`,
    `${c.window}-month sample SD of monthly % changes; denominator n − 1.`,
    `No annualization. ${!d.episodes.length?'No observed drawdown episode.':d.episodes.at(-1).recovered?'Last episode recovered at an observed date.':'Latest episode has no observed recovery.'}`
   ],'Fictional monthly index · 2024. No unseen highs or lows are inferred.'));
   rows=[{label:'Level (blue) / observed peak (orange)',series:[...series('level',c.values),...series('peak',d.observations.map(p=>p.observedPeak))]},
    {label:'Drawdown from observed peak · %',series:series('drawdown',d.observations.map(p=>p.drawdown===null?null:p.drawdown*100)),underwater:true,colors:['accent2']},
    {label:`${c.window}-month sample SD · percentage points`,series:series('volatility',vol.observations.map(p=>p.standardDeviation))}].map((r,i)=>({...r,y:{type:'linear',label:r.label,domain:c.domains[i],ticks:c.ticks[i],decimals:0}}));
   source='Fictional monthly index · 2024. SD needs a complete window. Missing levels leave unseen peaks unknown.';
  }
  const scene=panels({id:c.id,title:c.title,x,rows,source,asOf:input.asOf},F);beats.push(scene.beat);geometry.push(...scene.geometry);
 }
 const name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
 const storyboard={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.35},transition:'cut',sfx:'off',captions:false,music:false,sources:[{claim:input.provenance+' All displayed figures derive from the dated inputs and explicit formulas; see audit.json.',source:'Original inputs.json; engine/lib/time-series.mjs version 1; SOURCES.md.',asOf:input.asOf}],beats};
 fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(storyboard,null,2)+'\n');const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
 audits.push({project:name,recipe:c.recipe,caseId:c.id,preset,result,geometry});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({modelVersion:TIME_SERIES_VERSION,inputSha256:sha(bytes),results:audits},null,2)+'\n');console.log('Prepared 12 dated time-series specimens');
