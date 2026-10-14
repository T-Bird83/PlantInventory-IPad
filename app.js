 'use strict';
const $=id=>document.getElementById(id),KEY='plantinventory.offline.v1',SK='plantinventory.sessions.v2',CK='plantinventory.catalog.v1';
const uid=()=>crypto.randomUUID(),now=()=>new Date().toISOString(),clone=o=>JSON.parse(JSON.stringify(o));
let state;try{state=JSON.parse(localStorage.getItem(KEY)||'null')}catch{};
if(!state||!Array.isArray(state.entries))state={site:'001',device:'',cycle:'',cycleId:uid(),entries:[]};
if(!state.cycleId)state.cycleId=uid();
let sessions=[];try{sessions=JSON.parse(localStorage.getItem(SK)||'[]')}catch{};if(!Array.isArray(sessions))sessions=[];
let catalog=CATALOG.slice(),catalogVersion='Bundled PC master';try{const c=JSON.parse(localStorage.getItem(CK)||'null');if(c?.Format==='PlantInventoryTabletCatalogV1'&&Array.isArray(c.Products)&&c.Products.length){catalog=c.Products;catalogVersion=c.Version||'Imported'}}catch{};
$('catalogVersion').textContent=catalogVersion;
let chosenFamily='',chosenForm='',chosenType='',chosenColor='',chosenExact=null,editingId=null;
const COLORS=['BLACK','BLACK BLEND','BLUE','BROWN','BROWN BLEND','BUFF','DARK BROWN','GRAY','GRAY BLEND','GREEN','GREEN BLEND','JET BLACK','RED','SLATE','SLATE BLEND','TAN','TAN BLEND','TERRACOTTA','ULTRA WHITE','WHITE'];
const upper=x=>String(x||'').toUpperCase(),isTape=p=>/TAPES$/i.test(p.Source||''),isRoll=p=>['Finished Goods','Garland'].includes(p.Source),loc=p=>['',state.site,'001',...(state.site==='020'?['20','BCO']:[])].includes(p.Location||'');
const products=()=>catalog.filter(loc), familyOf=p=>{let x=(p.ItemId||'').match(/^F(\d{4})/);if(x)return x[1];x=(p.Description||'').match(/^(\d{4})\b/);return x?x[1]:''};
function persist(){try{localStorage.setItem(KEY,JSON.stringify(state));let i=sessions.findIndex(x=>x.cycleId===state.cycleId);if(i<0)sessions.push(clone(state));else sessions[i]=clone(state);localStorage.setItem(SK,JSON.stringify(sessions));$('status').textContent='Saved offline';}catch(e){alert('SAVE FAILED: '+e.message)}}
function sync(){for(let k of ['site','device','cycle'])$(k).value=state[k]||'';}
function showSessions(){
 let el=$('sessionList');el.replaceChildren();
 sessions.filter(s=>!s.finishedUtc).slice().reverse().forEach(s=>{
  let d=document.createElement('div');d.className='item';let t=document.createElement('span');
  t.textContent=`${s.cycle||'Unnamed inventory'} · ${s.site} · ${(s.entries||[]).length} entries`;
  let b=btn(s.cycleId===state.cycleId?'Current':'Continue',()=>{persist();state=clone(s);sync();reset();persist();render();showSessions();window.scrollTo(0,0)});
  d.append(t,b);el.append(d);
 });
 $('historyCount').textContent=sessions.filter(s=>s.finishedUtc).length;
 let h=$('historyList');h.replaceChildren();
 sessions.filter(s=>s.finishedUtc).slice().reverse().forEach(s=>{
  let d=document.createElement('div');d.className='item';let t=document.createElement('span');
  t.textContent=`${s.cycle||'Unnamed inventory'} · ${s.site} · ${(s.entries||[]).length} entries · Finished ${new Date(s.finishedUtc).toLocaleDateString()}`;
  d.append(t,btn('Reopen / resend',()=>{
   if(!confirm('Reopen this finished count for recovery or re-export? The saved entries will be preserved.'))return;
   persist();state=clone(s);state.finishedUtc=null;state.exportPrepared=false;sync();persist();reset();render();showSessions();$('historyPanel').hidden=true;
  }));h.append(d);
 });
}

function btn(label,fn,cls=''){let b=document.createElement('button');b.textContent=label;b.onclick=fn;if(cls)b.className=cls;return b}
function selected(label,value,fn){let d=document.createElement('div');d.className='selected-product';let s=document.createElement('span');s.textContent=label;let v=document.createElement('strong');v.textContent=value;d.append(s,v,btn('Change',fn));return d}
function step(el,text){let d=document.createElement('div');d.className='step-label';d.textContent=text;el.append(d)}
function choices(el,values,fn){let d=document.createElement('div');d.className='option-grid';values.forEach(v=>d.append(btn(v,()=>fn(v))));el.append(d)}
function reset(){chosenFamily='';chosenForm='';chosenType='';chosenColor='';chosenExact=null;editingId=null;$('search').value='';$('guided').replaceChildren();$('qtyPanel').hidden=true;search()}
function search(){
 let term=upper($('search').value.trim()),el=$('choices');el.replaceChildren();
 if(!term||chosenFamily||chosenExact)return;
 const list=products();
 const families=[...new Set([...list.map(familyOf),...FLOOR_OPTIONS.map(x=>x.Family)].filter(x=>x&&upper(x).includes(term)))].slice(0,18);
 // Any item represented by a family is selected through that family, not shown
 // as a second accounting-specific product choice (e.g. Garland Tapes).
 const matches=list.filter(p=>(upper(p.Description)+' '+upper(p.ItemId)).includes(term)
   && !familyOf(p) && !isTape(p)).slice(0,24);
 if(!families.length&&!matches.length)el.append(btn('Other / Not Listed — review required',()=>chooseManual(term)));
 families.forEach(f=>el.append(btn(f,()=>{chosenFamily=f;chosenForm='';chosenType='';chosenColor='';$('choices').replaceChildren();draw()})));
 matches.forEach(p=>el.append(btn(p.Description,()=>{chosenExact=p;$('choices').replaceChildren();draw()})));
}
function chooseManual(text){chosenExact={ItemId:'',Description:text,Source:'Manual / Review',CountUnit:'',Uom:'',UnitsPerPallet:null};$('choices').replaceChildren();draw()}
function familyTapes(){return products().filter(p=>isTape(p)&&(familyOf(p)===chosenFamily||p.ItemId===chosenFamily||upper(p.Description).startsWith(upper(chosenFamily)+' ')))}
function types(){return [...new Set(FLOOR_OPTIONS.filter(o=>upper(o.Family)===upper(chosenFamily)).map(o=>o.Type))]}
function needsType(){let o=FLOOR_OPTIONS.filter(o=>upper(o.Family)===upper(chosenFamily));let groups=new Map();o.forEach(x=>(x.Colors.length?x.Colors:['NO COLOR']).forEach(c=>{let s=groups.get(c)||new Set();s.add(x.Type);groups.set(c,s)}));return [...groups.values()].some(s=>s.size>1)}
function draw(){let el=$('guided');el.replaceChildren();$('qtyPanel').hidden=true;if(chosenExact){el.append(selected('PRODUCT',chosenExact.Description,reset));quantity(chosenExact);return}if(!chosenFamily)return;
el.append(selected('PRODUCT',chosenFamily,reset));let tapes=familyTapes();if(!chosenForm){if(tapes.length){step(el,'STEP 2 · WHAT IS IT?');choices(el,['ROLL','TAPE'],v=>{chosenForm=v;draw()});return}chosenForm='ROLL'}
el.append(selected('FORM',chosenForm,()=>{chosenForm='';chosenType='';chosenColor='';draw()}));if(chosenForm==='TAPE'){step(el,'STEP 3 · TYPE / OPTION');let g=document.createElement('div');g.className='option-grid';[...new Map(tapes.map(p=>[p.ItemId+'|'+p.Description,p])).values()].forEach(p=>g.append(btn(p.Description===chosenFamily?'Standard tape':p.Description.replace(new RegExp('^'+chosenFamily+'\\s*','i'),''),()=>{chosenExact=p;draw()})));el.append(g);return}
if(needsType()&&!chosenType){step(el,'STEP 3 · TYPE / OPTION');choices(el,[...types(),'Other / Not Listed'],v=>{chosenType=v;draw()});return}
if(chosenType)el.append(selected('TYPE',chosenType,()=>{chosenType='';chosenColor='';draw()}));
if(!chosenColor){step(el,'STEP 3 · COLOR');choices(el,[...COLORS,'NO COLOR','Other / Not Listed'],v=>{chosenColor=v;draw()});return}
el.append(selected('COLOR',chosenColor,()=>{chosenColor='';draw()}));quantity(resolvedRoll())}
function resolvedRoll(){
 if(!chosenFamily||chosenForm!=='ROLL'||!chosenColor||chosenColor==='Other / Not Listed')return null;
 const possible=products().filter(p=>p.Source==='Finished Goods'&&familyOf(p)===chosenFamily);
 const opt=FLOOR_OPTIONS.filter(o=>upper(o.Family)===upper(chosenFamily)
   &&(!chosenType||upper(o.Type)===upper(chosenType))
   &&o.Colors.some(c=>upper(c)===upper(chosenColor)));
 const color=upper(chosenColor);
 // Require color and an unambiguous item ID. Do not silently choose an item.
 const matches=possible.filter(p=>{
  const d=upper(p.Description);
  if(!d.includes(color))return false;
  if(opt.length===1){
   const tokens=upper(opt[0].Type).split(/\s+/).filter(t=>t.length>=4&&!['WHITE','BLACK','BLEND'].includes(t));
   if(tokens.length&&!tokens.some(t=>d.includes(t)))return false;
  }
  return true;
 });
 const ids=[...new Set(matches.map(p=>p.ItemId))];
 return ids.length===1?matches[0]:null;
}
function mode(p){if(!p)return 'Standard';let id=p.ItemId||'',s=p.Source||'',u=upper(p.CountUnit),d=upper(p.Description);if(['R0500','R0920','R0925','R0975'].includes(id)||s==='Tank Chart')return 'Tank';if(isTape(p))return 'TapeBoxes';if(id==='R0100')return 'PartialBoxes';if(id==='R0170')return 'Drums';if(id==='R0400')return 'Boxes';if(['R4200','R4250'].includes(id))return 'PalletStacks';if(s==='Raws'){if(d.includes('GRANULES')&&(u.includes('BAG')||upper(p.Uom).includes('LB')))return 'Bags';if(u.includes('ROLL')||['PET MAT','PET /','FIBERGLASS','M3-FD','M26','FILM'].some(x=>d.includes(x)))return 'Rolls';if(u.includes('DRUM'))return 'Drums';if(u.includes('BOX'))return 'Boxes';if(u.includes('BAG'))return 'Bags'}return 'Standard'}
function field(el,id,label,stepValue='1'){let l=document.createElement('label');l.textContent=label;let input=document.createElement('input');input.id=id;input.type='number';input.min='0';input.step=stepValue;input.inputMode=stepValue==='1'?'numeric':'decimal';l.append(input);el.append(l);return input}
function quantity(p){let panel=$('qtyPanel');panel.replaceChildren();panel.hidden=false;let m=mode(p);step(panel,'STEP 4 · '+(m==='TapeBoxes'?'BOX + LOOSE COUNT':m==='PartialBoxes'?'BOX COUNT':m==='PalletStacks'?'PALLET COUNT':'QUANTITY'));let g=document.createElement('div');g.className='grid';panel.append(g);
if(m==='Tank'){let w=document.createElement('div');w.className='warning';w.textContent='Tank chart calculation is not yet supported on this tablet. Do not enter this measurement here.';panel.append(w);return}
if(m==='Standard'){field(g,'full','Full pallets');field(g,'loose','Loose rolls / units')}
else if(m==='TapeBoxes'){field(g,'full','Full boxes');field(g,'loose','Loose rolls');let note=document.createElement('p');note.className='note';note.textContent=`${Math.max(1,Math.round(Number(p?.UnitsPerPallet)||1))} rolls per full box`;panel.append(note)}
else if(m==='PalletStacks'){field(g,'stacks','Stacks');field(g,'loose','Loose pallets');let n=document.createElement('p');n.className='note';n.textContent=`${p.ItemId==='R4250'?22:20} pallets per stack`;panel.append(n)}
else if(m==='PartialBoxes'){field(g,'full','Full boxes');let l=document.createElement('label');l.textContent='Partial box';let s=document.createElement('select');s.id='partial';[['0','None'],['0.25','1/4 box'],['0.5','1/2 box'],['0.75','3/4 box']].forEach(([v,t])=>{let o=document.createElement('option');o.value=v;o.textContent=t;s.append(o)});l.append(s);g.append(l)}
else field(g,'single',m,m==='Bags'?'1':'1');
let l=document.createElement('label');l.textContent='Notes (optional)';let n=document.createElement('input');n.id='notes';l.append(n);panel.append(l);if(!p){let w=document.createElement('p');w.className='warning';w.textContent='Roll identity must be checked against the master on the PC before accounting export. The tablet will not invent an accounting item ID.';panel.append(w)}
panel.append(btn(editingId?'Save correction':'Add & Next',()=>saveCount(p,m),'primary'))}
function num(id){let el=$(id);if(!el)return 0;let v=Number(el.value||0);if(!Number.isFinite(v)||v<0||!Number.isInteger(v))throw Error('Enter a nonnegative whole number for '+id);return v}
function rawPalletWeight(p){
 if(!p||p.Source!=='Raws'||mode(p)!=='Standard'||!upper(p.Uom).includes('LB'))return null;
 const weight=Number(p.UnitsPerPallet);
 return Number.isFinite(weight)&&weight>0?weight:null;
}
function rawLooseWeight(p){
 const d=p?.Description||'';
 const match=d.match(/(\d+(?:\.\d+)?)\s*(?:lbs?\.?|pounds?)\s*\/\s*bag/i);
 return match?Number(match[1]):null;
}
function saveCount(p,m){try{if(!p&&chosenForm==='ROLL')p=resolvedRoll();let full=num('full'),loose=num('loose'),stacks=num('stacks'),single=num('single'),partial=Number($('partial')?.value||0),qty=m==='TapeBoxes'?full*Math.max(1,Math.round(Number(p?.UnitsPerPallet)||1))+loose:m==='PalletStacks'?stacks*(p.ItemId==='R4250'?22:20)+loose:m==='PartialBoxes'?full+partial:single;
if(m==='Standard'&&full+loose<=0||m!=='Standard'&&qty<=0)throw Error('Enter a count greater than zero');
let rawWeight=rawPalletWeight(p);
// Preserve physical counts even when accounting conversion is unknown.
let missingPalletConversion=m==='Standard'&&p?.Source==='Raws'&&rawWeight===null&&full>0;
let missingLooseConversion=m==='Standard'&&p?.Source==='Raws'&&rawWeight!==null&&loose>0&&rawLooseWeight(p)===null;
// Raws worksheet column K expects a count in the unit defined by its row (E is lbs/unit).
// Do NOT send pounds here: Excel multiplies the input by E to obtain pounds.
// Loose bags are represented as a fractional pallet equivalent when their weight is known.
let accountingQty=m==='Standard'&&rawWeight!==null?full+(loose>0?loose*(rawLooseWeight(p)||0)/rawWeight:0):m==='Standard'?0:qty;
let conversionReview=missingPalletConversion||missingLooseConversion;
let family=chosenFamily,type=chosenType,color=chosenColor,desc=p?.Description||[family,needsType()?type:'',color==='NO COLOR'?'':color].filter(Boolean).join(' '),review=conversionReview||!p||p.Source==='Manual / Review'||color==='Other / Not Listed'||type==='Other / Not Listed';
let e={EntryId:editingId||uid(),SiteCode:state.site,Description:desc,Details:p?.ItemId||[type,color].filter(Boolean).join(' · '),ItemId:p?.ItemId||'',ProductSource:p?.Source||'Finished Goods',ProductForm:p?isTape(p)?'TAPE':isRoll(p)?'ROLL':'':chosenForm,ProductFamily:family,ProductType:type,ProductColor:color,FullPallets:m==='Standard'?full:0,LooseUnits:m==='Standard'?loose:m==='TapeBoxes'||m==='PalletStacks'?loose:0,CountMode:m==='PartialBoxes'?'Boxes':m,PrimaryQuantity:accountingQty,Stacks:m==='PalletStacks'?stacks:m==='TapeBoxes'?full:0,IsTank:false,InchesOut:0,Pounds:0,UpdatedUtc:now(),NeedsReview:review,ReviewReason:conversionReview?'Missing verified accounting conversion; physical count saved for review':''};
let idx=state.entries.findIndex(x=>x.EntryId===editingId);if(idx>=0)state.entries[idx]=e;else state.entries.push(e);persist();reset();render();if(conversionReview)alert('Physical count saved. Accounting conversion needs review on the PC before final export.');window.scrollTo(0,0)}catch(e){alert(e.message)}}
function render(){$('count').textContent=state.entries.length;let el=$('entries');el.replaceChildren();state.entries.slice().reverse().forEach(e=>{let d=document.createElement('div');d.className='item';let t=document.createElement('span');t.textContent=`${e.Description} · ${e.CountMode||'Standard'} · ${e.CountMode==='Standard'?'Pallets '+e.FullPallets+' / loose '+e.LooseUnits:'Quantity '+e.PrimaryQuantity}${e.NeedsReview?' · REVIEW':''}`;let edit=btn('Edit',()=>{editingId=e.EntryId;chosenExact=products().find(p=>p.ItemId&&p.ItemId===e.ItemId&&p.Description===e.Description)||null;chosenFamily=e.ProductFamily||'';chosenForm=e.ProductForm||'';chosenType=e.ProductType||'';chosenColor=e.ProductColor||'';if(!chosenExact&&!chosenFamily){alert('This saved product must be reselected. Its existing entry will remain until you save the correction.');editingId=null;return}draw();document.querySelector('.count-card').scrollIntoView()});let del=btn('Delete',()=>{if(confirm('Delete this entry?')){state.entries=state.entries.filter(x=>x.EntryId!==e.EntryId);persist();render()}});d.append(t,edit,del);el.append(d)})}
async function exportFile(obj,name){
 const json=JSON.stringify(obj,null,2);
 try{
  const file=new File([json],name,{type:'application/octet-stream'});
  if(navigator.canShare?.({files:[file]})){
   try{await navigator.share({files:[file],title:'PlantInventory count'});$('status').textContent='Share sheet opened';return true}
   catch(e){if(e.name==='AbortError'){$('status').textContent='Share canceled';return false}}
  }
  const url=URL.createObjectURL(new Blob([json],{type:'application/octet-stream'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
  $('status').textContent='File download requested — check Files / Downloads';return true;
 }catch(e){alert('Export failed: '+e.message);return false}
}
$('export').onclick=async()=>{if(!state.entries.length)return alert('No saved counts');if(!state.device.trim()||!state.cycle.trim())return alert('Enter counter/device and inventory name');let entries=state.entries.filter(e=>e.SiteCode===state.site);let pkg={PackageId:uid(),CycleId:state.cycleId,InventoryName:state.cycle,SiteCode:state.site,DeviceName:state.device,ExportedUtc:now(),CatalogVersion:catalogVersion,Entries:entries};const requested=await exportFile(pkg,`PlantInventory-${state.site}-${new Date().toISOString().slice(0,10)}.picount`);if(requested){state.exportPrepared=true;persist();$('finishSession').hidden=false}};
$('finishSession').onclick=()=>{
 if(!state.exportPrepared)return alert('Export this count first.');
 if(!confirm('Have you saved or sent the .picount file? Finish this count and keep it in Count History?'))return;
 state.finishedUtc=now();persist();
 state={site:state.site,device:state.device,cycle:'',cycleId:uid(),entries:[]};
 sync();persist();reset();render();showSessions();$('finishSession').hidden=true;window.scrollTo(0,0);
};
$('archiveOldSessions').onclick=()=>{
 // Keep the currently selected count active. Archive only OTHER unfinished sessions.
 persist();
 const old=sessions.filter(s=>!s.finishedUtc&&s.cycleId!==state.cycleId);
 if(!old.length)return alert('No older unfinished sessions to finish.');
 if(!confirm(`Move ${old.length} older unfinished sessions to Count History?\n\nThis does not export them or delete any saved counts. Do this only for sessions you no longer need to continue.`))return;
 const stamp=now();
 for(const s of old){s.finishedUtc=stamp;s.archivedWithoutExport=true;}
 try{localStorage.setItem(SK,JSON.stringify(sessions));showSessions();alert(`${old.length} sessions moved to Count History. Their saved counts are still available.`)}catch(e){alert('Archive failed: '+e.message)}
};
$('toggleHistory').onclick=()=>{$('historyPanel').hidden=!$('historyPanel').hidden};
$('backup').onclick=()=>exportFile({state,sessions,catalogVersion},'PlantInventory-tablet-backup.json');
$('restore').onchange=async ev=>{try{let f=ev.target.files[0];if(!f)return;let data=JSON.parse(await f.text());if(!data.state||!Array.isArray(data.sessions))throw Error('Not a V3 backup');if(!confirm('Replace tablet sessions from backup?'))return;state=data.state;sessions=data.sessions;persist();sync();reset();render();showSessions()}catch(e){alert(e.message)}ev.target.value=''};
$('newSession').onclick=()=>{if(state.entries.length&&!confirm('Start a new inventory? The current unfinished count will remain saved.'))return;persist();state={site:state.site,device:state.device,cycle:'',cycleId:uid(),entries:[]};sync();persist();reset();render();showSessions();$('finishSession').hidden=true;window.scrollTo(0,0)};
$('catalogUpdate').onchange=async ev=>{try{let f=ev.target.files[0];if(!f)return;if(f.size>10000000)throw Error('File too large');let obj=JSON.parse(await f.text());if(obj.Format!=='PlantInventoryTabletCatalogV1'||!Array.isArray(obj.Products)||!obj.Products.length||obj.Products.length>25000)throw Error('Invalid catalog');if(obj.Products.some(p=>!p.Description||!p.Source))throw Error('Invalid product entry');if(!confirm(`Install ${obj.Products.length} products? Existing counts stay saved.`))return;localStorage.setItem(CK,JSON.stringify(obj));catalog=obj.Products;catalogVersion=obj.Version||'Imported';$('catalogVersion').textContent=catalogVersion;reset()}catch(e){alert(e.message)}ev.target.value=''};
for(let k of ['site','device','cycle'])$(k).addEventListener('change',()=>{state[k]=$(k).value;persist();reset();render();showSessions()});
$('search').addEventListener('input',search);sync();persist();showSessions();$('finishSession').hidden=!state.exportPrepared;render();search();$('status').textContent='Offline ready';

if("serviceWorker" in navigator){navigator.serviceWorker.register("./sw.js").catch(e=>console.warn("Offline setup failed",e));}
