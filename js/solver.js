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

function flowDeficit(plan, bounds, caps, availFn){
  const canWork = availFn || personAvailable;
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
        dayList.forEach((o, j)=>{ if(canWork(p, o)) edges.push([1+i, 1+m+j, 1]); });
      });
      dayList.forEach((o, j)=>edges.push([1+m+j, t, layout.get(o)[pl.id]]));
      const f = maxFlow(m+D+2, edges, s, t);
      if(mode==='lo') total += Math.max(0, sum(members, p=>Math.min((bounds.get(p.id)||{lo:0}).lo, D)) - f);
      else total += Math.max(0, demand - f);
    }
  }
  return total;
}

function effectiveAvailability(){
  const partners = new Map();
  for(const r of S().pairs){
    if(!r.on || !pairRigid(r) || r.type!=='together' || !r.a || !r.b) continue;
    if(!personById(r.a) || !personById(r.b)) continue;
    if(!partners.has(r.a)) partners.set(r.a, []);
    if(!partners.has(r.b)) partners.set(r.b, []);
    partners.get(r.a).push(r.b);
    partners.get(r.b).push(r.a);
  }
  return (p, o)=>{
    if(!personAvailable(p, o)) return false;
    const list = partners.get(p.id);
    if(!list) return true;
    for(const id of list){
      const q = personById(id);
      if(!q || q.active===false || q.retired || !personAvailable(q, o)) return false;
    }
    return true;
  };
}

function genderDeficit(plan, availFn){
  let total = 0;
  const people = activePeople();
  for(const v of plan.visits){
    if(v.auto===false) continue;
    const f = facilityById(v.facilityId);
    if(!f) continue;
    const kind = visitKindOf(f);
    const rule = genderRuleFor(f, kind);
    if(!rule) continue;
    const o = ordOf(v.date);
    const n = teamSizeFor(kind, f.category);
    let lo = 0, hi = 0, staffed = true;
    for(const pl of S().pools){
      const seats = seatsFor(pl, kind, f.category);
      if(!seats) continue;
      let m = 0, w = 0, u = 0;
      for(const p of people){
        if(p.pool!==pl.id || !availFn(p, o) || (p.blocked||[]).includes(f.id)) continue;
        if(p.gender==='m') m++; else if(p.gender==='f') w++; else u++;
      }
      if(m+w+u<seats){ staffed = false; break; }
      lo += Math.max(0, seats-w-u);
      hi += Math.min(seats, m+u);
    }
    if(!staffed) continue;
    let can = false;
    for(let m=lo;m<=hi && !can;m++) can = genderValid(rule, m, n-m, n);
    if(!can) total++;
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
  const warnings = [];
  const add = (key, args, extra)=>conflicts.push(Object.assign({key, args:args||[], sev:'error'}, extra||{}));
  const warn = (key, args, extra)=>warnings.push(Object.assign({key, args:args||[], sev:'warn'}, extra||{}));
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

  const eligibleDays = win.days.filter(normalWorkday);
  const cands = schedulableFacilities();
    if(volume.mode==='exact'){
    const exact = {basic:volume.exact.basic|0, contracted:volume.exact.contracted|0};
    const capBy = {basic:0, contracted:0};
    for(const o of eligibleDays){
      const dr = normalizeDay(set.days[wdOf(o)]);
      const k = dr.kind && dr.kind.lv.level==='must' && dr.kind.howMany==='all' ? dr.kind.kind : null;
      for(const kind of ['basic', 'contracted']) if(!k || k===kind) capBy[kind] += dayCap(o);
    }
    for(const kind of ['basic', 'contracted']){
      if(exact[kind]>capBy[kind]) add('xDayKindCapacity', [kindLabel(kind), exact[kind], capBy[kind]], {rules:['day.kind', 'vol.exact']});
      if(exact[kind]>cands.filter(f=>visitKindOf(f)===kind).length) add('xExactOverFacilities', [kindLabel(kind), exact[kind], cands.filter(f=>visitKindOf(f)===kind).length], {rules:['vol.exact']});
    }
  }
  for(const o of eligibleDays){
    const dr = normalizeDay(set.days[wdOf(o)]);
    const checks = [['kind', 'day.kind', f=>visitKindOf(f)===(dr.kind && dr.kind.kind)], ['band', 'day.band', f=>distBand(facilityKm(f))===(dr.band && dr.band.band)], ['category', 'day.category', f=>dr.category && dr.category.ids.includes(f.category)]];
    for(const [field, rule, ok] of checks){
      const e = dr[field];
      if(!e || e.lv.level!=='must' || e.howMany!=='one') continue;
      const exactZero = field==='kind' && volume.mode==='exact' && (volume.exact[e.kind]|0)===0;
      if(exactZero || !cands.some(ok)) add('xDayRuleNone', [wdName(wdOf(o)), t(rule)], {rules:exactZero ? [rule, 'vol.exact'] : [rule]});
    }
  }
  if(plan && pools.every(pl=>!Object.keys(pl.byCategory||{}).length)){
    const exactProof = volume.mode==='exact' && !plan.visits.some(v=>v.auto===false);
    const layout = layoutDemand(plan);
    for(const pl of pools){
      const members = activePeople().filter(p=>p.pool===pl.id);
      const layoutSeats = sum([...layout.values()], d=>d[pl.id]||0);
      const exactSeats = (volume.exact.basic|0)*seatsFor(pl, 'basic') + (volume.exact.contracted|0)*seatsFor(pl, 'contracted');
      const hi = sum(members, p=>Math.min((bounds.get(p.id)||{hi:Infinity}).hi, cap.get(p.id)==null ? Infinity : cap.get(p.id)));
      const lo = sum(members, p=>(bounds.get(p.id)||{lo:0}).lo);
      if(exactProof ? exactSeats>hi : (hi===0 && layoutSeats>0)) add('xPoolSeatsHigh', [poolName(pl), exactProof ? exactSeats : layoutSeats, hi]);
      else if(layoutSeats>hi) warn('xPoolSeatsHigh', [poolName(pl), layoutSeats, hi]);
      if(exactProof && exactSeats<lo) add('xPoolSeatsLow', [poolName(pl), exactSeats, lo]);
      else if(layoutSeats<lo) warn('xPoolSeatsLow', [poolName(pl), layoutSeats, lo]);
    }
  }

  for(const g of set.goals){
    if(!g.on || !goalMust(g)) continue;
    if(g.type==='atLeast' && (g.n||0)>0){
      const fac = goalFacilities(g);
      const distinct = g.repeat ? Infinity : fac.length;
      if(!fac.length || distinct<g.n) add('xAtLeastPool', [goalTitle(g), g.n, fac.length], {goal:g.id});
    }
    if(g.type==='person' && g.rel==='only' && liveIds(g.people).length && !goalFacilities(g).length) add('xOnlyEmpty', [goalTitle(g)], {goal:g.id});
    if(g.type==='atLeast'){
      for(const c of set.goals){
        if(c===g || !c.on || c.type!=='atMost' || !goalMust(c)) continue;
        const same = JSON.stringify(c.scope)===JSON.stringify(g.scope);
        if(same && c.n<g.n) add('xCapVsMin', [goalTitle(g), goalTitle(c)], {goal:g.id});
      }
    }
  }

  for(const r of set.pairs){
    if(!r.on || !pairRigid(r) || r.type!=='together' || !r.a || !r.b) continue;
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
  return {conflicts, warnings, bounds, cap};
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
  const noise = opts.noise==null ? 0 : opts.noise;
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
        if(rotateMustActive() && ((ctx.fpv[x.f.id+'|'+p.id])||0) >= rb.times) return false;
        if(ctx.rules.denied(p.id, x.f)==='must') return false;
        return true;
      });
      groups.push(g); st.groups.push(g); st.left += seats;
    }
  }
  const pairBy = ctx.pairs;
  const importanceNeed = x=>{
    const sen = set.seniority;
    return sen.on && seniorRequired() && (x.f.importance||0) >= sen.threshold;
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
  const groupsAt = new Map();
  for(const g of groups){
    const o = g.st.x.ord;
    if(!groupsAt.has(o)) groupsAt.set(o, []);
    groupsAt.get(o).push(g);
  }
  const spanOf = new Map();
  for(const p of people){
    let sp = 0;
    for(const r of personPatternRules(p).hard) sp = Math.max(sp, r.minRest||0, r.maxRun ? 1 : 0);
    spanOf.set(p.id, sp);
  }
  const futureCost = (p, ord, except)=>{
    let c = 0;
    const span = spanOf.get(p.id)||0;
    for(let k=-span;k<=span;k++){
      const gs = groupsAt.get(ord+k);
      if(!gs) continue;
      for(const g of gs) if(g!==except && g.chosen.length<g.seats && g.base.includes(p)) c++;
    }
    return c;
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
    const px = pick.st.x;
    const rule = genderRuleFor(px.f, px.kind);
    const nSize = teamSizeFor(px.kind, px.f.category);
    const nowG = rule ? teamGender(teamOf(pick.st)) : null;
    const remainingTotal = rule ? sum(pick.st.groups, g=>g.seats-g.chosen.length) : 0;
    const genderPen = c=>{
      if(!rule) return 0;
      let m = nowG.m, w = nowG.f, u = nowG.u;
      for(const q of c.unit){ if(!q.gender) u++; else if(q.gender==='m') m++; else w++; }
      return genderFeasible(rule, m, w, u, remainingTotal-c.unit.length, nSize) ? 0 : 1;
    };
    const scored = pickC.map(c=>({c, k:[-urgency(c), genderPen(c), futureCost(c.p, px.ord, pick), (load(c.p.id)+0.5)/(c.p.share==null||c.p.share<=0 ? 1 : c.p.share)+rnd()*noise]}));
    scored.sort((a,b)=>{ for(let i=0;i<a.k.length;i++) if(a.k[i]!==b.k[i]) return a.k[i]-b.k[i]; return 0; });
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

function layoutHot(plan){
  const v = validatePlan(plan);
  const hot = new Set();
  let layoutHard = 0;
  for(const x of v.violations){
    if(x.cls!=='hard') continue;
    for(const id of (x.visits||[])) hot.add(id);
    if(x.group==='cCalendar' || x.group==='cCaps' || x.group==='cSpacing' || x.group==='cGoals' || x.group==='cDays' || (x.group==='cDup' && x.key==='dFacDup')) layoutHard++;
  }
  return {hot, layoutHard, hard:v.hard, soft:v.soft};
}

function sampleLayoutMoves(plan, rnd, hot, k){
  const vs = plan.visits.filter(v=>!v.fixed);
  if(!vs.length || !plan.days.length) return [];
  const hotVs = vs.filter(v=>hot.has(v.id));
  const inPlan = new Set(plan.visits.map(v=>v.facilityId));
  const altsByKind = {};
  const alts = kind=>{
    if(!altsByKind[kind]) altsByKind[kind] = schedulableFacilities().filter(f=>visitKindOf(f)===kind && !inPlan.has(f.id));
    return altsByKind[kind];
  };
  const out = [];
  const seen = new Set();
  let guard = 0;
  while(out.length<k && guard++<k*8){
    const v = hotVs.length && rnd()<0.6 ? hotVs[Math.floor(rnd()*hotVs.length)] : vs[Math.floor(rnd()*vs.length)];
    const r = rnd();
    let m = null;
    if(r<0.45){
      const d = plan.days[Math.floor(rnd()*plan.days.length)];
      if(d!==v.date) m = {kind:'move', id:v.id, date:d};
    } else if(r<0.8){
      const w = vs[Math.floor(rnd()*vs.length)];
      if(w!==v && w.date!==v.date) m = {kind:'swap', a:v.id, b:w.id};
    } else if(!v.special){
      const list = alts(v.kind);
      if(list.length) m = {kind:'replace', id:v.id, facilityId:list[Math.floor(rnd()*list.length)].id};
    }
    if(!m) continue;
    const key = JSON.stringify(m);
    if(seen.has(key)) continue;
    seen.add(key);
    out.push(m);
  }
  return out;
}

function perturbLayout(plan, rnd, hot, steps){
  let cur = plan;
  for(let i=0;i<steps;i++){
    const m = sampleLayoutMoves(cur, rnd, hot, 1)[0];
    if(m) cur = applyLayoutMove(cur, m);
  }
  return cur;
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
  const maxEvals = b.evals || 4000;
  const rnd = mulberry32(opts.seed || 20260101);
  const stats = {attempts:0, nodes:0, ms:0, exhausted:false, layoutMoves:0, restarts:0, evals:0, stage:'search'};
  const rules = compilePeopleRules();
  const bounds = personBounds(rules);
  const avail = effectiveAvailability();
  const finish = p=>{ stats.nodes = budget.nodes; stats.ms = Date.now()-t0; return {plan:p, info:stats}; };

  const tryTeams = (p, nodeCap, noise)=>{
    const sub = {nodes:0, maxNodes:Math.min(nodeCap, budget.maxNodes-budget.nodes), deadline:budget.deadline};
    stats.attempts++;
    const r = solveTeams(p, sub, rnd, {noise});
    budget.nodes += sub.nodes;
    if(r && r.plan){ polishSoft(r.plan); return r.plan; }
    return null;
  };
  const maxLoops = b.loops || 1500;
  const alive = ()=>budget.nodes<budget.maxNodes && Date.now()<budget.deadline && stats.evals<maxEvals && stats.layoutMoves<maxLoops;
  const better = (v, w)=>v.hard<w.hard || (v.hard===w.hard && v.soft<w.soft);

  let best = plan;
  let bestVal = validatePlan(plan);
  const adopt = rr=>{
    if(!rr) return false;
    const v = validatePlan(rr);
    if(better(v, bestVal)){ best = rr; bestVal = v; return true; }
    return false;
  };
  adopt(tryTeams(plan, 6000, 0));
  if(bestVal.hard===0) return finish(best);

  const defOf = p=>flowDeficit(p, bounds, null, avail) + scopedDeficit(p, rules);
  const sigOfPlan = p=>p.visits.map(v=>v.date+':'+v.facilityId).sort().join('|');
  let cur = best;
  let curDef = defOf(cur);
  let bestLayoutDef = curDef;
  const seen = new Set([sigOfPlan(cur)]);
  let stagnation = 0;
  let kick = 2;
  const maxKick = Math.max(3, Math.ceil(plan.visits.length/3));
  let info0 = layoutHot(cur);

  while(alive()){
    const moves = sampleLayoutMoves(cur, rnd, info0.hot, 48);
    let chosen = null, chosenDef = Infinity, chosenSoft = Infinity;
    for(const m of moves){
      if(!alive()) break;
      const cand = applyLayoutMove(cur, m);
      const sg = sigOfPlan(cand);
      if(seen.has(sg)) continue;
      const d = defOf(cand);
      if(d>chosenDef) continue;
      stats.evals++;
      if(layoutGroupsHard(cand)>info0.layoutHard) continue;
      const sf = genderDeficit(cand, avail);
      if(d===chosenDef && (sf>chosenSoft || (sf===chosenSoft && rnd()<0.5))) continue;
      chosen = cand; chosenDef = d; chosenSoft = sf;
      if(d===0 && curDef>0) break;
    }
    stats.layoutMoves++;
    let improved = false;
    if(!chosen){
      stagnation++;
    } else {
      seen.add(sigOfPlan(chosen));
      cur = chosen; curDef = chosenDef;
      if(curDef<=bestLayoutDef){
        if(curDef<bestLayoutDef){ bestLayoutDef = curDef; improved = true; }
        const rr = tryTeams(cur, curDef===0 ? 8000 : 800, curDef===0 ? 0.5 : 0);
        if(adopt(rr)){ improved = true; if(bestVal.hard===0) return finish(best); }
      }
      if(!improved) stagnation++;
    }
    if(improved){ stagnation = 0; kick = 2; }
    if(stagnation>=8){
      stats.restarts++;
      cur = perturbLayout(best, rnd, info0.hot, kick);
      kick = Math.min(maxKick, kick+1);
      curDef = defOf(cur);
      seen.add(sigOfPlan(cur));
      stagnation = 0;
    }
    info0 = layoutHot(cur);
  }
  stats.exhausted = !alive();
  return finish(best);
}
