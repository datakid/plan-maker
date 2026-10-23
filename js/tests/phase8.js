function shipRng(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
function shipFreshStorage(){
  const sh = window.__TEST_STORAGE__;
  const keys = [];
  for(let i=0; i<sh.length; i++) keys.push(sh.key(i));
  for(const k of keys) if(k && k.startsWith('alkhitta.') && !/lang|theme|view/.test(k)) sh.removeItem(k);
}
function shipRestoreApp(keep){
  App.data = keep.data; App.plan = keep.plan;
  App.readOnly = false; App.recovered = false; App.corrupt = false;
  const b = document.getElementById('ro-banner'); if(b) b.remove();
  document.querySelectorAll('.dialog, .scrim').forEach(n=>n.remove());
  shipFreshStorage();
  saveNow(); savePlan();
}
function shipKeep(){ return {data:App.data, plan:App.plan}; }
function shipQuotaError(){ const e = new Error('quota'); e.name = 'QuotaExceededError'; return e; }

regress('ship: P1.1 a foreign write makes this window read-only and nothing is written until the user takes over', ()=>{
  const keep = shipKeep();
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    saveNow();
    const marker = JSON.stringify({marker:'other-window'});
    localStorage.setItem(STORE_KEY, marker);
    window.dispatchEvent(new StorageEvent('storage', {key:STORE_KEY, newValue:marker}));
    if(!App.readOnly) return verdict(false, '', 'readOnly flag not set');
    if(!document.getElementById('ro-banner')) return verdict(false, '', 'banner missing');
    App.data.people[0].name = 'edited-while-read-only';
    saveNow(); savePlan();
    window.dispatchEvent(new Event('beforeunload'));
    const after = localStorage.getItem(STORE_KEY);
    if(after!==marker) return verdict(false, '', 'read-only window overwrote the other window data');
    if(localStorage.getItem(STORE_KEY+'.tmp')!==null) return verdict(false, '', 'tmp key left behind');
    takeOverWrites();
    const next = JSON.parse(localStorage.getItem(STORE_KEY));
    if(!next.people || next.people[0].name!=='edited-while-read-only') return verdict(false, '', 'take over did not save');
    if(document.getElementById('ro-banner')) return verdict(false, '', 'banner still shown after take over');
    return verdict(true, 'read-only until take over');
  } finally { shipRestoreApp(keep); }
});

regress('ship: P1.1 unrelated storage keys do not trigger read-only', ()=>{
  const keep = shipKeep();
  try{
    window.dispatchEvent(new StorageEvent('storage', {key:'alkhitta.theme'}));
    return verdict(!App.readOnly, 'ignored', 'theme key flipped read-only');
  } finally { shipRestoreApp(keep); }
});

regress('ship: P1.2 a full store keeps memory data, never writes partial data and offers a backup', ()=>{
  const keep = shipKeep();
  const sh = window.__TEST_STORAGE__, realSet = sh.setItem;
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    saveNow();
    const good = localStorage.getItem(STORE_KEY);
    sh.setItem = ()=>{ throw shipQuotaError(); };
    App.data.people[0].name = 'unsaved-change';
    saveNow();
    sh.setItem = realSet;
    const after = localStorage.getItem(STORE_KEY);
    if(after!==good) return verdict(false, '', 'stored value changed while the store was full');
    try{ JSON.parse(after); }catch(e){ return verdict(false, '', 'stored value is not valid JSON'); }
    if(localStorage.getItem(STORE_KEY+'.tmp')!==null) return verdict(false, '', 'tmp key left behind');
    if(App.data.people[0].name!=='unsaved-change') return verdict(false, '', 'memory data lost');
    const dlg = document.querySelector('.dialog');
    if(!dlg || !dlg.textContent.includes(t('storageFullTitle'))) return verdict(false, '', 'quota dialog missing');
    if(![...dlg.querySelectorAll('button')].some(b=>b.textContent===t('bkExport'))) return verdict(false, '', 'dialog has no backup button');
    return verdict(true, 'dialog shown, memory kept');
  } finally { sh.setItem = realSet; shipRestoreApp(keep); }
});

regress('ship: P1.2 a failed plan save is reported and the old plan stays intact', ()=>{
  const keep = shipKeep();
  const sh = window.__TEST_STORAGE__, realSet = sh.setItem;
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    const r = generatePlan({skipExplain:true, iters:20});
    App.plan = r.plan; savePlan();
    const good = localStorage.getItem(PLAN_KEY);
    sh.setItem = ()=>{ throw shipQuotaError(); };
    App.plan = Object.assign({}, App.plan, {marker:'new'});
    savePlan();
    sh.setItem = realSet;
    return verdict(localStorage.getItem(PLAN_KEY)===good && localStorage.getItem(PLAN_KEY+'.tmp')===null, 'old plan intact', 'plan store changed or tmp left');
  } finally { sh.setItem = realSet; shipRestoreApp(keep); }
});

regress('ship: P1.3 atomic save leaves no tmp key and a leftover tmp is recovered when the main value is broken', ()=>{
  const keep = shipKeep();
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    saveNow();
    if(localStorage.getItem(STORE_KEY+'.tmp')!==null) return verdict(false, '', 'tmp key present after a normal save');
    const next = JSON.parse(JSON.stringify(App.data));
    next.people[0].name = 'from-tmp';
    localStorage.setItem(STORE_KEY, '{"version":5,"facilities":[');
    localStorage.setItem(STORE_KEY+'.tmp', JSON.stringify(next));
    loadAll();
    if(App.data.people[0].name!=='from-tmp') return verdict(false, '', 'not recovered from tmp');
    if(!App.recovered) return verdict(false, '', 'recovered flag not set');
    const main = JSON.parse(localStorage.getItem(STORE_KEY));
    if(main.people[0].name!=='from-tmp' || localStorage.getItem(STORE_KEY+'.tmp')!==null) return verdict(false, '', 'main not repaired or tmp not cleared');
    return verdict(true, 'recovered');
  } finally { shipRestoreApp(keep); }
});

regress('ship: P1.3 an unreadable main value is kept aside instead of being overwritten by seed data', ()=>{
  const keep = shipKeep();
  try{
    localStorage.setItem(STORE_KEY, '{"broken');
    loadAll();
    const kept = localStorage.getItem(CORRUPT_KEY);
    if(kept!=='{"broken') return verdict(false, '', 'corrupt copy missing');
    if(!App.corrupt) return verdict(false, '', 'corrupt flag not set');
    return verdict(App.data.facilities.length>50, 'seed loaded, copy kept', 'no seed after corrupt load');
  } finally { shipRestoreApp(keep); }
});

regress('ship: P1.4 snapshots keep the last 3, are size capped, and are taken before approve, import and restore', ()=>{
  const keep = shipKeep();
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    localStorage.removeItem(SNAP_KEY);
    for(let i=0; i<5; i++){ App.data.people[0].name = 'n'+i; takeSnapshot('restore'); }
    const list = readSnapshots();
    if(list.length!==SNAP_MAX) return verdict(false, '', 'kept '+list.length);
    if(JSON.parse(list[list.length-1].data).people[0].name!=='n4') return verdict(false, '', 'newest snapshot is not the latest data');
    if(JSON.parse(list[0].data).people[0].name!=='n2') return verdict(false, '', 'oldest kept snapshot is wrong');
    localStorage.removeItem(SNAP_KEY);
    App.data = normalizeData(JSON.parse(SEED_JSON));
    const r = generatePlan({skipExplain:true});
    App.plan = r.plan;
    const ap = approvePlan();
    if(!ap.ok) return verdict(false, '', 'approve blocked: '+JSON.stringify(ap.blockers.map(b=>b.key)));
    let l = readSnapshots();
    if(!l.length || l[l.length-1].reason!=='approve') return verdict(false, '', 'no approve snapshot');
    const before = l.length;
    const pv = previewImport('team', [['الاسم','عدد ثابت'], [App.data.people[0].name, '7']]);
    applyImport(pv);
    l = readSnapshots();
    if(l.length<=before-0 && l[l.length-1].reason!=='import') return verdict(false, '', 'no import snapshot');
    if(l[l.length-1].reason!=='import') return verdict(false, '', 'last reason '+l[l.length-1].reason);
    const idx = l.findIndex(x=>x.reason==='approve');
    const people = JSON.parse(l[idx].data).people.length;
    if(!restoreSnapshot(idx)) return verdict(false, '', 'restore failed');
    if(App.data.people.length!==people) return verdict(false, '', 'restored data differs');
    if(readSnapshots().slice(-1)[0].reason!=='restore') return verdict(false, '', 'restore did not snapshot first');
    return verdict(true, 'approve, import, restore snapshots');
  } finally { shipRestoreApp(keep); localStorage.removeItem(SNAP_KEY); }
});

regress('ship: P1.4 a snapshot that cannot fit is dropped without breaking the app', ()=>{
  const keep = shipKeep();
  const sh = window.__TEST_STORAGE__, realSet = sh.setItem;
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    localStorage.removeItem(SNAP_KEY);
    sh.setItem = (k, v)=>{ if(k===SNAP_KEY) throw shipQuotaError(); realSet(k, v); };
    const r = takeSnapshot('approve');
    sh.setItem = realSet;
    return verdict(r===false && localStorage.getItem(SNAP_KEY)===null, 'dropped', 'snapshot state wrong');
  } finally { sh.setItem = realSet; shipRestoreApp(keep); localStorage.removeItem(SNAP_KEY); }
});

regress('ship: P1.4 the Data tab shows storage size, version and a restorable snapshot list', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    localStorage.removeItem(SNAP_KEY);
    takeSnapshot('approve');
    App.ui.tab = 'data'; renderTab();
    const size = document.getElementById('storage-size');
    const list = document.getElementById('snapshot-list');
    const okSize = !!size && /\d+ KB/.test(size.textContent) && size.textContent.includes(APP_VERSION);
    const okList = !!list && list.querySelectorAll('button').length===1;
    return verdict(okSize && okList, 'size + 1 snapshot row', 'size '+okSize+' list '+okList);
  } finally { App.ui.tab = tab; renderTab(); shipRestoreApp(keep); localStorage.removeItem(SNAP_KEY); }
});

regress('ship: P1.5 names with markup stay text in every tab and html: only accepts static svg', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  const bad = '<img src=x onerror="window.__xss=1">';
  try{
    window.__xss = 0;
    App.data = normalizeData(JSON.parse(SEED_JSON));
    const D = App.data;
    D.facilities[0].name = bad; D.facilities[1].category = bad; D.locations[0].name = bad;
    D.people[0].name = bad; D.people[1].title = bad;
    D.categories.push({name:bad, kind:'basic'});
    const pv = previewImport('facilities', [['الاسم','التصنيف','المنطقة'], [bad, bad, bad]]);
    if(pv && !pv.error) applyImport(pv);
    const r = generatePlan({skipExplain:true, iters:20});
    if(r.plan) App.plan = r.plan;
    for(const id of ['plan','facilities','team','rules','data']){
      App.ui.tab = id; renderTab();
      if(document.querySelector('#page img[src="x"]')) return verdict(false, '', 'img element created in '+id);
    }
    App.ui.tab = 'plan';
    for(const v of ['list','calendar','matrix','summary']){ App.ui.view = v; renderResults(); if(document.querySelector('#page img[src="x"]')) return verdict(false, '', 'img created in view '+v); }
    App.ui.view = 'list';
    const span = el('span', {html:bad}); const span2 = el('span', {html:'<svg viewBox="0 0 1 1" onload="window.__xss=2"><path d="M0 0"/></svg>'});
    if(span.querySelector('img') || span.textContent!==bad) return verdict(false, '', 'html: accepted a non-svg string');
    if(span2.querySelector('svg')) return verdict(false, '', 'html: accepted an svg with an event handler');
    for(const k of Object.keys(ICON)){ const n = el('span', {html:ICON[k]}); if(typeof ICON[k]==='string' && !n.querySelector('svg')) return verdict(false, '', 'ICON.'+k+' rejected by the guard'); }
    if(!/^<svg/.test(WORDMARK) || !el('span', {html:WORDMARK}).querySelector('svg')) return verdict(false, '', 'WORDMARK rejected');
    return verdict(window.__xss===0, 'no markup executed', 'xss flag '+window.__xss);
  } finally { App.ui.tab = tab; App.ui.view = 'list'; renderTab(); shipRestoreApp(keep); }
});

function shipMutate(base, rnd){
  const raw = JSON.parse(JSON.stringify(base));
  const wrong = [null, 'x', 7, [], {}, true, -1, 1e999, 'NaN'];
  const touched = {people:new Set(), facilities:new Set(), history:false, all:false};
  const n = 1+Math.floor(rnd()*3);
  for(let m=0; m<n; m++){
    const pick = Math.floor(rnd()*12);
    if(pick===0){ delete raw[['people','facilities','locations','categories','history','settings','aliases','unresolved'][Math.floor(rnd()*8)]]; touched.all = true; }
    else if(pick===1){ const k = ['people','facilities','locations','categories','history','settings','aliases','unresolved'][Math.floor(rnd()*8)]; raw[k] = wrong[Math.floor(rnd()*wrong.length)]; touched.all = true; }
    else if(pick===2 && Array.isArray(raw.people) && raw.people.length){ const i = Math.floor(rnd()*raw.people.length); touched.people.add(raw.people[i] && raw.people[i].id); raw.people[i] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===3 && Array.isArray(raw.facilities) && raw.facilities.length){ const i = Math.floor(rnd()*raw.facilities.length); touched.facilities.add(raw.facilities[i] && raw.facilities[i].id); raw.facilities[i] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===4 && Array.isArray(raw.people) && raw.people.length){ const p = raw.people[Math.floor(rnd()*raw.people.length)]; const ks = Object.keys(p).filter(k=>k!=='id' && k!=='name'); if(ks.length) p[ks[Math.floor(rnd()*ks.length)]] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===5 && Array.isArray(raw.facilities) && raw.facilities.length){ const f = raw.facilities[Math.floor(rnd()*raw.facilities.length)]; const ks = Object.keys(f).filter(k=>k!=='id' && k!=='name'); if(ks.length) f[ks[Math.floor(rnd()*ks.length)]] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===6 && raw.settings && typeof raw.settings==='object'){ const ks = Object.keys(raw.settings); if(ks.length) raw.settings[ks[Math.floor(rnd()*ks.length)]] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===7 && raw.settings && raw.settings.volume && typeof raw.settings.volume==='object'){ const ks = Object.keys(raw.settings.volume); if(ks.length) raw.settings.volume[ks[Math.floor(rnd()*ks.length)]] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===8 && raw.settings && raw.settings.calendar && typeof raw.settings.calendar==='object'){ const ks = Object.keys(raw.settings.calendar); if(ks.length) raw.settings.calendar[ks[Math.floor(rnd()*ks.length)]] = wrong[Math.floor(rnd()*wrong.length)]; }
    else if(pick===9 && raw.history && typeof raw.history==='object'){ const ks = Object.keys(raw.history); if(ks.length) raw.history[ks[Math.floor(rnd()*ks.length)]] = wrong[Math.floor(rnd()*wrong.length)]; touched.history = true; }
    else if(pick===10 && Array.isArray(raw.people)){ const junk = []; for(let i=0; i<300; i++) junk.push(i%3===0 ? null : {id:'junk'+i, name:'j'+i, avail:'x', skill:[], off:'z'}); raw.people = raw.people.concat(junk); }
    else if(pick===11 && Array.isArray(raw.settings && raw.settings.goals)){ raw.settings.goals.push(wrong[Math.floor(rnd()*wrong.length)]); }
  }
  return {raw, touched};
}

regress('ship: P1.6 fifty corrupted backups never throw through restore or load and keep every untouched person, facility and history', ()=>{
  const keep = shipKeep();
  try{
    const base = JSON.parse(SEED_JSON);
    const basePeople = base.people.map(p=>p.id), baseFac = base.facilities.map(f=>f.id);
    const baseFpv = Object.keys(base.history.fpv).length;
    const rnd = shipRng(20261022);
    let n = 0;
    for(let i=0; i<50; i++){
      const {raw, touched} = shipMutate(base, rnd);
      let r;
      try{ r = restoreBackupObject(raw); }catch(e){ return verdict(false, '', 'restore threw on case '+i+': '+e.message); }
      if(r.ok){
        const ids = new Set(r.data.people.map(p=>p.id)), fids = new Set(r.data.facilities.map(f=>f.id));
        if(!touched.all){
          for(const id of basePeople) if(!touched.people.has(id) && !ids.has(id)) return verdict(false, '', 'case '+i+' lost person '+id);
          for(const id of baseFac) if(!touched.facilities.has(id) && !fids.has(id)) return verdict(false, '', 'case '+i+' lost facility '+id);
          if(!touched.history && Object.keys(r.data.history.fpv).length!==baseFpv) return verdict(false, '', 'case '+i+' lost history');
        }
        const keepData = App.data;
        App.data = r.data;
        try{ if(i%7===0 && r.data.people.length<150){ for(const id of ['plan','facilities','team','rules','data']){ App.ui.tab = id; renderTab(); } App.ui.tab = 'plan'; } }
        catch(e){ App.data = keepData; return verdict(false, '', 'render threw on case '+i+': '+e.message); }
        App.data = keepData;
        n++;
      }
      localStorage.setItem(STORE_KEY, JSON.stringify(raw));
      try{ loadAll(); }catch(e){ return verdict(false, '', 'loadAll threw on case '+i+': '+e.message); }
      if(!App.data || !Array.isArray(App.data.people) || !Array.isArray(App.data.facilities) || !App.data.settings) return verdict(false, '', 'loadAll left unusable data on case '+i);
      for(const p of App.data.people) if(!p || typeof p.id!=='string') return verdict(false, '', 'bad person after load, case '+i);
      for(const f of App.data.facilities) if(!f || typeof f.id!=='string' || !isFinite(f.freq)) return verdict(false, '', 'bad facility after load, case '+i);
    }
    for(const bad of [null, [], 'x', 5, true, {}, {version:5}, {facilities:'x', people:[], settings:{}}]){
      let r; try{ r = restoreBackupObject(bad); }catch(e){ return verdict(false, '', 'restore threw on a non-backup value'); }
      if(r.ok && !(bad && bad.version===5)) return verdict(false, '', 'non-backup accepted: '+JSON.stringify(bad));
    }
    return verdict(n>=15, n+' of 50 restored cleanly, none threw', 'only '+n+' restorable');
  } finally { shipRestoreApp(keep); }
});

regress('ship: P1.6 corrupted data that restores can still generate a plan', ()=>{
  const keep = shipKeep();
  try{
    const base = JSON.parse(SEED_JSON);
    const rnd = shipRng(77);
    let made = 0;
    for(let i=0; i<40 && made<8; i++){
      const {raw} = shipMutate(base, rnd);
      const r = restoreBackupObject(raw);
      if(!r.ok) continue;
      App.data = r.data;
      const g = generatePlan({skipExplain:true, iters:10, budget:{ms:200, maxMs:400}});
      if(!g.error && !g.plan) return verdict(false, '', 'no plan and no error on case '+i);
      made++;
    }
    return verdict(made>=5, made+' generations', 'only '+made);
  } finally { shipRestoreApp(keep); }
});

regress('ship: P1.7 erase-all stops further writes so a reload cannot resurrect the data', ()=>{
  const keep = shipKeep();
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    saveNow();
    const removed = eraseAllData({noReload:true});
    window.dispatchEvent(new Event('beforeunload'));
    const left = [];
    const sh = window.__TEST_STORAGE__;
    for(let i=0; i<sh.length; i++){ const k = sh.key(i); if(k && k.startsWith('alkhitta.')) left.push(k); }
    return verdict(removed>0 && left.length===0, 'storage empty after the unload handler ran', 'left '+left.join(','));
  } finally { shipRestoreApp(keep); }
});

const SHIP_ASYNC = [];
function shipAsync(name, fn){ SHIP_ASYNC.push({name, fn}); }
async function runShipAsync(filter){
  for(const c of SHIP_ASYNC){
    if(filter && !filter.test(c.name)) continue;
    const keep = shipKeep();
    try{
      const r = await c.fn();
      if(r && typeof r==='object') ok(c.name, r.pass===true, r.info==null || r.info===false ? null : String(r.info));
      else ok(c.name, r===true, r===true ? null : String(r));
    }catch(e){ ok(c.name, false, 'EXC '+e.message+' '+(e.stack||'').split('\n')[1]); }
    finally{ App.data = keep.data; App.plan = keep.plan; }
  }
}
function shipSetSpan(add){
  const start = '2026-10-04';
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start, end:isoOf(ordOf(start)+add)});
}
function shipPlanKey(plan){
  const c = JSON.parse(JSON.stringify(plan));
  const strip = o=>{
    if(Array.isArray(o)) return o.forEach(strip);
    if(o && typeof o==='object'){
      for(const k of Object.keys(o)){
        if(k==='ms' || k==='lnsMs' || k==='createdAt' || k==='generatedAt' || k==='at' || k==='id' || k==='vid') delete o[k];
        else strip(o[k]);
      }
    }
  };
  strip(c);
  return JSON.stringify(c);
}

shipAsync('ship: P2.1 worker and inline generation give identical plans for the same seed', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  const out = [];
  for(const add of [6, 27]){
    shipSetSpan(add);
    const a = await startGeneration({seed:20260101}).promise;
    const mode = GenRun.mode;
    const b = await startGeneration({seed:20260101, inline:true}).promise;
    if(!a.plan || !b.plan) return verdict(false, '', 'no plan, add '+add);
    if(GenRun.mode!=='inline') return verdict(false, '', 'inline flag ignored');
    const ka = shipPlanKey(a.plan), kb = shipPlanKey(b.plan);
    if(ka!==kb){
      let i = 0; while(i<ka.length && ka[i]===kb[i]) i++;
      return verdict(false, '', 'span '+add+' ('+mode+') differs near '+i+': '+ka.slice(Math.max(0, i-60), i+60)+' <> '+kb.slice(Math.max(0, i-60), i+60));
    }
    out.push(mode+':'+a.plan.visits.length);
  }
  return verdict(true, out.join(' '));
});

shipAsync('ship: P2.2 progress arrives in order and a cancel stops the worker without touching App.plan', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(93);
  const seen = [];
  const before = App.plan;
  const h = startGeneration({seed:1}, (stage, pct)=>{ seen.push([stage, pct]); });
  await sleep(150);
  h.cancel();
  const res = await h.promise;
  if(!res.cancelled) return verdict(false, '', 'not cancelled: '+JSON.stringify(Object.keys(res)));
  if(GenRun.active!==null) return verdict(false, '', 'active handle not cleared');
  if(App.plan!==before) return verdict(false, '', 'plan replaced by a cancelled run');
  const n = seen.length;
  await sleep(400);
  if(seen.length!==n) return verdict(false, '', 'progress kept arriving after cancel');
  const full = await startGeneration({seed:1}, (stage, pct)=>{ seen.push([stage, pct]); }).promise;
  let last = -1;
  for(const [, p] of seen.slice(n)){ if(p<last-1e-9) return verdict(false, '', 'progress went backwards'); last = p; }
  return verdict(!!full.plan && seen.length>n, (GenRun.mode)+' mode, '+(seen.length-n)+' progress messages');
});

shipAsync('ship: P2.3 the page stays responsive while a quarter is generated', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(93);
  let max = 0, last = performance.now(), running = true;
  const tick = setInterval(()=>{ const n = performance.now(); max = Math.max(max, n-last); last = n; }, 10);
  const t0 = performance.now();
  const res = await startGeneration({seed:3}).promise;
  const took = Math.round(performance.now()-t0);
  clearInterval(tick);
  if(!res.plan) return verdict(false, '', 'no plan');
  if(GenRun.mode!=='worker') return verdict(true, 'worker unavailable on this origin, inline fallback used ('+took+' ms, longest block '+Math.round(max)+' ms)');
  return verdict(max<100+10, 'longest main-thread gap '+Math.round(max)+' ms over '+took+' ms', 'main thread blocked for '+Math.round(max)+' ms');
});

shipAsync('ship: P2.4 doGenerate shows progress, sets the plan and removes the status bar', async ()=>{
  const tab = App.ui.tab;
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(6);
  App.ui.tab = 'plan'; renderTab();
  const btn = document.querySelector('.gen-btn');
  if(!btn) return verdict(false, '', 'no generate button');
  const p = doGenerate(btn);
  const during = !!document.getElementById('gen-status') && btn.disabled;
  const res = await p;
  const after = !document.getElementById('gen-status') && !document.querySelector('.gen-btn').disabled;
  const planSet = !!App.plan && App.plan.visits.length===res.plan.visits.length;
  App.ui.tab = tab; renderTab();
  return verdict(during && after && planSet, 'status shown then removed', 'during '+during+' after '+after+' planSet '+planSet);
});

shipAsync('ship: P2.5 a second doGenerate while one runs does not start another', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(27);
  App.ui.tab = 'plan'; renderTab();
  const btn = document.querySelector('.gen-btn');
  const p1 = doGenerate(btn);
  const handle = GenRun.active;
  const p2 = doGenerate(btn);
  const same = GenRun.active===handle;
  await p1; await p2;
  return verdict(same, 'single run', 'a second run replaced the active handle');
});

shipAsync('ship: P2.6 a search cut short by the clock is flagged in the plan and shown in Summary', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(93);
  const r = generatePlan({seed:5, timeScale:0.05, skipExplain:true});
  if(!r.plan) return verdict(false, '', 'no plan');
  const flagged = !!(r.plan.gen && r.plan.gen.search && r.plan.gen.search.truncated);
  const calm = generatePlan({seed:5, iters:30, skipExplain:true});
  const calmFlag = !!(calm.plan.gen && calm.plan.gen.search && calm.plan.gen.search.truncated);
  const keep = App.plan, tab = App.ui.tab, view = App.ui.view;
  App.plan = r.plan; App.ui.tab = 'plan'; App.ui.view = 'summary'; renderTab();
  const shown = !!document.getElementById('gen-truncated');
  App.plan = keep; App.ui.tab = tab; App.ui.view = view; renderTab();
  return verdict(flagged && shown && !calmFlag, 'flag + notice; unflagged when iterations end the run', 'flagged '+flagged+' shown '+shown+' calmFlag '+calmFlag);
});

function shipMonthPlan(seed, extra){
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(27);
  const r = generatePlan(Object.assign({seed:seed || 11, skipExplain:true, iters:60, timeScale:8}, extra || {}));
  return r.plan;
}

regress('ship: P3.1 canSeat reports busy, off, blocked, retired and Must-deny reasons and ignores Prefer-deny', ()=>{
  const keep = shipKeep();
  try{
    const plan = shipMonthPlan(11);
    const v = plan.visits.find(x=>!x.fixed && facilityById(x.facilityId));
    const f = facilityById(v.facilityId);
    const pool = S().pools[0].id;
    const p = activePeople().find(q=>q.pool===pool && personAvailable(q, ordOf(v.date)) && !(q.blocked || []).includes(f.id));
    if(!p) return verdict(false, '', 'no candidate person');
    const rules0 = compilePeopleRules();
    if(seatBlock(p, v, v.date, plan, {busy:new Set(), rules:rules0})!==null) return verdict(false, '', 'free person rejected');
    if(seatBlock(p, v, v.date, plan, {busy:new Set([p.id]), rules:rules0})!=='busy') return verdict(false, '', 'busy not reported');
    const q = JSON.parse(JSON.stringify(p));
    q.off = [{from:v.date, to:v.date}];
    if(seatBlock(q, v, v.date, plan, {busy:new Set(), rules:rules0})!=='off') return verdict(false, '', 'day off not reported');
    q.off = []; q.blocked = [f.id];
    if(seatBlock(q, v, v.date, plan, {busy:new Set(), rules:rules0})!=='blocked') return verdict(false, '', 'blocked not reported');
    q.blocked = []; q.retired = true;
    if(seatBlock(q, v, v.date, plan, {busy:new Set(), rules:rules0})!=='off') return verdict(false, '', 'retired not reported');
    const g = newGoal('person');
    g.people = [p.id]; g.rel = 'never'; g.scope = {kind:'all', ids:[]}; g.strict = 'must';
    S().goals.push(g);
    const rulesMust = compilePeopleRules();
    if(seatBlock(p, v, v.date, plan, {busy:new Set(), rules:rulesMust})!=='rule') return verdict(false, '', 'Must deny not reported');
    g.strict = 'try';
    const rulesTry = compilePeopleRules();
    if(seatBlock(p, v, v.date, plan, {busy:new Set(), rules:rulesTry})!==null) return verdict(false, '', 'Prefer deny blocked the seat');
    const noBusy = seatBlock(p, v, v.date, plan, {rules:rulesTry});
    return verdict(noBusy===null || noBusy==='busy', 'reasons ok');
  } finally { shipRestoreApp(keep); }
});

regress('ship: P3.1 no LNS move generator seats someone who cannot work that visit', ()=>{
  const keep = shipKeep();
  try{
    const plan0 = shipMonthPlan(21);
    const pool = S().pools[0].id;
    const members = activePeople().filter(p=>p.pool===pool).slice(0, 3);
    const g = newGoal('person');
    g.people = members.map(p=>p.id); g.rel = 'never'; g.scope = {kind:'all', ids:[]}; g.strict = 'must';
    S().goals.push(g);
    const plan = clonePlan(plan0);
    for(const v of plan.visits){ if(v.team && v.team[pool]) v.team[pool] = v.team[pool].filter(id=>!g.people.includes(id)); }
    const st = makeState(plan);
    lnsReindex(st); lnsState = st; lnsRulesCache = compilePeopleRules();
    const rules = lnsRulesCache;
    const rnd = shipRng(99);
    let proposed = 0, bad = null, byName = {};
    App.debugIndex = true;
    try{
      for(let i=0; i<2500 && !bad; i++){
        const mv = lnsMoves(st, rnd, null, null);
        if(!mv) continue;
        proposed++;
        byName[mv.name] = (byName[mv.name] || 0)+1;
        const old = new Map(mv.ops.filter(o=>o.op==='set').map(o=>{ const v = st.plan.visits.find(x=>x.id===o.id); return [o.id, {date:v.date, fac:v.facilityId, ids:visitTeamIds(v)}]; }));
        const inv = applyMove(st, mv);
        for(const o of mv.ops){
          if(o.op!=='set') continue;
          const v = st.plan.visits.find(x=>x.id===o.id);
          const was = old.get(o.id);
          const moved = was.date!==v.date || was.fac!==v.facilityId;
          for(const id of visitTeamIds(v)){
            if(!moved && was.ids.includes(id)) continue;
            if(v.locked && v.locked.includes(id)) continue;
            const why = seatBlock(personById(id), v, v.date, st.plan, {rules}) || (rules.denied(id, facilityById(v.facilityId))==='must' ? 'rule' : null);
            if(why){ bad = mv.name+' seated '+id+' on '+v.date+' ('+why+')'; break; }
          }
          if(bad) break;
        }
        applyMove(st, inv);
      }
    } finally { App.debugIndex = false; lnsState = null; lnsRulesCache = null; }
    if(bad) return verdict(false, '', bad);
    return verdict(proposed>800 && Object.keys(byName).length>=6, proposed+' moves over '+Object.keys(byName).length+' generators, none illegal', 'only '+proposed+' proposals from '+Object.keys(byName).join(','));
  } finally { shipRestoreApp(keep); }
});

regress('ship: P3.2 fastCopy matches a JSON round trip and applyMove then revert restores every visit exactly', ()=>{
  const keep = shipKeep();
  try{
    const plan = shipMonthPlan(31);
    for(const v of plan.visits) if(JSON.stringify(fastCopy(v))!==JSON.stringify(JSON.parse(JSON.stringify(v)))) return verdict(false, '', 'copy differs for '+v.id);
    const st = makeState(clonePlan(plan));
    lnsReindex(st); lnsState = st; lnsRulesCache = compilePeopleRules();
    const rnd = shipRng(5);
    const before = JSON.stringify(st.plan.visits);
    let n = 0;
    try{
      for(let i=0; i<600; i++){
        const mv = lnsMoves(st, rnd, null, null);
        if(!mv) continue;
        const r = deltaMove(st, mv);
        r.revert();
        n++;
      }
    } finally { lnsState = null; lnsRulesCache = null; }
    return verdict(JSON.stringify(st.plan.visits)===before && n>100, n+' apply/revert pairs restore the plan', 'plan changed after revert or too few moves: '+n);
  } finally { shipRestoreApp(keep); }
});

regress('ship: P3.3 the busy index never drifts from a full scan across a whole LNS run', ()=>{
  const keep = shipKeep();
  try{
    const plan = shipMonthPlan(41);
    App.debugIndex = true;
    let res;
    try{ res = lnsPlan(plan, {}, {seed:7, iters:500, ms:60000}); }
    finally { App.debugIndex = false; }
    return verdict(res.info.iters>=300, res.info.iters+' iterations, no drift', 'run too short: '+res.info.iters);
  } finally { shipRestoreApp(keep); }
});

function shipKey(k, o){ return new KeyboardEvent('keydown', Object.assign({key:k, bubbles:true, cancelable:true}, o || {})); }

regress('ship: P4.1 manual edits can be undone and redone with the keyboard, history is capped, and a new plan clears it', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  try{
    const plan = shipMonthPlan(51);
    App.plan = plan; PlanHistory.undo = []; PlanHistory.redo = []; PlanHistory.owner = null;
    App.ui.tab = 'plan'; renderTab();
    const v = plan.visits.find(x=>!x.fixed);
    const days = plan.days.filter(d=>d!==v.date);
    const first = v.date, second = days[0];
    if(!mutatePlan(p=>{ const x = visitIn(p, v.id); x.date = second; x.moved = true; }, {force:true})) return verdict(false, '', 'edit refused');
    if(historyState().undo!==1) return verdict(false, '', 'undo depth '+historyState().undo);
    const un = document.getElementById('undo-btn');
    if(!un || un.disabled) return verdict(false, '', 'undo button missing or disabled after an edit');
    document.dispatchEvent(shipKey('z', {ctrlKey:true}));
    if(visitIn(App.plan, v.id).date!==first) return verdict(false, '', 'ctrl+z did not restore the date');
    if(historyState().redo!==1) return verdict(false, '', 'redo depth '+historyState().redo);
    document.dispatchEvent(shipKey('z', {ctrlKey:true, shiftKey:true}));
    if(visitIn(App.plan, v.id).date!==second) return verdict(false, '', 'ctrl+shift+z did not redo');
    document.dispatchEvent(shipKey('z', {metaKey:true}));
    document.dispatchEvent(shipKey('y', {ctrlKey:true}));
    if(visitIn(App.plan, v.id).date!==second) return verdict(false, '', 'meta+z then ctrl+y did not round trip');
    const inp = el('input', {type:'text'}); document.body.appendChild(inp); inp.focus();
    const planBefore = App.plan;
    const ev = shipKey('z', {ctrlKey:true}); inp.dispatchEvent(ev);
    inp.remove();
    if(App.plan!==planBefore) return verdict(false, '', 'undo fired while typing in an input');
    for(let i=0; i<55; i++){
      const t2 = i%2 ? first : second;
      mutatePlan(p=>{ const x = visitIn(p, v.id); x.date = t2; x.moved = true; }, {force:true});
    }
    if(historyState().undo!==HISTORY_LIMIT) return verdict(false, '', 'history depth '+historyState().undo);
    App.plan = clonePlan(App.plan);
    if(historyState().undo!==0 || stepHistory(-1)) return verdict(false, '', 'history survived a replaced plan');
    return verdict(true, 'undo, redo, input guard, cap '+HISTORY_LIMIT+', reset on new plan');
  } finally { App.ui.tab = tab; PlanHistory.undo = []; PlanHistory.redo = []; PlanHistory.owner = null; renderTab(); shipRestoreApp(keep); }
});

regress('ship: P4.1 undoing an edit to a fixed visit puts its saved override back as well', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  try{
    const plan = shipMonthPlan(52);
    const v = plan.visits.find(x=>x.fixed && x.overrideId && overrideById(x.overrideId));
    if(!v) return verdict(true, 'no fixed visit with an override in the seed plan, nothing to check');
    App.plan = plan; PlanHistory.undo = []; PlanHistory.redo = []; PlanHistory.owner = null;
    const o = overrideById(v.overrideId), was = o.date;
    const other = plan.days.find(d=>d!==v.date);
    mutatePlan(p=>{ const x = visitIn(p, v.id); x.date = other; }, {force:true});
    if(o.date!==other) return verdict(false, '', 'override not synced on edit');
    stepHistory(-1);
    return verdict(overrideById(v.overrideId).date===was, 'override restored', 'override date '+overrideById(v.overrideId).date+' expected '+was);
  } finally { PlanHistory.undo = []; PlanHistory.redo = []; PlanHistory.owner = null; shipRestoreApp(keep); App.ui.tab = tab; }
});

regress('ship: P4.2 diffPlans counts added, removed, moved and team-changed visits', ()=>{
  const keep = shipKeep();
  try{
    const a = shipMonthPlan(61);
    const b = clonePlan(a);
    if(a.visits.length<6) return verdict(false, '', 'plan too small');
    const d0 = diffPlans(a, b);
    if(d0.added+d0.removed+d0.moved+d0.changed!==0) return verdict(false, '', 'identical plans reported as different');
    const vs = b.visits;
    const other = b.days.find(d=>d!==vs[0].date && !vs.some(x=>x.facilityId===vs[0].facilityId && x.date===d));
    vs[0].date = other;
    const gone = vs.pop();
    const pool = S().pools[0].id;
    const t3 = vs[2];
    const keepTeam = JSON.stringify(t3.team);
    t3.team = Object.assign({}, t3.team, {[pool]:[...(t3.team[pool] || []).slice(1), 'someone-else']});
    const extra = JSON.parse(JSON.stringify(vs[3])); extra.id = 'zz'; extra.facilityId = 'only-in-b'; vs.push(extra);
    const d = diffPlans(a, b);
    return verdict(d.moved===1 && d.removed===1 && d.added===1 && d.changed===1, JSON.stringify(d), 'got '+JSON.stringify(d)+' team '+keepTeam.length);
  } finally { shipRestoreApp(keep); }
});

shipAsync('ship: P4.2 regenerating shows the change chip and Keep previous restores the old plan', async ()=>{
  const tab = App.ui.tab;
  App.data = normalizeData(JSON.parse(SEED_JSON));
  shipSetSpan(13);
  App.plan = null; App.ui.diff = null;
  App.ui.tab = 'plan'; renderTab();
  await doGenerate(document.querySelector('.gen-btn'));
  const first = App.plan;
  if(document.getElementById('diff-chip')) return verdict(false, '', 'chip shown after the very first plan');
  shipSetSpan(20);
  await doGenerate(document.querySelector('.gen-btn'));
  const chip = document.getElementById('diff-chip');
  const d = diffPlans(first, App.plan);
  if(!(d.added+d.removed+d.moved+d.changed)) return verdict(false, '', 'test setup produced no difference');
  if(!chip || !chip.textContent.includes('+'+d.added)) return verdict(false, '', 'chip missing or wrong: '+(chip && chip.textContent));
  const keepBtn = [...chip.querySelectorAll('button')].find(b=>b.textContent===t('diffKeep'));
  keepBtn.click();
  const restored = App.plan===first && !document.getElementById('diff-chip');
  App.ui.tab = tab; renderTab();
  return verdict(restored, 'chip shown, previous plan restored', 'plan not restored');
});

regress('ship: P4.3 dialogs and sheets trap Tab, wrap focus and give focus back to the opener', ()=>{
  closePop();
  if(sheet.current) sheet.current.close(true);
  document.querySelectorAll('.dialog, .scrim, .sheet').forEach(n=>n.remove());
  const opener = el('button', {type:'button'}, 'open'); document.body.appendChild(opener); opener.focus();
  try{
    confirmDialog('title', 'body', {label:'go'});
    const dlg = document.querySelector('.dialog');
    const btns = [...dlg.querySelectorAll('button')];
    const first = btns[0], last = btns[btns.length-1];
    last.focus();
    const e1 = shipKey('Tab'); document.dispatchEvent(e1);
    if(!e1.defaultPrevented || document.activeElement!==first) return verdict(false, '', 'Tab from the last button did not wrap');
    const e2 = shipKey('Tab', {shiftKey:true}); document.dispatchEvent(e2);
    if(!e2.defaultPrevented || document.activeElement!==last) return verdict(false, '', 'Shift+Tab from the first button did not wrap');
    opener.focus();
    const e3 = shipKey('Tab'); document.dispatchEvent(e3);
    if(!dlg.contains(document.activeElement)) return verdict(false, '', 'focus outside the dialog was not pulled back in');
    first.click();
    if(document.querySelector('.dialog')) return verdict(false, '', 'dialog did not close');
    if(document.activeElement!==opener) return verdict(false, '', 'focus not returned to the opener');
    const api = sheet({title:()=>'t', body:()=>[el('button', {id:'sb1', type:'button'}, 'a'), el('button', {id:'sb2', type:'button'}, 'b')]});
    document.getElementById('sb2').focus();
    const lastBtn = [...document.querySelectorAll('.sheet button')].pop();
    lastBtn.focus();
    const e4 = shipKey('Tab'); document.dispatchEvent(e4);
    const firstBtn = document.querySelector('.sheet button');
    const wrapped = e4.defaultPrevented && document.activeElement===firstBtn;
    api.close(true);
    if(!wrapped) return verdict(false, '', 'sheet did not wrap Tab');
    document.dispatchEvent(shipKey('Tab'));
    if(TrapStack.length!==0) return verdict(false, '', 'trap left behind: '+TrapStack.length);
    return verdict(true, 'dialog and sheet trap focus');
  } finally { opener.remove(); document.querySelectorAll('.dialog, .scrim, .sheet').forEach(n=>n.remove()); }
});

regress('ship: P4.4 the action bar never overflows its container at a narrow width', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  try{
    const plan = shipMonthPlan(71);
    App.plan = plan; App.ui.tab = 'plan'; renderTab();
    const bar = document.querySelector('.actionbar-inner');
    if(!bar) return verdict(false, '', 'no action bar');
    const kids = [...bar.children].filter(n=>n.offsetParent!==null);
    const overflow = bar.scrollWidth>bar.clientWidth+1;
    const css = [...document.styleSheets].some(s=>{ try{ return [...s.cssRules].some(r=>r.cssText && r.cssText.includes('.actionbar .status') && r.cssText.includes('min-width: 0')); }catch(e){ return false; } });
    return verdict(css && kids.length>=3 && !overflow, 'status shrinks, bar fits', 'css '+css+' kids '+kids.length+' overflow '+overflow);
  } finally { App.ui.tab = tab; renderTab(); shipRestoreApp(keep); }
});

shipAsync('ship: P4.5 at a narrow width a goal opens in its own sheet, and the wide layout is pinned for the master-detail tests', async ()=>{
  const tab = App.ui.tab;
  App.data = normalizeData(JSON.parse(SEED_JSON));
  const g = newGoal('cover'); S().goals.push(g);
  try{
    App.ui.gmForceWide = false;
    openGoals(g.id);
    await sleep(80);
    const sheets = document.querySelectorAll('.sheet');
    const card = document.querySelector('.sheet [data-goal="'+g.id+'"]');
    const narrowOk = sheets.length>=1 && !!card && !document.querySelector('.sheet.wide .gm-detail:not([hidden])');
    if(sheet.current) sheet.current.close(true);
    document.querySelectorAll('.sheet, .scrim').forEach(n=>n.remove());
    App.ui.gmForceWide = true;
    openGoals(g.id);
    const wideCard = document.querySelector('.sheet.wide .gm-detail [data-goal="'+g.id+'"]');
    if(sheet.current) sheet.current.close(true);
    return verdict(narrowOk && !!wideCard, 'narrow sheet and wide detail both render', 'narrow '+narrowOk+' wide '+!!wideCard);
  } finally { delete App.ui.gmForceWide; document.querySelectorAll('.sheet, .scrim').forEach(n=>n.remove()); App.ui.tab = tab; }
});

regress('ship: P5.1 the error diagnostic carries version and place but no names, messages or data, and toasts are rate limited', ()=>{
  const keep = shipKeep();
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.data.people[0].name = 'SECRET-PERSON-NAME'; App.data.facilities[0].name = 'SECRET-FACILITY';
    const err = new TypeError('boom SECRET-PERSON-NAME at SECRET-FACILITY');
    const d = buildDiagnostic(err);
    if(/SECRET/.test(d)) return verdict(false, '', 'diagnostic leaked data: '+d);
    if(!d.includes('al-Khitta '+APP_VERSION) || !d.includes('rulesRev '+RULES_REV) || !d.includes('TypeError')) return verdict(false, '', 'diagnostic incomplete: '+d);
    if(!/\.js:\d+:\d+/.test(d)) return verdict(false, '', 'no stack location: '+d);
    Diag.last = 0;
    document.querySelectorAll('.toasts .toast').forEach(n=>n.remove());
    const first = handleGlobalError(err), second = handleGlobalError(err);
    const toasts = [...document.querySelectorAll('.toasts .toast')].filter(n=>n.textContent.includes(t('copyDiag')));
    Diag.last = 0;
    document.querySelectorAll('.toasts .toast').forEach(n=>n.remove());
    return verdict(first===true && second===false && toasts.length===1, 'diagnostic is clean, one toast with a copy button', 'first '+first+' second '+second+' toasts '+toasts.length);
  } finally { shipRestoreApp(keep); }
});

regress('ship: P5.2 backups carry the app version and still restore', ()=>{
  const keep = shipKeep();
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    const raw = JSON.parse(new TextDecoder().decode(backupBytes()));
    if(raw.appVersion!==APP_VERSION) return verdict(false, '', 'appVersion '+raw.appVersion);
    const r = restoreBackupObject(raw);
    if(!(r.ok && r.data.people.length===App.data.people.length && !('appVersion' in r.data) && !('exportedAt' in r.data))) return verdict(false, '', 'restore ok '+r.ok+' stamps kept '+('appVersion' in (r.data || {})));
    const old = JSON.parse(JSON.stringify(raw)); old.appVersion = '0.0.1';
    const r2 = restoreBackupObject(old);
    App.data = r2.data;
    const again = JSON.parse(new TextDecoder().decode(backupBytes()));
    return verdict(again.appVersion===APP_VERSION, 'version stamped, ignored on restore, never inherited', 'stale version '+again.appVersion);
  } finally { shipRestoreApp(keep); }
});

shipAsync('ship: P5.3 xlsx exports carry the app version in the document properties and still read back', async ()=>{
  const bytes = buildXlsx([{name:'plan', rows:[['a', 'b'], ['1', '2']], widths:[10, 10]}]);
  const z = await readZip(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset+bytes.byteLength));
  const dec = new TextDecoder();
  const core = z.get('docProps/core.xml');
  if(!core) return verdict(false, '', 'no docProps/core.xml; parts: '+[...z.keys()].join(','));
  const ct = dec.decode(z.get('[Content_Types].xml')), rels = dec.decode(z.get('_rels/.rels'));
  const xml = dec.decode(core);
  if(!xml.includes('al-Khitta '+APP_VERSION)) return verdict(false, '', 'version missing: '+xml);
  if(!ct.includes('/docProps/core.xml') || !rels.includes('docProps/core.xml')) return verdict(false, '', 'package parts not linked');
  const sheet = dec.decode(z.get('xl/worksheets/sheet1.xml'));
  return verdict(sheet.includes('<t xml:space="preserve">a</t>'), 'core properties present, sheet intact', 'sheet content missing');
});

shipAsync('ship: P5.4 index.html, sw.js and the app agree on one version and every asset is versioned and precached', async ()=>{
  if(location.protocol!=='http:' && location.protocol!=='https:') return verdict(true, 'skipped on '+location.protocol);
  const html = await (await fetch('index.html')).text();
  const sw = await (await fetch('sw.js')).text();
  const swVer = sw.match(/const VERSION = '([^']+)'/)[1];
  if(swVer!==APP_VERSION) return verdict(false, '', 'sw '+swVer+' app '+APP_VERSION);
  const list = JSON.parse(sw.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
  const refs = [...html.matchAll(/(?:src|href)="((?:js|css|manifest)[^"]*)"/g)].map(m=>m[1]);
  if(refs.length<30) return verdict(false, '', 'only '+refs.length+' asset references');
  for(const r of refs){
    if(!r.endsWith('?v='+APP_VERSION)) return verdict(false, '', 'unversioned: '+r);
    if(!list.includes(r.split('?')[0])) return verdict(false, '', 'not precached: '+r);
  }
  if(/<script(?![^>]*\ssrc=)/.test(html)) return verdict(false, '', 'inline script in index.html');
  if(/googleapis|gstatic/.test(html + (await (await fetch('css/app.css')).text()))) return verdict(false, '', 'external font reference');
  const man = await (await fetch('manifest.webmanifest')).json();
  return verdict(man.icons.length>=3 && /Content-Security-Policy/.test(html), refs.length+' assets versioned and precached', 'manifest or CSP meta missing');
});

regress('ship: P4.6 the Rules tab opens in Simple mode with key rules only and no weights, Advanced shows everything, and search finds rules in any mode', ()=>{
  const keep = shipKeep(), tab = App.ui.tab, mode = App.ui.rulesMode;
  const store = window.__TEST_STORAGE__;
  try{
    App.ui.rulesMode = 'simple'; App.ui.tab = 'rules'; renderTab();
    const vis = id=>{ const n = document.getElementById(id); return !!n && n.offsetParent!==null; };
    const keyIds = ['rule-goals', 'rule-calendar', 'rule-volume', 'rule-gender', 'rule-pairs'];
    const advIds = ['rule-fixed', 'rule-rest', 'rule-days', 'rule-seniority', 'rule-fairness', 'rule-distance'];
    for(const id of keyIds) if(!vis(id)) return verdict(false, '', 'simple mode hides '+id);
    for(const id of advIds) if(vis(id)) return verdict(false, '', 'simple mode shows '+id);
    const chips = [...document.querySelectorAll('.layout-side .rule-sec:not(#rule-goals) .chip.level')].filter(c=>c.offsetParent!==null);
    if(chips.length<2) return verdict(false, '', 'too few level chips: '+chips.length);
    if(chips.some(c=>/\d/.test(c.textContent))) return verdict(false, '', 'a weight is visible in simple mode: '+chips.find(c=>/\d/.test(c.textContent)).textContent);
    const prefers = chips.filter(c=>c.dataset.level==='prefer');
    if(!prefers.length || prefers.some(c=>c.textContent.trim()!==t('lvPrefer'))) return verdict(false, '', 'a Prefer chip lost its label in simple mode: '+(prefers[0] ? JSON.stringify(prefers[0].textContent) : 'none'));
    const navHidden = [...document.querySelectorAll('.side-nav a[data-adv]')].every(a=>a.offsetParent===null);
    if(!navHidden) return verdict(false, '', 'advanced nav links visible');
    const search = document.getElementById('rules-search');
    search.value = t('rDistance'); search.dispatchEvent(new Event('input'));
    if(!vis('rule-distance') || vis('rule-goals')) return verdict(false, '', 'search did not narrow to the distance rules');
    search.value = 'zzzz-no-such-rule'; search.dispatchEvent(new Event('input'));
    const none = document.getElementById('rules-nomatch');
    if(!none || none.hidden) return verdict(false, '', 'no-match note missing');
    search.value = ''; search.dispatchEvent(new Event('input'));
    if(!vis('rule-goals') || vis('rule-distance')) return verdict(false, '', 'clearing the search did not restore simple mode');
    const seg = [...document.querySelectorAll('.rules-bar button')].find(b=>b.textContent===t('rulesAdvanced'));
    seg.click();
    if(App.ui.rulesMode!=='advanced' || store.getItem('alkhitta.rulesmode')!=='advanced') return verdict(false, '', 'mode not switched or not remembered');
    for(const id of keyIds.concat(advIds)) if(!vis(id)) return verdict(false, '', 'advanced mode hides '+id);
    const chips2 = [...document.querySelectorAll('.layout-side .chip.level')].filter(c=>c.offsetParent!==null);
    if(!chips2.some(c=>c.dataset.level==='prefer' && c.textContent.includes(t('lvPrefer')) && /\d/.test(c.textContent))) return verdict(false, '', 'advanced mode shows no weights');
    return verdict(true, 'simple hides '+advIds.length+' sections and weights, advanced shows all, search works');
  } finally { App.ui.rulesMode = mode; store.removeItem('alkhitta.rulesmode'); App.ui.tab = tab; renderTab(); shipRestoreApp(keep); }
});

regress('ship: P4.7 first-run guidance: a three step checklist on an empty plan, and empty states for facilities and team', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  try{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.plan = null; App.ui.tab = 'plan'; renderTab();
    const box = document.getElementById('first-run');
    if(!box || box.querySelectorAll('li').length!==3) return verdict(false, '', 'checklist missing or not 3 steps');
    document.getElementById('fr-team').click();
    if(App.ui.tab!=='team') return verdict(false, '', 'step 2 did not open the team tab');
    App.ui.tab = 'plan'; renderTab();
    document.getElementById('fr-days').click();
    if(App.ui.tab!=='rules') return verdict(false, '', 'step 1 did not open the rules tab');
    App.ui.tab = 'plan'; App.plan = shipMonthPlan(81); renderTab();
    if(document.getElementById('first-run')) return verdict(false, '', 'checklist still shown with a plan');
    App.data.facilities = []; App.ui.tab = 'facilities'; renderTab();
    if(!document.getElementById('fac-empty')) return verdict(false, '', 'no empty state for facilities');
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.data.people = []; App.ui.tab = 'team'; renderTab();
    if(!document.getElementById('team-empty')) return verdict(false, '', 'no empty state for team');
    return verdict(true, 'checklist, facilities and team empty states');
  } finally { App.ui.tab = tab; renderTab(); shipRestoreApp(keep); }
});

regress('ship: P4.8 solvable conflicts carry a one-click fix that removes the conflict and shows as a button', ()=>{
  const keep = shipKeep(), tab = App.ui.tab;
  const results = [];
  const run = ()=>generatePlan({seed:3, skipExplain:true, iters:20, timeScale:8});
  const scenario = (name, setup, keyOf, fixType)=>{
    App.data = normalizeData(JSON.parse(SEED_JSON));
    shipSetSpan(20);
    setup(S());
    const r = run();
    const c = (r.conflicts || (r.plan && r.plan.conflicts) || []).find(x=>x.key===keyOf && x.fix && x.fix.type===fixType);
    if(!c) return name+': no '+keyOf+' with a '+fixType+' fix (got '+((r.conflicts || []).map(x=>x.key).join(',') || r.status)+')';
    if(r.plan){
      App.plan = r.plan; App.ui.tab = 'plan'; renderTab();
      const btn = document.querySelector('.conflict-fix');
      if(!btn) return name+': banner shows no fix button';
    }
    if(!applyConflictFix(c)) return name+': fix did not apply';
    const r2 = run();
    const left = (r2.conflicts || (r2.plan && r2.plan.conflicts) || []).filter(x=>x.key===keyOf && JSON.stringify(x.fix)===JSON.stringify(c.fix));
    if(left.length) return name+': conflict still present after the fix';
    results.push(name);
    return null;
  };
  try{
    const errs = [
      scenario('exact over capacity', s=>{ s.volume.mode = 'exact'; s.volume.exact.contracted = 400; }, 'xDayKindCapacity', 'setExact'),
      scenario('every day needs more visits', s=>{ s.volume.mode = 'exact'; s.volume.exact.basic = 1; s.volume.exact.contracted = 0; s.volume.requireEveryEligibleDay = true; }, 'xEveryDayVolume', 'noEveryDay'),
      scenario('day rule with no candidate', s=>{ s.volume.mode = 'exact'; s.volume.exact.basic = 3; s.volume.exact.contracted = 0; const wd = s.calendar.workdays[0]; const d = normalizeDay(s.days[wd] || {}); d.kind = {kind:'contracted', howMany:'one', lv:{level:'must', w:5}}; s.days[wd] = d; }, 'xDayRuleNone', 'dayPrefer'),
      scenario('impossible Must goal', s=>{ const g = newGoal('atLeast'); g.n = 5000; g.lv = {level:'must', w:5}; g.on = true; s.goals.push(g); }, 'xAtLeastPool', 'goalPrefer')
    ].filter(Boolean);
    if(errs.length) return verdict(false, '', errs.join(' | '));
    return verdict(results.length===4, results.join(', ')+' fixed', 'only '+results.length);
  } finally { App.ui.tab = tab; renderTab(); shipRestoreApp(keep); }
});
