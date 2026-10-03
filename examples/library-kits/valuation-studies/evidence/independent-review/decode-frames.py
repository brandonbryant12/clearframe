import pathlib,json,subprocess,hashlib
here=pathlib.Path(__file__).resolve().parent
kit=here.parents[1]
rows=json.loads((kit/'build/verification.json').read_text())
assert len(rows)==4
samples=[0.1,0.5,0.9,1.4,3,35.9,36.033333,36.3,36.7,37.8,39.9,71.9]
records=[]
for row in rows:
    video=kit/'evidence'/row['name']/'video.mp4'
    out=here/row['name'];out.mkdir(exist_ok=True)
    for sec in samples:
        p=out/f'{sec:g}s.png'
        subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','1','-ss',str(sec),'-i',str(video),'-frames:v','1','-vf','scale=360:-2','-threads','1',str(p)],check=True)
    records.append({'name':row['name'],'pipelineId':row['pipelineId'],'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'times':samples,'width':360,'frames':[{'path':str((out/f'{sec:g}s.png').relative_to(kit)),'sha256':hashlib.sha256((out/f'{sec:g}s.png').read_bytes()).hexdigest()} for sec in samples],'visuallyInspected':False})
(here/'frames.json').write_text(json.dumps(records,indent=2)+'\n')
print(json.dumps([{'name':r['name'],'pipelineId':r['pipelineId'],'frames':len(samples)} for r in records]))
