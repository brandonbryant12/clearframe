// Decode the native subject region to detect a restart or jump at the explicit still hold.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const read = p => JSON.parse(fs.readFileSync(p));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const runs = read(path.join(root, 'build/verification.json'));
const bindings = read(path.join(root, 'bindings.json')).bindings;
const reports = [];
for (const run of runs) {
  const b = bindings.find(b => b.name === run.name);
  const video = path.join(run.dir, 'video.mp4');
  const storyboard = path.join(root, 'specimens', run.name, 'storyboard.json');
  if (sha(storyboard) !== b.storyboardSha256) throw Error(`Stale binding: ${run.name}`);
  const geometry = read(path.join(root, 'evidence', b.mediaName, 'camera.json'));
  if (geometry.receiptSha256 !== sha(path.join(root,'media',b.mediaName,'receipt.json'))) throw Error(`Stale geometry: ${run.name}`);
  const [left, bottom, right, top] = [.08,.17,.92,.68];
  const filter = `crop=iw*${right-left}:ih*${top-bottom}:iw*${left}:ih*${1-top},scale=96:96`;
  const decoded = spawnSync('ffmpeg', ['-v', 'error', '-threads', '2', '-filter_threads', '2', '-i', video,
    '-vf', filter, '-threads', '2', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], { maxBuffer: 32*1024*1024 });
  if (decoded.status !== 0) throw Error(decoded.stderr.toString());
  const size = 96*96*3, count = decoded.stdout.length/size;
  if (count !== b.nativeFrames) throw Error(`Unexpected encoded frame count: ${run.name}: ${count}`);
  function difference(a, b) {
    let sum = 0;
    for(let i=0;i<size;i++) sum += Math.abs(decoded.stdout[a*size+i]-decoded.stdout[b*size+i]);
    return sum/size;
  }
  // Frame 225 is well inside the source hold; frame 240 begins the explicit still.
  const anchor = 225;
  const finalDifferences = Array.from({length:count-anchor},(_,i)=>difference(anchor,anchor+i));
  const maxHoldDifference = Math.max(...finalDifferences);
  const actionDifference = difference(0,anchor);
  const boundaryDifference = difference(239,240);
  // <0.5 channel levels permits codec variation inside the settled hold; the cut
  // must remain below 0.1 and action above 1. This is a bounded region check, not a physics test.
  const passed = maxHoldDifference < .5 && actionDifference > 1 && boundaryDifference < .1;
  reports.push({name:run.name,pipelineId:run.pipelineId??path.basename(run.dir),storyboardSha256:b.storyboardSha256,
    videoSha256:sha(video),sourceClipSha256:b.sourceClipSha256,heldImageSha256:b.heldImageSha256,holdClipSha256:b.holdClipSha256,
    geometrySha256:sha(path.join(root,'evidence',b.mediaName,'camera.json')),projectedBounds:[.08,.17,.92,.68],frames:count,anchorFrame:anchor,holdFramesChecked:count-anchor,
    maxHoldDifference,actionDifference,boundaryDifference,thresholds:{hold:.5,action:1,boundary:.1},passed,
    limitations:'Mean absolute RGB difference in a 96px subject crop; no subjective playback or exhaustive pixel identity claim.'});
}
fs.writeFileSync(path.join(root,'build/encoded-holds.json'),JSON.stringify(reports,null,2)+'\n');
console.log(JSON.stringify(reports.map(({name,passed,maxHoldDifference,actionDifference,boundaryDifference})=>({name,passed,maxHoldDifference,actionDifference,boundaryDifference}))));
if(reports.length!==8||reports.some(r=>!r.passed))throw Error('Incomplete or failed encoded reading holds');
