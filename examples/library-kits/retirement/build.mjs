import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {cases} from './source/fixtures.mjs';
import {buildCase} from './source/recipes.mjs';
import {loadStoryboard} from '../../../engine/lib/project.mjs';
import {computeTiming} from '../../../engine/lib/timing.mjs';
import {createJob} from '../../../fframes/job.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const write=(file,value)=>fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');
const recipes=[...new Set(cases.map(c=>c.recipe))],audit=[];
for(const recipe of recipes)for(const preset of ['landscape','vertical']){
  const fixtures=cases.filter(c=>c.recipe===recipe),built=fixtures.map(c=>buildCase(c,preset));
  const sb={title:`${recipe}: retirement mechanism specimens`,format:{preset,fps:30},theme:'paper',type:'geometric',
    motion:{preset:'gentle',intensity:.35},backdrop:'none',transition:'cut',captions:false,music:false,sfx:'off',
    sources:fixtures.map(c=>({claim:`${c.id}: all amounts, rules and outcomes are fictional illustrations.`,source:'source/fixtures.mjs; audit.json',asOf:c.asOf})),
    beats:built.flatMap(b=>b.beats)};
  const rel=`specimens/${recipe.toLowerCase()}-${preset}`;
  fs.mkdirSync(path.join(root,rel),{recursive:true});write(`${rel}/storyboard.json`,sb);
  const job=createJob(loadStoryboard(path.join(root,rel)),computeTiming(path.join(root,rel)),{draft:true});
  if(job.errors.length)throw Error(`${rel}: ${job.errors.join('; ')}`);
  audit.push({recipe,preset,project:rel,sourceChecks:{errors:job.errors,warnings:job.warnings},cases:built.map(({beats,...result})=>result)});
}
write('inputs.json',cases);write('audit.json',{modelVersion:1,inputsSha256:crypto.createHash('sha256').update(JSON.stringify(cases)).digest('hex'),results:audit});
console.log(JSON.stringify({recipes:recipes.length,fixtures:cases.length,projects:audit.length,sourceErrors:0}));
