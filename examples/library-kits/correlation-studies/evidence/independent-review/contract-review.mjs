// Independent exact-dyadic covariance reference; no renderer or browser.
import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {correlationMatrix} from '../../../../../fframes/correlation-data.mjs';
import {correlationScene,correlationColor,correlationLabel} from '../../../../../fframes/correlations.mjs';
let assertions=0,matrixCases=0,cellChecks=0;const eq=(a,b)=>{assert.deepEqual(a,b);assertions++;},ok=v=>{assert(v);assertions++;},near=(a,b,tol=3e-14)=>{assert(Math.abs(a-b)<=tol,`${a} != ${b}`);assertions++;},reject=f=>{assert.throws(f);assertions++;};
const dates=['2024-01-31','2024-02-29','2024-03-31','2024-04-30','2024-05-31','2024-06-30'],ids=['delta','alpha','gamma','beta'];
const input=values=>({plot:{title:'Independent correlation fixture',source:'Original fictional monthly simple returns.',asOf:dates.at(-1),x:{type:'date',label:'Month end',domain:[dates[0],dates.at(-1)],ticks:[dates[0],dates.at(-1)],dateFormat:'month'},y:{type:'linear',label:'Monthly simple return',domain:[-100,1e12],ticks:[-100,0,1e12],suffix:'%'},series:values.map((row,i)=>({id:ids[i],label:ids[i].toUpperCase(),values:row.map((y,j)=>({x:dates[j],y}))})),motion:'none'},method:'pearson',frequency:'monthly',returnType:'simple-percent',window:{start:dates[0],end:dates.at(-1)},minObservations:3});
// Convert every finite IEEE-754 double to an exact signed integer in units of
// 2^-1074. Covariance sums use BigInt, avoiding floating centering/normalization.
const data=new DataView(new ArrayBuffer(8));
function integer(v){data.setFloat64(0,v);const bits=data.getBigUint64(0),exp=Number((bits>>52n)&2047n),frac=bits&((1n<<52n)-1n);const magnitude=exp===0?frac:((1n<<52n)|frac)<<BigInt(exp-1);return bits>>63n?-magnitude:magnitude;}
function floating(v){const a=v<0n?-v:v,e=Math.max(0,a.toString(2).length-53);return{m:Number(a>>BigInt(e)),e};}
function reference(x,y){const a=x.map(integer),b=y.map(integer),n=BigInt(a.length),total=v=>v.reduce((s,v)=>s+v,0n),sx=total(a),sy=total(b),xx=n*total(a.map(v=>v*v))-sx*sx,yy=n*total(b.map(v=>v*v))-sy*sy,xy=n*total(a.map((v,i)=>v*b[i]))-sx*sy;if(xx===0n||yy===0n)return null;if(xy===0n)return 0;const c=floating(xy),u=floating(xx),v=floating(yy);return(xy<0n?-1:1)*c.m/Math.sqrt(u.m)/Math.sqrt(v.m)*2**(c.e-(u.e+v.e)/2);}
function review(f){const before=structuredClone(f),m=correlationMatrix(f);matrixCases++;eq(f,before);eq(m.months,dates.slice(dates.indexOf(f.window.start),dates.indexOf(f.window.end)+1));eq(m.cells.length,f.plot.series.length**2);eq(m.plot.series,f.plot.series);eq(m.window,f.window);eq(m.minObservations,f.minObservations);eq(m.missingPolicy,'pairwise-complete; no-fill; no-carry');
 for(const c of m.cells){cellChecks++;eq(c.rowId,f.plot.series[c.row].id);eq(c.columnId,f.plot.series[c.column].id);const a=f.plot.series[c.row].values,b=f.plot.series[c.column].values,pairs=m.months.map(d=>[a.find(p=>p.x===d),b.find(p=>p.x===d)]),used=pairs.filter(([a,b])=>a.y!==null&&b.y!==null);eq(c.n,used.length);eq(c.dates,used.map(([a])=>a.x));eq(c.missingDates,pairs.filter(([a,b])=>a.y===null||b.y===null).map(([a])=>a.x));const ref=used.length<f.minObservations?null:reference(used.map(([a])=>a.y),used.map(([,b])=>b.y));eq(c.reason,used.length<f.minObservations?'insufficient-pairs':ref===null?'zero-variance':null);if(ref===null)eq(c.value,null);else{near(c.value,ref);ok(c.value>=-1&&c.value<=1);}
 const mirrored=m.cells.find(v=>v.row===c.column&&v.column===c.row);eq(c.reason,mirrored.reason);eq(c.dates,mirrored.dates);if(c.value===null)eq(mirrored.value,null);else near(c.value,mirrored.value);
 }
 return m;
}
const fixtures=[
 [[-2,-1,0,0,1,2],[1,-2,0,0,-2,1]],
 [[1,2,3,4,5,6],[6,5,4,3,2,1],[3,3,3,3,3,3]],
 [[1,null,3,4,null,6],[null,2,3,null,5,6],[1,2,null,4,5,null],[0,0,0,0,0,0]],
 [[0,1,2,3,4,5].map(v=>v*Number.MIN_VALUE),[5,3,4,1,2,0].map(v=>v*Number.MIN_VALUE)],
 [[0,1,2,3,4,5].map(v=>1e12-1+v*2**-13),[5,3,4,1,2,0].map(v=>1e12-2+v*2**-13)],
 [[-100,-100+2**-46,-100+2**-45,-100+3*2**-46,-100+2**-44,-100+5*2**-46],[0,2,1,5,3,4]],
 [[0,Number.MIN_VALUE,1e-200,1e-100,1,1e12],[1e12,0,1,1e-200,Number.MIN_VALUE,1e-100]],
];
for(const rows of fixtures)for(const [start,end]of [[0,5],[1,4],[2,5],[1,2],[3,3]])for(const min of [3,4,6]){const f=input(rows);f.window={start:dates[start],end:dates[end]};f.minObservations=min;const m=review(f);const reversed=correlationMatrix({...f,plot:{...f.plot,series:[...f.plot.series].reverse()}});for(const c of m.cells){const other=reversed.cells.find(v=>v.rowId===c.rowId&&v.columnId===c.columnId);eq({...c,row:0,column:0},{...other,row:0,column:0});}}
let seed=0x173ac91;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed;};
const pool=[null,-100,-3,-1,0,Number.MIN_VALUE,2*Number.MIN_VALUE,1e-200,1,2,11,1e12-1,1e12];
for(let i=0;i<192;i++){const count=2+i%3,rows=Array.from({length:count},()=>Array.from({length:6},()=>pool[random()%pool.length]));for(const row of rows)if(row.every(v=>v===null))row[0]=0;const f=input(rows),start=i%4,end=start+random()%(6-start);f.window={start:dates[start],end:dates[end]};f.minObservations=3+i%4;review(f);}
// Maximum supplied length permitted by the shared 240-observation contract.
const max=input([[1,2,3,4,5,6],[6,5,4,3,2,1]]),longDates=Array.from({length:120},(_,i)=>new Date(Date.UTC(2014,1+i,0)).toISOString().slice(0,10));max.plot.asOf=longDates.at(-1);max.plot.x.domain=[longDates[0],longDates.at(-1)];max.plot.x.ticks=[...max.plot.x.domain];max.window={start:longDates[0],end:longDates.at(-1)};max.plot.series.forEach((s,j)=>s.values=longDates.map((x,i)=>({x,y:j?119-i:i})));const longest=correlationMatrix(max);near(longest.cells[1].value,-1);eq(longest.cells[1].n,120);
// Pairwise deletion can legitimately produce an indefinite matrix; never infer
// PSD or a portfolio covariance guarantee from individually valid coefficients.
const indefinite=input([[1,2,3,1,2,3],[1,2,3,null,null,null],[null,null,null,1,2,3]]),nine=Array.from({length:9},(_,i)=>new Date(Date.UTC(2024,i+1,0)).toISOString().slice(0,10)),indRows=[[1,2,3,1,2,3,null,null,null],[1,2,3,null,null,null,1,2,3],[null,null,null,1,2,3,3,2,1]];
indefinite.plot.asOf=nine.at(-1);indefinite.plot.x.domain=[nine[0],nine.at(-1)];indefinite.plot.x.ticks=[...indefinite.plot.x.domain];indefinite.window={start:nine[0],end:nine.at(-1)};indefinite.plot.series.forEach((s,i)=>s.values=nine.map((x,j)=>({x,y:indRows[i][j]})));
const ind=correlationMatrix(indefinite),ab=ind.cells[1].value,ac=ind.cells[2].value,bc=ind.cells[5].value;near(ab,1);near(ac,1);near(bc,-1);near(1+2*ab*ac*bc-ab*ab-ac*ac-bc*bc,-4);eq(ind.cells.map(c=>c.n),[6,3,3,3,6,3,3,3,6]);
const mathAssertions=assertions;
for(const mutate of [f=>f.method='spearman',f=>f.frequency='daily',f=>f.returnType='price',f=>f.window.start='2024-01-01',f=>f.window.end=dates[0],f=>f.window.extra=1,f=>f.minObservations=2,f=>f.minObservations=7,f=>f.minObservations=3.2,f=>f.plot.series[0].values[2].x='2024-03-30',f=>{for(const s of f.plot.series)s.values.splice(2,1)},f=>f.plot.series[1].values.pop(),f=>f.plot.asOf='2024-05-31',f=>f.plot.y.suffix='',f=>f.plot.y.type='log',f=>f.plot.series.splice(1),f=>f.plot.series.push(...[2,3,4].map(i=>({...structuredClone(f.plot.series[0]),id:`extra-${i}`,label:`Extra ${i}`}))),f=>f.plot.series[1].id=f.plot.series[0].id,f=>f.plot.series[0].values[0].y=NaN,f=>f.plot.series[0].values[0].y=Infinity,f=>{f.plot.y.domain[0]=-101;f.plot.y.ticks[0]=-101;f.plot.series[0].values[0].y=-101},f=>f.extra=true]){const f=input(fixtures[0]);f.window.start=dates[1];mutate(f);reject(()=>correlationMatrix(f));}
const guardAssertions=assertions-mathAssertions;
for(const [width,height]of [[1920,1080],[1080,1920],[640,640],[4096,2160]])for(const count of [2,3,4]){
 const f=input(fixtures[2].slice(0,count));f.window={start:dates[1],end:dates[4]};
 for(const selectedPair of [[ids[0],ids[1]],[ids[count-1],ids[0]]]){
 const matrix=correlationScene(f,{width,height,id:'matrix',selectedPair,reveal:true});eq(matrix.geometry.cells.length,count**2);eq(matrix.geometry.cells.filter(c=>c.selected).length,2);
 for(const c of matrix.geometry.cells){const native=matrix.props.elements.find(e=>e.id===`matrix-cell-${c.row}-${c.column}`);eq([native.x,native.y,native.w,native.h],c.box);eq(native.fill,correlationColor(c.value));eq(native.at,.4+(c.row+c.column)*.13);ok(c.box[0]>=0&&c.box[1]>=0&&c.box[0]+c.box[2]<=width&&c.box[1]+c.box[3]<=height);eq(matrix.props.elements.find(e=>e.id===native.id+'-value').text,correlationLabel(c));}
 const pair=correlationScene(f,{width,height,id:'paired',selectedPair,view:'pair',reveal:true});eq(pair.geometry.points.length,8);const groups=pair.props.elements.filter(e=>e.type==='group');let extent;
 for(const g of groups){const sid=selectedPair[groups.indexOf(g)],points=pair.geometry.points.filter(p=>p.seriesId===sid),grid=g.children.filter(e=>e.id.includes('-grid-')),left=grid[0].x1,right=grid[0].x2,top=grid.at(-1).y1,bottom=grid[0].y1;const now=[left,right,top,bottom];if(extent)eq(now,extent);else extent=now;
  for(const p of points){const actual=f.plot.series.find(s=>s.id===sid).values.find(v=>v.x===p.date);eq(p.value,actual.y);eq(p.paired,pair.selectedCell.dates.includes(p.date));if(p.value===null){eq(p.point,null);continue;}const u=(Date.parse(p.date)-Date.parse(dates[1]))/(Date.parse(dates[4])-Date.parse(dates[1]));near(p.point[0],g.x+left+u*(right-left),1e-8);near(p.point[1],g.y+bottom-(p.value+100)/(1e12+100)*(bottom-top),1e-8);near(p.at,.6+3.4*u);const dot=g.children.find(e=>e.id===`paired-${sid}-point-${p.index}`);eq(dot.fill,p.paired?(sid===selectedPair[0]?'accent':'accent2'):'bg');if(!p.paired){const dotIndex=g.children.indexOf(dot);for(const [lineIndex,line]of g.children.entries())if(line.id.includes('-segment-')&&((line.x1===dot.cx&&line.y1===dot.cy)||(line.x2===dot.cx&&line.y2===dot.cy)))ok(lineIndex<dotIndex);}}
  for(let j=1;j<points.length;j++)eq(pair.geometry.segments.some(s=>s.seriesId===sid&&s.from===points[j-1].date&&s.to===points[j].date),points[j-1].value!==null&&points[j].value!==null);
 }
 }
}
eq(correlationColor(-1),'#e7aa77');eq(correlationColor(0),'#f7f7f2');eq(correlationColor(1),'#87b0d5');eq(correlationColor(null),'#eeeeea');
for(let i=-100;i<=100;i++){const v=i/100,rgb=correlationColor(v);ok(/^#[a-f0-9]{6}$/.test(rgb));const channels=rgb.slice(1).match(/../g).map(h=>parseInt(h,16));eq(channels,[247,247,242].map((b,j)=>Math.round(b+((v<0?[231,170,119]:[135,176,213])[j]-b)*Math.abs(v))));}
for(const v of [-1.01,1.01,NaN,Infinity,undefined])reject(()=>correlationColor(v));
for(const options of [{selectedPair:['delta','delta']},{selectedPair:['delta','missing']},{width:639},{height:4097},{view:'scatter'},{id:'Bad id'}])reject(()=>correlationScene(input(fixtures[0]),{width:1920,height:1080,id:'valid',selectedPair:['delta','alpha'],...options}));
const priorAssertions=assertions;
const kitInput=JSON.parse(fs.readFileSync(new URL('../../inputs.json',import.meta.url))),audit=JSON.parse(fs.readFileSync(new URL('../../audit.json',import.meta.url)));
for(const r of audit.results){const source=kitInput.cases.find(c=>c.id===r.caseId);eq(r.recipe,'C07');eq(r.stages.length,3);
 for(const [stageIndex,stage]of r.stages.entries()){const window=kitInput.windows[stageIndex===0?0:1],included=kitInput.dates.filter(d=>d>=window.start&&d<=window.end);eq(stage.model.window,window);eq(stage.model.months,included);eq(stage.model.plot.y.domain,source.domain);eq(stage.model.plot.y.ticks,source.ticks);eq(stage.model.plot.asOf,kitInput.asOf);eq(stage.model.minObservations,source.minObservations);
  for(const [i,s]of source.series.entries())eq(stage.model.plot.series[i],{id:s.id,label:s.label,values:s.values.map((y,j)=>({x:kitInput.dates[j],y}))});
  for(const c of stage.model.cells){const a=source.series[c.row],b=source.series[c.column],used=included.filter(d=>a.values[kitInput.dates.indexOf(d)]!==null&&b.values[kitInput.dates.indexOf(d)]!==null);eq(c.rowId,a.id);eq(c.columnId,b.id);eq(c.dates,used);eq(c.missingDates,included.filter(d=>!used.includes(d)));eq(c.n,used.length);const expected=used.length<source.minObservations?null:reference(used.map(d=>a.values[kitInput.dates.indexOf(d)]),used.map(d=>b.values[kitInput.dates.indexOf(d)]));eq(c.reason,used.length<source.minObservations?'insufficient-pairs':expected===null?'zero-variance':null);if(expected===null)eq(c.value,null);else near(c.value,expected);
  }
  eq([stage.selectedCell.rowId,stage.selectedCell.columnId],source.selectedPair);
 }
}
const report={status:'pass',assertions,matrixCases,cellChecks,mathAssertions,guardAssertions,sceneAndColorAssertions:priorAssertions-mathAssertions-guardAssertions,kitAuditAssertions:assertions-priorAssertions,reference:'Exact IEEE-754 dyadic integers and BigInt covariance sums n*sum(xy)-sum(x)*sum(y), converted only for the final normalized coefficient; no implementation centering or min/range normalization.',formulaSource:'https://www.itl.nist.gov/div898/software/dataplot/refman2/auxillar/correlat.htm',inputSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../../inputs.json',import.meta.url))).digest('hex'),auditSha256:crypto.createHash('sha256').update(fs.readFileSync(new URL('../../audit.json',import.meta.url))).digest('hex'),scope:'Bounded source/math/scene and current fictional kit-audit checks only; no rendering, browser, continuous playback or full-repository suite.',sourceHashes:Object.fromEntries(['correlation-data.mjs','correlations.mjs','plot-data.mjs'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(new URL('../../../../../fframes/'+n,import.meta.url))).digest('hex')]))};fs.writeFileSync(new URL('contract-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
