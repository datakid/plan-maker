function lnsRng(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}

function lnsSeatNeed(v, pool){
  const f = facilityById(v.facilityId);
  return f ? visitSeatNeed(v, pool, f) : 0;
}

function refreshOpenSeats(plan){
  for(const v of plan.visits){
    if(!facilityById(v.facilityId)) continue;
    const open = {};
    for(const pl of S().pools){
      const n = lnsSeatNeed(v, pl)-((v.team || {})[pl.id] || []).length;
      if(n>0) open[pl.id] = n;
    }
    v.open = open;
  }
}

let lnsRulesCache = null;
function lnsRules(){ return lnsRulesCache || compilePeopleRules(); }

let lnsState = null;

function lnsBusyScan(plan, date, exceptIds){
  const busy = new Set();
  for(const v of plan.visits) if(v.date===date && !(exceptIds && exceptIds.has(v.id))) for(const id of visitTeamIds(v)) busy.add(id);
  return busy;
}

function lnsBusy(plan, date, exceptIds){
  const st = lnsState;
  if(!st || st.plan!==plan || !st.busyIdx) return lnsBusyScan(plan, date, exceptIds);
  const busy = new Set();
  const c = st.busyIdx.get(date);
  if(c){
    for(const id of c.keys()) busy.add(id);
    if(exceptIds){
      const dec = new Map();
      for(const xid of exceptIds){
        const x = stateVisit(st, xid);
        if(x && x.date===date) for(const id of visitTeamIds(x)) dec.set(id, (dec.get(id) || 0)+1);
      }
      for(const [id, n] of dec) if((c.get(id) || 0)-n<=0) busy.delete(id);
    }
  }
  if(App.debugIndex){
    const scan = lnsBusyScan(plan, date, exceptIds);
    if(scan.size!==busy.size || [...scan].some(id=>!busy.has(id))) throw new Error('busy index drift on '+date);
  }
  return busy;
}

function lnsReindex(st){
  st.busyIdx = busyIndexBuild(st.plan);
  st.vIdxArr = null;
}

function lnsEligible(plan, v, pool, date, busy, taken){
  const rules = lnsRules();
  return activePeople().filter(p=>p.pool===pool && !(taken && taken.has(p.id)) && canSeat(p, v, date, plan, {busy, rules}));
}

function lnsRestaff(plan, v, date, rnd, keepFixed){
  const team = {};
  const busy = lnsBusy(plan, date, new Set([v.id]));
  const taken = new Set();
  const rules = lnsRules();
  for(const pl of S().pools){
    const cur = ((v.team || {})[pl.id] || []).slice();
    const out = [];
    for(const id of cur){
      const p = personById(id);
      const ok = p && !taken.has(id) && canSeat(p, v, date, plan, {busy, rules});
      if(ok || (keepFixed && v.locked && v.locked.includes(id))){ out.push(id); taken.add(id); }
    }
    const need = lnsSeatNeed(v, pl);
    while(out.length<need){
      const pool = lnsEligible(plan, v, pl.id, date, busy, taken);
      if(!pool.length) break;
      const p = pool[Math.floor(rnd()*pool.length)];
      out.push(p.id); taken.add(p.id);
    }
    team[pl.id] = out;
  }
  return team;
}

function lnsMoves(st, rnd, focus, focusPeople){
  const plan = st.plan;
  const live = plan.visits.filter(v=>!v.fixed && facilityById(v.facilityId));
  if(!live.length) return null;
  const pickVisit = ()=>{
    const pool = focus && focus.length ? focus.filter(id=>live.some(v=>v.id===id)) : null;
    if(pool && pool.length && rnd()<0.8){ const id = pool[Math.floor(rnd()*pool.length)]; return live.find(v=>v.id===id); }
    return live[Math.floor(rnd()*live.length)];
  };
  const v = pickVisit();
  const kind = rnd();
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)));
  if(kind<0.10){
    const d = days[Math.floor(rnd()*days.length)];
    if(!d || d===v.date) return null;
    if(plan.visits.some(x=>x.id!==v.id && x.date===d && x.facilityId===v.facilityId)) return null;
    return {name:'N4day', ops:[{op:'set', id:v.id, fields:{date:d, team:lnsRestaff(plan, v, d, rnd, true)}}]};
  }
  if(kind<0.15){
    const w = live[Math.floor(rnd()*live.length)];
    if(!w || w.id===v.id || w.date===v.date) return null;
    if(plan.visits.some(x=>x.id===w.id ? false : (x.date===v.date && x.facilityId===w.facilityId)) || plan.visits.some(x=>x.id!==v.id && x.date===w.date && x.facilityId===v.facilityId)) return null;
    const tv = lnsRestaff(plan, Object.assign({}, v), w.date, rnd, true);
    const tw = lnsRestaff(plan, Object.assign({}, w), v.date, rnd, true);
    return {name:'N4swapDays', ops:[{op:'set', id:v.id, fields:{date:w.date, team:tv}}, {op:'set', id:w.id, fields:{date:v.date, team:tw}}]};
  }
  if(kind<0.20){
    if(v.special) return null;
    const inPlan = new Set(plan.visits.map(x=>x.facilityId));
    const f0 = facilityById(v.facilityId);
    const list = schedulableFacilities().filter(f=>!inPlan.has(f.id) && visitKindOf(f)===v.kind && f.category===f0.category && !(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(ordOf(v.date)))));
    if(!list.length) return null;
    const f = list[Math.floor(rnd()*list.length)];
    return {name:'N4facility', ops:[{op:'set', id:v.id, fields:{facilityId:f.id, team:lnsRestaff(plan, Object.assign({}, v, {facilityId:f.id}), v.date, rnd, true)}}]};
  }
  if(kind<0.50){
    const open = S().pools.filter(pl=>((v.team || {})[pl.id] || []).length<lnsSeatNeed(v, pl));
    const poolList = open.length ? open : S().pools.filter(pl=>lnsSeatNeed(v, pl)>0);
    if(!poolList.length) return null;
    const pl = poolList[Math.floor(rnd()*poolList.length)];
    const cur = ((v.team || {})[pl.id] || []).slice();
    const busy = lnsBusy(plan, v.date, new Set([v.id]));
    const rules = lnsRules();
    const ord = ordOf(v.date);
    const cand = activePeople().filter(p=>p.pool===pl.id && !cur.includes(p.id) && canSeat(p, v, v.date, plan, {busy, rules}));
    if(!cand.length) return null;
    const p = cand[Math.floor(rnd()*cand.length)];
    const nextCur = cur.length>=lnsSeatNeed(v, pl) ? cur.slice(0, -1).concat(p.id) : cur.concat(p.id);
    const ops = [{op:'set', id:v.id, fields:{team:Object.assign({}, v.team || {}, {[pl.id]:nextCur})}}];
    for(const w of live){
      if(w.id===v.id || !visitTeamIds(w).includes(p.id) || Math.abs(ordOf(w.date)-ord)>2) continue;
      const wBusy = lnsBusy(plan, w.date, new Set([w.id]));
      const wl = (w.team[pl.id] || []).slice();
      const spare = lnsEligible(plan, w, pl.id, w.date, wBusy, new Set(wl)).filter(q=>q.id!==p.id);
      if(!spare.length || (w.locked && w.locked.includes(p.id))) return null;
      wl[wl.indexOf(p.id)] = spare[Math.floor(rnd()*spare.length)].id;
      ops.push({op:'set', id:w.id, fields:{team:Object.assign({}, w.team, {[pl.id]:wl})}});
    }
    return {name:'N3chain', ops};
  }
  if(kind<0.58){
    const ids = lnsRestaff(plan, Object.assign({}, v, {team:{}}), v.date, rnd, true);
    return {name:'N3restaff', ops:[{op:'set', id:v.id, fields:{team:ids}}]};
  }
  if(kind<0.80){
    const pools = S().pools.filter(pl=>((v.team || {})[pl.id] || []).length);
    if(!pools.length) return null;
    const pl = pools[Math.floor(rnd()*pools.length)];
    const cur = v.team[pl.id].slice();
    const hit = cur.map((id, k)=>focusPeople && focusPeople.includes(id) ? k : -1).filter(k=>k>=0);
    const i = hit.length ? hit[Math.floor(rnd()*hit.length)] : Math.floor(rnd()*cur.length);
    if(v.locked && v.locked.includes(cur[i])) return null;
    const busy = lnsBusy(plan, v.date, new Set([v.id]));
    const taken = new Set(cur);
    taken.delete(cur[i]);
    const cand = lnsEligible(plan, v, pl.id, v.date, busy, taken).filter(p=>p.id!==cur[i]);
    if(!cand.length) return null;
    cur[i] = cand[Math.floor(rnd()*cand.length)].id;
    return {name:'N3person', ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pl.id]:cur})}}]};
  }
  if(kind<0.88){
    const w = live[Math.floor(rnd()*live.length)];
    const vs = w && w.id!==v.id ? [v, w] : [v];
    const pl = S().pools[Math.floor(rnd()*S().pools.length)];
    const seats = [];
    for(const x of vs) for(let i=0; i<lnsSeatNeed(x, pl); i++) seats.push({x, i});
    const people = activePeople().filter(p=>p.pool===pl.id);
    if(!seats.length || seats.length>people.length) return null;
    const skip = new Set(vs.map(x=>x.id));
    const rules = lnsRules();
    const noBusy = new Set();
    const cost = seats.map(s=>people.map(p=>{
      const busy = plan.visits.some(y=>!skip.has(y.id) && y.date===s.x.date && visitTeamIds(y).includes(p.id));
      if(busy || !canSeat(p, s.x, s.x.date, plan, {busy:noBusy, rules})) return 1e6;
      return (((s.x.team || {})[pl.id] || [])[s.i]===p.id ? 0 : 1)+rnd()*0.9;
    }));
    const h = hungarian(cost);
    if(h.rows.some((j, i)=>j<0 || cost[i][j]>=1e6)) return null;
    const teams = new Map(vs.map(x=>[x.id, Object.assign({}, x.team || {}, {[pl.id]:[]})]));
    seats.forEach((s, i)=>{ teams.get(s.x.id)[pl.id].push(people[h.rows[i]].id); });
    if(vs.length===2 && vs[0].date===vs[1].date){
      const a = teams.get(vs[0].id)[pl.id], b = teams.get(vs[1].id)[pl.id];
      if(a.some(id=>b.includes(id))) return null;
    }
    return {name:'N3hungarian', ops:vs.map(x=>({op:'set', id:x.id, fields:{team:teams.get(x.id)}}))};
  }
  const w = live[Math.floor(rnd()*live.length)];
  if(!w || w.id===v.id) return null;
  const pools = S().pools.filter(pl=>((v.team || {})[pl.id] || []).length && ((w.team || {})[pl.id] || []).length);
  if(!pools.length) return null;
  const pl = pools[Math.floor(rnd()*pools.length)];
  const a = v.team[pl.id].slice(), b = w.team[pl.id].slice();
  const ia = Math.floor(rnd()*a.length), ib = Math.floor(rnd()*b.length);
  if((v.locked && v.locked.includes(a[ia])) || (w.locked && w.locked.includes(b[ib]))) return null;
  if(v.date===w.date && (a.includes(b[ib]) || b.includes(a[ia]))) return null;
  const x = a[ia]; a[ia] = b[ib]; b[ib] = x;
  return {name:'N3swap', ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pl.id]:a})}}, {op:'set', id:w.id, fields:{team:Object.assign({}, w.team, {[pl.id]:b})}}]};
}

function lnsDescent(st, rnd, deadline, maxEvals, flag){
  const plan = st.plan;
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)));
  let evals = 0;
  for(;;){
    const live = plan.visits.filter(v=>!v.fixed && facilityById(v.facilityId));
    const base = lnsCost(st);
    let best = null, bestCost = base;
    const tryMove = move=>{
      if(evals>=maxEvals) return;
      if(Date.now()>deadline){ if(flag) flag.truncated = true; return; }
      evals++;
      const r = deltaMove(st, move);
      const c = lnsCost(st);
      r.revert();
      if(c<bestCost-1e-9){ bestCost = c; best = move; }
    };
    for(const v of live){
      for(const d of days){
        if(d===v.date) continue;
        if(plan.visits.some(x=>x.id!==v.id && x.date===d && x.facilityId===v.facilityId)) continue;
        tryMove({name:'N4day', ops:[{op:'set', id:v.id, fields:{date:d, team:lnsRestaff(plan, v, d, rnd, true)}}]});
      }
    }
    for(let i=0; i<live.length; i++){
      for(let j=i+1; j<live.length; j++){
        const v = live[i], w = live[j];
        if(v.date===w.date) continue;
        tryMove({name:'N4swapDays', ops:[{op:'set', id:v.id, fields:{date:w.date, team:lnsRestaff(plan, Object.assign({}, v), w.date, rnd, true)}}, {op:'set', id:w.id, fields:{date:v.date, team:lnsRestaff(plan, Object.assign({}, w), v.date, rnd, true)}}]});
      }
    }
    if(!best || evals>=maxEvals || Date.now()>deadline) { if(best) deltaMove(st, best); break; }
    deltaMove(st, best);
  }
  return evals;
}

function lnsCost(st){ return st.hard*1e6+st.soft; }

function lnsRun(plan, seed, maxIters, maxMs, onProgress){
  const t0 = Date.now();
  const opts = {seed};
  const rnd = lnsRng(seed>>>0);
  lnsRulesCache = compilePeopleRules();
  const work = clonePlan(plan);
  const st = makeState(work);
  lnsReindex(st);
  lnsState = st;
  const startCost = lnsCost(st);
  let best = clonePlan(work), bestCost = startCost;
  const hist = new Array(50).fill(bestCost);
  const stats = {iters:0, accepted:0, improved:0, byMove:{}, ms:0, stage:'lns', optimal:false, seed:opts.seed || 20260101};
  let sinceBest = 0;
  for(let it=0; it<maxIters; it++){
    if((it&15)===0 && Date.now()-t0>maxMs*0.75){ stats.truncated = true; break; }
    if(onProgress && (it&63)===0) onProgress(it/maxIters);
    if(st.hard===0 && st.soft<=0 && it>0 && opts.stopAtZero) break;
    if(sinceBest>1500) break;
    stats.iters++;
    if(sinceBest>0 && sinceBest%400===0){
      work.visits = clonePlan(best).visits;
      lnsReindex(st);
      evaluateState(st);
      stats.kicks = (stats.kicks || 0)+1;
      for(let k=0; k<4; k++){
        const km = lnsMoves(st, rnd, null, null);
        if(km) deltaMove(st, km);
      }
      hist.fill(lnsCost(st));
      sinceBest++;
    }
    let focus = null, focusPeople = null;
    if(st.eval && rnd()<0.7){
      const bad = st.eval.violations.filter(x=>x.cls!=='exception' && x.visits.length);
      if(bad.length){
        bad.sort((a, b)=>(b.cls==='hard') - (a.cls==='hard'));
        const hardOnes = bad.filter(x=>x.cls==='hard');
        const pool = hardOnes.length ? hardOnes : bad;
        const pick = pool[Math.floor(rnd()*pool.length)];
        focus = pick.visits; focusPeople = pick.people;
      }
    }
    const move = lnsMoves(st, rnd, focus, focusPeople);
    if(!move) continue;
    const before = lnsCost(st);
    const r = deltaMove(st, move);
    const c = lnsCost(st);
    const slot = it%50;
    const stat = stats.byMove[move.name] || (stats.byMove[move.name] = {tried:0, accepted:0, improved:0});
    stat.tried++;
    if(c<=before || c<=hist[slot]){
      stats.accepted++; stat.accepted++;
      if(c<bestCost){ best = clonePlan(work); bestCost = c; stats.improved++; stat.improved++; sinceBest = 0; } else sinceBest++;
    } else { r.revert(); sinceBest++; }
    hist[slot] = lnsCost(st);
  }
  {
    work.visits = clonePlan(best).visits;
    lnsReindex(st);
    evaluateState(st);
    stats.descentEvals = lnsDescent(st, rnd, t0+maxMs, Math.max(60, Math.floor(maxIters*0.15)), stats);
    if(lnsCost(st)<bestCost-1e-9){ best = clonePlan(work); bestCost = lnsCost(st); stats.improved++; }
  }
  lnsRulesCache = null;
  lnsState = null;
  refreshOpenSeats(best);
  stats.ms = Date.now()-t0;
  const bv = validatePlan(best);
  stats.hard = bv.hardScore; stats.soft = bv.softScore;
  return {plan:best, info:stats, improved:bestCost<startCost, cost:bestCost};
}

function lnsPlan(plan, info, opts){
  opts = opts || {};
  const t0 = Date.now();
  const span = plan.days.length;
  const bud = span<=7 ? {iters:3000, ms:400} : (span<=31 ? {iters:8000, ms:1500} : {iters:15000, ms:5000});
  const maxIters = opts.iters || bud.iters;
  const maxMs = opts.ms || bud.ms;
  const base = (opts.seed || 20260101)>>>0;
  const start = validatePlan(plan);
  const runs = start.hard>0 ? (opts.runs || 3) : 1;
  let best = null;
  const total = {iters:0, accepted:0, ms:0, byMove:{}, runs:0};
  for(let r=0; r<runs; r++){
    const left = maxMs-(Date.now()-t0);
    if(left<=5) break;
    const out = lnsRun(plan, (base+Math.imul(r+1, 0x9E3779B1))>>>0, Math.ceil(maxIters/runs), left/(runs-r), opts.onProgress ? (q=>opts.onProgress((r+q)/runs)) : null);
    total.runs++; total.iters += out.info.iters; total.accepted += out.info.accepted;
    if(out.info.truncated) total.truncated = true;
    for(const k of Object.keys(out.info.byMove)){ const m = total.byMove[k] || (total.byMove[k] = {tried:0, accepted:0, improved:0}); for(const f of ['tried', 'accepted', 'improved']) m[f] += out.info.byMove[k][f]; }
    if(!best || out.cost<best.cost) best = out;
    if(best.info.hard===0 && best.info.soft<=0) break;
  }
  if(!best) return {plan, info:{iters:0, accepted:0, ms:0, byMove:{}, stage:'lns', optimal:false, seed:base, hard:start.hardScore, soft:start.softScore}, improved:false};
  total.ms = Date.now()-t0;
  const merged = Object.assign({}, best.info, {iters:total.iters, accepted:total.accepted, byMove:total.byMove, runs:total.runs, ms:total.ms, seed:opts.seed || 20260101, truncated:!!total.truncated});
  return {plan:best.plan, info:merged, improved:best.improved};
}
