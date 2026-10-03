// Bounded endpoint studies before any motion render. Caller supplies codex-heavy.
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {renderSculpture} from '../../../engine/lib/sculptures.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const suffix=process.argv[2]??'v1';
const ids=process.argv.slice(3);if(!ids.length)ids.push('linked-system','hero-field','focus-depth');
for(const id of ids)for(const preset of ['landscape','vertical'])for(const [pose,pos] of [['opening',0],['ending',1]]){
 const out=path.join(root,'build',`look-${id}-${preset}-${pose}-${suffix}`);
 const r=await renderSculpture(id,out,{draft:true,still:true,vertical:preset==='vertical',pos});
 console.log(JSON.stringify({id,preset,pose,status:r.status,poster:path.join(out,'poster.png')}));
}
