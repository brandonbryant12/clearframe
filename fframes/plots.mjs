// Explicit scales -> existing native geometry. Data never passes through a raster illustration.
import { plotSpec, axisPosition, axisLabel } from './plot-data.mjs';
const check = (ok, message) => { if (!ok) throw new Error(`plot: ${message}`); };
const show = { at: 0, enter: 'none' };
const line = (id, x1, y1, x2, y2, extra = {}) => ({ id, type: 'line', x1, y1, x2, y2, stroke: 'muted', width: 2, ...show, ...extra });
const text = (id, value, x, y, size, extra = {}) => ({ id, type: 'text', text: value, x, y, size, fill: 'ink', font: 'text', ...show, ...extra });
const colors = ['accent', 'accent2', 'ink', 'muted'];

export function plotLayout({ width, height }) {
  check(Number.isFinite(width) && Number.isFinite(height) && width >= 640 && height >= 640, 'frame must be at least 640×640');
  const u = Math.min(width, height), tall = width <= height * 1.1;
  const margin=width*(height>width?.105:.055), right=width-margin-u*.28, labelX=right+u*.025;
  return { u, tall, margin, left: margin+u*.12, right,
    top: height * (tall ? 0.34 : 0.32), bottom: height * (tall ? 0.72 : 0.76),
    labelX, labelWidth: width-margin-labelX };
}

// Move only label anchors; data geometry always retains its exact mapped coordinates.
function distributeLabels(entries, lo, hi, gap) {
  const sorted = entries.map(e => ({ ...e, labelY: e.y })).sort((a,b) => a.y - b.y);
  sorted.forEach((e,i) => { e.labelY = Math.max(e.y, i ? sorted[i-1].labelY + gap : lo); });
  if (sorted.at(-1).labelY > hi) {
    sorted.at(-1).labelY = hi;
    for (let i=sorted.length-2;i>=0;i--) sorted[i].labelY = Math.min(sorted[i].labelY, sorted[i+1].labelY-gap);
  }
  return sorted;
}

export function plotElements(p, frame) {
  const { width, height } = frame, L = plotLayout(frame), { u, tall, left, right, top, bottom } = L;
  const px = x => left + axisPosition(x, p.x) * (right-left);
  const py = y => bottom - axisPosition(y, p.y) * (bottom-top);
  const time = x => p.motion === 'none' ? 0 : p.motion.at + p.motion.duration * axisPosition(x, p.x);
  const end = p.motion === 'none' ? 0 : p.motion.at + p.motion.duration;
  const arrive = at => at === 0 ? show : { at, enter: 'fade', dur: 0.15 };
  const final = arrive(end);
  const elements = [
    text('plot-title', p.title, L.margin+u*.02, height*.16, u*.065, { fit: width-2*(L.margin+u*.02), font: 'display' }),
    text('plot-unit', p.y.label + (p.y.type === 'log' ? ' · logarithmic scale' : ''), left, top-u*.05, u*.029, { fill: 'muted', fit: right-left }),
    text('plot-x-label', p.x.label, (left+right)/2, bottom+u*.10, u*.03, { anchor: 'middle', fit: right-left, fill: 'muted' }),
  ];
  for (const [i, y] of p.y.ticks.entries()) {
    elements.push(line(`plot-y-grid-${i}`,left,py(y),right,py(y),{stroke: y === 0 ? 'muted' : 'line', width:y===0?2:1}),
      text(`plot-y-tick-${i}`,axisLabel(y,p.y),left-u*.018,py(y)+u*.009,u*.027,{anchor:'end',font:'figures',fill:'muted',fit:left-u*.045}));
  }
  for (const [i,x] of p.x.ticks.entries()) {
    elements.push(line(`plot-x-tick-${i}`,px(x),bottom,px(x),bottom+u*.014),
      text(`plot-x-value-${i}`,axisLabel(x,p.x),px(x),bottom+u*.054,u*.027,{anchor:'middle',font:'figures',fill:'muted',fit:(right-left)/(p.x.ticks.length-1)*.93}));
  }
  const terminals=[];
  for (const [seriesIndex,s] of p.series.entries()) {
    const color=colors[seriesIndex];
    let last=null;
    for (const [i,v] of s.values.entries()) {
      if (v.y === null) { last=null; continue; }
      const x=px(v.x), y=py(v.y), at=time(v.x);
      if (last) {
        const start=time(last.x), duration=at-start;
        elements.push(line(`plot-${s.id}-segment-${i}`,px(last.x),py(last.y),x,y,
          {stroke:color,width:u*.004,...(p.motion==='none'?show:{at:start,dur:duration,enter:'draw',drawEase:'linear'})}));
      }
      // Dots mark observations, including isolated observations on either side of a gap.
      elements.push({id:`plot-${s.id}-point-${i}`,type:'circle',cx:x,cy:y,r:u*.0045,fill:color,...(p.motion==='none'?show:{at,enter:'none'})});
      last=v;
    }
    const terminal=s.values.findLast(v=>v.y!==null);
    terminals.push({id:s.id,label:s.label,x:px(terminal.x),y:py(terminal.y),value:terminal.y,color,
      stale:terminal.x!==p.x.domain[1],terminalX:terminal.x});
  }
  for (const t of distributeLabels(terminals,top,bottom-u*.08,u*.09)) {
    const labelY=t.labelY;
    elements.push(line(`plot-${t.id}-leader`,t.x+u*.008,t.y,L.labelX-u*.012,labelY-u*.009,{stroke:t.color,width:1,opacity:.5,...final}),
      text(`plot-${t.id}-label`,t.label,L.labelX,labelY,u*.029,{font:'semibold',fill:t.color,fit:L.labelWidth,...final}),
      text(`plot-${t.id}-value`,axisLabel(t.value,p.y),L.labelX,labelY+u*.035,u*.032,{font:'figures',fill:t.color,fit:L.labelWidth,...final}));
  }
  const hasMissing=p.series.some(s=>s.values.some(v=>v.y===null));
  const hasEarlyEnd=terminals.some(t=>t.stale);
  if (hasMissing || hasEarlyEnd) elements.push(text('plot-missing-note',
    [hasMissing?'Gaps mark missing observations.':'',hasEarlyEnd?'Labels show each series’ last observation.':''].filter(Boolean).join(' '),
    L.margin+u*.02,height*(tall?.83:.88),u*.027,{fill:'muted',fit:width-2*(L.margin+u*.02),...final}));
  if (p.annotation) {
    const a=p.annotation, point=p.series.find(s=>s.id===a.seriesId).values.find(v=>v.x===a.x);
    const x=px(point.x),y=py(point.y), tx=x+a.dx*(right-left),ty=y+a.dy*(bottom-top);
    check(tx>=left && tx<=right && ty>=top && ty<=bottom, 'annotation offsets must keep the label anchor inside the plot');
    const anchor=a.dx<0?'end':'start', fit=a.dx<0?tx-left:right-tx;
    check(fit>=u*.14,'annotation needs a wider clear text region');
    elements.push(line('plot-annotation-leader',x,y,tx,ty+u*.014,{stroke:'ink',width:2,...final}),
      {id:'plot-annotation-point',type:'circle',cx:x,cy:y,r:u*.009,fill:'none',stroke:'ink',width:2,...final},
      text('plot-annotation-text',a.label,tx,ty,u*.033,{anchor,fit,font:'semibold',...final}));
  }
  return elements;
}

export function expandPlotProps(input, frame) {
  if (input?.plot == null) return input;
  const { plot, ...rest } = structuredClone(input);
  for (const key of ['kpi','teaching','chart','sketch','plates','world','dolly','focus','view','viewFrom','viewTall','viewDrift','title'])
    check(rest[key] == null, `cannot combine plot with ${key}`);
  const p=plotSpec(plot,rest.source);
  const end=p.motion==='none'?0:p.motion.at+p.motion.duration;
  if (frame.duration!=null) check(frame.duration>=end+2.15,'beat needs two seconds after the final plot labels settle');
  const elements=plotElements(p,frame);
  if (frame.beatId) for (const el of elements) if(el.id)el.id=`${frame.beatId}-${el.id}`;
  return {...rest,source:`${p.source} · ${p.asOf}`,view:[0,0,frame.width,frame.height],elements:[...elements,...(rest.elements??[])]};
}
