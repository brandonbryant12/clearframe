"""Independent source-to-native mappings and bounded encoded geometry probes.

Run through codex-heavy. Two FFmpeg workers, one 720px frame in memory.
This checks point/edge samples, not a full pixel-area census or continuous playback.
"""
import datetime, hashlib, json, math, pathlib, subprocess
ROOT=pathlib.Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text())
RUNS=json.loads((ROOT/'build/verification.json').read_text())
AUDIT=json.loads((ROOT/'audit.json').read_text())
assert AUDIT['inputSha256']==hashlib.sha256((ROOT/'inputs.json').read_bytes()).hexdigest()
CASES={c['id']:c for c in INPUT['cases']}
def near(a,b): assert abs(a-b)<1e-7,(a,b)
def day(s): return datetime.date.fromisoformat(s).toordinal()
def color(data,x,y,width):
    i=(round(y)*width+round(x))*3
    return tuple(data[i:i+3])
def distance(a,b):return sum((x-y)**2 for x,y in zip(a,b))**.5
def is_series(data,offset,s):
    r,g,b=data[offset:offset+3]
    return b-r>28 and b-g>20 if s==0 else r-b>48 and r-g>25

def mark_exists(data,x,y,width,height,s):
    return any(is_series(data,(yy*width+xx)*3,s) for yy in range(max(0,round(y)-3),min(height,round(y)+4)) for xx in range(max(0,round(x)-3),min(width,round(x)+4)))

reports=[]
for run in RUNS:
    case_id=run['name'].rsplit('-',1)[0];c=CASES[case_id]
    project=ROOT/'specimens'/run['name'];out=pathlib.Path(run['dir'])
    job=json.loads((project/'build/native/job.json').read_text())
    receipt=json.loads((out/'video.mp4.json').read_text())
    assert receipt['hashes']['storyboard.json']==hashlib.sha256((project/'storyboard.json').read_bytes()).hexdigest()
    beat=next(b for b in job['beats'] if b['id']==c['id']);els={e['id']:e for e in beat['props']['elements']}
    width=720;scale=width/job['width'];height=round(job['height']*scale)
    native=0;rects=[];points=[];segments=[];gaps=[];bounds=None
    if c['recipe']=='C02':
        grid=[els[f"{c['id']}-plot-y-grid-{i}"] for i in range(len(c['ticks']))]
        left,right,bottom,top=grid[0]['x1'],grid[0]['x2'],grid[0]['y1'],grid[-1]['y1']
        xf=lambda d:(d-c['elapsedDomain'][0])/(c['elapsedDomain'][1]-c['elapsedDomain'][0])
        for si,s in enumerate(c['series']):
            base=next(p['value'] for p in s['observations'] if p['date']==s['baseDate']);previous=None
            for i,p in enumerate(s['observations']):
                elapsed=day(p['date'])-day(s['baseDate']);x=left+xf(elapsed)*(right-left)
                key=f"{c['id']}-plot-{s['id']}-point-{i}"
                if p['value'] is None:
                    assert key not in els
                    gaps.append((x*scale,si));previous=None;continue
                index=100*p['value']/base;y=bottom-(index-c['domain'][0])/(c['domain'][1]-c['domain'][0])*(bottom-top)
                actual=els[key];near(actual['cx'],x);near(actual['cy'],y);near(actual['at'],.5+4*xf(elapsed));native+=1
                current={'x':x*scale,'y':y*scale,'at':.5+4*xf(elapsed),'series':si};points.append(current)
                if previous is not None:segments.append((previous,current))
                previous=current
        for value,g in zip(c['ticks'],grid):near(g['y1'],bottom-(value-c['domain'][0])/(c['domain'][1]-c['domain'][0])*(bottom-top));native+=1
        for i,value in enumerate(c['elapsedTicks']):near(els[f"{c['id']}-plot-x-tick-{i}"]['x1'],left+xf(value)*(right-left));native+=1
        last=day(c['series'][0]['observations'][-1]['date'])-day(c['series'][0]['baseDate'])
        band=els[f"{c['id']}-older-only"];near(band['x'],left+xf(last)*(right-left));near(band['x']+band['w'],right);native+=2
        bounds=(left*scale,right*scale,top*scale,bottom*scale)
    else:
        if c['recipe']=='C03':
            a,b=c['first'],c['second'];initial=a['start']*b['start'];opening=0
            closing=100*((a['end']*b['end']+sum(p['amount'] for p in c['additions']))/initial-1)
            da,db=a['end']-a['start'],b['end']-b['start']
            parts=[{'id':a['id'],'amount':100*da*b['start']/initial},{'id':b['id'],'amount':100*db*a['start']/initial},
                   {'id':'interaction','amount':100*da*db/initial}]+[{'id':p['id'],'amount':100*p['amount']/initial} for p in c['additions']]
        else:
            opening,closing=c['opening'],c['closing'];parts=c['components']+[{'id':'residual','amount':closing-opening-sum(p['amount'] for p in c['components'])}]
        left=els[f"{c['id']}-tick-0"]['x1'];right=els[f"{c['id']}-tick-{len(c['ticks'])-1}"]['x1'];span=right-left
        px=lambda v:left+(v-c['domain'][0])/(c['domain'][1]-c['domain'][0])*span
        running=opening;rows=[('opening',0,opening)]
        for p in parts:rows.append((p['id'],running,running+p['amount']));running+=p['amount']
        near(running,closing);rows.append(('closing',0,closing));thickness=None
        for key,start,end in rows:
            mark=els.get(f"{c['id']}-bar-{key}");amount=abs(end-start);native+=1
            if amount<1e-10:assert mark is None;continue
            assert mark and not mark.get('keys') and mark['enter']=='fade'
            thickness=mark['h'] if thickness is None else thickness;near(mark['h'],thickness)
            near(mark['x'],min(px(start),px(end)));near(mark['w'],abs(px(end)-px(start)))
            near(mark['w']*mark['h']/(span*thickness),amount/(c['domain'][1]-c['domain'][0]))
            rects.append((mark,{k:mark[k]*scale for k in ('x','y','w','h')}))
        for i,value in enumerate(c['ticks']):near(els[f"{c['id']}-tick-{i}"]['x1'],px(value));native+=1
    proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',f'scale={width}:{height}',
        '-filter_threads','2','-f','rawvideo','-pix_fmt','rgb24','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    frames=edges=fades=observations=fronts=future=gap_checks=excluded=0;failures=[];size=width*height*3
    while True:
        data=proc.stdout.read(size)
        if not data:break
        assert len(data)==size
        frame=frames;frames+=1;t=(frame-beat['start_frame'])/job['fps']
        if t<.5 or t>beat['frames']/job['fps']-.5:continue
        for mark,p in rects:
            if t<mark['at']+.10:continue
            x,y,w,h=[p[k] for k in ('x','y','w','h')]
            if min(w,h)<4:excluded+=1;continue
            center=color(data,x+w/2,y+h/2,width)
            if min(distance(center,bg) for bg in [(245,243,237),(233,231,223)])<35:excluded+=1;continue
            for axis,lo,length,fixed in [('x',x,w,y+h/2),('y',y,h,x+w/2)]:
                coords=range(max(0,math.floor(lo)-4),min(width if axis=='x' else height,math.ceil(lo+length)+5))
                hits=[n for n in coords if distance(color(data,n,fixed,width) if axis=='x' else color(data,fixed,n,width),center)<28]
                edges+=1
                if t<mark['at']+mark.get('dur',0):fades+=1
                if not hits or abs(min(hits)-lo)>2.5 or abs(max(hits)+1-lo-length)>2.5:
                    failures.append({'kind':'edge','frame':frame,'id':mark['id'],'axis':axis,'expected':[lo,lo+length],'actual':[min(hits),max(hits)+1] if hits else []})
        for p in points:
            if t<p['at']+.05:continue
            if any(q['series']!=p['series'] and t>=q['at'] and math.hypot(q['x']-p['x'],q['y']-p['y'])<6 for q in points):excluded+=1;continue
            observations+=1
            if not mark_exists(data,p['x'],p['y'],width,height,p['series']):failures.append({'kind':'point','frame':frame,'series':p['series']})
        active=[]
        for si in (0,1):
            arrived=[p for p in points if p['series']==si and p['at']<=t];front=max(arrived,key=lambda p:p['x']) if arrived else None
            for a,b in segments:
                if a['series']==si and a['at']<=t<b['at']:
                    frac=(t-a['at'])/(b['at']-a['at']);front={'series':si,'x':a['x']+(b['x']-a['x'])*frac,'y':a['y']+(b['y']-a['y'])*frac}
            active.append(front)
        for si,front in enumerate(active):
            if front is None:continue
            other=active[1-si]
            if other is None or math.hypot(front['x']-other['x'],front['y']-other['y'])>=6:
                fronts+=1
                if not mark_exists(data,front['x'],front['y'],width,height,si):failures.append({'kind':'front','frame':frame,'series':si})
            column=math.ceil(front['x']+6)
            if column<bounds[1]-3:
                future+=1
                if any(is_series(data,(y*width+column)*3,si) for y in range(math.ceil(bounds[2]),math.floor(bounds[3])+1)):failures.append({'kind':'future','frame':frame,'series':si})
        for x,si in gaps:
            gap_checks+=1;column=round(x)
            if any(is_series(data,(y*width+column)*3,si) for y in range(math.ceil(bounds[2]),math.floor(bounds[3])+1)):failures.append({'kind':'gap-filled','frame':frame,'series':si})
    err=proc.stderr.read().decode();assert proc.wait()==0,err;assert frames==job['frames']
    report={'project':run['name'],'framesDecoded':frames,'nativeMappingChecks':native,'rectangleEdgeChecks':edges,'duringFadeEdgeChecks':fades,
        'visiblePointChecks':observations,'revealFrontChecks':fronts,'futureColumnChecks':future,'missingColumnChecks':gap_checks,'excludedFaintSmallOrOccludedSamples':excluded,
        'failures':len(failures),'firstFailures':failures[:8],'auditWidth':width,'nativeTolerance':1e-7,'encodedPointTolerancePx':3,'encodedEdgeTolerancePx':2.5,
        'scope':'Independent original-input mappings, equal-thickness rectangle area ratios and bounded encoded edges/points/fronts. Excludes first/last half-second, faint/under-4px rectangles and overlapping points/fronts. All frames decoded but only quantitative scenes probed; no full-area pixel census or continuous-playback claim.'}
    reports.append(report);print(json.dumps(report),flush=True)
(ROOT/'build/encoded-proportions.json').write_text(json.dumps(reports,indent=2)+'\n')
assert not any(r['failures'] for r in reports),'Encoded geometry differs from source expectations'
