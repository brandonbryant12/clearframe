import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {expandPlotProps,plotLayout} from '../../../fframes/plots.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';
import {computeTiming} from '../../../engine/lib/timing.mjs';
import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const input=JSON.parse(fs.readFileSync(path.join(root,'source/inputs.json'),'utf8'));
for(const preset of ['landscape','vertical'])for(const study of ['comparison','interval']){
  const d=input[study],width=preset==='landscape'?1920:1080,height=preset==='landscape'?1080:1920;
  const frame={width,height,duration:12,beatId:study},L=plotLayout(frame);
  const plot={title:d.title,asOf:input.asOf,source:study==='comparison'?'Illustrative indices. Both start at 100; calendar dates are not a forecast.':'Illustrative hours. Shading marks a time window; it does not prove causation.',
    x:{type:'date',label:'Observation date',domain:[d.dates[0],d.dates.at(-1)],ticks:[d.dates[0],d.dates.at(-1)]},
    y:{type:'linear',label:d.unit,domain:d.yDomain,ticks:d.yTicks,decimals:0,suffix:study==='interval'?'h':''},
    series:d.series.map(s=>({id:s.id,label:s.label,values:s.values.map((y,i)=>({x:d.dates[i],y}))})),motion:{at:.5,duration:4}};
  if(study==='interval'){
    const reference=d.series[1].values.at(-1);if(!(reference>0))throw Error('Endpoint comparison requires positive reference.');
    const ratio=100*d.series[0].values.at(-1)/reference;
    plot.annotation={seriesId:'observed',x:d.dates.at(-1),label:`${Number(ratio.toFixed(1))}% of reference`,dx:-.35,dy:.22};
  }
  const props=expandPlotProps({plot},frame);
  if(study==='interval'){
    const px=x=>L.left+(Date.parse(x)-Date.parse(d.dates[0]))/(Date.parse(d.dates.at(-1))-Date.parse(d.dates[0]))*(L.right-L.left);
    props.elements.unshift({id:'interval-window',type:'rect',x:px(d.window[0]),y:L.top,w:px(d.window[1])-px(d.window[0]),h:L.bottom-L.top,fill:'#796499',opacity:.12,at:0,enter:'none'});
    props.elements.push({id:'window-label',type:'text',text:d.windowMeaning,x:L.margin,y:height*.30,size:width*.03,fill:'muted',fit:width-2*L.margin,at:0,enter:'none'});
  }
  const sb={title:d.title,format:{preset,fps:30},theme:'research-paper',type:'inter',backdrop:'none',motion:{preset:'gentle',intensity:.3},transition:'cut',sfx:'off',captions:false,music:false,
    sources:[{claim:input.provenance,source:'Original source/inputs.json; no Timmer market figures adopted.',asOf:input.asOf}],
    beats:[{id:study,block:'canvas',duration:12,camera:'none',exit:'none',props}]};
  const dir=path.join(root,`${study}-${preset}`);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'storyboard.json'),JSON.stringify(sb,null,2)+'\n');
  const job=createJob(loadStoryboard(dir),computeTiming(dir),{draft:true});if(job.errors.length)throw Error(job.errors.join('\n'));
}
console.log('Four native style specimens compiled.');
