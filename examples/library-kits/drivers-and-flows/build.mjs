import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {rebaseSeries,decomposeProduct,reconcileStock,DATA_MODEL_VERSION} from '../../../engine/lib/data-transforms.mjs';
import {expandPlotProps,plotLayout} from '../../../fframes/plots.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';import {computeTiming} from '../../../engine/lib/timing.mjs';import {createJob} from '../../../fframes/job.mjs';
import {frame,canvas,text,bridge} from './source/bridge.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),bytes=fs.readFileSync(path.join(root,'inputs.json')),input=JSON.parse(bytes);
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const fmt=v=>Number(v.toFixed(2)).toLocaleString('en-US',{maximumFractionDigits:2});
const signed=v=>`${v>0?'+':v<0?'−':''}${fmt(Math.abs(v))}`;
const audits=[];
for(const c of input.cases)for(const preset of ['landscape','vertical']){
  const F=frame(preset),beats=[],geometry=[];let result;
  if(c.recipe==='C02'){
    result=c.series.map(s=>({id:s.id,label:s.label,...rebaseSeries({observations:s.observations,baseDate:s.baseDate,baseIndex:100})}));
    beats.push(canvas(`${c.id}-bases`,'Align the event, preserve the dates',[
      text('original-unit',`Original measure: ${c.rawUnit}`,F.margin,F.h*.23,F.size,{fit:F.w-2*F.margin}),
      text('rule','Index = 100 × value / observed base',F.margin,F.h*.31,F.size*1.08,{fit:F.w-2*F.margin,font:'figures'}),
      ...result.map((s,i)=>text(`base-${s.id}`,`${s.label} · ${s.baseDate} · base ${fmt(s.baseValue)}`,F.margin,F.h*(.46+i*.13),F.size,{fit:F.w-2*F.margin,at:.5+i*.6,enter:'fade',dur:.25})),
      text('limit','Different calendar starts; one elapsed-day scale.',F.margin,F.h*.72,F.size,{fit:F.w-2*F.margin,at:1.7,enter:'fade',dur:.25})
    ],'Fictional records. Missing values stay missing. Older history is not a forecast.',F,9));
    const latest=result[0].observations.at(-1).elapsedDays,L=plotLayout({width:F.w,height:F.h});
    const plot={title:c.title,source:'Fictional records. Older continuation is not a forecast. Index = 100 × value / base.',asOf:input.asOf,
      x:{type:'linear',label:'Elapsed days from each start',domain:c.elapsedDomain,ticks:c.elapsedTicks},y:{type:'linear',label:c.unit,domain:c.domain,ticks:c.ticks,decimals:1},
      series:result.map(s=>({id:s.id,label:s.label,values:s.observations.map(p=>({x:p.elapsedDays,y:p.index}))})),motion:{at:.5,duration:4},
      annotation:{seriesId:'newer',x:latest,label:'Newer record ends',dx:0,dy:.22}};
    const props=expandPlotProps({plot},{width:F.w,height:F.h,duration:14,beatId:c.id});
    const start=L.left+(latest-c.elapsedDomain[0])/(c.elapsedDomain[1]-c.elapsedDomain[0])*(L.right-L.left);
    props.elements.unshift({id:`${c.id}-older-only`,type:'rect',x:start,y:L.top,w:L.right-start,h:L.bottom-L.top,fill:'#796499',opacity:.10,at:0,enter:'none'});
    props.elements.push(text(`${c.id}-continuation`,'Violet region: older history only',F.margin,F.h*.275,F.size,{fit:F.w-2*F.margin,fill:'muted'}));
    beats.push({id:c.id,block:'canvas',duration:14,camera:'none',exit:'none',props});
  }else if(c.recipe==='C03'){
    result=decomposeProduct({first:c.first,second:c.second,additions:c.additions});
    const a=c.first,b=c.second,content=F.w-2*F.margin;
    const e=[text('method',c.factorBasis,F.margin,F.h*.25,F.size,{fit:content}),
      text('opening',`Opening: ${fmt(a.start)} × ${fmt(b.start)} = ${fmt(result.opening)}`,F.margin,F.h*.38,F.size*1.15,{fit:content,font:'figures',at:.5,enter:'fade',dur:.25}),
      text('ending',`Ending product: ${fmt(a.end)} × ${fmt(b.end)} = ${fmt(result.endingProduct)}`,F.margin,F.h*.49,F.size*1.15,{fit:content,font:'figures',at:1.5,enter:'fade',dur:.25}),
      text('additions',`Separate additions: ${signed(result.additiveTotal)} → combined ${fmt(result.combinedValue)}`,F.margin,F.h*.60,F.size,{fit:content,at:2.5,enter:'fade',dur:.25}),
      text('return',`(${fmt(result.combinedValue)} − ${fmt(result.opening)}) / ${fmt(result.opening)} = ${signed(result.changeFraction*100)}%`,F.margin,F.h*.71,F.size*1.1,{fit:content,font:'figures',at:3.5,enter:'fade',dur:.25})];
    beats.push(canvas(`${c.id}-inputs`,'Read the inputs before the attribution',e,`Fictional inputs. ${c.basis}`,F,12));
    const bscene=bridge({id:c.id,title:c.title,unit:c.unit,opening:0,closing:result.changeFraction*100,parts:result.parts.map(p=>({...p,amount:p.fraction*100})),domain:c.domain,ticks:c.ticks,
      source:'Fictional. Components are percentage points; closing is the percent change. Interaction is not a causal effect.',
      valueLabel:r=>r.total?`${fmt(r.amount)}%`:`${signed(r.amount)} pp`},F);
    bscene.beat.props.elements.find(e=>e.id===`${c.id}-label-opening`).text='Baseline';
    bscene.beat.props.elements.find(e=>e.id===`${c.id}-label-closing`).text='Net change';
    beats.push(bscene.beat);geometry.push(...bscene.geometry);
  }else{
    result=reconcileStock({opening:c.opening,closing:c.closing,components:c.components});
    const bscene=bridge({id:c.id,title:c.title,unit:c.unit,opening:result.opening,closing:result.closing,parts:result.components,domain:c.domain,ticks:c.ticks,
      source:'Fictional period. Violet is unexplained; never relabel it as a flow. Row order is arithmetic, not timing.',valueLabel:r=>r.total?fmt(r.amount):signed(r.amount)},F);
    beats.push(bscene.beat);geometry.push(...bscene.geometry);
    beats.push(canvas(`${c.id}-check`,'Closing stock must reconcile',[
      text('unit',c.unit,F.margin,F.h*.23,F.size,{fit:F.w-2*F.margin}),
      text('net',`Observed change: ${fmt(result.closing)} − ${fmt(result.opening)} = ${signed(result.netChange)}`,F.margin,F.h*.34,F.size*1.1,{fit:F.w-2*F.margin,font:'figures'}),
      text('known',`Supplied changes: ${result.components.filter(p=>p.kind==='supplied').map(p=>signed(p.amount)).join(' ')} = ${signed(result.suppliedNetChange)}`,F.margin,F.h*.47,F.size,{fit:F.w-2*F.margin,at:.6,enter:'fade',dur:.25}),
      text('residual',`Unexplained: ${fmt(result.closing)} − ${fmt(result.explainedClosing)} = ${signed(result.residual)}`,F.margin,F.h*.60,F.size*1.1,{fit:F.w-2*F.margin,font:'figures',at:1.2,enter:'fade',dur:.25}),
      text('meaning','A residual preserves what the supplied records do not explain.',F.margin,F.h*.73,F.size,{fit:F.w-2*F.margin,at:1.8,enter:'fade',dur:.25})
    ],`Fictional. ${c.period}. ${c.basis}`,F,10));
  }
  const name=`${c.id}-${preset}`,dir=path.join(root,'specimens',name);fs.mkdirSync(dir,{recursive:true});
  const storyboard={version:2,title:c.title,format:{preset,fps:30},theme:'paper',type:'geometric',backdrop:'none',motion:{preset:'gentle',intensity:.35},transition:'cut',sfx:'off',captions:false,music:false,
    sources:[{claim:`${input.provenance} ${c.basis??'Each series uses its own dated positive base; no current continuation is imputed.'}`,source:'Original inputs.json; engine/lib/data-transforms.mjs version 1.',asOf:input.asOf}],beats};
  fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(storyboard,null,2)+'\n');
  const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
  audits.push({project:name,recipe:c.recipe,caseId:c.id,preset,result,geometry});
}
fs.writeFileSync(path.join(root,'audit.json'),JSON.stringify({modelVersion:DATA_MODEL_VERSION,inputSha256:sha(bytes),asOf:input.asOf,frequency:input.frequency,results:audits},null,2)+'\n');
console.log(`Prepared ${audits.length} original specimens with source-bound calculations.`);
