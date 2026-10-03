// Declared choices for existing examples, not a production-use history.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
import {repoRoot,catalog} from '../../engine/lib/library-browser.mjs';
import {validateLedger} from '../../engine/lib/variation-ledger.mjs';
const data=await catalog(),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const ledgerPath=path.join(path.dirname(fileURLToPath(import.meta.url)),'example-ledger.json');
const previous=fs.existsSync(ledgerPath)?validateLedger(JSON.parse(fs.readFileSync(ledgerPath,'utf8'))).entries:[];
const recordedAt=new Date().toISOString();
const entries=[
 ['physical-mechanisms/water-transfer',{mechanisms:['Reservoir and gate'],materials:['Porcelain, graphite and transparent panels'],camera:['Fixed orthographic'],story:['Separate, open, transfer, isolate']},'Reuses the same authored reservoir as resource access; a new subject does not imply a new physical model.'],
 ['physical-mechanisms/resource-release',{mechanisms:['Reservoir and gate'],materials:['Porcelain, graphite and transparent panels'],camera:['Fixed orthographic'],story:['Separate, open, transfer, isolate']},'Example of intentional reuse with a different explanatory subject.'],
 ['camera-studies/shared-infrastructure',{mechanisms:['Connected manifold'],materials:['Mineral and ceramic'],camera:['Detail-to-system dolly'],story:['Reveal the system around one junction']},'Apparent pipe size and perspective do not encode measured amounts.'],
 ['time-series-studies/slower-expansion',{mechanisms:['Linked dated panels'],materials:['Native lines and type'],camera:['Fixed quantitative view'],story:['Separate level, growth and change in growth']},'One date coordinate links three different units; the fictional growth rate falls while the level rises.'],
].map(([asset,choices,note])=>{const r=data.records.find(r=>r.id===asset),source=r.variants[0].source,bytes=fs.readFileSync(path.join(repoRoot,source)),project=path.posix.dirname(source),storyboardSha256=hash(bytes),id=hash(JSON.stringify({project,storyboardSha256,choices}));return{id,title:r.title,project,storyboardSha256,choices,note,assets:[asset,...r.inventoryIds],recordedAt:previous.find(e=>e.id===id)?.recordedAt??recordedAt};});
fs.writeFileSync(ledgerPath,JSON.stringify(validateLedger({schemaVersion:1,kind:'examples',title:'Example decisions',entries}),null,2)+'\n');
