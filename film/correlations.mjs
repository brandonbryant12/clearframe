// Editable native matrix and paired return charts; numeric data never becomes pixels.
import {correlationMatrix} from './correlation-data.mjs';
import {axisPosition,axisLabel} from './plot-data.mjs';
const check=(ok,m)=>{if(!ok)throw Error(`correlation scene: ${m}`);};
const show={at:0,enter:'none'},text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',...show,...extra});
const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:1,...show,...extra});
// One fixed signed color domain across all windows. Pale fills keep dark type legible.
export function correlationColor(value){
 if(value===null)return '#eeeeea';check(Number.isFinite(value)&&Math.abs(value)<=1,'coefficient outside [-1,1]');
 const base=[247,247,242],end=value<0?[231,170,119]:[135,176,213],t=Math.abs(value);
 return '#'+base.map((v,i)=>Math.round(v+(end[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
export const correlationLabel=c=>c.value===null?'—':`${c.value>0?'+':''}${c.value.toFixed(2).replace(/^-0\.00$/,'0.00')}`;
export function correlationScene(input,{width:w,height:h,id,selectedPair,view='matrix',reveal=false}){
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=640&&h>=640&&w<=4096&&h<=4096,'frame dimensions must be 640–4096');
 check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');check(['matrix','pair'].includes(view),'view must be matrix or pair');
 const model=correlationMatrix(input),p=model.plot,n=p.series.length,tall=h>w;
 check(Array.isArray(selectedPair)&&selectedPair.length===2&&selectedPair[0]!==selectedPair[1]&&selectedPair.every(s=>p.series.some(v=>v.id===s)),'select two distinct existing IDs');
 const cell=model.cells.find(c=>c.rowId===selectedPair[0]&&c.columnId===selectedPair[1]),elements=[],geometry={cells:[],points:[],segments:[]},margin=w*(tall?.105:.07),size=w*(tall?.035:.023),sourceId=id+'-source';
 const heading=view==='matrix'?p.title:`${p.series.find(s=>s.id===selectedPair[0]).label} + ${p.series.find(s=>s.id===selectedPair[1]).label}`;
 elements.push(text(id+'-title',heading,margin,h*(tall?.09:.115),w*(tall?.047:.034),{font:'display',width:w-2*margin,height:h*.08}),
 text(id+'-window',`${model.window.start} to ${model.window.end}`,margin,h*(tall?.155:.19),w*(tall?.032:.025),{font:'figures',fit:w-2*margin}),
 text(id+'-method',`Pearson r · monthly returns · minimum ${model.minObservations} pairs`,margin,h*(tall?.20:.255),w*(tall?.029:.021),{fit:w-2*margin}));
 if(view==='matrix'){
  const step=Math.min(w*(tall?.59:.48)/n,h*(tall?.36:.44)/n),stepX=tall?step:w*.48/n,left=tall?w*.305:(w-stepX*n)/2+w*.055,top=h*(tall?.315:.34),inset=4;
  for(const [i,s]of p.series.entries()){
   elements.push(text(`${id}-column-${s.id}`,s.label,left+(i+.5)*stepX,top-size*.65,size,{anchor:'middle',font:'semibold',fit:stepX*.94}),text(`${id}-row-${s.id}`,s.label,left-size*.4,top+(i+.5)*step+size*.35,size,{anchor:'end',font:'semibold',fit:left-margin-size*.6}));
  }
  for(const c of model.cells){const x=left+c.column*stepX,y=top+c.row*step,at=reveal?.4+(c.row+c.column)*.13:0,selected=(c.rowId===selectedPair[0]&&c.columnId===selectedPair[1])||(c.rowId===selectedPair[1]&&c.columnId===selectedPair[0]),label=correlationLabel(c),reason=c.reason==='insufficient-pairs'?`n=${c.n} · few`:c.reason==='zero-variance'?`n=${c.n} · flat`:`n = ${c.n}`;
   const box={id:`${id}-cell-${c.row}-${c.column}`,type:'rect',x:x+inset,y:y+inset,w:stepX-2*inset,h:step-2*inset,r:5,fill:correlationColor(c.value),stroke:selected?'ink':'line',width:selected?3:1,...show,at};
   elements.push(box,text(box.id+'-value',label,x+stepX/2,y+step*.48,step*(tall?.25:.30),{anchor:'middle',font:'figures',fit:stepX*.9,at}),text(box.id+'-count',reason,x+stepX/2,y+step*.76,step*(tall?.17:.21),{anchor:'middle',font:'figures',fit:stepX*.9,at}));
   geometry.cells.push({...c,box:[x+inset,y+inset,stepX-2*inset,step-2*inset],fill:box.fill,label,detail:reason,at,selected});
  }
  const legendY=top+n*step+size*1.2,legendWidth=stepX*n;
  for(const [i,r]of [-1,0,1].entries()){const x=left+i*legendWidth/3;elements.push({id:`${id}-legend-${i}`,type:'rect',x,y:legendY-size*.65,w:size*.7,h:size*.7,fill:correlationColor(r),...show},text(`${id}-legend-label-${i}`,r>0?'+1':String(r),x+size,size*.1+legendY,size,{font:'figures'}));}
  elements.push(text(id+'-limit','Pairwise complete · — undefined · no causality',margin,h*(tall?.80:.87),w*(tall?.03:.022),{fit:w-2*margin}));
 }else{
  const top=h*(tall?.30:.34),pw=tall?w-2*margin:(w-2*margin-w*.065)/2,ph=h*(tall?.205:.39),gap=tall?h*.08:w*.065,local={left:pw*.14,right:pw*.96,top:ph*.23,bottom:ph*.82},xAxis={...p.x,domain:[model.window.start,model.window.end],ticks:[model.window.start,model.window.end]};
  check(model.months.length>=2,'pair chart needs two distinct months');
  for(const [i,sid]of selectedPair.entries()){
   const s=p.series.find(s=>s.id===sid),x=margin+(tall?0:i*(pw+gap)),y=top+(tall?i*(ph+gap):0),color=i===0?'accent':'accent2',px=d=>local.left+axisPosition(d,xAxis)*(local.right-local.left),py=v=>local.bottom-axisPosition(v,p.y)*(local.bottom-local.top),children=[text(`${id}-${sid}-name`,s.label,0,size,size,{font:'semibold'})];
   for(const [j,v]of p.y.ticks.entries())children.push(line(`${id}-${sid}-grid-${j}`,local.left,py(v),local.right,py(v),{stroke:v===0?'muted':'line',width:v===0?2:1}),text(`${id}-${sid}-y-${j}`,axisLabel(v,p.y),local.left-size*.3,py(v)+size*.3,size*.85,{anchor:'end',font:'figures',fit:local.left-size*.4}));
   for(const [j,d]of xAxis.ticks.entries())children.push(text(`${id}-${sid}-x-${j}`,axisLabel(d,{...xAxis,dateFormat:'month'}),px(d),local.bottom+size*1.2,size*.85,{anchor:j?'end':'start',font:'figures'}));
   const markers=[];let prev=null;
   for(const [j,d]of model.months.entries()){
    const value=s.values.find(v=>v.x===d).y,at=reveal?.6+3.4*axisPosition(d,xAxis):0,paired=cell.dates.includes(d);
    if(value===null){prev=null;geometry.points.push({seriesId:sid,index:j,date:d,value,paired,point:null});continue;}
    if(prev){const segment=line(`${id}-${sid}-segment-${j}`,px(prev.date),py(prev.value),px(d),py(value),{stroke:color,width:w*.0025,...(reveal?{at:prev.at,enter:'draw',dur:at-prev.at,drawEase:'linear'}:{})});children.push(segment);geometry.segments.push({seriesId:sid,from:prev.date,to:d,p1:[x+px(prev.date),y+py(prev.value)],p2:[x+px(d),y+py(value)],at:prev.at,end:at});}
    markers.push({id:`${id}-${sid}-point-${j}`,type:'circle',cx:px(d),cy:py(value),r:w*.006,fill:paired?color:'bg',stroke:color,width:2,...show,at});
    geometry.points.push({seriesId:sid,index:j,date:d,value,paired,point:[x+px(d),y+py(value)],at});prev={date:d,value,at};
   }
   // Draw every marker after both adjacent segments. A hollow observation must
   // mask the later segment as well as the earlier one throughout the reveal.
   children.push(...markers);
   elements.push({id:`${id}-${sid}-panel`,type:'group',x,y,children,...show});
  }
  const reason=cell.reason==='insufficient-pairs'?'too few pairs':cell.reason==='zero-variance'?'constant series':'descriptive only';
  elements.push(text(id+'-coefficient',`r = ${correlationLabel(cell)} · n = ${cell.n} · ${reason}`,margin,h*(tall?.84:.81),w*(tall?.032:.027),{font:'figures',fit:w-2*margin}),text(id+'-limit','Hollow = unpaired observation · correlation is not causation',margin,h*(tall?.875:.87),w*(tall?.026:.021),{fit:w-2*margin}));
 }
 elements.push(text(sourceId,`${p.source} ${p.asOf}.`,margin,h*(tall?.91:.94),w*(tall?.028:.023),{width:w-2*margin,height:h*.055}));
 return{model,selectedCell:cell,geometry,props:{view:[0,0,w,h],sourceElement:sourceId,elements}};
}
