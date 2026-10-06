// Explicit annual growing cash flows; a sampled model, never a market forecast.
import {utcDay} from './plot-data.mjs';
export const VALUATION_DATA_VERSION=1;
const check=(ok,m)=>{if(!ok)throw Error(`valuation: ${m}`);};
const own=(o,keys,name)=>{check(o&&typeof o==='object'&&!Array.isArray(o),`${name} must be an object`);for(const k of Object.keys(o))check(keys.includes(k),`unknown ${name}.${k}`);};
const dense=a=>Array.isArray(a)&&Array.from({length:a.length},(_,i)=>Object.hasOwn(a,i)).every(Boolean);
const amount=v=>typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12;
export function valuationGrid(input){
 own(input,['title','source','asOf','unit','cashFlowNow','initialOutlay','timing','terminal','growthRates','discountRates','rateDecimals','selected','slice','scale'],'input');
 for(const k of ['title','source','unit'])check(typeof input[k]==='string'&&input[k].trim().length>0&&input[k].length<=160,`${k} required, at most 160 characters`);utcDay(input.asOf);
 check(amount(input.cashFlowNow)&&(input.cashFlowNow===0||Math.abs(input.cashFlowNow)>=1e-9),'cashFlowNow must be zero or magnitude 1e-9 through 1e12');check(amount(input.initialOutlay)&&input.initialOutlay>=0,'initialOutlay must be 0 through 1e12');check(input.timing==='annual-end','annual-end effective annual rates required');
 own(input.terminal,['kind','periods'],'terminal');check(['none','growing-perpetuity'].includes(input.terminal.kind),'terminal must be none or growing-perpetuity');
 if(input.terminal.kind==='none')check(Number.isInteger(input.terminal.periods)&&input.terminal.periods>=1&&input.terminal.periods<=120,'finite horizon requires 1–120 periods');else check(!Object.hasOwn(input.terminal,'periods'),'growing perpetuity has no finite horizon');
 check(Number.isInteger(input.rateDecimals)&&input.rateDecimals>=0&&input.rateDecimals<=6,'rateDecimals must be 0–6');
 for(const k of ['growthRates','discountRates']){const a=input[k];check(dense(a)&&a.length>=2&&a.length<=7,`${k} needs 2–7 explicit rates`);check(a.every((v,i)=>typeof v==='number'&&Number.isFinite(v)&&v>=-90&&v<=100&&(!i||v>a[i-1])&&Number(v.toFixed(input.rateDecimals))===v),`${k} must increase within [-90,100] percent and match rateDecimals`);}
 own(input.selected,['growth','discount'],'selected');check(input.growthRates.includes(input.selected.growth)&&input.discountRates.includes(input.selected.discount),'selected cell must be a supplied growth/discount pair');check(['growth','discount'].includes(input.slice),'slice must name the varying growth or discount dimension');
 own(input.scale,['min','max','ticks','decimals'],'scale');const {min,max,ticks,decimals}=input.scale;check(amount(min)&&amount(max)&&min<max,'finite increasing value scale bounded by 1e12 required');check(Number.isInteger(decimals)&&decimals>=0&&decimals<=4,'value decimals must be 0–4');check(dense(ticks)&&ticks.length>=2&&ticks.length<=6&&ticks[0]===min&&ticks.at(-1)===max&&ticks.every((v,i)=>amount(v)&&v>=min&&v<=max&&(!i||v>ticks[i-1])&&Number(v.toFixed(decimals))===v),'ticks must span the scale and match value precision');check(!(min<0&&max>0)||ticks.includes(0),'signed scale must label zero');
 const cells=[];
 for(const [row,growth]of input.growthRates.entries())for(const [column,discount]of input.discountRates.entries()){
  const g=growth/100,r=discount/100,invalid=input.terminal.kind==='growing-perpetuity'&&discount<=growth,terms=[];let pv=null,value=null;
  if(!invalid){
   if(input.terminal.kind==='growing-perpetuity')pv=input.cashFlowNow*(1+g)/((discount-growth)/100);
   else{let sum=0,correction=0;for(let year=1;year<=input.terminal.periods;year++){const cashFlow=input.cashFlowNow*(1+g)**year,presentValue=input.cashFlowNow*((1+g)/(1+r))**year;check(amount(cashFlow)&&amount(presentValue),'cash flow or discounted term exceeds supported amount range');terms.push({year,cashFlow,presentValue});const y=presentValue-correction,next=sum+y;correction=(next-sum)-y;sum=next;}pv=sum;}
   value=pv-input.initialOutlay;check(amount(pv)&&amount(value),'valuation exceeds supported amount range');check(value>=min&&value<=max,'value outside explicit scale; expand the scale, never clip or clamp');
  }
  cells.push({row,column,growth,discount,valid:!invalid,reason:invalid?'discount-not-above-growth':null,presentValue:pv,initialOutlay:input.initialOutlay,value,terms});
 }
 const selected=cells.find(c=>c.growth===input.selected.growth&&c.discount===input.selected.discount),slice=cells.filter(c=>input.slice==='discount'?c.growth===input.selected.growth:c.discount===input.selected.discount).map(c=>({...c,x:input.slice==='discount'?c.discount:c.growth}));
 return{version:VALUATION_DATA_VERSION,title:input.title,source:input.source,asOf:input.asOf,unit:input.unit,cashFlowNow:input.cashFlowNow,initialOutlay:input.initialOutlay,timing:input.timing,rateConvention:'effective annual percent',terminal:{...input.terminal},growthRates:[...input.growthRates],discountRates:[...input.discountRates],rateDecimals:input.rateDecimals,scale:{min,max,ticks:[...ticks],decimals},cells,selected,slice:{vary:input.slice,fixed:input.slice==='discount'?{growth:input.selected.growth}:{discount:input.selected.discount},points:slice},measurement:'present value of future end-year cash flows minus initial outlay at time zero',invalidPolicy:'growing-perpetuity requires discount strictly above growth; no numeric value in invalid cells'};
}
