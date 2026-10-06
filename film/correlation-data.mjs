// Descriptive Pearson matrices on supplied, aligned monthly simple returns.
import {plotSpec,utcDay} from './plot-data.mjs';
export const CORRELATION_DATA_VERSION=1;
const check=(ok,m)=>{if(!ok)throw Error(`correlation: ${m}`);};
const own=(o,keys,name)=>{check(o&&typeof o==='object'&&!Array.isArray(o),`${name} must be an object`);for(const k of Object.keys(o))check(keys.includes(k),`unknown ${name}.${k}`);};
const sum=values=>{let s=0,c=0;for(const v of values){const y=v-c,t=s+y;c=(t-s)-y;s=t;}return s;};
// Positive affine normalization protects both squared subnormal differences and
// large offsets. Correlation is unchanged; no threshold turns a constant into 1.
function centered(values){
 const lo=Math.min(...values),hi=Math.max(...values);if(lo===hi)return null;
 const z=values.map(v=>(v-lo)/(hi-lo)),mean=sum(z)/z.length;
 return z.map(v=>v-mean);
}
function pearson(pairs){
 const x=centered(pairs.map(p=>p[0])),y=centered(pairs.map(p=>p[1]));if(x===null||y===null)return null;
 const r=sum(x.map((v,i)=>v*y[i]))/Math.sqrt(sum(x.map(v=>v*v)))/Math.sqrt(sum(y.map(v=>v*v)));
 check(Number.isFinite(r)&&Math.abs(r)<=1+1e-12,'unstable coefficient');return Math.max(-1,Math.min(1,r));
}
export function correlationMatrix(input){
 own(input,['plot','method','frequency','returnType','window','minObservations'],'input');
 check(input.method==='pearson','method must be pearson');check(input.frequency==='monthly','frequency must be monthly');check(input.returnType==='simple-percent','supplied simple returns in percent required');
 const plot=plotSpec(input.plot);check(plot.x.type==='date'&&plot.y.type==='linear'&&plot.y.suffix==='%','dated x and linear percent-return y required');check(plot.series.length>=2,'at least two series required');
 const dates=plot.series[0].values.map(p=>p.x);check(dates.length>=3,'at least three explicit months required');
 let prev;
 for(const date of dates){const day=utcDay(date),d=new Date(day*86400000),next=new Date((day+1)*86400000),month=d.getUTCFullYear()*12+d.getUTCMonth();check(next.getUTCDate()===1,'each observation must label a calendar month end');check(prev===undefined||month===prev+1,'retain every calendar month, using null for missing returns');prev=month;}
 check(utcDay(plot.asOf)>=utcDay(dates.at(-1)),'asOf cannot precede observations');
 for(const s of plot.series){check(s.values.length===dates.length&&s.values.every((p,i)=>p.x===dates[i]),'all series must share the same explicit month grid');for(const p of s.values)check(p.y===null||p.y>=-100,'simple returns cannot be below -100%');}
 own(input.window,['start','end'],'window');const start=dates.indexOf(input.window.start),end=dates.indexOf(input.window.end);check(start>=0&&end>=start,'window endpoints must name increasing included months');
 check(Number.isInteger(input.minObservations)&&input.minObservations>=3&&input.minObservations<=dates.length,'minObservations must be 3 through the number of supplied months');
 const months=dates.slice(start,end+1),cells=[];
 for(const [i,a]of plot.series.entries())for(const [j,b]of plot.series.entries()){
  const used=[],missing=[],pairs=[];
  for(let k=start;k<=end;k++){const x=a.values[k].y,y=b.values[k].y;if(x===null||y===null)missing.push(dates[k]);else{used.push(dates[k]);pairs.push([x,y]);}}
  const n=pairs.length,value=n<input.minObservations?null:pearson(pairs),reason=n<input.minObservations?'insufficient-pairs':value===null?'zero-variance':null;
  cells.push({row:i,column:j,rowId:a.id,columnId:b.id,n,value,reason,dates:used,missingDates:missing});
 }
 return{version:CORRELATION_DATA_VERSION,plot,method:input.method,frequency:input.frequency,returnType:input.returnType,window:{...input.window},minObservations:input.minObservations,missingPolicy:'pairwise-complete; no-fill; no-carry',months,cells};
}
