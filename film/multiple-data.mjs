// Ranked shared-axis panels. Ranking changes order, never observations or domains.
import {plotSpec} from './plot-data.mjs';
export const MULTIPLE_DATA_VERSION=1;
const check=(ok,m)=>{if(!ok)throw Error(`small multiples: ${m}`);};
const own=(v,keys)=>{check(v&&typeof v==='object'&&!Array.isArray(v),'an input object is required');for(const k of Object.keys(v))check(keys.includes(k),`unknown input.${k}`);};
const byId=(a,b)=>a.id<b.id?-1:a.id>b.id?1:0;
export function rankSeries(input){
 own(input,['plot','rankAt','direction']);const plot=plotSpec(input.plot);
 check(plot.x.type==='date'&&plot.y.type==='linear','shared dated x and linear y axes required');
 check(plot.series.length>=2,'at least two series are required');
 check(['ascending','descending'].includes(input.direction),'direction must be ascending or descending');
 const dates=plot.series[0].values.map(p=>p.x);check(dates.length>=2,'at least two common dates required');
 for(const s of plot.series)check(s.values.length===dates.length&&s.values.every((p,i)=>p.x===dates[i]),'all series need the same explicit date grid; retain null observations');
 const index=dates.indexOf(input.rankAt);check(index>=0,'rankAt must name an explicit common date');
 const direction=input.direction==='ascending'?1:-1,panels=plot.series.map(s=>({...s,value:s.values[index].y})).sort((a,b)=>a.value===null?(b.value===null?byId(a,b):1):b.value===null?-1:direction*(a.value-b.value)||byId(a,b));
 let last,rank=0;for(const [i,p]of panels.entries()){
  if(p.value===null){p.rank=null;p.tied=false;continue;}
  if(i===0||p.value!==last)rank=i+1;p.rank=rank;last=p.value;
  p.tied=panels.some(other=>other.id!==p.id&&other.value===p.value);
 }
 return{version:MULTIPLE_DATA_VERSION,plot,rankAt:input.rankAt,direction:input.direction,tiePolicy:'competition-rank; stable-id-order',missingPolicy:'unranked-last; no-carry-forward',panels};
}
