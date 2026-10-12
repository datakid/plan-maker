function planWindow(){
  const prev = volumePreview();
  if(prev.goal==='coverage' && !prev.reachable) return {error:'coverageUnreachable', prev};
  if(prev.invalid) return {error:'rangeInvalid', prev};
  const start = prev.start, end = prev.end;
  const days = listWorkdays(start, end);
  const work = days.filter(normalWorkday);
  return {start, end, days, work, prev};
}

function visitKindOf(f){ const k = facilityKind(f); return k==='contracted' ? 'contracted' : 'basic'; }

function fixedVisitsFor(win){
  return overridesIn(win.start, win.end).map(o=>{
    const f = facilityById(o.facilityId);
    const people = o.people.filter(id=>{ const p = personById(id); return p && !p.retired; });
    return {o, f, kind:visitKindOf(f), ord:ordOf(o.date), people, auto: o.fill || !people.length};
  });
}

function capHit(caps, f){ return caps.find(c=>c.must && c.left<=0 && inScope(f, c.scope)); }
function capSoft(caps, f){ return caps.some(c=>!c.must && c.left<=0 && inScope(f, c.scope)); }
function capTake(caps, f){ for(const c of caps) if(inScope(f, c.scope)) c.left--; }

function selectUnits(win, fixed, demand, placed){
  const P = S().period, V = S().volume, prev = win.prev;
  placed = placed || [];
  const diags = [];
  const units = [];
  const caps = demand.caps.map(c=>Object.assign({}, c));
  const ranked = {};
  for(const k of ['basic','contracted']){
    ranked[k] = rankFacilities(schedulableFacilities().filter(f=>facilityKind(f)===k), win.start);
    ranked[k].forEach((x,i)=>{ x.rank = i+1; });
  }
  const rankOf = new Map();
  for(const k in ranked) for(const x of ranked[k]) rankOf.set(x.f.id, x);
  const picked = new Map();
  const pick = (f, slot, tier, goals)=>{
    const r = rankOf.get(f.id) || Object.assign({f, rank:'—'}, facilityScore(f, win.start));
    units.push({f, kind:visitKindOf(f), tier, deadline:slot ? slot.hardDl : null, softDl:slot ? slot.softDl : null, earliest:slot ? slot.earliest : null, strict:!!(slot && slot.strict),
      chain:!!(slot && slot.chain), first:!!(slot && slot.first), early:!!(slot && slot.early), goals:goals?[...goals]:[], overdue:r.overdue, score:r.score, rank:r.rank, copy:picked.get(f.id)||0});
    picked.set(f.id, (picked.get(f.id)||0)+1);
    capTake(caps, f);
  };
  const fixedNormal = fixed.filter(x=>normalWorkday(x.ord)).length + placed.length;
  const share = prev.total ? prev.basic/prev.total : (prev.goal==='coverage' ? 0.5 : V.share);
  const room = Math.max(0, capacityOver(win.work, share) - fixedNormal);
  let dropped = 0;
  const flat = [];
  for(const it of demand.items.values()) for(const slot of it.slots) flat.push({it, slot});
  const dl = e=>e.slot.hardDl!=null ? e.slot.hardDl : e.slot.softDl;
  const scoreOf = e=>(rankOf.get(e.it.f.id)||{score:0}).score;
  flat.sort((a,b)=>a.slot.tier-b.slot.tier || ((dl(a)==null)-(dl(b)==null)) || ((dl(a)||0)-(dl(b)||0)) || scoreOf(b)-scoreOf(a));
  for(const e of flat){
    if(units.length>=room){ dropped++; continue; }
    if(capHit(caps, e.it.f)){ if(e.slot.tier===0) diags.push({sev:'warn', key:'dCapBlocked', args:[e.it.f.name]}); continue; }
    pick(e.it.f, e.slot, e.slot.tier, e.slot.goals);
  }
  if(dropped) diags.push({sev:'warn', key:'dGoalOverCap', args:[dropped, room]});
  if(P.goal!=='coverage'){
    const fixedOfKind = k=>fixed.filter(x=>x.kind===k && normalWorkday(x.ord)).length + placed.filter(s=>s.kind===k).length;
    const selOfKind = k=>units.filter(u=>u.kind===k).length;
    const preferred = demand.preferred;
    const blocked = new Set();
    for(const g of S().goals){
      if(!g.on || g.type!=='cover' || g.strict!=='must') continue;
      const rep = demand.report[g.id];
      const since = rep ? rep.since : g.since;
      for(const f of goalFacilities(g)) if(baselineVisits(f, since, win.start, null) >= Math.max(1, g.times||1)) blocked.add(f.id);
    }
    const fixedIds = new Set(demand.preCount.keys());
    const order = list=>{
      const a = list.filter(x=>preferred.has(x.f.id)), b = list.filter(x=>!preferred.has(x.f.id) && !blocked.has(x.f.id)), c = list.filter(x=>!preferred.has(x.f.id) && blocked.has(x.f.id));
      return a.concat(b, c);
    };
    const fillFrom = (list, n)=>{
      let got = 0;
      const cand = order(list).filter(x=>!picked.has(x.f.id) && !fixedIds.has(x.f.id) && !capHit(caps, x.f));
      const calm = cand.filter(x=>!capSoft(caps, x.f)), hot = cand.filter(x=>capSoft(caps, x.f));
      for(const x of calm.concat(hot)){
        if(got>=n) break;
        if(capHit(caps, x.f)) continue;
        pick(x.f, null, preferred.has(x.f.id) ? 2 : 3, preferred.get(x.f.id));
        got++;
      }
      return got;
    };
    if(V.mode==='quota'){
      for(const cat of Object.keys(V.quotas||{})){
        const q = Math.max(0, V.quotas[cat]|0); if(!q) continue;
        const kind = categoryKind(cat);
        if(kind!=='basic' && kind!=='contracted') continue;
        const have = units.filter(u=>u.f.category===cat).length + fixed.filter(x=>x.f.category===cat).length + placed.filter(s=>s.f.category===cat).length;
        const src = ranked[kind].filter(x=>x.f.category===cat);
        const got = fillFrom(src, q-have);
        if(have+got<q) diags.push({sev:'warn', key:'dQuotaShort', args:[cat, q, have+got]});
      }
    } else {
      const wantB = Math.max(0, prev.basic - fixedOfKind('basic') - selOfKind('basic'));
      const wantC = Math.max(0, prev.contracted - fixedOfKind('contracted') - selOfKind('contracted'));
      const free = Math.max(0, room - units.length);
      let wB = wantB, wC = wantC;
      if(wB+wC>free){ const sh = prev.total ? prev.basic/prev.total : V.share; wB = Math.min(wB, Math.round(free*sh)); wC = Math.min(wC, free-wB); wB = Math.min(wantB, free-wC); }
      const gotB = fillFrom(ranked.basic, wB), gotC = fillFrom(ranked.contracted, wC);
      if(V.mode==='exact'){
        if(gotB<wantB) diags.push({sev:'warn', key:'dShortBasic', args:[prev.basic, prev.basic-wantB+gotB]});
        if(gotC<wantC) diags.push({sev:'warn', key:'dShortContracted', args:[prev.contracted, prev.contracted-wantC+gotC]});
      }
    }
  }
  const carry = [...ranked.basic, ...ranked.contracted].filter(x=>!picked.has(x.f.id) && !demand.preCount.has(x.f.id)).sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.f.id);
  return {units, diags, carry, ranked, rankOf, picked, caps, room};
}

function lastIdxBy(days, dl){ let k = -1; for(let i=0;i<days.length;i++) if(days[i]<=dl) k = i; return k; }
function firstIdxFrom(days, lo){ for(let i=0;i<days.length;i++) if(days[i]>=lo) return i; return days.length; }

function generatePlan(opts){
  opts = opts || {};
  const set = S(), V = set.volume, sp = set.spacing;
  const win = planWindow();
  if(win.error) return {error:win.error};
  const days = win.days;
  if(!days.length) return {error:'noWorkdays'};
  const N = days.length;
  const dayIdx = new Map(days.map((o,i)=>[o,i]));
  const fixed = fixedVisitsFor(win).filter(x=>dayIdx.has(x.ord));
  const diags = [];
  const ctx = makeCtx(win.start);
  const load = new Array(N).fill(0);
  const avail = days.map(poolAvailOn);
  const seatUse = days.map(()=>({}));
  const weekLoad = new Map();
  const facilityDays = new Map();
  const perWeek = V.perWeek;
  const dayRules = planDayRules();
  const hardRules = dayRules.filter(r=>r.hard), softRules = dayRules.filter(r=>!r.hard);
  const occ = {has:o=>{ const i = dayIdx.get(o); return i!==undefined && load[i]>0; }};
  const occupy = (d, f, kind, seatsByPool)=>{
    load[d]++;
    for(const pl of set.pools) seatUse[d][pl.id] = (seatUse[d][pl.id]||0) + (seatsByPool ? (seatsByPool[pl.id]||0) : seatsFor(pl, kind, f.category));
    const wk = weekKey(days[d]); weekLoad.set(wk, (weekLoad.get(wk)||0)+1);
    if(!facilityDays.has(f.id)) facilityDays.set(f.id, []);
    facilityDays.get(f.id).push(d);
  };
  const unoccupy = (d, f, kind, seatsByPool)=>{
    load[d]--;
    for(const pl of set.pools) seatUse[d][pl.id] -= (seatsByPool ? (seatsByPool[pl.id]||0) : seatsFor(pl, kind, f.category));
    const wk = weekKey(days[d]); weekLoad.set(wk, (weekLoad.get(wk)||1)-1);
    const list = facilityDays.get(f.id); const i = list.indexOf(d); if(i>=0) list.splice(i, 1);
  };
  const visits = [];
  for(const fx of fixed){
    const d = dayIdx.get(fx.ord);
    const byPool = {};
    for(const id of fx.people){ const p = personById(id); if(p) byPool[p.pool] = (byPool[p.pool]||0)+1; }
    if(fx.auto) for(const pl of set.pools) byPool[pl.id] = Math.max(byPool[pl.id]||0, seatsFor(pl, fx.kind, fx.f.category));
    occupy(d, fx.f, fx.kind, byPool);
    for(const id of fx.people){
      if((ctx.dayUsed.get(fx.ord)||new Set()).has(id)) diags.push({sev:'warn', key:'dFixedTwice', args:[(personById(id)||{}).name||'?', fx.o.date]});
      ctxTally(ctx, id, fx.ord, fx.f, 1);
    }
    visits.push({id:uid('v'), d, date:fx.o.date, facilityId:fx.f.id, kind:fx.kind, team:{}, open:{}, fixed:true, overrideId:fx.o.id, preset:fx.people, auto:fx.auto, window:{from:fx.o.date, to:fx.o.date}, why:Object.assign({fixed:true}, facilityScore(fx.f, win.start))});
  }

  const dayRulesOk = (d)=>{
    for(const r of hardRules) if(ruleBreaksOn({minRest:r.minRest, maxRun:r.maxRun, from:null, to:null}, occ, days[d])) return false;
    return true;
  };
  const dayRulesPenalty = (d)=>{
    let m = 1;
    for(const r of softRules) if(ruleBreaksOn({minRest:r.minRest, maxRun:r.maxRun, from:null, to:null}, occ, days[d])) m *= 0.25;
    return m*activitySoftDayPenalty(days[d]);
  };

  const specialsReq = specialRequests(win);
  diags.push(...specialsReq.diags);
  const specialOk = (s, d)=>{
    const ord = days[d];
    if(ord<s.lo || ord>s.hi || !normalWorkday(ord)) return false;
    if(load[d] >= dayCap(ord)) return false;
    if(perWeek && (weekLoad.get(weekKey(ord))||0) >= perWeek) return false;
    if(s.f.weekdays && s.f.weekdays.length && !s.f.weekdays.includes(wdOf(ord))) return false;
    const dc = dayCfg(ord);
    if(dc.only && dc.only.length && !dc.only.includes(s.f.category)) return false;
    if((facilityDays.get(s.f.id)||[]).includes(d)) return false;
    if(!dayRulesOk(d)) return false;
    const byPool = {};
    for(const id of s.people){
      const p = personById(id);
      if(hardOk(p, ord, s.f, ctx)) return false;
      byPool[p.pool] = (byPool[p.pool]||0)+1;
    }
    for(const pl of set.pools){
      const need = s.auto ? Math.max(byPool[pl.id]||0, seatsFor(pl, s.kind, s.f.category)) : (byPool[pl.id]||0);
      if((seatUse[d][pl.id]||0) + need > (avail[d][pl.id]||0)) return false;
    }
    return byPool;
  };
  const placedSpecials = [];
  const specials = specialsReq.list.slice().sort((a,b)=>a.tier-b.tier || (a.hi-a.lo)-(b.hi-b.lo) || b.people.length-a.people.length);
  const copiesBy = new Map();
  for(const s of specials) copiesBy.set(s.g.id, (copiesBy.get(s.g.id)||0)+1);
  for(const s of specials){
    const idx = []; for(let d=0; d<N; d++) if(days[d]>=s.lo && days[d]<=s.hi) idx.push(d);
    const total = copiesBy.get(s.g.id)||1;
    const target = idx.length ? idx[Math.min(idx.length-1, Math.floor((s.copy+0.5)*idx.length/total))] : 0;
    let best = -1, bestPools = null, bestScore = -Infinity;
    for(const d of idx){
      const pools = specialOk(s, d); if(!pools) continue;
      const sc = -Math.abs(d-target) - load[d]*0.5;
      if(sc>bestScore){ bestScore = sc; best = d; bestPools = pools; }
    }
    if(best<0){ diags.push({sev:s.tier===0?'warn':'info', key:'dSpecialNoDay', args:[goalTitle(s.g)]}); continue; }
    if(s.auto) for(const pl of set.pools) bestPools[pl.id] = Math.max(bestPools[pl.id]||0, seatsFor(pl, s.kind, s.f.category));
    occupy(best, s.f, s.kind, bestPools);
    const iso = isoOf(days[best]);
    for(const id of s.people) ctxTally(ctx, id, days[best], s.f, 1);
    placedSpecials.push({f:s.f, ord:days[best], gid:s.g.id, kind:s.kind});
    visits.push({id:uid('v'), d:best, date:iso, facilityId:s.f.id, kind:s.kind, team:{}, open:{}, special:s.g.id, preset:s.people, auto:s.auto, window:{from:s.g.from||null, to:s.g.to||null}, why:Object.assign({special:s.g.id, tier:s.tier, goals:[s.g.id]}, facilityScore(s.f, win.start))});
  }

  const demand = buildDemand(win, fixed, placedSpecials);
  const sel = selectUnits(win, fixed, demand, placedSpecials);
  diags.unshift(...demand.diags, ...sel.diags);

  const units = sel.units.filter(u=>!u.chain);
  const chainUnits = sel.units.filter(u=>u.chain);
  const byKind = {basic:units.filter(u=>u.kind==='basic'), contracted:units.filter(u=>u.kind==='contracted')};
  const kOrder = (a,b)=>((a.deadline==null)-(b.deadline==null)) || ((a.deadline||0)-(b.deadline||0)) || a.copy-b.copy || a.tier-b.tier || b.score-a.score;
  byKind.basic.sort(kOrder); byKind.contracted.sort(kOrder);
  const pattern = interleave(byKind.basic.length, byKind.contracted.length);
  const seq = [];
  let bi = 0, ci = 0;
  for(const k of pattern) seq.push(k==='basic' ? byKind.basic[bi++] : byKind.contracted[ci++]);
  const Vn = seq.length + chainUnits.length;
  seq.forEach((u, i)=>{
    u.target = sp.mode==='pack' ? 0 : Math.floor(i*N/Math.max(1,Vn));
    if(u.deadline!=null){ const li = lastIdxBy(days, u.deadline); u.limit = li; if(li>=0) u.target = Math.min(u.target, li); }
    else if(u.softDl!=null){ const li = lastIdxBy(days, u.softDl); if(li>=0) u.target = Math.min(u.target, li); u.softLimit = li; }
  });
  const copiesOf = new Map();
  for(const u of sel.units) copiesOf.set(u.f.id, (copiesOf.get(u.f.id)||0)+1);

  const sen = set.seniority;
  const seniorDays = new Map();
  const seniorNeeded = f=>sen.on && sen.mode==='require' && (f.importance||0) >= sen.threshold;
  const seniorOkOn = (f, kind, d)=>{
    if(!seniorNeeded(f)) return true;
    let key = f.id+'|'+kind;
    if(!seniorDays.has(key)){
      const q = activePeople().filter(p=>skillOf(p, kind, f.category) >= (f.importance||0) && !(p.blocked||[]).includes(f.id));
      const ds = new Set();
      for(let i=0;i<N;i++) if(q.some(p=>personAvailable(p, days[i]))) ds.add(i);
      seniorDays.set(key, ds);
    }
    const ds = seniorDays.get(key);
    return ds.size===0 || ds.has(d);
  };

  function canPlace(u, d, ignoreDeadline){
    const ord = days[d], c = dayCfg(ord);
    if(!normalWorkday(ord)) return false;
    if(!ignoreDeadline && u.limit!=null && d>u.limit) return false;
    if(u.lo!=null && !ignoreDeadline && d<u.lo) return false;
    if(u.f.weekdays && u.f.weekdays.length && !u.f.weekdays.includes(wdOf(ord))) return false;
    if(c.only && c.only.length && !c.only.includes(u.f.category)) return false;
    if(load[d] >= dayCap(ord)) return false;
    if(perWeek && (weekLoad.get(weekKey(ord))||0) >= perWeek) return false;
    for(const pl of set.pools){ const need = seatsFor(pl, u.kind, u.f.category); if((seatUse[d][pl.id]||0) + need > (avail[d][pl.id]||0)) return false; }
    const fd = facilityDays.get(u.f.id);
    if(fd && fd.includes(d)) return false;
    if(!dayRulesOk(d)) return false;
    if(!seniorOkOn(u.f, u.kind, d)) return false;
    return true;
  }
  function dayPref(u, d){
    const ord = days[d], c = dayCfg(ord);
    let m = 1;
    if(c.lean) m *= c.lean===u.kind ? 1.6 : 0.7;
    if(c.dist){ const b = distBand(facilityKm(u.f)); m *= b===c.dist ? 1.5 : (b==='mid' ? 1 : 0.7); }
    if(c.favor) m *= u.f.category===c.favor ? 1.4 : 1;
    if(c.min && load[d] < c.min) m *= 1.8;
    if(load[d]===0) m *= dayRulesPenalty(d);
    else if(softRules.length || activitySoftDayPenalty(ord)<1) m *= activitySoftDayPenalty(ord);
    const fd = facilityDays.get(u.f.id);
    if(fd && fd.length){
      const sep = Math.max(1, Math.floor((win.end-win.start+1)/((copiesOf.get(u.f.id)||1)+1)));
      const near = Math.min(...fd.map(e=>Math.abs(days[e]-ord)));
      if(near<sep) m *= 0.15 + 0.85*near/sep;
    }
    return m;
  }
  const requestedExtra = {n:0};
  const place = (u, d, late)=>{
    occupy(d, u.f, u.kind);
    visits.push({id:uid('v'), d, date:isoOf(days[d]), facilityId:u.f.id, kind:u.kind, team:{}, open:{}, late:!!late, limit:u.limit, why:{overdue:u.overdue, score:Math.round(u.score||0), rank:u.rank, tier:u.tier, goals:u.goals, deadline:u.deadline!=null ? isoOf(u.deadline) : (u.softDl!=null ? isoOf(u.softDl) : null)}});
  };
  function bestDayFor(u, target, packLast){
    let bestD = -1, bestScore = -Infinity, late = false;
    for(let pass=0; pass<3 && bestD<0; pass++){
      const lo = pass===0 ? Math.max(0, target-1) : 0;
      const hi = pass===0 ? Math.min(N-1, target+3) : N-1;
      for(let d=lo; d<=hi; d++){
        if(!canPlace(u, d, pass===2)) continue;
        let score = 1/(1+Math.abs(d-target)*(sp.mode==='pack'?1.5:0.45));
        if(sp.mode==='pack' && d<target) score *= 0.2;
        score *= dayPref(u, d);
        if(score>bestScore){ bestScore = score; bestD = d; }
      }
      if(bestD>=0 && pass===2 && u.limit!=null && bestD>u.limit) late = true;
    }
    return {d:bestD, late};
  }

  const chains = new Map();
  for(const c of demand.chains){
    const key = c.f.id+'|'+c.gid;
    chains.set(key, {key, f:c.f, kind:visitKindOf(c.f), last:c.last, days:c.days, strict:c.strict==='must', gid:c.gid, stuck:new Set()});
  }
  const chainNeed = ch=>{
    const dates = (facilityDays.get(ch.f.id)||[]).map(i=>days[i]);
    let need = chainNextNeed(ch.last, dates, ch.days, win.start, win.end);
    let guard = 0;
    while(need && ch.stuck.has(need.hi+':'+need.lo) && guard++<50){
      dates.push(need.hi);
      need = chainNextNeed(ch.last, dates, ch.days, win.start, win.end);
    }
    return need;
  };
  const chainUnitFor = (ch, need)=>{
    const r = sel.rankOf.get(ch.f.id) || Object.assign({f:ch.f, rank:'—'}, facilityScore(ch.f, win.start));
    const hiIdx = lastIdxBy(days, need.hi), loIdx = Math.min(N-1, firstIdxFrom(days, need.lo));
    const u = {f:ch.f, kind:ch.kind, tier:ch.strict?0:1, deadline:ch.strict?need.hi:null, softDl:ch.strict?null:need.hi, strict:ch.strict, chain:true, first:need.first, early:need.early, goals:[ch.gid],
      overdue:r.overdue, score:r.score, rank:r.rank, copy:(facilityDays.get(ch.f.id)||[]).length};
    u.limit = ch.strict ? hiIdx : null;
    u.lo = null;
    u.target = need.early ? 0 : (need.first ? Math.min(N-1, Math.floor(N/2)) : Math.max(0, hiIdx));
    if(!need.first && !need.early && loIdx<=hiIdx) u.target = hiIdx;
    return u;
  };

  const everyDay = !!V.requireEveryEligibleDay;
  const eligibleIdx = days.map((o,i)=>i).filter(i=>normalWorkday(days[i]));
  const queue = seq.slice().sort((a,b)=>a.tier-b.tier || ((a.deadline==null)-(b.deadline==null)) || ((a.deadline||0)-(b.deadline||0)) || a.copy-b.copy || a.target-b.target);
  let last = 0;

  if(everyDay){
    const uncovered = eligibleIdx.filter(i=>load[i]===0);
    const pool = queue.slice();
    const matchOf = new Map(), dayOf = new Map();
    const tryAug = (di, seen)=>{
      for(const u of pool){
        if(seen.has(u) || !canPlace(u, di, false)) continue;
        seen.add(u);
        if(!dayOf.has(u) || tryAug(dayOf.get(u), seen)){ dayOf.set(u, di); matchOf.set(di, u); return true; }
      }
      return false;
    };
    const order = uncovered.slice().sort((a,b)=>{
      const ca = pool.filter(u=>canPlace(u, a, false)).length, cb = pool.filter(u=>canPlace(u, b, false)).length;
      return ca-cb || a-b;
    });
    for(const di of order) tryAug(di, new Set());
    const matched = new Set();
    const forced = [...matchOf.entries()].sort((a,b)=>a[0]-b[0]);
    for(const [di, u] of forced){
      if(!canPlace(u, di, false)) continue;
      place(u, di, false); matched.add(u);
    }
    for(let i=queue.length-1;i>=0;i--) if(matched.has(queue[i])) queue.splice(i, 1);
    const still = eligibleIdx.filter(i=>load[i]===0);
    if(still.length && V.mode!=='exact' && V.mode!=='quota'){
      const extra = [];
      for(const k of ['basic','contracted']){
        for(const x of sel.ranked[k]){
          if(extra.length>=still.length) break;
          if(sel.picked.has(x.f.id) || demand.preCount.has(x.f.id)) continue;
          const u = {f:x.f, kind:k, tier:3, deadline:null, softDl:null, strict:false, goals:[], overdue:x.overdue, score:x.score, rank:x.rank, copy:0, target:0};
          extra.push(u);
        }
      }
      extra.sort((a,b)=>b.score-a.score);
      const eq = new Set();
      for(const di of still){
        const u = extra.find(x=>!eq.has(x) && canPlace(x, di, false));
        if(u){ eq.add(u); place(u, di, false); sel.picked.set(u.f.id, 1); requestedExtra.n++; }
      }
    }
  }

  const step = ()=>{
    let bestKey = null, bestU = null, bestCh = null, bestNeed = null;
    const cmp = (a,b)=>{ for(let i=0;i<a.length;i++){ if(a[i]!==b[i]) return a[i]-b[i]; } return 0; };
    for(const u of queue){
      const key = [u.tier, u.deadline==null?1:0, u.deadline||0, u.copy, u.target];
      if(!bestKey || cmp(key, bestKey)<0){ bestKey = key; bestU = u; bestCh = null; }
    }
    for(const ch of chains.values()){
      const need = chainNeed(ch);
      if(!need) continue;
      const key = [ch.strict?0:1, 0, need.hi, 0, 0];
      if(!bestKey || cmp(key, bestKey)<0){ bestKey = key; bestU = null; bestCh = ch; bestNeed = need; }
    }
    return {bestU, bestCh, bestNeed};
  };
  let guard = 0;
  while(guard++<5000){
    const {bestU, bestCh, bestNeed} = step();
    if(!bestU && !bestCh) break;
    if(bestU){
      queue.splice(queue.indexOf(bestU), 1);
      const target = sp.mode==='pack' ? last : bestU.target;
      const r = bestDayFor(bestU, target);
      if(r.d<0){ diags.push({sev:bestU.tier===0?'warn':'info', key:bestU.tier<=1?'dGoalNoRoom':'dNoRoom', args:[bestU.f.name]}); continue; }
      place(bestU, r.d, r.late);
      last = r.d;
    } else {
      const u = chainUnitFor(bestCh, bestNeed);
      requestedExtra.n++;
      const r = bestDayFor(u, u.target);
      if(r.d<0){
        bestCh.stuck.add(bestNeed.hi+':'+bestNeed.lo);
        diags.push({sev:u.tier===0?'warn':'info', key:'dGoalNoRoom', args:[u.f.name]});
        continue;
      }
      const late = r.late || (u.limit!=null && r.d>u.limit);
      if(late) bestCh.stuck.add(bestNeed.hi+':'+bestNeed.lo);
      place(u, r.d, late);
      last = r.d;
    }
  }

  const hasPreset = v=>!!v.preset;
  visits.sort((a,b)=>a.d-b.d || (hasPreset(b) - hasPreset(a)));
  for(const v of visits){
    const ord = days[v.d];
    if(hasPreset(v)){
      const res = assignTeam(v, ord, ctx, {preset:v.preset, auto:v.auto});
      v.team = res.team; v.open = res.open;
      commitTeam(v, ord, ctx, new Set(v.preset));
      continue;
    }
    let res = assignTeam(v, ord, ctx);
    if(res.openTotal>0){
      const f = facilityById(v.facilityId);
      const order = [];
      for(let d=0; d<N; d++) if(d!==v.d && (v.limit==null || d<=v.limit)) order.push(d);
      order.sort((a,b)=>Math.abs(a-v.d)-Math.abs(b-v.d));
      const u = {f, kind:v.kind, limit:v.limit};
      for(const d of order){
        const o = days[d];
        unoccupy(v.d, f, v.kind);
        const ok = canPlace(u, d, false);
        occupy(v.d, f, v.kind);
        if(!ok) continue;
        const trial = assignTeam(v, o, ctx);
        if(trial.openTotal===0){
          unoccupy(v.d, f, v.kind);
          occupy(d, f, v.kind);
          v.d = d; v.date = isoOf(o); res = trial; v.moved = true; break;
        }
      }
    }
    v.team = res.team; v.open = res.open;
    commitTeam(v, days[v.d], ctx);
  }
  visits.sort((a,b)=>a.d-b.d || (hasPreset(b) - hasPreset(a)));
  repairGender(visits, days, ctx);
  repairPeopleRules(visits, ctx);
  for(const f of schedulableFacilities()) if(f.pinned && !visits.some(v=>v.facilityId===f.id)) diags.push({sev:'warn', key:'dPinnedOut', args:[f.name]});

  const requested = units.length + chainUnits.length + fixed.length + placedSpecials.length + requestedExtra.n;
  let plan = {
    id: uid('plan'), cycle: (App.data.history.lastCycle||0)+1, createdAt: Date.now(),
    approved:false, stale:false, start:isoOf(win.start), end:isoOf(win.end), days: days.map(isoOf),
    goal:set.period.goal, requested,
    visits: visits.map(v=>({id:v.id, date:v.date, facilityId:v.facilityId, kind:v.kind, team:v.team, open:v.open, why:v.why, moved:!!v.moved, fixed:!!v.fixed, overrideId:v.overrideId||null, special:v.special||null, late:!!v.late,
      locked:v.preset ? v.preset.slice() : null, window:v.window||null, auto:v.preset ? !!v.auto : true})),
    carryover: sel.carry,
    goalReport: demand.report,
    genDiags: diags
  };
  const info = {win, fixed, placed:placedSpecials, demand, sel};
  const pre = preflightPlan(info, plan);
  let search = null;
  let val = validatePlan(plan);
  if(val.hard>0 && !opts.skipSearch){
    const bud = Object.assign({}, opts.budget || {});
    if(pre.conflicts.length) bud.ms = Math.min(bud.ms || 1500, 300);
    const r = searchPlan(plan, info, {budget:bud, seed:opts.seed});
    plan = r.plan; search = r.info;
    val = validatePlan(plan);
  }
  let status = 'valid';
  if(val.hard>0) status = pre.conflicts.length ? 'infeasible' : (opts.skipSearch ? 'invalid' : 'exhausted');
  plan.gen = genSnapshot({status, conflicts:pre.conflicts, search});
  plan.status = status;
  plan.conflicts = pre.conflicts;
  return {plan, status, conflicts:pre.conflicts, search};
}

function goalsPreview(){
  const win = planWindow();
  if(win.error) return null;
  const fixed = fixedVisitsFor(win);
  const demand = buildDemand(win, fixed, []);
  const sp = specialRequests(win);
  let must = 0, tryN = 0;
  for(const it of demand.items.values()) for(const s of it.slots){ if(s.tier===0) must++; else tryN++; }
  for(const s of sp.list){ if(s.tier===0) must++; else tryN++; }
  return {must, try:tryN, fixed:fixed.length, report:demand.report, win};
}
