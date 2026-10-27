regress('v5 P1.1: seat stepper with a default steps from the shown default, not from 0 or 9', ()=>{
  let got = 'unset';
  const s = Stepper(null, v=>{ got = v; }, {min:0, max:9, nullable:true, base:2, placeholder:'2'});
  const dec = s.querySelectorAll('button')[0], inc = s.querySelectorAll('button')[1];
  const trail = [];
  dec.click(); trail.push(got);
  dec.click(); trail.push(got);
  inc.click(); trail.push(got);
  const s2 = Stepper(null, v=>{ got = v; }, {min:0, max:9, nullable:true, base:2, placeholder:'2'});
  s2.querySelectorAll('button')[1].click();
  trail.push(got);
  return verdict(trail.join(',')==='1,0,1,3', 'null,-,-,+ gives 1,0,1 and a fresh + gives 3', trail.join(','));
});

regress('v5 P1.1: steppers without a default keep their old behaviour', ()=>{
  let got = 'unset';
  const a = Stepper(null, v=>{ got = v; }, {min:1, max:10, nullable:true, placeholder:'—'});
  a.querySelectorAll('button')[1].click();
  const up = got;
  got = 'unset';
  const b = Stepper(null, v=>{ got = v; }, {min:1, max:60, nullable:true, placeholder:'—'});
  b.querySelectorAll('button')[0].click();
  const dn = got;
  got = 'unset';
  const c = Stepper(1, v=>{ got = v; }, {min:1, max:10, nullable:true, placeholder:'—'});
  c.querySelectorAll('button')[0].click();
  const clr = got;
  return verdict(up===1 && dn==='unset' && clr===null, 'null+ gives min, null- is disabled, min- clears', 'up '+up+' dn '+dn+' clr '+clr);
});

regress('v5 P1.1: the per-pool Default button clears the override and the chip marks a custom value', ()=>{
  Fx.use({days:6, pools:[{id:'a', basic:2, contracted:2}], facilities:Fx.fac(3), people:Fx.ppl(['p1','p2','p3'])});
  const o = {id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:[], fill:true, seats:{a:1}};
  let n = 0;
  const nodes = visitSpecFields(o, ()=>{ n++; }, (lab, ctl)=>el('div', {class:'field'}, [el('label', null, lab), ctl]));
  const host = el('div', null, nodes);
  const chipOn = !!host.querySelector('.chip.on');
  const defBtn = [...host.querySelectorAll('button')].find(b=>b.textContent===t('vsDefault'));
  if(!defBtn) return verdict(false, '', 'no Default button');
  defBtn.click();
  return verdict(chipOn && o.seats==null && n===1, 'chip shown, seats reset to null', 'chip '+chipOn+' seats '+JSON.stringify(o.seats)+' n '+n);
});

regress('v5 P1.2: duplicate fixed visits and a special on the same place are detected', ()=>{
  Fx.use({days:10, facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3','p4']),
    overrides:[
      {id:'o1', on:true, date:Fx.iso(2), facilityId:'f1', people:['p1'], fill:false},
      {id:'o2', on:true, date:Fx.iso(2), facilityId:'f1', people:['p2'], fill:false},
      {id:'o3', on:true, date:Fx.iso(4), facilityId:'f2', people:['p3'], fill:false},
      {id:'o4', on:false, date:Fx.iso(4), facilityId:'f2', people:['p4'], fill:false}
    ],
    goals:[
      Object.assign(newGoal('special'), {id:'s1', facilityId:'f1', from:Fx.iso(1), to:Fx.iso(3), times:1}),
      Object.assign(newGoal('special'), {id:'s2', facilityId:'f3', from:Fx.iso(1), to:Fx.iso(3), times:2}),
      Object.assign(newGoal('special'), {id:'s3', facilityId:'f2', from:Fx.iso(6), to:Fx.iso(8), times:1})
    ]});
  const groups = findDuplicateRequests();
  const g1 = groups.find(g=>g.facilityId==='f1');
  const ok1 = !!g1 && g1.refs.map(r=>r.refId).sort().join(',')==='o1,o2,s1' && g1.refs.map(r=>r.source).sort().join(',')==='fixed,fixed,special';
  const none = !groups.some(g=>g.facilityId==='f2' || g.facilityId==='f3');
  return verdict(groups.length===1 && ok1 && none, 'one group on f1 (o1,o2,s1); disabled, repeated copies and disjoint windows ignored', JSON.stringify(groups));
});

regress('v5 P1.2: a window argument limits detection to that window', ()=>{
  Fx.use({days:10, facilities:Fx.fac(2), people:Fx.ppl(['p1','p2']),
    overrides:[
      {id:'o1', on:true, date:Fx.iso(8), facilityId:'f1', people:['p1'], fill:false},
      {id:'o2', on:true, date:Fx.iso(8), facilityId:'f1', people:['p2'], fill:false}
    ]});
  const inside = findDuplicateRequests({start:Fx.ord(0), end:Fx.ord(9)}).length;
  const outside = findDuplicateRequests({start:Fx.ord(0), end:Fx.ord(3)}).length;
  return verdict(inside===1 && outside===0, 'seen inside, ignored outside', 'inside '+inside+' outside '+outside);
});

regress('v5 P2.1: compileRequests resolves seats once and the adapters read the same requests', ()=>{
  Fx.use({days:10, pools:[{id:'a', basic:2, contracted:2}], facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3']),
    overrides:[{id:'o1', on:true, date:Fx.iso(2), facilityId:'f1', people:['p1','p2','p3'], fill:false, seats:{a:2}}],
    goals:[Object.assign(newGoal('special'), {id:'s1', facilityId:'f2', from:Fx.iso(1), to:Fx.iso(5), times:2, people:['p1'], fill:true})]});
  const win = planWindow();
  const c = compileRequests(win);
  const fx = c.list.find(r=>r.source==='fixed'), sp = c.list.find(r=>r.source==='special');
  const adFixed = fixedVisitsFor(win), adSpecial = specialRequests(win).list;
  const okShape = fx && sp && fx.seats.a===3 && sp.seats.a===2 && sp.copies===2 && fx.window.lo===fx.window.hi && fx.level.level==='must';
  const okAdapt = adFixed.length===1 && adFixed[0].request.id===fx.id && adSpecial.length===2 && adSpecial.every(x=>x.request.id===sp.id);
  return verdict(okShape && okAdapt, 'seats 3 (named people exceed the lock) and 2; adapters share the requests', JSON.stringify({fx:fx&&fx.seats, sp:sp&&sp.seats, ad:[adFixed.length, adSpecial.length]}));
});

regress('v5 P2.1: fixed and special visits go through one ledger and a forced fixed visit is counted', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3','p4']),
    settings:{volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:1, perWeek:null}},
    overrides:[
      {id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:['p1'], fill:false},
      {id:'o2', on:true, date:Fx.iso(1), facilityId:'f2', people:['p2'], fill:false}
    ],
    goals:[Object.assign(newGoal('special'), {id:'s1', facilityId:'f3', from:Fx.iso(0), to:Fx.iso(5), times:1, people:['p3'], fill:false})]});
  const r = generatePlan({seed:4});
  const v = r.plan.visits;
  const fixedDay = v.filter(x=>x.fixed && x.date===Fx.iso(1)).length;
  const sp = v.find(x=>x.special==='s1');
  const forced = r.plan.gen && r.plan.gen.layout ? r.plan.gen.layout.fixedForced : null;
  return verdict(fixedDay===2 && !!sp && sp.date!==Fx.iso(1) && (forced===1 || forced==null), 'both fixed kept, special moved off the full day', 'fixedDay '+fixedDay+' sp '+(sp&&sp.date)+' forced '+forced);
});

regress('v5 P2.2: the flow layout reports a rolled-back unit count and never the old boolean', ()=>{
  Fx.use({days:10, facilities:Fx.fac(8), people:Fx.ppl(['p1','p2','p3','p4','p5','p6']), settings:{volume:{mode:'exact', exact:{basic:5, contracted:0}, perDay:2, perWeek:null}}});
  const r = generatePlan({seed:2});
  const lay = r.plan.gen && r.plan.gen.layout;
  return verdict(!!lay && typeof lay.rolledBackUnits==='number' && !('rolledBack' in lay) && r.status==='valid', 'count present', JSON.stringify(lay));
});

regress('v5 P2.3: insert and remove moves are used in up-to mode and stay consistent with the validator', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']),
    settings:{volume:{mode:'exact', exactMode:'upTo', exact:{basic:3, contracted:0}, perDay:2, perWeek:null}}});
  const r = generatePlan({seed:3, skipSearch:true, skipExplain:true});
  const plan = r.plan;
  const cut = plan.visits.slice(0, 1).map(v=>v.id);
  plan.visits = plan.visits.filter(v=>!cut.includes(v.id));
  const keepDebug = App.debugIndex;
  App.debugIndex = true;
  let out;
  try{ out = lnsPlan(plan, null, {seed:5, ms:4000, iters:2500}); } finally { App.debugIndex = keepDebug; }
  const by = out.info.byMove;
  const used = (by.N5insert ? by.N5insert.tried : 0) + (by.N5remove ? by.N5remove.tried : 0);
  const v = validatePlan(out.plan);
  return verdict(used>0 && v.hardScore===out.info.hard, 'insert/remove tried, score equals validator', 'used '+used+' info '+out.info.hard+' val '+v.hardScore);
});

regress('v5 P2.3: in exact mode the count of visits never changes through search moves', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']),
    settings:{volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:2, perWeek:null}}});
  const r = generatePlan({seed:3, skipSearch:true, skipExplain:true});
  const n = r.plan.visits.length;
  const out = lnsPlan(r.plan, null, {seed:5, ms:3000, iters:2500});
  const by = out.info.byMove;
  const free = (by.N5insert ? by.N5insert.tried : 0) + (by.N5remove ? by.N5remove.tried : 0);
  return verdict(out.plan.visits.length===n && free===0, 'count kept, no free insert or remove', 'n '+n+' -> '+out.plan.visits.length+' free '+free);
});

regress('v5 P2.4: continuing a search is deterministic, never worse, and advances the round counter', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']),
    settings:{volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:2, perWeek:null}}});
  const base = generatePlan({seed:3, skipSearch:true, skipExplain:true}).plan;
  const first = generatePlan({seed:3, iters:60, skipExplain:true}).plan;
  const sig = p=>p.visits.map(v=>v.date+'|'+v.facilityId+'|'+JSON.stringify(v.team)).join(';');
  const a = generatePlan({continueFrom:first, iters:300, ms:20000, skipExplain:true});
  const b = generatePlan({continueFrom:first, iters:300, ms:20000, skipExplain:true});
  const s0 = validatePlan(first), s1 = validatePlan(a.plan);
  const notWorse = s1.hardScore<s0.hardScore || (s1.hardScore===s0.hardScore && s1.softScore<=s0.softScore);
  return verdict(sig(a.plan)===sig(b.plan) && notWorse && a.plan.gen.search.rounds===1 && !!base, 'same plan twice, not worse, rounds=1', 'same '+(sig(a.plan)===sig(b.plan))+' notWorse '+notWorse+' rounds '+a.plan.gen.search.rounds);
});

regress('v5 P2.4: the truncated banner offers Keep searching only while hard violations remain', ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end:'2026-10-08'});
  const plan = generatePlan({seed:1, skipExplain:true, iters:40}).plan;
  const keep = App.plan, tab = App.ui.tab, view = App.ui.view;
  const show = (hard)=>{
    plan.gen.search = Object.assign({}, plan.gen.search, {truncated:true, score:{hard, soft:0}});
    App.plan = plan; App.ui.tab = 'plan'; App.ui.view = 'summary'; renderTab();
    return {banner:!!document.getElementById('gen-truncated'), btn:!!document.getElementById('gen-keep')};
  };
  const withHard = show(2), clean = show(0);
  App.plan = keep; App.ui.tab = tab; App.ui.view = view; renderTab();
  return verdict(withHard.banner && withHard.btn && clean.banner && !clean.btn, 'button only with hard>0', JSON.stringify({withHard, clean}));
});

regress('v5 P3.1: old data migrates requireEveryEligibleDay to useAllDays and the level follows it', ()=>{
  const mk = flag=>{ const d = normalizeData(JSON.parse(SEED_JSON)); delete d.settings.volume.useAllDays; d.settings.volume.requireEveryEligibleDay = flag; return normalizeData(d); };
  const on = mk(true), off = mk(false);
  const keep = App.data;
  const migrated = on.settings.volume.useAllDays;
  App.data = on; const lvOn = lvOf('vol.everyDay').level; const mirrorOn = on.settings.volume.requireEveryEligibleDay;
  on.settings.volume.useAllDays = 'prefer'; const lvTry = lvOf('vol.everyDay').level;
  App.data = keep;
  return verdict(migrated==='must' && off.settings.volume.useAllDays==='off' && lvOn==='must' && lvTry==='prefer' && mirrorOn===true && on.settings.volume.dayMode==='upTo' && on.settings.volume.exactMode==='exactly', 'true->must, false->off, Try gives prefer', JSON.stringify([on.settings.volume.useAllDays, off.settings.volume.useAllDays, lvOn, lvTry]));
});

regress('v5 P3.1: exactly mode turns perDay into a Must day minimum and up-to mode adds none', ()=>{
  Fx.use({days:6, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']), settings:{volume:{mode:'fill', perDay:2, dayMode:'exactly'}}});
  const ex = dayRuleOf(Fx.ord(1));
  S().volume.dayMode = 'upTo';
  const up = dayRuleOf(Fx.ord(1));
  return verdict(ex.min && ex.min.n===2 && ex.min.lv.level==='must' && !up.min, 'min 2 Must only in exactly', JSON.stringify([ex.min, up.min]));
});

regress('v5 P3.1: an up-to exact count only penalises plans above the maximum', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']), settings:{volume:{mode:'exact', exactMode:'upTo', exact:{basic:3, contracted:0}, perDay:2, perWeek:null}}});
  const plan = generatePlan({seed:3, skipSearch:true, skipExplain:true}).plan;
  const full = validatePlan(plan).violations.filter(v=>v.key==='dExactOff').length;
  const fewer = clonePlan(plan); fewer.visits = fewer.visits.slice(0, 2);
  const under = validatePlan(fewer).violations.filter(v=>v.key==='dExactOff').length;
  S().volume.exactMode = 'exactly';
  const plan2 = generatePlan({seed:3, skipSearch:true, skipExplain:true}).plan;
  plan2.visits = plan2.visits.slice(0, 2);
  const strict = validatePlan(plan2).violations.filter(v=>v.key==='dExactOff').length;
  return verdict(full===0 && under===0 && strict>0, 'full ok, fewer ok in up-to, fewer flagged in exactly', [full, under, strict].join(','));
});

regress('v5 P3.1: the Visits popover has the up-to/exactly, per-day and use-all-days rows in order', ()=>{
  Fx.use({days:6, facilities:Fx.fac(4), people:Fx.ppl(['p1','p2'])});
  const box = visitsPop(()=>{});
  const labels = [...box.querySelectorAll('label')].map(l=>l.textContent);
  const i1 = labels.indexOf(t('vPerDayMode')), i2 = labels.indexOf(t('vPerDay')), i3 = labels.indexOf(t('vUseAll'));
  const segs = box.querySelectorAll('.seg').length;
  return verdict(i1>=0 && i1<i2 && i2<i3 && segs>=3, 'order mode, per day, use all days', JSON.stringify([i1, i2, i3, segs]));
});

regress('v5 P3.2: seat precedence is request, facility, location, pool by category, pool default', ()=>{
  Fx.use({days:4, pools:[{id:'a', basic:2, contracted:1}], facilities:[{id:'f1'}, {id:'f2'}, {id:'f3'}], people:Fx.ppl(['p1','p2'])});
  const pl = S().pools[0], f1 = facilityById('f1'), f2 = facilityById('f2');
  const base = seatsForF(pl, 'basic', f1);
  App.data.locations[0].seats = {a:4};
  const loc = seatsForF(pl, 'basic', f1);
  f2.seats = {a:3};
  const fac = seatsForF(pl, 'basic', f2);
  const o = {seats:{a:1}};
  const planned = plannedSeats(o.seats, pl, 'basic', f2, true, 0);
  return verdict(base===2 && loc===4 && fac===3 && planned===1, 'default 2, location 4, facility 3, request 1', [base, loc, fac, planned].join(','));
});

regress('v5 P3.2: a guest in a pool takes a seat and is never part of the team, fairness or the people lists', ()=>{
  Fx.use({days:5, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(3), people:Fx.ppl(['p1','p2','p3']), volume:{mode:'exact', exact:{basic:1, contracted:0}},
    overrides:[{id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:[], fill:true, guests:['g1']}]});
  S().guests = [{id:'g1', name:'Guest One', pool:'a', gender:null, note:''}, {id:'g2', name:'Guest Two', pool:null, gender:null, note:''}];
  const r = generatePlan({seed:2, skipSearch:true, skipExplain:true});
  const v = r.plan.visits.find(x=>x.overrideId==='o1');
  const team = v ? visitTeamIds(v) : [];
  const labels = v ? visitGuestLabels(v) : [];
  const rows = exportPlanRows(r.plan, 'full').slice(1).map(x=>x[5]).join('|');
  return verdict(!!v && team.length===1 && team.every(id=>personById(id)) && labels.length===1 && rows.includes(t('guestMark')) && !Fx.visits(r.plan, 'g1').length, 'team 1 person plus 1 guest, marked in export', JSON.stringify({team, labels, rows}));
});

regress('v5 P3.2: the same guest on two visits the same day is a hard error with a message', ()=>{
  Fx.use({days:4, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(2), people:Fx.ppl(['p1','p2'])});
  S().guests = [{id:'g1', name:'Guest One', pool:null, gender:null, note:''}];
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p2']}}]);
  plan.visits.forEach(v=>{ v.guests = ['g1']; });
  const hits = validatePlan(plan).violations.filter(v=>v.key==='dGuestDup');
  plan.visits[1].date = Fx.iso(2);
  const clean = validatePlan(plan).violations.filter(v=>v.key==='dGuestDup').length;
  return verdict(hits.length===1 && hits[0].cls==='hard' && clean===0 && typeof violationText==='function' ? true : hits.length===1 && clean===0, 'one hard dGuestDup, gone on another day', hits.length+' '+clean);
});

regress('v5 P3.2: rules for one visit override the gender and senior rules and nothing else', ()=>{
  Fx.use({days:4, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(2, 'B', {importance:90}), people:[{id:'p1', gender:'m', skill:10}, {id:'p2', gender:'m', skill:10}, {id:'p3', gender:'f', skill:95}],
    settings:{genderRules:[{id:'gr1', on:true, kinds:[], categories:[], facilities:[], minEach:50, avoidEven:false}], seniority:{on:true, threshold:80}, lv:{senior:{level:'prefer', w:5}}}});
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1','p2']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p1','p2']}}]);
  const keys = p=>validatePlan(p).violations.map(v=>v.key+':'+(v.visits||[]).join(','));
  const base = keys(plan);
  plan.visits[0].rules = {gender:'none', senior:'off'};
  const v1 = keys(plan);
  plan.visits[0].rules = {gender:{minEach:0, avoidEven:false}, senior:'inherit'};
  const v2 = keys(plan);
  const hasG = (k, id)=>k.some(x=>x==='dGender:'+id), hasS = (k, id)=>k.some(x=>x==='dSenior:'+id);
  const id0 = plan.visits[0].id, id1 = plan.visits[1].id;
  return verdict(hasG(base, id0) && hasG(base, id1) && hasS(base, id0) && !hasG(v1, id0) && !hasS(v1, id0) && hasG(v1, id1) && hasS(v1, id1) && !hasG(v2, id0) && hasS(v2, id0), 'visit 0 loses gender and senior flags only with the override', JSON.stringify({base, v1, v2}));
});

regress('v5 P3.2: empty per-visit rules clean to null and the sheet block and guest picker render', ()=>{
  const none = cleanVisitRules({gender:'inherit', senior:'inherit'});
  const some = cleanVisitRules({gender:'none', senior:'on'});
  Fx.use({days:4, facilities:Fx.fac(2), people:Fx.ppl(['p1'])});
  const o = normalizeOverride({id:'o9', facilityId:'f1', date:Fx.iso(1)});
  const nodes = visitSpecFields(o, ()=>{}, (lab, ctl)=>el('div', {class:'field'}, [el('label', null, lab), ctl]));
  const host = el('div', null, nodes);
  return verdict(none===null && some && some.gender==='none' && some.senior==='on' && !!host.querySelector('details.vr-block') && [...host.querySelectorAll('button')].some(b=>b.textContent.includes(t('guestAdd'))), 'cleaning and render', JSON.stringify({none, some}));
});

const dupFx = (policy, extra)=>{
  Fx.use(Object.assign({days:8, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3','p4']),
    overrides:[
      {id:'o1', on:true, date:Fx.iso(2), facilityId:'f1', people:['p1'], fill:false, seats:{a:1}},
      {id:'o2', on:true, date:Fx.iso(2), facilityId:'f1', people:['p2'], fill:false, seats:{a:2}}
    ],
    goals:[Object.assign(newGoal('special'), {id:'s1', facilityId:'f1', from:Fx.iso(1), to:Fx.iso(4), times:1, people:['p3'], fill:false})]}, extra||{}));
  S().duplicates = policy;
};
const dupVisits = r=>r.plan.visits.filter(v=>v.facilityId==='f1');

regress('v5 P3.3: merge joins duplicate requests into one visit with the union of people and the larger seats', ()=>{
  dupFx('merge');
  const r = generatePlan({seed:1, skipSearch:true, skipExplain:true});
  const vs = dupVisits(r);
  const ids = vs[0] ? visitTeamIds(vs[0]).sort().join(',') : '';
  const val = validatePlan(r.plan);
  const dup = val.violations.filter(v=>v.key==='dFacDup' || v.key==='dDayDup' || v.key==='dSpecialShort').length;
  const diag = (r.plan.genDiags||[]).some(d=>d.key==='dDupMerged');
  return verdict(vs.length===1 && ids.includes('p1') && ids.includes('p2') && ids.includes('p3') && dup===0 && diag, 'one visit, p1+p2+p3, no duplicate or special violation, merged diag', JSON.stringify({n:vs.length, ids, dup, diag}));
});

regress('v5 P3.3: keep leaves both requests, ask also keeps both and says so', ()=>{
  dupFx('keep');
  const kept = generatePlan({seed:1, skipSearch:true, skipExplain:true});
  dupFx('ask');
  const asked = generatePlan({seed:1, skipSearch:true, skipExplain:true});
  const askDiag = (asked.plan.genDiags||[]).some(d=>d.key==='dDupAsk');
  const keepDiag = (kept.plan.genDiags||[]).some(d=>d.key==='dDupAsk' || d.key==='dDupMerged');
  return verdict(dupVisits(kept).length>=2 && dupVisits(asked).length>=2 && askDiag && !keepDiag, 'both kept in keep and ask, ask warns', JSON.stringify({k:dupVisits(kept).length, a:dupVisits(asked).length, askDiag, keepDiag}));
});

regress('v5 P3.3: reject drops the newer request, keeps the fixed visit and explains it', ()=>{
  dupFx('reject');
  const r = generatePlan({seed:1, skipSearch:true, skipExplain:true});
  const vs = dupVisits(r);
  const diags = (r.plan.genDiags||[]).filter(d=>d.key==='dDupRejected').length;
  return verdict(vs.length===1 && vs[0].overrideId==='o1' && diags===2, 'only the first fixed visit remains, two rejections reported', JSON.stringify({n:vs.length, id:vs[0] && vs[0].overrideId, diags}));
});

regress('v5 P3.3: a stored choice on the request beats the setting', ()=>{
  dupFx('ask');
  S().overrides.forEach(o=>{ o.dupChoice = 'merge'; });
  const r = generatePlan({seed:1, skipSearch:true, skipExplain:true});
  const merged = (r.plan.genDiags||[]).some(d=>d.key==='dDupMerged');
  return verdict(merged && dupVisits(r).length<=2 && !(r.plan.genDiags||[]).some(d=>d.key==='dDupAsk'), 'merged without asking', JSON.stringify((r.plan.genDiags||[]).map(d=>d.key)));
});

regress('v5 P3.3: editing in ask mode offers Merge and Keep both once and stores the choice', ()=>{
  dupFx('ask');
  App.ui.dupOffered = new Set();
  document.querySelectorAll('.toasts .toast').forEach(n=>n.remove());
  offerDuplicateChoice();
  const first = document.querySelector('.toasts .toast');
  const btns = first ? [...first.querySelectorAll('button')].map(b=>b.textContent) : [];
  offerDuplicateChoice();
  const count = document.querySelectorAll('.toasts .toast').length;
  if(first){ [...first.querySelectorAll('button')].find(b=>b.textContent===t('dupMerge')).click(); }
  const stored = S().overrides.map(o=>o.dupChoice).join(',');
  document.querySelectorAll('.toasts .toast').forEach(n=>n.remove());
  return verdict(btns.length===2 && count===1 && stored==='merge,merge', 'two buttons, once only, stored on both', JSON.stringify({btns, count, stored}));
});

const seatFx = ()=>{
  Fx.use({days:6, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3']), settings:{volume:{mode:'fill', perDay:2}}});
  S().people = S().people;
  App.data.people.find(p=>p.id==='p3').off = [{from:Fx.iso(1), to:Fx.iso(1)}];
};
const seatWin = plan=>({start:ordOf(plan.start), days:plan.days.map(ordOf)});

regress('v5 P4.1: a fixed visit that needs more seats than the free people is a proven shortage with a reason and a fix', ()=>{
  seatFx();
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]);
  plan.visits[0].fixed = true; plan.visits[0].overrideId = 'o1'; plan.visits[0].seats = {a:3}; plan.visits[0].preset = ['p1'];
  S().overrides = [normalizeOverride({id:'o1', facilityId:'f1', date:Fx.iso(1), people:['p1'], fill:true, seats:{a:3}})];
  const lines = explainSeats(plan, seatWin(plan)).filter(l=>l.scope==='day');
  const l = lines[0];
  const ar = App.ui.lang; App.ui.lang = 'ar'; const msgAr = l ? t.apply(null, [l.key].concat(l.args)) : ''; App.ui.lang = 'en'; const msgEn = l ? t.apply(null, [l.key].concat(l.args)) : ''; App.ui.lang = ar;
  const okFix = l && l.fix && l.fix.type==='seatDown' && l.fix.overrideId==='o1' && l.fix.to===2;
  return verdict(lines.length===1 && l.short===1 && l.need===2 && l.avail===1 && l.proven && l.who.some(w=>w.reason==='off') && okFix && msgEn.includes('short 1 seat') && msgEn.includes('is off') && msgAr.includes('ينقص مقعد'), 'proven short 1, need 2 avail 1 (one held), off reason, fix to 2, both languages', JSON.stringify({l:l && {short:l.short, need:l.need, avail:l.avail, proven:l.proven, who:l.who, fix:l.fix}, msgEn, msgAr}));
});

regress('v5 P4.1: flexible visits that need more seats than the pool has are a warning, not a proof', ()=>{
  seatFx();
  const plan = Fx.manualPlan([{date:Fx.iso(2), facilityId:'f1', team:{a:['p1','p2']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p1']}}]);
  const lines = explainSeats(plan, seatWin(plan)).filter(l=>l.scope==='day');
  return verdict(lines.length===1 && lines[0].short===1 && !lines[0].proven && !lines[0].fix, 'warning only, no fix on non-user visits', JSON.stringify(lines.map(l=>({s:l.short, p:l.proven, fix:l.fix}))));
});

regress('v5 P4.1: seat shortages are always checked, even when facilities carry their own seats', ()=>{
  seatFx();
  App.data.facilities.find(f=>f.id==='f1').seats = {a:3};
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1','p2']}}]);
  const lines = explainSeats(plan, seatWin(plan)).filter(l=>l.scope==='day');
  return verdict(lines.length===1 && lines[0].need===3 && lines[0].avail===2 && lines[0].short===1, 'detected with facility seats', JSON.stringify(lines.map(l=>({n:l.need, a:l.avail, s:l.short}))));
});

regress('v5 P4.1: the Summary shows shortage lines, proven ones as bad with a fix button that applies', ()=>{
  seatFx();
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]);
  plan.visits[0].fixed = true; plan.visits[0].overrideId = 'o1'; plan.visits[0].seats = {a:3}; plan.visits[0].preset = ['p1'];
  S().overrides = [normalizeOverride({id:'o1', facilityId:'f1', date:Fx.iso(1), people:['p1'], fill:true, seats:{a:3}})];
  const keep = App.plan, tab = App.ui.tab, view = App.ui.view;
  App.plan = plan; App.ui.tab = 'plan'; App.ui.view = 'summary'; renderTab();
  const box = document.getElementById('seat-lines');
  const bad = box ? box.querySelectorAll('.check.bad').length : 0;
  const btn = box ? box.querySelector('button') : null;
  if(btn) btn.click();
  const after = S().overrides.find(o=>o.id==='o1').seats;
  App.plan = keep; App.ui.tab = tab; App.ui.view = view; renderTab();
  return verdict(bad===1 && !!btn && after && after.a===2, 'one bad line, fix lowers seats to 2', JSON.stringify({bad, after}));
});

regress('v5 P4.2: the model numbers equal the search score and the terms add up', ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end:'2026-10-29'});
  const r = generatePlan({seed:2, iters:60, skipExplain:true});
  const m = buildModel(r.plan), sc = r.plan.gen.search.score;
  const hardSum = m.hardTerms.reduce((a, e)=>a+e.hard, 0), softSum = m.softTerms.reduce((a, e)=>a+e.soft, 0);
  const close = (a, b)=>Math.abs(a-b)<0.01;
  return verdict(m.hardScore===sc.hard && m.softScore===sc.soft && close(hardSum, m.hardScore) && close(softSum-m.dueReward.value, m.softScore), 'hard, soft and term sums match', JSON.stringify({m:[m.hardScore, m.softScore], sc, hardSum, softSum, due:m.dueReward.value}));
});

regress('v5 P4.2: active zero-unit terms are listed with level and weight, and violations land on their rule', ()=>{
  Fx.use({days:5, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(3), people:Fx.ppl(['p1','p2'])});
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f1', team:{a:['p2']}}]);
  const m = buildModel(plan), text = modelText(m);
  const cap = m.hardTerms.find(e=>e.id==='day.cap');
  const once = m.hardTerms.find(e=>e.id==='struct.facilityOnce');
  const val = validatePlan(plan);
  const viol = val.violations.filter(v=>v.rule==='struct.facilityOnce' && v.cls==='hard').reduce((a, v)=>a+v.weight*v.units, 0);
  return verdict(!!cap && cap.level==='must' && cap.hardUnits===0 && /day\.cap\s+\[Must \*5\]\s+units=0/.test(text) && text.startsWith('minimize') && !!once && Math.abs(once.hard-viol)<0.01 && once.hard>0, 'day.cap listed at zero, facilityOnce carries its violation', JSON.stringify({cap, once, viol}));
});

regress('v5 P4.2: the Model card renders inside the Summary with Copy and two export buttons', ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end:'2026-10-08'});
  const plan = generatePlan({seed:1, iters:30, skipExplain:true}).plan;
  const keep = App.plan, tab = App.ui.tab, view = App.ui.view, realDl = window.downloadBlob;
  const saved = [];
  window.downloadBlob = (bytes, name, mime)=>saved.push([name, mime, new TextDecoder().decode(bytes).length]);
  App.plan = plan; App.ui.tab = 'plan'; App.ui.view = 'summary'; renderTab();
  const card = document.getElementById('model-card');
  const pre = card && card.querySelector('pre.model-pre');
  const btns = card ? [...card.querySelectorAll('button')] : [];
  const font = pre ? getComputedStyle(pre).fontFamily : '';
  if(btns[1]) btns[1].click();
  if(btns[2]) btns[2].click();
  window.downloadBlob = realDl;
  App.plan = keep; App.ui.tab = tab; App.ui.view = view; renderTab();
  const json = saved[1] ? saved[1][1] : '';
  return verdict(!!pre && btns.length===3 && /JetBrains|mono/i.test(font) && saved.length===2 && saved[0][0].endsWith('.txt') && saved[1][0].endsWith('.json') && json.includes('json'), 'card, 3 buttons, mono font, two exports', JSON.stringify({btns:btns.length, font, saved}));
});

regress('v5 migration: a rev 8 save gains the v5 settings with the same behaviour and moves to rev 9', ()=>{
  const old = JSON.parse(SEED_JSON);
  old.rulesRev = 8;
  const V = old.settings.volume;
  for(const k of ['dayMode', 'useAllDays', 'exactMode', 'total']) delete V[k];
  delete old.settings.guests; delete old.settings.duplicates;
  V.requireEveryEligibleDay = true;
  old.settings.goals.forEach(g=>{ delete g.rules; delete g.guests; delete g.dupChoice; });
  old.locations.forEach(l=>{ delete l.seats; });
  const d = normalizeData(old);
  const v = d.settings.volume;
  return verdict(d.rulesRev===RULES_REV && RULES_REV===9 && v.dayMode==='upTo' && v.useAllDays==='must' && v.requireEveryEligibleDay===true && v.exactMode==='exactly' && v.total.n===null && Array.isArray(d.settings.guests) && d.settings.duplicates==='ask' && d.locations.every(l=>l.seats==null || Object.keys(l.seats).length===0), 'rev 9, up-to, Must from true, exactly, ask, empty guests', JSON.stringify({rev:d.rulesRev, v:[v.dayMode, v.useAllDays, v.exactMode], dup:d.settings.duplicates}));
});

regress('v5.1 within: a special visit marked for the first week lands in the first 7 days of the plan', ()=>{
  Fx.use({days:14, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']), settings:{volume:{mode:'exact', exact:{basic:8, contracted:0}, perDay:2, perWeek:null}},
    goals:[Object.assign(newGoal('special'), {id:'s1', facilityId:'f4', times:1, people:[], fill:true, within:{n:1, unit:'weeks'}})]});
  const r = generatePlan({seed:2, skipSearch:true, skipExplain:true});
  const win = planWindow();
  const v = r.plan.visits.find(x=>x.special==='s1');
  const val = validatePlan(r.plan);
  const row = val.goals.find(g=>g.g && g.g.id==='s1');
  const inFirstWeek = v && ordOf(v.date) <= win.start + 6;
  return verdict(!!v && inFirstWeek && row && row.met, 'placed on or before day 7 and met', JSON.stringify({date:v && v.date, start:isoOf(win.start), met:row && row.met}));
});

regress('v5.1 within: a cover goal over several places with a first-N-weeks limit visits all of them by then', ()=>{
  Fx.use({days:21, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(8), people:Fx.ppl(['p1','p2','p3','p4']), settings:{volume:{mode:'exact', exact:{basic:10, contracted:0}, perDay:2, perWeek:null}},
    goals:[Object.assign(newGoal('cover'), {id:'c1', scope:{kind:'facility', ids:['f6','f7','f8']}, times:1, since:null, by:null, repeat:false, within:{n:2, unit:'weeks'}})]});
  const r = generatePlan({seed:3, skipSearch:true, skipExplain:true});
  const win = planWindow();
  const early = ['f6','f7','f8'].map(id=>r.plan.visits.some(v=>v.facilityId===id && ordOf(v.date) <= win.start + 13));
  const row = validatePlan(r.plan).goals.find(g=>g.g && g.g.id==='c1');
  return verdict(early.every(Boolean) && row && row.met, 'all three visited in the first 14 days', JSON.stringify({early, met:row && row.met}));
});

regress('v5.1 within: the window works for days, weeks and calendar months and clean values stay in range', ()=>{
  const s = ordOf('2026-10-04');
  const d = withinEndOrd(s, {n:3, unit:'days'}) - s, w = withinEndOrd(s, {n:2, unit:'weeks'}) - s, m = isoOf(withinEndOrd(s, {n:1, unit:'months'}));
  return verdict(d===2 && w===13 && m==='2026-11-03' && cleanWithin({n:0, unit:'x'})===null && cleanWithin({n:5, unit:'x'}).unit==='weeks' && cleanWithin({n:999, unit:'days'}).n===366 && withinEndOrd(s, null)===Infinity, 'days, weeks, months and cleaning', JSON.stringify([d, w, m]));
});

const sepFx = (lvl)=>{
  Fx.use({days:14, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3','p4']), settings:{volume:{mode:'exact', exact:{basic:8, contracted:0}, perDay:2, perWeek:null}},
    goals:[Object.assign(newGoal('separate'), {id:'sp', scope:{kind:'facility', ids:['f1','f2']}, scope2:{kind:'facility', ids:['f3','f4']}, strict:lvl||'must'})]});
};
const sepOffenders = plan=>{
  const A = new Set(), B = new Set();
  for(const v of plan.visits){ for(const id of visitTeamIds(v)){ if(['f1','f2'].includes(v.facilityId)) A.add(id); if(['f3','f4'].includes(v.facilityId)) B.add(id); } }
  return [...A].filter(id=>B.has(id));
};

regress('v5.1 separate: whoever visits one side never visits the other in a generated plan', ()=>{
  sepFx('must');
  const r = generatePlan({seed:4, iters:80, skipExplain:true});
  const bad = sepOffenders(r.plan);
  const viol = validatePlan(r.plan).violations.filter(v=>v.key==='dSeparate').length;
  const row = validatePlan(r.plan).goals.find(g=>g.g && g.g.id==='sp');
  const usedBoth = ['f1','f2'].some(id=>r.plan.visits.some(v=>v.facilityId===id)) && ['f3','f4'].some(id=>r.plan.visits.some(v=>v.facilityId===id));
  return verdict(bad.length===0 && viol===0 && row && row.met && usedBoth, 'no person on both sides and both sides visited', JSON.stringify({bad, viol, usedBoth, status:r.status}));
});

regress('v5.1 separate: the validator reports a person on both sides, hard for Must, soft for Prefer, exception when both visits are fixed on them', ()=>{
  sepFx('must');
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(3), facilityId:'f3', team:{a:['p1']}}, {date:Fx.iso(4), facilityId:'f4', team:{a:['p2']}}]);
  const hard = validatePlan(plan).violations.filter(v=>v.key==='dSeparate');
  S().goals.find(g=>g.id==='sp').strict = 'try';
  const soft = validatePlan(plan).violations.filter(v=>v.key==='dSeparate');
  S().goals.find(g=>g.id==='sp').strict = 'must';
  plan.visits[0].fixed = true; plan.visits[0].preset = ['p1']; plan.visits[1].fixed = true; plan.visits[1].preset = ['p1'];
  const exc = validatePlan(plan).violations.filter(v=>v.key==='dSeparate');
  const msg = t('dSeparate', 'p1', 'A', 'B');
  return verdict(hard.length===1 && hard[0].cls==='hard' && soft.length===1 && soft[0].cls==='soft' && exc.length===1 && exc[0].cls==='exception' && msg.includes('p1'), 'hard, soft, exception', JSON.stringify([hard.map(v=>v.cls), soft.map(v=>v.cls), exc.map(v=>v.cls)]));
});

regress('v5.1 separate: the assignment check blocks the other side for a person and lets go when the visit is undone', ()=>{
  sepFx('must');
  const rules = compilePeopleRules();
  const ctx = tallyCtx(rules);
  const p = personById('p1'), f1 = facilityById('f1'), f3 = facilityById('f3'), f2 = facilityById('f2');
  const o = Fx.ord(2);
  ctxTally(ctx, 'p1', o, f1, 1);
  const blocked = hardOk(p, Fx.ord(5), f3, ctx);
  const sameSide = hardOk(p, Fx.ord(6), f2, ctx);
  ctxTally(ctx, 'p1', o, f1, -1);
  const freed = hardOk(p, Fx.ord(5), f3, ctx);
  return verdict(blocked==='separate' && sameSide!=='separate' && freed!=='separate', 'blocked, same side fine, freed after undo', JSON.stringify([blocked, sameSide, freed]));
});

regress('v5.1 separate: the goal appears in the goals list, needs both sides and reads well in both languages', ()=>{
  sepFx('must');
  const g = S().goals.find(x=>x.id==='sp');
  const ready = separateReady(g);
  const bare = normalizeGoal({type:'separate'});
  const keep = App.ui.lang;
  App.ui.lang = 'en'; const en = goalTitle(g); App.ui.lang = 'ar'; const ar = goalTitle(g); App.ui.lang = keep;
  const host = el('div', null, goalFields(g, ()=>{}, ()=>{}));
  return verdict(PEOPLE_GOALS.includes('separate') && ready && !separateReady(bare) && !!bare.scope2 && en.includes('does not visit') && ar.length>10 && host.querySelectorAll('.rc-row').length===2, 'listed, readiness, titles, two scope rows', JSON.stringify({ready, en, rows:host.querySelectorAll('.rc-row').length}));
});

regress('v5.1 guests: a pooled guest with a known gender counts in the gender rule, an unknown one pauses it', ()=>{
  Fx.use({days:4, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(2), people:[{id:'p1', gender:'m', skill:10}, {id:'p2', gender:'m', skill:10}, {id:'p3', gender:'f', skill:10}],
    settings:{genderRules:[{id:'gr1', on:true, kinds:[], categories:[], facilities:[], minEach:34, avoidEven:false}]}});
  S().guests = [{id:'g1', name:'Guest', pool:'a', gender:'f', note:''}, {id:'g2', name:'Guest2', pool:'a', gender:null, note:''}];
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1','p2']}}]);
  const gendered = ()=>validatePlan(plan).violations.filter(x=>x.key==='dGender').length;
  plan.visits[0].seats = {a:2};
  const noGuest = gendered();
  plan.visits[0].team = {a:['p1']};
  plan.visits[0].guests = ['g1'];
  const withFemale = gendered();
  plan.visits[0].guests = ['g2'];
  const unknown = gendered();
  const tg = teamGender(['p1'], {guests:['g1']});
  return verdict(noGuest===1 && withFemale===0 && unknown===0 && tg.m===1 && tg.f===1, 'two men flagged, a female guest fixes it, unknown gender pauses the rule', JSON.stringify({noGuest, withFemale, unknown, tg}));
});

regress('v5.1 guests: calendar pills and the matrix tooltip show guests, and the total visits control limits a fill plan', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4'])});
  S().guests = [{id:'g1', name:'Guest One', pool:'a', gender:null, note:''}];
  const v = {team:{a:['p1']}, guests:['g1'], open:{}};
  const pills = teamPills(v).map(n=>n.textContent).join('|');
  S().volume.mode = 'fill'; S().volume.share = 1;
  S().volume.total = {mode:'upTo', n:null};
  const free = volumePreview().total;
  S().volume.total = {mode:'upTo', n:3};
  const capped = volumePreview().total;
  S().volume.total = {mode:'exactly', n:3};
  const exact = volumePreview().total;
  const popBox = visitsPop(()=>{});
  const labels = [...popBox.querySelectorAll('label')].map(l=>l.textContent);
  return verdict(pills.includes(t('guestMark')) && free>3 && capped===3 && exact===3 && labels.includes(t('vTotal')), 'guest pill, total capped at 3, control present', JSON.stringify({pills, free, capped, exact}));
});
