"""Independent formulas and native/encoded coordinate checks; no interpolation.
Two FFmpeg workers; sample encoded frames at 2 Hz, retaining only one frame at a time.
"""
import datetime,hashlib,json,math,pathlib,statistics,subprocess
ROOT=pathlib.Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text());RUNS=json.loads((ROOT/'build/verification.json').read_text())
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json')
CASES={c['id']:c for c in INPUT['cases']}
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def day(s):return datetime.date.fromisoformat(s).toordinal()
def series(c):
 if c['recipe']=='C09':
  ds=c['dates'];base=c['priceIndex'][ds.index(c['baseDate'])]
  return ds,[[c['nominal'],[None if v is None or p is None else v*base/p for v,p in zip(c['nominal'],c['priceIndex'])]]]
 v=c['values'];ds=[f'2024-{i+1:02}-01' for i in range(len(v))]
 growth=[None]+[None if a is None or b is None or a<=0 or b<0 else 100*(b/a-1) for a,b in zip(v,v[1:])]
 if c['recipe']=='C10':return ds,[[v],[growth],[[None]+[None if a is None or b is None else b-a for a,b in zip(growth,growth[1:])]]]
 peak=None;peaks=[];dd=[]
 for val in v:
  if val is not None:peak=val if peak is None else max(peak,val)
  peaks.append(peak);dd.append(None if val is None or peak is None or peak==0 else 100*(val/peak-1))
 sd=[]
 for i in range(len(v)):
  window=growth[max(0,i-c['window']+1):i+1]
  sd.append(statistics.stdev(window) if len(window)==c['window'] and all(x is not None for x in window) else None)
 return ds,[[v,peaks],[dd],[sd]]
def mark(data,x,y,w,h,color):
 for yy in range(max(0,round(y)-3),min(h,round(y)+4)):
  for xx in range(max(0,round(x)-3),min(w,round(x)+4)):
   r,g,b=data[(yy*w+xx)*3:(yy*w+xx)*3+3]
   if (b-r>28 and b-g>20) if color=='accent' else (r-b>48 and r-g>25):return True
 return False
reports=[]
for run in RUNS:
 name=run['name'];c=CASES[name.rsplit('-',1)[0]];out=pathlib.Path(run['dir']);project=ROOT/'specimens'/name
 sb=json.loads((project/'storyboard.json').read_text());job=json.loads((out/'native-job.json').read_text());receipt=json.loads((out/'video.mp4.json').read_text())
 assert receipt['hashes']['storyboard.json']==sha(project/'storyboard.json')
 beat=next(b for b in job['beats'] if b['id']==c['id']);els={e['id']:e for e in beat['props']['elements']};ds,rows=series(c)
 w=720;scale=w/job['width'];h=round(job['height']*scale);points=[];segments=[];gaps=[];native=0
 xf=lambda s:(day(s)-day(ds[0]))/(day(ds[-1])-day(ds[0]))
 for ri,row in enumerate(rows):
  if c['recipe']=='C09':
   grid=[els[f"{c['id']}-plot-y-grid-{i}"] for i in range(len(c['ticks']))];domain=c['domain']
  else:grid=[els[f"{c['id']}-{ri}-grid-{i}"] for i in range(len(c['ticks'][ri]))];domain=c['domains'][ri]
  left,right,bottom,top=grid[0]['x1'],grid[0]['x2'],grid[0]['y1'],grid[-1]['y1'];px=lambda d:left+xf(d)*(right-left);py=lambda v:bottom-(v-domain[0])/(domain[1]-domain[0])*(bottom-top)
  for si,values in enumerate(row):
   color='accent2' if si==1 or (c['recipe']=='C11' and ri==1) else 'accent';previous=None
   for i,(date,value) in enumerate(zip(ds,values)):
    prefix=f"{c['id']}-plot-{['nominal','real'][si]}" if c['recipe']=='C09' else f"{c['id']}-{ri}-{si}"
    key=f'{prefix}-point-{i}';segment=f'{prefix}-segment-{i}'
    if value is None:
     assert key not in els and segment not in els;gaps.append({'panel':ri,'x':px(date)*scale,'top':top*scale,'bottom':bottom*scale,'color':color});previous=None;native+=2;continue
    actual=els[key];near(actual['cx'],px(date));near(actual['cy'],py(value));near(actual['at'],.6+4*xf(date));native+=3
    p={'panel':ri,'series':si,'x':px(date)*scale,'y':py(value)*scale,'at':actual['at'],'color':color};points.append(p)
    if previous is not None:
     actualSegment=els[segment];near(actualSegment['x1']*scale,previous['x']);near(actualSegment['y1']*scale,previous['y']);assert actualSegment['drawEase']=='linear';segments.append((previous,p));native+=3
    else:assert segment not in els;native+=1
    if c['recipe']=='C11' and ri==1 and previous is not None:
     area=els[f'{prefix}-area-{i}'];near(area['points'][0][1],py(0));near(area['points'][-1][1],py(0));near(area['points'][1][1]*scale,previous['y']);near(area['points'][2][1]*scale,p['y']);native+=4
    previous=p
  for tick,gridline in zip(c['ticks'] if c['recipe']=='C09' else c['ticks'][ri],grid):near(gridline['y1'],py(tick));native+=1
 proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',f'fps=2:start_time=0,scale={w}:{h}','-filter_threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 frames=checks=fronts=gapchecks=excluded=0;failures=[];occlusionProofs=[];size=w*h*3
 while True:
  data=proc.stdout.read(size)
  if not data:break
  assert len(data)==size;t=frames/2-beat['start_frame']/job['fps'];frames+=1
  if t<.5 or t>beat['frames']/job['fps']-.5:continue
  for p in points:
   if t<p['at']+.25:continue
   if any(q['color']!=p['color'] and q['panel']==p['panel'] and q['at']<=t and math.hypot(q['x']-p['x'],q['y']-p['y'])<7 for q in points):excluded+=1;continue
   checks+=1
   if not mark(data,p['x'],p['y'],w,h,p['color']):failures.append({'kind':'point','t':t,'point':p})
  # fps resampling can select the source frame ~0.25 s later. Probe fronts using
  # decoded source frame indices instead below; this pass checks settled dots/gaps.
  for gap in gaps:
   gapchecks+=1;x=round(gap['x'])
   if any(mark(data,x,y,w,h,gap['color']) for y in range(math.ceil(gap['top'])+4,math.floor(gap['bottom'])-3,5)):
    failures.append({'kind':'gap','t':t,'gap':gap})
 err=proc.stderr.read().decode();assert proc.wait()==0,err;assert frames==round(job['frames']/job['fps']*2),(frames,job['frames'])
 # Directly select four in-motion source frames to inspect the shared linear front.
 chosen=[beat['start_frame']+int(t*job['fps']) for t in [1.1,2.1,3.1,4.1]]
 filt='select='+ '+'.join(f'eq(n\\,{i})' for i in chosen)+f',scale={w}:{h}'
 data=subprocess.check_output(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',filt,'-filter_threads','2','-vsync','0','-pix_fmt','rgb24','-f','rawvideo','-']);assert len(data)==size*len(chosen)
 for fi,frame in enumerate(chosen):
  t=(frame-beat['start_frame'])/job['fps'];pixels=data[fi*size:(fi+1)*size]
  for a,b in segments:
   if not a['at']+.08<t<b['at']-.08:continue
   q=(t-a['at'])/(b['at']-a['at']);x=a['x']+(b['x']-a['x'])*q;y=a['y']+(b['y']-a['y'])*q
   if any(p['panel']==a['panel'] and p['color']!=a['color'] and math.hypot(p['x']-x,p['y']-y)<8 for p in points):excluded+=1;continue
   # Later series can cover the earlier series exactly when level == peak.
   # Exclude only a mathematically coincident active segment whose later color
   # is actually found at the expected encoded front; retain each proof.
   covered=False
   for oa,ob in segments:
    if oa['panel']!=a['panel'] or oa['series']<=a['series'] or oa['color']==a['color'] or not oa['at']<=t<ob['at']:continue
    oq=(t-oa['at'])/(ob['at']-oa['at']);ox=oa['x']+(ob['x']-oa['x'])*oq;oy=oa['y']+(ob['y']-oa['y'])*oq
    distance=math.hypot(ox-x,oy-y)
    if distance<1e-7 and mark(pixels,x,y,w,h,oa['color']):
     covered=True;excluded+=1;occlusionProofs.append({'frame':frame,'panel':a['panel'],'coveredColor':a['color'],'visibleLaterColor':oa['color'],'frontDistancePx':distance,'encodedLaterColorPresent':True});break
   if covered:continue
   fronts+=1
   if not mark(pixels,x,y,w,h,a['color']):failures.append({'kind':'front','frame':frame,'x':x,'y':y,'color':a['color']})
 report={'project':name,'videoSha256':sha(out/'video.mp4'),'storyboardSha256':sha(project/'storyboard.json'),'nativeMappingChecks':native,'sampledFrames':frames+len(chosen),'pointChecks':checks,'frontChecks':fronts,'missingColumnChecks':gapchecks,'occludedSamplesExcluded':excluded,'coincidentFrontProofs':occlusionProofs,'failures':len(failures),'firstFailures':failures[:5],'scope':'Independent input formulas and native coordinates; 2Hz settled points/null columns and four exact source-frame linear fronts. Three-pixel encoded tolerance; not full pixel census or continuous playback.'}
 reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-checks.json').write_text(json.dumps(reports,indent=2)+'\n');assert not any(r['failures'] for r in reports)
