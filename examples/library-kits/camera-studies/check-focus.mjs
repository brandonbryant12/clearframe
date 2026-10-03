// A bounded image-sharpness check of the same static objects before/after focus.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));const read=p=>JSON.parse(fs.readFileSync(path.join(root,p)));const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const runs=fs.existsSync(path.join(root,'build/verification.json'))?read('build/verification.json'):[];
const reports=[];
function energy(file,frame,roi){
 const [l,b,r,t]=roi;
 const result=spawnSync('ffmpeg',['-v','error','-threads','2','-filter_threads','2','-i',file,'-vf',`select=eq(n\\,${frame}),crop=iw*${r-l}:ih*${t-b}:iw*${l}:ih*${1-t},scale=128:128`,'-frames:v','1','-threads','2','-pix_fmt','gray','-f','rawvideo','-'],{maxBuffer:1024*1024});
 if(result.status!==0||result.stdout.length!==128*128)throw Error(result.stderr.toString());
 const p=result.stdout;let total=0,count=0;
 // Two-pixel differences damp isolated pixel noise while retaining engraved bars/ribs.
 for(let y=2;y<126;y++)for(let x=2;x<126;x++){const i=y*128+x;total+=(p[i+2]-p[i-2])**2+(p[i+256]-p[i-256])**2;count++;}
 return Math.sqrt(total/count);
}
const presets=process.argv.slice(2);if(!presets.length)presets.push('landscape','vertical');
for(const preset of presets){
 const mediaName=`focus-depth-${preset}`,geometry=read(`evidence/${mediaName}/camera.json`),file=path.join(root,`media/${mediaName}/clip.mp4`);
 if(sha(file)!==geometry.clipSha256)throw Error('Stale source check');
 const targets=[{name:mediaName,file,last:191},...runs.filter(r=>r.name.endsWith(preset)&&/^(surface-inspection|research-context)-/.test(r.name)).map(r=>({name:r.name,file:path.join(r.dir,'video.mp4'),last:299}))];
 for(const target of targets){
  const near=[0,target.last].map(f=>energy(target.file,f,geometry.focusRois.near));const far=[0,target.last].map(f=>energy(target.file,f,geometry.focusRois.far));
  const nearRatio=near[0]/near[1],farRatio=far[1]/far[0],passed=nearRatio>1.25&&farRatio>1.25;
  reports.push({name:target.name,videoSha256:sha(target.file),frames:[0,target.last],near,far,nearRatio,farRatio,threshold:1.25,passed,limitations:'RMS two-pixel grayscale gradient in projected panel regions after 128px scaling. Relative sharpness in these fixtures only; no physical optics calibration or subjective playback claim.'});
 }
}
fs.writeFileSync(path.join(root,'evidence/focus-sharpness.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports));if(reports.some(r=>!r.passed))throw Error('Encoded focus transfer failed');
