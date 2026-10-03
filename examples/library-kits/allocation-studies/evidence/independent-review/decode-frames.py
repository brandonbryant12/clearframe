import pathlib,json,subprocess,hashlib
here=pathlib.Path(__file__).resolve().parent
kit=here.parents[1]
rows=json.loads((kit/'build/verification.json').read_text())
audit=json.loads((kit/'audit.json').read_text())
records=[]
for row in rows:
    a=next(a for a in audit['results'] if a['name']==row['name'])
    clock=a['stages'][0]['clock'];cut=a['stages'][0]['duration'];duration=sum(s['duration'] for s in a['stages'])
    samples=[.1,clock['initialHold']-.1]
    for event in clock['events']:
        samples.extend([event['start']+.25*(event['end']-event['start']),event['end']+.1])
    samples.extend([cut-.1,cut+1/30,cut+.6,duration-.1])
    samples=sorted(set(round(t,6) for t in samples))
    video=kit/'evidence'/row['name']/'video.mp4'
    out=here/row['name'];out.mkdir(exist_ok=True)
    for sec in samples:
        p=out/f'{sec:g}s.png'
        subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','1','-ss',str(sec),'-i',str(video),'-frames:v','1','-vf','scale=360:-2','-threads','1',str(p)],check=True)
    records.append({'name':row['name'],'pipelineId':row['pipelineId'],'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'times':samples,'width':360,'duration':duration,'cut':cut,'frames':[{'path':str((out/f'{sec:g}s.png').relative_to(kit)),'sha256':hashlib.sha256((out/f'{sec:g}s.png').read_bytes()).hexdigest()} for sec in samples],'visuallyInspected':False})
(here/'frames.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps([{'name':r['name'],'pipelineId':r['pipelineId'],'frames':len(r['frames'])} for r in records]))
