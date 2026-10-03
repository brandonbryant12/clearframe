"""Independent dated-pair classification, native mappings and bounded encoded probes.
No JS imports. Decode 2 Hz plus exact arrival/cut frames, with two FFmpeg workers.
"""
import datetime,hashlib,json,math,subprocess
from pathlib import Path
ROOT=Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def read(p):return json.loads(p.read_text())
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def day(s):return datetime.date.fromisoformat(s).toordinal()
def formatted(v,d):
 if v is None:return 'missing'
 s=f'{v:.{d}f}'
 if float(s)==0:s=s.lstrip('-')
 return ('' if float(s)==v else '≈')+s
def rgb(data,w,h,x,y):
 x=round(x);y=round(y);assert 0<=x<w and 0<=y<h
 return data[(y*w+x)*3:(y*w+x)*3+3]
def blue(v):r,g,b=v;return b-r>28 and b-g>20
def ink(v):return max(v)<105
def around(data,w,h,x,y,predicate,radius=1):return any(predicate(rgb(data,w,h,xx,yy)) for yy in range(max(0,round(y)-radius),min(h,round(y)+radius+1)) for xx in range(max(0,round(x)-radius),min(w,round(x)+radius+1)))
def distance(p,a,b):
 dx,dy=b[0]-a[0],b[1]-a[1];den=dx*dx+dy*dy;t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
 return math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy)
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json');reports=[]
for audit in AUDIT['results']:
 c=next(c for c in INPUT['cases'] if c['id']==audit['caseId']);name=audit['name'];folder=ROOT/'evidence'/name;video=folder/'video.mp4';job=read(folder/'native-job.json');W,H=job['width'],job['height'];w=720;h=round(w*H/W);q=w/W;tall=H>W;r=W*.006;small=W*(.028 if tall else .02)
 assert job['frames']==2160 and job['fps']==30 and [b['frames'] for b in job['beats']]==[1080,1080]
 left,right=W*(.20 if tall else .41),W*(.89 if tall else .93);top,bottom=H*(.30 if tall else .235),H*(.665 if tall else .72);ty=H*(.765 if tall else .86)
 px=lambda v:left+(v-c['x']['domain'][0])/(c['x']['domain'][1]-c['x']['domain'][0])*(right-left)
 py=lambda v:bottom-(v-c['y']['domain'][0])/(c['y']['domain'][1]-c['y']['domain'][0])*(bottom-top)
 first,last=day(c['points'][0]['date']),day(c['points'][-1]['date']);points=[];segments=[];arithmetic=native=0
 for i,p in enumerate(c['points']):
  valid=p['x'] is not None and p['y'] is not None;time=(day(p['date'])-first)/(last-first);quadrant=boundary=None
  if valid:
   sx=(p['x']>c['x']['reference'])-(p['x']<c['x']['reference']);sy=(p['y']>c['y']['reference'])-(p['y']<c['y']['reference'])
   if sx and sy:quadrant={(-1,1):'NW',(1,1):'NE',(-1,-1):'SW',(1,-1):'SE'}[(sx,sy)]
   else:boundary='both-references' if sx==sy==0 else 'x-reference' if sx==0 else 'y-reference'
  points.append({**p,'index':i,'valid':valid,'quadrant':quadrant,'boundary':boundary,'time':time,'at':1+12*time,'point':[px(p['x']),py(p['y'])] if valid else None,'strip':[left+time*(right-left),ty]})
  if i and valid and points[i-1]['valid']:segments.append((i-1,i))
 focus=next(p for p in points if p['date']==c['focusDate']);expected_segments=[{'from':a,'to':b,'fromDate':points[a]['date'],'toDate':points[b]['date'],'days':day(points[b]['date'])-day(points[a]['date'])} for a,b in segments]
 for bi,beat in enumerate(job['beats']):
  ident=beat['id'];els={e['id']:e for e in beat['props']['elements']};m=audit['stages'][bi]['model'];g=audit['stages'][bi]['geometry']
  assert m['segments']==expected_segments and m['smoothing']=='none';assert m['observed']==sum(p['valid'] for p in points);assert m['missing']==sum(not p['valid'] for p in points);arithmetic+=4
  assert len(m['points'])==len(points)
  for p,actual in zip(points,m['points']):
   for k in ['index','date','x','y','valid','quadrant','boundary']:assert actual[k]==p[k];arithmetic+=1
   near(actual['time'],p['time']);assert actual['missing']==[k for k in ['x','y'] if p[k] is None];arithmetic+=2
  assert els[ident+'-source']['text']==f"{c['source']} · as of {c['asOf']}";native+=1
  for key,a,position in [('x',c['x'],px),('y',c['y'],py)]:
   for i,v in enumerate(a['ticks']):
    e=els[f'{ident}-{key}-grid-{i}'];label=els[f'{ident}-{key}-tick-{i}'];near(e['x1' if key=='x' else 'y1'],position(v));assert label['text']==formatted(v,a['decimals']);native+=2
  for p in points:
   i=p['index'];at=p['at'] if bi==0 else 0;key=f'{ident}-point-{i}'
   if p['valid']:
    e=els[key]
    for k,v in [('cx',p['point'][0]),('cy',p['point'][1]),('r',r),('at',at)]:near(e[k],v);native+=1
    assert e['fill']==('muted' if bi==1 and p['date']!=c['focusDate'] else 'accent');assert 'along' not in e and 'keys' not in e;native+=2
   else:assert key not in els;native+=1
   tick=els[f'{ident}-time-{i}'];near(tick['cx'],p['strip'][0]);near(tick['cy'],ty);near(tick['at'],at);assert tick['fill']==('accent' if p['valid'] else 'bg');native+=4
   if bi==0:
    current=els[f'{ident}-current-{i}'];assert current['text']==f"{'Observation' if p['valid'] else 'Missing pair'}: {p['date']}";near(current['at'],at);native+=2
    if i<len(points)-1:assert current['exit']=='none';near(current['exitAt'],points[i+1]['at']);native+=2
    ring=els.get(f'{ident}-current-ring-{i}')
    if p['valid']:
     assert ring['fill']=='none';near(ring['cx'],p['point'][0]);near(ring['cy'],p['point'][1]);near(ring['r'],r*1.65);near(ring['at'],at);native+=5
     if i<len(points)-1:near(ring['exitAt'],points[i+1]['at']);native+=1
    else:assert ring is None;native+=1
  actual_segment_ids={e['id'] for e in els.values() if '-segment-' in e['id']};assert actual_segment_ids=={f'{ident}-segment-{b}' for a,b in segments};native+=1
  for a,b in segments:
   e=els[f'{ident}-segment-{b}']
   for k,v in [('x1',points[a]['point'][0]),('y1',points[a]['point'][1]),('x2',points[b]['point'][0]),('y2',points[b]['point'][1])]:near(e[k],v);native+=1
   if bi==0:near(e['at'],points[a]['at']);near(e['dur'],points[b]['at']-points[a]['at']);assert e['drawEase']=='linear';native+=3
  if bi==1:
   assert els['focus-focus-values']['text']==f"{focus['date']}: x {formatted(focus['x'],c['x']['decimals'])}, y {formatted(focus['y'],c['y']['decimals'])}";native+=1
   if focus['valid']:
    e=els['focus-selected'];near(e['cx'],focus['point'][0]);near(e['cy'],focus['point'][1]);near(e['r'],r*1.65);assert e['fill']=='none';native+=4
 # Exact null-gap probes are used only where a hypothetical skip-null connector
 # is separated from every real mark/guide by eight decoded pixels. Retain them.
 gap_probes=[];previous=None
 for p in points:
  if not p['valid']:continue
  if previous is not None and p['index']>previous['index']+1:
   for f in [.2,.4,.6,.8]:
    pos=[previous['point'][k]+f*(p['point'][k]-previous['point'][k]) for k in [0,1]]
    clearance=min([math.dist(pos,z['point'])*q for z in points if z['valid']]+[distance(pos,points[a]['point'],points[b]['point'])*q for a,b in segments])
    if clearance>8:gap_probes.append({'point':pos,'from':previous['index'],'to':p['index'],'fraction':f,'clearanceAt720':clearance})
  previous=p
 assert gap_probes,'fixture needs an unambiguous encoded null-gap probe'
 extra={0,29,30,31,1079,1080,1081,2159}
 for p in points:
  start=math.ceil(p['at']*30-1e-9);extra.update([max(0,start-1),start,start+1])
 frames=sorted(set(range(0,2160,15))|extra);expr='+'.join(f'eq(n\\,{v})' for v in frames)
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(video),'-vf',f'select={expr},scale={w}:{h}','-vsync','0','-threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 sampled=point_checks=strip_checks=missing_checks=hidden_checks=front_checks=ring_checks=gap_checks=0
 try:
  for frame in frames:
   need=w*h*3;chunks=[]
   while need:
    chunk=proc.stdout.read(need);assert chunk,('short decode',name,frame);chunks.append(chunk);need-=len(chunk)
   data=b''.join(chunks);sampled+=1;bi=0 if frame<1080 else 1;local=(frame-bi*1080)/30
   for p in points:
    arrived=bi==1 or local+1e-7>=p['at'];sx,sy=[v*q for v in p['strip']]
    if not arrived:assert not around(data,w,h,sx,sy,blue),(name,frame,'future date marker',p);hidden_checks+=1;continue
    if p['valid']:
     assert around(data,w,h,sx,sy,blue),(name,frame,'observed date marker',p);strip_checks+=1
     expected=bytes.fromhex(job['theme']['muted' if bi==1 and p['date']!=c['focusDate'] else 'accent'][1:]);x,y=[v*q for v in p['point']]
     # Four diagonal core probes stay inside the downsampled fill, away from
     # the antialiased rim and its chroma bleed. Native checks retain exact radii.
     for dx,dy in [(-1,-1),(-1,1),(1,-1),(1,1)]:
      target=(x+dx*r*q*.2,y+dy*r*q*.2);actual=rgb(data,w,h,*target)
      assert max(abs(a-b) for a,b in zip(actual,expected))<=24,(name,frame,'point interior',p,tuple(actual),tuple(expected));point_checks+=1
    else:
     expected=bytes.fromhex(job['theme']['bg'][1:]);actual=rgb(data,w,h,sx,sy)
     assert max(abs(a-b) for a,b in zip(actual,expected))<=18,(name,frame,'missing date center',p,tuple(actual));missing_checks+=1
   if bi==0:
    for a,b in segments:
     start,end=points[a],points[b]
     if start['at']+.1<local<end['at']-.1:
      f=(local-start['at'])/(end['at']-start['at']);x,y=[(start['point'][k]+f*(end['point'][k]-start['point'][k]))*q for k in [0,1]]
      assert around(data,w,h,x,y,blue,2),(name,frame,'guide front',a,b);front_checks+=1
    current=next((p for p in reversed(points) if local+1e-7>=p['at']),None)
    if local>=13:
     for p in gap_probes:assert not around(data,w,h,p['point'][0]*q,p['point'][1]*q,blue),(name,frame,'null gap bridged',p);gap_checks+=1
   else:current=focus
   if current and current['valid']:
    x,y=current['point'];rim=r*1.65*q
    hits=sum(around(data,w,h,x*q+rim*math.cos(j*math.pi/4),y*q+rim*math.sin(j*math.pi/4),ink,1) for j in range(8))
    assert hits>=6,(name,frame,'selected/current outline',hits,current);ring_checks+=8
  assert proc.stdout.read(1)==b'';err=proc.stderr.read();assert proc.wait()==0,err
 finally:
  if proc.poll() is None:proc.kill();proc.wait()
 report={'project':name,'videoSha256':sha(video),'storyboardSha256':sha(ROOT/'specimens'/name/'storyboard.json'),'nativeJobSha256':sha(folder/'native-job.json'),'inputSha256':sha(ROOT/'inputs.json'),'checkerSha256':sha(Path(__file__)),'nativeMappingChecks':native,'arithmeticChecks':arithmetic,'sampledFrames':sampled,'pointInteriorChecks':point_checks,'observedDateChecks':strip_checks,'missingDateChecks':missing_checks,'hiddenDateChecks':hidden_checks,'frontChecks':front_checks,'outlineRimChecks':ring_checks,'gapChecks':gap_checks,'gapProbePositions':gap_probes,'failures':0,'tolerances':{'nativeGeometry':1e-7,'pointRgbPerChannel':24,'pointCoreRadiusFraction':.2,'missingCenterRgbPerChannel':18,'ordinaryProbeRadiusAt720':1,'frontProbeRadiusAt720':2,'outlineMaximumRgb':104,'outlineRequiredAngularProbes':6,'outlineAngularProbes':8,'minimumGapClearanceAt720':8}}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n')
