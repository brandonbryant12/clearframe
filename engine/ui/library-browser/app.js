const $=id=>document.getElementById(id);
const element=(tag,text,className)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(className)n.className=className;return n;};
const href=p=>`${repoBase}/${p.split('/').map(encodeURIComponent).join('/')}`;
const link=(text,p,external=false)=>{const n=element('a',text);n.href=external?p:href(p);n.target='_blank';n.rel='noopener';return n;};
const label=v=>v.replaceAll('-',' ');
const state={kind:'example',selected:null,variant:null,ledger:initialLedger,imported:false};
const packages=new Map(catalogData.packages.map(p=>[p.id,p]));
const records=new Map(catalogData.records.map(r=>[r.id,r]));
const stopVideo=()=>{const v=document.querySelector('video');if(v){v.pause();v.removeAttribute('src');v.load();}};
function selectOptions(id,values,all){const select=$(id),old=select.value;select.replaceChildren(new Option(all,''));for(const [value,text] of values)select.add(new Option(text,value));if(values.some(([value])=>value===old))select.value=old;}
function filterOptions(){
 const rs=catalogData.records.filter(r=>r.kind===state.kind),values=key=>[...new Set(rs.flatMap(r=>r[key]??[]))].sort().map(v=>[v,label(v)]);
 selectOptions('collection',catalogData.collections.map(c=>[c.id,c.name]),'All collections');selectOptions('purpose',values('purposes'),'All purposes');selectOptions('medium',values('medium'),'All media');selectOptions('status',values('status'),state.kind==='example'?'All package states':'All availability');
 $('status-label').firstChild.textContent=state.kind==='example'?'Package status':'Inventory availability';$('preview-only').disabled=state.kind!=='example';if(state.kind!=='example')$('preview-only').checked=false;
}
function section(title,parent=$('inspector')){const s=element('section',null,'evidence-section');s.append(element('h3',title));parent.append(s);return s;}
function metadata(parent,data){const dl=element('dl',null,'metadata');for(const [k,v] of Object.entries(data)){dl.append(element('dt',label(k)),element('dd',Array.isArray(v)?v.join(', '):typeof v==='object'?JSON.stringify(v):String(v)));}parent.append(dl);}
function selectAsset(id,{focus=false}={}){const r=records.get(id);if(!r)return;state.selected=id;state.variant=null;document.querySelectorAll('.result').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.id===id)));renderSelection();if(focus)$('selection').focus();}
function showRelated(id){state.kind='example';$('query').value='';for(const id of ['collection','purpose','medium','status'])$(id).value='';$('preview-only').checked=false;state.selected=id;setTabs();filterOptions();renderResults();$('selection').focus();}
function renderResults(){
 const list=filtered(catalogData,{kind:state.kind,query:$('query').value,collection:$('collection').value,purpose:$('purpose').value,medium:$('medium').value,status:$('status').value,preview:$('preview-only').checked});
 $('count').textContent=`${list.length} ${state.kind==='example'?'examples':'inventory items'}`;$('results').replaceChildren();
 if(!list.some(r=>r.id===state.selected)){state.selected=list[0]?.id??null;state.variant=null;}
 if(!list.length){$('results').append(element('p','No matches. Change the search or reset filters.','empty-results'));}
 for(const r of list){const b=element('button',null,'result');b.dataset.id=r.id;b.setAttribute('aria-pressed',String(r.id===state.selected));b.setAttribute('aria-label',`${r.title}; ${label(r.status)}`);
  const poster=r.variants?.find(v=>v.poster)?.poster;if(poster){const img=element('img');img.src=href(poster);img.alt='';img.loading='lazy';b.append(img);}else b.append(element('span',r.inventoryIds[0],'asset-code'));
  const caption=element('span');caption.append(element('strong',r.title),element('small',`${r.inventoryIds.join(', ')} / ${label(r.status)}`));b.append(caption);b.onclick=()=>selectAsset(r.id);$('results').append(b);
 }
 renderSelection();
}
function renderSelection(){
 stopVideo();$('selection').replaceChildren();$('inspector').replaceChildren();const r=records.get(state.selected);
 if(!r){$('selection').append(element('h2','Find another operation'),element('p','Search by a mechanism, a topic or an inventory ID. Reset filters to see the full collection.'));return;}
 const p=packages.get(r.packageId),selection=$('selection');selection.append(element('p',r.inventoryIds.join(' / '),'eyeline'),element('h2',r.title),element('p',r.description,'description'));
 if(r.kind==='inventory'){
  const screen=element('div',null,'screen empty');screen.append(element('h3',r.related.length?'Explore the linked examples':r.sourceFiles.length?'Editable source available':'Planned library item'),element('p',r.statusText));selection.append(screen);
  if(r.related.length){selection.append(element('p','Related examples retain their own readiness and review limits.','media-caption'));const list=element('div',null,'linked');for(const id of r.related){const b=element('button',records.get(id).title);b.onclick=()=>showRelated(id);list.append(b);}selection.append(list);}
  const scope=section('Reuse and limits');scope.append(element('p',r.guardrail));metadata(scope,{parameters:r.parameters});for(const f of r.sourceFiles)scope.append(link(f.split('/').at(-1),f));
 }else{
  const variant=r.variants.find(v=>v.id===state.variant)??r.variants[0];state.variant=variant?.id;
  if(r.variants.length){const formats=element('div',null,'formats');formats.setAttribute('role','group');formats.setAttribute('aria-label','Preview format');for(const v of r.variants){const b=element('button',v.id==='vertical'?'Portrait':label(v.id));b.setAttribute('aria-pressed',String(v===variant));b.onclick=()=>{state.variant=v.id;renderSelection();document.querySelector('.formats [aria-pressed=true]')?.focus();};formats.append(b);}selection.append(formats);}
  const screen=element('div',null,variant?.video?'screen':'screen empty');
  if(variant?.video){const v=element('video');v.controls=true;v.preload='none';v.playsInline=true;v.setAttribute('aria-label',`${r.title}, ${variant.id} preview`);v.src=href(variant.video);if(variant.poster)v.poster=href(variant.poster);v.addEventListener('error',()=>{if(!v.getAttribute('src'))return;const existing=selection.querySelector('.video-error');if(!existing){const e=element('p','The preview could not load. Rebuild the catalog with --verify, then open the package to check its media.','notice video-error');selection.append(e);}});screen.append(v);
  }else screen.append(element('h3','No verified preview link'),element('p','Inspect the source and file issues before rebuilding this example.'));selection.append(screen);
  selection.append(element('p',variant?.previewType==='prepared-insert'?'Prepared Blender insert. The native integration storyboard has not been rendered as a complete specimen.':variant?.video?'Retained native specimen. Use the controls to play or seek; see the review for acceptance limits.':'Source-only example. A source file does not establish a rendered result.','media-caption'));
  const readiness=section('Readiness');readiness.append(element('span',label(p.status),'badge'),element('span',p.integrity==='verified'?'Manifest files verified at catalog build':p.integrity==='changed'?'Package has changed or missing files':'File hashes have not been checked',`proof ${p.integrity==='verified'?'':'changed'}`));readiness.append(element('p','File integrity and editorial acceptance are separate. Read the review before reuse.'));
  if(p.issues.length){const details=element('details');details.append(element('summary',`${p.issues.length} file issues`));for(const i of p.issues)details.append(element('p',`${i.state}: ${i.path}`));readiness.append(details);}
  const files=section('Source and review');for(const [text,f] of [['Storyboard JSON',variant?.source],['Render receipt',variant?.receipt],['Adaptation and replay',p.readme],['Independent review',p.review],['Sources and license notes',p.sources],['Package manifest',p.manifest],['All package examples',p.preview]])if(f)files.append(link(text,f));
  const adaptation=section('Adaptation');const details=element('details');details.append(element('summary','Editable controls and requirements'));metadata(details,p.editable);metadata(details,p.requires);adaptation.append(details);
 }
 const inspiration=section('Research references');for(const id of r.sourceIds){const source=catalogData.sources.find(s=>s.id===id);if(source)inspiration.append(link(`${id}: ${source.title}`,source.url,true));}inspiration.append(element('p','References informed the inventory. They do not license publisher imagery or supply the fictional example data.'));
}
function setTabs(){$('examples-tab').setAttribute('aria-pressed',String(state.kind==='example'));$('inventory-tab').setAttribute('aria-pressed',String(state.kind==='inventory'));}
for(const [id,kind] of [['examples-tab','example'],['inventory-tab','inventory']])$(id).onclick=()=>{state.kind=kind;setTabs();filterOptions();renderResults();};
for(const id of ['query','collection','purpose','medium','status','preview-only'])$(id).addEventListener(id==='query'?'input':'change',renderResults);
$('reset').onclick=()=>{$('query').value='';for(const id of ['collection','purpose','medium','status'])$(id).value='';$('preview-only').checked=false;renderResults();};
function renderLedger(){
 const summary=summarizeVariation(state.ledger);$('ledger-summary').replaceChildren();$('ledger-entries').replaceChildren();
 $('ledger-summary').append(element('p',`${summary.kind==='examples'?'Example decisions':'Project decisions'}: ${summary.entries.length} recent entries shown, ${state.ledger.entries.length} total. ${state.imported?'Imported declarations; source hashes have not been checked in this browser.':'See each source identity for its catalog-build hash check.'}`));
 $('ledger-summary').append(element('p',summary.basis,'description'));
 if(summary.repeated.length){for(const g of summary.repeated)$('ledger-summary').append(element('p',`${g.entries.length} entries share a declared concept: ${g.mechanisms.join(', ')} / ${g.story.join(', ')}. Materials: ${g.materials.join(', ')||'unspecified'}. Camera: ${g.camera.join(', ')||'unspecified'}.`,'notice'));}
 if(!summary.entries.length)$('ledger-summary').append(element('p','No project choices recorded. Record a project with library-log, then import its ledger here.'));
 for(const e of summary.entries){const item=element('article',null,'ledger-entry'),example=e.assets.map(id=>records.get(id)).find(r=>r?.kind==='example'),poster=example?.variants.find(v=>v.poster)?.poster;if(poster){const img=element('img');img.src=href(poster);img.alt=`Library example for ${e.title}`;img.loading='lazy';item.append(img);}
  item.append(element('h3',e.title));metadata(item,e.choices);if(e.note)item.append(element('p',e.note));
  if(example){const b=element('button','Inspect linked example');b.onclick=()=>showRelated(example.id);item.append(b);}
  const details=element('details');details.append(element('summary','Source identity'),element('p',`Source hash: ${state.imported?'not checked (imported)':initialLedgerProof[e.id]??'not checked'} at catalog build.`),element('p',`${e.project} / recorded ${e.recordedAt}`),element('p',`Storyboard SHA-256: ${e.storyboardSha256}`,'hash'));item.append(details);$('ledger-entries').append(item);
 }
}
$('import-ledger').onclick=()=>{try{const input=$('ledger-input').value;if(input.length>2_000_000)throw Error('Ledger exceeds the 2 MB input limit.');state.ledger=validateLedger(JSON.parse(input));state.imported=true;renderLedger();$('ledger-message').className='';$('ledger-message').textContent=`Imported ${state.ledger.entries.length} entries into this browser session.`;}catch(e){$('ledger-message').className='error';$('ledger-message').textContent=`Import failed: ${e.message} The current ledger is unchanged.`;}};
$('restore-ledger').textContent=initialLedger.kind==='examples'?'Example decisions':'Restore initial ledger';
$('restore-ledger').onclick=()=>{state.ledger=initialLedger;state.imported=false;renderLedger();$('ledger-message').textContent='Restored the initial ledger.';};
$('empty-ledger').onclick=()=>{state.ledger={schemaVersion:1,kind:'projects',title:'Project decisions',entries:[]};state.imported=false;renderLedger();$('ledger-message').textContent='Started an empty project ledger in this browser session.';};
$('export-ledger').onclick=()=>{const blob=new Blob([JSON.stringify(state.ledger,null,2)+'\n'],{type:'application/json'}),url=URL.createObjectURL(blob),a=element('a');a.href=url;a.download=`clearframe-${state.ledger.kind}-choices.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('catalog-proof').textContent=`Catalog snapshot: ${catalogData.packages.length} packages, ${catalogData.records.filter(r=>r.kind==='example').length} examples, ${catalogData.records.filter(r=>r.kind==='inventory').length} inventory items. ${catalogData.verified?'Package file hashes were checked when this catalog was built.':'Package file hashes were not checked.'} Rebuild after changing source or media.`;
filterOptions();state.selected='physical-mechanisms/water-transfer';renderResults();renderLedger();
