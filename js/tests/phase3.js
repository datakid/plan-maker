const P3 = {
  seeds:20,
  setLv(level){ const e = S().days[Fx.W1.tuesdayWd]; e.kind.lv = mkLv(level, 5); },
  w1(seed, level, leans, extra){
    Fx.w1({shuffle:seed, leans:leans || {2:'contracted'}});
    for(const wd of Object.keys(leans || {2:1})) S().days[wd].kind.lv = mkLv(level, 8);
    if(extra) extra();
    const r = generatePlan({seed});
    return r;
  },
  hit(plan, wd){ return plan.visits.some(v=>wdOf(ordOf(v.date))===wd && v.kind==='contracted'); }
};

['prefer', 'must'].forEach(level=>regress('T1 v4: W1 puts a contracted visit on Tuesday in 20/20 seeds (day.kind '+level+')', ()=>{
  let miss = 0, hard = 0;
  for(let seed=1; seed<=P3.seeds; seed++){
    const r = P3.w1(seed, level);
    if(!P3.hit(r.plan, 2)) miss++;
    hard += validatePlan(r.plan).hard;
  }
  return verdict(miss===0 && hard===0, '20/20', 'misses '+miss+' hard '+hard);
}));

['prefer', 'must'].forEach(level=>regress('T2 v4: two contracted-lean days with two contracted visits fill both, 20/20 ('+level+')', ()=>{
  let miss = 0;
  for(let seed=1; seed<=P3.seeds; seed++){
    const r = P3.w1(seed, level, {2:'contracted', 3:'contracted'});
    if(!P3.hit(r.plan, 2) || !P3.hit(r.plan, 3)) miss++;
  }
  return verdict(miss===0, '20/20', 'misses '+miss);
}));

regress('T3 v4: Must contracted day with exact 5 basic / 0 contracted is infeasible and names both rules', ()=>{
  const r = P3.w1(1, 'must', {2:'contracted'}, ()=>{ S().volume = Object.assign({}, S().volume, {mode:'exact', exact:{basic:5, contracted:0}, perDay:1}); });
  const names = (r.conflicts || []).flatMap(c=>c.rules || []);
  return verdict(r.status==='infeasible' && names.includes('day.kind') && names.includes('vol.exact'), 'infeasible '+names.join(','), 'status '+r.status+' rules '+names.join(','));
});

['prefer', 'must'].forEach(level=>regress('T4 v4: favour-category behaves like kind ('+level+')', ()=>{
  let miss = 0;
  for(let seed=1; seed<=P3.seeds; seed++){
    Fx.w1({shuffle:seed, leans:{}});
    S().goals = [];
    const cats = [...new Set(App.data.facilities.filter(f=>visitKindOf(f)==='contracted' && !f.excluded).map(f=>f.category))];
    patchDay(2, {favor:cats[0]});
    S().days[2].category.lv = mkLv(level, 8);
    const r = generatePlan({seed});
    const ok = r.plan.visits.some(v=>wdOf(ordOf(v.date))===2 && facilityById(v.facilityId).category===cats[0]);
    if(!ok) miss++;
  }
  return verdict(miss===0, '20/20', 'misses '+miss);
}));

regress('T7 v4: the same input and seed give an identical plan', ()=>{
  const sig = seed=>{
    Fx.w1({shuffle:3, leans:{2:'contracted'}});
    const r = generatePlan({seed});
    return JSON.stringify(r.plan.visits.map(v=>[v.date, v.facilityId, v.team]));
  };
  return verdict(sig(5)===sig(5), 'identical', 'plans differ');
});

regress('T8 v4: seed data runs week, month and quarter inside the budgets with zero hard violations', ()=>{
  const out = [];
  for(const [name, end, limit] of [['week', '2026-10-08', 400], ['month', '2026-10-29', 1500], ['quarter', '2027-01-07', 5000]]){
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.plan = null;
    S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end});
    const t0 = Date.now();
    const r = generatePlan();
    const ms = Date.now()-t0;
    const hard = validatePlan(r.plan).hard;
    if(hard>0 || ms>limit || r.status!=='valid') out.push(name+' '+ms+'ms hard '+hard+' '+r.status);
  }
  return verdict(!out.length, 'inside budgets', out.join(' | '));
});

regress('T5 v4: the solver score equals validatePlan exactly on 200 random fixtures', ()=>{
  let bad = '', n = 0;
  for(let seed=1; seed<=200 && !bad; seed++){
    Fx.use(fuzzSpec(seed));
    const r = generatePlan({iters:40, seed});
    if(!r.plan) continue;
    n++;
    const s = r.plan.gen && r.plan.gen.search && r.plan.gen.search.score;
    const v = validatePlan(r.plan);
    if(!s || s.hard!==v.hardScore || Math.abs((s.intent||0)-v.intentScore)>1e-6 || Math.abs(s.soft-v.softScore)>1e-6) bad = 'seed '+seed+' '+JSON.stringify(s)+' vs '+v.hardScore+'/'+v.intentScore+'/'+v.softScore;
  }
  return verdict(!bad && n>150, n+' fixtures equal', bad || 'only '+n+' plans');
});

regress('T6 v4: the generator matches the lexicographic optimum on small fixtures', ()=>{
  let cases = 0, match = 0, hardMiss = 0, detail = [];
  for(let seed=1; seed<=60 && cases<30; seed++){
    const spec = fuzzSpec(seed);
    spec.days = Math.min(spec.days, 3);
    spec.facilities = spec.facilities.slice(0, 3);
    spec.people = spec.people.slice(0, 3);
    spec.volume.exact.basic = Math.min(spec.volume.exact.basic, spec.facilities.length, spec.days);
    Fx.use(spec);
    const ref = Ref.best({counts:{basic:spec.volume.exact.basic, contracted:0}, targets:{mode:'exact', basic:spec.volume.exact.basic, contracted:0}, maxLeaves:20000, allowOpen:true});
    if(ref.error || ref.truncated || !ref.best) continue;
    const r = generatePlan({iters:400, seed});
    if(!r.plan) continue;
    const g = statePlanScore(r.plan);
    cases++;
    const same = g.hard<ref.best.hard || (g.hard===ref.best.hard && g.soft<=ref.best.soft+0.002);
    if(same) match++; else if(detail.length<12) detail.push(seed+': gen '+g.hard+'/'+g.soft+' ref '+ref.best.hard+'/'+ref.best.soft);
    if(ref.best.hard===0 && g.hard!==0) hardMiss++;
  }
  return verdict(cases>=15 && match/cases>=0.95 && hardMiss===0, match+'/'+cases+' optimal', match+'/'+cases+' hardMiss '+hardMiss+' '+detail.join(' | '));
});

regress('T9 v4: raising a Prefer weight never increases that rule units in the optimum', ()=>{
  const out = [];
  for(const [field, set] of [['day.kind', ()=>patchDay(1, {lean:'contracted'})], ['day.category', ()=>patchDay(1, {favor:'C'})]]){
    const units = [];
    for(const w of [1, 5, 10]){
      P2.base({days:3, facilities:[].concat(Fx.fac(2, 'B'), [{id:'c1', cat:'C'}, {id:'c2', cat:'C'}]), people:Fx.ppl(['p1', 'p2', 'p3']), pools:[{id:'a', basic:1, contracted:1}], volume:{mode:'exact', exact:{basic:1, contracted:1}, perDay:1}});
      set();
      const e = S().days[1][field==='day.kind' ? 'kind' : 'category'];
      e.lv = mkLv('prefer', w);
      const ref = Ref.best({counts:{basic:1, contracted:1}, maxLeaves:4000});
      if(ref.error || !ref.best) { out.push(field+' no reference'); break; }
      units.push(ref.best.units[field] || 0);
    }
    if(units.length===3 && !(units[2]<=units[1] && units[1]<=units[0])) out.push(field+' units '+units.join(','));
  }
  return verdict(!out.length, 'monotone', out.join(' | '));
});
