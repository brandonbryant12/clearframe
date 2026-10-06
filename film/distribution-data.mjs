// Explicit finite samples and bins. No fitted curve or inferred tail probability.
import {utcDay} from './plot-data.mjs';
export const DISTRIBUTION_DATA_VERSION=1;
const check=(ok,m)=>{if(!ok)throw Error(`distribution: ${m}`);};
const own=(o,keys,name)=>{check(o&&typeof o==='object'&&!Array.isArray(o),`${name} must be an object`);for(const k of Object.keys(o))check(keys.includes(k),`unknown ${name}.${k}`);};
const finite=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e9;
export function distribution(input){
 own(input,['title','source','asOf','unit','observations','edges','mode','threshold','y'],'input');
 for(const k of ['title','source','unit'])check(typeof input[k]==='string'&&input[k].trim().length>0&&input[k].length<=160,`${k} required, at most 160 characters`);
 utcDay(input.asOf);check(['count','density'].includes(input.mode),'mode must be count or density');
 check(Array.isArray(input.observations)&&input.observations.length>=1&&input.observations.length<=240,'1–240 explicit observations required');
 for(let i=0;i<input.observations.length;i++)check(Object.hasOwn(input.observations,i),'retain missing observations as explicit null, not sparse slots');
 check(Array.isArray(input.edges)&&input.edges.length>=3&&input.edges.length<=13,'2–12 explicit bins required');
 const edges=[...input.edges];check(edges.every(finite)&&edges.every((v,i)=>!i||v>edges[i-1]),'edges must be finite, strictly increasing, and bounded by 1e9');
 const widths=edges.slice(1).map((v,i)=>v-edges[i]);check(widths.every(v=>v>=1e-9),'bin widths must be at least 1e-9');
 if(input.mode==='count')check(widths.every(v=>Math.abs(v-widths[0])<=widths[0]*1e-12),'count mode requires equal-width bins; use density for unequal widths');
 own(input.threshold,['value','relation'],'threshold');const {value,relation}=input.threshold;check(finite(value)&&value>=edges[0]&&value<=edges.at(-1),'threshold must lie inside supplied bin range');check(['gte','gt','lte','lt'].includes(relation),'threshold relation must be gte, gt, lte or lt');
 const qualifies=v=>relation==='gte'?v>=value:relation==='gt'?v>value:relation==='lte'?v<=value:v<value;
 const observations=input.observations.map((v,index)=>{check(v===null||finite(v),'observations must be finite numbers or null');check(v===null||(v>=edges[0]&&v<=edges.at(-1)),'observation outside bins; no silent exclusion');const bin=v===null?null:v===edges.at(-1)?edges.length-2:edges.findIndex((e,i)=>i<edges.length-1&&v>=e&&v<edges[i+1]);return{index,value:v,bin,qualifies:v===null?null:qualifies(v)};});
 const n=observations.filter(v=>v.value!==null).length;check(n>0,'at least one observed value required');
 const bins=widths.map((width,index)=>{const members=observations.filter(v=>v.bin===index).map(v=>v.index),count=members.length,height=input.mode==='count'?count:count/n/width;return{index,low:edges[index],high:edges[index+1],width,rightClosed:index===widths.length-1,members,count,height};});
 own(input.y,['max','ticks','decimals'],'y');const {max,ticks,decimals=0}=input.y;check(Number.isFinite(max)&&max>0&&bins.every(b=>b.height<=max),'explicit y maximum must contain every bar');check(Number.isInteger(decimals)&&decimals>=0&&decimals<=9,'y decimals must be 0–9');check(Array.isArray(ticks)&&ticks.length>=2&&ticks.length<=6&&ticks[0]===0&&ticks.at(-1)===max&&ticks.every((v,i)=>Number.isFinite(v)&&v>=0&&v<=max&&(!i||v>ticks[i-1])),'y ticks must increase from zero through maximum');check(ticks.every(v=>Number(v.toFixed(decimals))===v),'y ticks must be exactly representable at declared precision');
 const tail=observations.filter(v=>v.qualifies===true).map(v=>v.index);
 return{version:DISTRIBUTION_DATA_VERSION,title:input.title,source:input.source,asOf:input.asOf,unit:input.unit,mode:input.mode,edges,bins,observations,n,missing:observations.length-n,threshold:{value,relation,count:tail.length,denominator:n,fraction:tail.length/n,members:tail},y:{max,ticks:[...ticks],decimals},edgePolicy:'left-closed right-open; final bin right-closed',missingPolicy:'null excluded from observed denominator; counted explicitly'};
}
