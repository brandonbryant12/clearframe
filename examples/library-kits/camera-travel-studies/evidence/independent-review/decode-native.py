import pathlib,subprocess,json,hashlib
HERE=pathlib.Path(__file__).resolve().parent;KIT=HERE.parents[1]
names=[a+'-'+b for a in ['another-view','partial-route','partial-summary','side-connection'] for b in ['landscape','vertical']];times=[.1,1.2,1.4,3.6,5.8,6.1,7.966667,8.033333,8.3,12.,17.9];rows=[]
for name in names:
 video=KIT/'evidence'/name/'video.mp4';out=HERE/'native-frames'/name;out.mkdir(parents=True,exist_ok=True);frames=[]
 for sec in times:
  p=out/f'{sec:g}s.png';subprocess.run(['ffmpeg','-nostdin','-hide_banner','-loglevel','error','-y','-threads','1','-ss',str(sec),'-i',str(video),'-frames:v','1','-vf','scale=360:-2','-threads','1',str(p)],check=True);frames.append({'time':sec,'path':str(p.relative_to(KIT)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 rows.append({'name':name,'videoSha256':hashlib.sha256(video.read_bytes()).hexdigest(),'width':360,'frames':frames,'visuallyInspected':False})
(HERE/'native-frames.json').write_text(json.dumps(rows,indent=2)+'\n');print('Decoded',sum(len(r['frames']) for r in rows),'native frames.')
