// Regenerate public authoring references from the native vocabulary.
import fs from 'node:fs';
import { BLOCKS, THEMES, MOTIONS, TRANSITIONS, FRAME_RATES, markdownCatalog } from '../fframes/catalog.mjs';
import { PLAYBOOKS, storyboardFor } from '../fframes/playbooks.mjs';
const text={type:'string'},number={type:'number'},bool={type:'boolean'},object={type:'object'};
const motion={type:'object',additionalProperties:false,properties:{preset:{enum:MOTIONS},intensity:{type:'number',minimum:0,maximum:1}}};
const palette={type:'object',additionalProperties:false,properties:{base:{enum:Object.keys(THEMES)},...Object.fromEntries(Object.keys(THEMES.paper).map(k=>[k,{type:'string',pattern:'^#[0-9a-fA-F]{6}$'}]))}};
const schema={
  $schema:'https://json-schema.org/draft/2020-12/schema',title:'ClearFrame FFFrames storyboard',type:'object',required:['beats'],additionalProperties:false,
  properties:{
    $schema:text,version:{const:2},title:text,logline:text,audience:text,budget:{type:'number',minimum:0},
    format:{type:'object',additionalProperties:false,properties:{preset:{enum:['landscape','vertical','square','portrait']},width:{type:'integer'},height:{type:'integer'},fps:{enum:FRAME_RATES}}},
    theme:{oneOf:[{enum:Object.keys(THEMES)},palette]},motion,transition:{enum:[...TRANSITIONS,'auto']},backdrop:{enum:['none','dots','grid']},chrome:bool,captions:{enum:[true,false,'auto','off']},sfx:bool,
    voice:object,music:{oneOf:[{const:false},object]},mix:object,pacing:{type:'object',additionalProperties:false,properties:Object.fromEntries(['lead','tail','minBeat','silentBeat','outro'].map(k=>[k,{type:'number',minimum:0}]))},
    sources:{type:'array',items:{oneOf:[text,object]}},
    continuity:{type:'object',additionalProperties:false,properties:{maxGeneratedShare:{type:'number',minimum:0,maximum:1},treatment:text,lighting:text,camera:text,motion:text,motif:text,refs:{type:'array',maxItems:2,items:text}}},
    assets:{type:'array',items:{type:'object',required:['id','kind'],properties:{id:{type:'string',pattern:'^[a-zA-Z0-9][a-zA-Z0-9_-]*$'},kind:{enum:['image','clip','sfx']},file:text,prompt:text,model:text,refs:{type:'array',items:text},seconds:{type:'number',exclusiveMinimum:0,maximum:10},resolution:text,aspect:text,previousInteractionId:text}}},
    beats:{type:'array',minItems:1,items:{type:'object',required:['id','block','props'],additionalProperties:false,properties:{id:{type:'string',pattern:'^[a-zA-Z0-9][a-zA-Z0-9_-]*$'},block:{enum:BLOCKS.map(b=>b.name)},vo:text,style:text,chapter:text,duration:{type:'number',exclusiveMinimum:0},lead:{type:'number',minimum:0},tail:{type:'number',minimum:0},hold:{type:'number',minimum:0},min:{type:'number',minimum:0},transition:{enum:[...TRANSITIONS,'auto']},motion,props:object,sfx:{type:'array',items:object}},allOf:BLOCKS.map(b=>({if:{properties:{block:{const:b.name}}},then:{properties:{props:{type:'object',additionalProperties:false,properties:Object.fromEntries(Object.entries(b.props).map(([key,description])=>[key,{description}]))}}}}))}}
  }
};
fs.writeFileSync('schema/storyboard.schema.json',JSON.stringify(schema,null,2)+'\n');
fs.writeFileSync('skills/clearframe-library/references/blocks.md',markdownCatalog());
for(const b of PLAYBOOKS){fs.mkdirSync(`recipes/${b.id}`,{recursive:true});fs.writeFileSync(`recipes/${b.id}/storyboard.json`,JSON.stringify(storyboardFor(b.id),null,2)+'\n');fs.writeFileSync(`recipes/${b.id}/BRIEF.md`,`# ${b.title}\n\nAudience: ${b.audience}\n\nInputs: ${b.inputs}\n\n${b.note??'Adapt this structure to the story; replace all illustrative claims and sources.'}\n`);}
fs.writeFileSync('recipes/README.md','# Narrative playbooks\n\nGenerated from fframes/playbooks.mjs. These are adaptable starting structures with illustrative content; replace claims and sources before publishing. Use `clearframe new DIR --playbook NAME`.\n\n'+PLAYBOOKS.map(b=>`- **${b.id}**: ${b.title}. Inputs: ${b.inputs}.`).join('\n')+'\n');
