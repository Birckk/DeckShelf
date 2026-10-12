import { layoutControls, mana } from './shared.tsx';
const decks = (await (await fetch('/src/data/decks.json')).json()).slice(0, 12);
const sources = [
  { id: 'alex', name: 'Alex’s decks', on: true, group: 'Commander', folders: [
    { id: 'night', name: 'Game night', ids: [0,1,2,3], chosen: [0,1,2,3] },
    { id: 'precons', name: 'Precons', ids: [4,5,6], chosen: [4,5] },
    { id: 'ideas', name: 'Work in progress', ids: [7,8], chosen: [] },
  ] },
  { id: 'shared', name: 'Shared game-night decks', on: true, folders: [
    { id: 'friends', name: 'Friday favourites', ids: [2,9,10], chosen: [2,9] },
  ] },
  { id: 'individual', name: 'Individual decks', on: true, folders: [
    { id: 'links', name: 'Added by link', ids: [11], chosen: [11] },
  ] },
];
const fixture=await (await fetch('./birckk-folders.json')).json();
const fullDecks=await (await fetch('./birckk-decks.json')).json();
const personalFolders=fixture.folders.filter(f=>!f.root).map(({source,path})=>({id:source.value,name:source.name,path,parent:fixture.folders.find(f=>!f.root&&f.path===path.split(' / ').slice(0,-1).join(' / '))?.source.value,ids:source.entries.map(e=>{const i=decks.length;decks.push(fullDecks.find(d=>d.id===e.id));return i;}),chosen:[]}));
personalFolders.forEach(f=>f.chosen=[...f.ids]);
sources.unshift({id:'birckk',name:'Birckk',on:true,folders:personalFolders});
const expanded = new Set(['source:birckk']);
let current = 'overview', layout = 'details', size = 165, query = '', adding = false;
let overviewExpanded = false;
let sourceInput = '', pending = null, serial = 0;
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const folders = () => sources.flatMap(s => s.folders);
const unique=ids=>[...new Set(ids)];
const orderedFolders=(fs,parent)=>fs.filter(f=>f.parent===parent).flatMap(f=>[f,...orderedFolders(fs,f.id)]);
function scope(){const ss=current==='overview'?sources:sources.filter(s=>s.id===current||s.folders.some(f=>f.id===current));const s=ss[0],own=s?.folders.find(f=>f.id===current);const fs=own?[own,...s.folders.filter(f=>f.path&&own.path&&f.path.startsWith(own.path+' / '))]:ss.flatMap(s=>s.folders);return {s:current==='overview'?{name:'All collections',on:true}:s,fs,f:{id:current,name:own?.name||(current==='overview'?'Overview':s.name),ids:unique(fs.flatMap(f=>f.ids)),chosen:unique(fs.filter(f=>current!=='overview'||sources.find(s=>s.folders.includes(f)).on).flatMap(f=>f.chosen))}};}
const total = () => new Set(sources.filter(s => s.on).flatMap(s => s.folders.flatMap(f => f.chosen))).size;
let timer;
function announce(message) { $('#status').textContent = message; $('#status').hidden = false; clearTimeout(timer); timer = setTimeout(() => $('#status').hidden = true, 2500); }
function disclosure(key, name, target) {
  return `<button class="disclosure" id="fold-${key}" data-fold="${key}" aria-label="${expanded.has(key) ? 'Collapse' : 'Expand'} ${esc(name)}" aria-expanded="${expanded.has(key)}" aria-controls="${target}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5"/></svg></button>`;
}
function deckChoices(f, preview = false) {
  return f.ids.map(i => `<label class="tree-deck"><input id="${preview?'pending':'tree'}-${f.id}-${i}" type="checkbox" data-${preview?'pending':'tree'}-deck="${i}" data-in="${f.id}" aria-label="Select ${esc(decks[i].name)} in ${esc(f.name)}" ${f.chosen.includes(i)?'checked':''}><span>${esc(decks[i].name)}</span></label>`).join('');
}
function folderRow(f, preview = false) {
  const key = `${preview?'preview':'folder'}:${f.id}`;
  return `<div class="tree-row ${!preview && !adding && current === f.id ? 'active' : ''}">
    ${disclosure(key, f.name, 'children-'+key)}
    <input id="select-${key}" type="checkbox" data-${preview?'pending-folder':'folder'}="${f.id}" aria-label="Select direct decks in ${esc(f.name)}" ${f.chosen.length===f.ids.length?'checked':''}>
    <button id="open-${key}" ${preview ? `data-fold="${key}" aria-expanded="${expanded.has(key)}" aria-controls="children-${key}"` : `data-open="${f.id}" ${current===f.id&&!adding?'aria-current="page"':''}`}>${esc(f.name)}</button><small>${f.chosen.length}/${f.ids.length}${f.path&&folders().some(c=>c.parent===f.id)?' · '+unique([f,...folders().filter(c=>c.path?.startsWith(f.path+' / '))].flatMap(c=>c.ids)).length+' total':''}</small>
  </div><div id="children-${key}" class="tree-children" ${expanded.has(key)?'':'hidden'}>${deckChoices(f,preview)}${!preview?folders().filter(c=>c.parent===f.id).map(c=>folderRow(c)).join(''):''}</div>`;
}
function renderSidebar(){
$('#sidebar').innerHTML=`<button class="overview-link ${current==='overview'&&!adding?'active':''}" data-open="overview">Overview <small>${total()} shown</small></button><div class="aside-title"><span>Collections</span><button id="collapse-all">${sources.some(s=>expanded.has('source:'+s.id))?'Collapse all':'Expand all'}</button></div>`+sources.map(s=>{const key='source:'+s.id;return `<div class="source ${s.on?'':'off'}"><div class="source-head ${current===s.id&&!adding?'active':''}">${disclosure(key,s.name,'children-'+key)}<button id="source-${s.id}" data-open="${s.id}">${esc(s.name)}</button><small title="Selected / total decks">${unique(s.folders.flatMap(f=>f.chosen)).length}/${unique(s.folders.flatMap(f=>f.ids)).length}</small><label class="switch"><input id="enable-${s.id}" type="checkbox" role="switch" data-enable="${s.id}" aria-label="Show ${esc(s.name)}" ${s.on?'checked':''}></label></div><div id="children-${key}" ${expanded.has(key)?'':'hidden'}>${s.folders.filter(f=>!f.parent).map(f=>folderRow(f)).join('')}</div></div>`;}).join('')+`<div class="aside-foot">${total()} shown · ${unique(folders().flatMap(f=>f.ids)).length} total<br>${sources.filter(s=>s.on).length} of ${sources.length} collections on</div>`;
}
function mixedStates() {
  for (const f of folders()) { const el = document.querySelector(`[data-folder="${f.id}"]`); if(el) el.indeterminate = f.chosen.length>0&&f.chosen.length<f.ids.length; }
  for (const f of pending?.folders || []) { const el = document.querySelector(`[data-pending-folder="${f.id}"]`); if(el) el.indeterminate = f.chosen.length>0&&f.chosen.length<f.ids.length; }
}
function render() {
  const focus = document.activeElement?.id;
  renderSidebar();
  if(adding) renderAdd(); else {
    const {s,f}=scope();$('.page-head h1').textContent=f.name;
    $('#content').innerHTML=`${current==='overview'?`<div class="overview-heading"><span>${sources.length} collections</span><button id="expand-overview" aria-expanded="${overviewExpanded}" aria-controls="collection-overview">${overviewExpanded?'Collapse collections':'Expand collections'}</button></div><div id="collection-overview" class="collection-overview ${overviewExpanded?'expanded':''}" tabindex="0" aria-label="Collections">${sources.map(s=>`<div class="collection-summary"><div class="summary-top"><button data-open="${s.id}">${esc(s.name)}<small>${unique(s.folders.flatMap(f=>f.chosen)).length}/${unique(s.folders.flatMap(f=>f.ids)).length} selected</small></button><label class="switch"><input type="checkbox" role="switch" data-enable="${s.id}" aria-label="Enable ${esc(s.name)}" ${s.on?'checked':''}><span>${s.on?'On':'Off'}</span></label></div>${overviewExpanded?`<div class="summary-folders">${orderedFolders(s.folders).map(f=>`<button data-open="${f.id}"><span>${f.parent?'↳ ':''}${esc(f.name)}</span><small>${f.chosen.length}/${f.ids.length}</small></button>`).join('')}</div>`:''}</div>`).join('')}</div>`:`<div class="scope-line"><button data-open="overview">Overview</button><span>/</span>${current!==s.id?`<button data-open="${s.id}">${esc(s.name)}</button><span>/</span>`:''}<span>${f.chosen.length} of ${f.ids.length} selected</span><button class="scope-only" data-only="${s.id}">Only this collection</button></div>`}
    ${!s.on?`<div class="scope-warning">Collection paused <button data-resume="${s.id}">Turn on</button></div>`:''}
    <div class="toolbar"><input id="search" class="search" placeholder="Find a deck…" aria-label="Find a deck" value="${esc(query)}"><span class="scope-count">${current==='overview'?total()+' shown · ':''}${f.ids.length} decks</span>${layoutControls(({details:'grid','art-only':'art',compact:'compact',list:'list'})[layout])}${layout!=='list'?`<label class="size">Size <input id="size" aria-label="Card size" type="range" min="140" max="240" step="25" value="${size}"></label>`:''}</div><div id="decks" class="decks ${layout}" style="--card-size:${size}px"></div>`;
    renderDecks();
  }
  mixedStates();
  if(focus) document.getElementById(focus)?.focus({preventScroll:true});
}
function renderDecks() {
  const {f} = scope();
  $('#decks').innerHTML = f.ids.filter(i=>(decks[i].name+' '+decks[i].commanders[0].name).toLowerCase().includes(query.toLowerCase())).map(i=>{
    const d = decks[i];
    const origin = folders().find(other=>other.ids.includes(i));
    const overlap = sources.filter(s=>s.on).flatMap(s=>s.folders).find(other=>!scope().fs.includes(other)&&other.chosen.includes(i));
    return `<article class="deck" data-select-deck="${i}"><div class="deck-colors">${mana(d.colors||[])}</div><img class="art crop" src="${layout==='art-only'?d.commanders[0].image:d.commanders[0].art||d.commanders[0].image}" alt="${esc(d.commanders[0].name||d.name)}"><div><h3>${esc(d.name)}</h3><p>${overlap?'Also in '+esc(overlap.name):scope().fs.length>1?esc(origin?.name||''):esc(d.commanders[0].name)}</p></div><label class="deck-label" title="Include ${esc(d.name)}"><input id="deck-${i}" type="checkbox" data-deck="${i}" aria-label="Include ${esc(d.name)}" ${f.chosen.includes(i)?'checked':''}></label></article>`;
  }).join('') || '<p class="empty">No matching decks.</p>';
}
function renderAdd() {
  $('.page-head h1').textContent='Add decks';
  const selected = pending ? new Set(pending.folders.flatMap(f=>f.chosen)).size : 0;
  $('#content').innerHTML = `<div class="add-panel"><button id="cancel" class="muted small">← Back</button>
    <form id="source-form"><label for="source">Archidekt username or link</label><div class="input-row"><input id="source" class="search" required value="${esc(sourceInput)}" placeholder="Username, folder or deck link"><button class="outline" id="discover" type="submit">Preview example</button></div></form>
    ${pending?`<div id="pending-preview"><h2>${pending.direct?'Individual deck':'Choose folders'}</h2><div class="preview-folders">${pending.direct?deckChoices(pending.folders[0],true):pending.folders.map(f=>folderRow(f,true)).join('')}</div><button class="gold" id="confirm" ${selected?'':'disabled'}>Add ${selected} ${selected===1?'deck':'decks'}</button></div>`:''}</div>`;
}
function closeMobile() { $('#sidebar').classList.remove('open'); $('#mobile').setAttribute('aria-expanded','false'); }
document.addEventListener('click', e=>{
  const tile=e.target.closest('[data-select-deck]');
  if(tile && !e.target.closest('input,label,button,a')) {
    tile.querySelector('input[data-deck]').click();
    return;
  }
  const b=e.target.closest('button'); if(!b)return;
  if(b.dataset.fold){const key=b.dataset.fold;expanded.has(key)?expanded.delete(key):expanded.add(key);render();return;}
  if(b.id==='collapse-all'){
    if(sources.some(s=>expanded.has('source:'+s.id))) [...expanded].filter(k=>!k.startsWith('preview:')).forEach(k=>expanded.delete(k));
    else sources.forEach(s=>{expanded.add('source:'+s.id);if(s.group)expanded.add('group:'+s.id);s.folders.forEach(f=>expanded.add('folder:'+f.id));});
    render();return;
  }
  if(b.id==='expand-overview'){overviewExpanded=!overviewExpanded;render();return;}
  if(b.id==='mobile'){b.setAttribute('aria-expanded',$('#sidebar').classList.toggle('open'));return;}
  if(b.id==='add'){adding=true;pending=null;render();$('#source').focus();}
  if(b.dataset.open){current=b.dataset.open;adding=false;query='';render();closeMobile();}
  if(b.dataset.layout){layout=({grid:'details',art:'art-only',compact:'compact',list:'list'})[b.dataset.layout];render();}
  if(b.dataset.only){sources.forEach(s=>s.on=s.id===b.dataset.only);render();}
  if(b.dataset.resume){sources.find(s=>s.id===b.dataset.resume).on=true;render();}
  if(b.id==='cancel'){adding=false;render();$('#add').focus();}
  if(b.id==='confirm'&&pending){
    if(pending.direct){const f=sources.find(s=>s.id==='individual').folders[0];const ids=pending.folders[0].chosen;f.ids=[...new Set([...f.ids,...ids])];f.chosen=[...new Set([...f.chosen,...ids])];current=f.id;expanded.add('source:individual');}
    else{const id='extra'+(++serial);const added=pending.folders.filter(f=>f.chosen.length).map(f=>({...f,id:f.id+serial}));sources.push({id,name:'Another account',on:true,folders:added});current=added[0].id;expanded.add('source:'+id);}
    adding=false;pending=null;render();announce('Example added.');
  }
});
document.addEventListener('submit',e=>{
  if(e.target.id!=='source-form')return;e.preventDefault();sourceInput=$('#source').value;
  pending={direct:sourceInput.includes('/decks/'),folders:sourceInput.includes('/decks/')?[{id:'single',name:decks[8].name,ids:[8],chosen:[8]}]:[{id:'casual',name:'Casual Commander',ids:[0,7,8],chosen:[]},{id:'new',name:'New builds',ids:[9,10],chosen:[]}]};
  render();
});
function setChoice(f,id,on){f.chosen=on?[...new Set([...f.chosen,id])]:f.chosen.filter(x=>x!==id);}
document.addEventListener('change',e=>{
  const t=e.target;
  if(t.dataset.enable)sources.find(s=>s.id===t.dataset.enable).on=t.checked;
  else if(t.dataset.folder){const f=folders().find(f=>f.id===t.dataset.folder);f.chosen=t.checked?[...f.ids]:[];}
  else if(t.dataset.pendingFolder){const f=pending.folders.find(f=>f.id===t.dataset.pendingFolder);f.chosen=t.checked?[...f.ids]:[];}
  else if(t.dataset.treeDeck!==undefined)setChoice(folders().find(f=>f.id===t.dataset.in),Number(t.dataset.treeDeck),t.checked);
  else if(t.dataset.pendingDeck!==undefined)setChoice(pending.folders.find(f=>f.id===t.dataset.in),Number(t.dataset.pendingDeck),t.checked);
  else if(t.dataset.deck!==undefined)scope().fs.filter(f=>f.ids.includes(Number(t.dataset.deck))).forEach(f=>setChoice(f,Number(t.dataset.deck),t.checked));
  else return;
  render();
});
document.addEventListener('input',e=>{
  if(e.target.id==='search'){query=e.target.value;renderDecks();}
  if(e.target.id==='size'){size=Number(e.target.value);$('#decks').style.setProperty('--card-size',size+'px');}
  if(e.target.id==='source'){sourceInput=e.target.value;pending=null;$('#pending-preview')?.remove();}
});
render();
