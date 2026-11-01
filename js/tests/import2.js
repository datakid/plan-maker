const imp2Fresh = ()=>{ App.data = normalizeData(JSON.parse(SEED_JSON)); App.plan = null; return App.data; };
const imp2Rows = (sheets, name)=>sheets.find(s=>s.name===name).rows;

shipAsync('v6 import2: templates are built from the spec, round-trip through xlsx, and import cleanly in both languages', async ()=>{
  const keep = App.ui.lang;
  const bad = [];
  try{
    for(const lang of ['ar', 'en']){
      App.ui.lang = lang;
      for(const kind of ['history', 'facilities', 'team']){
        imp2Fresh();
        const sheets = ImportTemplates.sheets(kind);
        const back = await readWorkbook(buildXlsx(sheets).buffer ? buildXlsx(sheets).buffer : buildXlsx(sheets));
        if(back.length!==sheets.length || back.map(s=>s.name).join('|')!==sheets.map(s=>s.name).join('|')) bad.push(lang+'/'+kind+' sheets '+back.map(s=>s.name));
        const pv = previewImportSheets(kind, back, {});
        if(pv.error){ bad.push(lang+'/'+kind+' error '+pv.error); continue; }
        if(pv.sheet!==sheets[0].name) bad.push(lang+'/'+kind+' picked '+pv.sheet);
        if(kind==='history' && !(pv.recs.length===1 && pv.ignoredByType===1)) bad.push(lang+'/history '+pv.recs.length+' recs');
        if(kind==='facilities' && !(pv.added.length===2 && pv.panels.some(p=>p.type==='check' && /3/.test(p.text||'')) )) bad.push(lang+'/facilities added '+pv.added.length);
        if(kind==='team' && !(pv.added.length===2 && !pv.panels.some(p=>p.type==='map' && p.opt==='poolMap') && pv.bad.length===0)) bad.push(lang+'/team added '+pv.added.length+' bad '+pv.bad.length);
        if(pv.unused.length) bad.push(lang+'/'+kind+' unused columns '+pv.unused.join(','));
      }
    }
  } finally { App.ui.lang = keep; }
  return verdict(bad.length===0, '3 kinds x 2 languages round-trip', bad.slice(0, 5).join(' | '));
});

shipAsync('v6 import2: every field has an Arabic and English description and an instructions row', async ()=>{
  const bad = [];
  for(const kind of ['history', 'facilities', 'team']){
    const spec = IMPORT_SPECS[kind];
    for(const k of Object.keys(spec.cols)){
      const f = spec.fields[k];
      if(!f || !f.ar || !f.en) bad.push(kind+'.'+k+' lacks a description');
    }
    for(const r of spec.required) if(!(spec.fields[r] && spec.fields[r].req)) bad.push(kind+'.'+r+' required but not marked');
    const ins = ImportTemplates.instructions(kind);
    if(ins.length<Object.keys(spec.cols).length+2) bad.push(kind+' instructions too short');
  }
  return verdict(bad.length===0, 'all fields documented', bad.slice(0, 5).join(' | '));
});

shipAsync('v6 import2: a sheet with two side-by-side tables is split into blocks and each is ranked on its own', async ()=>{
  imp2Fresh();
  const rows = [['الجهة', 'المنطقة', 'الموقع', '', 'الموقع', 'بدل سفر', 'المسافة'], ['اختبار ا', 'اشعة', 'ضاحية', '', 'ضاحية', true, '12.5'], ['اختبار ب', 'اشعة', 'ضاحية', '', 'قرية', false, '30']];
  const tables = ImportPipeline.tables([{name:'الجهات', rows}, {name:'ورقة', rows:[['a', 'b'], [1, 2]]}]);
  const ids = tables.map(x=>x.id).join('|');
  const pv = previewImportSheets('facilities', [{name:'الجهات', rows}], {});
  const loc = ImportPipeline.rankSheets('locations', tables).find(x=>x.complete);
  const ok_ = tables.length===3 && /A:C/.test(ids) && /E:G/.test(ids) && pv.sheet.endsWith('A:C') && !!loc && loc.name.endsWith('E:G') && pv.unused.includes('بدل سفر')
    && pv.added.length===2 && pv.added[0].km===12.5 && pv.locations.find(l=>l.key===ImpText.key('ضاحية')).km===12.5;
  return verdict(ok_, ids+'; km from the second block', JSON.stringify({ids, sheet:pv.sheet, unused:pv.unused, km:pv.added[0] && pv.added[0].km}));
});

shipAsync('v6 import2: unresolved categories must be decided, then the choice is applied and remembered', async ()=>{
  const D = imp2Fresh();
  const base = D.facilities.find(f=>f.category==='الثانية');
  const rows = [['الجهة', 'المنطقة', 'الموقع'], [base.name, 'التانية', ''], ['جهة جديدة اختبار', 'تصنيف غريب', '']];
  const key1 = ImpText.key('التانية'), key2 = ImpText.key('تصنيف غريب');
  let pv = previewImport('facilities', rows, {});
  const blocked = !pv.canApply && pv.undecidedCats===2 && pv.categories.find(c=>c.key===key1).candidates.some(c=>c.id==='الثانية');
  pv = previewImport('facilities', rows, {categoryMap:{[key1]:'الثانية', [key2]:'new:contracted'}});
  const n0 = D.categories.length;
  applyImport(pv);
  const created = D.categories.find(c=>c.name==='تصنيف غريب');
  const al = D.aliases.categories[key1];
  const next = previewImport('facilities', rows, {});
  const ok_ = blocked && pv.canApply && created && created.kind==='contracted' && D.categories.length===n0+1 && al==='الثانية' && facilityById(base.id).category==='الثانية'
    && next.categories.find(c=>c.key===key1).tier==='alias' && next.undecidedCats===0;
  return verdict(!!ok_, 'blocked until decided; mapped, created and remembered', JSON.stringify({blocked, al, kind:created && created.kind, tier:next.categories[0].tier}));
});

shipAsync('v6 import2: field chips switch each change on or off, and a last visit never moves back', async ()=>{
  const D = imp2Fresh();
  const f = D.facilities[0];
  f.lastVisit = '2026-05-01';
  const rows = [['الاسم', 'التصنيف', 'الوتيرة', 'الأهمية', 'الحالة', 'آخر زيارة'], [f.name, f.category, '2', '80', 'مثبتة', '2026-01-01']];
  const pv = previewImport('facilities', rows, {});
  const hasAll = ['freq', 'importance', 'status'].every(k=>pv.withChanges.includes(k)) && !pv.withChanges.includes('last') && !pv.withChanges.includes('category');
  const some = previewImport('facilities', rows, {fields:['freq']});
  applyImport(some);
  const mid = f.freq===2 && f.importance!==80 && !f.pinned && f.lastVisit==='2026-05-01';
  const rest = previewImport('facilities', rows, {});
  applyImport(rest);
  const ok_ = hasAll && mid && f.importance===80 && f.pinned===true && f.lastVisit==='2026-05-01';
  return verdict(ok_, 'only chosen fields change; older date ignored', JSON.stringify({hasAll, mid, imp:f.importance, pinned:f.pinned, lv:f.lastVisit}));
});

shipAsync('v6 import2: new facilities and locations are created with distances, and bad values are reported not applied', async ()=>{
  const D = imp2Fresh();
  const rows = [['الاسم', 'التصنيف', 'الموقع', 'المسافة (كم)', 'الوتيرة', 'الأهمية', 'الحالة'],
    ['جهة س', 'اشعة', 'قرية جديدة', '٣٨٫٢', '1', '50', 'مدرجة'],
    ['جهة ص', 'اشعة', 'قرية جديدة', 'abc', '1', '500', 'غريبة'],
    ['جهة س', 'اشعة', 'قرية جديدة', '1', '1', '50', ''],
    ['', '', '', '', '', '', '']];
  const pv = previewImport('facilities', rows, {});
  const fields = pv.bad.map(b=>b.field).sort().join(',');
  applyImport(pv);
  const loc = D.locations.find(l=>l.name==='قرية جديدة');
  const s = D.facilities.find(x=>x.name==='جهة س'), c = D.facilities.find(x=>x.name==='جهة ص');
  const ok_ = pv.added.length===2 && pv.dupFile===1 && fields==='importance,km,status' && !!loc && loc.km===38.2 && s.locationId===loc.id && c.importance===50 && s.review==='new';
  return verdict(!!ok_, 'Arabic digits parsed, duplicates and bad values handled', JSON.stringify({added:pv.added.length, dup:pv.dupFile, fields, km:loc && loc.km}));
});

shipAsync('v6 import2: people are matched, changed field by field, and similar new names are only suggested', async ()=>{
  const D = imp2Fresh();
  const p0 = D.people[0], p1 = D.people[1];
  const poolA = S().pools[0], poolB = S().pools[1] || S().pools[0];
  const rows = [['الاسم', 'المجموعة', 'النوع', 'نشط', 'خبرة أساسية', 'خبرة متعاقدة', 'عدد ثابت', 'الوظيفة', 'محل الاقامة'],
    [p0.name+'  ', poolName(poolB), 'أنثى', 'لا', '70', '30', '6', 'محاسبة', 'مكان جديد للفرد'],
    [p1.name.slice(0, -1)+'ى', '', '', '', '', '', '', '', ''],
    ['فرد جديد تماما', 'مجموعة مجهولة', 'x', 'ربما', '150', '', '2.5', '', ''],
    ['فرد جديد تماما', '', '', '', '', '', '', '', '']];
  const pv = previewImport('team', rows, {});
  const ch = pv.changes;
  const matched = pv.changed.some(r=>r.ex.id===p0.id);
  const badFields = pv.bad.map(b=>b.field).sort().join(',');
  const unresolvedPool = pv.panels.some(p=>p.type==='map' && p.opt==='poolMap');
  const before = {pool:p0.pool, skill:p0.skill.basic};
  const sub = previewImport('team', rows, {fields:['skillB', 'fixed']});
  applyImport(sub);
  const mid = p0.skill.basic===70 && p0.pool===before.pool && p0.quota.min===6 && p0.active!==false;
  const full = previewImport('team', rows, {});
  applyImport(full);
  const created = D.people.find(p=>p.name==='فرد جديد تماما');
  const ok_ = matched && pv.dupFile===1 && badFields==='active,fixed,gender,skillB' && unresolvedPool && mid && p0.active===false && p0.gender==='f' && p0.title==='محاسبة' && !!created && created.pool===poolA.id && D.locations.some(l=>l.name==='مكان جديد للفرد') && created.skill.basic!==150;
  return verdict(!!ok_, 'matched, toggled, defaulted pool, bad values ignored', JSON.stringify({matched, badFields, unresolvedPool, mid, pool:created && created.pool}));
});

shipAsync('v6 import2: a pool can be chosen for an unknown pool name, and people linked or ignored through the map', async ()=>{
  const D = imp2Fresh();
  const pools = S().pools;
  if(pools.length<2) return verdict(true, 'seed has a single pool');
  const target = pools[1];
  const sim = D.people[0];
  const rows = [['الاسم', 'المجموعة'], ['زائر ا', 'مجموعة غريبة'], [sim.name+' ا', poolName(target)], ['زائر ج', 'مجموعة غريبة']];
  const pv = previewImport('team', rows, {});
  const key = ImpText.key('مجموعة غريبة');
  const simRec = pv.recs.find(r=>r.name===sim.name+' ا');
  const sugg = simRec && simRec.person.candidates.some(c=>c.id===sim.id);
  const pv2 = previewImport('team', rows, {poolMap:{[key]:target.id}, peopleMap:{[ImpText.key(sim.name+' ا')]:sim.id, [ImpText.key('زائر ج')]:'skip'}});
  const n0 = D.people.length;
  applyImport(pv2);
  const a = D.people.find(p=>p.name==='زائر ا');
  const ok_ = sugg && a && a.pool===target.id && D.people.length===n0+1 && !D.people.some(p=>p.name==='زائر ج') && D.aliases.people[ImpText.key(sim.name+' ا')]===sim.id;
  return verdict(!!ok_, 'pool chosen, similar name linked, one ignored', JSON.stringify({sugg, pool:a && a.pool, added:D.people.length-n0}));
});

shipAsync('v6 import2: the old row-array API still returns added, changed and an undoable import', async ()=>{
  const D = imp2Fresh();
  const p = D.people[0];
  const pv = previewImport('team', [['الاسم', 'عدد ثابت'], [p.name, '7']]);
  const shape = Array.isArray(pv.added) && Array.isArray(pv.changed) && pv.kind==='team';
  applyImport(pv);
  const snaps = readSnapshots();
  return verdict(shape && p.quota.min===7 && snaps.length && snaps[snaps.length-1].reason==='import', 'compatible shape and snapshot', JSON.stringify({shape, q:p.quota}));
});

shipAsync('v6 import2: the preview card draws every kind from its panels without errors', async ()=>{
  const bad = [];
  imp2Fresh();
  goTab('data');
  const cases = [
    ['history', ImportTemplates.sheets('history')],
    ['facilities', ImportTemplates.sheets('facilities')],
    ['team', ImportTemplates.sheets('team')]
  ];
  for(const [kind, sheets] of cases){
    App.ui.impKind = kind;
    App.ui.impOpts = {};
    App.ui.impPreview = previewImportSheets(kind, sheets, {});
    renderTab();
    const card = document.getElementById('import-card');
    const text = card ? card.textContent : '';
    if(!card || text.includes('undefined') || text.includes('NaN') || text.length<40) bad.push(kind+' card text');
    const apply = card && [...card.querySelectorAll('button.primary')].find(b=>b.textContent.trim()===t('impApply'));
    if(!apply || apply.disabled) bad.push(kind+' apply missing or disabled');
    if(card && card.scrollWidth>card.clientWidth+1) bad.push(kind+' overflows '+card.scrollWidth+'>'+card.clientWidth);
  }
  App.ui.impPreview = null; App.ui.impKind = null;
  goTab('plan');
  return verdict(bad.length===0, '3 previews render and can be applied', bad.join(' | '));
});
