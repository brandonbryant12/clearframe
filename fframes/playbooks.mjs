import fs from 'node:fs';
import path from 'node:path';
import { BLOCKS, blockByName, palette } from './catalog.mjs';
import { writeJSON, ffmpeg } from '../engine/lib/util.mjs';

const beat = (block, vo, props = {}) => ({ id: block, block, vo, props: { ...structuredClone(blockByName(block).example), ...props } });
const end = beat('endcard','Choose one next step, and make its owner clear.');
const p = (id, title, audience, inputs, beats, options={}) => ({id,title,audience,inputs,beats,...options});
export const PLAYBOOKS = [
  p('concept-explainer','Explain a mechanism','A curious beginner','One concept, an example, a caveat',[
    beat('title','Headroom helps a system absorb the unexpected.',{text:'Why headroom matters'}),
    beat('equation','Subtract demand from capacity. What remains is headroom.'),
    beat('waffle','Imagine seventy of a hundred slots are already occupied.'),
    beat('callout','An average can hide the moments when demand spikes.'),end]),
  p('quarterly-update','Report progress with context','A team or leadership group','Comparable metrics, dates, denominators, decisions',[
    beat('title','This sample update follows the work from demand to response.',{text:'The quarter in context'}),
    beat('kpis','In this illustrative quarter, requests grew while response time fell.'),
    beat('line','The sample trend increased over six months.'),
    beat('delta','First response fell from four point two days to one point eight days.'),end]),
  p('decision-memo','Make a trade-off explicit','Decision makers','Two options, consistent criteria, recommendation',[
    beat('title','A useful decision starts with the criteria.',{text:'Choose the next approach'}),
    beat('compare','Large releases concentrate coordination. Smaller releases shorten feedback.'),
    beat('matrix','Compare setup effort, iteration, and control together.'),
    beat('callout','Prefer the option that is easier to test and reverse.',{label:'Recommendation',text:'Run a small, reversible trial.'}),end]),
  p('research-summary','Separate a finding from its limits','An informed general audience','Source, method, result, uncertainty',[
    beat('title','Start with the question, then show what the evidence can support.',{text:'What does the evidence say?'}),
    beat('steps','Define the sample, compare the outcomes, and check the limitations.',{items:[{title:'Sample',detail:'Who was included?'},{title:'Method',detail:'What was compared?'},{title:'Limits',detail:'What remains uncertain?'}]}),
    beat('bars','These illustrative categories use the same baseline and units.'),
    beat('callout','A difference is not enough to establish its cause.',{text:'Describe the uncertainty alongside the result.'}),end]),
  p('incident-review','Explain an incident without blame','Operators and stakeholders','Verified timeline, impact, mitigation, follow-up',[
    beat('title','This fictional incident review follows detection through recovery.',{text:'From detection to recovery'}),
    beat('timeline','The team detected the issue, contained it, and verified recovery.'),
    beat('steps','Find the trigger, describe the mechanism, and test the safeguard.',{items:[{title:'Trigger',detail:'What changed?'},{title:'Mechanism',detail:'How did it spread?'},{title:'Safeguard',detail:'How will we know?'}]}),
    beat('list','Assign an owner, set a verification date, and close the loop.'),end],{theme:'ink'}),
  p('product-walkthrough','Show a workflow and its payoff','A prospective user','User problem, real steps, proof of outcome',[
    beat('title','Turn a request into a clear next action.',{text:'A clearer handoff'}),
    beat('statement','A request stalls when the next owner is unclear.'),
    beat('steps','Capture the need, route it to an owner, and confirm the outcome.'),
    beat('compare','Compare the handoff before and after the workflow change.'),end],{theme:'signal'}),
  p('vertical-short','One idea for a small screen','A social audience','One claim, one example, one takeaway',[
    beat('statement','Busy is not the same as effective.'),
    beat('bars','In this illustrative workflow, routing takes the most time.'),
    beat('endcard','Start where the work waits.',{text:'Measure the wait.',action:'Choose one handoff to improve.'})],{format:'vertical',captions:true,motion:'snappy'}),
  p('speech-story','Let speech drive the typography','Viewers watching with or without sound','A recording, exact transcript, measured word timestamps',[
    beat('kinetic','Make every word land exactly when you hear it.',{mode:'highlight',maxWords:6}),
    beat('kinetic','Give the next thought room to breathe.',{mode:'reveal',maxWords:5}),
    beat('kinetic','Then make the next step clear.',{mode:'word',maxWords:4})],{format:'vertical',theme:'ink',captions:false}),
  p('myth-buster','Correct a misconception','An audience with a common assumption','Myth, evidence, correction, caveat',[
    beat('statement','A high average does not mean every case is fast.',{text:'Does a good average mean everyone is served?'}),
    beat('bars','Different stages can hide very different waits.'),
    beat('callout','Measure the tail as well as the center.',{label:'The correction',text:'Averages need context.'}),end],{theme:'editorial'}),
  p('tutorial','Teach a repeatable procedure','A learner performing a task','Prerequisites, ordered steps, expected result',[
    beat('title','Build a small experiment you can verify.',{text:'A repeatable experiment'}),
    beat('list','Choose one metric, record a baseline, and name an owner.'),
    beat('steps','Make one change, measure it, and compare the result.',{items:[{title:'Change',detail:'One variable'},{title:'Measure',detail:'Same window'},{title:'Compare',detail:'Same definition'}]}),
    beat('callout','A result is useful only when you can reproduce it.',{text:'Record the conditions, not just the outcome.'}),end]),
  p('customer-story','Connect a problem to a concrete outcome','Prospective customers','Attributed story, workflow, verified before and after',[
    beat('quote','The best handoff is the one nobody has to chase.'),
    beat('statement','The team needed a clearer owner for each request.',{text:'One request. One clear owner.'}),
    beat('steps','Capture, route, resolve, and verify.'),
    beat('delta','This hypothetical example reduces response time from four point two to one point eight days.'),end],{theme:'editorial'}),
  p('documentary-hybrid','Ground a story in a brief visual insert','A broad audience','Verified story, optional reference plate, continuity brief',[
    beat('title','Use a visual moment to establish place, then return to the evidence.',{text:'A story with a sense of place'}),
    beat('statement','Keep the visual language consistent across every scene.',{text:'Carry one visual language through the film.'}),
    beat('quote','The best handoff is the one nobody has to chase.'),
    beat('timeline','Follow the sequence before drawing a conclusion.'),end],{theme:'editorial',note:'Replace the second beat with a 3–5 second image/video insert when it adds context. See docs/continuity.md; no paid asset is generated by scaffolding.'}),
  p('science-lesson','Follow a question through an experiment','Students and curious families','A question, controlled comparison, observations and a trusted subject source',[
    beat('title','What could we learn by watching a seed?',{text:'Start with a small question',support:'An observation lesson, built around your own evidence.'}),
    beat('icon-grid','Gather a seed, a notebook, and a way to record what changes.',{title:'Build an observation kit',items:[{icon:'sprout',label:'A subject',detail:'Choose what to observe'},{icon:'book-open',label:'A notebook',detail:'Record the conditions'},{icon:'camera',label:'A record',detail:'Keep the framing consistent'}]}),
    beat('flow','Ask a question, make a prediction, observe, and compare.',{title:'Show how an idea is tested',nodes:[{icon:'lightbulb',label:'Ask'},{icon:'pencil',label:'Predict'},{icon:'microscope',label:'Observe'},{icon:'book-open',label:'Compare'}]}),
    beat('callout','A prediction and an observation are different things.',{label:'Think like a scientist',text:'Separate what you expected from what you saw.',support:'Use the actual observations in your final film.'}),
    beat('endcard','What question would you test next?',{text:'Keep the question open.',support:'One observation can lead to another.',action:'Write your next question.'})],{theme:'signal'}),
  p('cooking-guide','Teach a recipe through preparation and visible checkpoints','Home cooks','Your tested recipe, ingredient quantities, steps and real result images',[
    beat('title','A good recipe shows what to look for, not just what to do.',{text:'Make a simple herb sauce',support:'Replace this outline with your own tested recipe.'}),
    beat('icon-grid','Set out the ingredients and tools before you begin.',{title:'Get everything ready',items:[{icon:'leaf',label:'Fresh herbs',detail:'Use your recipe quantities'},{icon:'utensils',label:'Mixing bowl',detail:'Keep the work area ready'},{icon:'chef-hat',label:'Your base',detail:'Choose a tested recipe'}]}),
    beat('flow','Prepare the herbs, combine the ingredients, then taste and adjust.',{title:'Watch the texture change',nodes:[{icon:'leaf',label:'Prepare',detail:'Show the cut or chop'},{icon:'utensils',label:'Combine',detail:'Show the consistency'},{icon:'check',label:'Adjust',detail:'Describe your result'}]}),
    beat('endcard','Save the version you want to make again.',{text:'Make it your own.',support:'Record the quantities and the result.',action:'Add your tested variations.'})],{theme:'editorial',note:'Replace one beat with a real close-up when texture matters. Use authored steps and source footage rather than generated instructions or fabricated results.'}),
  p('travel-story','Tell a small story about a place','Friends, family and curious travelers','Your route, personal observations, permission-cleared photos and accurate place names',[
    beat('title','Tell the story of a day through the details you noticed.',{text:'An afternoon worth remembering',support:'A fictional itinerary to replace with your own trip.'}),
    beat('timeline','Start with the first stop, then follow the day as it happened.',{title:'A day at walking pace',items:[{label:'Morning',title:'A quiet street',detail:'What first caught your eye?'},{label:'Afternoon',title:'A favorite corner',detail:'One detail worth keeping'},{label:'Evening',title:'The way back',detail:'What changed by the end?'}]}),
    beat('icon-grid','A sound, a color, and a small encounter can carry a place.',{title:'Keep the details',items:[{icon:'music',label:'A sound'},{icon:'palette',label:'A color'},{icon:'map-pin',label:'A place'}]}),
    beat('quote','Replace this with a real memory in your own words.',{text:'One small detail brought the whole afternoon back.',author:'Fictional sample recollection',role:'Replace with your own memory'}),
    beat('endcard','What will you remember from your next walk?',{text:'Bring back a detail.',support:'Use your own photos, recordings and words.',action:'Keep a small travel journal.'})],{theme:'editorial',note:'Insert your own image/video plates between native scenes. Generated establishing shots must be labelled illustrative; do not present them as footage of your trip.'}),
  p('language-practice','Listen, follow the words, then try the phrase','Language learners','A reviewed recording, exact transcript, measured word timings and a checked translation',[
    beat('title','Listen once. Then follow the words as you hear them.',{text:'Hear it. See it. Try it.',support:'Use a reviewed recording in your chosen language.'}),
    beat('kinetic','Where is the train station?',{mode:'highlight',align:'center',maxWords:6}),
    beat('callout','Pause the video and try the phrase yourself.',{label:'Your turn',text:'Say the phrase in your own voice.',support:'Replay the recording and compare.'}),
    beat('kinetic','Where is the train station?',{mode:'reveal',align:'center',maxWords:6}),
    beat('endcard','Try using the phrase in a different situation.',{text:'Make it useful.',support:'Change one word and check the meaning.',action:'Practice another short exchange.'})],{format:'vertical',theme:'ink',note:'Use measured timing in the target language. Check font glyph coverage and pronunciation; do not infer those from a successful render.'}),
  p('personal-story','Make a keepsake from a meaningful moment','Friends and family','Personal memories, names, dates and permission-cleared recordings or photos',[
    beat('title','Some stories begin with a moment you almost missed.',{text:'The moment I kept',support:'A personal story told in your own voice.'}),
    beat('quote','Replace this fictional line with the memory you want to preserve.',{text:'I did not know it would become my favorite memory.',author:'Fictional sample narrator',role:'Replace with your own words'}),
    beat('timeline','Show what came before, what happened, and what stayed with you.',{title:'Give the moment context',items:[{label:'Before',title:'An ordinary day',detail:'Set the scene'},{label:'The moment',title:'Something changed',detail:'Describe one concrete detail'},{label:'After',title:'What stayed',detail:'Say why it matters'}]}),
    beat('kinetic','This is the part I want to remember.',{mode:'highlight',maxWords:5}),
    beat('endcard','Keep the story in your own words.',{text:'A small story, kept.',support:'Add the date and the people who shared it.',action:'Save it for someone you love.'})],{theme:'editorial'}),
  p('creative-process','Show how a work develops through iteration','Artists, makers and creative learners','A real work in progress, process images and reflections',[
    beat('statement','The first version is a place to start.',{text:'Make room for a rough first version.',support:'Show the work as it changes.'}),
    beat('cycle','Imagine, make, observe, and refine.',{title:'Let the work teach you',period:8}),
    beat('compare','Compare the intention with what the draft actually does.',{title:'Look closely at the draft',left:{title:'What I intended',items:['A clear focal point','A quiet mood']},right:{title:'What I noticed',items:['Too many competing shapes','A color worth keeping']},verdict:'Illustrative critique — replace with your own observations.'}),
    beat('endcard','Choose one change and make another version.',{text:'Try the next version.',support:'Keep the earlier draft so you can see the change.',action:'Revise one thing.'})],{theme:'ink'}),
  p('quiet-moment','Create a gentle paced visual break','Anyone who wants a brief pause','Preferred phase labels, comfortable timing and an optional original soundtrack',[
    beat('title','Take a moment at your own pace.',{text:'A little room to pause',support:'Follow the visual only if the pace feels comfortable.'}),
    {id:'breathing',block:'breathing',duration:28,props:{...structuredClone(blockByName('breathing').example),title:'Find your own rhythm',source:'Optional visual pacing · no health claim'}},
    beat('endcard','Return when you are ready.',{text:'Continue at your own pace.',support:'A small pause can simply be a pause.',action:''})],{theme:'ink',motion:'gentle',note:'Phase durations are editable. This is a visual pacing exercise, not a therapeutic protocol or a promised health outcome.'}),
];

export function storyboardFor(id,{title,theme,vertical}={}) {
  const book=PLAYBOOKS.find(p=>p.id===id);if(!book)throw new Error(`Unknown playbook ${id}`);
  const sb={version:2,title:title??book.title,logline:book.title,format:{preset:vertical?'vertical':book.format??'landscape',fps:30},theme:theme??book.theme??'paper',motion:{preset:book.motion??'gentle',intensity:0.65},transition:'fade',backdrop:'none',chrome:false,captions:book.captions??false,music:false,sources:[{id:'sample',title:'Hypothetical sample data and fictional quotations — replace before publishing'}],continuity:{maxGeneratedShare:0.2,treatment:'Restrained editorial graphics, generous space, no generated text',camera:'Locked or a slow push',lighting:'Soft, diffuse',motion:'Slow left-to-right movement'},beats:structuredClone(book.beats)};
  const ids=new Map();for(const b of sb.beats){const n=(ids.get(b.id)??0)+1;ids.set(b.id,n);if(n>1)b.id+=`-${n}`;}
  palette(sb.theme);return sb;
}
export function scaffold(dir,options={}) {
  if(fs.existsSync(dir)&&fs.readdirSync(dir).length)throw new Error(`${dir} is not empty`);
  const id=options.playbook??options.recipe??'concept-explainer',sb=storyboardFor(id,options),book=PLAYBOOKS.find(p=>p.id===id);
  fs.mkdirSync(dir,{recursive:true});writeJSON(path.join(dir,'storyboard.json'),sb);
  fs.writeFileSync(path.join(dir,'BRIEF.md'),`# ${sb.title}\n\nPlaybook: ${id}\nAudience: ${book.audience}\nRequired inputs: ${book.inputs}\n\n${book.note??''}\n\nReplace all sample claims and sources. Choose a palette and motion intensity in storyboard.json. The playbook is a starting structure: add, remove or reorder native blocks to serve the story.\n`);
  return sb;
}
export async function writeGallery(dir,{vertical=false,theme='paper',only}={}) {
  if(fs.existsSync(path.join(dir,'storyboard.json')))throw new Error('Gallery destination already contains a storyboard; choose a fresh directory.');
  const colors=palette(theme);fs.mkdirSync(path.join(dir,'assets'),{recursive:true});
  await ffmpeg(['-y','-f','lavfi','-i',`color=c=${colors.surface}:s=960x540:r=30:d=4`,'-vf',`drawbox=x=100:y=120:w=240:h=240:color=${colors.accent}:t=fill`,'-an','-c:v','libx264','-threads','1','-pix_fmt','yuv420p',path.join(dir,'assets/demo.mp4')]);
  await ffmpeg(['-y','-i',path.join(dir,'assets/demo.mp4'),'-frames:v','1','-threads','1',path.join(dir,'assets/demo.png')]);
  const sb=storyboardFor('concept-explainer',{theme,vertical});sb.title='Native building blocks';
  sb.beats=BLOCKS.filter(b=>!only||only.includes(b.name)).map(b=>({id:b.name,block:b.name,duration:b.name==='kinetic'?6:b.name==='breathing'||b.name==='cycle'?8:4,...(b.vo?{vo:b.vo}:{}),props:{...structuredClone(b.example),...(b.name==='image'?{file:'assets/demo.png'}:{})}}));
  writeJSON(path.join(dir,'storyboard.json'),sb);return sb;
}
