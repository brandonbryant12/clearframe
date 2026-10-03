// Negative integration fixtures: camera matrices stay fixed while focus moves.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(root,'../../..');
const config=JSON.parse(fs.readFileSync(path.join(root,'media/focus-depth-landscape/render-config.json')));
const reports=[];
for(const kind of ['hold','loop']){
 const out=path.join(root,'build',`negative-optics-${kind}`);if(fs.existsSync(out))throw Error('Use a fresh negative-fixture directory');fs.mkdirSync(out,{recursive:true});
 const c=structuredClone(config);c.out=out;c.sourceRoot=path.join(root,'media/focus-depth-landscape/source');c.sceneFile=path.join(c.sourceRoot,'focus-depth.py');c.still=true;
 if(kind==='hold'){c.motion.phases[0].endFrame=120;}else{c.loop=true;}
 const file=path.join(out,'render-config.json');fs.writeFileSync(file,JSON.stringify(c,null,2)+'\n');
 fs.copyFileSync(file,path.join(root,'evidence',`negative-optics-${kind}-config.json`));
 const render=path.join(c.sourceRoot,'render.py');
 const result=spawnSync(process.env.BLENDER_BIN||'blender',['--background','--factory-startup','--disable-autoexec','--threads','2','--python-exit-code','1','--python',render,'--','--config',file],{cwd:repo,encoding:'utf8',maxBuffer:4*1024*1024});
 const log=(result.stdout??'')+'\n'+(result.stderr??'');fs.writeFileSync(path.join(out,'result.log'),log);
 const expected=kind==='hold'?'Declared hold near has moving camera optics':'Loop camera optics fail to close';
 if(result.status===0||!log.includes(expected)||fs.existsSync(path.join(out,'scene.blend')))throw Error(`Optics guard ${kind} did not reject before rendering: ${log}`);
 const sourceHashes=Object.fromEntries(['render.py','artkit.py','camera_rig.py','focus-depth.py'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(c.sourceRoot,name))).digest('hex')]));
 reports.push({kind,rejected:true,expected,exitCode:result.status,sourceHashes,configSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),renderSha256:crypto.createHash('sha256').update(fs.readFileSync(render)).digest('hex'),noSceneOrPixelsRendered:true});
}
fs.writeFileSync(path.join(root,'evidence/optical-guards.json'),JSON.stringify(reports,null,2)+'\n');console.log(JSON.stringify(reports));
