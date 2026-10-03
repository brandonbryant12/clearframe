// A reusable native canvas composition; no new renderer or raster chart layer.
import {rankSeries} from './multiple-data.mjs';
import {axisPosition,axisLabel} from './plot-data.mjs';
const check=(ok,m)=>{if(!ok)throw Error(`small multiples: ${m}`);};
const show={at:0,enter:'none'};
export function rankLabel(value,axis){
 let decimals=axis.decimals??0;while(decimals<6&&Number(value.toFixed(decimals))!==value)decimals++;
 const approximate=Number(value.toFixed(decimals))!==value;
 return `${approximate?'≈':''}${axisLabel(value,{...axis,decimals})}`;
}
const text=(id,value,x,y,size,extra={})=>({id,type:'text',text:String(value),x,y,size,fill:'ink',font:'text',...show,...extra});
const line=(id,x1,y1,x2,y2,extra={})=>({id,type:'line',x1,y1,x2,y2,stroke:'line',width:1,...show,...extra});
export function multipleLayout({width:w,height:h,count=4}){
 check(Number.isFinite(w)&&Number.isFinite(h)&&w>=640&&h>=640&&w<=4096&&h<=4096,'frame dimensions must be 640–4096');
 check(Number.isInteger(count)&&count>=2&&count<=4,'two to four panels required');
 const tall=h>w,margin=w*(tall?.105:.07),gap=w*(tall?.065:.05),pw=(w-2*margin-gap)/2,ph=h*.23,top=h*(tall?.25:.30),rowGap=h*(tall?.055:.055);
 const boxes=Array.from({length:count},(_,i)=>[margin+(i%2)*(pw+gap),top+Math.floor(i/2)*(ph+rowGap),pw,ph]);
 const scale=(w-2*margin)/pw,expanded=[margin,top,pw*scale,ph*scale];
 check(expanded[1]+expanded[3]<h*.84,'expanded panel would crowd the source');
 return{width:w,height:h,tall,margin,pw,ph,boxes,expanded,scale,type:w*(tall?.036:.022),tick:w*(tall?.033:.021)};
}
/** rankAt selects one observed date, not a publication vintage or filtered history.
 * Each panel shares exactly the same domains and date grid. Expansion is uniform.
 */
export function multipleScene(input,{width,height,id,subtitle,expandedId=null,reveal=false}){
 check(typeof id==='string'&&/^[a-z][a-z0-9-]*$/.test(id),'scene id required');
 check(typeof subtitle==='string'&&subtitle.length<=110,'short subtitle required');
 const model=rankSeries(input),p=model.plot,L=multipleLayout({width,height,count:model.panels.length});
 check(expandedId===null||model.panels.some(s=>s.id===expandedId),'selected series must exist');
 const F=L.type,tick=L.tick,local={left:L.pw*.18,right:L.pw*.97,top:L.ph*.34,bottom:L.ph*.87},elements=[],geometry=[];
 const dateLabel=value=>p.x.dateFormat==='month'&&p.x.domain[0].slice(0,4)===p.x.domain[1].slice(0,4)?axisLabel(value,p.x).slice(0,3):axisLabel(value,p.x);
 for(const [i,s]of model.panels.entries()){
  const box=L.boxes[i],children=[],prefix=`${id}-${s.id}`,px=x=>local.left+axisPosition(x,p.x)*(local.right-local.left),py=y=>local.bottom-axisPosition(y,p.y)*(local.bottom-local.top);
  const rank=s.rank===null?'—':`${s.rank}${s.tied?'=':''}`,value=s.value===null?'Missing':rankLabel(s.value,p.y);
  children.push(text(`${prefix}-name`,`${rank}  ${s.label}`,0,F,F,{font:'semibold',width:L.pw*(L.tall?1:.55),height:F*1.65}),
    text(`${prefix}-rank-value`,`${value} · ${dateLabel(model.rankAt)}`,L.tall?0:L.pw,L.tall?F*2.1:F,tick,{font:'figures',anchor:L.tall?'start':'end',fit:L.pw*(L.tall?1:.42)}));
  for(const [j,y]of p.y.ticks.entries())children.push(line(`${prefix}-grid-${j}`,local.left,py(y),local.right,py(y),{stroke:y===0?'muted':'line',width:y===0?2:1}),text(`${prefix}-y-${j}`,axisLabel(y,p.y),local.left-tick*.25,py(y)+tick*.3,tick,{anchor:'end',font:'figures',fit:local.left-tick*.4}));
  for(const [j,x]of p.x.ticks.entries())children.push(text(`${prefix}-x-${j}`,dateLabel(x),px(x),local.bottom+tick*1.1,tick,{anchor:j===0?'start':j===p.x.ticks.length-1?'end':'middle',font:'figures',fit:(local.right-local.left)/(p.x.ticks.length-1)*.9}));
  let previous=null;
  for(const [j,v]of s.values.entries()){
   if(v.y===null){previous=null;geometry.push({seriesId:s.id,index:j,date:v.x,value:null,point:null});continue;}
   const at=reveal ? .7+3.5*axisPosition(v.x,p.x):0,color=expandedId===s.id?'accent2':'accent';
   if(previous){const start=reveal ? .7+3.5*axisPosition(previous.x,p.x):0;children.push(line(`${prefix}-segment-${j}`,px(previous.x),py(previous.y),px(v.x),py(v.y),{stroke:color,width:width*.0025,...(reveal?{at:start,enter:'draw',dur:at-start,drawEase:'linear'}:{})}));}
   children.push({id:`${prefix}-point-${j}`,type:'circle',cx:px(v.x),cy:py(v.y),r:width*.0032,fill:color,...show,at});
   geometry.push({seriesId:s.id,index:j,date:v.x,value:v.y,local:[px(v.x),py(v.y)],point:[box[0]+px(v.x),box[1]+py(v.y)],at});previous=v;
  }
  const group={id:`${prefix}-panel`,type:'group',x:box[0],y:box[1],children,...show};
  if(expandedId){
   if(s.id===expandedId){group.origin=[box[0],box[1]];group.keys=[{at:0,dur:0,x:0,y:0,scale:1},{at:.6,dur:1.4,ease:'inOut',x:L.expanded[0]-box[0],y:L.expanded[1]-box[1],scale:L.scale}];}
   else group.keys=[{at:0,dur:.35,opacity:0,ease:'linear'}];
  }
  elements.push(group);
 }
 const sourceId=`${id}-source`,period=`${p.x.domain[0]} to ${p.x.domain[1]}`;
 elements.push(text(`${id}-title`,expandedId?`Focus: ${model.panels.find(s=>s.id===expandedId).label}`:p.title,L.margin,height*(L.tall?.09:.115),width*(L.tall?.047:.032),{font:'display',width:width-2*L.margin,height:height*.085}),
 text(`${id}-subtitle`,subtitle,L.margin,height*(L.tall?.155:.185),width*(L.tall?.032:.025),{width:width-2*L.margin,height:height*.055}),
 text(`${id}-unit`,`${p.y.label} · ${p.x.domain[0].slice(0,4)}${p.x.domain[0].slice(0,4)===p.x.domain[1].slice(0,4)?'':'–'+p.x.domain[1].slice(0,4)}`,L.margin,height*(L.tall?.20:.245),width*(L.tall?.031:.022),{fit:width-2*L.margin}),
 text(sourceId,`${p.source} ${period}.`,L.margin,height*.89,width*.028,{width:width-2*L.margin,height:height*.085}));
 return{model,layout:L,local,geometry,props:{view:[0,0,width,height],sourceElement:sourceId,elements}};
}
