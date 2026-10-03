import {expandPlotProps,plotLayout} from '../../../../fframes/plots.mjs';
import {axisPosition} from '../../../../fframes/plot-data.mjs';
export const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',at:0,enter:'none',...extra});
export function frame(preset){const [w,h]=preset==='landscape'?[1920,1080]:[1080,1920];return{w,h,margin:w*(h>w?.105:.065),size:w*.030,tall:h>w};}
export function method(id,title,lines,source,F){return{id,block:'canvas',duration:20,camera:'none',exit:'none',props:{view:[0,0,F.w,F.h],sourceElement:`${id}-source`,elements:[
 text(`${id}-title`,title,F.margin,F.h*.12,F.w*.038,{width:F.w-2*F.margin,height:F.h*.105,font:'display'}),
 ...lines.map((s,i)=>text(`${id}-line-${i}`,s,F.margin,F.h*(.29+i*.135),F.size,{width:F.w-2*F.margin,height:F.h*.11,font:i===0?'semibold':'text',at:i*.5,enter:'fade',dur:.2})),
 text(`${id}-source`,source,F.margin,F.h*.89,F.w*.028,{width:F.w-2*F.margin,height:F.h*.085})]}};}
export function chart(id,plot,{source,takeaway,cutoff,band,origin},F){
 const props=expandPlotProps({plot},{width:F.w,height:F.h,duration:26,beatId:id}),L=plotLayout({width:F.w,height:F.h});
 delete props.source;delete props.sourceSize;props.sourceElement=`${id}-source`;
 const title=props.elements.find(e=>e.id===`${id}-plot-title`);title.size=F.w*.038;title.y=F.h*(cutoff?(F.tall?.095:.13):.12);title.height=F.h*.095;
 if(cutoff){props.elements.push(text(`${id}-cutoff`,`Information available: ${cutoff}`,L.margin,F.h*(F.tall?.155:.205),F.w*(F.tall?.026:.023),{fit:F.w-2*L.margin,font:'semibold'}));
  if(!F.tall){const column=(F.w-2*L.margin)/plot.series.length,size=F.w*.023;for(const [i,s]of plot.series.entries()){
   const x=L.margin+i*column,y=F.h*.275,key=props.elements.find(e=>e.id===`${id}-plot-${s.id}-key`),label=props.elements.find(e=>e.id===`${id}-plot-${s.id}-label`),value=props.elements.find(e=>e.id===`${id}-plot-${s.id}-value`);
   Object.assign(key,{x1:x,y1:y-size*.3,x2:x+size*.65,y2:y-size*.3,width:size*.12});Object.assign(label,{x:x+size*.85,y,size,width:column-size*4.6,height:size*1.7});Object.assign(value,{x:x+column-size*.6,y,size:size*1.05,fit:size*3.2});
  }}
 }
 const px=x=>L.left+axisPosition(x,plot.x)*(L.right-L.left),py=y=>L.bottom-axisPosition(y,plot.y)*(L.bottom-L.top),polygons=[];
 if(band){let previous=null;for(const [i,p]of band.entries()){
  if(!p.complete){previous=null;continue;}
  if(previous){const points=[[px(previous.date),py(previous.lower)],[px(previous.date),py(previous.upper)],[px(p.date),py(p.upper)],[px(p.date),py(p.lower)]];props.elements.unshift({id:`${id}-band-${i}`,type:'poly',closed:true,points,fill:'accent2',opacity:.12,at:4.75,enter:'fade',dur:.2});polygons.push({index:i,from:previous.date,to:p.date,lower:[previous.lower,p.lower],upper:[previous.upper,p.upper],points});}previous=p;
 }}
 if(origin){const x=px(origin);props.elements.push({id:`${id}-origin`,type:'line',x1:x,y1:L.top,x2:x,y2:L.bottom,stroke:'ink',width:2,at:0,enter:'none'},text(`${id}-scenario-label`,'Scenarios begin',x+F.w*.015,L.top+F.size*.8,F.w*.025,{fit:L.right-x-F.w*.03}));}
 props.elements.push(text(`${id}-takeaway`,takeaway,L.margin,F.h*.78,F.w*.029,{width:F.w-2*L.margin,height:F.h*.095,at:4.75,enter:'fade',dur:.2}),text(props.sourceElement,source,L.margin,F.h*.89,F.w*.028,{width:F.w-2*L.margin,height:F.h*.085}));
 const geometry=plot.series.flatMap((s,si)=>s.values.map((p,i)=>({series:s.id,seriesIndex:si,index:i,x:p.x,y:p.y,point:p.y===null?null:[px(p.x),py(p.y)],at:.6+4*axisPosition(p.x,plot.x)})));
 return{beat:{id,block:'canvas',duration:26,camera:'none',exit:'none',props},geometry,polygons,layout:L,axes:{x:plot.x,y:plot.y}};
}
