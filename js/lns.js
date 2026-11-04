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
  st.tally = planTally(st.plan);
  st.vIdxArr = null;
}

function lnsEligibleKeep(plan, v, pool, date, busy, taken){
  const f = facilityById(v.facilityId);
  const base = lnsEligible(plan, v, pool, date, busy, taken);
  if(!f || !lvMust('senior')) return base;
  return base.filter(p=>lnsSeniorHolds(v, f, Object.assign({}, v.team, {[pool]:[...(taken || []), p.id]})));
}

function lnsEligible(plan, v, pool, date, busy, taken){
  const rules = lnsRules();
  return activePeople().filter(p=>p.pool===pool && !(taken && taken.has(p.id)) && canSeat(p, v, date, plan, {busy, rules}));
}

function lnsWindow(v){
  if(v.protect) return v.protect;
  if(v.special){
    const g = S().goals.find(x=>x.id===v.special);
    const w = g && specialWindow(g, planWindow());
    return w ? {lo:w.lo, hi:w.hi} : null;
  }
  return null;
}
function lnsDayOk(v, d){
  const w = lnsWindow(v);
  if(!w) return true;
  const o = ordOf(d);
  return o>=w.lo && o<=w.hi;
}

function lnsRestaff(plan, v, date, rnd, keepFixed){
  const team = {};
  const busy = lnsBusy(plan, date, new Set([v.id]));
  const taken = new Set();
  const rules = lnsRules();
  for(const pl of S().pools){
    const cur = ((v.team || {})[pl.id] || []).slice();
    const out = [];
    if(keepFixed && v.locked){
      for(const id of v.locked){
        const p = personById(id);
        if(p && p.pool===pl.id && !taken.has(id)){ out.push(id); taken.add(id); }
      }
    }
    for(const id of cur){
      if(taken.has(id)) continue;
      const p = personById(id);
      const ok = p && canSeat(p, v, date, plan, {busy, rules});
      if(ok){ out.push(id); taken.add(id); }
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

function lnsCountFree(){ const V = S().volume; return V.mode==='exact' && V.exactMode==='upTo'; }

function lnsNewVisit(plan, f, date, rnd){
  const v = {id:uid('v'), date, facilityId:f.id, kind:visitKindOf(f), team:{}, open:{}, why:Object.assign({tier:3, goals:[], inserted:true}, facilityScore(f, ordOf(plan.start))),
    moved:false, fixed:false, overrideId:null, special:null, seats:null, only:[], never:[], late:false, locked:null, window:null, auto:true};
  v.team = lnsRestaff(plan, v, date, rnd, false);
  return v;
}

function slotAllowed(plan, f, date){
  const o = ordOf(date), c = dayCfg(o);
  if(!normalWorkday(o)) return false;
  if(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(o))) return false;
  if(c.only && c.only.length && !c.only.includes(f.category)) return false;
  if(plan.visits.filter(x=>x.date===date).length>=dayCap(o)) return false;
  const perWeek = S().volume.perWeek;
  if(perWeek && plan.visits.filter(x=>weekKey(ordOf(x.date))===weekKey(o)).length>=perWeek) return false;
  if(plan.visits.some(x=>x.date===date && x.facilityId===f.id)) return false;
  return true;
}

function lnsCopiesWanted(f){
  let want = 1;
  for(const g of S().goals) if(g.on && g.type==='cover' && inScope(f, g.scope)) want = Math.max(want, g.times||1);
  return want;
}

function lnsInsertSlot(plan, rnd, kind){
  const have = new Map();
  for(const x of plan.visits) have.set(x.facilityId, (have.get(x.facilityId)||0)+1);
  const limits = S().goals.filter(g=>g.on && g.type==='atMost').map(g=>({scope:g.scope, left:(g.n||0) - plan.visits.filter(x=>inScope(facilityById(x.facilityId), g.scope)).length}));
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)) && plan.visits.filter(x=>x.date===d).length<dayCap(ordOf(d)));
  const list = schedulableFacilities().filter(f=>(!kind || visitKindOf(f)===kind) && (have.get(f.id)||0)<lnsCopiesWanted(f) && !limits.some(l=>l.left<=0 && inScope(f, l.scope)));
  if(!days.length || !list.length) return null;
  const d = days[Math.floor(rnd()*days.length)];
  const fit = list.filter(f=>slotAllowed(plan, f, d));
  if(!fit.length) return null;
  return {date:d, f:fit[Math.floor(rnd()*fit.length)]};
}

function lnsCountMove(plan, rnd, live){
  if(S().volume.fill==='goals') return null;
  const free = lnsCountFree();
  const mode = rnd();
  const removable = live.filter(v=>!v.special && !v.fixed);
  if(free && mode<0.34){
    const slot = lnsInsertSlot(plan, rnd, null);
    if(!slot) return null;
    return {name:'N5insert', ops:[{op:'add', visit:lnsNewVisit(plan, slot.f, slot.date, rnd)}]};
  }
  if(free && mode<0.58){
    if(!removable.length) return null;
    const v = removable[Math.floor(rnd()*removable.length)];
    return {name:'N5remove', ops:[{op:'remove', id:v.id}]};
  }
  if(!removable.length) return null;
  const v = removable[Math.floor(rnd()*removable.length)];
  const slot = lnsInsertSlot(plan, rnd, v.kind);
  if(!slot) return null;
  return {name:'N5swapInsert', ops:[{op:'remove', id:v.id}, {op:'add', visit:lnsNewVisit(plan, slot.f, slot.date, rnd)}]};
}

const LNS_GROUPS = [
  {name:'N4day', lo:0, hi:0.10, w:0.10},
  {name:'N4swapDays', lo:0.10, hi:0.15, w:0.05},
  {name:'N4facility', lo:0.15, hi:0.20, w:0.05},
  {name:'N3chain', lo:0.20, hi:0.50, w:0.30},
  {name:'N3restaff', lo:0.50, hi:0.58, w:0.08},
  {name:'N3person', lo:0.58, hi:0.80, w:0.22},
  {name:'N3hungarian', lo:0.80, hi:0.88, w:0.08},
  {name:'N3swap', lo:0.88, hi:0.96, w:0.08},
  {name:'N5count', lo:0.96, hi:1, w:0.04},
  {name:'Rweek', lo:2, hi:2, w:0.10},
  {name:'Rdays', lo:2, hi:2, w:0.10},
  {name:'NGoal', lo:2, hi:2, w:0.10}
];

function lnsPickGroup(rnd, weights){
  let total = 0;
  for(const w of weights) total += w;
  let x = rnd()*total;
  for(let i=0; i<weights.length; i++){ x -= weights[i]; if(x<0) return i; }
  return weights.length-1;
}

function lnsGroupKind(g, rnd){ return g.lo+rnd()*(g.hi-g.lo)*0.999999; }

function lnsGoalMove(st, rnd, live){
  const plan = st.plan;
  const short = st.eval.violations.filter(v=>v.src==='goal' && (v.key==='dCoverShort' || v.key==='dAtLeastShort'));
  if(!short.length) return null;
  const sv = short[Math.floor(rnd()*short.length)];
  const g = S().goals.find(x=>x.id===sv.goal);
  if(!g) return null;
  const count = new Map();
  for(const x of plan.visits) count.set(x.facilityId, (count.get(x.facilityId) || 0)+1);
  let facs;
  if(sv.key==='dCoverShort') facs = (sv.facilities || []).map(id=>facilityById(id)).filter(Boolean);
  else if(g.scope) facs = schedulableFacilities().filter(f=>inScope(f, g.scope));
  else return null;
  facs = facs.filter(f=>(count.get(f.id) || 0)<lnsCopiesWanted(f));
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)) && plan.visits.filter(x=>x.date===d).length<dayCap(ordOf(d)));
  if(!facs.length || !days.length) return null;
  const d = days[Math.floor(rnd()*days.length)];
  const fit = facs.filter(f=>slotAllowed(plan, f, d));
  if(!fit.length) return null;
  const f = fit[Math.floor(rnd()*fit.length)];
  const ops = [{op:'add', visit:lnsNewVisit(plan, f, d, rnd)}];
  if(!lnsCountFree()){
    const out = live.filter(x=>!x.special && !x.fixed && (!g.scope || !inScope(facilityById(x.facilityId), g.scope)));
    if(!out.length) return null;
    ops.push({op:'remove', id:out[Math.floor(rnd()*out.length)].id});
  }
  return {name:'NGoal', ops};
}

function lnsRuin(plan, rnd, live, mode, v){
  const pools = S().pools;
  const pl = pools[Math.floor(rnd()*pools.length)];
  if(!pl) return null;
  let vs;
  if(mode==='week'){
    const wk = weekKey(ordOf(v.date));
    vs = live.filter(x=>weekKey(ordOf(x.date))===wk);
  } else {
    const k = 1+Math.floor(rnd()*3), o0 = ordOf(v.date);
    vs = live.filter(x=>{ const d = ordOf(x.date)-o0; return d>=0 && d<k; });
  }
  const cap = Math.max(3, Math.min(8, Math.round(live.length*0.25)));
  if(vs.length>cap){
    const keyed = vs.map(x=>({x, k:x.id===v.id ? -1 : rnd()})).sort((a, b)=>a.k-b.k);
    vs = keyed.slice(0, cap).map(e=>e.x);
  }
  if(vs.length<2) return null;
  const seats = [];
  for(const x of vs) for(let i=0; i<lnsSeatNeed(x, pl); i++) seats.push({x, i});
  const people = activePeople().filter(p=>p.pool===pl.id);
  if(!seats.length || seats.length>people.length) return null;
  const skip = new Set(vs.map(x=>x.id));
  const rules = lnsRules();
  const noBusy = new Set();
  const busyBy = new Map();
  for(const x of vs) if(!busyBy.has(x.date)) busyBy.set(x.date, lnsBusy(plan, x.date, skip));
  const cost = seats.map(s=>people.map(p=>{
    const held = ((s.x.team || {})[pl.id] || [])[s.i];
    if(held && s.x.locked && s.x.locked.includes(held)) return p.id===held ? 0 : 1e6;
    if(busyBy.get(s.x.date).has(p.id) || !canSeat(p, s.x, s.x.date, plan, {busy:noBusy, rules})) return 1e6;
    return (held===p.id ? 0 : 1)+rnd()*0.9;
  }));
  const h = hungarian(cost);
  if(h.rows.some((j, i)=>j<0 || cost[i][j]>=1e6)) return null;
  const teams = new Map(vs.map(x=>[x.id, Object.assign({}, x.team || {}, {[pl.id]:[]})]));
  seats.forEach((s, i)=>{ teams.get(s.x.id)[pl.id].push(people[h.rows[i]].id); });
  const dayUse = new Map();
  for(const x of vs){
    for(const id of teams.get(x.id)[pl.id]){
      const key = x.date+'|'+id;
      if(dayUse.has(key)) return null;
      dayUse.set(key, 1);
    }
  }
  return {name:mode==='week' ? 'Rweek' : 'Rdays', ops:vs.map(x=>({op:'set', id:x.id, fields:{team:teams.get(x.id)}}))};
}

function lnsSeniorHolds(v, f, team){
  const lvl = seniorLevelFor(f, v.rules, false);
  if(lvl==null) return true;
  const ids = [];
  for(const pk of Object.keys(team || {})) for(const id of team[pk]) ids.push(id);
  if(!ids.length) return true;
  return ids.some(id=>{ const p = personById(id); return p && skillOf(p, v.kind, f.category)>=lvl; });
}

function lnsBreaksSenior(plan, move){
  if(!lvMust('senior')) return false;
  for(const op of move.ops){
    if(op.op!=='set' || !op.fields.team) continue;
    const v = plan.visits.find(x=>x.id===op.id);
    const f = v && facilityById(op.fields.facilityId || v.facilityId);
    if(!v || !f) continue;
    if(lnsSeniorHolds(v, f, v.team) && !lnsSeniorHolds(v, f, op.fields.team)) return true;
  }
  return false;
}

function lnsDayFull(plan, v, d){
  let n = 0;
  for(const x of plan.visits) if(x.date===d && x.id!==v.id) n++;
  return n>=dayCap(ordOf(d));
}

function lnsMoves(st, rnd, focus, focusPeople, group, mode){
  mode = mode || {};
  const plan = st.plan;
  const live = plan.visits.filter(v=>!v.fixed && facilityById(v.facilityId));
  if(!live.length) return null;
  const pickVisit = ()=>{
    const pool = focus && focus.length ? focus.filter(id=>live.some(v=>v.id===id)) : null;
    if(pool && pool.length && rnd()<0.8){ const id = pool[Math.floor(rnd()*pool.length)]; return live.find(v=>v.id===id); }
    if(mode.openBias && rnd()<0.3){
      const holes = live.filter(x=>S().pools.some(pl=>((x.team || {})[pl.id] || []).length<lnsSeatNeed(x, pl)));
      if(holes.length) return holes[Math.floor(rnd()*holes.length)];
    }
    return live[Math.floor(rnd()*live.length)];
  };
  const v = pickVisit();
  if(group && group.name==='NGoal') return lnsGoalMove(st, rnd, live);
  if(group && (group.name==='Rweek' || group.name==='Rdays')) return lnsRuin(plan, rnd, live, group.name==='Rweek' ? 'week' : 'days', v);
  const kind = group ? lnsGroupKind(group, rnd) : rnd();
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)));
  if(kind<0.10){
    const d = days[Math.floor(rnd()*days.length)];
    if(!d || d===v.date || !lnsDayOk(v, d) || lnsDayFull(plan, v, d)) return null;
    if(plan.visits.some(x=>x.id!==v.id && x.date===d && x.facilityId===v.facilityId)) return null;
    return {name:'N4day', ops:[{op:'set', id:v.id, fields:{date:d, team:lnsRestaff(plan, v, d, rnd, true)}}]};
  }
  if(kind<0.15){
    const w = live[Math.floor(rnd()*live.length)];
    if(!w || w.id===v.id || w.date===v.date || !lnsDayOk(v, w.date) || !lnsDayOk(w, v.date)) return null;
    if(plan.visits.some(x=>x.id===w.id ? false : (x.date===v.date && x.facilityId===w.facilityId)) || plan.visits.some(x=>x.id!==v.id && x.date===w.date && x.facilityId===v.facilityId)) return null;
    const tv = lnsRestaff(plan, Object.assign({}, v), w.date, rnd, true);
    const tw = lnsRestaff(plan, Object.assign({}, w), v.date, rnd, true);
    return {name:'N4swapDays', ops:[{op:'set', id:v.id, fields:{date:w.date, team:tv}}, {op:'set', id:w.id, fields:{date:v.date, team:tw}}]};
  }
  if(kind<0.20){
    if(v.special || S().volume.fill==='goals') return null;
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
    let nextCur;
    if(cur.length>=lnsSeatNeed(v, pl)){
      let drop = -1;
      for(let k=cur.length-1; k>=0; k--) if(!(v.locked && v.locked.includes(cur[k]))){ drop = k; break; }
      if(drop<0) return null;
      nextCur = cur.filter((id, k)=>k!==drop).concat(p.id);
    } else nextCur = cur.concat(p.id);
    const ops = [{op:'set', id:v.id, fields:{team:Object.assign({}, v.team || {}, {[pl.id]:nextCur})}}];
    for(const w of live){
      if(w.id===v.id || !visitTeamIds(w).includes(p.id) || Math.abs(ordOf(w.date)-ord)>2) continue;
      const wBusy = lnsBusy(plan, w.date, new Set([w.id]));
      const wl = (w.team[pl.id] || []).slice();
      const spare = lnsEligibleKeep(plan, w, pl.id, w.date, wBusy, new Set(wl)).filter(q=>q.id!==p.id);
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
    if(mode.openBias && cur.length<lnsSeatNeed(v, pl)){
      const busy0 = lnsBusy(plan, v.date, new Set([v.id]));
      const cand0 = lnsEligibleKeep(plan, v, pl.id, v.date, busy0, new Set(cur));
      if(cand0.length) return {name:'N3fill', ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pl.id]:cur.concat([cand0[Math.floor(rnd()*cand0.length)].id])})}}]};
    }
    const hit = cur.map((id, k)=>focusPeople && focusPeople.includes(id) ? k : -1).filter(k=>k>=0);
    const i = hit.length ? hit[Math.floor(rnd()*hit.length)] : Math.floor(rnd()*cur.length);
    if(v.locked && v.locked.includes(cur[i])) return null;
    const busy = lnsBusy(plan, v.date, new Set([v.id]));
    const taken = new Set(cur);
    taken.delete(cur[i]);
    const cand = lnsEligibleKeep(plan, v, pl.id, v.date, busy, taken).filter(p=>p.id!==cur[i]);
    if(!cand.length) return null;
    cur[i] = cand[Math.floor(rnd()*cand.length)].id;
    return {name:'N3person', ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pl.id]:cur})}}]};
  }
  if(kind>=0.96) return lnsCountMove(plan, rnd, live);
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
      const held = ((s.x.team || {})[pl.id] || [])[s.i];
      if(held && s.x.locked && s.x.locked.includes(held)) return p.id===held ? 0 : 1e6;
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

function lnsSeatPolish(st, maxEvals, passes, flag){
  const plan = st.plan;
  let evals = 0;
  for(let pass=0; pass<passes; pass++){
    const live = plan.visits.filter(v=>!v.fixed && facilityById(v.facilityId)).sort((a, b)=>a.date<b.date ? -1 : (a.date>b.date ? 1 : (a.id<b.id ? -1 : 1)));
    let best = null, bestKey = lnsKey(st);
    for(const v of live){
      for(const pl of S().pools){
        const cur = (v.team || {})[pl.id] || [];
        for(let i=0; i<cur.length; i++){
          if(v.locked && v.locked.includes(cur[i])) continue;
          const busy = lnsBusy(plan, v.date, new Set([v.id]));
          const taken = new Set(cur);
          taken.delete(cur[i]);
          const cand = lnsEligibleKeep(plan, v, pl.id, v.date, busy, taken).filter(p=>p.id!==cur[i]);
          for(const p of cand){
            if(evals>=maxEvals) break;
            if(genAborted()){ if(flag) flag.truncated = true; return evals; }
            evals++;
            const team = cur.slice();
            team[i] = p.id;
            const move = {name:'Ppolish', ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pl.id]:team})}}]};
            const r = deltaMove(st, move);
            const c = lnsKey(st);
            r.revert();
            if(lnsCmp(c, bestKey)<0){ bestKey = c; best = move; }
          }
        }
      }
    }
    if(!best) break;
    deltaMove(st, best);
    if(evals>=maxEvals) break;
  }
  return evals;
}

function lnsDescent(st, rnd, maxEvals, flag){
  const plan = st.plan;
  const days = plan.days.filter(d=>normalWorkday(ordOf(d)));
  let evals = 0;
  for(;;){
    const live = plan.visits.filter(v=>!v.fixed && facilityById(v.facilityId));
    let best = null, bestKey = lnsKey(st);
    const tryMove = move=>{
      if(evals>=maxEvals) return;
      if(genAborted()){ if(flag) flag.truncated = true; return; }
      if(lnsBreaksSenior(st.plan, move)) return;
      evals++;
      const r = deltaMove(st, move);
      const c = lnsKey(st);
      r.revert();
      if(lnsCmp(c, bestKey)<0){ bestKey = c; best = move; }
    };
    for(const v of live){
      for(const d of days){
        if(d===v.date || !lnsDayOk(v, d) || lnsDayFull(plan, v, d)) continue;
        if(plan.visits.some(x=>x.id!==v.id && x.date===d && x.facilityId===v.facilityId)) continue;
        tryMove({name:'N4day', ops:[{op:'set', id:v.id, fields:{date:d, team:lnsRestaff(plan, v, d, rnd, true)}}]});
      }
    }
    for(let i=0; i<live.length; i++){
      for(let j=i+1; j<live.length; j++){
        const v = live[i], w = live[j];
        if(v.date===w.date || !lnsDayOk(v, w.date) || !lnsDayOk(w, v.date)) continue;
        tryMove({name:'N4swapDays', ops:[{op:'set', id:v.id, fields:{date:w.date, team:lnsRestaff(plan, Object.assign({}, v), w.date, rnd, true)}}, {op:'set', id:w.id, fields:{date:v.date, team:lnsRestaff(plan, Object.assign({}, w), v.date, rnd, true)}}]});
      }
    }
    if(!best || evals>=maxEvals || genAborted()) { if(best) deltaMove(st, best); break; }
    deltaMove(st, best);
  }
  return evals;
}

function lnsKey(st){ return [st.hard, st.intent, st.soft]; }

function lnsCmp(a, b){
  for(let i=0; i<3; i++){
    const d = a[i]-b[i];
    if(d>1e-9) return 1;
    if(d<-1e-9) return -1;
  }
  return 0;
}

function lnsRun(plan, seed, maxIters, onProgress, mode){
  mode = mode || {};
  const opts = {seed};
  const rnd = rng(seed>>>0);
  lnsRulesCache = compilePeopleRules();
  const work = clonePlan(plan);
  const st = makeState(work);
  lnsReindex(st);
  lnsState = st;
  const startKey = lnsKey(st);
  let best = clonePlan(work), bestKey = startKey, bestHard = st.hard;
  const quiet = Math.max(400, 30*work.visits.length);
  const histLen = mode.scaled ? Math.min(1000, Math.max(50, work.visits.length)) : 50;
  const kickEvery = mode.scaled ? Math.max(400, 10*work.visits.length) : 400;
  const hist = new Array(histLen).fill(startKey);
  const useGroups = !!(mode.ruin || mode.adaptive || mode.goal);
  const gw = LNS_GROUPS.map(g=>(g.name[0]==='R' && !mode.ruin) || (g.name==='NGoal' && !mode.goal) ? 0 : g.w), gScore = LNS_GROUPS.map(()=>0), gUse = LNS_GROUPS.map(()=>0);
  const stats = {iters:0, accepted:0, improved:0, byMove:{}, stage:'lns', optimal:false, seed:opts.seed || 20260101};
  let sinceBest = 0;
  for(let it=0; it<maxIters; it++){
    if((it&15)===0 && genAborted()){ stats.truncated = true; break; }
    if(onProgress && (it&63)===0) onProgress(it/maxIters);
    if(it>0 && opts.stopAtZero && isPerfect(st)) break;
    if(bestHard===0 && sinceBest>quiet) break;
    stats.iters++;
    if(sinceBest>0 && sinceBest%kickEvery===0){
      work.visits = clonePlan(best).visits;
      lnsReindex(st);
      evaluateState(st);
      stats.kicks = (stats.kicks || 0)+1;
      for(let k=0; k<4; k++){
        const km = lnsMoves(st, rnd, null, null);
        if(km) deltaMove(st, km);
      }
      hist.fill(lnsKey(st));
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
    const gi = useGroups ? lnsPickGroup(rnd, gw) : 0;
    const move = lnsMoves(st, rnd, focus, focusPeople, useGroups ? LNS_GROUPS[gi] : undefined, mode);
    if(!move || lnsBreaksSenior(plan, move)) continue;
    const before = lnsKey(st);
    const r = deltaMove(st, move);
    const c = lnsKey(st);
    const slot = it%histLen;
    gUse[gi]++;
    const stat = stats.byMove[move.name] || (stats.byMove[move.name] = {tried:0, accepted:0, improved:0});
    stat.tried++;
    if(lnsCmp(c, before)<=0 || lnsCmp(c, hist[slot])<=0){
      stats.accepted++; stat.accepted++;
      if(lnsCmp(c, bestKey)<0){ best = clonePlan(work); bestKey = c; bestHard = st.hard; stats.improved++; stat.improved++; sinceBest = 0; gScore[gi] += 33; } else {
        sinceBest++;
        gScore[gi] += lnsCmp(c, before)<0 ? 9 : 13;
      }
    } else { r.revert(); sinceBest++; }
    hist[slot] = lnsKey(st);
    if(mode.adaptive && (it+1)%100===0){
      const ratio = LNS_GROUPS.map((g, k)=>gUse[k] ? gScore[k]/gUse[k] : null);
      const used = ratio.filter(x=>x!==null);
      const mean = used.length ? used.reduce((a, b)=>a+b, 0)/used.length : 0;
      if(mean>0) LNS_GROUPS.forEach((g, k)=>{
        if(ratio[k]===null) return;
        const target = Math.min(4*g.w, Math.max(0.25*g.w, g.w*ratio[k]/mean));
        gw[k] = 0.9*gw[k]+0.1*target;
      });
      gScore.fill(0); gUse.fill(0);
    }
  }
  {
    work.visits = clonePlan(best).visits;
    lnsReindex(st);
    evaluateState(st);
    stats.descentEvals = lnsDescent(st, rnd, Math.max(60, Math.floor(maxIters*0.15)), stats);
    if(mode.polish) stats.polishEvals = lnsSeatPolish(st, Math.max(200, Math.floor(maxIters*0.5)), 8, stats);
    if(lnsCmp(lnsKey(st), bestKey)<0){ best = clonePlan(work); bestKey = lnsKey(st); stats.improved++; }
  }
  lnsRulesCache = null;
  lnsState = null;
  refreshOpenSeats(best);
  const bv = validatePlan(best);
  stats.hard = bv.hardScore; stats.intent = bv.intentScore; stats.soft = bv.softScore;
  return {plan:best, info:stats, improved:lnsCmp(bestKey, startKey)<0, key:bestKey};
}

function lnsPlan(plan, info, opts){
  opts = opts || {};
  const span = plan.days.length;
  const maxIters = opts.iters || budgetFor(span, opts.quality, plan.visits.length).lnsIters;
  const base = (opts.seed || 20260101)>>>0;
  const start = validatePlan(plan);
  const runs = start.hard>0 ? (opts.runs || 3) : 1;
  const perRun = Math.ceil(maxIters/runs);
  let best = null;
  const total = {iters:0, accepted:0, byMove:{}, runs:0};
  for(let r=0; r<runs; r++){
    if(r>0 && genAborted()){ total.truncated = true; break; }
    const out = lnsRun(plan, (base+Math.imul(r+1, 0x9E3779B1))>>>0, perRun, opts.onProgress ? (q=>opts.onProgress((r+q)/runs)) : null, {adaptive:!!opts.adaptive, scaled:!!opts.scaled, ruin:!!opts.ruin, polish:!!opts.polish, goal:!!opts.goal, openBias:!!opts.openBias});
    total.runs++; total.iters += out.info.iters; total.accepted += out.info.accepted;
    if(out.info.truncated) total.truncated = true;
    for(const k of Object.keys(out.info.byMove)){ const m = total.byMove[k] || (total.byMove[k] = {tried:0, accepted:0, improved:0}); for(const f of ['tried', 'accepted', 'improved']) m[f] += out.info.byMove[k][f]; }
    if(!best || lnsCmp(out.key, best.key)<0) best = out;
    if(isPerfect(best.info)) break;
  }
  if(!best) return {plan, info:{iters:0, accepted:0, byMove:{}, stage:'lns', optimal:false, seed:base, hard:start.hardScore, intent:start.intentScore, soft:start.softScore}, improved:false};
  const merged = Object.assign({}, best.info, {iters:total.iters, accepted:total.accepted, byMove:total.byMove, runs:total.runs, seed:opts.seed || 20260101, truncated:!!total.truncated});
  return {plan:best.plan, info:merged, improved:best.improved};
}
