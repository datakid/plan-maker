function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function maxFlow(n, edges, s, t){
  const g = Array.from({length:n}, ()=>[]);
  const to = [], cap = [];
  const add = (u, v, c)=>{ g[u].push(to.length); to.push(v); cap.push(c); g[v].push(to.length); to.push(u); cap.push(0); };
  for(const e of edges) if(e[2]>0) add(e[0], e[1], e[2]);
  let flow = 0;
  for(;;){
    const level = new Array(n).fill(-1);
    level[s] = 0;
    const q = [s];
    for(let i=0;i<q.length;i++) for(const id of g[q[i]]) if(cap[id]>0 && level[to[id]]<0){ level[to[id]] = level[q[i]]+1; q.push(to[id]); }
    if(level[t]<0) break;
    const it = new Array(n).fill(0);
    const dfs = (u, f)=>{
      if(u===t) return f;
      for(; it[u]<g[u].length; it[u]++){
        const id = g[u][it[u]];
        if(cap[id]>0 && level[to[id]]===level[u]+1){
          const d = dfs(to[id], Math.min(f, cap[id]));
          if(d>0){ cap[id] -= d; cap[id^1] += d; return d; }
        }
      }
      return 0;
    };
    let f;
    while((f = dfs(s, Infinity))>0) flow += f;
  }
  return flow;
}

function personBounds(rules){
  const out = new Map();
  for(const p of activePeople()){
    let lo = 0, hi = Infinity;
    for(const r of rules.countsOf(p.id)){
      if(!r.must || r.src==='together' || r.scope) continue;
      if(r.min!=null) lo = Math.max(lo, r.min);
      if(r.max!=null) hi = Math.min(hi, r.max);
    }
    out.set(p.id, {lo, hi});
  }
  return out;
}

function maxWorkable(p, daysOrd, hist){
  const taken = new Set(hist.get(p.id) || []);
  const rules = personPatternRules(p).hard;
  const wk = new Map();
  let n = 0;
  for(const o of daysOrd){
    if(!personAvailable(p, o)) continue;
    if(p.maxPerWeek && (wk.get(weekKey(o))||0)>=p.maxPerWeek) continue;
    if(rules.some(r=>ruleBreaksOn(r, taken, o))) continue;
    taken.add(o);
    wk.set(weekKey(o), (wk.get(weekKey(o))||0)+1);
    n++;
  }
  return n;
}

function layoutDemand(plan){
  const m = new Map();
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    const o = ordOf(v.date);
    if(!m.has(o)) m.set(o, {});
    const d = m.get(o);
    const kind = visitKindOf(f);
    for(const pl of S().pools) d[pl.id] = (d[pl.id]||0) + (v.auto===false ? 0 : seatsFor(pl, kind, f.category));
  }
  return m;
}

function flowDeficit(plan, bounds, caps){
  const layout = layoutDemand(plan);
  let total = 0;
  for(const pl of S().pools){
    const members = activePeople().filter(p=>p.pool===pl.id);
    const dayList = [...layout.keys()].filter(o=>layout.get(o)[pl.id]>0).sort((a,b)=>a-b);
    if(!dayList.length) continue;
    const m = members.length, D = dayList.length;
    const s = 0, t = m+D+1;
    const demand = sum(dayList, o=>layout.get(o)[pl.id]);
    for(const mode of ['lo','hi']){
      const edges = [];
      members.forEach((p, i)=>{
        const b = bounds.get(p.id) || {lo:0, hi:Infinity};
        const cap = mode==='lo' ? b.lo : Math.min(b.hi, caps ? (caps.get(p.id)==null ? Infinity : caps.get(p.id)) : Infinity);
        edges.push([s, 1+i, Math.min(cap, D)]);
        dayList.forEach((o, j)=>{ if(personAvailable(p, o)) edges.push([1+i, 1+m+j, 1]); });
      });
      dayList.forEach((o, j)=>edges.push([1+m+j, t, layout.get(o)[pl.id]]));
      const f = maxFlow(m+D+2, edges, s, t);
      if(mode==='lo') total += Math.max(0, sum(members, p=>Math.min((bounds.get(p.id)||{lo:0}).lo, D)) - f);
      else total += Math.max(0, demand - f);
    }
  }
  return total;
}

function scopedDeficit(plan, rules){
  let total = 0;
  const vis = plan.visits.map(v=>({v, f:facilityById(v.facilityId), ord:ordOf(v.date)})).filter(x=>x.f);
  for(const r of rules.list){
    if(!r.must || r.min==null || r.min<=0 || r.src==='together' || r.pid==null) continue;
    const p = personById(r.pid);
    if(!p) continue;
    const dates = new Set();
    for(const x of vis){
      if(!inScopeOpt(x.f, r.scope)) continue;
      if(!personAvailable(p, x.ord) || (p.blocked||[]).includes(x.f.id)) continue;
      if(rules.denied(p.id, x.f)==='must') continue;
      dates.add(x.ord);
    }
    total += Math.max(0, r.min - dates.size);
  }
  return total;
}

function preflightPlan(info, plan){
  const conflicts = [];
  const set = S();
  const win = info.win;
  const rules = compilePeopleRules();
  const bounds = personBounds(rules);
  const hist = historyIndex(win.start).map;
  const workDays = win.days.filter(o=>normalWorkday(o) || isOverrideDate(isoOf(o)));
  const add = (key, args, extra)=>conflicts.push(Object.assign({key, args:args||[], sev:'error'}, extra||{}));
  const pools = set.pools;

  const cap = new Map();
  for(const p of activePeople()){
    const b = bounds.get(p.id);
    const name = p.name;
    if(b.lo>b.hi) add('xBoundsEmpty', [name, b.lo, b.hi], {people:[p.id]});
    const lockedFixed = info.fixed.filter(x=>x.people.includes(p.id)).length;
    const can = maxWorkable(p, workDays, hist) + lockedFixed;
    cap.set(p.id, can);
    if(b.lo>can) add('xQuotaDays', [name, b.lo, can], {people:[p.id]});
  }

  const volume = set.volume;
  const strictSlots = sum([...info.demand.items.values()], it=>it.slots.filter(s=>s.tier===0).length);
  const fixedN = info.fixed.length + info.placed.length;
  if(volume.mode==='exact'){
    const total = (volume.exact.basic|0) + (volume.exact.contracted|0);
    if(strictSlots + fixedN > total) add('xHardOverVolume', [strictSlots+fixedN, total]);
  }

  if(plan && pools.every(pl=>!Object.keys(pl.byCategory||{}).length)){
    const demand = layoutDemand(plan);
    for(const pl of pools){
      const members = activePeople().filter(p=>p.pool===pl.id);
      const seats = sum([...demand.values()], d=>d[pl.id]||0);
      const hi = sum(members, p=>Math.min((bounds.get(p.id)||{hi:Infinity}).hi, cap.get(p.id)==null ? Infinity : cap.get(p.id)));
      const lo = sum(members, p=>(bounds.get(p.id)||{lo:0}).lo);
      if(seats>hi) add('xPoolSeatsHigh', [poolName(pl), seats, hi]);
      if(seats<lo) add('xPoolSeatsLow', [poolName(pl), seats, lo]);
    }
  }

  for(const g of set.goals){
    if(!g.on || g.strict!=='must') continue;
    if(g.type==='atLeast' && (g.n||0)>0){
      const fac = goalFacilities(g);
      const distinct = g.repeat ? Infinity : fac.length;
      if(!fac.length || distinct<g.n) add('xAtLeastPool', [goalTitle(g), g.n, fac.length], {goal:g.id});
    }
    if(g.type==='person' && g.rel==='only' && liveIds(g.people).length && !goalFacilities(g).length) add('xOnlyEmpty', [goalTitle(g)], {goal:g.id});
    if(g.type==='atLeast'){
      for(const c of set.goals){
        if(c===g || !c.on || c.type!=='atMost' || c.strict!=='must') continue;
        const same = JSON.stringify(c.scope)===JSON.stringify(g.scope);
        if(same && c.n<g.n) add('xCapVsMin', [goalTitle(g), goalTitle(c)], {goal:g.id});
      }
    }
  }

  for(const r of set.pairs){
    if(!r.on || r.mode!=='rigid' || r.type!=='together' || !r.a || !r.b) continue;
    const A = personById(r.a), B = personById(r.b);
    if(!A || !B) continue;
    const ok = schedulableFacilities().some(f=>{
      const k = visitKindOf(f);
      if(A.pool===B.pool) return seatsFor(poolById(A.pool), k, f.category) >= 2;
      return seatsFor(poolById(A.pool), k, f.category) >= 1 && seatsFor(poolById(B.pool), k, f.category) >= 1;
    });
    if(!ok) add('xRigidSeats', [A.name, B.name], {people:[A.id, B.id]});
    const need = ((bounds.get(A.id)||{lo:0}).lo>0) || ((bounds.get(B.id)||{lo:0}).lo>0);
    if(need && !workDays.some(o=>personAvailable(A, o) && personAvailable(B, o))) add('xRigidDays', [A.name, B.name], {people:[A.id, B.id]});
  }

  if(volume.requireEveryEligibleDay){
    const eligible = win.days.filter(normalWorkday);
    if(volume.mode==='exact'){
      const total = (volume.exact.basic|0) + (volume.exact.contracted|0);
      if(total<eligible.length) add('xEveryDayVolume', [total, eligible.length]);
    }
    if(volume.perWeek){
      const byWk = new Map();
      for(const o of eligible) byWk.set(weekKey(o), (byWk.get(weekKey(o))||0)+1);
      for(const [wk, n] of byWk) if(n>volume.perWeek){ add('xEveryDayWeekCap', [n, volume.perWeek, isoOf(wk)]); break; }
    }
    for(const o of eligible) if(dayCap(o)<1){ add('xEveryDayCap', [isoOf(o)]); break; }
    for(const r of planDayRules()){
      if(!r.hard) continue;
      const ds = new Set(eligible);
      if(r.minRest>0 && eligible.some(o=>ds.has(o+1))) add('xEveryDayRest', [r.src, r.minRest]);
      if(r.maxRun){
        let run = 0, worst = 0;
        for(let o=win.start;o<=win.end;o++){ run = ds.has(o) ? run+1 : 0; worst = Math.max(worst, run); }
        if(worst>r.maxRun) add('xEveryDayRun', [r.src, r.maxRun, worst]);
      }
    }
    const av = win.days.map(poolAvailOn);
    const seatsFixed = pools.every(pl=>!Object.keys(pl.byCategory||{}).length);
    for(const o of eligible){
      const i = win.days.indexOf(o);
      const fits = ['basic','contracted'].some(k=>pools.every(pl=>(av[i][pl.id]||0) >= (pl.seats[k]||0)));
      if(seatsFixed && !fits){ add('xEveryDayStaff', [isoOf(o)]); break; }
    }
  }
  return {conflicts, bounds, cap};
}

function layoutGroupsHard(plan){
  const v = validatePlan(plan);
  let n = 0;
  for(const x of v.violations){
    if(x.cls!=='hard') continue;
    if(x.group==='cCalendar' || x.group==='cCaps' || x.group==='cSpacing' || x.group==='cGoals' || x.group==='cDays' || (x.group==='cDup' && x.key==='dFacDup')) n++;
  }
  return n;
}

function solveTeams(plan, budget, rnd, opts){
  opts = opts || {};
  const set = S();
  const fr = planFrame(plan);
  const ctx = makeCtx(fr.start);
  const vs = plan.visits.map(v=>({v, f:facilityById(v.facilityId), ord:ordOf(v.date)})).filter(x=>x.f).sort((a,b)=>a.ord-b.ord);
  const people = activePeople();
  const idxOf = new Map(people.map((p,i)=>[p.id, i]));
  const groups = [];
  const poolOf = new Map();
  for(const p of people) poolOf.set(p.id, p.pool);
  const state = vs.map(x=>({x, locked:uniqIds(lockedOf(x.v).filter(id=>personById(id))), groups:[], left:0}));
  for(const st of state){
    const {x} = st;
    const kind = visitKindOf(x.f);
    x.kind = kind;
    for(const id of st.locked){
      const p = personById(id);
      if(!p) continue;
      if((ctx.dayUsed.get(x.ord)||new Set()).has(id)) return null;
      ctxTally(ctx, id, x.ord, x.f, 1);
    }
    for(const pl of set.pools){
      const lockedHere = st.locked.filter(id=>{ const p = personById(id); return p && p.pool===pl.id; }).length;
      const seats = x.v.auto===false ? 0 : Math.max(0, seatsFor(pl, kind, x.f.category) - lockedHere);
      if(!seats) continue;
      const g = {st, pool:pl.id, seats, chosen:[], base:null};
      g.base = people.filter(p=>{
        if(p.pool!==pl.id) return false;
        if(!personAvailable(p, x.ord) || (p.blocked||[]).includes(x.f.id)) return false;
        const rb = set.repeatBlock;
        if(rb.on && ((ctx.fpv[x.f.id+'|'+p.id])||0) >= rb.times) return false;
        if(ctx.rules.denied(p.id, x.f)==='must') return false;
        return true;
      });
      groups.push(g); st.groups.push(g); st.left += seats;
    }
  }
  const pairBy = ctx.pairs;
  const importanceNeed = x=>{
    const sen = set.seniority;
    return sen.on && sen.mode==='require' && (x.f.importance||0) >= sen.threshold;
  };
  const qual = (x, p)=>skillOf(p, x.kind, x.f.category) >= (x.f.importance||0);
  const attainable = new Map();
  for(const st of state){
    if(!importanceNeed(st.x)) continue;
    const ok = people.some(p=>qual(st.x, p) && personAvailable(p, st.x.ord) && !(p.blocked||[]).includes(st.x.f.id));
    attainable.set(st, ok);
  }
  const dyn = (p, x)=>{
    const du = ctx.dayUsed.get(x.ord);
    if(du && du.has(p.id)) return false;
    if(p.maxPerWeek && (ctx.week[p.id+'|'+weekKey(x.ord)]||0) >= p.maxPerWeek) return false;
    const ds = ctx.dates[p.id];
    if(ds) for(const r of ctxRulesOf(ctx, p).hard) if(ruleBreaksOn(r, ds, x.ord)) return false;
    for(const r of ctx.rules.countsOf(p.id)) if(r.must && r.max!=null && inScopeOpt(x.f, r.scope) && (ctx.q[r.key]||0) >= r.max) return false;
    return true;
  };
  const teamOf = st=>[].concat(st.locked, ...st.groups.map(g=>g.chosen));
  const poolLeft = (st, pid)=>sum(st.groups.filter(g=>g.pool===pid), g=>g.seats-g.chosen.length);

  const candidatesOf = g=>{
    const st = g.st, x = st.x;
    const team = teamOf(st);
    const lastIdx = g.chosen.length ? idxOf.get(g.chosen[g.chosen.length-1]) : -1;
    const out = [];
    for(const p of g.base){
      if(g.chosen.length && idxOf.get(p.id)<=lastIdx) continue;
      if(team.includes(p.id) || !dyn(p, x)) continue;
      let unit = [p];
      const seen = new Set([p.id]);
      let bad = false;
      for(let i=0;i<unit.length && !bad;i++) for(const e of (pairBy.get(unit[i].id)||[])){
        if(e.mode!=='rigid' || e.type!=='together' || seen.has(e.other) || team.includes(e.other)) continue;
        const q = personById(e.other);
        if(!q){ continue; }
        seen.add(q.id); unit.push(q);
      }
      if(unit.length>1){
        const need = {};
        for(const m of unit){
          need[m.pool] = (need[m.pool]||0)+1;
          if(m!==p){ if(!dyn(m, x)) bad = true; const gb = st.groups.find(h=>h.pool===m.pool); if(!gb || !gb.base.includes(m)) bad = true; }
        }
        if(!bad) for(const pk in need) if(need[pk]>poolLeft(st, pk)) bad = true;
      }
      if(bad) continue;
      const mates = team.concat(unit.map(m=>m.id));
      for(const m of unit){ for(const o of mates) if(o!==m.id && rigidAvoids(ctx, m.id, o)){ bad = true; break; } if(bad) break; }
      if(bad) continue;
      out.push({p, unit});
    }
    return out;
  };

  const deficits = ()=>{
    const out = [];
    for(const r of ctx.rules.list){
      if(!r.must || r.min==null || r.src==='together') continue;
      const q = ctx.q[r.key]||0;
      if(q<r.min) out.push({r, need:r.min-q});
    }
    return out;
  };
  const opportunities = (r)=>{
    const p = personById(r.pid);
    if(!p) return 0;
    const dates = new Set();
    for(const g of groups){
      if(g.chosen.length>=g.seats || g.pool!==p.pool) continue;
      const x = g.st.x;
      if(!inScopeOpt(x.f, r.scope) || !g.base.includes(p)) continue;
      const du = ctx.dayUsed.get(x.ord);
      if(du && du.has(p.id)) continue;
      dates.add(x.ord);
    }
    return dates.size;
  };

  let aborted = false;
  const visitDone = st=>st.groups.every(g=>g.chosen.length>=g.seats);
  const visitOk = st=>{
    const x = st.x;
    if(importanceNeed(x) && attainable.get(st)){
      const ids = teamOf(st);
      if(ids.length && !ids.some(id=>qual(x, personById(id)))) return false;
    }
    if(pairBreaks(teamOf(st))>0) return false;
    return true;
  };
  const assign = (g, c)=>{
    const st = g.st, x = st.x;
    const mark = ctxBegin(ctx);
    const placed = [];
    ctxPairTally(ctx, teamOf(st), x.f, -1);
    for(const m of c.unit){
      const gg = st.groups.find(h=>h.pool===m.pool && h.chosen.length<h.seats);
      gg.chosen.push(m.id);
      ctxTally(ctx, m.id, x.ord, x.f, 1);
      placed.push([gg, m.id]);
    }
    ctxPairTally(ctx, teamOf(st), x.f, 1);
    return {mark, placed};
  };
  const undo = (g, rec)=>{
    for(let i=rec.placed.length-1;i>=0;i--) rec.placed[i][0].chosen.pop();
    ctxRollback(ctx, rec.mark);
  };

  const dfs = ()=>{
    if(aborted) return false;
    budget.nodes++;
    if(budget.nodes>budget.maxNodes || (budget.nodes & 63)===0 && Date.now()>budget.deadline){ aborted = true; return false; }
    let pick = null, pickC = null;
    for(const g of groups){
      if(g.chosen.length>=g.seats) continue;
      const c = candidatesOf(g);
      if(!c.length) return false;
      if(!pick || c.length<pickC.length || (c.length===pickC.length && g.st.x.ord<pick.st.x.ord)){ pick = g; pickC = c; }
    }
    for(const d of deficits()) if(opportunities(d.r) < d.need) return false;
    if(!pick){
      if(violationScore(ctx).hard>0) return false;
      return true;
    }
    const defs = deficits();
    const load = id=>(ctx.assigned[id]||0);
    const urgency = c=>{
      let u = 0;
      for(const d of defs) if(d.r.pid===c.p.id && inScopeOpt(pick.st.x.f, d.r.scope)) u = Math.max(u, d.need/Math.max(1, opportunities(d.r)));
      return u;
    };
    const scored = pickC.map(c=>({c, k:[-urgency(c), (load(c.p.id)+0.5)/(c.p.share==null||c.p.share<=0 ? 1 : c.p.share)+rnd()*opts.noise]}));
    scored.sort((a,b)=>a.k[0]-b.k[0] || a.k[1]-b.k[1]);
    for(const e of scored){
      const rec = assign(pick, e.c);
      let ok = true;
      if(visitDone(pick.st) && !visitOk(pick.st)) ok = false;
      if(ok && dfs()){ ctxCommit(ctx); return true; }
      undo(pick, rec);
      if(aborted) return false;
    }
    return false;
  };
  const noiseOpt = opts.noise==null ? 0 : opts.noise;
  opts.noise = noiseOpt;
  for(const st of state) if(importanceNeed(st.x) && attainable.get(st)===false) attainable.set(st, false);
  const ok = dfs();
  if(!ok) return aborted ? {aborted:true} : null;
  const out = clonePlan(plan);
  for(const st of state){
    const tv = out.visits.find(v=>v.id===st.x.v.id);
    const team = {};
    for(const pl of set.pools) team[pl.id] = [];
    for(const id of st.locked){ const p = personById(id); team[p.pool].push(id); }
    for(const g of st.groups) for(const id of g.chosen) team[g.pool].push(id);
    tv.team = team;
    tv.open = {};
  }
  return {plan:out};
}

function polishSoft(plan){
  const ctx = makeCtx(planFrame(plan).start);
  const vis = plan.visits.filter(v=>facilityById(v.facilityId)).sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0));
  for(const v of vis){
    const f = facilityById(v.facilityId), ord = ordOf(v.date);
    const ids = uniqIds(visitTeamIds(v));
    for(const id of ids) ctxTally(ctx, id, ord, f, 1);
    ctxPairTally(ctx, ids, f, 1);
  }
  repairGender(vis, null, ctx);
  repairPeopleRules(vis, ctx);
  return plan;
}

function layoutMoves(plan, rnd){
  const days = plan.days;
  const moves = [];
  const vs = plan.visits;
  for(const v of vs){
    if(v.fixed) continue;
    for(const d of days){
      if(d===v.date) continue;
      moves.push({kind:'move', id:v.id, date:d});
    }
  }
  for(let i=0;i<vs.length;i++) for(let j=i+1;j<vs.length;j++){
    if(vs[i].date===vs[j].date || vs[i].fixed || vs[j].fixed) continue;
    moves.push({kind:'swap', a:vs[i].id, b:vs[j].id});
  }
  const inPlan = new Set(vs.map(v=>v.facilityId));
  for(const v of vs){
    if(v.fixed || v.special) continue;
    const kind = v.kind;
    const alts = schedulableFacilities().filter(f=>visitKindOf(f)===kind && !inPlan.has(f.id));
    for(const f of alts) moves.push({kind:'replace', id:v.id, facilityId:f.id});
  }
  for(let i=moves.length-1;i>0;i--){ const j = Math.floor(rnd()*(i+1)); const t = moves[i]; moves[i] = moves[j]; moves[j] = t; }
  return moves;
}
function applyLayoutMove(plan, m){
  const out = clonePlan(plan);
  if(m.kind==='move'){ out.visits.find(v=>v.id===m.id).date = m.date; }
  else if(m.kind==='swap'){
    const a = out.visits.find(v=>v.id===m.a), b = out.visits.find(v=>v.id===m.b);
    const t = a.date; a.date = b.date; b.date = t;
  } else if(m.kind==='replace'){
    const v = out.visits.find(v=>v.id===m.id);
    v.facilityId = m.facilityId;
    const f = facilityById(m.facilityId);
    v.kind = visitKindOf(f);
  }
  return out;
}

function searchPlan(plan, info, opts){
  opts = opts || {};
  const b = opts.budget || {};
  const t0 = Date.now();
  const budget = {nodes:0, maxNodes:b.nodes || 120000, deadline:t0 + (b.ms || 1500)};
  const rnd = mulberry32(opts.seed || 20260101);
  const stats = {attempts:0, nodes:0, ms:0, exhausted:false, layoutMoves:0, restarts:0};
  const rules = compilePeopleRules();
  const bounds = personBounds(rules);
  const finish = (p)=>{ stats.nodes = budget.nodes; stats.ms = Date.now()-t0; return {plan:p, info:stats}; };

  const tryTeams = (p, nodeCap, noise)=>{
    const sub = {nodes:0, maxNodes:Math.min(nodeCap, budget.maxNodes-budget.nodes), deadline:budget.deadline};
    const before = budget.nodes;
    stats.attempts++;
    const r = solveTeams(p, sub, rnd, {noise});
    budget.nodes += sub.nodes - 0;
    if(r && r.plan){ polishSoft(r.plan); return r.plan; }
    return null;
  };
  const alive = ()=>budget.nodes<budget.maxNodes && Date.now()<budget.deadline;

  let best = plan;
  let bestVal = validatePlan(plan);
  let r = tryTeams(plan, 6000, 0);
  if(r){ const v = validatePlan(r); if(v.hard<bestVal.hard || (v.hard===bestVal.hard && v.soft<bestVal.soft)){ best = r; bestVal = v; } if(v.hard===0) return finish(best); }

  let cur = best;
  const defOf = p=>flowDeficit(p, bounds) + scopedDeficit(p, rules);
  let curDef = defOf(cur);
  const seen = new Set();
  const sigOfPlan = p=>p.visits.map(v=>v.date+':'+v.facilityId).sort().join('|');
  seen.add(sigOfPlan(cur));
  let stale = 0;
  while(alive()){
    const moves = layoutMoves(cur, rnd);
    let chosen = null, chosenDef = Infinity, tested = 0;
    const baseLayout = layoutGroupsHard(cur);
    for(const m of moves){
      if(!alive()) break;
      const cand = applyLayoutMove(cur, m);
      const sg = sigOfPlan(cand);
      if(seen.has(sg)) continue;
      const d = defOf(cand);
      if(d>chosenDef) continue;
      if(d===chosenDef && rnd()<0.5) continue;
      if(layoutGroupsHard(cand)>baseLayout) continue;
      chosen = cand; chosenDef = d; tested++;
      if(d===0 && curDef>0) break;
      if(tested>40) break;
    }
    stats.layoutMoves++;
    if(!chosen){ stats.restarts++; if(++stale>3) break; cur = best; continue; }
    seen.add(sigOfPlan(chosen));
    cur = chosen; curDef = chosenDef;
    if(curDef<=Math.max(0, defOf(best))){
      const rr = tryTeams(cur, curDef===0 ? 8000 : 800, curDef===0 ? 0.5 : 0);
      if(rr){
        const v = validatePlan(rr);
        if(v.hard<bestVal.hard || (v.hard===bestVal.hard && v.soft<bestVal.soft)){ best = rr; bestVal = v; }
        if(v.hard===0) return finish(best);
      }
    }
  }
  stats.exhausted = !alive();
  return finish(best);
}
