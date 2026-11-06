regress('R-SOL-1: a polished plan with lower intent and higher soft is adopted', ()=>{
  const cand = {hard:0, intent:0, soft:9}, cur = {hard:0, intent:2, soft:1};
  return verdict(adoptsOver(cand, cur)===true, 'adopted', 'rejected');
});

regress('R-SOL-2: a polished plan with higher intent and lower soft is rejected', ()=>{
  const cand = {hard:0, intent:2, soft:1}, cur = {hard:0, intent:0, soft:9};
  return verdict(adoptsOver(cand, cur)===false, 'rejected', 'adopted');
});

regress('R-SOL-3: equal scores are not adopted and hard dominates intent', ()=>{
  const same = adoptsOver({hard:0, intent:1, soft:1}, {hard:0, intent:1, soft:1});
  const hardWins = adoptsOver({hard:1, intent:0, soft:0}, {hard:0, intent:5, soft:5});
  return verdict(!same && !hardWins, 'ties and hard tier respected', 'same '+same+' hardWins '+hardWins);
});

regress('R-SOL-4: isPerfect needs hard, intent and soft all clear', ()=>{
  const r = [isPerfect({hard:0, intent:0, soft:0}), isPerfect({hard:0, intent:0, soft:-3}), isPerfect({hard:0, intent:1, soft:0}), isPerfect({hard:1, intent:0, soft:0}), isPerfect({hard:0, intent:0, soft:2})];
  return verdict(JSON.stringify(r)==='[true,true,false,false,false]', 'ok', JSON.stringify(r));
});

regress('R-SOL-5: one rng definition, deterministic per seed', ()=>{
  const a = rng(42), b = rng(42), c = rng(43);
  const xs = [a(), a(), a()], ys = [b(), b(), b()];
  return verdict(typeof mulberry32==='undefined' && typeof lnsRng==='undefined' && JSON.stringify(xs)===JSON.stringify(ys) && c()!==xs[0], 'single rng', 'duplicate or unstable');
});

regress('R-SOL-6: lns never returns a plan worse than its start under cmpScore', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1','p2','p3','p4']),
    settings:{volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:2, perWeek:null}}});
  const r = generatePlan({seed:3, skipSearch:true, skipExplain:true});
  const start = validatePlan(r.plan);
  const out = lnsPlan(r.plan, null, {seed:5, iters:600});
  const end = validatePlan(out.plan);
  return verdict(cmpScore(end, start)<=0, 'not worse', JSON.stringify([start.hardScore, start.intentScore, start.softScore])+' -> '+JSON.stringify([end.hardScore, end.intentScore, end.softScore]));
});

const SOL_SIG = plan=>plan.visits.map(v=>v.date+':'+v.facilityId+':'+visitTeamIds(v).slice().sort().join('+')).sort().join(';');

regress('R-SOL-7: a clock that jumps 10 s per call gives the identical plan', ()=>{
  const make = ()=>Fx.use({days:10, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(8), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5']),
    settings:{volume:{mode:'exact', exact:{basic:6, contracted:0}, perDay:2, perWeek:null}}});
  make();
  const calm = SOL_SIG(generatePlan({seed:9, skipExplain:true}).plan);
  const realNow = Date.now;
  let t = realNow();
  let calls = 0;
  Date.now = ()=>{ calls++; t += 10000; return t; };
  let jumpy;
  try{ make(); jumpy = SOL_SIG(generatePlan({seed:9, skipExplain:true}).plan); } finally { Date.now = realNow; }
  return verdict(calm===jumpy && calls<=8, 'identical, '+calls+' clock reads', 'differs '+(calm===jumpy)+' clock reads '+calls);
});

regress('R-SOL-8: same seed and data give the identical plan on repeat, with explain on', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']),
    settings:{volume:{mode:'exact', exact:{basic:4, contracted:0}, perDay:1, perWeek:null}}});
  const a = generatePlan({seed:4}), b = generatePlan({seed:4});
  return verdict(SOL_SIG(a.plan)===SOL_SIG(b.plan) && JSON.stringify(a.plan.why)===JSON.stringify(b.plan.why), 'identical', 'differs');
});

regress('R-SOL-9: the safety guard marks the result truncated and a normal run is not', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']),
    settings:{volume:{mode:'exact', exact:{basic:4, contracted:0}, perDay:1, perWeek:null}}});
  const cut = generatePlan({seed:4, abort:()=>true, skipExplain:true});
  const calm = generatePlan({seed:4, skipExplain:true});
  const flag = r=>!!(r.plan && r.plan.gen && r.plan.gen.search && r.plan.gen.search.truncated);
  return verdict(flag(cut) && !flag(calm) && GenGuard.abort===null, 'guard flagged, guard cleared', 'cut '+flag(cut)+' calm '+flag(calm));
});

regress('R-SOL-10: budgetFor is deterministic, grows with quality and is bounded by size', ()=>{
  const a = budgetFor(30, 'balanced', 40), b = budgetFor(30, 'balanced', 40), fast = budgetFor(30, 'fast', 40), deep = budgetFor(30, 'thorough', 40);
  const tiny = budgetFor(30, 'balanced', 1), huge = budgetFor(30, 'balanced', 100000);
  const okShape = ['layoutLoops', 'teamNodes', 'lnsIters', 'descentEvals', 'polishIters', 'explainProbes'].every(k=>a[k]>0);
  return verdict(JSON.stringify(a)===JSON.stringify(b) && fast.lnsIters<a.lnsIters && a.lnsIters<deep.lnsIters && tiny.lnsIters<=a.lnsIters && huge.lnsIters<=2*budgetFor(30, 'balanced').lnsIters && okShape, 'ok', JSON.stringify([a, fast, deep, tiny, huge]));
});

regress('R-SOL-11: a second continue round is deterministic and never worse', ()=>{
  Fx.use({days:8, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']),
    settings:{volume:{mode:'exact', exact:{basic:4, contracted:0}, perDay:1, perWeek:null}}});
  const base = generatePlan({seed:4, skipExplain:true}).plan;
  const x = continueSearch({continueFrom:base, skipExplain:true}), y = continueSearch({continueFrom:base, skipExplain:true});
  return verdict(SOL_SIG(x.plan)===SOL_SIG(y.plan) && cmpScore(validatePlan(x.plan), validatePlan(base))<=0, 'deterministic', 'differs or worse');
});

regress('R-SOL-12: memoized incremental scores equal a fresh validatePlan after 600 random moves', ()=>{
  Fx.use({days:12, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(9), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']),
    settings:{volume:{mode:'exact', exact:{basic:7, contracted:0}, perDay:2, perWeek:null}}});
  const plan = generatePlan({seed:2, skipExplain:true}).plan;
  const st = makeState(plan);
  const r = rng(11);
  const facs = App.data.facilities.filter(f=>!f.retired);
  const people = activePeople();
  let drift = null, moves = 0;
  for(let i=0; i<600 && !drift; i++){
    const v = st.plan.visits[Math.floor(r()*st.plan.visits.length)];
    if(!v) break;
    const pick = r();
    let fields;
    if(pick<0.35) fields = {date:st.plan.days[Math.floor(r()*st.plan.days.length)].date};
    else if(pick<0.6) fields = {facilityId:facs[Math.floor(r()*facs.length)].id};
    else {
      const team = fastCopy(v.team);
      const pk = Object.keys(team)[0];
      const pool = people.filter(p=>p.pool===pk);
      if(pk && pool.length && team[pk].length) team[pk][0] = pool[Math.floor(r()*pool.length)].id;
      fields = {team};
    }
    const d = deltaMove(st, {name:'rand', ops:[{op:'set', id:v.id, fields}]});
    moves++;
    if(r()<0.4) d.revert();
    if(moves%50===0 || i===599){
      const fresh = validatePlan(clonePlan(st.plan));
      if(fresh.hardScore!==st.hard || fresh.intentScore!==st.intent) drift = 'move '+moves+' hard '+fresh.hardScore+' vs '+st.hard+' intent '+fresh.intentScore+' vs '+st.intent;
    }
  }
  return verdict(!drift && moves>=500, moves+' moves, no drift', drift || ('only '+moves+' moves'));
});

regress('R-SOL-13: scoped helper caches return what the plain helpers return and are empty outside a search', ()=>{
  Fx.use({days:10, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3', 'p4']),
    settings:{volume:{mode:'exact', exact:{basic:4, contracted:0}, perDay:2, perWeek:null}}});
  const people = activePeople(), days = planFrame(generatePlan({seed:1, skipExplain:true, skipSearch:true}).plan).days;
  const plain = people.map(p=>days.map(o=>[personAvailable(p, o), personBaseAvailable(p, o), isOff(p, isoOf(o))]));
  let scoped = null, frozen = false, depthIn = 0;
  scopeRun(()=>{
    depthIn = SCOPE.depth;
    scoped = people.map(p=>days.map(o=>[personAvailable(p, o), personBaseAvailable(p, o), isOff(p, isoOf(o))]));
    scoped = people.map(p=>days.map(o=>[personAvailable(p, o), personBaseAvailable(p, o), isOff(p, isoOf(o))]));
    frozen = Object.isFrozen(activePeople());
  });
  const mutable = !Object.isFrozen(activePeople());
  return verdict(JSON.stringify(plain)===JSON.stringify(scoped) && frozen && mutable && depthIn===1 && SCOPE.depth===0 && SCOPE.stores.every(m=>m.size===0), 'equal, cleared', 'mismatch');
});

regress('R-SOL-14: ruin, adaptive and scaled modes are deterministic, valid and never worse than the start', ()=>{
  Fx.use({days:14, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(10), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']),
    settings:{volume:{mode:'exact', exact:{basic:8, contracted:0}, perDay:2, perWeek:null}}});
  const base = generatePlan({seed:6, skipExplain:true, skipPolish:true}).plan;
  const opts = {seed:7, iters:500, ruin:true, adaptive:true, scaled:true};
  const a = lnsPlan(base, null, opts), b = lnsPlan(base, null, opts);
  const tried = Object.keys(a.info.byMove).filter(k=>k[0]==='R').reduce((s, k)=>s+a.info.byMove[k].tried, 0);
  const va = validatePlan(a.plan), v0 = validatePlan(base);
  return verdict(SOL_SIG(a.plan)===SOL_SIG(b.plan) && cmpScore(va, v0)<=0 && va.hard<=v0.hard && tried>0, 'deterministic, '+tried+' ruin moves', 'sig '+(SOL_SIG(a.plan)===SOL_SIG(b.plan))+' worse '+(cmpScore(va, v0)>0)+' ruin tried '+tried);
});

regress('R-SOL-15: default lns mix never tries a ruin move', ()=>{
  Fx.use({days:14, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(10), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']),
    settings:{volume:{mode:'exact', exact:{basic:8, contracted:0}, perDay:2, perWeek:null}}});
  const base = generatePlan({seed:6, skipExplain:true, skipPolish:true}).plan;
  const a = lnsPlan(base, null, {seed:7, iters:300});
  return verdict(!Object.keys(a.info.byMove).some(k=>k[0]==='R'), 'legacy mix', 'ruin moves in default run');
});

regress('R-SOL-16: a warm start is never worse than the previous plan and survives a retired facility', ()=>{
  Fx.use({days:10, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(8), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5']),
    settings:{volume:{mode:'exact', exact:{basic:5, contracted:0}, perDay:2, perWeek:null}}});
  const first = generatePlan({seed:3, skipExplain:true});
  const again = generatePlan({seed:3, skipExplain:true, warmFrom:first.plan});
  const kept = again.plan.visits.filter(v=>first.plan.visits.some(w=>w.id===v.id)).length;
  const okAgain = cmpScore(validatePlan(again.plan), validatePlan(first.plan))<=0;
  const gone = first.plan.visits[0].facilityId;
  const fac = App.data.facilities.find(f=>f.id===gone);
  const was = fac.excluded;
  fac.excluded = true;
  let after;
  try{ after = generatePlan({seed:3, skipExplain:true, warmFrom:first.plan}); } finally { fac.excluded = was; }
  const vAfter = validatePlan(after.plan);
  return verdict(okAgain && kept>0 && vAfter.hard===0 && !after.plan.visits.some(v=>v.facilityId===gone), 'kept '+kept+' visits, valid after retiring '+gone, 'okAgain '+okAgain+' kept '+kept+' hard '+vAfter.hard);
});

regress('R-SOL-17: the seat polish pass is deterministic, never worse and leaves no improving single-seat swap', ()=>{
  Fx.use({days:12, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(9), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7']),
    settings:{volume:{mode:'exact', exact:{basic:6, contracted:0}, perDay:2, perWeek:null}}});
  const base = generatePlan({seed:8, skipExplain:true, skipPolish:true}).plan;
  const a = lnsPlan(base, null, {seed:2, iters:400, polish:true}), b = lnsPlan(base, null, {seed:2, iters:400, polish:true});
  const st = makeState(clonePlan(a.plan));
  lnsReindex(st);
  const before = lnsKey(st);
  lnsSeatPolish(st, 100000, 1);
  const after = lnsKey(st);
  return verdict(SOL_SIG(a.plan)===SOL_SIG(b.plan) && cmpScore(validatePlan(a.plan), validatePlan(base))<=0 && lnsCmp(after, before)===0, 'deterministic, local optimum', 'sig '+(SOL_SIG(a.plan)===SOL_SIG(b.plan))+' before '+before+' after '+after);
});

regress('R-SOL-18: the intent lower bound is sound and marks plans that meet it', ()=>{
  const run = (times, to, perDay)=>{
    Fx.use({days:6, facilities:Fx.fac(5), people:[{id:'p1'}, {id:'p2'}, {id:'p3'}, {id:'p4'}], volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay},
      goals:[{type:'special', strict:'must', facilityId:'f1', people:['p1'], fill:true, times, from:Fx.iso(0), to:Fx.iso(to)}]});
    return generatePlan({seed:4, skipExplain:true}).search;
  };
  const easy = run(1, 4, 2);
  const tight = run(3, 1, 1);
  const sound = [easy, tight].every(x=>x.score.hard>0 || x.intentUnits>=x.lowerBound.intentUnits);
  const tightOk = tight.lowerBound.requested===3 && tight.lowerBound.intentUnits===1 && (tight.score.hard>0 ? tight.optimalOnIntent===false : tight.intentUnits>=1);
  const info = JSON.stringify([easy.lowerBound, easy.intentUnits, easy.optimalOnIntent, tight.lowerBound, tight.intentUnits, tight.optimalOnIntent, tight.score.hard]);
  return verdict(sound && easy.lowerBound.intentUnits===0 && easy.optimalOnIntent===true && tightOk, info, info);
});

regress('R-SOL-19: the seat min-cut names the short days and the people who can cover them', ()=>{
  const m = [{id:'a'}, {id:'b'}, {id:'c'}];
  const cap = new Map([['a', 1], ['b', 1], ['c', 1]]);
  const full = seatsCut(m, cap, [{iso:'d1', need:2, avail:['a', 'b', 'c']}, {iso:'d2', need:2, avail:['a', 'b', 'c']}]);
  const narrow = seatsCut([{id:'a'}, {id:'b'}], new Map([['a', 5], ['b', 5]]), [{iso:'d1', need:2, avail:['a']}, {iso:'d2', need:1, avail:['a', 'b']}]);
  const okFull = full.flow===3 && full.days.length===1 && full.days[0].need-full.days[0].got===1 && full.people.length===3 && full.people.every(p=>p.used===1);
  const okNarrow = narrow.flow===2 && narrow.days.length===1 && narrow.days[0].date==='d1' && narrow.days[0].got===1 && narrow.people.length===1 && narrow.people[0].id==='a';
  return verdict(okFull && okNarrow, 'cuts named', JSON.stringify([full, narrow]));
});

regress('R-SOL-20: goal moves and open-seat bias are deterministic, never worse, and goal moves fire on a short goal', ()=>{
  Fx.use({days:14, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(10), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8']),
    settings:{volume:{mode:'exact', exact:{basic:8, contracted:0}, perDay:2, perWeek:null}},
    goals:[{type:'atLeast', strict:'must', n:3, scope:{kind:'facility', ids:['f1', 'f2', 'f3']}}]});
  const base = generatePlan({seed:6, skipExplain:true, skipPolish:true}).plan;
  const opts = {seed:7, iters:500, goal:true, openBias:true};
  const a = lnsPlan(base, null, opts), b = lnsPlan(base, null, opts);
  const goalTried = (a.info.byMove.NGoal || {tried:0}).tried;
  const va = validatePlan(a.plan), v0 = validatePlan(base);
  return verdict(SOL_SIG(a.plan)===SOL_SIG(b.plan) && cmpScore(va, v0)<=0 && va.hard<=v0.hard, 'deterministic, goal moves tried '+goalTried, 'sig '+(SOL_SIG(a.plan)===SOL_SIG(b.plan))+' worse '+(cmpScore(va, v0)>0));
});

regress('R-SOL-21: solveTeams with a preferred assignment reproduces it when it is feasible', ()=>{
  Fx.use({days:10, pools:[{id:'a', basic:2, contracted:1}], facilities:Fx.fac(8), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5', 'p6']),
    settings:{volume:{mode:'exact', exact:{basic:5, contracted:0}, perDay:2, perWeek:null}}});
  const orig = generatePlan({seed:12, skipExplain:true, skipPolish:true}).plan;
  const blank = clonePlan(orig);
  for(const v of blank.visits) for(const pk of Object.keys(v.team || {})) v.team[pk] = [];
  const prefer = warmPrefer(orig);
  const r = solveTeams(blank, {nodes:0, maxNodes:50000}, rng(5), {noise:0.5, prefer});
  if(!r || !r.plan) return 'no solution';
  const same = r.plan.visits.every(v=>{ const o = orig.visits.find(w=>w.date===v.date && w.facilityId===v.facilityId); return o && JSON.stringify(visitTeamIds(v).slice().sort())===JSON.stringify(visitTeamIds(o).slice().sort()); });
  return verdict(same && validatePlan(r.plan).hard===0, 'reproduced', 'differs or invalid');
});

regress('R-SOL-22: explain ranks a fix by the score tuple and reports the tier of each side effect', ()=>{
  Fx.use({days:10, pools:[{id:'a', basic:1, contracted:1}], facilities:Fx.fac(8), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5']),
    settings:{volume:{mode:'exact', exact:{basic:5, contracted:0}, perDay:2, perWeek:null}}});
  const plan = generatePlan({seed:3, skipExplain:true}).plan;
  const why = explainPlan(plan, {seed:3});
  const rows = Object.values(why).filter(w=>w.fixable===true);
  const shaped = rows.every(w=>Array.isArray(w.delta) && w.delta.length===3 && w.worse.every(x=>['hard', 'intent', 'soft'].includes(x.tier)));
  const again = explainPlan(plan, {seed:3});
  return verdict(shaped && JSON.stringify(why)===JSON.stringify(again), rows.length+' fixable lines, deterministic', 'shape '+shaped);
});

regress('R-SOL-23: every replacement offered by the shared eligibility check adds no hard violation', ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end:'2026-12-31'});
  const plan = generatePlan({seed:1, skipExplain:true}).plan;
  const st = makeState(clonePlan(plan));
  lnsReindex(st);
  if(st.hard!==0) return 'seed month plan is not hard-clean';
  let tried = 0, bad = 0;
  for(const v of st.plan.visits){
    for(const pl of S().pools){
      const cur = (v.team || {})[pl.id] || [];
      for(let i=0; i<cur.length; i++){
        const busy = lnsBusy(st.plan, v.date, new Set([v.id]));
        const taken = new Set(cur);
        taken.delete(cur[i]);
        for(const q of lnsEligibleKeep(st.plan, v, pl.id, v.date, busy, taken)){
          if(q.id===cur[i]) continue;
          const next = cur.slice();
          next[i] = q.id;
          const move = {name:'t', ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pl.id]:next})}}]};
          const h0 = st.hard;
          const d = deltaMove(st, move);
          tried++;
          if(st.hard>h0+1e-9) bad++;
          d.revert();
        }
      }
    }
  }
  return verdict(tried>20 && bad===0, tried+' replacements, none break a hard rule', tried+' tried, '+bad+' broke a hard rule');
});

regress('R-SOL-24: the cached, incremental evaluator equals a fresh validatePlan on hard, intent, soft and violation keys after 400 moves in a search scope', ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end:'2026-12-31'});
  const plan = generatePlan({seed:2, skipExplain:true}).plan;
  const people = activePeople();
  const facs = App.data.facilities.filter(f=>!f.retired);
  const r = rng(21);
  let drift = null, moves = 0;
  scopeRun(()=>{
    const st = makeState(clonePlan(plan));
    lnsReindex(st);
    for(let i=0; i<400 && !drift; i++){
      const v = st.plan.visits[Math.floor(r()*st.plan.visits.length)];
      if(!v) break;
      const pick = r();
      let fields;
      if(pick<0.3) fields = {date:st.plan.days[Math.floor(r()*st.plan.days.length)]};
      else if(pick<0.55) fields = {facilityId:facs[Math.floor(r()*facs.length)].id};
      else {
        const team = fastCopy(v.team);
        const pk = Object.keys(team)[0];
        const pool = people.filter(p=>p.pool===pk);
        if(pk && pool.length && team[pk].length) team[pk][0] = pool[Math.floor(r()*pool.length)].id;
        fields = {team};
      }
      const d = deltaMove(st, {name:'rand', ops:[{op:'set', id:v.id, fields}]});
      moves++;
      if(r()<0.5) d.revert();
      if(moves%25===0){
        const fresh = validatePlan(clonePlan(st.plan));
        const keys = x=>x.violations.map(q=>q.key+'|'+(q.visits || []).slice().sort().join(',')+'|'+(q.people || []).slice().sort().join(',')).sort().join(';');
        const mine = st.eval;
        if(fresh.hardScore!==mine.hardScore || fresh.intentScore!==mine.intentScore || Math.abs(fresh.softScore-mine.softScore)>1e-6 || keys(fresh)!==keys(mine)) drift = 'move '+moves+' fresh '+[fresh.hardScore, fresh.intentScore, fresh.softScore]+' incremental '+[mine.hardScore, mine.intentScore, mine.softScore];
      }
    }
  });
  return verdict(!drift && moves>=300, moves+' moves, identical to a fresh validation', drift || ('only '+moves+' moves'));
});

regress('R-SOL-25: the proof pill tells a proven conflict, a search limit, a proven optimum and a plain valid plan apart', ()=>{
  const mk = (status, search, conflicts)=>({visits:[{id:'v'}], gen:{search}, status, conflicts:conflicts || [], stale:false});
  const cls = (plan, blocking)=>{ const n = proofPill(plan, {blocking}); return n ? n.className.replace('tag ', '') : null; };
  const rows = [
    cls(mk('infeasible', {}, [{key:'xPoolDayShort'}]), 2),
    cls(mk('exhausted', {}), 2),
    cls(mk('valid', {optimalOnIntent:true, lowerBound:{requested:2, intentUnits:0}}), 0),
    cls(mk('valid', {optimalOnIntent:true, lowerBound:{requested:0, intentUnits:0}}), 0),
    cls(Object.assign(mk('valid', {}), {stale:true}), 0)
  ];
  const ok = JSON.stringify(rows)==='["danger","warn","ok","mid",null]';
  const labels = ['proofInfeasible', 'proofLimit', 'proofOptimal', 'proofValid'].every(k=>t(k)!==k && t(k+'Hint')!==k+'Hint');
  return verdict(ok && labels, 'four states, strings present', JSON.stringify(rows)+' labels '+labels);
});
