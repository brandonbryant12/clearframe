// The production native vocabulary. Metadata, validation, CLI help and examples share this file.
import { ICONS } from './icons.mjs';
export const THEMES = {
  paper: { bg: '#f5f3ed', surface: '#e9e7df', ink: '#222831', muted: '#616b76', accent: '#315cce', positive: '#17745c', negative: '#bd453c' },
  ink: { bg: '#101721', surface: '#1d2938', ink: '#f4f4ed', muted: '#a4b2c4', accent: '#76cbb8', positive: '#83d3ac', negative: '#f29a8a' },
  editorial: { bg: '#f7efe1', surface: '#ebddc6', ink: '#34281f', muted: '#74604e', accent: '#b13e2e', positive: '#477550', negative: '#b13e2e' },
  signal: { bg: '#edf3f8', surface: '#dce7f1', ink: '#102e46', muted: '#507089', accent: '#006dae', positive: '#187659', negative: '#bf493b' },
};
const common = { title: 'Scene headline', kicker: 'Short eyebrow', source: 'Visible attribution', land: 'Spoken word or local seconds', support: 'Supporting line' };
const sampleSource = 'Illustrative sample data · replace before publishing';
const b = (name, category, summary, props, example, extra = {}) => ({ name, category, summary, props: { ...common, ...props }, example: { ...example, source: example.source ?? sampleSource }, tail: 1.5, ...extra });
export const BLOCKS = [
  b('title', 'story', 'Open with a clear promise and a strong typographic hierarchy.', { text: 'Main promise' }, { kicker: 'Field notes', text: 'Make the next step clear', support: 'One idea, supported by evidence.' }),
  b('statement', 'story', 'A single editorial statement with a supporting line.', { text: 'Statement' }, { text: 'Busy is not the same as effective.', support: 'Measure the wait, not just the workload.' }),
  b('stat', 'numbers', 'A hero number with units, counted from a truthful starting value.', { value: 'Finite number', from: 'Starting value', prefix: 'Prefix', suffix: 'Units', decimals: '0–8', label: 'Meaning', context: 'Context' }, { value: 4.2, suffix: ' days', label: 'Median first response', context: 'From request to first answer.' }),
  b('kpis', 'numbers', 'Two to four comparable metrics with staggered entrances.', { items: '[{value,label,prefix,suffix,decimals,from,say}]' }, { title: 'The quarter in three numbers', items: [{ value: 12400, label: 'Requests' }, { value: 4.2, suffix: ' days', label: 'First response' }, { value: 91, suffix: '%', label: 'Satisfaction' }] }),
  b('bars', 'charts', 'Accurate zero-based comparison with a tunable focus.', { data: '[{label,value}] (2–8)', max: 'Positive scale maximum', format: '{prefix,suffix,decimals} or unit string', orientation: 'auto|horizontal|vertical', sort: 'none|desc', growSay: 'Growth cue', focus: '{label|index,say,dim,dur,note}' }, { title: 'Where the hours went', data: [{ label: 'Triage', value: 12 }, { label: 'Routing', value: 24 }, { label: 'Review', value: 8 }], format: ' h', focus: { label: 'Routing', dim: 0.55, note: 'Start here' } }),
  b('line', 'charts', 'A progressive time-series reveal on an explicit scale.', { series: '[number] or [{x,y}]', labels: '[string]', min: 'Scale minimum', max: 'Scale maximum', format: '{prefix,suffix,decimals} or units', drawSay: 'Reveal cue' }, { title: 'A trend worth watching', series: [12, 15, 14, 18, 23, 27], labels: ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], min: 0, max: 30, format: ' k' }),
  b('waffle', 'charts', 'Countable units for a share or probability.', { value: 'Highlighted units', total: 'Total units (1–100)', cols: 'Columns', label: 'Meaning' }, { title: 'Seven in ten', value: 70, total: 100, cols: 10, label: 'A forecast, not a guarantee' }),
  b('ring', 'charts', 'A single proportion with an exact counter and units.', { value: 'Numerator', max: 'Denominator', decimals: '0–8', label: 'Meaning' }, { title: 'Inside the target window', value: 82, max: 100, label: 'of incidents resolved' }),
  b('delta', 'numbers', 'Before and after with a correctly defined change.', { from: '{value,label}', to: '{value,label}', prefix: '', suffix: '', decimals: '0–8', change: 'Optional explicit change label' }, { title: 'A faster first response', from: { value: 4.2, label: 'Before' }, to: { value: 1.8, label: 'After' }, suffix: ' days' }),
  b('compare', 'decisions', 'Two approaches with matched criteria and a verdict.', { left: '{title,items:[string]}', right: '{title,items:[string]}', verdict: 'Decision' }, { title: 'Choose the right trade-off', left: { title: 'One large release', items: ['More coordination', 'Long feedback loop'] }, right: { title: 'Smaller releases', items: ['Frequent feedback', 'Lower change risk'] }, verdict: 'Prefer smaller, reversible steps.' }),
  b('steps', 'diagrams', 'A connected process revealed in sequence.', { items: '[{title,detail,say}] (2–5)' }, { title: 'From request to resolution', items: [{ title: 'Capture', detail: 'State the need' }, { title: 'Route', detail: 'Find the owner' }, { title: 'Resolve', detail: 'Confirm the outcome' }] }),
  b('timeline', 'diagrams', 'Events on an ordered rail with time labels.', { items: '[{label,title,detail,say}] (2–5)' }, { title: 'How the response unfolded', items: [{ label: '09:10', title: 'Detected', detail: 'Alert received' }, { label: '09:18', title: 'Contained', detail: 'Traffic rerouted' }, { label: '09:42', title: 'Recovered', detail: 'Service verified' }] }),
  b('funnel', 'charts', 'Decreasing stages on one comparable scale.', { items: '[{label,value}] (2–5)', format: '{prefix,suffix,decimals} or units' }, { title: 'Find the drop-off', items: [{ label: 'Visited', value: 1000 }, { label: 'Started', value: 620 }, { label: 'Finished', value: 440 }] }),
  b('quote', 'story', 'A sourced human voice with restrained emphasis.', { text: 'Quotation', author: 'Attribution', role: 'Context' }, { text: 'The best handoff is the one nobody has to chase.', author: 'Illustrative interview', role: 'Fictional quotation for this template' }),
  b('list', 'text', 'A short staged checklist or set of takeaways.', { items: '[string or {text,say}] (2–5)' }, { title: 'Three things to remember', items: ['Name the owner', 'Make the next step clear', 'Close the loop'] }),
  b('matrix', 'decisions', 'A compact comparison grid for two to four criteria.', { columns: '[string] (2–3)', rows: '[{label,values:[string]}] (2–4)' }, { title: 'Evaluate the whole workflow', columns: ['Option A', 'Option B'], rows: [{ label: 'Setup', values: ['Low', 'Medium'] }, { label: 'Iteration', values: ['Medium', 'Low'] }, { label: 'Control', values: ['Limited', 'High'] }] }),
  b('equation', 'diagrams', 'Build a simple relationship, then show its implication.', { expression: 'Formula', result: 'Result', explanation: 'Meaning' }, { title: 'Leave room for variation', expression: 'Capacity − demand', result: '= headroom', explanation: 'Headroom absorbs the unexpected.' }),
  b('callout', 'text', 'A framed correction, caveat or key insight.', { text: 'Insight', label: 'Label' }, { label: 'The caveat', text: 'An average can hide a long tail.', support: 'Look at the distribution before choosing a target.' }),
  b('endcard', 'story', 'A deliberate ending with an actionable next step.', { text: 'Final takeaway', action: 'Next step' }, { title: 'Make the next step smaller.', support: 'Start with one handoff this week.', action: 'Choose an owner. Measure the wait.' }),
  b('image', 'media', 'A real or generated plate inside the film’s graphic language.', { asset: 'Declared image asset id', file: 'Local image path', caption: 'Visible caption', label: 'Provenance label' }, { file: 'assets/demo.png', caption: 'A consistent palette connects the scenes.', label: 'Illustrative artwork' }),
  b('video', 'media', 'A short footage insert with native titles and a shared soundtrack.', { asset: 'Declared clip asset id', file: 'Local video path', caption: 'Visible caption', label: 'Provenance label', offset: 'Source in point in seconds' }, { file: 'assets/demo.mp4', caption: 'One continuous visual language', label: 'Illustrative footage', offset: 0 }),
  b('kinetic', 'speech', 'Speech-following words: highlight a phrase, reveal words, or show one at a time.', { mode: 'highlight|reveal|word', align: 'left|center', maxWords: 'Words per phrase (1–10)', maxGap:'Start a new phrase after this silence, 0–5 seconds (default 0.6)', maxDuration:'Maximum phrase span, 0.5–15 seconds (default 4); never split a timed word' }, { mode: 'highlight', align: 'left', maxWords: 6, source: '' }, { vo: 'Make every word land exactly when you hear it.' }),
  b('icon-grid', 'graphics', 'A paced composition of licensed vector icons, labels and optional details.', { items: '[{icon,label,detail?,say?}] (1–8)', columns: '1–4; automatic if omitted', stagger: 'Delay between arrivals, 0–2 seconds' }, { title: 'Pack for a curious afternoon', items: [{icon:'book-open',label:'Read',detail:'Bring a field guide'},{icon:'camera',label:'Notice',detail:'Record a small detail'},{icon:'compass',label:'Explore',detail:'Choose a new path'},{icon:'pencil',label:'Reflect',detail:'Keep a short note'}] }),
  b('flow', 'diagrams', 'Draw connections as a process unfolds; each node can follow a spoken cue.', { nodes: '[{icon?,label,detail?,say?}] (2–6)', orientation: 'auto|horizontal|vertical; portrait stays vertical', stagger: 'Delay between arrivals, 0–2 seconds' }, { title: 'From observation to explanation', nodes: [{icon:'leaf',label:'Notice',detail:'Start with a question'},{icon:'microscope',label:'Test',detail:'Change one thing'},{icon:'lightbulb',label:'Explain',detail:'Compare the evidence'}] }),
  b('cycle', 'diagrams', 'A repeating process with a moving marker on a continuous loop.', { nodes: '[{icon?,label}] (3–6)', period: 'Seconds per loop, 2–60', clockwise: 'true or false' }, { title: 'A creative practice', nodes: [{icon:'lightbulb',label:'Imagine'},{icon:'pencil',label:'Make'},{icon:'camera',label:'Observe'},{icon:'brush',label:'Refine'}], period: 8 }),
  b('breathing', 'motion', 'An expanding and contracting ring with explicit, editable phase durations.', { phases: '[{label,seconds,scale:expand|hold|contract}] (2–6)', minScale: 'Minimum relative radius, 0.2–1', maxScale: 'Maximum relative radius, 0.2–1, greater than minScale', ring: 'Show outer guide ring' }, { title: 'Take a quiet moment', phases: [{label:'Breathe in',seconds:3,scale:'expand'},{label:'Breathe out',seconds:4,scale:'contract'}], minScale:0.55,maxScale:1,ring:true,source:'Illustrative pacing · adjust to your comfort' }),
];
export const blockByName = name => BLOCKS.find(b => b.name === name);
export const MOTIONS = ['gentle', 'snappy', 'spring'];
export const TRANSITIONS = ['cut', 'fade', 'rise', 'wipe', 'push', 'zoom'];
export const CANVASES = [[1920,1080],[1080,1920],[1080,1080],[1080,1350],[640,360]];
export const FRAME_RATES = [24,25,30,50,60];
export const precision = value => { const [n,e='0'] = String(value).split(/e/i); return Math.min(8, Math.max(0, (n.split('.')[1]?.length ?? 0) - Number(e))); };

export function palette(theme = 'paper') {
  if (typeof theme === 'string') { if (!THEMES[theme]) throw new Error(`Unknown native theme ${theme}`); return { base: theme, ...THEMES[theme] }; }
  if (!theme || typeof theme !== 'object' || Array.isArray(theme)) throw new Error('theme must be a preset name or a palette object');
  const base = theme.base ?? 'paper';
  const result = palette(base);
  for (const [key,value] of Object.entries(theme)) {
    if (key === 'base') continue;
    if (!(key in THEMES.paper) || !/^#[\da-f]{6}$/i.test(value)) throw new Error(`theme.${key}: expected a palette color in #RRGGBB form`);
    result[key] = value;
  }
  return result;
}

export function normalizeProps(name, input = {}, { vertical = false } = {}) {
  const meta = blockByName(name);
  if (!meta) throw new Error(`No native block "${name}". Run clearframe blocks; legacy scenes need an explicit port.`);
  const p = structuredClone(input);
  const fail = message => { throw new Error(`${name}: ${message}`); };
  if (!p || typeof p !== 'object' || Array.isArray(p)) fail('props must be an object');
  for (const key of Object.keys(p)) if (!(key in meta.props)) fail(`unsupported prop ${key}`);
  const text = (v, field, max = 160) => { if (v != null && (typeof v !== 'string' || v.length > max)) fail(`${field} must be text up to ${max} characters`); };
  for (const key of ['title','kicker','source','support','text','label','context','caption','author','role','verdict','expression','result','explanation','action']) text(p[key],key, key === 'text' ? 240 : key === 'title' ? 90 : 160);
  const keys=(obj,allowed,field)=>{if(!obj||typeof obj!=='object'||Array.isArray(obj))fail(`${field} must be an object`);for(const k of Object.keys(obj))if(!allowed.includes(k))fail(`unsupported ${field}.${k}`);};
  const num = (n,key) => { if (!Number.isFinite(n)) fail(`${key} must be a finite number`); };
  const numeric = (obj,key) => { num(obj.value,`${key}.value`); if (obj.from != null) num(obj.from,`${key}.from`); obj.decimals ??= precision(obj.value); if (!Number.isInteger(obj.decimals) || obj.decimals < 0 || obj.decimals > 8) fail(`${key}.decimals must be 0–8`); text(obj.prefix,`${key}.prefix`,12); text(obj.suffix,`${key}.suffix`,16); };
  const list = (items,key,min,max) => { if (!Array.isArray(items) || items.length < min || items.length > max) fail(`${key} needs ${min}–${max} items`); };
  const format = () => { if (typeof p.format === 'string') p.format={suffix:p.format}; p.format ??= {}; if (!p.format || typeof p.format !== 'object' || Array.isArray(p.format)) fail('format must be an object or unit string'); for(const k of Object.keys(p.format)) if(!['prefix','suffix','decimals'].includes(k)) fail(`unsupported format.${k}`); if(p.format.decimals != null && (!Number.isInteger(p.format.decimals)||p.format.decimals<0||p.format.decimals>8)) fail('format.decimals must be 0–8'); text(p.format.prefix,'format.prefix',12);text(p.format.suffix,'format.suffix',16); };
  if (name === 'stat') numeric(p,'stat');
  if (name === 'kpis') { list(p.items,'items',2,4); p.items.forEach((it,i)=>{keys(it,['value','label','prefix','suffix','decimals','from','say'],`items[${i}]`);numeric(it,`items[${i}]`);text(it.label,'label',40);}); }
  if (name === 'bars') {
    list(p.data,'data',2,8); p.data.forEach(d=>{ keys(d,['label','value'],'data');text(d.label,'label',65); num(d.value,'value'); if(d.value<0) fail('bars require a zero-based nonnegative scale'); });
    if (!['none','desc',undefined].includes(p.sort)) fail('sort must be none or desc');
    if(p.sort==='desc') p.data.sort((a,b)=>b.value-a.value);
    const largest=Math.max(...p.data.map(d=>d.value)); p.max ??= largest*1.08 || 1;
    if(!Number.isFinite(p.max)||p.max<=0||p.max<largest) fail('max must be positive and cover every value');
    p.orientation ??= 'auto'; if(p.orientation==='auto') p.orientation=vertical||p.data.some(d=>d.label.length>12)||p.data.length>5?'horizontal':'vertical';
    if(!['horizontal','vertical'].includes(p.orientation)) fail('unknown orientation');
    format();p.format.decimals ??= Math.max(...p.data.map(d=>precision(d.value)));
    if(p.focus) { const f=p.focus;keys(f,['label','index','say','dim','dur','note'],'focus');text(f.note,'focus.note',100); f.index ??= p.data.findIndex(d=>d.label===f.label); if(!Number.isInteger(f.index)||!p.data[f.index]) fail('focus must select an existing label/index'); f.dim ??=0.28; f.dur ??=0.5; if(!Number.isFinite(f.dim)||f.dim<0||f.dim>1||!Number.isFinite(f.dur)||f.dur<0) fail('focus dim must be 0–1 and dur nonnegative'); }
  }
  if(name==='line') {
    list(p.series,'series',2,40);p.series=p.series.map((d,i)=>typeof d==='number'?{x:i,y:d}:d);
    p.series.forEach((d,i)=>{keys(d,['x','y'],'series');num(d.x,'series.x');num(d.y,'series.y');if(i&&d.x<=p.series[i-1].x)fail('x coordinates must increase');});
    p.min ??= Math.min(0,...p.series.map(d=>d.y)); p.max ??= Math.max(0,...p.series.map(d=>d.y))*1.1 || 1;
    if(!Number.isFinite(p.min)||!Number.isFinite(p.max)||p.max<=p.min||p.series.some(d=>d.y<p.min||d.y>p.max))fail('line scale must cover the data');
    if(p.labels){list(p.labels,'labels',2,40);if(p.labels.length!==p.series.length)fail('provide one label per point');p.labels.forEach(x=>text(x,'label',24));} format();p.format.decimals ??= Math.max(...p.series.map(d=>precision(d.y)));
  }
  if(name==='waffle'||name==='ring') { if(name==='ring')p.max ??=100;else p.total ??=100;num(p.value,'value');const max=name==='waffle'?p.total:p.max;if(!Number.isFinite(max)||max<=0||p.value<0||p.value>max)fail('value must lie between zero and total/max');if(name==='waffle'&&(!Number.isInteger(max)||max>100||!Number.isInteger(p.value)))fail('waffle counts must be integers up to 100');if(name==='waffle'){p.cols ??=10;if(!Number.isInteger(p.cols)||p.cols<1||p.cols>10)fail('cols must be 1–10');}p.decimals ??=0; }
  if(name==='delta') { if(!p.from||!p.to)fail('from and to are required');keys(p.from,['value','label'],'from');keys(p.to,['value','label'],'to');text(p.from.label,'from.label',40);text(p.to.label,'to.label',40);text(p.prefix,'prefix',12);text(p.suffix,'suffix',16);text(p.change,'change',100);num(p.from.value,'from.value');num(p.to.value,'to.value');p.decimals ??=Math.max(precision(p.from.value),precision(p.to.value));const d=p.to.value-p.from.value;p.change ??=d===0?'No change':p.from.value===0?'From zero':`${d>0?'+':'−'}${Math.abs(100*d/Math.abs(p.from.value)).toFixed(1)}%`; }
  if(name==='compare'){for(const key of ['left','right']){if(!p[key])fail(`${key} is required`);keys(p[key],['title','items'],key);text(p[key].title,key,48);list(p[key].items,`${key}.items`,1,4);p[key].items.forEach(x=>text(x,'item',75));}}
  if(['steps','timeline','list','funnel'].includes(name)){list(p.items,'items',2,5);p.items=p.items.map(it=>typeof it==='string'?{text:it}:it);p.items.forEach((it,i)=>{keys(it,name==='list'?['text','say']:name==='funnel'?['label','value','say']:['title','detail','label','say'],'items');for(const k of ['text','title','label','detail'])text(it[k],k,k==='detail'?85:65);if(name==='funnel'){num(it.value,'value');if(it.value<0||(i&&it.value>p.items[i-1].value))fail('funnel values must be nonnegative and decrease');}});if(name==='funnel'){if(!p.items[0].value)fail('first funnel value must be positive');format();p.format.decimals ??=Math.max(...p.items.map(it=>precision(it.value)));}}
  if(name==='matrix'){list(p.columns,'columns',2,3);list(p.rows,'rows',2,4);p.columns.forEach(x=>text(x,'column',24));p.rows.forEach(r=>{keys(r,['label','values'],'rows');text(r.label,'row label',32);list(r.values,'row values',p.columns.length,p.columns.length);r.values.forEach(x=>text(x,'cell',30));});}
  if(name==='kinetic'){p.mode ??='highlight';p.align ??='left';p.maxWords ??=6;p.maxGap ??=.6;p.maxDuration ??=4;if(!['highlight','reveal','word'].includes(p.mode)||!['left','center'].includes(p.align)||!Number.isInteger(p.maxWords)||p.maxWords<1||p.maxWords>10)fail('invalid kinetic mode, align or maxWords');if(!Number.isFinite(p.maxGap)||p.maxGap<0||p.maxGap>5||!Number.isFinite(p.maxDuration)||p.maxDuration<.5||p.maxDuration>15)fail('kinetic maxGap must be 0–5 and maxDuration 0.5–15 seconds');}
  if(['icon-grid','flow','cycle'].includes(name)){
    const key=name==='icon-grid'?'items':'nodes';list(p[key],key,name==='icon-grid'?1:name==='cycle'?3:2,name==='icon-grid'?8:6);
    p[key].forEach((it,i)=>{
      keys(it,name==='cycle'?['icon','label']:['icon','label','detail','say'],`${key}[${i}]`);
      text(it.label,'label',40);if(!it.label?.trim())fail('every node needs a label');text(it.detail,'detail',70);
      if((name==='icon-grid'||it.icon!=null)&&!ICONS.includes(it.icon))fail(`unknown icon ${it.icon}; run clearframe icons`);
    });
    if(name!=='cycle'){p.stagger ??=.45;if(!Number.isFinite(p.stagger)||p.stagger<0||p.stagger>2)fail('stagger must be 0–2 seconds');}
    if(name==='icon-grid'&&p.columns!=null&&(!Number.isInteger(p.columns)||p.columns<1||p.columns>4))fail('columns must be 1–4');
    if(name==='flow'){p.orientation ??='auto';if(!['auto','horizontal','vertical'].includes(p.orientation))fail('invalid orientation');if(vertical)p.orientation='vertical';}
    if(name==='cycle'){p.period ??=8;p.clockwise ??=true;if(!Number.isFinite(p.period)||p.period<2||p.period>60)fail('period must be 2–60 seconds');if(typeof p.clockwise!=='boolean')fail('clockwise must be boolean');}
  }
  if(name==='breathing'){
    list(p.phases,'phases',2,6);p.phases.forEach((phase,i)=>{keys(phase,['label','seconds','scale'],`phases[${i}]`);text(phase.label,'phase label',40);if(!phase.label?.trim())fail('every phase needs a label');if(!Number.isFinite(phase.seconds)||phase.seconds<.25||phase.seconds>30)fail('phase seconds must be 0.25–30');if(phase.scale==null&&p.phases.length===2)phase.scale=i?'contract':'expand';if(!['expand','hold','contract'].includes(phase.scale))fail('each phase needs scale expand, hold or contract');});
    p.minScale ??=.55;p.maxScale ??=1;p.ring ??=true;
    if(!Number.isFinite(p.minScale)||!Number.isFinite(p.maxScale)||p.minScale<.2||p.maxScale>1||p.minScale>=p.maxScale)fail('scales require 0.2 ≤ minScale < maxScale ≤ 1');
    if(typeof p.ring!=='boolean')fail('ring must be boolean');
  }
  if(name==='image'||name==='video'){if(!p.asset&&!p.file)fail('asset or file is required');if(p.offset!=null&&(!Number.isFinite(p.offset)||p.offset<0))fail('offset must be nonnegative');}
  if(p.decimals!=null&&(!Number.isInteger(p.decimals)||p.decimals<0||p.decimals>8))fail('decimals must be 0–8');
  const required=(v,key)=>{if(typeof v!=='string'||!v.trim())fail(`${key} is required text`);};
  if(['title','statement','quote','callout'].includes(name))required(p.text??p.title,'text/title');
  if(name==='endcard')required(p.text??p.title,'text/title');
  if(name==='stat')required(p.label,'label');
  if(name==='equation')required(p.expression,'expression');
  if(name==='bars')p.data.forEach(d=>required(d.label,'data.label'));
  if(name==='kpis')p.items.forEach(d=>required(d.label,'items.label'));
  if(['steps','timeline'].includes(name))p.items.forEach(d=>required(d.title,'items.title'));
  if(name==='list')p.items.forEach(d=>required(d.text,'items.text'));
  if(name==='funnel')p.items.forEach(d=>required(d.label,'items.label'));
  return p;
}

export function markdownCatalog() {
  return '# Native block reference\n\nGenerated by `clearframe blocks --md`. All blocks render in FFFrames.\n\n'+BLOCKS.map(b=>`## ${b.name}\n\n${b.summary}\n\n| Prop | Meaning |\n|---|---|\n${Object.entries(b.props).map(([k,v])=>`| ${k} | ${v.replaceAll('|',' / ')} |`).join('\n')}\n\n\`\`\`json\n${JSON.stringify({id:b.name,block:b.name,vo:b.vo??'Replace this narration.',props:b.example},null,2)}\n\`\`\`\n`).join('\n');
}
