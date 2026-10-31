const IMPH = ['جهة المرور', 'المنطقة', 'الخطة', 'المرور', 'التاريخ', 'القائم بالمرور'];
const impFresh = ()=>{ App.data = normalizeData(JSON.parse(SEED_JSON)); App.plan = null; return App.data; };
const impFacs = n=>App.data.facilities.filter(f=>!f.excluded).slice(0, n);
const impRow = (f, type, date, team, cycle)=>[f.name, f.category || 'التانية', cycle==null ? 1 : cycle, type, date, team];

shipAsync('v6 import: team lists split on every separator, trim, fold and dedupe', async ()=>{
  const cases = [
    ['شوقي - شرنوبي', ['شوقي', 'شرنوبي']],
    ['اباظة -لبني', ['اباظة', 'لبني']],
    ['اديب-اسماء', ['اديب', 'اسماء']],
    ['صبحي – ميسرة', ['صبحي', 'ميسرة']],
    ['مريم، لبني', ['مريم', 'لبني']],
    ['غادة / هنداوي', ['غادة', 'هنداوي']],
    ['حمودين - حمودين - حمودين', ['حمودين']],
    ['لبني و غادة', ['لبني', 'غادة']],
    ['وليد - لبني', ['وليد', 'لبني']],
    ['شلتوت\u00A0-\u200Bشرنوبي  ', ['شلتوت', 'شرنوبي']],
    ['ميسرة\nشرنوبي\nاماني', ['ميسرة', 'شرنوبي', 'اماني']],
    ['اماني - ', ['اماني']],
    ['اباظه - أباظة', ['اباظه']],
    ['', []],
    [null, []]
  ];
  const bad = [];
  for(const [raw, want] of cases){ const got = ImpText.splitList(raw); if(JSON.stringify(got)!==JSON.stringify(want)) bad.push(JSON.stringify(raw)+' -> '+JSON.stringify(got)); }
  return verdict(bad.length===0, cases.length+' team strings', bad.join(' | '));
});

shipAsync('v6 import: the matcher resolves exact, alias, article and spacing variants and only suggests the rest', async ()=>{
  impFresh();
  const pm = impPeopleMatcher();
  const bad = [];
  const want = (raw, tier)=>{ const r = pm.resolve(raw); if(r.tier!==tier) bad.push(raw+' '+r.tier+' want '+tier); return r; };
  const a = want('اباظة', 'exact'); if(!a.id) bad.push('abaza id');
  want('أباظة', 'exact'); want('حمودين ', 'exact'); want('شرنوبى', 'exact'); want('ابظة', 'alias');
  want('زائر غريب', 'none');
  const fm = impFacilityMatcher();
  const f0 = App.data.facilities[0];
  const r1 = fm.resolve(f0.name+'  '); if(!['exact', 'loose'].includes(r1.tier) || r1.id!==f0.id) bad.push('facility spacing');
  const r2 = fm.resolve(f0.name.replace(/^ال/, '')); if(r2.id && r2.id!==f0.id) bad.push('article wrongly matched another facility');
  return verdict(bad.length===0, 'tiers correct', bad.join(' | '));
});

shipAsync('v6 import: only خطة المرور rows are imported, however the type is spelled', async ()=>{
  impFresh();
  const [a, b, c] = impFacs(3);
  const rows = [['سجل المرور'], IMPH,
    impRow(a, 'خطة المرور', '2025-01-05', 'صبحي - ميسرة'),
    impRow(b, 'خطه المرور ', '2025-01-06', 'اباظة -لبني'),
    impRow(c, 'خطة  المرور', '2025-01-07', 'اديب-اسماء'),
    impRow(a, 'نيابة', '2025-01-08', 'هنداوي'),
    impRow(b, 'فحص', '2025-01-09', 'شلتوت'),
    impRow(c, 'لجنة الايرادات', '2025-01-10', 'غادة'),
    ['', '', '', '', '', ''],
    impRow(a, 'خطة المرور', 'ليس تاريخا', 'مريم')];
  const pv = previewImport('history', rows, {});
  const types = pv.types.map(t=>t.label+'='+t.count+(t.included ? '*' : '')).join(',');
  const ok_ = pv.recs.length===3 && pv.ignoredByType===3 && pv.bad===1 && pv.blank===1 && pv.hasType && !pv.typeFallback;
  return verdict(ok_, '3 plan visits, 3 ignored by type, 1 bad date: '+types, JSON.stringify({recs:pv.recs.length, ign:pv.ignoredByType, bad:pv.bad, blank:pv.blank, types}));
});

shipAsync('v6 import: the user can include other visit types and the choice is applied', async ()=>{
  impFresh();
  const [a, b] = impFacs(2);
  const rows = [IMPH, impRow(a, 'خطة المرور', '2025-02-01', 'صبحي'), impRow(b, 'نيابة', '2025-02-02', 'اباظة')];
  const base = previewImport('history', rows, {});
  const nay = base.types.find(t=>t.label==='نيابة');
  const more = previewImport('history', rows, {includeTypes:base.types.filter(t=>t.included).map(t=>t.key).concat(nay.key)});
  return verdict(base.recs.length===1 && more.recs.length===2 && more.types.every(t=>t.included), '1 then 2 visits', base.recs.length+' then '+more.recs.length);
});

shipAsync('v6 import: a file with no type column imports every row', async ()=>{
  impFresh();
  const [a, b] = impFacs(2);
  const rows = [['جهة المرور', 'التاريخ', 'القائم بالمرور'], [a.name, '2025-03-01', 'صبحي - ميسرة'], [b.name, '2025-03-02', 'اباظة']];
  const pv = previewImport('history', rows, {});
  return verdict(pv.recs.length===2 && !pv.hasType, 'both rows, no type column', JSON.stringify({recs:pv.recs.length, hasType:pv.hasType}));
});

shipAsync('v6 import: applying stores canonical names, dates, counts and the cycle, and re-importing adds nothing', async ()=>{
  const D = impFresh();
  const [a, b] = impFacs(2);
  const ab = D.people.find(p=>ImpText.key(p.name)===ImpText.key('اباظة')), lb = D.people.find(p=>ImpText.key(p.name)===ImpText.key('لبني'));
  const rows = [IMPH, impRow(a, 'خطة المرور', '2025-04-01', 'اباظه -لبني', 7), impRow(a, 'خطة المرور', '2025-04-20', 'لبني', 7), impRow(b, 'خطة المرور', '2025-04-05', 'اباظة', 8)];
  const pv = previewImport('history', rows, {});
  applyImport(pv);
  const f = facilityById(a.id);
  const first = f.history.find(h=>h.date==='2025-04-01');
  const again = previewImport('history', rows, {});
  const c0 = JSON.stringify(App.data.history.counts), v0 = sum(App.data.facilities, x=>x.visitCount||0);
  applyImport(again);
  const ok_ = f.visitCount===2 && f.lastVisit==='2025-04-20' && first.team.includes(ab.name) && first.team.includes(lb.name) && App.data.history.lastCycle===8
    && App.data.history.counts[ab.id]===2 && App.data.history.fpv[a.id+'|'+ab.id]===1 && again.recs.length===0 && again.dupExisting===3
    && JSON.stringify(App.data.history.counts)===c0 && sum(App.data.facilities, x=>x.visitCount||0)===v0 && App.data.history.keys.length===3;
  return verdict(ok_, 'stored once, canonical, idempotent', JSON.stringify({vc:f.visitCount, lv:f.lastVisit, team:first && first.team, cycle:App.data.history.lastCycle, again:again.recs.length, dup:again.dupExisting, keys:App.data.history.keys.length}));
});

shipAsync('v6 import: duplicates inside the file and against earlier-imported history are skipped', async ()=>{
  const D = impFresh();
  const [a] = impFacs(1);
  const pre = D.people.find(p=>ImpText.key(p.name)===ImpText.key('صبحي'));
  facilityById(a.id).history = [{date:'2025-05-02', team:[pre.name]}];
  const rows = [IMPH, impRow(a, 'خطة المرور', '2025-05-01', 'صبحي - ميسرة'), impRow(a, 'خطة المرور', '2025-05-01', 'ميسرة - صبحي'), impRow(a, 'خطة المرور', '2025-05-02', 'صبحي')];
  const pv = previewImport('history', rows, {});
  return verdict(pv.recs.length===1 && pv.dupFile===1 && pv.dupExisting===1, '1 new, 1 repeated in file, 1 already there', JSON.stringify({recs:pv.recs.length, f:pv.dupFile, e:pv.dupExisting}));
});

shipAsync('v6 import: unknown people can be created, mapped or left for later, and the choice is remembered', async ()=>{
  const D = impFresh();
  const [a, b] = impFacs(2);
  const rows = [IMPH, impRow(a, 'خطة المرور', '2025-06-01', 'صبحي - زائر اول'), impRow(b, 'خطة المرور', '2025-06-02', 'زائر ثان - ميسرة'), impRow(a, 'خطة المرور', '2025-06-03', 'زائر ثالث')];
  const pv = previewImport('history', rows, {});
  const names = pv.unknownPeople.map(u=>u.name).sort().join('|');
  const keyOf = n=>ImpText.key(n);
  const target = D.people.find(p=>ImpText.key(p.name)===ImpText.key('هنداوي'));
  const n0 = D.people.length;
  const pv2 = previewImport('history', rows, {peopleMap:{[keyOf('زائر اول')]:'new', [keyOf('زائر ثان')]:target.id, [keyOf('زائر ثالث')]:'skip'}});
  applyImport(pv2);
  const created = D.people.find(p=>ImpText.key(p.name)===keyOf('زائر اول'));
  const ok_ = pv.unknownPeople.length===3 && D.people.length===n0+1 && !!created && D.aliases.people[keyOf('زائر اول')]===created.id && D.aliases.people[keyOf('زائر ثان')]===target.id && D.unresolved.length===0
    && facilityById(b.id).history[0].team.includes(target.name) && !facilityById(a.id).history.some(h=>h.team.includes('زائر ثالث'));
  const later = (()=>{ impFresh(); const p = previewImport('history', rows, {}); applyImport(p); return App.data.unresolved.length; })();
  return verdict(ok_ && later===3, 'create, map, skip and decide-later behave', JSON.stringify({names, people:D.people.length-n0, later}));
});

shipAsync('v6 import: an ambiguous facility is never guessed, and a chosen link is remembered', async ()=>{
  const D = impFresh();
  const base = D.facilities[0];
  const mk = (id, name)=>({id, name, category:base.category, locationId:base.locationId, kindOverride:null, freq:1, importance:50, pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:null});
  D.facilities.push(mk('t1', 'الزهراء قوي عاملة'), mk('t2', 'الزهراء طلاب'));
  const rows = [IMPH, ['الزهراء', 'التالتة', 1, 'خطة المرور', '2025-07-01', 'صبحي'], ['الزهراء', 'التالتة', 1, 'خطة المرور', '2025-07-09', 'ميسرة']];
  const pv = previewImport('history', rows, {});
  const un = pv.facilities.find(f=>f.name==='الزهراء');
  const key = ImpText.key('الزهراء');
  const pv2 = previewImport('history', rows, {facilityMap:{[key]:'t2'}});
  applyImport(pv2);
  const pv3 = previewImport('history', [IMPH, ['الزهراء', 'التالتة', 1, 'خطة المرور', '2025-08-01', 'صبحي']], {});
  const st3 = pv3.facilities[0];
  const ok_ = un && !un.id && un.candidates.length>=2 && facilityById('t2').visitCount===2 && D.aliases.facilities[key]==='t2' && st3.id==='t2' && st3.tier==='alias';
  return verdict(!!ok_, 'two candidates, user picked one, alias remembered', JSON.stringify({un:un && {id:un.id, c:un.candidates.length}, vc:facilityById('t2').visitCount, al:D.aliases.facilities[key], st3:st3 && st3.tier}));
});

shipAsync('v6 import: the right sheet is chosen from a workbook, by header and by name', async ()=>{
  impFresh();
  const [a] = impFacs(1);
  const good = [IMPH, impRow(a, 'خطة المرور', '2025-09-01', 'صبحي - ميسرة')];
  const other = [['القائم بالمرور', 'التاريخ', 'جهة المرور', 'الموقع'], ['صبحي', '2025-09-01', a.name, 'دمنهور']];
  const summary = [['المنطقة', '(All)'], ['x', 1]];
  const cases = [
    [[{name:'ملخص', rows:summary}, {name:'الاصلي', rows:good}, {name:'تجميع', rows:good}], 'الاصلي'],
    [[{name:'تجميع', rows:good}, {name:'الاصلي', rows:good}], 'الاصلي'],
    [[{name:'ملخص', rows:summary}, {name:'اولى', rows:good}, {name:'ثانية', rows:good}], 'اولى'],
    [[{name:'ملخص', rows:summary}, {name:'اخرى', rows:other}, {name:'سجل', rows:good}], 'سجل']
  ];
  const bad = [];
  for(const [sheets, want] of cases){ const pv = previewImportSheets('history', sheets, {}); if(pv.sheet!==want) bad.push(pv.sheet+' want '+want); }
  const forced = previewImportSheets('history', cases[0][0], {sheet:'تجميع'});
  if(forced.sheet!=='تجميع') bad.push('forced sheet ignored');
  return verdict(bad.length===0, '4 workbooks and an override', bad.join(' | '));
});

shipAsync('v6 import: a workbook is read in sheet order with names, and the header can sit below a title', async ()=>{
  const sheets = [{name:'الاصلي', rows:[['عنوان'], IMPH, ['س', 'ص', 1, 'خطة المرور', '2025-01-01', 'أ - ب']]}, {name:'Two', rows:[['a', 'b'], [1, 2]]}, {name:'ثلاثة', rows:[['x']]}];
  const buf = buildXlsx(sheets);
  const back = await readWorkbook(buf.buffer ? buf.buffer.slice(buf.byteOffset, buf.byteOffset+buf.byteLength) : buf);
  const names = back.map(s=>s.name).join('|');
  const hdr = ImportPipeline.findHeader(back[0].rows, HISTORY_SPEC);
  return verdict(names==='الاصلي|Two|ثلاثة' && back[0].rows.length===3 && hdr.index===1 && !hdr.missing.length, names+', header on row 2', JSON.stringify({names, hdr:hdr.index, rows:back[0].rows.length}));
});

shipAsync('v6 import: history keys and facility aliases survive normalise and backup round trips', async ()=>{
  const D = impFresh();
  const [a] = impFacs(1);
  applyImport(previewImport('history', [IMPH, impRow(a, 'خطة المرور', '2025-10-01', 'صبحي')], {}));
  D.aliases.facilities.demo = a.id;
  const back = normalizeData(JSON.parse(JSON.stringify(App.data)));
  const dirty = JSON.parse(JSON.stringify(App.data));
  dirty.history.keys = ['ok', 5, null, 'x'.repeat(400)];
  dirty.aliases = {people:{}, facilities:'bad'};
  const fixed = sanitizeBackup(dirty);
  const ok_ = back.history.keys.length===1 && back.aliases.facilities.demo===a.id && (fixed.history.keys.join()==='ok') && typeof fixed.aliases.facilities==='object';
  return verdict(ok_, 'kept and sanitised', JSON.stringify({keys:back.history.keys.length, al:back.aliases.facilities, fixed:fixed.history.keys}));
});

shipAsync('v6 import: imported history feeds the planner (last visit, rotation) and a plan still generates', async ()=>{
  const D = impFresh();
  const fs = impFacs(4);
  const rows = [IMPH].concat(fs.map((f, i)=>impRow(f, 'خطة المرور', isoOf(todayOrd()-3-i), 'صبحي - ميسرة')));
  applyImport(previewImport('history', rows, {}));
  const H = historyIndex(todayOrd());
  const sb = D.people.find(p=>ImpText.key(p.name)===ImpText.key('صبحي'));
  const r = generatePlan({seed:1, iters:40, skipExplain:true});
  return verdict(H.map.has(sb.id) && H.unresolved===0 && !!r.plan, 'history index sees the people, plan generated', JSON.stringify({has:H.map.has(sb.id), un:H.unresolved, plan:!!r.plan}));
});
