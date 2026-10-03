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

function capHit(caps, f){ return caps.find(c=>c.left<=0 && inScope(f, c.scope)); }
function capTake(caps, f){ for(const c of caps) if(inScope(f, c.scope)) c.left--; }

function selectUnits(win, fixed, demand){
  const P = S().period, V = S().volume, prev = win.prev;
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
  const pick = (f, tier, deadline, goals)=>{
    const r = rankOf.get(f.id) || Object.assign({f, rank:'—'}, facilityScore(f, win.start));
    units.push({f, kind:visitKindOf(f), tier, deadline, goals:goals?[...goals]:[], overdue:r.overdue, score:r.score, rank:r.rank, copy:picked.get(f.id)||0});
    picked.set(f.id, (picked.get(f.id)||0)+1);
    capTake(caps, f);
  };
  const fixedNormal = fixed.filter(x=>normalWorkday(x.ord)).length;
  const room = Math.max(0, capacityOver(win.work, prev.goal==='coverage' ? (prev.total ? prev.basic/prev.total : 0.5) : (prev.total ? prev.basic/prev.total : V.share)) - fixedNormal);
  let dropped = 0;
  const goalSize = new Map();
  for(const it of demand.items.values()) for(const g of it.goals) goalSize.set(g, (goalSize.get(g)||0) + it.need);
  for(const it of demand.items.values()) it.size = Math.min(Infinity, ...[...it.goals].map(g=>goalSize.get(g)||0));
  const items = [...demand.items.values()].sort((a,b)=>a.tier-b.tier || a.size-b.size || ((a.deadline==null)-(b.deadline==null)) || ((a.deadline||0)-(b.deadline||0)) || ((rankOf.get(b.f.id)||{score:0}).score - (rankOf.get(a.f.id)||{score:0}).score));
  for(const it of items){
    if(it.tier>1) continue;
    for(let k=0;k<it.need;k++){
      if(units.length>=room){ dropped += it.need-k; break; }
      const hit = capHit(caps, it.f);
      if(hit){ if(it.tier===0) diags.push({sev:'warn', key:'dCapBlocked', args:[it.f.name]}); break; }
      pick(it.f, it.tier, it.deadline, it.goals);
    }
  }
  if(dropped) diags.push({sev:'warn', key:'dGoalOverCap', args:[dropped, room]});
  if(P.goal!=='coverage'){
    const fixedOfKind = k=>fixed.filter(x=>x.kind===k && normalWorkday(x.ord)).length;
    const selOfKind = k=>units.filter(u=>u.kind===k).length;
    const preferred = new Set(items.filter(it=>it.tier===2).map(it=>it.f.id));
    const goalsOf = new Map(items.map(it=>[it.f.id, it.goals]));
    const blocked = new Set();
    for(const g of S().goals){
      if(!g.on || g.type!=='cover' || g.strict!=='must') continue;
      const rep = demand.report[g.id];
      const since = rep ? rep.since : g.since;
      for(const f of goalFacilities(g)) if(visitsSince(f, since) >= Math.max(1, g.times||1)) blocked.add(f.id);
    }
    const fixedIds = new Set(fixed.map(x=>x.f.id));
    const order = list=>{
      const a = list.filter(x=>preferred.has(x.f.id)), b = list.filter(x=>!preferred.has(x.f.id) && !blocked.has(x.f.id)), c = list.filter(x=>!preferred.has(x.f.id) && blocked.has(x.f.id));
      return a.concat(b, c);
    };
    const fillFrom = (list, n)=>{
      let got = 0;
      for(const x of order(list)){
        if(got>=n) break;
        if(picked.has(x.f.id) || fixedIds.has(x.f.id)) continue;
        if(capHit(caps, x.f)) continue;
        pick(x.f, preferred.has(x.f.id) ? 2 : 3, null, goalsOf.get(x.f.id));
        got++;
      }
      return got;
    };
    if(V.mode==='quota'){
      for(const cat of Object.keys(V.quotas||{})){
        const q = Math.max(0, V.quotas[cat]|0); if(!q) continue;
        const kind = categoryKind(cat);
        if(kind!=='basic' && kind!=='contracted') continue;
        const have = units.filter(u=>u.f.category===cat).length + fixed.filter(x=>x.f.category===cat).length;
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
  const carry = [...ranked.basic, ...ranked.contracted].filter(x=>!picked.has(x.f.id) && !fixed.some(fx=>fx.f.id===x.f.id)).sort((a,b)=>b.score-a.score).slice(0,12).map(x=>x.f.id);
  return {units, diags, carry};
}

function generatePlan(){
  const set = S(), V = set.volume, sp = set.spacing;
  const win = planWindow();
  if(win.error) return {error:win.error};
  const days = win.days;
  if(!days.length) return {error:'noWorkdays'};
  const N = days.length;
  const dayIdx = new Map(days.map((o,i)=>[o,i]));
  const fixed = fixedVisitsFor(win).filter(x=>dayIdx.has(x.ord));
  const demand = buildDemand(win, fixed);
  const sel = selectUnits(win, fixed, demand);
  const diags = demand.diags.concat(sel.diags);
  const fixedPeopleOn = new Map();
  for(const fx of fixed){
    const k = fx.o.date;
    if(!fixedPeopleOn.has(k)) fixedPeopleOn.set(k, new Set());
    for(const id of fx.people){
      if(fixedPeopleOn.get(k).has(id)) diags.push({sev:'warn', key:'dFixedTwice', args:[(personById(id)||{}).name||'?', fx.o.date]});
      fixedPeopleOn.get(k).add(id);
    }
  }

  const load = new Array(N).fill(0);
  const avail = days.map(poolAvailOn);
  const seatUse = days.map(()=>({}));
  const weekLoad = new Map();
  const facilityDays = new Map();
  const perWeek = V.perWeek;
  const occupy = (d, f, kind, seatsByPool)=>{
    load[d]++;
    for(const pl of set.pools) seatUse[d][pl.id] = (seatUse[d][pl.id]||0) + (seatsByPool ? (seatsByPool[pl.id]||0) : seatsFor(pl, kind, f.category));
    const wk = weekKey(days[d]); weekLoad.set(wk, (weekLoad.get(wk)||0)+1);
    if(!facilityDays.has(f.id)) facilityDays.set(f.id, []);
    facilityDays.get(f.id).push(d);
  };
  const visits = [];
  for(const fx of fixed){
    const d = dayIdx.get(fx.ord);
    const byPool = {};
    for(const id of fx.people){ const p = personById(id); if(p) byPool[p.pool] = (byPool[p.pool]||0)+1; }
    if(fx.auto) for(const pl of set.pools) byPool[pl.id] = Math.max(byPool[pl.id]||0, seatsFor(pl, fx.kind, fx.f.category));
    occupy(d, fx.f, fx.kind, byPool);
    visits.push({id:uid('v'), d, date:fx.o.date, facilityId:fx.f.id, kind:fx.kind, team:{}, open:{}, fixed:true, overrideId:fx.o.id, preset:fx.people, auto:fx.auto, why:Object.assign({fixed:true}, facilityScore(fx.f, win.start))});
  }

  const lastIdxBy = dl=>{ let k = -1; for(let i=0;i<N;i++) if(days[i]<=dl) k = i; return k; };
  const units = sel.units;
  const byKind = {basic:units.filter(u=>u.kind==='basic'), contracted:units.filter(u=>u.kind==='contracted')};
  const kOrder = (a,b)=>((a.deadline==null)-(b.deadline==null)) || ((a.deadline||0)-(b.deadline||0)) || a.copy-b.copy || a.tier-b.tier || b.score-a.score;
  byKind.basic.sort(kOrder); byKind.contracted.sort(kOrder);
  const pattern = interleave(byKind.basic.length, byKind.contracted.length);
  const seq = [];
  let bi = 0, ci = 0;
  for(const k of pattern) seq.push(k==='basic' ? byKind.basic[bi++] : byKind.contracted[ci++]);
  const Vn = seq.length;
  seq.forEach((u, i)=>{
    u.target = sp.mode==='pack' ? 0 : Math.floor(i*N/Math.max(1,Vn));
    if(u.deadline!=null){ const li = lastIdxBy(u.deadline); u.limit = li; if(li>=0) u.target = Math.min(u.target, li); }
  });
  const placeOrder = seq.slice().sort((a,b)=>a.tier-b.tier || ((a.deadline==null)-(b.deadline==null)) || ((a.deadline||0)-(b.deadline||0)) || a.copy-b.copy || a.target-b.target);
  const copiesOf = new Map();
  for(const u of units) copiesOf.set(u.f.id, (copiesOf.get(u.f.id)||0)+1);

  function canPlace(u, d, ignoreDeadline){
    const ord = days[d], c = dayCfg(ord);
    if(!normalWorkday(ord)) return false;
    if(!ignoreDeadline && u.limit!=null && d>u.limit) return false;
    if(u.f.weekdays && u.f.weekdays.length && !u.f.weekdays.includes(wdOf(ord))) return false;
    if(c.only && c.only.length && !c.only.includes(u.f.category)) return false;
    if(load[d] >= dayCap(ord)) return false;
    if(perWeek && (weekLoad.get(weekKey(ord))||0) >= perWeek) return false;
    for(const pl of set.pools){ const need = seatsFor(pl, u.kind, u.f.category); if((seatUse[d][pl.id]||0) + need > (avail[d][pl.id]||0)) return false; }
    const fd = facilityDays.get(u.f.id);
    if(fd && fd.includes(d)) return false;
    return true;
  }
  function dayPref(u, d){
    const ord = days[d], c = dayCfg(ord);
    let m = 1;
    if(c.lean) m *= c.lean===u.kind ? 1.6 : 0.7;
    if(c.dist){ const b = distBand(facilityKm(u.f)); m *= b===c.dist ? 1.5 : (b==='mid' ? 1 : 0.7); }
    if(c.favor) m *= u.f.category===c.favor ? 1.4 : 1;
    if(c.min && load[d] < c.min) m *= 1.8;
    const fd = facilityDays.get(u.f.id);
    if(fd && fd.length){
      const sep = Math.max(1, Math.floor((win.end-win.start+1)/((copiesOf.get(u.f.id)||1)+1)));
      const near = Math.min(...fd.map(e=>Math.abs(days[e]-ord)));
      if(near<sep) m *= 0.15 + 0.85*near/sep;
    }
    return m;
  }
  let last = 0;
  for(const u of placeOrder){
    const target = sp.mode==='pack' ? last : u.target;
    let bestD = -1, bestScore = -Infinity, late = false;
    for(let pass=0; pass<3 && bestD<0; pass++){
      const lo = pass===0 ? Math.max(0, target-1) : 0;
      const hi = pass===0 ? Math.min(N-1, target+3) : N-1;
      for(let d=lo; d<=hi; d++){
        if(!canPlace(u, d, pass===2)) continue;
        let score = 1/(1+Math.abs(d-target)*(sp.mode==='pack'?1.5:0.45));
        if(sp.mode==='pack' && d<target) score *= 0.2;
        score *= dayPref(u, d);
        if(sp.mode==='gap' && load[d]===0){
          const gap = sp.gap||2;
          for(let k=1;k<gap;k++){ if((d-k>=0 && load[d-k]>0 && days[d]-days[d-k] < gap) || (d+k<N && load[d+k]>0 && days[d+k]-days[d] < gap)){ score *= 0.25; break; } }
        }
        if(score>bestScore){ bestScore = score; bestD = d; }
      }
      if(bestD>=0 && pass===2 && u.limit!=null && bestD>u.limit) late = true;
    }
    if(bestD<0){ diags.push({sev:u.tier===0?'warn':'info', key:u.tier<=1?'dGoalNoRoom':'dNoRoom', args:[u.f.name]}); continue; }
    occupy(bestD, u.f, u.kind);
    last = bestD;
    visits.push({id:uid('v'), d:bestD, date:isoOf(days[bestD]), facilityId:u.f.id, kind:u.kind, team:{}, open:{}, late, limit:u.limit, why:{overdue:u.overdue, score:Math.round(u.score), rank:u.rank, tier:u.tier, goals:u.goals, deadline:u.deadline!=null ? isoOf(u.deadline) : null}});
  }

  visits.sort((a,b)=>a.d-b.d || (!!b.fixed - !!a.fixed));
  const ctx = makeCtx(win.start);
  for(const v of visits){
    if(!v.fixed) continue;
    const ord = days[v.d];
    if(!ctx.dayUsed.has(ord)) ctx.dayUsed.set(ord, new Set());
    for(const id of v.preset){
      ctx.dayUsed.get(ord).add(id);
      ctx.assigned[id] = (ctx.assigned[id]||0)+1;
      const wk = id+'|'+weekKey(ord); ctx.week[wk] = (ctx.week[wk]||0)+1;
    }
  }
  for(const v of visits){
    const ord = days[v.d];
    if(v.fixed){
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
      for(const d of order){
        const o = days[d];
        if(!normalWorkday(o)) continue;
        if(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(o))) continue;
        const c = dayCfg(o);
        if(c.only && c.only.length && !c.only.includes(f.category)) continue;
        if(load[d] >= dayCap(o)) continue;
        if(perWeek && (weekLoad.get(weekKey(o))||0) >= perWeek) continue;
        if(visits.some(x=>x!==v && x.facilityId===v.facilityId && x.d===d)) continue;
        const trial = assignTeam(v, o, ctx);
        if(trial.openTotal===0){
          load[v.d]--; const wo = weekKey(days[v.d]); weekLoad.set(wo, (weekLoad.get(wo)||1)-1);
          load[d]++; const wn = weekKey(o); weekLoad.set(wn, (weekLoad.get(wn)||0)+1);
          v.d = d; v.date = isoOf(o); res = trial; v.moved = true; break;
        }
      }
    }
    v.team = res.team; v.open = res.open;
    commitTeam(v, days[v.d], ctx);
  }
  visits.sort((a,b)=>a.d-b.d || (!!b.fixed - !!a.fixed));
  repairGender(visits, days, ctx);
  for(const f of schedulableFacilities()) if(f.pinned && !visits.some(v=>v.facilityId===f.id)) diags.push({sev:'warn', key:'dPinnedOut', args:[f.name]});
  const plan = {
    id: uid('plan'), cycle: (App.data.history.lastCycle||0)+1, createdAt: Date.now(),
    approved:false, stale:false, start:isoOf(win.start), end:isoOf(win.end), days: days.map(isoOf),
    goal:set.period.goal, requested: units.length + fixed.length,
    visits: visits.map(v=>({id:v.id, date:v.date, facilityId:v.facilityId, kind:v.kind, team:v.team, open:v.open, why:v.why, moved:!!v.moved, fixed:!!v.fixed, overrideId:v.overrideId||null, late:!!v.late})),
    carryover: sel.carry,
    goalReport: demand.report,
    genDiags: diags
  };
  return {plan};
}

function goalsPreview(){
  const win = planWindow();
  if(win.error) return null;
  const fixed = fixedVisitsFor(win);
  const demand = buildDemand(win, fixed);
  let must = 0, tryN = 0;
  for(const it of demand.items.values()){ if(it.tier===0) must += it.need; else if(it.tier===1) tryN += it.need; }
  return {must, try:tryN, fixed:fixed.length, report:demand.report, win};
}
