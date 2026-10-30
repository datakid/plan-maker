const NEVER_DAYS = 1000;
const PAIR_FACTOR = {light:1.4, medium:2, strong:3};
const GP_FACTOR = {light:1.25, medium:1.6, strong:2.4};
function genderPrefFactor(p, ord, kind, band){
  const gp = p.gender && S().genderPrefs && S().genderPrefs[p.gender];
  if(!gp || !gp.on) return 1;
  const k = GP_FACTOR[genderPrefStrength(p.gender)] || GP_FACTOR.medium;
  let m = 1;
  if(gp.dist) m *= gp.dist===band ? k : (band==='mid' ? 1 : 1/k);
  if(gp.kind) m *= gp.kind===kind ? k : 1/k;
  if(gp.days && gp.days.length && !gp.days.includes(wdOf(ord))) m *= 1/(k*k);
  return m;
}

function normalWorkday(ord){
  const cal = S().calendar, iso = isoOf(ord);
  if(cal.holidays.includes(iso)) return false;
  const base = cal.extra.includes(iso) || cal.workdays.includes(wdOf(ord));
  return base && activityDayAllowed(ord);
}
function isWorkday(ord){ return normalWorkday(ord) || isOverrideDate(isoOf(ord)); }
function dayRuleOf(ord){
  const d = normalizeDay(S().days[wdOf(ord)]), V = S().volume;
  if(!d.min && V.minPerDay) d.min = {n:V.minPerDay, lv:V.minPerDayLv || mkLv('must', 5)};
  if(!d.min && V.dayMode==='exactly' && V.perDay>=1) d.min = {n:V.perDay, lv:mkLv('must', 5)};
  return d;
}
function dayCfg(ord){ return dayView(dayRuleOf(ord)); }

function presetWindow(preset, startIso, endIso){
  const t0 = todayOrd();
  if(preset==='week') return {start:t0, end:t0+6};
  if(preset==='month') return {start:t0, end:addMonthsOrd(t0,1)-1};
  if(preset==='nextMonth'){ const {y,m} = ymdOf(t0); const s = monthStartOrd(y, m+1); return {start:s, end:monthStartOrd(y, m+2)-1}; }
  if(preset==='quarter') return {start:t0, end:addMonthsOrd(t0,3)-1};
  const s = startIso ? ordOf(startIso) : null, e = endIso ? ordOf(endIso) : null;
  if(s==null || e==null || e<s) return null;
  return {start:s, end:e};
}

function poolsLive(){
  const pools = S().pools;
  return pools.map(pl=>({pool:pl, members:activePeople().filter(p=>p.pool===pl.id)}));
}
function teamSizeFor(kind, f){ return sum(S().pools, pl=>seatsForF(pl, kind, f)); }

function dayCap(ord){
  const v = S().volume, c = dayCfg(ord);
  return c.cap!=null ? Math.min(c.cap, v.perDay||1) : (v.perDay||1);
}
function poolAvailOn(ord){
  const out = {};
  for(const {pool, members} of poolsLive()) out[pool.id] = members.filter(p=>personAvailable(p, ord)).length;
  return out;
}

function facilityScore(f, startOrd){
  const overdue = f.lastVisit ? Math.max(0, startOrd - ordOf(f.lastVisit)) : NEVER_DAYS;
  const bias = S().distance.pickBias;
  let dist = 1;
  if(bias){ const b = distBand(facilityKm(f)); dist = b===bias ? 1.25 : (b==='mid' ? 1 : 0.8); }
  return {overdue, score: overdue * (f.freq==null?1:f.freq) * dist};
}
function rankFacilities(list, startOrd){
  const scored = list.map(f=>Object.assign({f}, facilityScore(f, startOrd)));
  scored.sort((a,b)=>{
    if(!!b.f.pinned !== !!a.f.pinned) return b.f.pinned ? 1 : -1;
    if(b.score!==a.score) return b.score-a.score;
    if((a.f.visitCount||0)!==(b.f.visitCount||0)) return (a.f.visitCount||0)-(b.f.visitCount||0);
    return norm(a.f.name) < norm(b.f.name) ? -1 : 1;
  });
  return scored;
}

function interleave(M, R){
  const V = M+R, out = [];
  let accM = 0;
  for(let i=0;i<V;i++){
    const wantM = Math.round((i+1)*M/V);
    if(wantM>accM){ out.push('basic'); accM++; } else out.push('contracted');
  }
  return out;
}

function inScope(f, scope){
  if(!scope || scope.kind==='all') return true;
  const ids = scope.ids||[];
  if(!ids.length) return false;
  if(scope.kind==='type') return ids.includes(facilityKind(f));
  if(scope.kind==='category') return ids.includes(f.category);
  if(scope.kind==='location') return ids.includes(f.locationId);
  if(scope.kind==='facility') return ids.includes(f.id);
  return true;
}

function listWorkdays(start, end){ const out = []; for(let o=start;o<=end;o++) if(isWorkday(o)) out.push(o); return out; }

function dayVisitCapacity(ord, shareBasic){
  if(!normalWorkday(ord)) return 0;
  const cap = dayCap(ord);
  const avail = poolAvailOn(ord);
  let teamFit = Infinity;
  for(const pl of S().pools){
    const need = shareBasic*seatsFor(pl,'basic') + (1-shareBasic)*seatsFor(pl,'contracted');
    if(need>0) teamFit = Math.min(teamFit, Math.floor((avail[pl.id]||0)/need + 1e-9));
  }
  return Math.max(0, Math.min(cap, teamFit===Infinity ? cap : teamFit));
}
function dayVisitCapacityMax(ord){
  if(!normalWorkday(ord)) return 0;
  const cap = dayCap(ord);
  const avail = poolAvailOn(ord);
  const pools = S().pools;
  const fits = (a, b)=>pools.every(pl=>a*seatsFor(pl, 'basic') + b*seatsFor(pl, 'contracted') <= (avail[pl.id]||0));
  let best = 0;
  for(let n=1;n<=cap;n++){
    let ok = false;
    for(let a=0;a<=n && !ok;a++) ok = fits(a, n-a);
    if(!ok) break;
    best = n;
  }
  return best;
}
function capacityOverMax(days){
  const perWeek = S().volume.perWeek;
  const byWeek = new Map();
  let total = 0;
  for(const o of days){
    const c = dayVisitCapacityMax(o);
    if(perWeek){ const k = weekKey(o); const used = byWeek.get(k)||0; const add = Math.max(0, Math.min(c, perWeek-used)); byWeek.set(k, used+add); total += add; }
    else total += c;
  }
  return total;
}
function capacityOver(days, shareBasic){
  const perWeek = S().volume.perWeek;
  const byWeek = new Map();
  let total = 0;
  for(const o of days){
    const c = dayVisitCapacity(o, shareBasic);
    if(perWeek){ const k = weekKey(o); const used = byWeek.get(k)||0; const add = Math.max(0, Math.min(c, perWeek-used)); byWeek.set(k, used+add); total += add; }
    else total += c;
  }
  return total;
}

function resolveCoverageEnd(startOrd, need, shareBasic){
  const perWeek = S().volume.perWeek;
  const byWeek = new Map();
  let acc = 0, count = 0;
  for(let o=startOrd; o<startOrd+3650; o++){
    if(!normalWorkday(o)) continue;
    let c = dayVisitCapacity(o, shareBasic);
    if(perWeek){ const k = weekKey(o); const used = byWeek.get(k)||0; c = Math.max(0, Math.min(c, perWeek-used)); byWeek.set(k, used+c); }
    acc += c; count++;
    if(acc>=need) return {end:o, workdays:count};
  }
  return null;
}

function volumePreview(){
  const P = S().period, V = S().volume;
  const pool = schedulableFacilities();
  const basicAll = pool.filter(f=>facilityKind(f)==='basic'), conAll = pool.filter(f=>facilityKind(f)==='contracted');
  if(P.goal==='coverage'){
    const inS = pool.filter(f=>inScope(f, P.scope));
    const times = Math.max(1, P.times||1);
    const B = inS.filter(f=>facilityKind(f)==='basic').length*times, C = inS.filter(f=>facilityKind(f)==='contracted').length*times;
    const start = P.start ? ordOf(P.start) : todayOrd();
    const share = B+C ? B/(B+C) : 0.5;
    const cov = B+C ? resolveCoverageEnd(start, B+C, share) : null;
    return {goal:'coverage', basic:B, contracted:C, total:B+C, start, end:cov?cov.end:null, workdays:cov?cov.workdays:0, reachable:!!cov};
  }
  const w = presetWindow(P.preset, P.start, P.end);
  if(!w) return {goal:'range', invalid:true, basic:0, contracted:0, total:0, workdays:0};
  const days = listWorkdays(w.start, w.end);
  let B, C, cap;
  if(V.mode==='exact'){ B = Math.max(0, V.exact.basic|0); C = Math.max(0, V.exact.contracted|0); cap = capacityOverMax(days); }
  else if(V.mode==='fixed'){
    B = 0; C = 0;
    for(const o of overridesIn(w.start, w.end)){ const f = facilityById(o.facilityId); if(f){ if(visitKindOf(f)==='contracted') C++; else B++; } }
    for(const r of specialRequests({start:w.start, end:w.end}).list){ if(r.kind==='contracted') C++; else B++; }
    cap = capacityOverMax(days);
  }
  else if(V.mode==='quota'){
    B = 0; C = 0;
    for(const cat of Object.keys(V.quotas||{})){
      const n = Math.min(Math.max(0, V.quotas[cat]|0), pool.filter(f=>f.category===cat).length);
      if(categoryKind(cat)==='basic') B += n; else C += n;
    }
    cap = capacityOverMax(days);
  } else {
    cap = capacityOver(days, V.share);
    let total = Math.min(cap, basicAll.length + conAll.length);
    if(V.total && V.total.n!=null) total = V.total.mode==='exactly' ? Math.min(V.total.n, basicAll.length + conAll.length) : Math.min(total, V.total.n);
    B = Math.min(Math.round(total*V.share), basicAll.length);
    C = Math.min(total - B, conAll.length);
    if(B + C < total) B = Math.min(basicAll.length, total - C);
  }
  const fixed = overridesIn(w.start, w.end).length;
  return {goal:'range', start:w.start, end:w.end, workdays:days.length, basic:B, contracted:C, total:B+C, capacity:cap, overCapacity: B+C>cap, fixed};
}

function genderRuleFor(f, kind, vr){
  if(vr && vr.gender){
    if(vr.gender==='none') return null;
    if(typeof vr.gender==='object') return {id:'visit', on:true, minEach:vr.gender.minEach||0, avoidEven:!!vr.gender.avoidEven};
  }
  for(const r of S().genderRules){
    if(!r.on) continue;
    if(r.kinds && r.kinds.length && !r.kinds.includes(kind)) continue;
    if(r.categories && r.categories.length && !r.categories.includes(f.category)) continue;
    if(r.facilities && r.facilities.length && !r.facilities.includes(f.id)) continue;
    return r;
  }
  return null;
}
function seniorLevelFor(f, vr, mustOnly){
  const sen = S().seniority, imp = f.importance||0;
  const o = vr && vr.senior;
  if(o==='off') return null;
  if(o==='on') return Math.max(imp, sen.threshold||0);
  if(sen.on && imp>=sen.threshold && (!mustOnly || seniorRequired())) return imp;
  return null;
}
function genderMinCount(rule, n){ return rule.minEach>0 ? Math.max(1, Math.ceil(n*rule.minEach/100 - 1e-9)) : 0; }
function genderValid(rule, m, f, n){
  if(!rule) return true;
  const min = genderMinCount(rule, n);
  if(m<min || f<min) return false;
  if(rule.avoidEven && n%2===0 && n>=4 && m===f) return false;
  return true;
}
function genderFeasible(rule, m, f, u, remaining, n){
  if(!rule) return true;
  if(u>0) return true;
  for(let add=0; add<=remaining; add++) if(genderValid(rule, m+add, f+remaining-add, n)) return true;
  return false;
}
function teamGender(ids, v){
  let m=0, f=0, u=0;
  for(const id of ids){ const p = personById(id); if(!p || !p.gender) u++; else if(p.gender==='m') m++; else f++; }
  if(v) for(const gid of (v.guests||[])){ const g = guestById(gid); if(!g || !g.pool) continue; if(g.gender==='m') m++; else if(g.gender==='f') f++; else u++; }
  return {m, f, u};
}

function buildPairIndex(){
  const idx = new Map();
  const add = (a, e)=>{ if(!idx.has(a)) idx.set(a, []); idx.get(a).push(e); };
  for(const r of S().pairs){
    if(!r.on || !r.a || !r.b || r.a===r.b) continue;
    const factor = PAIR_FACTOR[pairStrength(r)] || 2;
    add(r.a, {other:r.b, type:r.type, mode:pairRigid(r) ? 'rigid' : 'flexible', factor});
    add(r.b, {other:r.a, type:r.type, mode:pairRigid(r) ? 'rigid' : 'flexible', factor});
  }
  return idx;
}


function makeCtx(startOrd){
  const set = S();
  const counts = App.data.history.counts || {};
  const carry = {};
  for(const {pool, members} of poolsLive()){
    if(!set.fairness.carry || !members.length) continue;
    const mean = sum(members, p=>counts[p.id]||0)/members.length;
    for(const p of members) carry[p.id] = clamp((counts[p.id]||0) - mean, -2, 2) + 2;
  }
  const ctx = {
    startOrd, assigned:{}, carry, week:{}, far:{}, q:{}, both:{}, dates:{}, dayUsed:new Map(),
    pairs: buildPairIndex(), fpv: App.data.history.fpv || {}, rules: compilePeopleRules(), log:null, depth:0, prc:new Map()
  };
  seedHistory(ctx, startOrd);
  return ctx;
}

function tallyCtx(rules){ return {assigned:{}, week:{}, q:{}, both:{}, dates:{}, far:{}, dayUsed:new Map(), rules, log:null, depth:0, prc:new Map(), fpv:{}, pairs:new Map(), carry:{}}; }

function sepSide(r, f){
  const a = inScope(f, r.a), b = inScope(f, r.b);
  return a && !b ? 'a' : (b && !a ? 'b' : null);
}

function ctxTally(ctx, id, ord, f, d){
  ctx.assigned[id] = (ctx.assigned[id]||0)+d;
  const ds = ctx.dates[id] || (ctx.dates[id] = new Map());
  const n = (ds.get(ord)||0)+d; if(n>0) ds.set(ord, n); else ds.delete(ord);
  const wk = id+'|'+weekKey(ord); ctx.week[wk] = (ctx.week[wk]||0)+d;
  if(f) for(const r of ctx.rules.countsOf(id)) if(inScopeOpt(f, r.scope)) ctx.q[r.key] = (ctx.q[r.key]||0)+d;
  if(f) for(const r of ctx.rules.seps){ const side = sepSide(r, f); if(side) ctx.q[r.id+'|'+side+'|'+id] = (ctx.q[r.id+'|'+side+'|'+id]||0)+d; }
  let du = ctx.dayUsed.get(ord);
  if(d>0){ if(!du){ du = new Set(); ctx.dayUsed.set(ord, du); } du.add(id); }
  else if(du){ if(!ds.has(ord)) du.delete(id); if(!du.size) ctx.dayUsed.delete(ord); }
  if(f && distBand(facilityKm(f))==='far') ctx.far[id] = (ctx.far[id]||0)+d;
  if(ctx.log) ctx.log.push([0, id, ord, f, d]);
}
function ctxPairTally(ctx, ids, f, d){
  const s = new Set(ids);
  for(const r of ctx.rules.together) if(s.has(r.a) && s.has(r.b) && inScopeOpt(f, r.scope)) ctx.both[r.id] = (ctx.both[r.id]||0)+d;
  if(ctx.log) ctx.log.push([1, ids.slice(), f, d]);
}
function ctxBegin(ctx){
  if(!ctx.log){ ctx.log = []; ctx.depth = 0; }
  ctx.depth++;
  return ctx.log.length;
}
function ctxCommit(ctx){
  ctx.depth--;
  if(ctx.depth<=0){ ctx.log = null; ctx.depth = 0; }
}
function ctxRollback(ctx, mark){
  const log = ctx.log;
  ctx.log = null;
  while(log.length>mark){
    const e = log.pop();
    if(e[0]===0) ctxTally(ctx, e[1], e[2], e[3], -e[4]);
    else ctxPairTally(ctx, e[1], e[2], -e[3]);
  }
  ctx.depth--;
  ctx.log = ctx.depth<=0 ? null : log;
  if(ctx.depth<=0) ctx.depth = 0;
}
function ctxRulesOf(ctx, p){
  let r = ctx.prc.get(p.id);
  if(!r){ r = personPatternRules(p); ctx.prc.set(p.id, r); }
  return r;
}

function personTravelKm(p, f){
  const fk = facilityKm(f);
  if(fk==null) return null;
  if(S().distance.origin==='hq') return fk;
  if(p.origin && f.locationId===p.origin) return 0;
  const ok = p.origin ? (locationById(p.origin)||{}).km||0 : 0;
  return Math.abs(fk - ok) + Math.min(fk, ok) * 0.5;
}

function seatBase(p, f, ord, busy){
  if(busy && busy.has(p.id)) return 'busy';
  if(!personAvailable(p, ord)) return 'off';
  if((p.blocked || []).includes(f.id)) return 'blocked';
  if(distMismatch(p, f)) return 'dist';
  return null;
}
function seatBlock(p, v, date, plan, o){
  o = o || {};
  const f = facilityById(v.facilityId);
  if(!p || !f) return 'missing';
  let busy = o.busy;
  if(!busy){
    busy = new Set();
    for(const x of plan.visits) if(x.date===date && x.id!==v.id) for(const id of visitTeamIds(x)) busy.add(id);
  }
  const r = seatBase(p, f, ordOf(date), busy);
  if(r) return r;
  if(!visitAllows(v, p.id)) return 'visit';
  const rules = o.rules || compilePeopleRules();
  if(rules.denied(p.id, f)==='must') return 'rule';
  return null;
}
function canSeat(p, v, date, plan, o){ return !seatBlock(p, v, date, plan, o); }

function distMismatch(p, f){ return distStrict(p) && distBand(personTravelKm(p, f))!==p.distPref; }
function distStrict(p){ return !!(p.distPref && p.lv && p.lv.dist && p.lv.dist.level==='must'); }
function hardOk(p, ord, f, ctx, used){
  const u = used || ctx.dayUsed.get(ord);
  const base = seatBase(p, f, ord, u);
  if(base) return base;
  const rb = S().repeatBlock;
  if(rotateMustActive() && (ctx.fpv[f.id+'|'+p.id]||0) >= rb.times) return 'repeat';
  if(p.maxPerWeek!=null && p.maxPerWeek>0 && (ctx.week[p.id+'|'+weekKey(ord)]||0) >= p.maxPerWeek) return 'week';
  const ds = ctx.dates[p.id];
  if(ds) for(const r of ctxRulesOf(ctx, p).hard){ const b = ruleBreaksOn(r, ds, ord); if(b) return b; }
  if(ctx.rules.denied(p.id, f)==='must') return 'rule';
  for(const r of ctx.rules.seps){ if(!r.must) continue; const side = sepSide(r, f); if(side && (ctx.q[r.id+'|'+(side==='a' ? 'b' : 'a')+'|'+p.id]||0)>0) return 'separate'; }
  for(const r of ctx.rules.countsOf(p.id)) if(r.must && r.max!=null && inScopeOpt(f, r.scope) && (ctx.q[r.key]||0) >= r.max) return 'quota';
  return null;
}

function softRuleHits(p, ord, ctx){
  const ds = ctx.dates[p.id];
  let n = 0;
  if(ds) for(const r of ctxRulesOf(ctx, p).soft) if(ruleBreaksOn(r, ds, ord)) n++;
  return n;
}

function violationScore(ctx){
  let hard = 0, soft = 0;
  for(const r of ctx.rules.list){
    const q = ctx.q[r.key]||0;
    let d = 0;
    if(r.min!=null && q<r.min) d += r.min-q;
    if(r.max!=null && q>r.max) d += q-r.max;
    if(!d) continue;
    if(r.must) hard += d; else soft += d;
  }
  for(const r of ctx.rules.together){
    const gap = togetherTarget(r, ctx).gap;
    if(r.must) hard += gap; else soft += gap;
  }
  return {hard, soft};
}
function compareScores(a, b){
  return a.hard!==b.hard ? a.hard-b.hard : a.soft-b.soft;
}

function candidateTerms(p, f, ord, ctx, used, inTeam){
  const R = ctx.rules;
  let pref = 1, soft = 0;
  if(R.denied(p.id, f)==='try') soft++;
  for(const r of R.countsOf(p.id)){
    if(!inScopeOpt(f, r.scope)) continue;
    const q = ctx.q[r.key]||0;
    if(r.max!=null && q>=r.max) soft++;
    else if(r.min!=null && q<r.min) pref *= 1 + (r.must?3:1.5)*(r.min-q)/Math.max(1, r.min);
  }
  for(const r of R.togetherOf(p.id)){
    if(!inScopeOpt(f, r.scope)) continue;
    const other = r.a===p.id ? r.b : r.a;
    const st = togetherTarget(r, ctx);
    const ratio = st.base ? st.both/st.base : 0, goal = r.pct/100;
    if(inTeam(other)){
      if(r.rel==='atLeast'){ if(ratio < goal+1e-9) pref *= r.must?6:3; }
      else if(ratio >= goal-1e-9){ if(r.must) soft++; else pref *= 0.3; }
    } else if(r.rel==='atLeast' && ratio < goal+1e-9 && !(used && used.has(other))){
      const op = personById(other);
      if(op && !hardOk(op, ord, f, ctx, used)) pref *= r.must?2:1.4;
    }
  }
  const sh = softRuleHits(p, ord, ctx);
  if(sh) soft += sh;
  pref *= patternCycleSoftPenalty(p, ord);
  return {pref, soft};
}

function rigidClosure(p, ctx, inTeam){
  const out = [p], seen = new Set([p.id]);
  for(let i=0;i<out.length;i++){
    for(const e of (ctx.pairs.get(out[i].id)||[])){
      if(e.mode!=='rigid' || e.type!=='together' || seen.has(e.other) || inTeam(e.other)) continue;
      const q = personById(e.other);
      if(!q) continue;
      seen.add(q.id); out.push(q);
    }
  }
  return out;
}
function rigidAvoids(ctx, a, b){
  for(const e of (ctx.pairs.get(a)||[])) if(e.other===b && e.mode==='rigid' && e.type==='avoid') return true;
  return false;
}

function assignTeam(visit, ord, ctx, opts){
  const f = facilityById(visit.facilityId);
  const kind = visit.kind;
  const used = new Set(ctx.dayUsed.get(ord) || []);
  const set = S();
  const rule = genderRuleFor(f, kind, visit.rules);
  const sen = set.seniority;
  const seniorLvl = seniorLevelFor(f, visit.rules, true);
  const importance = seniorLvl==null ? (f.importance||0) : seniorLvl;
  const needSenior = seniorLvl!=null;
  const qual = p=>skillOf(p, kind, f.category) >= importance;
  const team = {}, chosen = [];
  const pairs = ctx.pairs;
  const exactShare = p=>p.quota && p.quota.min!=null && p.quota.min===p.quota.max;
  const preset = (opts && opts.preset) || [];
  const auto = !opts || !opts.preset || opts.auto;
  const needLeft = {};
  for(const pl of set.pools){ team[pl.id] = []; needLeft[pl.id] = auto ? visitSeatNeed(visit, pl, f) : 0; }
  const n = sum(Object.values(needLeft)) + preset.filter(id=>personById(id)).length;
  const poolKey = p=>set.pools.some(pl=>pl.id===p.pool) ? p.pool : set.pools[0].id;
  const inTeam = id=>chosen.includes(id);
  const seat = p=>{
    const pid = poolKey(p);
    team[pid].push(p.id); chosen.push(p.id); used.add(p.id);
    if(needLeft[pid]>0) needLeft[pid]--;
  };
  for(const id of preset){ const p = personById(id); if(p) seat(p); }
  for(const id of preset.slice()){
    const p = personById(id); if(!p) continue;
    for(const q of rigidClosure(p, ctx, inTeam).slice(1)){
      if(inTeam(q.id) || !visitAllows(visit, q.id) || (needLeft[poolKey(q)]||0)<=0 || hardOk(q, ord, f, ctx, used)) continue;
      seat(q);
    }
  }
  const open = {};
  let openTotal = 0;
  for(const {pool, members} of poolsLive()){
    while(needLeft[pool.id]>0){
      const remaining = sum(Object.values(needLeft));
      const g = teamGender(chosen, visit);
      const hasSenior = chosen.some(id=>{ const p = personById(id); return p && qual(p); });
      let seniorOnly = false, bestEffort = false;
      if(needSenior && !hasSenior && remaining===1){
        seniorOnly = members.some(p=>!inTeam(p.id) && qual(p) && !hardOk(p, ord, f, ctx, used));
        bestEffort = !seniorOnly;
      }
      let best = null, bestUnit = null, bestRank = Infinity, bestKey = Infinity;
      for(const p of members){
        if(inTeam(p.id) || !visitAllows(visit, p.id)) continue;
        if(hardOk(p, ord, f, ctx, used)) continue;
        const unit = rigidClosure(p, ctx, inTeam);
        if(unit.length>remaining || unit.some(m=>!visitAllows(visit, m.id) || (m!==p && hardOk(m, ord, f, ctx, used)))) continue;
        let okUnit = true;
        if(unit.length>1){
          const perPool = {};
          for(const m of unit){
            const pk = poolKey(m);
            perPool[pk] = (perPool[pk]||0)+1;
            if(m!==p && hardOk(m, ord, f, ctx, used)){ okUnit = false; break; }
          }
          if(okUnit) for(const pk in perPool) if(perPool[pk]>(needLeft[pk]||0)){ okUnit = false; break; }
        }
        if(!okUnit) continue;
        const mates = chosen.concat(unit.map(m=>m.id));
        for(const m of unit){ for(const o of mates) if(o!==m.id && rigidAvoids(ctx, m.id, o)){ okUnit = false; break; } if(!okUnit) break; }
        if(!okUnit) continue;
        if(seniorOnly && !unit.some(qual)) continue;
        let soft = 1;
        for(const e of (pairs.get(p.id)||[])){
          if(e.mode==='rigid') continue;
          if(inTeam(e.other)) soft *= e.type==='together' ? e.factor : 1/e.factor;
        }
        const skill = skillOf(p, kind, f.category);
        const share = exactShare(p) ? 1 : (p.share==null ? 1 : p.share);
        if(share<=0) continue;
        const terms = candidateTerms(p, f, ord, ctx, used, inTeam);
        let pref = soft * terms.pref;
        if(rotatePreferActive()){ const v = Math.min(ctx.fpv[f.id+'|'+p.id]||0, 6); pref *= 1/(1+rotationFactor()*v); }
        if(sen.on && sen.match){ const crit = (f.importance||50)/100; pref *= Math.max(0.1, 1 + sen.match*4*(crit-0.5)*(skill/100-0.5)); }
        const band = distBand(personTravelKm(p, f));
        if(p.distPref){ pref *= p.distPref===band ? 1.5 : (band==='mid' ? 1 : 0.65); }
        pref *= genderPrefFactor(p, ord, kind, band);
        if(set.distance.shortTrips){ pref *= band==='near' ? 1.3 : (band==='far' ? 0.75 : 1); }
        if(set.distance.balanceFar && band==='far'){ const fc = ctx.far ? (ctx.far[p.id]||0) : 0; pref *= 1/(1+0.5*fc); }
        if(ctx.dates[p.id] && ctx.dates[p.id].has(ord-1)) pref *= 0.85;
        let gOk = true;
        if(rule && unit.every(m=>m.gender)){
          let m2 = g.m, f2 = g.f;
          for(const m of unit){ if(m.gender==='m') m2++; else f2++; }
          gOk = genderFeasible(rule, m2, f2, g.u, remaining-unit.length, n+visitPooledGuests(visit));
        }
        const key = ((ctx.assigned[p.id]||0) + (ctx.carry[p.id]||0) + 0.5) / (share * clamp(pref, 0.1, 10));
        const rank = terms.soft*2 + (gOk?0:1) + (bestEffort ? (100-skill)/1000 : 0);
        if(rank<bestRank || (rank===bestRank && key<bestKey)){ bestRank = rank; bestKey = key; best = p; bestUnit = unit; }
      }
      if(best){
        for(const m of bestUnit) seat(m);
      } else {
        needLeft[pool.id]--;
        open[pool.id] = (open[pool.id]||0)+1;
        openTotal++;
      }
    }
  }
  if(!auto) for(const pl of set.pools){
    const lock = visit.seats && visit.seats[pl.id];
    if(lock!=null && lock>team[pl.id].length){ open[pl.id] = lock-team[pl.id].length; openTotal += open[pl.id]; }
  }
  return {team, open, openTotal};
}

function commitTeam(visit, ord, ctx, counted){
  const all = uniqIds(visitTeamIds(visit));
  const f = facilityById(visit.facilityId);
  for(const id of all) if(!(counted && counted.has(id))) ctxTally(ctx, id, ord, f, 1);
  ctxPairTally(ctx, all, f, 1);
}

function lockedOf(v){ return v.locked || v.preset || EMPTY_LIST; }
function visitSeatNeed(v, pool, f){
  const g = visitGuestsIn(v, pool.id);
  const lock = v.seats && v.seats[pool.id];
  if(lock!=null) return Math.max(0, Math.min(9, lock|0) - g);
  f = f || facilityById(v.facilityId);
  if(!f) return 0;
  if(v.auto===false) return lockedOf(v).filter(id=>{ const p = personById(id); return p && p.pool===pool.id; }).length;
  return Math.max(0, seatsForF(pool, v.kind || visitKindOf(f), f) - g);
}
function plannedSeats(seats, pool, kind, f, auto, have){
  const lock = seats && seats[pool.id];
  if(lock!=null) return Math.max(have||0, Math.min(9, lock|0));
  return auto ? Math.max(have||0, seatsForF(pool, kind, f)) : (have||0);
}
function visitAllows(v, id){
  if(v.never && v.never.includes(id)) return false;
  if(v.only && v.only.length && !v.only.includes(id) && !lockedOf(v).includes(id)) return false;
  return true;
}
function editableIn(v, id){ return !lockedOf(v).includes(id); }
function snapTeam(v){ const o = {}; for(const k of Object.keys(v.team||{})) o[k] = (v.team[k]||[]).slice(); return o; }
function replaceInTeam(v, out, inn){
  for(const k of Object.keys(v.team)){
    const i = v.team[k].indexOf(out);
    if(i>=0){ v.team[k][i] = inn; return; }
  }
}
function visitFlags(v){
  const f = facilityById(v.facilityId);
  const ids = uniqIds(visitTeamIds(v));
  const kind = v.kind || visitKindOf(f), n = teamSizeFor(kind, f), rule = genderRuleFor(f, kind, v.rules);
  const g = teamGender(ids, v);
  const gender = rule && g.u===0 && ids.length+visitPooledGuests(v)===n && !genderValid(rule, g.m, g.f, n) ? 1 : 0;
  const seniorLvl = seniorLevelFor(f, v.rules, true);
  let senior = 0;
  if(seniorLvl!=null && ids.length && !ids.some(id=>{ const p = personById(id); return p && skillOf(p, kind, f.category) >= seniorLvl; })) senior = 1;
  return {pair:pairBreaks(ids), gender, senior};
}
function flagsWorse(a, b, skipGender){
  return b.pair>a.pair || b.senior>a.senior || (!skipGender && b.gender>a.gender);
}

function editTransaction(ctx, edits, judge){
  const mark = ctxBegin(ctx);
  const saved = new Map();
  for(const e of edits) if(!saved.has(e.v)) saved.set(e.v, snapTeam(e.v));
  const vs = [...saved.keys()];
  const fl0 = vs.map(visitFlags);
  const sc0 = violationScore(ctx);
  for(const v of vs) ctxPairTally(ctx, uniqIds(visitTeamIds(v)), facilityById(v.facilityId), -1);
  for(const e of edits) ctxTally(ctx, e.out, e.ord, e.f, -1);
  let ok = true;
  for(const e of edits){
    const p = personById(e.inn);
    if(!p || hardOk(p, e.ord, e.f, ctx)){ ok = false; break; }
    ctxTally(ctx, e.inn, e.ord, e.f, 1);
    replaceInTeam(e.v, e.out, e.inn);
  }
  if(ok){
    for(const v of vs) ctxPairTally(ctx, uniqIds(visitTeamIds(v)), facilityById(v.facilityId), 1);
    ok = judge({sc0, sc1:violationScore(ctx), fl0, fl1:vs.map(visitFlags), vs});
  }
  if(ok){ ctxCommit(ctx); return true; }
  for(const [v, t0] of saved) v.team = t0;
  ctxRollback(ctx, mark);
  return false;
}

function repairGender(visits, days, ctx){
  const pools = S().pools;
  for(const v of visits){
    if(visitFlags(v).gender===0) continue;
    const f = facilityById(v.facilityId), ord = ordOf(v.date);
    let done = false;
    for(const pl of pools){
      if(done) break;
      for(const curId of (v.team[pl.id]||[]).slice()){
        if(done) break;
        if(!editableIn(v, curId)) continue;
        const cur = personById(curId);
        const want = cur.gender==='m' ? 'f' : 'm';
        const cands = activePeople().filter(p=>p.pool===pl.id && p.gender===want && !(ctx.dayUsed.get(ord)||new Set()).has(p.id));
        cands.sort((a,b)=>(ctx.assigned[a.id]||0)-(ctx.assigned[b.id]||0));
        for(const c of cands){
          if(editTransaction(ctx, [{v, f, ord, out:cur.id, inn:c.id}], r=>r.fl1[0].gender<r.fl0[0].gender && !flagsWorse(r.fl0[0], r.fl1[0], true) && r.sc1.hard<=r.sc0.hard)){ done = true; break; }
        }
      }
    }
    if(done) continue;
    for(const w of visits){
      if(done) break;
      if(w===v || w.date===v.date) continue;
      const wf = facilityById(w.facilityId), wOrd = ordOf(w.date);
      for(const pl of pools){
        if(done) break;
        for(const aId of (v.team[pl.id]||[]).slice()){
          if(done) break;
          for(const bId of (w.team[pl.id]||[]).slice()){
            if(!editableIn(v, aId) || !editableIn(w, bId)) continue;
            const pa = personById(aId), pb = personById(bId);
            if(!pa.gender || !pb.gender || pa.gender===pb.gender) continue;
            if(editTransaction(ctx, [{v, f, ord, out:aId, inn:bId}, {v:w, f:wf, ord:wOrd, out:bId, inn:aId}], r=>{
              if(!(r.fl1[0].gender<r.fl0[0].gender)) return false;
              if(r.fl1[1].gender>r.fl0[1].gender) return false;
              return !flagsWorse(r.fl0[0], r.fl1[0], true) && !flagsWorse(r.fl0[1], r.fl1[1], true) && r.sc1.hard<=r.sc0.hard;
            })){ done = true; break; }
          }
        }
      }
    }
  }
}

function repairPeopleRules(visits, ctx){
  if(!ctx.rules.list.some(r=>r.min!=null || r.max!=null) && !ctx.rules.together.length && !ctx.rules.seps.length) return;
  const pools = S().pools;
  let score = violationScore(ctx);
  for(let pass=0; pass<6 && (score.hard>0 || score.soft>0); pass++){
    let improved = false;
    for(const v of visits){
      if(score.hard===0 && score.soft===0) break;
      const f = facilityById(v.facilityId), ord = ordOf(v.date);
      for(const pl of pools){
        for(const curId of (v.team[pl.id]||[]).slice()){
          if(!editableIn(v, curId)) continue;
          const busy = ctx.dayUsed.get(ord) || new Set();
          for(const c of activePeople()){
            if(c.pool!==pl.id || busy.has(c.id)) continue;
            if(editTransaction(ctx, [{v, f, ord, out:curId, inn:c.id}], r=>compareScores(r.sc1, r.sc0)<0 && !flagsWorse(r.fl0[0], r.fl1[0]))){ improved = true; score = violationScore(ctx); break; }
          }
        }
      }
    }
    if(!improved){
      for(let i=0;i<visits.length && !improved;i++) for(let j=i+1;j<visits.length && !improved;j++){
        const v = visits[i], w = visits[j];
        if(v.date===w.date) continue;
        const f = facilityById(v.facilityId), wf = facilityById(w.facilityId), ord = ordOf(v.date), wOrd = ordOf(w.date);
        for(const pl of pools){
          if(improved) break;
          for(const aId of (v.team[pl.id]||[]).slice()){
            if(improved) break;
            for(const bId of (w.team[pl.id]||[]).slice()){
              if(aId===bId || !editableIn(v, aId) || !editableIn(w, bId)) continue;
              if(editTransaction(ctx, [{v, f, ord, out:aId, inn:bId}, {v:w, f:wf, ord:wOrd, out:bId, inn:aId}], r=>compareScores(r.sc1, r.sc0)<0 && !flagsWorse(r.fl0[0], r.fl1[0]) && !flagsWorse(r.fl0[1], r.fl1[1]))){ improved = true; score = violationScore(ctx); break; }
            }
          }
        }
      }
    }
    if(!improved) break;
  }
}

function planTally(plan){
  const ctx = tallyCtx(compilePeopleRules());
  const fr = planFrame(plan);
  seedHistory(ctx, fr.start);
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    const ids = uniqIds(visitTeamIds(v)), ord = ordOf(v.date);
    for(const id of ids) ctxTally(ctx, id, ord, f, 1);
    ctxPairTally(ctx, ids, f, 1);
  }
  return ctx;
}

function pairBreaks(ids){
  let n = 0;
  const s = new Set(ids);
  for(const r of S().pairs){
    if(!r.on || !pairRigid(r)) continue;
    const ha = s.has(r.a), hb = s.has(r.b);
    if(r.type==='avoid' && ha && hb) n++;
    if(r.type==='together' && ha!==hb) n++;
  }
  return n;
}

function visitTeamIds(v){ return [].concat(...Object.values(v.team||{})); }
function visitGuestLabels(v){ return (v.guests||[]).map(id=>guestById(id)).filter(Boolean).map(g=>g.name+' '+t('guestMark')); }

const CHECK_ALWAYS = ['cOpen','cDup','cAvail','cBlocked','cGender','cSenior','cPairs','cRun','cPeople','cGoals','cPrefs'];
const CHECK_ORDER = ['cOpen','cTeam','cDup','cAvail','cBlocked','cCalendar','cCaps','cWeek','cRest','cSpacing','cDays','cGender','cSenior','cPairs','cRun','cPeople','cGoals','cPrefs'];

function violationDiag(v){
  const sev = v.cls==='hard' ? 'error' : (v.cls==='exception' ? 'info' : (v.src==='goal' ? 'info' : 'warn'));
  return {sev, key:v.key, args:v.args, visit:v.visits && v.visits.length ? v.visits[0] : undefined, cls:v.cls, group:v.group, goal:v.goal||undefined};
}

function analyzePlan(plan, opts){
  const out = {diags:[], loads:{}, kinds:{basic:0, contracted:0}, km:{}, perDay:new Map(), expected:{}, checks:[]};
  if(!plan) return out;
  const set = S();
  const val = validatePlan(plan, opts);
  out.validation = val; out.violations = val.violations; out.valid = val.valid; out.hard = val.hard; out.soft = val.soft; out.exceptions = val.exceptions;
  out.tally = val.tally; out.goals = val.goals; out.days = val.days;
  const diags = (plan.genDiags||[]).slice();
  for(const v of plan.visits){
    out.kinds[v.kind] = (out.kinds[v.kind]||0)+1;
    if(!out.perDay.has(v.date)) out.perDay.set(v.date, []);
    out.perDay.get(v.date).push(v);
    const f = facilityById(v.facilityId);
    if(!f) continue;
    for(const id of uniqIds(visitTeamIds(v))){
      out.loads[id] = out.loads[id] || {total:0, basic:0, contracted:0, far:0, facilities:new Set(), days:new Set()};
      const L = out.loads[id];
      L.total++; L[v.kind]++; L.facilities.add(f.id); L.days.add(v.date);
      const p = personById(id);
      const km = p ? personTravelKm(p, f) : null;
      if(km!=null){ out.km[id] = (out.km[id]||0) + km*2; if(distBand(km)==='far') L.far++; }
    }
  }
  for(const v of val.violations) diags.push(violationDiag(v));
  for(const n of val.notes) diags.push({sev:'info', key:n.key, args:n.args});
  if(set.genderRules.some(r=>r.on)){
    const unknown = activePeople().filter(p=>!p.gender).length;
    if(unknown) diags.push({sev:'info', key:'dGenderUnknown', args:[unknown]});
  }
  if(plan.requested!=null && plan.visits.length < plan.requested) diags.push({sev:'warn', key:'dShort', args:[plan.visits.length, plan.requested]});
  for(const [wd, c] of Object.entries(set.days)){
    if(!c || !c.min) continue;
    const dates = plan.days.filter(iso=>wdOf(ordOf(iso))===+wd);
    const short = dates.filter(iso=>(out.perDay.get(iso)||[]).length < c.min).length;
    if(short) diags.push({sev:'info', key:'dDayMin', args:[+wd, short]});
  }
  const sevOrder = {error:0, warn:1, info:2};
  diags.sort((a,b)=>sevOrder[a.sev]-sevOrder[b.sev]);
  out.diags = diags;
  const relevant = key=>{
    if(CHECK_ALWAYS.includes(key)) return true;
    const g = val.byGroup[key];
    if(g && (g.hard || g.soft || g.exceptions)) return true;
    if(key==='cSpacing') return set.spacing.mode==='gap';
    if(key==='cDays') return !!set.volume.requireEveryEligibleDay;
    if(key==='cCalendar') return activityHard();
    return false;
  };
  out.seatLines = explainSeats(plan, {start:ordOf(plan.start || plan.days[0]), days:plan.days.map(ordOf)}).filter(l=>l.scope==='day');
  out.checks = CHECK_ORDER.filter(relevant).map(key=>{
    const g = val.byGroup[key] || {hard:0, soft:0, exceptions:0};
    return {key, ok:g.hard+g.soft===0, n:g.hard+g.soft, hard:g.hard, softN:g.soft, exc:g.exceptions, soft:g.hard===0};
  });
  out.blocking = out.checks.filter(c=>c.hard>0).length;
  out.softFails = out.checks.filter(c=>!c.ok && c.hard===0).length;
  for(const {pool, members} of poolsLive()){
    const seatsTotal = sum(plan.visits, v=>{ const f = facilityById(v.facilityId); return f ? visitSeatNeed(v, pool, f) : 0; });
    const av = {};
    for(const p of members) av[p.id] = plan.days.filter(iso=>personAvailable(p, ordOf(iso))).length;
    const bound = p=>{ const q = p.quota||{}; return {lo:Math.min(q.min!=null ? q.min : 0, av[p.id]), hi:Math.min(q.max!=null ? q.max : Infinity, av[p.id])}; };
    const exp = {}, free = new Set(members);
    let left = seatsTotal;
    for(let it=0; it<members.length+1 && free.size; it++){
      const wsum = sum([...free], p=>(p.share==null?1:p.share)*av[p.id]);
      let changed = false;
      for(const p of free){
        const raw = wsum>0 ? Math.max(0, left)*(p.share==null?1:p.share)*av[p.id]/wsum : 0, b = bound(p);
        if(raw<b.lo || raw>b.hi){ exp[p.id] = raw<b.lo ? b.lo : b.hi; free.delete(p); left -= exp[p.id]; changed = true; }
        else exp[p.id] = raw;
      }
      if(!changed) break;
    }
    for(const p of members) out.expected[p.id] = exp[p.id]||0;
  }
  return out;
}

function visitOrigin(v){
  if(v.fixed) return 'fixed';
  if(v.special) return 'special';
  return v.why && v.why.goals && v.why.goals.length ? 'goal' : 'filler';
}
function scoreOf(x){
  return {hard:x.hardScore!=null ? x.hardScore : x.hard, intent:x.intentScore!=null ? x.intentScore : (x.intent||0), soft:x.softScore!=null ? x.softScore : x.soft};
}
function cmpScore(a, b){
  const x = scoreOf(a), y = scoreOf(b);
  if(Math.abs(x.hard-y.hard)>1e-9) return x.hard<y.hard ? -1 : 1;
  if(Math.abs(x.intent-y.intent)>1e-9) return x.intent<y.intent ? -1 : 1;
  if(Math.abs(x.soft-y.soft)>1e-9) return x.soft<y.soft ? -1 : 1;
  return 0;
}
function clonePlan(plan){
  const c = Object.assign({}, plan);
  c.visits = deepClone(plan.visits);
  return c;
}
function violationSig(v){
  return [v.group, v.key, v.people.join('+'), v.dates.join('+'), v.facilities.join('+'), v.goal||''].join('|');
}
function evaluateEdit(plan, mutate){
  const base = validatePlan(plan);
  const trial = clonePlan(plan);
  mutate(trial);
  const after = validatePlan(trial);
  const seen = new Map();
  for(const v of base.violations) if(v.cls==='hard') seen.set(violationSig(v), (seen.get(violationSig(v))||0)+1);
  const introduced = [];
  for(const v of after.violations){
    if(v.cls!=='hard') continue;
    const k = violationSig(v);
    if(seen.get(k)>0) seen.set(k, seen.get(k)-1); else introduced.push(v);
  }
  return {trial, base, after, introduced, hardBefore:base.hard, hardAfter:after.hard};
}

function candidatesForSeat(plan, visit, poolId, currentId){
  const f = facilityById(visit.facilityId);
  const ord = ordOf(visit.date);
  const busy = new Set(plan.visits.filter(v=>v.date===visit.date && v.id!==visit.id).flatMap(visitTeamIds));
  const inTeam = new Set(visitTeamIds(visit));
  const base = validatePlan(plan);
  const baseSigs = new Map();
  for(const v of base.violations) if(v.cls==='hard') baseSigs.set(violationSig(v), (baseSigs.get(violationSig(v))||0)+1);
  return activePeople().filter(p=>p.pool===poolId && p.id!==currentId && !inTeam.has(p.id)).map(p=>{
    let reason = seatBase(p, f, ord, busy), warn = null, introduced = [];
    if(!reason){
      const trial = clonePlan(plan);
      const tv = trial.visits.find(v=>v.id===visit.id);
      const list = tv.team[poolId] = (tv.team[poolId]||[]).slice();
      const i = list.indexOf(currentId);
      if(i>=0) list[i] = p.id; else list.push(p.id);
      const after = validatePlan(trial);
      const seen = new Map(baseSigs);
      for(const v of after.violations){
        if(v.cls!=='hard') continue;
        const k = violationSig(v);
        if(seen.get(k)>0) seen.set(k, seen.get(k)-1); else introduced.push(v);
      }
      if(introduced.length) warn = introduced[0].group==='cPeople' ? 'quota' : (introduced[0].group==='cRun' || introduced[0].group==='cRest' || introduced[0].group==='cWeek' ? 'run' : 'rule');
    }
    const T = base.tally;
    return {p, reason, warn, introduced, load:T.assigned[p.id]||0};
  }).sort((a,b)=>(!!a.reason - !!b.reason) || (!!a.warn - !!b.warn) || a.load-b.load);
}

function replacementFacilities(plan, visit){
  const inPlan = new Set(plan.visits.map(v=>v.facilityId));
  const ord = ordOf(visit.date);
  const c = dayCfg(ord);
  return rankFacilities(schedulableFacilities().filter(f=>facilityKind(f)===visit.kind && !inPlan.has(f.id)
    && !(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(ord)))
    && !(c.only && c.only.length && !c.only.includes(f.category))), ordOf(plan.start)).slice(0, 40);
}

function moveTargets(plan, visit){
  const ids = visitTeamIds(visit);
  const f = facilityById(visit.facilityId);
  return plan.days.filter(d=>d!==visit.date).map(d=>{
    const ord = ordOf(d);
    const others = plan.visits.filter(v=>v.date===d);
    const busy = new Set(others.flatMap(visitTeamIds));
    const conflicts = ids.filter(id=>busy.has(id) || !personAvailable(personById(id), ord)).length;
    const full = others.length >= dayCap(ord);
    const wdBad = f && f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(ord));
    const trial = evaluateEdit(plan, p=>{ const v = p.visits.find(x=>x.id===visit.id); v.date = d; });
    return {date:d, count:others.length, conflicts, full, wdBad, introduced:trial.introduced.length, hardAfter:trial.hardAfter};
  });
}

function approvalBlockers(plan){
  const out = [];
  if(!plan) return out;
  if(plan.stale) out.push({key:'stale'});
  const val = validatePlan(plan);
  if(val.hard>0) out.push({key:'invalid', n:val.hard, violations:val.violations.filter(v=>v.cls==='hard')});
  return out;
}

function approvePlan(){
  const plan = App.plan;
  if(!plan || plan.approved) return {ok:false, blockers:[]};
  const blockers = approvalBlockers(plan);
  if(blockers.length) return {ok:false, blockers};
  const val = validatePlan(plan);
  takeSnapshot('approve');
  const H = App.data.history;
  const snap = {facilities: plan.visits.map(v=>{ const f = facilityById(v.facilityId); return f ? {id:f.id, lastVisit:f.lastVisit, visitCount:f.visitCount, history:deepClone(f.history)} : null; }).filter(Boolean),
    fpv: Object.assign({}, H.fpv), counts: Object.assign({}, H.counts), lastCycle: H.lastCycle};
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    if(!f.lastVisit || v.date > f.lastVisit) f.lastVisit = v.date;
    f.visitCount = (f.visitCount||0)+1;
    const names = uniqIds(visitTeamIds(v)).map(id=>(personById(id)||{}).name).filter(Boolean);
    f.history = [{date:v.date, team:names}].concat(f.history||[]).sort((a,b)=>a.date<b.date?1:-1).slice(0,20);
    for(const id of uniqIds(visitTeamIds(v))){
      H.fpv[f.id+'|'+id] = (H.fpv[f.id+'|'+id]||0)+1;
      H.counts[id] = (H.counts[id]||0)+1;
    }
  }
  H.lastCycle = plan.cycle;
  snap.goalSince = {};
  for(const row of val.goals){
    if(row.rolled && row.since && row.g){ snap.goalSince[row.g.id] = row.g.since; row.g.since = row.since; }
  }
  plan.approved = true; plan.stale = false; plan.snapshot = snap;
  save(); savePlan(); emit('plan');
  return {ok:true, blockers};
}
function unapprovePlan(){
  const plan = App.plan;
  if(!plan || !plan.approved || !plan.snapshot) return;
  const s = plan.snapshot;
  for(const x of s.facilities){ const f = facilityById(x.id); if(f){ f.lastVisit = x.lastVisit; f.visitCount = x.visitCount; f.history = x.history; } }
  App.data.history.fpv = s.fpv; App.data.history.counts = s.counts; App.data.history.lastCycle = s.lastCycle;
  for(const id in (s.goalSince||{})){ const g = goalById(id); if(g) g.since = s.goalSince[id]; }
  plan.approved = false; delete plan.snapshot; delete plan.override;
  save(); savePlan(); emit('plan');
}
