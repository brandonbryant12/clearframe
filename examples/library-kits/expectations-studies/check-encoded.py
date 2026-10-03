"""Recompute input math independently, check native geometry, then bounded encoded pixels.
At most two FFmpeg workers; decode one 2 Hz RGB frame at a time. No browser needed.
"""
import datetime, fractions, hashlib, json, math, pathlib, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parent
INPUT=json.loads((ROOT/'inputs.json').read_text());AUDIT=json.loads((ROOT/'audit.json').read_text())
RUNS=json.loads((ROOT/'build/verification.json').read_text());CASES={c['id']:c for c in INPUT['cases']}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
assert AUDIT['inputSha256']==sha(ROOT/'inputs.json')
def near(a,b):assert abs(a-b)<1e-7,(a,b)
def day(s):return datetime.date.fromisoformat(s).toordinal()
def quantile(values,p):
    values=sorted(fractions.Fraction(str(v)) for v in values)
    h=(len(values)-1)*fractions.Fraction(str(p));lo=h.numerator//h.denominator;f=h-lo
    return float(values[lo] if not f else values[lo]*(1-f)+values[lo+1]*f)
def expected(c):
    if c['recipe']=='C04':
        scenes=[]
        for bi,cutoff in enumerate(c['cutoffs']):
            vintages=[v for v in c['vintages'] if v['issuedAt']<=cutoff]
            releases=[v for v in c['releases'] if v['releasedAt']<=cutoff]
            targets=sorted(set([v['targetDate'] for s in vintages for v in s['values']]+[v['targetDate'] for v in releases]))
            actual=[]
            for date in targets:
                history=sorted([v for v in releases if v['targetDate']==date],key=lambda v:v['releasedAt'])
                actual.append((date,history[-1]['value'] if history else None))
            series=[(f'vintage-{i}',[(p['targetDate'],p['value']) for p in v['values']]) for i,v in enumerate(vintages)]
            if any(v is not None for _,v in actual):series.append(('actual',actual))
            scenes.append({'id':f"{c['id']}-{bi}",'domain':c['targetDomain'],'date':True,'series':series,'band':[],'origin':None})
        return scenes
    if c['recipe']=='C06':return [{'id':c['id'],'domain':[0,10],'date':False,'series':[(f'date-{i}',[(t['months']/12,v) for t,v in zip(c['tenors'],s['values'])]) for i,s in enumerate(c['snapshots'])],'band':[],'origin':None}]
    series=[('history',[(p['date'],p['value']) for p in c['history']])];band=[]
    for i,p in enumerate(c['scenarios'][0]['values']):
        values=[s['values'][i]['value'] for s in c['scenarios']];complete=all(v is not None for v in values)
        lower=upper=median=None
        if complete:
            lower=min(values) if c['band']['kind']=='range' else quantile(values,c['band']['lower'])
            upper=max(values) if c['band']['kind']=='range' else quantile(values,c['band']['upper'])
            median=quantile(values,.5)
        band.append({'date':p['date'],'lower':lower,'upper':upper,'median':median,'complete':complete})
    if c['band']['kind']=='range':series += [(s['id'],[(p['date'],p['value']) for p in s['values']]) for s in c['scenarios']]
    else:series += [(key,[(p['date'],p[key]) for p in band]) for key in ['lower','median','upper']]
    return [{'id':c['id'],'domain':[c['history'][0]['date'],band[-1]['date']],'date':True,'series':series,'band':band,'origin':c['history'][-1]['date']}]
COLORS=['accent','accent2','ink','muted']
def pixel_is(rgb,color):
    r,g,b=rgb
    if color=='accent':return b-r>28 and b-g>20
    if color=='accent2':return r-b>48 and r-g>25
    if color=='ink':return r<72 and g<82 and b<96 and abs(g-r)<20
    if color=='muted':return 70<r<145 and 80<g<160 and 90<b<180 and 5<b-r<45 and 0<g-r<35
    if color=='band':return r>190 and g>180 and b>170 and r-b>12 and r-g>5
    raise AssertionError(color)
def mark(data,x,y,w,h,color,radius=3):
    for yy in range(max(0,round(y)-radius),min(h,round(y)+radius+1)):
        for xx in range(max(0,round(x)-radius),min(w,round(x)+radius+1)):
            if pixel_is(data[(yy*w+xx)*3:(yy*w+xx)*3+3],color):return True
    return False
def distance_to_segment(x,y,a,b):
    dx=b['x']-a['x'];dy=b['y']-a['y'];den=dx*dx+dy*dy
    t=0 if not den else max(0,min(1,((x-a['x'])*dx+(y-a['y'])*dy)/den))
    return math.hypot(x-a['x']-t*dx,y-a['y']-t*dy)
def native_scene(scene,c,job,scale):
    beat=next(b for b in job['beats'] if b['id']==scene['id']);els={e['id']:e for e in beat['props']['elements']};prefix=scene['id']
    grid=[els[f'{prefix}-plot-y-grid-{i}'] for i in range(len(c['ticks']))]
    left,right,bottom,top=grid[0]['x1'],grid[0]['x2'],grid[0]['y1'],grid[-1]['y1']
    lo,hi=[day(x) if scene['date'] else x for x in scene['domain']]
    xf=lambda x:((day(x) if scene['date'] else x)-lo)/(hi-lo)
    px=lambda x:left+xf(x)*(right-left)
    py=lambda v:bottom-(v-c['domain'][0])/(c['domain'][1]-c['domain'][0])*(bottom-top)
    points=[];segments=[];gaps=[];polys=[];native=0
    expected_point_ids=[]
    for si,(sid,values) in enumerate(scene['series']):
        previous=None;color=COLORS[si]
        for i,(x,value) in enumerate(values):
            key=f'{prefix}-plot-{sid}-point-{i}';segment=f'{prefix}-plot-{sid}-segment-{i}'
            if value is None:
                assert key not in els and segment not in els
                gaps.append({'x':px(x)*scale,'top':top*scale,'bottom':bottom*scale,'color':color});previous=None;native+=2;continue
            expected_point_ids.append(key);actual=els[key]
            near(actual['cx'],px(x));near(actual['cy'],py(value));near(actual['at'],.6+4*xf(x));assert actual['fill']==color;native+=4
            p={'series':si,'x':px(x)*scale,'y':py(value)*scale,'at':actual['at'],'color':color};points.append(p)
            if previous is not None:
                s=els[segment];near(s['x1']*scale,previous['x']);near(s['y1']*scale,previous['y']);near(s['x2'],px(x));near(s['y2'],py(value));near(s['at'],previous['at']);near(s['dur'],p['at']-previous['at']);assert s['drawEase']=='linear';segments.append((previous,p));native+=7
            else:assert segment not in els;native+=1
            previous=p
        last=next(v for _,v in reversed(values) if v is not None)
        expected_label=f'{last:.1f}' if c['recipe']=='C06' else f'{last:.0f}'
        assert els[f'{prefix}-plot-{sid}-value']['text']==expected_label;native+=1
    assert sorted(expected_point_ids)==sorted(k for k in els if '-plot-' in k and '-point-' in k)
    for tick,g in zip(c['ticks'],grid):near(g['y1'],py(tick));native+=1
    previous=None
    for i,p in enumerate(scene['band']):
        key=f'{prefix}-band-{i}'
        if p['complete'] and previous:
            expected=[[px(previous['date']),py(previous['lower'])],[px(previous['date']),py(previous['upper'])],[px(p['date']),py(p['upper'])],[px(p['date']),py(p['lower'])]]
            actual=els[key];assert actual['closed'] and actual['fill']=='accent2' and actual['opacity']==.12 and actual['at']==4.75 and actual['enter']=='fade'
            for a,b in zip(actual['points'],expected):near(a[0],b[0]);near(a[1],b[1]);native+=2
            polys.append([[x*scale,y*scale] for x,y in expected])
        else:assert key not in els;native+=1
        previous=p if p['complete'] else None
    origin_x=None
    if scene['origin']:
        origin_x=px(scene['origin'])*scale;e=els[f'{prefix}-origin'];near(e['x1'],px(scene['origin']));near(e['x2'],px(scene['origin']));near(e['y1'],top);near(e['y2'],bottom);native+=4
    return {'beat':beat,'points':points,'segments':segments,'gaps':gaps,'polys':polys,'native':native,'origin':origin_x,'top':top*scale,'bottom':bottom*scale}

reports=[]
selected=set(sys.argv[1:])
for run in RUNS:
    name=run['name']
    if selected and name not in selected:continue
    c=CASES[name.rsplit('-',1)[0]];out=pathlib.Path(run['dir']);project=ROOT/'specimens'/name
    job=json.loads((out/'native-job.json').read_text());receipt=json.loads((out/'video.mp4.json').read_text())
    assert receipt['hashes']['storyboard.json']==sha(project/'storyboard.json')
    assert receipt['outputSha256']==sha(out/'video.mp4')
    w=720;scale=w/job['width'];h=round(job['height']*scale);size=w*h*3
    scenes=[native_scene(s,c,job,scale) for s in expected(c)]
    native=sum(s['native'] for s in scenes);frames=points=fronts=gapchecks=bandchecks=bandgaps=excluded=0;failures=[];occlusions=[];chroma_proofs=[]
    def covered(data,x,y,color,si,t,scene,frame):
        # A failed probe may be covered only by a later declared mark with actual encoded color.
        candidates=[p for p in scene['points'] if p['series']>si and p['at']<=t and math.hypot(p['x']-x,p['y']-y)<5]
        for a,b in scene['segments']:
            if a['series']<=si or t<a['at']:continue
            q=min(1,(t-a['at'])/(b['at']-a['at']));end={**b,'x':a['x']+q*(b['x']-a['x']),'y':a['y']+q*(b['y']-a['y'])}
            if distance_to_segment(x,y,a,end)<2.5:candidates.append(a)
        for p in candidates:
            if mark(data,x,y,w,h,p['color']):
                occlusions.append({'frame':frame,'coveredColor':color,'visibleLaterColor':p['color'],'encodedLaterColorPresent':True});return True
        return False
    def neutral_muted_front(data,x,y,scene,frame):
        # H.264 4:2:0 may neutralize a thin gray cap's chroma. Accept only palette-near
        # pixels at the unchanged 3 px position, isolated from other series and grid/ink.
        other=[distance_to_segment(x,y,a,b) for a,b in scene['segments'] if a['color']!='muted']
        other += [math.hypot(p['x']-x,p['y']-y) for p in scene['points'] if p['color']!='muted']
        if scene['origin'] is not None:other.append(abs(x-scene['origin']))
        for e in scene['beat']['props']['elements']:
            if e.get('type')=='line' and e.get('stroke')!='muted' and all(k in e for k in ['x1','y1','x2','y2']):
                other.append(distance_to_segment(x,y,{'x':e['x1']*scale,'y':e['y1']*scale},{'x':e['x2']*scale,'y':e['y2']*scale}))
        clearance=min(other,default=float('inf'))
        if clearance<=6:return False
        target=tuple(bytes.fromhex(job['theme']['muted'].lstrip('#')))
        for yy in range(max(0,round(y)-3),min(h,round(y)+4)):
            for xx in range(max(0,round(x)-3),min(w,round(x)+4)):
                rgb=list(data[(yy*w+xx)*3:(yy*w+xx)*3+3])
                if min(rgb)>75 and max(abs(a-b) for a,b in zip(rgb,target))<=28:
                    chroma_proofs.append({'frame':frame,'x':x,'y':y,'pixel':[xx,yy],'rgb':rgb,'paletteRGB':list(target),'maxChannelDistance':max(abs(a-b) for a,b in zip(rgb,target)),'otherGeometryClearancePx':clearance,'positionTolerancePx':3});return True
        return False
    proc=subprocess.Popen(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',f'fps=2:start_time=0,scale={w}:{h}','-filter_threads','2','-pix_fmt','rgb24','-f','rawvideo','-'],stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    while True:
        data=proc.stdout.read(size)
        if not data:break
        assert len(data)==size;absolute=frames/2;frames+=1
        for scene in scenes:
            beat=scene['beat'];t=absolute-beat['start_frame']/job['fps']
            if t<.5 or t>beat['frames']/job['fps']-.5:continue
            for p in scene['points']:
                if t<p['at']+.3:continue
                if mark(data,p['x'],p['y'],w,h,p['color']):points+=1
                elif covered(data,p['x'],p['y'],p['color'],p['series'],t,scene,round(absolute*job['fps'])):excluded+=1
                else:points+=1;failures.append({'kind':'point','beat':beat['id'],'t':t,'point':p})
            for gap in scene['gaps']:
                gapchecks+=1
                # The scenario-region text occupies the top of the plot; exclude only that label strip.
                top=gap['top']+(job['width']*.025*1.7*scale if scene['origin'] else 4)
                if any(mark(data,gap['x'],yy,w,h,gap['color'],radius=1) for yy in range(math.ceil(top),math.floor(gap['bottom'])-3,4)):
                    failures.append({'kind':'gap','beat':beat['id'],'t':t,'gap':gap})
            if t<5.2:continue
            for poly in scene['polys']:
                for u in [.25,.5,.75]:
                    x=poly[0][0]*(1-u)+poly[3][0]*u;low=poly[0][1]*(1-u)+poly[3][1]*u;high=poly[1][1]*(1-u)+poly[2][1]*u
                    for v in [.25,.75]:
                        yy=low*(1-v)+high*v
                        if abs(high-low)<12 or any(distance_to_segment(x,yy,a,b)<5 for a,b in scene['segments']):continue
                        bandchecks+=1
                        if not mark(data,x,yy,w,h,'band',radius=1):failures.append({'kind':'band','beat':beat['id'],'t':t,'x':x,'y':yy})
            if c['recipe']=='C12':
                # In the complete-set quantile example, any null date must also lack shading.
                for gap in scene['gaps']:
                    bandgaps+=1
                    if any(mark(data,gap['x'],yy,w,h,'band',radius=1) for yy in range(math.ceil(gap['top'])+4,math.floor(gap['bottom'])-3,4)):
                        failures.append({'kind':'band-gap','beat':beat['id'],'t':t,'x':gap['x']})
    err=proc.stderr.read().decode();assert proc.wait()==0,err
    assert frames==round(job['frames']/job['fps']*2)
    chosen=[(s,s['beat']['start_frame']+round(t*job['fps'])) for s in scenes for t in [1.1,2.1,3.1,4.1]]
    filt='select='+ '+'.join(f'eq(n\\,{frame})' for _,frame in chosen)+f',scale={w}:{h}'
    data=subprocess.check_output(['ffmpeg','-v','error','-threads','2','-i',str(out/'video.mp4'),'-vf',filt,'-filter_threads','2','-vsync','0','-pix_fmt','rgb24','-f','rawvideo','-'])
    assert len(data)==size*len(chosen)
    for fi,(scene,frame) in enumerate(chosen):
        t=(frame-scene['beat']['start_frame'])/job['fps'];pixels=data[fi*size:(fi+1)*size]
        for a,b in scene['segments']:
            if not a['at']+.08<t<b['at']-.08:continue
            q=(t-a['at'])/(b['at']-a['at']);x=a['x']+(b['x']-a['x'])*q;y=a['y']+(b['y']-a['y'])*q
            if mark(pixels,x,y,w,h,a['color']):fronts+=1
            elif covered(pixels,x,y,a['color'],a['series'],t,scene,frame):excluded+=1
            elif a['color']=='muted' and neutral_muted_front(pixels,x,y,scene,frame):fronts+=1
            else:fronts+=1;failures.append({'kind':'front','frame':frame,'x':x,'y':y,'color':a['color']})
    report={'project':name,'videoSha256':sha(out/'video.mp4'),'storyboardSha256':sha(project/'storyboard.json'),'nativeMappingChecks':native,'sampledFrames':frames+len(chosen),'pointChecks':points,'frontChecks':fronts,'missingColumnChecks':gapchecks,'bandInteriorChecks':bandchecks,'missingBandChecks':bandgaps,'occludedSamplesExcluded':excluded,'occlusionProofs':occlusions,'neutralMutedFrontProofs':chroma_proofs,'failures':len(failures),'firstFailures':failures[:8],'scope':'Independent chronology/maturity/empirical-rank formulas and native coordinates. 2Hz points, gaps and settled band interiors; four exact source-frame linear fronts per chart. Three-pixel point tolerance at width 720; not a full pixel census or continuous playback.'}
    reports.append(report);print(json.dumps({k:v for k,v in report.items() if k!='occlusionProofs'}),flush=True)
target=ROOT/'build/encoded-checks.json'
if selected and target.exists():reports += [r for r in json.loads(target.read_text()) if r['project'] not in selected]
target.write_text(json.dumps(sorted(reports,key=lambda r:r['project']),indent=2)+'\n')
assert not any(r['failures'] for r in reports)
