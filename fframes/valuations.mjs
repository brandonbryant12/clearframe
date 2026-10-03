import {valuationGrid} from './valuation-data.mjs';
const check=(ok,m)=>{if(!ok)throw Error(`valuation scene: ${m}`);};
const show={at:0,enter:'none'},text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',...show,...extra}),line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:1,...show,...extra});
export const valuationLabel=(value,decimals)=>value===null?'—':value.toFixed(decimals).replace(/^-0(\.0+)?$/,'0'+(decimals?'.'+'0'.repeat(decimals):''));
export function valuationColor(value,scale){
 if(value===null)return '#e7e7e2';check(Number.isFinite(value)&&value>=scale.min&&value<=scale.max,'color value outside scale');
 const base=[247,247,242],target=value<0?[231,170,119]:[135,176,213],t=value===0?0:value<0?value/Math.min(0,scale.min):value/Math.max(0,scale.max);
 return '#'+base.map((v,i)=>Math.round(v+(target[i]-v)*t).toString(16).padStart(2,'0')).join('');
}
// Boundaries halfway between declared numeric grid coordinates. Fill is a
// sampled cell, not an interpolated valuation surface or probability area.
export function gridEdges(values){check(Array.isArray(values)&&values.length>=2&&values.length<=7&&Array.from(values).every((v,i)=>Number.isFinite(v)&&v>=-90&&v<=100&&(!i||v>values[i-1])),'grid coordinates must be 2–7 increasing rates within [-90,100]');return[values[0]-(values[1]-values[0])/2,...values.slice(1).map((v,i)=>(v+values[i])/2),values.at(-1)+(values.at(-1)-values.at(-2))/2];}
export function valuationScene(input,{width:w,height:h,id,view='grid',reveal=false}){
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=640&&h>=640&&w<=4096&&h<=4096,'frame dimensions must be 640–4096');check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');check(['grid','slice'].includes(view),'view must be grid or slice');check(typeof reveal==='boolean','reveal must be boolean');
 const model=valuationGrid(input),m=model,tall=h>w,margin=w*(tall?.105:.07),size=w*(tall?.03:.023),elements=[],geometry={cells:[],points:[],segments:[]},sourceId=id+'-source',rate=v=>v.toFixed(m.rateDecimals)+'%',fixed=m.slice.vary==='discount'?`Growth fixed at ${rate(m.selected.growth)}`:`Discount fixed at ${rate(m.selected.discount)}`,value=v=>valuationLabel(v,m.scale.decimals);
 const terminal=m.terminal.kind==='none'?`${m.terminal.periods} year-end payments · no terminal value`:'Year-end payments · perpetual growth';
 elements.push(text(id+'-title',m.title,margin,h*(tall?.09:.115),w*(tall?.047:.034),{font:'display',width:w-2*margin,height:h*.08}),text(id+'-basis',`Base annual flow ${m.cashFlowNow} · outlay ${m.initialOutlay} ${m.unit}`,margin,h*(tall?.16:.205),w*(tall?.03:.024),{font:'figures',fit:w-2*margin}),text(id+'-terminal',terminal,margin,h*(tall?.21:.27),w*(tall?.028:.021),{fit:w-2*margin}),text(id+'-fixed',`${fixed} · selected ${value(m.selected.value)} ${m.unit}`,margin,h*(tall?.265:.33),w*(tall?.031:.024),{font:'figures',fit:w-2*margin}));
 if(view==='grid'){
  const xEdges=gridEdges(m.discountRates),yEdges=gridEdges(m.growthRates),left=w*(tall?.25:.26),right=w*(tall?.89:.84),top=h*(tall?.375:.44),bottom=h*(tall?.66:.72),px=v=>left+(v-xEdges[0])/(xEdges.at(-1)-xEdges[0])*(right-left),py=v=>top+(v-yEdges[0])/(yEdges.at(-1)-yEdges[0])*(bottom-top);
  elements.push(text(id+'-x-name','Discount rate',right,h*(tall?.31:.37),size,{anchor:'end'}),text(id+'-y-name','Growth',margin,top-size*.8,size,{fit:left-margin-size*.6}));
  for(const [i,v]of m.discountRates.entries()){const fit=2*Math.min(px(v)-px(xEdges[i]),px(xEdges[i+1])-px(v))*.9;check(fit>=rate(v).length*28*.65,'discount labels too close at this frame size');elements.push(text(`${id}-x-${i}`,rate(v),px(v),top-size*.8,size,{anchor:'middle',font:'figures',fit}));}
  check(m.growthRates.every((v,i)=>!i||py(v)-py(m.growthRates[i-1])>=size*1.4),'growth labels too close at this frame size');
  for(const [i,v]of m.growthRates.entries())elements.push(text(`${id}-y-${i}`,rate(v),left-size*.4,py(v)+size*.3,size,{anchor:'end',font:'figures',fit:left-margin-size*.6}));
  for(const c of m.cells){const x=px(xEdges[c.column])+3,y=py(yEdges[c.row])+3,cw=px(xEdges[c.column+1])-x-3,ch=py(yEdges[c.row+1])-y-3,at=reveal?.4+(c.row+c.column)*.13:0,selected=c.growth===m.selected.growth&&c.discount===m.selected.discount,onSlice=m.slice.vary==='discount'?c.growth===m.selected.growth:c.discount===m.selected.discount,fill=valuationColor(c.value,m.scale),font=Math.min(cw*.245,ch*.30);
   check(font>=28&&cw>0&&ch>0,'grid too dense; reduce rates or enlarge the frame');
   elements.push({id:`${id}-cell-${c.row}-${c.column}`,type:'rect',x,y,w:cw,h:ch,r:3,fill,stroke:onSlice?'ink':'line',width:selected?4:onSlice?2:1,...show,at},text(`${id}-value-${c.row}-${c.column}`,value(c.value),x+cw/2,y+ch*.57,font,{anchor:'middle',font:'figures',fit:cw*.91,at}));
   geometry.cells.push({...c,box:[x,y,cw,ch],center:[px(c.discount),py(c.growth)],fill,label:value(c.value),at,selected,onSlice});
  }
  const legend=m.scale.min<0&&m.scale.max>0?[m.scale.min,0,m.scale.max]:[m.scale.min,(m.scale.min+m.scale.max)/2,m.scale.max],ly=h*(tall?.72:.80),lx=margin,step=(w-2*margin)/3;
  for(const [i,v]of legend.entries()){const x=lx+i*step;elements.push({id:`${id}-legend-${i}`,type:'rect',x,y:ly-size*.7,w:size*.65,h:size*.65,fill:valuationColor(v,m.scale),...show},text(`${id}-legend-value-${i}`,value(v),x+size,ly,size,{font:'figures',fit:step-size}));}
  elements.push(text(id+'-unit',`${m.unit} net present value · ${m.scale.decimals} decimals`,margin,h*(tall?.765:.855),w*(tall?.028:.021),{fit:w-2*margin}),text(id+'-limit',m.terminal.kind==='growing-perpetuity'?'Sampled cases · — means discount ≤ growth':'Sampled cases · finite horizon, no terminal value',margin,h*(tall?.825:.90),w*(tall?.027:.02),{fit:w-2*margin}));
 }else{
  const left=w*.20,right=w*.89,top=h*(tall?.36:.405),bottom=h*(tall?.72:.745),points=m.slice.points,xmin=points[0].x,xmax=points.at(-1).x,px=v=>left+(v-xmin)/(xmax-xmin)*(right-left),py=v=>bottom-(v-m.scale.min)/(m.scale.max-m.scale.min)*(bottom-top),markers=[];let prev=null;
  elements.push(text(id+'-y-name',`${m.unit} net present value`,margin,top-size*.6,size,{fit:w-2*margin}));
  check(m.scale.ticks.every((v,i)=>!i||py(m.scale.ticks[i-1])-py(v)>=size*1.4),'value ticks too close at this frame size');
  for(const [i,v]of m.scale.ticks.entries())elements.push(line(`${id}-grid-${i}`,left,py(v),right,py(v),{stroke:v===0?'muted':'line',width:v===0?2:1}),text(`${id}-y-${i}`,String(v),left-size*.4,py(v)+size*.3,size,{anchor:'end',font:'figures',fit:left-margin-size*.6}));
  check(points.every((c,i)=>!i||px(c.x)-px(points[i-1].x)>=size*.65*(rate(c.x).length+rate(points[i-1].x).length)),'slice rate labels too close at this frame size');
  for(const [i,c]of points.entries()){
   const at=reveal?.6+3.4*(c.x-xmin)/(xmax-xmin):0;elements.push(text(`${id}-x-${i}`,rate(c.x),px(c.x),bottom+size*1.3,size,{anchor:i===0?'start':i===points.length-1?'end':'middle',font:'figures',fit:(right-left)/(points.length-1)*.85}));
   if(!c.valid){prev=null;geometry.points.push({...c,point:null,at});continue;}
   const x=px(c.x),y=py(c.value),selected=c.growth===m.selected.growth&&c.discount===m.selected.discount;
   if(prev){elements.push(line(`${id}-segment-${i}`,prev.x,prev.y,x,y,{stroke:'accent',width:w*.0025,...(reveal?{at:prev.at,enter:'draw',dur:at-prev.at,drawEase:'linear'}:{})}));geometry.segments.push({p1:[prev.x,prev.y],p2:[x,y],at:prev.at,end:at});}
   markers.push({id:`${id}-point-${i}`,type:'circle',cx:x,cy:y,r:w*.006,fill:'accent',stroke:selected?'ink':'accent',width:selected?3:1,...show,at});geometry.points.push({...c,point:[x,y],selected,at});prev={x,y,at};
  }
  elements.push(...markers,text(id+'-x-name',`${m.slice.vary==='discount'?'Discount':'Growth'} rate`,right,bottom+size*2.7,size,{anchor:'end'}),text(id+'-limit','Evaluated points · connecting lines are guides',margin,h*(tall?.82:.86),w*(tall?.028:.021),{fit:w-2*margin}),text(id+'-invalid',m.terminal.kind==='growing-perpetuity'?'Perpetuity requires discount > growth':'Finite horizon; no perpetual-growth restriction',margin,h*(tall?.86:.90),w*(tall?.027:.02),{fit:w-2*margin}));
 }
 elements.push(text(sourceId,`${m.source} ${m.asOf}.`,margin,h*(tall?.915:.935),w*(tall?.028:.022),{width:w-2*margin,height:h*.055}));
 return{model,geometry,props:{view:[0,0,w,h],sourceElement:sourceId,elements}};
}
