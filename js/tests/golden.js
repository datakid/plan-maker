const GOLD = {
  seeds:[1, 2, 3],
  iters:150,
  sources(){
    const out = [];
    for(const v of INTENT_SPX) if(v.core) out.push({name:v.name, group:'requests', make:()=>Fx.use(v.spec())});
    for(const v of INTENT_G4) out.push({name:v.name, group:'requests', make:()=>Fx.use(v.spec())});
    for(const v of INTENT_POOL) out.push({name:v.name, group:'rules', make:()=>Fx.use(v.spec())});
    out.push({name:'plain-small', group:'plain', make:()=>Fx.use({days:6, facilities:Fx.fac(8), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:5, contracted:0}, perDay:1}})});
    out.push({name:'plain-visitplan', group:'plain', make:()=>Fx.use(Fx.visitplanSpec())});
    out.push({name:'plain-seed-week', group:'plain', make:()=>Fx.w1({shuffle:5})});
    return out;
  },
  snapshot(plan){
    const val = validatePlan(plan);
    const visits = plan.visits.map(v=>v.date+':'+v.facilityId+':'+visitTeamIds(v).slice().sort().join('+')).sort();
    return {hard:val.hardScore, intent:val.intentScore, soft:Math.round(val.softScore*1000)/1000, n:plan.visits.length, visits:visits.join(';')};
  },
  compute(){
    const out = {};
    const keep = App.data, keepPlan = App.plan;
    try{
      for(const src of GOLD.sources()){
        for(const seed of GOLD.seeds){
          src.make();
          const r = generatePlan({seed, iters:GOLD.iters, skipExplain:true, timeScale:40});
          out[src.name+'|'+seed] = r.plan ? GOLD.snapshot(r.plan) : {error:r.error || 'none'};
        }
      }
    } finally { App.data = keep; App.plan = keepPlan; }
    return out;
  },
  diff(now, base, accepted){
    const changed = [];
    for(const k of Object.keys(base)){
      if(accepted && accepted[k]) continue;
      if(JSON.stringify(now[k])!==JSON.stringify(base[k])) changed.push(k);
    }
    for(const k of Object.keys(now)) if(!(k in base) && !(accepted && accepted[k])) changed.push(k+' (new)');
    return changed;
  }
};

intentReg('P0 golden plans: every snapshot identical or explained', ()=>{
  if(typeof GOLDEN_DATA==='undefined') return verdict(false, '', 'js/tests/golden-data.js missing');
  const now = GOLD.compute();
  const accepted = typeof GOLDEN_ACCEPTED!=='undefined' ? GOLDEN_ACCEPTED : {};
  const changed = GOLD.diff(now, GOLDEN_DATA, accepted);
  const total = Object.keys(GOLDEN_DATA).length;
  return verdict(changed.length===0, total+' snapshots identical (accepted changes: '+Object.keys(accepted).length+')', changed.length+' of '+total+' changed without a recorded reason: '+changed.slice(0, 6).join(', '));
});
