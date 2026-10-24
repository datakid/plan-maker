const ANNEAL_HARD_WEIGHT = 200;

function annealCost(v){ return v.hard*ANNEAL_HARD_WEIGHT + v.soft; }

function annealHot(v){
  const visits = new Set(), people = new Set();
  for(const x of v.violations){
    if(x.cls!=='hard') continue;
    for(const id of (x.visits||[])) visits.add(id);
    for(const id of (x.people||[])) people.add(id);
  }
  return {visits:[...visits], people:[...people]};
}

function annealSeatNeed(v, pool){
  const f = facilityById(v.facilityId);
  if(!f || v.auto===false) return 0;
  return visitSeatNeed(v, pool, f);
}

function annealBusy(plan, date, exceptId){
  const busy = new Set();
  for(const v of plan.visits){
    if(v.date!==date || v.id===exceptId) continue;
    for(const id of visitTeamIds(v)) busy.add(id);
  }
  return busy;
}

function annealMove(plan, rnd, hot, people){
  const vs = plan.visits;
  if(!vs.length) return null;
  const pickVisit = pred=>{
    let pool = hot && hot.visits.length ? vs.filter(v=>hot.visits.includes(v.id) && pred(v)) : [];
    if(!pool.length || rnd()<0.2) pool = vs.filter(pred);
    return pool.length ? pool[Math.floor(rnd()*pool.length)] : null;
  };
  const r = rnd();
  const movable = v=>!v.fixed;
  if(r<0.2){
    const v = pickVisit(movable);
    if(!v) return null;
    const d = plan.days[Math.floor(rnd()*plan.days.length)];
    if(d===v.date) return null;
    const old = v.date, oldMoved = v.moved;
    v.date = d; v.moved = true;
    return ()=>{ v.date = old; v.moved = oldMoved; };
  }
  if(r<0.32){
    const a = pickVisit(movable);
    const others = vs.filter(x=>movable(x) && x!==a && a && x.date!==a.date);
    if(!a || !others.length) return null;
    const b = others[Math.floor(rnd()*others.length)];
    const da = a.date, db = b.date, ma = a.moved, mb = b.moved;
    a.date = db; b.date = da; a.moved = true; b.moved = true;
    return ()=>{ a.date = da; b.date = db; a.moved = ma; b.moved = mb; };
  }
  if(r<0.4){
    const v = pickVisit(x=>movable(x) && !x.special);
    if(!v) return null;
    const inPlan = new Set(vs.map(x=>x.facilityId));
    const alts = schedulableFacilities().filter(f=>visitKindOf(f)===v.kind && !inPlan.has(f.id));
    if(!alts.length) return null;
    const f = alts[Math.floor(rnd()*alts.length)];
    const old = v.facilityId, oldKind = v.kind, oldMoved = v.moved;
    v.facilityId = f.id; v.kind = visitKindOf(f); v.moved = true;
    return ()=>{ v.facilityId = old; v.kind = oldKind; v.moved = oldMoved; };
  }
  if(r<0.8){
    const v = pickVisit(x=>x.auto!==false && Object.keys(x.team||{}).some(k=>(x.team[k]||[]).some(id=>!(x.locked||[]).includes(id))));
    if(!v) return null;
    const keys = Object.keys(v.team).filter(k=>(v.team[k]||[]).some(id=>!(lockedOf(v)).includes(id)));
    const pk = keys[Math.floor(rnd()*keys.length)];
    const slots = v.team[pk].map((id, i)=>i).filter(i=>!lockedOf(v).includes(v.team[pk][i]));
    const idx = slots[Math.floor(rnd()*slots.length)];
    const f = facilityById(v.facilityId);
    const ord = ordOf(v.date);
    const busy = annealBusy(plan, v.date, v.id);
    const inTeam = new Set(visitTeamIds(v));
    let cands = people.filter(p=>p.pool===pk && !inTeam.has(p.id) && visitAllows(v, p.id) && !(p.blocked||[]).includes(f.id));
    const free = cands.filter(p=>!busy.has(p.id) && personAvailable(p, ord));
    if(free.length && rnd()<0.85) cands = free;
    if(!cands.length) return null;
    const q = cands[Math.floor(rnd()*cands.length)];
    const old = v.team[pk][idx];
    v.team[pk][idx] = q.id;
    return ()=>{ v.team[pk][idx] = old; };
  }
  if(r<0.9){
    const a = pickVisit(x=>x.auto!==false);
    const others = vs.filter(x=>x!==a && a && x.auto!==false);
    if(!a || !others.length) return null;
    const b = others[Math.floor(rnd()*others.length)];
    const pks = Object.keys(a.team).filter(k=>(a.team[k]||[]).length && (b.team[k]||[]).length);
    if(!pks.length) return null;
    const pk = pks[Math.floor(rnd()*pks.length)];
    const i = Math.floor(rnd()*a.team[pk].length), j = Math.floor(rnd()*b.team[pk].length);
    const x = a.team[pk][i], y = b.team[pk][j];
    if(x===y || lockedOf(a).includes(x) || lockedOf(b).includes(y) || a.team[pk].includes(y) || b.team[pk].includes(x)) return null;
    a.team[pk][i] = y; b.team[pk][j] = x;
    return ()=>{ a.team[pk][i] = x; b.team[pk][j] = y; };
  }
  const over = v=>v.auto!==false && S().pools.some(pl=>((v.team||{})[pl.id]||[]).length>annealSeatNeed(v, pl));
  if(vs.some(over) && rnd()<0.5){
    const v = pickVisit(over);
    const pools = S().pools.filter(pl=>((v.team||{})[pl.id]||[]).length>annealSeatNeed(v, pl));
    const pl = pools[Math.floor(rnd()*pools.length)];
    const idxs = v.team[pl.id].map((id, i)=>i).filter(i=>!lockedOf(v).includes(v.team[pl.id][i]));
    if(!idxs.length) return null;
    const i = idxs[Math.floor(rnd()*idxs.length)];
    const gone = v.team[pl.id][i];
    v.team[pl.id].splice(i, 1);
    return ()=>{ v.team[pl.id].splice(i, 0, gone); };
  }
  const v = pickVisit(x=>x.auto!==false && S().pools.some(pl=>((x.team||{})[pl.id]||[]).length<annealSeatNeed(x, pl)));
  if(!v) return null;
  const pools = S().pools.filter(pl=>((v.team||{})[pl.id]||[]).length<annealSeatNeed(v, pl));
  const pl = pools[Math.floor(rnd()*pools.length)];
  const f = facilityById(v.facilityId);
  const ord = ordOf(v.date);
  const busy = annealBusy(plan, v.date, v.id);
  const inTeam = new Set(visitTeamIds(v));
  let cands = people.filter(p=>p.pool===pl.id && !inTeam.has(p.id) && !(p.blocked||[]).includes(f.id));
  const free = cands.filter(p=>!busy.has(p.id) && personAvailable(p, ord));
  if(free.length) cands = free;
  if(!cands.length) return null;
  const q = cands[Math.floor(rnd()*cands.length)];
  if(!v.team) v.team = {};
  const had = Array.isArray(v.team[pl.id]);
  if(!had) v.team[pl.id] = [];
  v.team[pl.id].push(q.id);
  return ()=>{ v.team[pl.id].pop(); if(!had) delete v.team[pl.id]; };
}

function annealRun(start, seed, iters, deadline, stats){
  const rnd = mulberry32(seed);
  const people = activePeople();
  const cur = clonePlan(start);
  let curV = validatePlan(cur);
  let curCost = annealCost(curV);
  let best = clonePlan(cur), bestV = curV, bestCost = curCost;
  const T0 = 60, T1 = 0.5;
  for(let it=0; it<iters; it++){
    if((it & 15)===0 && Date.now()>deadline) break;
    if(bestCost===0) break;
    const T = T0*Math.pow(T1/T0, it/iters);
    const hot = curV.hard>0 && rnd()<0.35 ? annealHot(curV) : null;
    const undo = annealMove(cur, rnd, hot, people);
    if(!undo) continue;
    stats.iters++;
    const v = validatePlan(cur);
    const c = annealCost(v);
    if(c<=curCost || rnd()<Math.exp((curCost-c)/T)){
      curV = v; curCost = c;
      if(c<bestCost){ best = clonePlan(cur); bestV = v; bestCost = c; }
    } else undo();
  }
  return {plan:best, val:bestV};
}

function refreshOpenSeats(plan){
  for(const v of plan.visits){
    const f = facilityById(v.facilityId);
    if(!f) continue;
    const open = {};
    for(const pl of S().pools){
      const n = annealSeatNeed(v, pl) - ((v.team||{})[pl.id]||[]).length;
      if(n>0) open[pl.id] = n;
    }
    v.open = open;
  }
}

function annealPlan(plan, info, opts){
  opts = opts || {};
  const t0 = Date.now();
  const deadline = t0 + (opts.ms || 2500);
  const runs = opts.runs || 3;
  const base = (opts.seed || 20260101) >>> 0;
  const iters = opts.iters || Math.min(30000, 6000 + 400*plan.visits.length);
  const stats = {runs:0, iters:0, ms:0};
  const startVal = validatePlan(plan);
  let best = plan, bestVal = startVal;
  for(let r=0;r<runs;r++){
    const left = deadline-Date.now();
    if(left<=5) break;
    const out = annealRun(plan, (base + Math.imul(r+1, 0x9E3779B1))>>>0, iters, Date.now()+left/(runs-r), stats);
    stats.runs++;
    if(out.val.hard<bestVal.hard || (out.val.hard===bestVal.hard && out.val.soft<bestVal.soft)){ best = out.plan; bestVal = out.val; }
    if(bestVal.hard===0 && bestVal.soft===0) break;
  }
  if(best!==plan){
    const polished = polishSoft(clonePlan(best));
    const pv = validatePlan(polished);
    if(pv.hard<=bestVal.hard && (pv.hard<bestVal.hard || pv.soft<=bestVal.soft)){ best = polished; bestVal = pv; }
    refreshOpenSeats(best);
  }
  if(bestVal.hard>startVal.hard) best = plan;
  stats.ms = Date.now()-t0;
  return {plan:best, info:stats, found:best!==plan && validatePlan(best).hard===0};
}
