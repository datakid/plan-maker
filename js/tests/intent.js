const intentReg = typeof shipAsync==='function' ? (n, f)=>shipAsync(n, async()=>f()) : regress;
const INTENT = {
  known:new Set(),
  cache:new Map(),
  iters:120,
  coreSeeds:20,
  quickSeeds:4,
  seedList(n){ const out = []; for(let i=1;i<=n;i++) out.push(i); return out; },
  runOne(key, spec, seed, extra){
    const k = key+'|'+seed;
    if(INTENT.cache.has(k)) return INTENT.cache.get(k);
    Fx.use(spec());
    if(extra) extra(App.data);
    const r = generatePlan({seed, iters:INTENT.iters, skipExplain:true});
    const entry = {data:App.data, plan:r.plan, error:r.error || null, status:r.status};
    INTENT.cache.set(k, entry);
    return entry;
  },
  each(list, seedsFor, fn){
    const fails = [];
    let runs = 0;
    for(const item of list){
      for(const seed of INTENT.seedList(seedsFor(item))){
        const e = INTENT.runOne(item.name, item.spec, seed, item.extra);
        App.data = e.data; App.plan = null;
        runs++;
        if(!e.plan){ fails.push(item.name+'#'+seed+': no plan '+e.error); continue; }
        const bad = fn(item, e.plan, seed);
        if(bad) fails.push(item.name+'#'+seed+': '+bad);
      }
    }
    return {fails, runs};
  },
  win(){ return planWindow(); },
  activeFixed(plan){
    const win = INTENT.win();
    return S().overrides.filter(o=>o.on && ordOf(o.date)>=win.start && ordOf(o.date)<=win.end && plan.days.includes(o.date));
  },
  activeSpecials(){ return S().goals.filter(g=>g.on && g.type==='special' && facilityById(g.facilityId)); },
  specialCount(plan, g){
    const win = INTENT.win();
    const w = specialWindow(g, win);
    if(!w) return null;
    const people = liveIds(g.people);
    return plan.visits.filter(v=>v.facilityId===g.facilityId && ordOf(v.date)>=w.lo && ordOf(v.date)<=w.hi && people.every(id=>visitTeamIds(v).includes(id))).length;
  },
  I1(plan){
    for(const o of INTENT.activeFixed(plan)){
      const v = plan.visits.find(x=>x.fixed && x.overrideId===o.id);
      if(!v) return 'fixed '+o.id+' missing';
      if(v.date!==o.date || v.facilityId!==o.facilityId) return 'fixed '+o.id+' moved to '+v.date+' '+v.facilityId;
      const ids = visitTeamIds(v);
      for(const id of liveIds(o.people)) if(!ids.includes(id)) return 'fixed '+o.id+' lost '+id;
    }
    return null;
  },
  I2(plan){
    for(const g of INTENT.activeSpecials()){
      const n = INTENT.specialCount(plan, g);
      if(n==null) continue;
      if(n>=Math.max(1, g.times||1)) continue;
      const d = (plan.genDiags || []).find(x=>x.key==='dSpecialNoDay' && x.args && x.args[0]===goalTitle(g) && x.cause);
      if(!d) return 'special '+g.id+' has '+n+'/'+g.times+' and no named cause';
    }
    return null;
  },
  I3(plan){
    for(const v of plan.visits){
      if(!v.locked || !v.locked.length) continue;
      const ids = visitTeamIds(v);
      for(const id of v.locked) if(!ids.includes(id)) return 'visit '+v.facilityId+' '+v.date+' lost locked '+id;
    }
    return null;
  },
  I4(plan){
    const win = INTENT.win();
    for(const v of plan.visits){
      if(v.fixed){
        const o = S().overrides.find(x=>x.id===v.overrideId);
        if(o && v.date!==o.date) return 'fixed visit moved from '+o.date+' to '+v.date;
      }
      if(v.special){
        const g = S().goals.find(x=>x.id===v.special);
        const w = g && specialWindow(g, win);
        if(w && (ordOf(v.date)<w.lo || ordOf(v.date)>w.hi)) return 'special '+v.special+' at '+v.date+' outside '+isoOf(w.lo)+'..'+isoOf(w.hi);
      }
    }
    return null;
  },
  I5(plan){
    if(S().volume.fill!=='goals') return null;
    const covered = new Set();
    for(const g of S().goals) if(g.on && g.type==='cover'){ for(const f of goalFacilities(g)) covered.add(f.id); }
    for(const v of plan.visits){
      if(v.fixed || v.special) continue;
      const tier = v.why && v.why.tier;
      const serves = (v.why && v.why.goals && v.why.goals.length) || covered.has(v.facilityId);
      if(tier===3 || !serves) return 'visit '+v.facilityId+' '+v.date+' serves no goal in goals-only mode';
    }
    return null;
  },
  I6(plan){
    const val = validatePlan(plan);
    for(const row of val.goals){
      if(row.g.type==='special' || row.g.type==='cover' || row.g.type==='atLeast' || row.g.type==='atMost'){
        if(!row.met) return 'goal '+row.g.id+' not met ('+row.inPlan+'/'+row.target+')';
      }
    }
    return null;
  },
  I7(plan){
    const val = validatePlan(plan);
    const bad = val.violations.filter(x=>x.cls==='hard' && (x.key==='dPersonRule'));
    return bad.length ? 'person rule broken '+bad.length+' times' : null;
  }
};

const INTENT_SPX = Fx.spxVariants().map(v=>Object.assign(v, {core:/pd1-must-(none|chosen)-day|pd1-prefer-none-day|pd2-must-overlap-day|pd3-prefer-chosen-day/.test(v.name)}));
const INTENT_G4 = ['fill', 'exact', 'quota'].map(m=>({name:'g4i2-'+m, spec:()=>Fx.g4i2({mode:m}), core:m==='fill'}));
const INTENT_G4_GOALS = [{name:'g4i2-goals', spec:()=>Fx.g4i2({mode:'fill', fill:'goals'}), core:true}];
const INTENT_POOL = [{name:'pool-never-only', spec:()=>Fx.pool(), core:true}];
const intentSeeds = it=>it.core ? INTENT.coreSeeds : INTENT.quickSeeds;

function intentCase(name, code, list, check){
  intentReg('P0 intent '+code+' · '+name, ()=>{
    const r = INTENT.each(list, intentSeeds, (item, plan)=>check(plan));
    const info = r.runs+' plans, '+r.fails.length+' failing'+(r.fails.length ? ' · '+r.fails.slice(0, 3).join(' | ') : '');
    if(r.fails.length && INTENT.known.has(code)){
      console.log('XFAIL P0 intent '+code+' · '+name+' · '+info);
      return {pass:true, info:'XFAIL (known on main) '+info};
    }
    return verdict(r.fails.length===0, info, info);
  });
}

INTENT.known = new Set([]);

intentCase('fixed visits present with their people (F-SPX)', 'I1', INTENT_SPX, plan=>INTENT.I1(plan));
intentCase('fixed visits present with their people (F-4G2I)', 'I1', INTENT_G4, plan=>INTENT.I1(plan));
intentCase('specials placed or named cause (F-SPX)', 'I2', INTENT_SPX, plan=>INTENT.I2(plan));
intentCase('specials placed or named cause (F-4G2I)', 'I2', INTENT_G4, plan=>INTENT.I2(plan));
intentCase('locked people survive search (F-SPX)', 'I3', INTENT_SPX, plan=>INTENT.I3(plan));
intentCase('locked people survive search (F-4G2I)', 'I3', INTENT_G4, plan=>INTENT.I3(plan));
intentCase('requests stay inside their windows (F-SPX)', 'I4', INTENT_SPX, plan=>INTENT.I4(plan));
intentCase('requests stay inside their windows (F-4G2I)', 'I4', INTENT_G4, plan=>INTENT.I4(plan));
intentCase('goals-only mode adds nothing extra (F-4G2I)', 'I5', INTENT_G4_GOALS, plan=>INTENT.I5(plan));
intentCase('goal visits are not displaced (F-4G2I)', 'I6', INTENT_G4, plan=>INTENT.I6(plan));
intentCase('person never/only rules hold (F-POOL)', 'I7', INTENT_POOL, plan=>INTENT.I7(plan));

INTENT.stress = function(item, seed, moves){
  const e = INTENT.runOne(item.name, item.spec, seed, item.extra);
  App.data = e.data; App.plan = null;
  const rnd = lnsRng(seed*7919);
  lnsRulesCache = compilePeopleRules();
  const work = clonePlan(e.plan);
  const st = makeState(work);
  lnsReindex(st);
  lnsState = st;
  const found = {I3:new Map(), I4:new Map()};
  try{
    for(let i=0;i<moves;i++){
      const m = lnsMoves(st, rnd, null, null);
      if(!m) continue;
      deltaMove(st, m);
      const a = INTENT.I3(work), b = INTENT.I4(work);
      if(a && !found.I3.has(m.name)) found.I3.set(m.name, a);
      if(b && !found.I4.has(m.name)) found.I4.set(m.name, b);
      if(a || b){
        work.visits = clonePlan(e.plan).visits;
        lnsReindex(st);
        evaluateState(st);
      }
    }
  } finally { lnsRulesCache = null; lnsState = null; }
  return found;
};

function intentStress(code, key){
  intentReg('P0 intent '+code+' · LNS moves keep locked people and windows ('+key+')', ()=>{
    const fails = [];
    let runs = 0;
    for(const item of INTENT_SPX.filter(x=>/pd2-must-(chosen|overlap)-week|pd2-prefer-chosen-week|pd1-must-chosen-week|pd3-must-chosen-day/.test(x.name))){
      for(const seed of INTENT.seedList(3)){
        runs++;
        const f = INTENT.stress(item, seed, 1500);
        for(const [mv, msg] of f[key]) fails.push(item.name+'#'+seed+' '+mv+': '+msg);
      }
    }
    const info = runs+' stress runs, '+fails.length+' broken moves'+(fails.length ? ' · '+[...new Set(fails.map(x=>x.split(' ')[1]))].join(',')+' · '+fails.slice(0, 2).join(' | ') : '');
    if(fails.length && INTENT.known.has(code)){
      console.log('XFAIL P0 intent '+code+' · '+info);
      return {pass:true, info:'XFAIL (known on main) '+info};
    }
    return verdict(fails.length===0, info, info);
  });
}
intentStress('I3s', 'I3');
intentStress('I4s', 'I4');


INTENT.gen = (spec, seed, extra)=>{
  Fx.use(spec);
  if(extra) extra(App.data);
  const r = generatePlan({seed:seed || 1, iters:INTENT.iters, skipExplain:true});
  return r;
};
INTENT.visitOf = (plan, fid)=>plan.visits.find(v=>v.facilityId===fid && (fid!=='A' || v.special));

intentReg('R-SPX-1 special and fixed share the only day in the window (per day 1)', ()=>{
  const r = INTENT.gen(Fx.spx({perDay:1, level:'must', people:'none', win:'day'}), 1);
  const a = INTENT.visitOf(r.plan, 'A'), b = INTENT.visitOf(r.plan, 'B');
  if(!a || !b) return verdict(false, '', 'a visit is missing: A='+!!a+' B='+!!b);
  const val = validatePlan(r.plan);
  return verdict(a.date===b.date && val.hardScore===0, 'both on '+a.date+', hard '+val.hardScore, 'A '+a.date+' B '+b.date+' hard '+val.hardScore);
});
intentReg('R-SPX-2 chosen people are kept on the special and the fixed visit', ()=>{
  const r = INTENT.gen(Fx.spx({perDay:1, level:'must', people:'chosen', win:'day'}), 2);
  const a = INTENT.visitOf(r.plan, 'A'), b = INTENT.visitOf(r.plan, 'B');
  if(!a || !b) return verdict(false, '', 'a visit is missing');
  return verdict(visitTeamIds(a).includes('p1') && visitTeamIds(b).includes('p2'), 'p1 on A, p2 on B', 'A '+visitTeamIds(a)+' B '+visitTeamIds(b));
});
intentReg('R-SPX-3 a Prefer special is placed next to a fixed visit', ()=>{
  const r = INTENT.gen(Fx.spx({perDay:1, level:'prefer', people:'none', win:'day'}), 3);
  const a = INTENT.visitOf(r.plan, 'A');
  return verdict(!!a && a.date===Fx.iso(2), 'A on '+(a && a.date), 'A is '+(a ? a.date : 'missing'));
});
intentReg('R-SPX-4 the same person on both on one day: conflict is named, not silent', ()=>{
  const r = INTENT.gen(Fx.spx({perDay:2, level:'must', people:'overlap', win:'day'}), 4);
  const a = INTENT.visitOf(r.plan, 'A');
  if(a) return verdict(false, '', 'A was placed although p1 is on the fixed visit that day');
  const d = (r.plan.genDiags || []).find(x=>x.key==='dSpecialNoDay');
  return verdict(!!d && d.cause && d.cause.code==='people', 'cause '+(d && d.cause && d.cause.code), 'diag '+JSON.stringify(d));
});
intentReg('R-SPX-5 two visits a day: special and fixed both present', ()=>{
  const r = INTENT.gen(Fx.spx({perDay:2, level:'must', people:'none', win:'day'}), 5);
  return verdict(!!INTENT.visitOf(r.plan, 'A') && !!INTENT.visitOf(r.plan, 'B') && validatePlan(r.plan).hardScore===0, 'both present, hard 0', 'missing or hard>0');
});
intentReg('R-SPX-6 with the cap exception off the skip names the day and the fixed visit', ()=>{
  const r = INTENT.gen(Fx.spx({perDay:1, level:'must', people:'none', win:'day'}), 6, d=>{ d.settings.volume.requestsExceedCap = false; });
  const a = INTENT.visitOf(r.plan, 'A');
  const d = (r.plan.genDiags || []).find(x=>x.key==='dSpecialNoDay');
  if(a) return verdict(false, '', 'A placed although the cap is off');
  const val = validatePlan(r.plan);
  return verdict(!!d && d.cause.code==='cap' && d.cause.date===Fx.iso(2) && !!d.cause.by && val.hardScore>0, 'cause cap on '+d.cause.date+' by '+d.cause.by+', hard '+val.hardScore, 'diag '+JSON.stringify(d)+' hard '+val.hardScore);
});
intentReg('R-SPX-7 duplicate choice "reject" survives a reload', ()=>{
  Fx.use(Fx.spx({}));
  App.data.settings.goals[0].dupChoice = 'reject';
  App.data.settings.overrides[0].dupChoice = 'reject';
  const back = normalizeData(JSON.parse(JSON.stringify(App.data)));
  return verdict(back.settings.goals[0].dupChoice==='reject' && back.settings.overrides[0].dupChoice==='reject', 'kept', 'reject was dropped');
});
intentReg('R-SPX-8 a special window outside the plan is not a violation', ()=>{
  const spec = Fx.spx({perDay:1, level:'must', people:'none', win:'week'});
  spec.goals[0].from = Fx.iso(40); spec.goals[0].to = Fx.iso(45);
  const r = INTENT.gen(spec, 1);
  const val = validatePlan(r.plan);
  const row = val.goals.find(x=>x.g.id==='sp1');
  return verdict(val.hardScore===0 && row && row.state==='new', 'row state '+(row && row.state)+', hard '+val.hardScore, 'row '+(row && row.state)+' hard '+val.hardScore);
});
intentReg('R-LNS-5000 5000 accepted-or-rejected moves never break a special', ()=>{
  const item = INTENT_SPX.find(x=>x.name==='spx-pd2-must-chosen-week');
  const f = INTENT.stress(item, 7, 5000);
  const bad = [...f.I3, ...f.I4];
  return verdict(bad.length===0, '5000 moves clean', bad.slice(0, 2).join(' | '));
});

intentReg('P0 intent · cached plans released', ()=>{ INTENT.cache.clear(); return true; });
