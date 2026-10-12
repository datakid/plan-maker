const OFF = (...ns)=>ns.map(n=>({from:Fx.iso(n), to:Fx.iso(n)}));
const sigOf = plan=>plan.visits.slice().sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0)).map(v=>v.date.slice(5)+':'+v.facilityId+':'+visitTeamIds(v).join('+')).join(' ');
const checkOf = (A, key)=>A.checks.find(c=>c.key===key);
const goalRow = (A, type)=>A.goals.find(r=>r.g.type===type);
function fullyStaffed(plan){
  for(const v of plan.visits){
    const f = facilityById(v.facilityId);
    for(const pl of S().pools) if((v.team[pl.id]||[]).length!==seatsFor(pl, v.kind, f.category)) return false;
  }
  return true;
}
function quotasHonoured(plan){
  for(const p of activePeople()){
    const n = Fx.count(plan, p.id), q = p.quota || {};
    if(q.min!=null && n<q.min) return false;
    if(q.max!=null && n>q.max) return false;
  }
  return true;
}
function planIsValid(plan){
  if(typeof validatePlan==='function') return validatePlan(plan).hard===0;
  return analyzePlan(plan).blocking===0 && fullyStaffed(plan) && quotasHonoured(plan) && Fx.doubleBooked(plan)===0;
}
function ctxSnap(c){
  const used = [...c.dayUsed].map(([o, s])=>o+':'+[...s].sort().join(',')).sort().join('|');
  const dates = Object.keys(c.dates).sort().map(id=>id+'='+[...c.dates[id].keys()].sort().join(',')).join('|');
  const num = o=>Object.keys(o).filter(k=>o[k]).sort().map(k=>k+'='+o[k]).join(',');
  return {used, dates, assigned:num(c.assigned), week:num(c.week), q:num(c.q), both:num(c.both), far:num(c.far)};
}
function gapIntervalsOk(plan, fid, last, days){
  const end = ordOf(plan.end);
  const ds = plan.visits.filter(v=>v.facilityId===fid).map(v=>ordOf(v.date)).sort((a,b)=>a-b);
  let prev = last;
  for(const d of ds){ if(d-prev>days) return false; prev = d; }
  return prev+days>end;
}

regress('infra: test storage is isolated from real data', ()=>window.__TEST_ISOLATED__===true || (typeof window.__TEST_ISOLATED__==='undefined' && typeof localStorage!=='undefined'));

regress('A1 hard plan spacing yields a gap-3 plan when one exists', ()=>{
  const p = Fx.gen({days:7, facilities:Fx.fac(4), people:Fx.ppl(['p1','p2','p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}}, settings:{spacing:{mode:'gap', gap:3, strict:'must'}}});
  const ds = [...new Set(p.visits.map(v=>ordOf(v.date)))].sort((a, b)=>a-b);
  let min = 99; for(let i=1;i<ds.length;i++) min = Math.min(min, ds[i]-ds[i-1]);
  return verdict(p.visits.length===3 && min>=3, ds.join(','), 'dates '+ds.join(','));
});
regress('A1b broken spacing is flagged: Must blocks, Try is only a preference', ()=>{
  const spec = {days:6, facilities:Fx.fac(3), people:Fx.ppl(['p1','p2','p3']), volume:{mode:'exact', exact:{basic:2, contracted:0}}};
  const visits = [{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p2']}}];
  Fx.use(Object.assign({settings:{spacing:{mode:'gap', gap:3, strict:'must'}}}, spec));
  const must = analyzePlan(Fx.manualPlan(visits)), cm = checkOf(must, 'cSpacing');
  Fx.use(Object.assign({settings:{spacing:{mode:'gap', gap:3, strict:'try'}}}, spec));
  const soft = analyzePlan(Fx.manualPlan(visits)), cs = checkOf(soft, 'cSpacing');
  return !!cm && !cm.ok && must.blocking>0 && !!cs && !cs.ok && cs.soft===true && soft.blocking===0;
});
regress('A2 a long plan requires repeated visits to keep a max gap', ()=>{
  const last = ordOf(Fx.iso(-5));
  const p = Fx.gen({days:30, facilities:[{id:'f1', lastVisit:Fx.iso(-5)}, ...Fx.fac(5).slice(1)], people:Fx.ppl(['p1','p2','p3','p4']), volume:{mode:'exact', exact:{basic:5, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:10, scope:{kind:'facility', ids:['f1']}}]});
  return verdict(gapIntervalsOk(p, 'f1', last, 10), 'f1 '+p.visits.filter(v=>v.facilityId==='f1').map(v=>v.date.slice(5)).sort().join(','), false);
});
regress('A3 a max-gap deadline is not relaxed past its true due date', ()=>{
  const p = Fx.gen({days:30, facilities:[{id:'f1', lastVisit:Fx.iso(-9)}, ...Fx.fac(5).slice(1)], people:Fx.ppl(['p1','p2','p3','p4']), volume:{mode:'exact', exact:{basic:5, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:10, scope:{kind:'facility', ids:['f1']}}]});
  const first = p.visits.filter(v=>v.facilityId==='f1').map(v=>v.date).sort()[0];
  return verdict(first<=Fx.iso(1) && gapIntervalsOk(p, 'f1', ordOf(Fx.iso(-9)), 10), 'first '+first, 'first '+first);
});
regress('A4 a late fixed visit does not satisfy an earlier max-gap deadline', ()=>{
  const p = Fx.gen({days:30, facilities:[{id:'f1', lastVisit:Fx.iso(-9)}, ...Fx.fac(5).slice(1)], people:Fx.ppl(['p1','p2','p3','p4']), volume:{mode:'exact', exact:{basic:5, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:10, scope:{kind:'facility', ids:['f1']}}],
    overrides:[{date:Fx.iso(20), facilityId:'f1', people:[], fill:true}]});
  const ds = p.visits.filter(v=>v.facilityId==='f1').map(v=>v.date).sort();
  return verdict(ds.length>=3 && ds[0]<=Fx.iso(1) && gapIntervalsOk(p, 'f1', ordOf(Fx.iso(-9)), 10), ds.map(d=>d.slice(5)).join(','), 'dates '+ds.join(','));
});
regress('A5 a special visit that cannot be placed does not suppress ordinary demand or capacity', ()=>{
  const p = Fx.gen({days:5, facilities:Fx.fac(5), people:[{id:'p1', off:OFF(0, 1, 2, 3, 4)}, {id:'p2'}, {id:'p3'}, {id:'p4'}], volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'special', strict:'must', facilityId:'f1', people:['p1'], fill:false, times:1, from:Fx.iso(0), to:Fx.iso(4)},
           {type:'atLeast', strict:'must', n:2, scope:{kind:'facility', ids:['f1', 'f2', 'f3']}}]});
  const A = analyzePlan(p);
  const sp = goalRow(A, 'special');
  return verdict(p.visits.length===3 && p.requested===3 && sp && sp.state==='short' && A.blocking>0, sigOf(p), 'visits '+p.visits.length+' requested '+p.requested+' special '+(sp&&sp.state)+' blocking '+A.blocking);
});
regress('A6 gap progress validates the whole chronological sequence', ()=>{
  Fx.use({days:30, facilities:[{id:'f1', lastVisit:Fx.iso(-5)}, ...Fx.fac(2).slice(1)], people:Fx.ppl(['p1','p2']), volume:{mode:'exact', exact:{basic:1, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:10, scope:{kind:'facility', ids:['f1']}}]});
  const p = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}]);
  const A = analyzePlan(p), row = goalRow(A, 'maxGap');
  return !!row && row.state==='short' && A.blocking>0;
});
regress('A7 deadline equality passes and one day late fails', ()=>{
  const spec = {days:6, facilities:[{id:'f1', lastVisit:Fx.iso(-3)}], people:Fx.ppl(['p1']), volume:{mode:'exact', exact:{basic:1, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:5, scope:{kind:'facility', ids:['f1']}}]};
  Fx.use(spec);
  const onTime = analyzePlan(Fx.manualPlan([{date:Fx.iso(2), facilityId:'f1', team:{a:['p1']}}]));
  const late = analyzePlan(Fx.manualPlan([{date:Fx.iso(3), facilityId:'f1', team:{a:['p1']}}]));
  return goalRow(onTime, 'maxGap').state==='met' && onTime.blocking===0 && goalRow(late, 'maxGap').state==='short' && late.blocking>0;
});
regress('A8 a never-visited facility reports no history instead of a measured gap', ()=>{
  Fx.use({days:6, facilities:Fx.fac(2), people:Fx.ppl(['p1']), volume:{mode:'exact', exact:{basic:1, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:30, scope:{kind:'facility', ids:['f1']}}]});
  const none = analyzePlan(Fx.manualPlan([{date:Fx.iso(1), facilityId:'f2', team:{a:['p1']}}]));
  const some = analyzePlan(Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]));
  const r = goalRow(none, 'maxGap');
  return !!r && r.noHistory===1 && r.state==='short' && goalRow(some, 'maxGap').state==='met' && goalRow(some, 'maxGap').noHistory===1;
});
regress('A9 inherited overdue history is reported separately from in-plan violations', ()=>{
  Fx.use({days:6, facilities:[{id:'f1', lastVisit:Fx.iso(-20)}, {id:'f2'}], people:Fx.ppl(['p1']), volume:{mode:'exact', exact:{basic:1, contracted:0}},
    goals:[{type:'maxGap', strict:'must', days:10, scope:{kind:'facility', ids:['f1']}}]});
  const visited = analyzePlan(Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}]));
  const skipped = analyzePlan(Fx.manualPlan([{date:Fx.iso(0), facilityId:'f2', team:{a:['p1']}}]));
  const rv = goalRow(visited, 'maxGap'), rs = goalRow(skipped, 'maxGap');
  return rv.inherited===1 && rv.state==='met' && visited.blocking===0 && rs.state==='short' && skipped.blocking>0;
});

regress('B1 facility At most Must prevents extra visits', ()=>{
  const p = Fx.gen({days:6, facilities:Fx.fac(5), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:4, contracted:0}},
    goals:[{type:'atMost', strict:'must', n:1, scope:{kind:'facility', ids:['f1', 'f2', 'f3']}}]});
  const n = p.visits.filter(v=>['f1', 'f2', 'f3'].includes(v.facilityId)).length;
  return verdict(n<=1, 'in scope '+n, 'in scope '+n);
});
regress('B2 facility At most Try may be exceeded when a Must obligation needs it', ()=>{
  const p = Fx.gen({days:6, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:4, contracted:0}},
    goals:[{type:'cover', strict:'must', times:1, since:Fx.iso(-30), by:Fx.iso(5), scope:{kind:'facility', ids:['f1', 'f2']}},
           {type:'atMost', strict:'try', n:1, scope:{kind:'facility', ids:['f1', 'f2']}}]});
  const A = analyzePlan(p), cap = A.goals.find(r=>r.g.type==='atMost');
  return verdict(['f1', 'f2'].every(id=>p.visits.some(v=>v.facilityId===id)) && A.blocking===0 && cap && cap.state!=='met' && cap.must===false, sigOf(p), 'visits '+sigOf(p)+' blocking '+A.blocking);
});
regress('B3 disabled goals have no effect on demand or validation', ()=>{
  Fx.use({days:6, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'atMost', strict:'must', n:0, on:false, scope:{kind:'all', ids:[]}}, {type:'atLeast', strict:'must', n:99, on:false, scope:{kind:'all', ids:[]}}]});
  const gp = goalsPreview();
  const p = generatePlan().plan, A = analyzePlan(p);
  return p.visits.length===3 && gp.must===0 && A.blocking===0 && A.goals.length===0;
});
regress('B4 exact zero stays a valid zero for people', ()=>{
  const p = Fx.gen({days:4, facilities:Fx.fac(3), people:[{id:'p1', quota:{min:0, max:0}}, {id:'p2'}, {id:'p3'}], volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'person', strict:'must', people:['p2'], rel:'exactly', n:0, scope:{kind:'all', ids:[]}}]});
  const A = analyzePlan(p);
  return verdict(Fx.count(p, 'p1')===0 && Fx.count(p, 'p2')===0 && Fx.count(p, 'p3')===3 && A.blocking===0, sigOf(p), 'got '+sigOf(p)+' blocking '+A.blocking);
});
regress('B5 an unmet Must goal blocks approval and is never reported satisfied', ()=>{
  const p = Fx.gen({days:6, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'atLeast', strict:'must', n:99, scope:{kind:'all', ids:[]}}]});
  const A = analyzePlan(p), row = goalRow(A, 'atLeast');
  App.plan = p;
  approvePlan();
  const approved = App.plan.approved;
  return A.blocking>0 && row.state==='short' && !approved;
});
regress('B6 open coverage reports ongoing progress; Must obligation is min(remaining, volume)', ()=>{
  Fx.use({days:6, facilities:Fx.fac(5), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'cover', strict:'must', times:1, since:Fx.iso(-30), by:null, scope:{kind:'facility', ids:['f1', 'f2', 'f3', 'f4', 'f5']}}], history:{}});
  const App1 = App.data;
  App1.facilities.find(f=>f.id==='f1').lastVisit = Fx.iso(-3);
  App1.facilities.find(f=>f.id==='f1').history = [{date:Fx.iso(-3), team:[]}];
  App1.facilities.find(f=>f.id==='f1').visitCount = 1;
  const good = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f2', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f3', team:{a:['p2']}}, {date:Fx.iso(2), facilityId:'f4', team:{a:['p3']}}]);
  const bad = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p2']}}, {date:Fx.iso(2), facilityId:'f3', team:{a:['p3']}}]);
  const Ag = analyzePlan(good), Ab = analyzePlan(bad);
  const rg = goalRow(Ag, 'cover'), rb = goalRow(Ab, 'cover');
  return verdict(rg.open===true && rg.state==='met' && Ag.blocking===0 && rb.state==='short' && Ab.blocking>0, 'ok', 'good '+rg.state+' bad '+rb.state+' blocking '+Ag.blocking+'/'+Ab.blocking);
});
regress('B6b open coverage that is not complete never shows as completed', ()=>{
  Fx.use({days:6, facilities:Fx.fac(5), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'cover', strict:'try', times:1, since:Fx.iso(-30), by:null, scope:{kind:'all', ids:[]}}]});
  const p = generatePlan().plan, A = analyzePlan(p), row = goalRow(A, 'cover');
  return row.open===true && row.state==='progress' && row.complete!==true;
});
regress('B7 hard and soft violations are compared lexicographically', ()=>{
  const rules = {list:[], together:[]};
  const mk = (hardN, softN)=>{
    const list = [];
    for(let i=0;i<hardN;i++) list.push({key:'h'+i, min:1, max:null, must:true});
    for(let i=0;i<softN;i++) list.push({key:'s'+i, min:1, max:null, must:false});
    return {rules:{list, together:[]}, q:{}, both:{}};
  };
  const a = mk(1, 0), b = mk(0, 11);
  if(typeof violationScore==='function'){
    const sa = violationScore(a), sb = violationScore(b);
    return sa.hard>sb.hard && compareScores(sa, sb)>0;
  }
  return peopleViolation(a)>peopleViolation(b);
});
regress('B8 shared obligations keep soft copies soft and deadlines per copy', ()=>{
  Fx.use({days:10, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:2, contracted:0}},
    goals:[{type:'atLeast', strict:'must', n:1, scope:{kind:'facility', ids:['f1']}},
           {type:'cover', strict:'try', times:2, since:Fx.iso(-30), by:Fx.iso(1), scope:{kind:'facility', ids:['f1']}}]});
  const win = planWindow();
  const d = buildDemand(win, []);
  const obs = (d.obligations||[]).filter(o=>o.facilityId==='f1');
  const must = obs.filter(o=>o.strict==='must'), soft = obs.filter(o=>o.strict!=='must');
  return verdict(obs.length>=2 && sum(must, o=>o.count)===1 && sum(soft, o=>o.count)>=1 && soft.every(o=>o.latest==null || o.latest>=ordOf(Fx.iso(1))), 'ok', 'obligations '+JSON.stringify(obs.map(o=>[o.strict, o.count, o.latest])));
});

regress('C1 a constrained person is assigned first so exact counts are met', ()=>{
  const p = Fx.gen({days:2, facilities:Fx.fac(2), people:[{id:'Y', quota:{min:1, max:1}}, {id:'X', off:OFF(1), quota:{min:1, max:1}}], volume:{mode:'exact', exact:{basic:2, contracted:0}}});
  return verdict(planIsValid(p) && Fx.count(p, 'X')===1 && Fx.count(p, 'Y')===1, sigOf(p), 'got '+sigOf(p));
});
regress('C2 a solution that needs a cross-visit exchange is found', ()=>{
  const p = Fx.gen({days:3, facilities:Fx.fac(3), people:[{id:'C', off:OFF(1), quota:{min:1, max:1}}, {id:'B', off:OFF(0), quota:{min:1, max:1}}, {id:'A', off:OFF(2), quota:{min:1, max:1}}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  return verdict(planIsValid(p), sigOf(p), 'got '+sigOf(p));
});
regress('C3 scoped exact counts steer which facilities are selected', ()=>{
  const p = Fx.gen({days:4, facilities:[{id:'f1', cat:'B', lastVisit:Fx.iso(-60)}, {id:'f2', cat:'B', lastVisit:Fx.iso(-59)}, {id:'f3', cat:'B', lastVisit:Fx.iso(-58)}, {id:'g1', cat:'B2', lastVisit:Fx.iso(-2)}, {id:'g2', cat:'B2', lastVisit:Fx.iso(-1)}],
    people:[{id:'X'}, {id:'Y'}], volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'person', strict:'must', people:['X'], rel:'exactly', n:2, scope:{kind:'category', ids:['B2']}}]});
  const n = p.visits.filter(v=>visitTeamIds(v).includes('X') && facilityById(v.facilityId).category==='B2').length;
  return verdict(planIsValid(p) && n===2, sigOf(p), 'got '+sigOf(p));
});
regress('C4 day counts look sufficient but eligibility matching reveals the only feasible staffing', ()=>{
  const p = Fx.gen({days:3, facilities:Fx.fac(4), people:[{id:'p1', off:OFF(0), quota:{min:1, max:1}}, {id:'p2', off:OFF(2)}, {id:'p3', quota:{min:0, max:0}}, {id:'p4', off:OFF(2), quota:{min:1, max:2}}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  return verdict(planIsValid(p), sigOf(p), 'got '+sigOf(p));
});
regress('C5 run limits plus exact counts need a date move', ()=>{
  const p = Fx.gen({days:3, facilities:Fx.fac(3), people:[{id:'X', maxRun:1, quota:{min:2, max:2}}, {id:'Y', quota:{min:0, max:0}}], volume:{mode:'exact', exact:{basic:2, contracted:0}}});
  const ds = Fx.dates(p, 'X').map(ordOf);
  return verdict(planIsValid(p) && Fx.count(p, 'X')===2 && Math.abs(ds[1]-ds[0])>1, sigOf(p), 'got '+sigOf(p));
});
regress('C6 locked fixed visits and automatic visits jointly satisfy exact counts', ()=>{
  const p = Fx.gen({days:4, facilities:Fx.fac(4), people:[{id:'A', quota:{min:2, max:2}}, {id:'B', quota:{min:1, max:1}}, {id:'C', quota:{min:1, max:1}}], volume:{mode:'exact', exact:{basic:4, contracted:0}},
    overrides:[{date:Fx.iso(0), facilityId:'f1', people:['A'], fill:false}]});
  return verdict(planIsValid(p) && Fx.count(p, 'A')===2 && Fx.count(p, 'B')===1 && Fx.count(p, 'C')===1, sigOf(p), 'got '+sigOf(p));
});
const FUZZ_SPECS = [
  {days:4, facilities:Fx.fac(2), people:[{id:'p1', off:OFF(0, 2, 3)}, {id:'p2', off:OFF(0, 3), quota:{min:1, max:1}}, {id:'p3', off:OFF(3)}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:2, contracted:0}}},
  {days:4, facilities:Fx.fac(4), people:[{id:'p1', off:OFF(0, 2, 3)}, {id:'p2', off:OFF(1), quota:{min:1, max:1}}, {id:'p3', off:OFF(2)}, {id:'p4', quota:{min:0, max:0}, maxRun:1}], volume:{mode:'exact', exact:{basic:4, contracted:0}}},
  {days:4, facilities:Fx.fac(4), people:[{id:'p1', off:OFF(0), maxRun:1}, {id:'p2', off:OFF(0, 2), quota:{min:1, max:1}}, {id:'p3', off:OFF(1, 2)}, {id:'p4'}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:4, contracted:0}}},
  {days:3, facilities:Fx.fac(3), people:[{id:'p1', off:OFF(2), quota:{min:0, max:2}}, {id:'p2', quota:{min:1, max:1}, maxRun:1}, {id:'p3'}, {id:'p4', off:OFF(0), quota:{min:2, max:2}}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:2, contracted:0}}},
  {days:4, facilities:Fx.fac(2), people:[{id:'p1', off:OFF(1), quota:{min:1, max:1}}, {id:'p2', off:OFF(1, 3), quota:{min:1, max:1}}, {id:'p3', off:OFF(3), quota:{min:0, max:2}}, {id:'p4', off:OFF(0), quota:{min:2, max:2}}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:2, contracted:0}}}
];
FUZZ_SPECS.forEach((spec, i)=>regress('C7.'+(i+1)+' fuzz-derived solvable fixture is solved', ()=>{
  const p = Fx.gen(spec);
  const ref = Ref.solve(planIsValid, {counts:{basic:spec.volume.exact.basic, contracted:0}, maxLeaves:80000});
  if(!ref.found) return 'fixture is not solvable (reference)';
  return verdict(planIsValid(p) && p.visits.length===spec.volume.exact.basic, sigOf(p), 'got '+sigOf(p));
}));

regress('E1 weekly person limits are checked independently of generation', ()=>{
  Fx.use({days:4, facilities:Fx.fac(3), people:[{id:'p1', maxPerWeek:2}, {id:'p2'}, {id:'p3'}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  const p = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f3', team:{a:['p1']}}]);
  const A = analyzePlan(p);
  return A.blocking>0 && A.checks.some(c=>!c.ok && !c.soft);
});
regress('E2 a stale open-seat cache cannot hide an incomplete team', ()=>{
  Fx.use({days:3, facilities:Fx.fac(2), people:Fx.ppl(['p1', 'p2']), volume:{mode:'exact', exact:{basic:1, contracted:0}}});
  const p = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:[]}, open:{}}]);
  const A = analyzePlan(p);
  return !checkOf(A, 'cOpen').ok && A.blocking>0;
});
regress('E2b wrong-pool, duplicate, unknown, inactive and oversized teams are caught', ()=>{
  Fx.use({days:3, facilities:Fx.fac(3), people:[{id:'p1'}, {id:'p2', pool:'b'}, {id:'p3', active:false}, {id:'p4'}], pools:[{id:'a', basic:1}, {id:'b', basic:0}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  const cases = {
    wrongPool:[{date:Fx.iso(0), facilityId:'f1', team:{a:['p2']}}],
    unknown:[{date:Fx.iso(0), facilityId:'f1', team:{a:['ghost']}}],
    inactive:[{date:Fx.iso(0), facilityId:'f1', team:{a:['p3']}}],
    oversized:[{date:Fx.iso(0), facilityId:'f1', team:{a:['p1', 'p4']}}],
    twiceInVisit:[{date:Fx.iso(0), facilityId:'f1', team:{a:['p1', 'p1']}}]
  };
  const bad = [];
  for(const k of Object.keys(cases)){ const A = analyzePlan(Fx.manualPlan(cases[k])); if(A.blocking===0) bad.push(k); }
  return verdict(bad.length===0, 'all caught', 'missed '+bad.join(','));
});
regress('E3 gender repair keeps every context tally equal to a rebuilt tally', ()=>{
  Fx.use({days:3, facilities:Fx.fac(3), people:[{id:'M1', gender:'m'}, {id:'M2', gender:'m'}, {id:'F1', gender:'f'}, {id:'F2', gender:'f'}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:2, contracted:0}},
    settings:{genderRules:[{id:'g', on:true, kinds:['basic'], categories:[], facilities:[], minEach:25, avoidEven:false}]}});
  const start = ordOf(Fx.iso(0));
  const ctx = makeCtx(start);
  const visits = [
    {id:'v0', d:0, date:Fx.iso(0), facilityId:'f1', kind:'basic', team:{a:['M1', 'M2']}, open:{}},
    {id:'v1', d:1, date:Fx.iso(1), facilityId:'f2', kind:'basic', team:{a:['M1', 'F2']}, open:{}}];
  for(const v of visits) commitTeam(v, ordOf(v.date), ctx);
  repairGender(visits, [start, start+1], ctx);
  const fresh = makeCtx(start);
  for(const v of visits) commitTeam(v, ordOf(v.date), fresh);
  const a = ctxSnap(ctx), b = ctxSnap(fresh);
  return verdict(JSON.stringify(a)===JSON.stringify(b), 'equal', 'incremental '+JSON.stringify(a)+' rebuilt '+JSON.stringify(b));
});
regress('E4 a cross-visit swap is evaluated after removing the outgoing assignments', ()=>{
  Fx.use({days:3, facilities:Fx.fac(3), people:[{id:'M1', gender:'m'}, {id:'M2', gender:'m'}, {id:'F1', gender:'f', maxRun:1}, {id:'F2', gender:'f', maxRun:1}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:2, contracted:0}},
    settings:{genderRules:[{id:'g', on:true, kinds:['basic'], categories:[], facilities:[], minEach:25, avoidEven:false}]}});
  const start = ordOf(Fx.iso(0));
  const ctx = makeCtx(start);
  const visits = [
    {id:'v0', d:0, date:Fx.iso(0), facilityId:'f1', kind:'basic', team:{a:['M1', 'M2']}, open:{}},
    {id:'v1', d:1, date:Fx.iso(1), facilityId:'f2', kind:'basic', team:{a:['F1', 'F2']}, open:{}}];
  for(const v of visits) commitTeam(v, ordOf(v.date), ctx);
  repairGender(visits, [start, start+1], ctx);
  const g = v=>teamGender(visitTeamIds(v));
  const ok0 = g(visits[0]).m>=1 && g(visits[0]).f>=1, ok1 = g(visits[1]).m>=1 && g(visits[1]).f>=1;
  return verdict(ok0 && ok1, visits.map(v=>visitTeamIds(v).join('+')).join(' '), 'unrepaired '+visits.map(v=>visitTeamIds(v).join('+')).join(' '));
});
regress('E5 a rigid together pair is never split across teams', ()=>{
  const p = Fx.gen({days:3, facilities:Fx.fac(2), people:[{id:'A'}, {id:'B', off:OFF(0)}, {id:'C'}], pools:[{id:'a', basic:2, contracted:1}], volume:{mode:'exact', exact:{basic:1, contracted:0}},
    settings:{pairs:[{id:'pr', a:'A', b:'B', type:'together', mode:'rigid', strength:'medium', on:true}]}});
  const A = analyzePlan(p);
  const split = p.visits.some(v=>{ const ids = visitTeamIds(v); return ids.includes('A')!==ids.includes('B'); });
  return verdict(!split && A.blocking===0, sigOf(p), 'got '+sigOf(p)+' blocking '+A.blocking);
});
regress('E6 required seniority keeps its threshold and moves the visit to a senior-available day', ()=>{
  const p = Fx.gen({days:3, facilities:[{id:'f1', importance:90}], people:[{id:'S', skill:95, off:OFF(0)}, {id:'J1', skill:40}, {id:'J2', skill:40}], pools:[{id:'a', basic:1, contracted:1}], volume:{mode:'exact', exact:{basic:1, contracted:0}},
    settings:{seniority:{on:true, threshold:60, mode:'require', match:0}}});
  const A = analyzePlan(p);
  return verdict(Fx.count(p, 'S')===1 && A.blocking===0 && checkOf(A, 'cSenior').ok, sigOf(p), 'got '+sigOf(p));
});
regress('E6b unreachable required seniority is a named exception, not a silent downgrade', ()=>{
  const p = Fx.gen({days:3, facilities:[{id:'f1', importance:100}], people:[{id:'J1', skill:40}, {id:'J2', skill:60}], pools:[{id:'a', basic:1, contracted:1}], volume:{mode:'exact', exact:{basic:1, contracted:0}},
    settings:{seniority:{on:true, threshold:60, mode:'require', match:0}}});
  const A = analyzePlan(p);
  const d = A.diags.find(x=>x.key==='dSeniorNone' || x.key==='dSenior');
  return verdict(p.visits.length===1 && Fx.count(p, 'J2')===1 && !!d && A.blocking===0, d.key, 'got '+sigOf(p)+' diag '+(d&&d.key)+' blocking '+A.blocking);
});
regress('E7 special and fixed visits persist their locked people and window', ()=>{
  const p = Fx.gen({days:5, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}},
    goals:[{type:'special', strict:'must', facilityId:'f1', people:['p1'], fill:true, times:1, from:Fx.iso(1), to:Fx.iso(3)}],
    overrides:[{date:Fx.iso(0), facilityId:'f2', people:['p2'], fill:false}]});
  const sv = p.visits.find(v=>v.special), fv = p.visits.find(v=>v.fixed);
  return verdict(!!sv && !!fv && Array.isArray(sv.locked) && sv.locked.includes('p1') && sv.window && sv.window.from===Fx.iso(1) && sv.window.to===Fx.iso(3) && Array.isArray(fv.locked) && fv.locked.includes('p2'), 'ok', 'special '+JSON.stringify(sv && {locked:sv.locked, window:sv.window}));
});
regress('E8 progress keeps generation-time results apart from current-settings results', ()=>{
  Fx.use({days:6, facilities:Fx.fac(5), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:4, contracted:0}},
    goals:[{type:'atLeast', strict:'must', n:3, scope:{kind:'all', ids:[]}}]});
  const p = generatePlan().plan;
  App.plan = p;
  const g = S().goals[0];
  g.n = 10;
  p.stale = true;
  const snap = goalProgress(p, null, {source:'snapshot'}), cur = goalProgress(p, null, {source:'current'});
  return snap[0] && cur[0] && snap[0].target===3 && snap[0].met===true && snap[0].source==='snapshot' && cur[0].target===10 && cur[0].met===false && cur[0].source==='current';
});

const consecutiveDays = (plan, id)=>{
  const ds = Fx.dates(plan, id).map(ordOf).sort((a, b)=>a-b);
  for(let i=1;i<ds.length;i++) if(ds[i]-ds[i-1]<=1) return true;
  return false;
};
const manualTeams = (days, id)=>days.map((d, i)=>({date:Fx.iso(d), facilityId:'f'+(i+1), team:{a:[id]}}));

regress('F1 a custom person rest rule is honoured together with an exact count', ()=>{
  const p = Fx.gen({days:6, facilities:Fx.fac(6), people:[{id:'p1', pattern:{mode:'custom', minRest:1}, quota:{min:3, max:3}}, {id:'p2'}, {id:'p3'}], volume:{mode:'exact', exact:{basic:6, contracted:0}}});
  return verdict(planIsValid(p) && Fx.count(p, 'p1')===3 && !consecutiveDays(p, 'p1'), sigOf(p), 'got '+sigOf(p));
});
regress('F2 a global person pattern set to Must keeps everyone off consecutive days', ()=>{
  const p = Fx.gen({days:6, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:4, contracted:0}}, settings:{patterns:{person:{on:true, strict:'must', pattern:{minRest:1}}}}});
  return verdict(planIsValid(p) && ['p1', 'p2', 'p3'].every(id=>!consecutiveDays(p, id)), sigOf(p), 'got '+sigOf(p));
});
regress('F3 a plan activity cycle only schedules visits on cycle days', ()=>{
  const p = Fx.gen({days:7, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}}, settings:{patterns:{activity:{on:true, strict:'must', pattern:{cycle:{on:1, off:1, anchor:Fx.iso(0)}}}}}});
  const ok_ = p.visits.every(v=>(ordOf(v.date)-ordOf(Fx.iso(0)))%2===0);
  return verdict(planIsValid(p) && ok_ && p.visits.length===3, sigOf(p), 'got '+sigOf(p));
});
regress('F4 a Try pattern is only a preference while Must blocks', ()=>{
  const spec = {days:5, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2']), volume:{mode:'exact', exact:{basic:2, contracted:0}}};
  const visits = manualTeams([0, 1], 'p1');
  Fx.use(Object.assign({settings:{patterns:{person:{on:true, strict:'try', pattern:{minRest:1}}}}}, spec));
  const soft = validatePlan(Fx.manualPlan(visits));
  Fx.use(Object.assign({settings:{patterns:{person:{on:true, strict:'must', pattern:{minRest:1}}}}}, spec));
  const must = validatePlan(Fx.manualPlan(visits));
  return verdict(soft.hard===0 && soft.soft>0 && must.hard>0, 'soft '+soft.soft+' hard '+must.hard, 'soft '+soft.hard+'/'+soft.soft+' must '+must.hard);
});
regress('F5 a pattern goal limits consecutive days for the chosen people only', ()=>{
  const p = Fx.gen({days:6, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:4, contracted:0}}, goals:[{type:'pattern', strict:'must', people:['p1'], pattern:{minRest:0, maxRun:1, cycle:null}}]});
  return verdict(planIsValid(p) && !consecutiveDays(p, 'p1'), sigOf(p), 'got '+sigOf(p));
});
regress('F6 a person set to No limits overrides the global person rule', ()=>{
  Fx.use({days:5, facilities:Fx.fac(4), people:[{id:'p1', pattern:{mode:'none', minRest:0}}, {id:'p2'}], volume:{mode:'exact', exact:{basic:2, contracted:0}}, settings:{patterns:{person:{on:true, strict:'must', pattern:{minRest:1}}}}});
  const a = validatePlan(Fx.manualPlan(manualTeams([0, 1], 'p1')));
  const b = validatePlan(Fx.manualPlan(manualTeams([0, 1], 'p2')));
  const hasRest = v=>v.violations.some(x=>x.group==='cRest' && x.cls==='hard');
  return verdict(!hasRest(a) && hasRest(b), 'ok', 'p1 '+hasRest(a)+' p2 '+hasRest(b));
});
regress('F7 a pattern goal reports a progress row that turns short when broken', ()=>{
  Fx.use({days:5, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2']), volume:{mode:'exact', exact:{basic:2, contracted:0}}, goals:[{type:'pattern', strict:'must', people:['p1'], pattern:{minRest:1, maxRun:null, cycle:null}}]});
  const good = validatePlan(Fx.manualPlan(manualTeams([0, 2], 'p1'))).goals.find(r=>r.g.type==='pattern');
  const bad = validatePlan(Fx.manualPlan(manualTeams([0, 1], 'p1'))).goals.find(r=>r.g.type==='pattern');
  return verdict(good && bad && good.state==='met' && bad.state==='short', good.label+' / '+bad.label, JSON.stringify([good && good.state, bad && bad.state]));
});
regress('F8 a person cycle removes off-cycle days from availability', ()=>{
  Fx.use({days:6, facilities:Fx.fac(3), people:[{id:'p1', avail:{mode:'cycle', cycle:{on:1, off:1, anchor:Fx.iso(0)}, weekdays:[]}}], volume:{mode:'exact', exact:{basic:1, contracted:0}}});
  const p = personById('p1');
  return personAvailable(p, Fx.ord(0)) && !personAvailable(p, Fx.ord(1)) && personAvailable(p, Fx.ord(2));
});

regress('G1 requiring every eligible day covers each day when volume allows', ()=>{
  const p = Fx.gen({days:5, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:5, contracted:0}, requireEveryEligibleDay:true}});
  const v = validatePlan(p);
  return verdict(v.hard===0 && v.days.uncovered.length===0 && v.days.covered===5, sigOf(p), JSON.stringify(v.days));
});
regress('G2 the toggle is off by default and uncovered days are then not violations', ()=>{
  const p = Fx.gen({days:5, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:2, contracted:0}}});
  const v = validatePlan(p);
  return S().volume.requireEveryEligibleDay===false && v.hard===0 && v.days.uncovered.length>0 && !v.violations.some(x=>x.group==='cDays');
});
regress('G3 not enough volume for every day is proven infeasible with a named conflict', ()=>{
  Fx.use({days:5, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}, requireEveryEligibleDay:true}});
  const r = generatePlan();
  return verdict(r.status==='infeasible' && r.conflicts.some(c=>c.key==='xEveryDayVolume'), 'ok', r.status+' '+JSON.stringify(r.conflicts.map(c=>c.key)));
});
regress('G4 a manual plan that skips an eligible day gets a hard day violation', ()=>{
  Fx.use({days:4, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2']), volume:{mode:'exact', exact:{basic:3, contracted:0}, requireEveryEligibleDay:true}});
  const v = validatePlan(Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p2']}}, {date:Fx.iso(2), facilityId:'f3', team:{a:['p1']}}]));
  const d = v.violations.filter(x=>x.key==='dEveryDay');
  return verdict(d.length===1 && d[0].cls==='hard' && d[0].dates[0]===Fx.iso(3), 'ok', JSON.stringify(d.map(x=>x.dates)));
});
regress('G5 every-day coverage with a rest rule that forbids it is a proven conflict', ()=>{
  Fx.use({days:4, facilities:Fx.fac(4), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:4, contracted:0}, requireEveryEligibleDay:true}, settings:{patterns:{activity:{on:true, strict:'must', pattern:{minRest:1}}}}});
  const r = generatePlan();
  return verdict(r.status==='infeasible' && r.conflicts.some(c=>c.key==='xEveryDayRest'), 'ok', r.status+' '+JSON.stringify(r.conflicts.map(c=>c.key)));
});

regress('H1 a heuristic failure under a tiny budget is never labelled infeasible', ()=>{
  const bad = [];
  FUZZ_SPECS.forEach((spec, i)=>{
    Fx.use(spec);
    const r = generatePlan({budget:{ms:1, nodes:1}});
    if(r.status==='infeasible') bad.push(i+1);
  });
  return verdict(bad.length===0, 'ok', 'infeasible on '+bad.join(','));
});
regress('H2 generation is deterministic for identical input', ()=>{
  const spec = FUZZ_SPECS[2];
  const a = sigOf(Fx.gen(spec)), b = sigOf(Fx.gen(spec));
  return verdict(a===b, a, a+' != '+b);
});
regress('H3 a skipped search reports an invalid draft, not infeasible, when no conflict is proven', ()=>{
  Fx.use(FUZZ_SPECS[1]);
  const r = generatePlan({skipSearch:true});
  return verdict(r.status==='valid' || (r.status==='invalid' && r.conflicts.length===0), r.status, r.status+' '+r.conflicts.length);
});
regress('H4 the search reports its own limits', ()=>{
  Fx.use({days:3, facilities:Fx.fac(3), people:[{id:'C', off:OFF(1), quota:{min:1, max:1}}, {id:'B', off:OFF(0), quota:{min:1, max:1}}, {id:'A', off:OFF(2), quota:{min:1, max:1}}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  const r = generatePlan();
  return verdict(r.status==='valid' && (r.search===null || (r.search.ms>=0 && r.search.nodes>=0)), 'ok', r.status);
});

regress('I1 evaluating an edit never touches the live plan', ()=>{
  const p = Fx.gen({days:4, facilities:Fx.fac(4), people:[{id:'A', quota:{min:2, max:2}}, {id:'B'}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  const before = JSON.stringify(p);
  const ev = evaluateEdit(p, t=>{ t.visits[0].date = t.visits[1].date; t.visits[0].team.a = ['A']; });
  return verdict(JSON.stringify(p)===before && ev.trial!==p, 'ok', 'live plan changed');
});
regress('I2 a swap that breaks an exact count is reported as an introduced hard violation', ()=>{
  Fx.use({days:4, facilities:Fx.fac(3), people:[{id:'A', quota:{min:2, max:2}}, {id:'B', quota:{min:1, max:1}}, {id:'C', quota:{min:0, max:0}}], volume:{mode:'exact', exact:{basic:3, contracted:0}}});
  const p = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['A']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['B']}}, {date:Fx.iso(2), facilityId:'f3', team:{a:['A']}}]);
  const cands = candidatesForSeat(p, p.visits[0], 'a', 'A');
  const c = cands.find(x=>x.p.id==='C');
  return verdict(c && !c.reason && c.introduced.length>0 && c.introduced.some(v=>v.group==='cPeople'), 'ok', JSON.stringify(c && [c.reason, c.introduced.map(v=>v.key)]));
});
regress('I3 move targets carry the validator verdict', ()=>{
  Fx.use({days:4, facilities:Fx.fac(3), people:[{id:'A'}, {id:'B'}], volume:{mode:'exact', exact:{basic:2, contracted:0}}, settings:{spacing:{mode:'gap', gap:3, strict:'must'}}});
  const p = Fx.manualPlan([{date:Fx.iso(0), facilityId:'f1', team:{a:['A']}}, {date:Fx.iso(3), facilityId:'f2', team:{a:['B']}}]);
  const t = moveTargets(p, p.visits[0]);
  const near = t.find(x=>x.date===Fx.iso(2));
  return verdict(near && near.introduced>0 && near.hardAfter>0, 'ok', JSON.stringify(near));
});
regress('I4 approval is refused for hard-invalid and stale plans and allowed otherwise', ()=>{
  const p = Fx.gen({days:4, facilities:Fx.fac(3), people:Fx.ppl(['A', 'B']), volume:{mode:'exact', exact:{basic:2, contracted:0}}});
  App.plan = p;
  p.stale = true;
  const r1 = approvePlan();
  p.stale = false;
  p.visits[0].team = {a:[]};
  const r2 = approvePlan();
  const fresh = Fx.gen();
  App.plan = fresh;
  const r3 = approvePlan();
  return verdict(!r1.ok && r1.blockers.some(b=>b.key==='stale') && !r2.ok && r2.blockers.some(b=>b.key==='invalid') && r3.ok && fresh.approved, 'ok', JSON.stringify([r1.ok, r2.ok, r3.ok]));
});
regress('I5 unapproving restores facility and count history exactly', ()=>{
  const p = Fx.gen({days:4, facilities:Fx.fac(3), people:Fx.ppl(['A', 'B']), volume:{mode:'exact', exact:{basic:2, contracted:0}}});
  App.plan = p;
  const before = JSON.stringify([App.data.history, App.data.facilities.map(f=>[f.id, f.lastVisit, f.visitCount, f.history])]);
  const r = approvePlan();
  unapprovePlan();
  const after = JSON.stringify([App.data.history, App.data.facilities.map(f=>[f.id, f.lastVisit, f.visitCount, f.history])]);
  return verdict(r.ok && before===after, 'ok', 'history differs');
});

regress('D1 special visits are placed once each inside the window with the chosen person', ()=>{
  const p = Fx.gen({days:8, facilities:[{id:'f1', cat:'B'}, {id:'f2', cat:'B'}, {id:'f3', cat:'B'}, {id:'f4', cat:'B'}, {id:'s1', cat:'B'}], people:Fx.ppl(['X', 'Y', 'Z']), volume:{mode:'exact', exact:{basic:5, contracted:0}},
    goals:[{type:'special', strict:'must', facilityId:'s1', people:['X'], fill:true, times:2, from:Fx.iso(2), to:Fx.iso(6)}]});
  const sp = p.visits.filter(v=>v.facilityId==='s1');
  const row = goalRow(validatePlan(p), 'special');
  return verdict(planIsValid(p) && sp.length===2 && sp.every(v=>v.date>=Fx.iso(2) && v.date<=Fx.iso(6) && visitTeamIds(v).includes('X')) && row.state==='met', sigOf(p), 'got '+sigOf(p));
});
regress('D2 a special visit without the chosen person does not satisfy the goal', ()=>{
  Fx.use({days:6, facilities:[{id:'f1', cat:'B'}, {id:'s1', cat:'B'}], people:Fx.ppl(['X', 'Y']), volume:{mode:'exact', exact:{basic:2, contracted:0}},
    goals:[{type:'special', strict:'must', facilityId:'s1', people:['X'], fill:true, times:1, from:Fx.iso(0), to:Fx.iso(5)}]});
  const v = validatePlan(Fx.manualPlan([{date:Fx.iso(1), facilityId:'s1', team:{a:['Y']}}, {date:Fx.iso(2), facilityId:'f1', team:{a:['X']}}]));
  const row = goalRow(v, 'special');
  return verdict(row.state==='short' && v.hard>0, 'ok', row.state+' hard '+v.hard);
});

regress('J1 an older save without rulesRev migrates without losing data and gains the new settings', ()=>{
  const base = Fx.data({days:4, facilities:Fx.fac(3), people:Fx.ppl(['A', 'B']), volume:{mode:'exact', exact:{basic:2, contracted:0}}});
  const raw = JSON.parse(JSON.stringify(base));
  delete raw.rulesRev; delete raw.settings.patterns; delete raw.settings.volume.requireEveryEligibleDay;
  const out = normalizeData(raw);
  return verdict(out.rulesRev===RULES_REV && out.people.length===2 && out.facilities.length===3 && out.settings.patterns.person.on===false && out.settings.volume.requireEveryEligibleDay===false, 'ok', JSON.stringify([out.rulesRev, out.people.length, out.facilities.length]));
});
regress('J2 non-numeric and non-finite goal and pattern values are sanitised', ()=>{
  const g = normalizeGoal({type:'atMost', n:'abc', strict:'must', scope:{kind:'all', ids:[]}});
  const pt = normalizePattern({minRest:NaN, maxRun:'x', cycle:{on:'q', off:Infinity, anchor:'bad'}});
  return verdict(Number.isFinite(g.n) && Number.isFinite(pt.minRest) && (pt.maxRun===null || Number.isFinite(pt.maxRun)) && Number.isFinite(pt.cycle.on) && Number.isFinite(pt.cycle.off) && /^\d{4}-\d{2}-\d{2}$/.test(pt.cycle.anchor), 'ok', JSON.stringify([g.n, pt]));
});
regress('J3 a person pattern normalises to a known mode', ()=>{
  const p = freshPerson({id:'z', name:'z', pool:'a', pattern:{mode:'weird', minRest:-4}});
  const n = normalizePersonPattern(p.pattern);
  return verdict(['inherit', 'custom', 'none'].includes(n.mode) && n.minRest>=0, 'ok', JSON.stringify(n));
});

function fuzzSpec(seed){
  const r = mulberry32(seed);
  const rint = (a, b)=>a+Math.floor(r()*(b-a+1));
  const days = rint(3, 4), nf = rint(2, 4), np = rint(2, 4);
  const facilities = [];
  for(let i=1;i<=nf;i++) facilities.push({id:'f'+i, cat:'B'});
  const people = [];
  for(let i=1;i<=np;i++){
    const p = {id:'p'+i, skill:50};
    const off = [];
    for(let d=0;d<days;d++) if(r()<0.35) off.push({from:Fx.iso(d), to:Fx.iso(d)});
    if(off.length) p.off = off;
    const mode = r();
    if(mode<0.4){ const q = rint(0, 2); p.quota = {min:q, max:q}; }
    else if(mode<0.6){ p.quota = {min:rint(0, 1), max:rint(1, 2)}; }
    if(r()<0.2) p.maxRun = 1;
    people.push(p);
  }
  const nv = rint(2, Math.min(days, nf));
  return {days, facilities, people, pools:[{id:'a', basic:rint(1, 2), contracted:1}], volume:{mode:'exact', exact:{basic:nv, contracted:0}}};
}
regress('K1 fuzz: solvable cases are solved, unsolvable ones are never reported valid and full, infeasible is never claimed wrongly', ()=>{
  const bad = [];
  let solvable = 0;
  for(let seed=1;seed<=60;seed++){
    const spec = fuzzSpec(seed);
    Fx.use(spec);
    const ref = Ref.solve(planIsValid, {counts:{basic:spec.volume.exact.basic, contracted:0}, maxLeaves:60000});
    const r = generatePlan();
    const full = r.plan.visits.length===spec.volume.exact.basic;
    const hard = validatePlan(r.plan).hard;
    if(ref.found){
      solvable++;
      if(!full || hard!==0) bad.push('unsolved '+seed);
      if(r.status==='infeasible') bad.push('false infeasible '+seed);
    } else if(!ref.truncated && full && hard===0) bad.push('accepted unsolvable '+seed);
  }
  return verdict(bad.length===0, solvable+' solvable cases checked', bad.join(', '));
});
regress('J4 tampered numeric settings and person fields cannot leak non-finite values into the data', ()=>{
  const d = JSON.parse(JSON.stringify(seedData()));
  d.settings.volume.exact = {basic:'abc', contracted:null};
  d.settings.volume.share = 'z'; d.settings.volume.perDay = 'x'; d.settings.spacing.gap = 'q'; d.settings.distance.nearKm = 'n';
  d.people[0].quota = {min:'a', max:null}; d.people[0].maxRun = 'r'; d.people[0].share = 'k'; d.people[0].skill = {basic:'s', contracted:null, byCategory:{X:'t'}};
  const o = normalizeData(d);
  const bad = [];
  const walk = (x, path)=>{ if(typeof x==='number' && !isFinite(x)) bad.push(path); else if(typeof x==='string' && /^(abc|z|x|q|n|k|s|t)$/.test(x) && /(share|gap|perDay|nearKm|basic|contracted|X)$/.test(path)) bad.push(path); else if(x && typeof x==='object') for(const k in x) walk(x[k], path+'.'+k); };
  walk(o.settings, 's'); walk(o.people[0], 'p');
  return verdict(bad.length===0, 'ok', bad.join(','));
});
