// Native small multiples: shared dated x, explicit independent y axes, exact null gaps.
import {plotSpec,axisPosition,axisLabel} from '../../../../fframes/plot-data.mjs';
export const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',at:0,enter:'none',...extra});
const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:2,at:0,enter:'none',...extra});
export function frame(preset){const [w,h]=preset==='landscape'?[1920,1080]:[1080,1920];return{w,h,margin:w*(h>w?.105:.065),size:w*.030,tall:h>w};}
export function canvas(id,title,elements,source,F,duration=20){return{id,block:'canvas',duration,camera:'none',exit:'none',props:{view:[0,0,F.w,F.h],sourceElement:`${id}-source`,elements:[text(`${id}-title`,title,F.margin,F.h*.12,F.w*.038,{...(F.tall?{width:F.w-2*F.margin,height:F.h*.105}:{fit:F.w-2*F.margin}),font:'display'}),...elements,text(`${id}-source`,source,F.margin,F.h*.89,F.w*.028,{width:F.w-2*F.margin,height:F.h*.085})]}};}
export function panels({id,title,x,rows,source,asOf},F){
 if(rows.length!==3)throw Error('linked panels: exactly three rows');
 const elements=[],geometry=[],left=F.w*.245,right=F.w-F.margin,starts=[.255,.465,.675],plotH=F.h*.10;
 const px=v=>left+axisPosition(v,x)*(right-left), at=v=>.6+4*axisPosition(v,x);
 for(const [ri,row]of rows.entries()){
  const p=plotSpec({title:row.label,source,asOf,x,y:row.y,series:row.series,motion:{at:.6,duration:4}});
  const top=F.h*starts[ri],bottom=top+plotH,py=v=>bottom-axisPosition(v,p.y)*plotH;
  elements.push(text(`${id}-${ri}-unit`,row.label,F.margin,top-F.size*.55,F.size,{font:'semibold',fit:F.w-2*F.margin}));
  for(const [ti,tick] of p.y.ticks.entries())elements.push(line(`${id}-${ri}-grid-${ti}`,left,py(tick),right,py(tick),{stroke:tick===0?'muted':'line'}),text(`${id}-${ri}-tick-${ti}`,axisLabel(tick,p.y),left-F.w*.025,py(tick)+F.size*.27,F.size*.9,{anchor:'end',font:'figures',fit:left-F.margin-F.w*.04}));
  for(const tick of x.ticks)elements.push(line(`${id}-${ri}-date-grid-${tick}`,px(tick),top,px(tick),bottom,{stroke:'line',width:1}));
  for(const [si,s]of p.series.entries()){
   const color=row.colors?.[si]??['accent','accent2'][si];let previous=null;
   for(const [i,v]of s.values.entries()){
    if(v.y===null){previous=null;continue;}
    const point={x:px(v.x),y:py(v.y)};
    if(previous){
     if(row.underwater)elements.push({id:`${id}-${ri}-${si}-area-${i}`,type:'poly',closed:true,points:[[px(previous.x),py(0)],[px(previous.x),py(previous.y)],[point.x,point.y],[point.x,py(0)]],fill:color,opacity:.12,at:4.75,enter:'fade',dur:.2});
     elements.push(line(`${id}-${ri}-${si}-segment-${i}`,px(previous.x),py(previous.y),point.x,point.y,{stroke:color,width:F.w*.0033,at:at(previous.x),dur:at(v.x)-at(previous.x),enter:'draw',drawEase:'linear'}));
    }
    elements.push({id:`${id}-${ri}-${si}-point-${i}`,type:'circle',cx:point.x,cy:point.y,r:F.w*.0042,fill:color,at:at(v.x),enter:'none'});
    geometry.push({beat:id,panel:ri,series:s.id,index:i,date:v.x,value:v.y,point,color,at:at(v.x),domain:p.y.domain,bounds:{left,right,top,bottom}});previous=v;
   }
  }
 }
 for(const [i,t]of x.ticks.entries())elements.push(text(`${id}-date-${i}`,axisLabel(t,x),px(t),F.h*.83,F.size,{anchor:i===0?'start':i===x.ticks.length-1?'end':'middle',fit:(right-left)/(x.ticks.length-1)*.9,font:'figures'}));
 return{beat:canvas(id,title,elements,source,F,20),geometry};
}
