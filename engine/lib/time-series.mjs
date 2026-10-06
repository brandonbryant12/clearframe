// Period-aware transformations for observed series; no interpolation or forecasts.
import {utcDay} from '../../film/plot-data.mjs';
export const TIME_SERIES_VERSION=1;
const check=(ok,m)=>{if(!ok)throw Error(`time series: ${m}`);};
const own=(v,keys,name)=>{check(v&&typeof v==='object'&&!Array.isArray(v),`${name} must be an object`);for(const k of Object.keys(v))check(keys.includes(k),`unknown ${name}.${k}`);};
const num=(v,name)=>{check(typeof v==='number'&&Number.isFinite(v)&&Math.abs(v)<=1e12,`${name} must be finite within ±10^12`);return v;};
const nullable=(v,name)=>v===null?null:num(v,name);
const integer=(v,lo,hi,name)=>{check(Number.isInteger(v)&&v>=lo&&v<=hi,`${name} must be an integer in ${lo}–${hi}`);return v;};
const MONTHS={monthly:1,quarterly:3,annual:12};
const monthEnd=(y,m)=>[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][m];
function records(input,fields){
 check(Array.isArray(input)&&input.length>=2&&input.length<=1200,'observations needs 2–1200 records');let last=-Infinity;
 return input.map((p,i)=>{own(p,['date',...fields],`observations[${i}]`);const day=utcDay(p.date);check(day>last,'dates must strictly increase');last=day;return{date:p.date,...Object.fromEntries(fields.map(k=>[k,nullable(p[k],`observations[${i}].${k}`)]))};});
}
function cadence(observations,frequency){
 check(Object.hasOwn(MONTHS,frequency),'frequency must be monthly, quarterly or annual');
 const [y,m,d]=observations[0].date.split('-').map(Number),anchor=m-1,ends=d===monthEnd(y,anchor);
 observations.forEach((p,i)=>{const ordinal=y*12+anchor+i*MONTHS[frequency],year=Math.floor(ordinal/12),month=ordinal%12;
  const day=ends?monthEnd(year,month):Math.min(d,monthEnd(year,month));
  const expected=`${String(year).padStart(4,'0')}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
  check(p.date===expected,`missing or irregular ${frequency} observation at ${p.date}; use an explicit null at ${expected}`);
 });
 return 12/MONTHS[frequency];
}
function basis(frequency){return{modelVersion:TIME_SERIES_VERSION,frequency,interpolation:'none'};}

/** A supplied same-date price index deflates nominal values into base-date units. */
export function deflateSeries(input){
 own(input,['observations','baseDate'],'deflation');const observations=records(input.observations,['nominal','priceIndex']);utcDay(input.baseDate);
 for(const p of observations)check(p.priceIndex===null||p.priceIndex>0,'observed price indexes must be positive');
 const base=observations.find(p=>p.date===input.baseDate);check(base&&base.priceIndex!==null,'baseDate needs an observed positive price index');
 return{modelVersion:TIME_SERIES_VERSION,method:'matched-date-price-ratio',baseDate:input.baseDate,basePriceIndex:base.priceIndex,
  observations:observations.map(p=>{const ratio=p.priceIndex===null?null:num(p.priceIndex/base.priceIndex,'price ratio');if(ratio!==null)check(ratio>0,'price ratio underflow');
   const real=p.nominal===null||ratio===null?null:num(p.nominal/ratio,'real value');if(real!==null&&p.nominal!==0)check(real!==0,'real value underflow');return{...p,priceRatio:ratio,real,gap:real===null?null:num(p.nominal-real,'nominal minus real'),missing:p.nominal===null?'nominal':ratio===null?'price-index':null};})};
}

/** Relative endpoint change across lag periods; change-in-growth uses consecutive results.
 * Annualization compounds the observed lag ratio. It is not a forecast.
 */
export function growthSeries(input){
 own(input,['observations','frequency','lag','annualize'],'growth');const observations=records(input.observations,['value']),periodsPerYear=cadence(observations,input.frequency);
 const lag=integer(input.lag,1,1199,'lag');check(typeof input.annualize==='boolean','annualize must be explicit');
 const out=observations.map((p,i)=>{const previous=i>=lag?observations[i-lag]:null;let missing=previous===null?'warmup':p.value===null||previous.value===null?'missing-endpoint':previous.value<=0?'nonpositive-base':p.value<0?'negative-ending-level':null;
  let change=null,annualized=null;if(!missing){const ratio=num(p.value/previous.value,'level ratio');check(p.value===0||ratio>0,'positive level ratio underflow');change=num(ratio-1,'relative change');if(input.annualize)annualized=num(Math.expm1(Math.log(ratio)*periodsPerYear/lag),'annualized change');}
  return{...p,baseDate:previous?.date??null,change,annualized,missing};});
 for(let i=0;i<out.length;i++){const now=input.annualize?out[i].annualized:out[i].change,previous=i?input.annualize?out[i-1].annualized:out[i-1].change:null;
  out[i].changeInGrowth=now===null||previous===null?null:num(now-previous,'change in growth');}
 return{...basis(input.frequency),method:'lagged-relative-endpoints',lag,annualize:input.annualize,periodsPerYear,changeInGrowthUnit:'fraction points between consecutive observations',observations:out};
}

/** Complete-window mean and sample SD. Nulls never shrink the denominator. */
export function rollingStatistics(input){
 own(input,['observations','frequency','window'],'rolling');const observations=records(input.observations,['value']);cadence(observations,input.frequency);
 const window=integer(input.window,2,1200,'window');
 return{...basis(input.frequency),method:'complete-window-sample-statistics',window,ddof:1,annualized:false,
  observations:observations.map((p,i)=>{const rows=observations.slice(Math.max(0,i-window+1),i+1),count=rows.filter(p=>p.value!==null).length,complete=rows.length===window&&count===window;
   let mean=null,standardDeviation=null;if(complete){let m=0,m2=0,n=0;for(const row of rows){const delta=row.value-m;m+=delta/++n;m2+=delta*(row.value-m);}mean=num(m,'rolling mean');standardDeviation=num(Math.sqrt(Math.max(0,m2/(window-1))),'sample standard deviation');}
   return{date:p.date,value:p.value,windowStart:rows[0].date,count,complete,missing:rows.length<window?'warmup':count<window?'missing-window-value':null,mean,standardDeviation};})};
}

/** Drawdown and recovery use observed nonnegative levels, not unseen intra-period peaks. */
export function drawdownSeries(input){
 own(input,['observations','frequency'],'drawdown');const observations=records(input.observations,['value']);cadence(observations,input.frequency);
 for(const p of observations)check(p.value===null||p.value>=0,'drawdown needs nonnegative levels');
 check(observations.some(p=>p.value>0),'drawdown needs an observed positive level');
 let peak=null,peakDate=null,episode=null,maxDrawdown=0;const episodes=[];
 const out=observations.map(p=>{
  if(p.value===null)return{...p,observedPeak:peak,peakDate,drawdown:null,missing:'missing-level'};
  if(peak===null){if(p.value===0)return{...p,observedPeak:null,peakDate:null,drawdown:null,missing:'no-positive-peak'};peak=p.value;peakDate=p.date;}
  if(p.value>=peak){
   if(episode){episodes.push({...episode,recoveryDate:p.date,recovered:true,calendarDays:utcDay(p.date)-utcDay(episode.peakDate)});episode=null;}
   peak=p.value;peakDate=p.date;
  }
  const drawdown=num(p.value/peak-1,'drawdown');maxDrawdown=Math.min(maxDrawdown,drawdown);
  if(drawdown<0){if(!episode)episode={peakDate,peakValue:peak,troughDate:p.date,troughValue:p.value,drawdown};else if(drawdown<episode.drawdown)Object.assign(episode,{troughDate:p.date,troughValue:p.value,drawdown});}
  return{...p,observedPeak:peak,peakDate,drawdown,missing:null};
 });
 if(episode)episodes.push({...episode,recoveryDate:null,recovered:false,calendarDays:utcDay(observations.at(-1).date)-utcDay(episode.peakDate)});
 return{...basis(input.frequency),method:'observed-running-peak',equalPeakRule:'most-recent-observation',missingPolicy:'preserve-known-observed-peak; unseen peaks remain unknown',
  missingDates:observations.filter(p=>p.value===null).map(p=>p.date),maxDrawdown,currentDrawdown:out.at(-1).drawdown,episodes,observations:out};
}
