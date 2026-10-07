const NEVER_DAYS = 1000;
const PAIR_FACTOR = {light:1.4, medium:2, strong:3};
const GP_FACTOR = {light:1.25, medium:1.6, strong:2.4};
function genderPrefFactor(p, ord, kind, band){
  const gp = p.gender && S().genderPrefs && S().genderPrefs[p.gender];
  if(!gp || !gp.on) return 1;
  const k = GP_FACTOR[gp.strength] || GP_FACTOR.medium;
  let m = 1;
  if(gp.dist) m *= gp.dist===band ? k : (band==='mid' ? 1 : 1/k);
  if(gp.kind) m *= gp.kind===kind ? k : 1/k;
  if(gp.days && gp.days.length && !gp.days.includes(wdOf(ord))) m *= 1/(k*k);
  return m;
}

function normalWorkday(ord){
  const cal = S().calendar, iso = isoOf(ord);
  if(cal.holidays.includes(iso)) return false;
  if(cal.extra.includes(iso)) return true;
  return cal.workdays.includes(wdOf(ord));
}
function isWorkday(ord){ return normalWorkday(ord) || isOverrideDate(isoOf(ord)); }
function dayCfg(ord){ return S().days[wdOf(ord)] || {}; }

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
function seatsMap(kind, category){ const m = {}; for(const pl of S().pools) m[pl.id] = seatsFor(pl, kind, category); return m; }
function teamSizeFor(kind, category){ return sum(S().pools, pl=>seatsFor(pl, kind, category)); }

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
  if(V.mode==='exact'){ B = Math.max(0, V.exact.basic|0); C = Math.max(0, V.exact.contracted|0); cap = capacityOver(days, B+C ? B/(B+C) : 0.5); }
  else if(V.mode==='quota'){
    B = 0; C = 0;
    for(const cat of Object.keys(V.quotas||{})){
      const n = Math.min(Math.max(0, V.quotas[cat]|0), pool.filter(f=>f.category===cat).length);
      if(categoryKind(cat)==='basic') B += n; else C += n;
    }
    cap = capacityOver(days, B+C ? B/(B+C) : 0.5);
  } else {
    cap = capacityOver(days, V.share);
    let total = Math.min(cap, basicAll.length + conAll.length);
    B = Math.min(Math.round(total*V.share), basicAll.length);
    C = Math.min(total - B, conAll.length);
    if(B + C < total) B = Math.min(basicAll.length, total - C);
  }
  const fixed = overridesIn(w.start, w.end).length;
  return {goal:'range', start:w.start, end:w.end, workdays:days.length, basic:B, contracted:C, total:B+C, capacity:cap, overCapacity: B+C>cap, fixed};
}

function genderRuleFor(f, kind){
  for(const r of S().genderRules){
    if(!r.on) continue;
    if(r.kinds && r.kinds.length && !r.kinds.includes(kind)) continue;
    if(r.categories && r.categories.length && !r.categories.includes(f.category)) continue;
    if(r.facilities && r.facilities.length && !r.facilities.includes(f.id)) continue;
    return r;
  }
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
function teamGender(ids){
  let m=0, f=0, u=0;
  for(const id of ids){ const p = personById(id); if(!p || !p.gender) u++; else if(p.gender==='m') m++; else f++; }
  return {m, f, u};
}

function buildPairIndex(){
  const idx = new Map();
  const add = (a, e)=>{ if(!idx.has(a)) idx.set(a, []); idx.get(a).push(e); };
  for(const r of S().pairs){
    if(!r.on || !r.a || !r.b || r.a===r.b) continue;
    const factor = PAIR_FACTOR[r.strength] || 2;
    add(r.a, {other:r.b, type:r.type, mode:r.mode, factor});
    add(r.b, {other:r.a, type:r.type, mode:r.mode, factor});
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
  return {
    startOrd, assigned:{}, carry, week:{}, far:{}, q:{}, both:{}, dates:{}, dayUsed:new Map(),
    pairs: buildPairIndex(), fpv: App.data.history.fpv || {}, rules: compilePeopleRules()
  };
}

function tallyCtx(rules){ return {assigned:{}, week:{}, q:{}, both:{}, dates:{}, rules}; }
function ctxTally(ctx, id, ord, f, d){
  ctx.assigned[id] = (ctx.assigned[id]||0)+d;
  const ds = ctx.dates[id] || (ctx.dates[id] = new Map());
  const n = (ds.get(ord)||0)+d; if(n>0) ds.set(ord, n); else ds.delete(ord);
  const wk = id+'|'+weekKey(ord); ctx.week[wk] = (ctx.week[wk]||0)+d;
  for(const r of ctx.rules.countsOf(id)) if(inScopeOpt(f, r.scope)) ctx.q[r.key] = (ctx.q[r.key]||0)+d;
}
function ctxPairTally(ctx, ids, f, d){
  const s = new Set(ids);
  for(const r of ctx.rules.together) if(s.has(r.a) && s.has(r.b) && inScopeOpt(f, r.scope)) ctx.both[r.id] = (ctx.both[r.id]||0)+d;
}

function personTravelKm(p, f){
  const fk = facilityKm(f);
  if(fk==null) return null;
  if(S().distance.origin==='hq') return fk;
  if(p.origin && f.locationId===p.origin) return 0;
  const ok = p.origin ? (locationById(p.origin)||{}).km||0 : 0;
  return Math.abs(fk - ok) + Math.min(fk, ok) * 0.5;
}

function hardOk(p, ord, f, ctx, used){
  if(used.has(p.id)) return 'busy';
  if(!personAvailable(p, ord)) return 'off';
  if((p.blocked||[]).includes(f.id)) return 'blocked';
  const rb = S().repeatBlock;
  if(rb.on && (ctx.fpv[f.id+'|'+p.id]||0) >= rb.times) return 'repeat';
  if(p.maxRun!=null && p.maxRun>0 && runAround(ctx.dates[p.id], ord) > p.maxRun) return 'run';
  if(p.maxPerWeek!=null && p.maxPerWeek>0 && (ctx.week[p.id+'|'+weekKey(ord)]||0) >= p.maxPerWeek) return 'week';
  if(ctx.rules.denied(p.id, f)==='must') return 'rule';
  for(const r of ctx.rules.countsOf(p.id)) if(r.must && r.max!=null && inScopeOpt(f, r.scope) && (ctx.q[r.key]||0) >= r.max) return 'quota';
  return null;
}

function runAround(ds, ord){
  if(!ds) return 1;
  let n = 1;
  for(let o=ord-1; ds.has(o); o--) n++;
  for(let o=ord+1; ds.has(o); o++) n++;
  return n;
}
function quotaBroken(ctx, pid){
  for(const r of ctx.rules.countsOf(pid)) if(r.must && r.max!=null && (ctx.q[r.key]||0) > r.max) return true;
  return false;
}
function peopleViolation(ctx){
  let v = 0;
  for(const r of ctx.rules.list){
    const q = ctx.q[r.key]||0, w = r.must ? 10 : 1;
    if(r.min!=null && q<r.min) v += w*(r.min-q);
    if(r.max!=null && q>r.max) v += w*(q-r.max);
  }
  for(const r of ctx.rules.together) v += (r.must ? 10 : 1) * togetherTarget(r, ctx).gap;
  return v;
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
    } else if(r.rel==='atLeast' && ratio < goal+1e-9 && !used.has(other)){
      const op = personById(other);
      if(op && !hardOk(op, ord, f, ctx, used)) pref *= r.must?2:1.4;
    }
  }
  return {pref, soft};
}

function assignTeam(visit, ord, ctx, opts){
  const f = facilityById(visit.facilityId);
  const kind = visit.kind;
  const used = new Set(ctx.dayUsed.get(ord) || []);
  const set = S();
  const n = teamSizeFor(kind, f.category);
  const rule = genderRuleFor(f, kind);
  const sen = set.seniority;
  const needSenior = sen.on && sen.mode==='require' && (f.importance||0) >= sen.threshold;
  const team = {}, chosen = [];
  const pairs = ctx.pairs;
  const exactShare = p=>p.quota && p.quota.min!=null && p.quota.min===p.quota.max;
  const preset = (opts && opts.preset) || [];
  const auto = !opts || !opts.preset || opts.auto;
  for(const pl of set.pools) team[pl.id] = [];
  for(const id of preset){
    const p = personById(id); if(!p) continue;
    const pid = set.pools.some(pl=>pl.id===p.pool) ? p.pool : set.pools[0].id;
    team[pid].push(id); chosen.push(id); used.add(id);
  }
  let remaining = Math.max(0, n - chosen.length);
  const partners = id=>pairs.get(id)||[];
  const inTeam = id=>chosen.includes(id);
  for(const {pool, members} of poolsLive()){
    const seats = auto ? seatsFor(pool, kind, f.category) : 0;
    for(let s=team[pool.id].length; s<seats; s++){
      const g = teamGender(chosen);
      const hasSenior = chosen.some(id=>skillOf(personById(id), kind, f.category) >= (f.importance||0));
      const lastSeatOverall = remaining===1;
      let best=null, bestRank=Infinity, bestKey=Infinity;
      let seniorBar = null;
      if(needSenior && lastSeatOverall && !hasSenior){
        let top = -1;
        for(const p of members) if(!hardOk(p, ord, f, ctx, used) && !inTeam(p.id)) top = Math.max(top, skillOf(p, kind, f.category));
        if(top>=0) seniorBar = Math.min(f.importance||0, top);
      }
      for(const p of members){
        if(inTeam(p.id)) continue;
        if(hardOk(p, ord, f, ctx, used)) continue;
        let rigidBlock = false, soft = 1;
        for(const e of partners(p.id)){
          const seated = inTeam(e.other);
          if(e.mode==='rigid'){
            if(e.type==='avoid' && seated) rigidBlock = true;
          } else if(seated){
            soft *= e.type==='together' ? e.factor : 1/e.factor;
          }
          if(e.type==='together' && e.mode==='rigid' && seated) soft *= 50;
        }
        if(rigidBlock) continue;
        const skill = skillOf(p, kind, f.category);
        if(seniorBar!=null && skill < seniorBar) continue;
        const share = exactShare(p) ? 1 : (p.share==null ? 1 : p.share);
        if(share<=0) continue;
        const terms = candidateTerms(p, f, ord, ctx, used, inTeam);
        let pref = soft * terms.pref;
        if(set.rotation.on){ const v = Math.min(ctx.fpv[f.id+'|'+p.id]||0, 6); pref *= 1/(1+set.rotation.strength*v); }
        if(sen.on && sen.match){ const crit = (f.importance||50)/100; pref *= Math.max(0.1, 1 + sen.match*4*(crit-0.5)*(skill/100-0.5)); }
        const band = distBand(personTravelKm(p, f));
        if(p.distPref){ pref *= p.distPref===band ? 1.5 : (band==='mid' ? 1 : 0.65); }
        pref *= genderPrefFactor(p, ord, kind, band);
        if(set.distance.shortTrips){ pref *= band==='near' ? 1.3 : (band==='far' ? 0.75 : 1); }
        if(set.distance.balanceFar && band==='far'){ const fc = ctx.far ? (ctx.far[p.id]||0) : 0; pref *= 1/(1+0.5*fc); }
        if(ctx.dates[p.id] && ctx.dates[p.id].has(ord-1)) pref *= 0.85;
        let gOk = true;
        if(rule && p.gender){
          const m2 = g.m + (p.gender==='m'?1:0), f2 = g.f + (p.gender==='f'?1:0);
          gOk = genderFeasible(rule, m2, f2, g.u, remaining-1, n);
        }
        const key = ((ctx.assigned[p.id]||0) + (ctx.carry[p.id]||0) + 0.5) / (share * clamp(pref, 0.1, 10));
        const rank = terms.soft*2 + (gOk?0:1);
        if(rank<bestRank || (rank===bestRank && key<bestKey)){ bestRank = rank; bestKey = key; best = p; }
      }
      const pick = best;
      if(pick){
        team[pool.id].push(pick.id); chosen.push(pick.id); used.add(pick.id);
      }
      remaining--;
    }
  }
  const open = {};
  let openTotal = 0;
  if(auto) for(const pl of set.pools){ const need = seatsFor(pl, kind, f.category); const got = (team[pl.id]||[]).length; if(need>got){ open[pl.id] = need-got; openTotal += need-got; } }
  return {team, open, openTotal};
}

function commitTeam(visit, ord, ctx, counted){
  const all = visitTeamIds(visit);
  if(!ctx.dayUsed.has(ord)) ctx.dayUsed.set(ord, new Set());
  const f = facilityById(visit.facilityId);
  const farBand = distBand(facilityKm(f))==='far';
  for(const id of all){
    ctx.dayUsed.get(ord).add(id);
    if(!(counted && counted.has(id))) ctxTally(ctx, id, ord, f, 1);
    if(farBand) ctx.far[id] = (ctx.far[id]||0)+1;
  }
  ctxPairTally(ctx, all, f, 1);
}


function repairGender(visits, days, ctx){
  for(const v of visits){
    if(v.fixed || (v.preset && v.preset.length)) continue;
    const f = facilityById(v.facilityId);
    const rule = genderRuleFor(f, v.kind);
    if(!rule) continue;
    const ids = [].concat(...Object.values(v.team));
    const n = teamSizeFor(v.kind, f.category);
    let g = teamGender(ids);
    if(g.u>0 || ids.length<n || genderValid(rule, g.m, g.f, n)) continue;
    const ord = ordOf(v.date);
    const dayIds = new Set(visits.filter(x=>x.date===v.date).flatMap(x=>[].concat(...Object.values(x.team))));
    let fixed = false;
    for(const pl of S().pools){
      if(fixed) break;
      const list = v.team[pl.id]||[];
      for(let i=0;i<list.length && !fixed;i++){
        const cur = personById(list[i]);
        const want = cur.gender==='m' ? 'f' : 'm';
        const cands = activePeople().filter(p=>p.pool===pl.id && p.gender===want && !dayIds.has(p.id) && !hardOk(p, ord, f, ctx, new Set()));
        cands.sort((a,b)=>(ctx.assigned[a.id]||0)-(ctx.assigned[b.id]||0));
        for(const c of cands){
          const next = ids.map(x=>x===cur.id ? c.id : x);
          const g2 = teamGender(next);
          if(!genderValid(rule, g2.m, g2.f, n)) continue;
          if(pairBreaks(next) > pairBreaks(ids)) continue;
          ctxPairTally(ctx, ids, f, -1);
          list[i] = c.id;
          ctxTally(ctx, cur.id, ord, f, -1); ctxTally(ctx, c.id, ord, f, 1);
          ctxPairTally(ctx, next, f, 1);
          fixed = true; break;
        }
      }
    }
    if(fixed) continue;
    for(const w of visits){
      if(fixed) break;
      if(w===v || w.date===v.date || w.fixed || (w.preset && w.preset.length)) continue;
      const wf = facilityById(w.facilityId);
      for(const pl of S().pools){
        if(fixed) break;
        const a = v.team[pl.id]||[], b = w.team[pl.id]||[];
        for(let i=0;i<a.length && !fixed;i++) for(let j=0;j<b.length && !fixed;j++){
          const pa = personById(a[i]), pb = personById(b[j]);
          if(!pa.gender || !pb.gender || pa.gender===pb.gender) continue;
          const wIds = new Set(visits.filter(x=>x.date===w.date).flatMap(x=>[].concat(...Object.values(x.team))));
          const vIds = new Set(visits.filter(x=>x.date===v.date).flatMap(x=>[].concat(...Object.values(x.team))));
          if(vIds.has(pb.id) || wIds.has(pa.id)) continue;
          const hb = hardOk(pb, ord, f, ctx, new Set()), ha = hardOk(pa, ordOf(w.date), wf, ctx, new Set());
          if((hb && hb!=='quota') || (ha && ha!=='quota')) continue;
          const nv = ids.map(x=>x===pa.id ? pb.id : x);
          const wAll = [].concat(...Object.values(w.team));
          const nw = wAll.map(x=>x===pb.id ? pa.id : x);
          const gv = teamGender(nv), gw = teamGender(nw);
          const wRule = genderRuleFor(wf, w.kind), wn = teamSizeFor(w.kind, wf.category);
          if(!genderValid(rule, gv.m, gv.f, n)) continue;
          if(wRule && gw.u===0 && !genderValid(wRule, gw.m, gw.f, wn)) continue;
          if(pairBreaks(nv)+pairBreaks(nw) > pairBreaks(ids)+pairBreaks(wAll)) continue;
          const wOrd = ordOf(w.date);
          const apply = s=>{
            ctxPairTally(ctx, s>0 ? ids : nv, f, -1); ctxPairTally(ctx, s>0 ? wAll : nw, wf, -1);
            ctxTally(ctx, pa.id, ord, f, -s); ctxTally(ctx, pa.id, wOrd, wf, s);
            ctxTally(ctx, pb.id, wOrd, wf, -s); ctxTally(ctx, pb.id, ord, f, s);
            ctxPairTally(ctx, s>0 ? nv : ids, f, 1); ctxPairTally(ctx, s>0 ? nw : wAll, wf, 1);
          };
          apply(1);
          if(quotaBroken(ctx, pa.id) || quotaBroken(ctx, pb.id)){ apply(-1); continue; }
          a[i] = pb.id; b[j] = pa.id; fixed = true;
        }
      }
    }
  }
}

function repairPeopleRules(visits, ctx){
  if(!ctx.rules.list.some(r=>r.min!=null || r.max!=null) && !ctx.rules.together.length) return;
  const pools = S().pools;
  const dayIds = new Map();
  for(const v of visits){ if(!dayIds.has(v.date)) dayIds.set(v.date, new Set()); for(const id of visitTeamIds(v)) dayIds.get(v.date).add(id); }
  const editable = visits.filter(v=>!v.fixed && !(v.preset && v.preset.length));
  let score = peopleViolation(ctx);
  for(let pass=0; pass<4 && score>0; pass++){
    let improved = false;
    for(const v of editable){
      if(score<=0) break;
      const f = facilityById(v.facilityId), ord = ordOf(v.date), n = teamSizeFor(v.kind, f.category);
      const rule = genderRuleFor(f, v.kind);
      const busy = dayIds.get(v.date);
      for(const pl of pools){
        const list = v.team[pl.id] || [];
        for(let i=0;i<list.length;i++){
          const cur = personById(list[i]); if(!cur) continue;
          const ids = visitTeamIds(v);
          const g0 = teamGender(ids), gOk0 = !rule || g0.u>0 || genderValid(rule, g0.m, g0.f, n), pb0 = pairBreaks(ids);
          let best = null, bestScore = score;
          for(const c of activePeople()){
            if(c.pool!==pl.id || busy.has(c.id)) continue;
            if(hardOk(c, ord, f, ctx, new Set())) continue;
            const next = ids.map(x=>x===cur.id ? c.id : x);
            const g = teamGender(next);
            if(rule && gOk0 && g.u===0 && !genderValid(rule, g.m, g.f, n)) continue;
            if(pairBreaks(next) > pb0) continue;
            ctxPairTally(ctx, ids, f, -1); ctxTally(ctx, cur.id, ord, f, -1); ctxTally(ctx, c.id, ord, f, 1); ctxPairTally(ctx, next, f, 1);
            const s = quotaBroken(ctx, c.id) ? Infinity : peopleViolation(ctx);
            ctxPairTally(ctx, next, f, -1); ctxTally(ctx, c.id, ord, f, -1); ctxTally(ctx, cur.id, ord, f, 1); ctxPairTally(ctx, ids, f, 1);
            if(s < bestScore - 1e-9){ bestScore = s; best = c; }
          }
          if(best){
            const next = ids.map(x=>x===cur.id ? best.id : x);
            ctxPairTally(ctx, ids, f, -1); ctxTally(ctx, cur.id, ord, f, -1); ctxTally(ctx, best.id, ord, f, 1); ctxPairTally(ctx, next, f, 1);
            busy.delete(cur.id); busy.add(best.id);
            list[i] = best.id; score = bestScore; improved = true;
          }
        }
      }
    }
    if(!improved) break;
  }
}

function planTally(plan){
  const ctx = tallyCtx(compilePeopleRules());
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    const ids = visitTeamIds(v), ord = ordOf(v.date);
    for(const id of ids) ctxTally(ctx, id, ord, f, 1);
    ctxPairTally(ctx, ids, f, 1);
  }
  return ctx;
}

function pairBreaks(ids){
  let n = 0;
  const s = new Set(ids);
  for(const r of S().pairs){
    if(!r.on || r.mode!=='rigid') continue;
    const ha = s.has(r.a), hb = s.has(r.b);
    if(r.type==='avoid' && ha && hb) n++;
    if(r.type==='together' && ha!==hb) n++;
  }
  return n;
}

function visitTeamIds(v){ return [].concat(...Object.values(v.team||{})); }

function analyzePlan(plan){
  const out = {diags:[], loads:{}, kinds:{basic:0, contracted:0}, km:{}, perDay:new Map(), expected:{}, checks:[]};
  if(!plan) return out;
  const set = S();
  const diags = (plan.genDiags||[]).slice();
  for(const v of plan.visits){
    out.kinds[v.kind] = (out.kinds[v.kind]||0)+1;
    if(!out.perDay.has(v.date)) out.perDay.set(v.date, []);
    out.perDay.get(v.date).push(v);
    const f = facilityById(v.facilityId);
    if(!f){ diags.push({sev:'error', key:'dMissingFacility', args:[]}); continue; }
    for(const id of visitTeamIds(v)){
      out.loads[id] = out.loads[id] || {total:0, basic:0, contracted:0, far:0, facilities:new Set(), days:new Set()};
      const L = out.loads[id];
      L.total++; L[v.kind]++; L.facilities.add(f.id); L.days.add(v.date);
      const p = personById(id);
      const km = p ? personTravelKm(p, f) : null;
      if(km!=null){ out.km[id] = (out.km[id]||0) + km*2; if(distBand(km)==='far') L.far++; }
    }
  }
  let openSeats = 0, genderBad = 0, seniorBad = 0, rigidBad = 0, dupDay = 0, unavailable = 0, blocked = 0, runBad = 0;
  const byDate = out.perDay;
  for(const [date, list] of byDate){
    const seen = new Set();
    for(const v of list) for(const id of visitTeamIds(v)){ if(seen.has(id)) dupDay++; seen.add(id); }
  }
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    const ids = visitTeamIds(v);
    const o = sum(Object.values(v.open||{}));
    if(o>0){ openSeats += o; diags.push({sev:'error', key:'dOpenSeats', args:[f.name, v.date, o], visit:v.id}); }
    const rule = genderRuleFor(f, v.kind);
    const n = teamSizeFor(v.kind, f.category);
    const g = teamGender(ids);
    if(rule && g.u===0 && ids.length===n && !genderValid(rule, g.m, g.f, n)){ genderBad++; diags.push({sev:'warn', key:'dGender', args:[f.name, v.date, g.m, g.f], visit:v.id}); }
    const sen = set.seniority;
    if(sen.on && (f.importance||0) >= sen.threshold && ids.length){
      if(!ids.some(id=>{ const p = personById(id); return p && skillOf(p, v.kind, f.category) >= (f.importance||0); })){ seniorBad++; diags.push({sev:'warn', key:'dSenior', args:[f.name, v.date], visit:v.id}); }
    }
    const pb = pairBreaks(ids);
    if(pb){ rigidBad += pb; diags.push({sev:'warn', key:'dPair', args:[f.name, v.date], visit:v.id}); }
    if(v.late) diags.push({sev:'warn', key:'dLate', args:[f.name, v.why && v.why.deadline], visit:v.id});
    for(const id of ids){
      const p = personById(id);
      if(!p) continue;
      if(v.fixed){
        if(!personAvailable(p, ordOf(v.date))) diags.push({sev:'info', key:'dFixedOff', args:[p.name, v.date], visit:v.id});
        if((p.blocked||[]).includes(f.id)) diags.push({sev:'info', key:'dFixedBlocked', args:[p.name, f.name], visit:v.id});
        continue;
      }
      if(!personAvailable(p, ordOf(v.date))){ unavailable++; diags.push({sev:'error', key:'dUnavailable', args:[p.name, v.date], visit:v.id}); }
      if((p.blocked||[]).includes(f.id)){ blocked++; diags.push({sev:'error', key:'dBlocked', args:[p.name, f.name], visit:v.id}); }
    }
  }
  for(const p of activePeople()){
    if(!p.maxRun) continue;
    const ds = [...(out.loads[p.id] ? out.loads[p.id].days : [])].map(ordOf).sort((a,b)=>a-b);
    let run = 1;
    for(let i=1;i<ds.length;i++){ run = ds[i]===ds[i-1]+1 ? run+1 : 1; if(run>p.maxRun){ runBad++; diags.push({sev:'warn', key:'dRun', args:[p.name, isoOf(ds[i])]}); break; } }
  }
  if(set.genderRules.some(r=>r.on)){
    const unknown = activePeople().filter(p=>!p.gender).length;
    if(unknown) diags.push({sev:'info', key:'dGenderUnknown', args:[unknown]});
  }
  if(plan.requested!=null && plan.visits.length < plan.requested) diags.push({sev:'warn', key:'dShort', args:[plan.visits.length, plan.requested]});
  const T = planTally(plan);
  out.tally = T;
  let peopleBad = 0;
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    for(const id of visitTeamIds(v)){
      const d = T.rules.denied(id, f);
      if(d){ const p = personById(id); if(d==='must') peopleBad++; diags.push({sev:d==='must'?'warn':'info', key:'dPersonRule', args:[p?p.name:'?', f.name], visit:v.id}); }
    }
  }
  for(const r of T.rules.list){
    if(r.src==='together') continue;
    const q = T.q[r.key]||0, p = personById(r.pid);
    if((r.min!=null && q<r.min) || (r.max!=null && q>r.max)){
      if(r.must) peopleBad++;
      diags.push({sev:r.must?'warn':'info', key:'dQuotaPerson', args:[p?p.name:'?', q, quotaLabel(r)]});
    }
  }
  out.goals = goalProgress(plan, T);
  const goalsBad = out.goals.filter(r=>r.state==='short' && r.must).length;
  for(const r of out.goals) if(r.state==='short') diags.push({sev:r.must?'warn':'info', key:'dGoalShort', args:[r.title, r.inPlan, r.target]});
  for(const [wd, c] of Object.entries(set.days)){
    if(!c || !c.min) continue;
    const dates = plan.days.filter(iso=>wdOf(ordOf(iso))===+wd);
    const short = dates.filter(iso=>(byDate.get(iso)||[]).length < c.min).length;
    if(short) diags.push({sev:'info', key:'dDayMin', args:[+wd, short]});
  }
  const sevOrder = {error:0, warn:1, info:2};
  diags.sort((a,b)=>sevOrder[a.sev]-sevOrder[b.sev]);
  out.diags = diags;
  out.checks = [
    {key:'cOpen', ok:openSeats===0, n:openSeats},
    {key:'cDup', ok:dupDay===0, n:dupDay},
    {key:'cAvail', ok:unavailable===0, n:unavailable},
    {key:'cBlocked', ok:blocked===0, n:blocked},
    {key:'cGender', ok:genderBad===0, n:genderBad, soft:true},
    {key:'cSenior', ok:seniorBad===0, n:seniorBad, soft:true},
    {key:'cPairs', ok:rigidBad===0, n:rigidBad, soft:true},
    {key:'cRun', ok:runBad===0, n:runBad, soft:true},
    {key:'cPeople', ok:peopleBad===0, n:peopleBad, soft:true},
    {key:'cGoals', ok:goalsBad===0, n:goalsBad, soft:true}
  ];
  out.blocking = out.checks.filter(c=>!c.ok && !c.soft).length;
  out.softFails = out.checks.filter(c=>!c.ok && c.soft).length;
  for(const {pool, members} of poolsLive()){
    const seatsTotal = sum(plan.visits, v=>{ const f = facilityById(v.facilityId); return f ? seatsFor(pool, v.kind, f.category) : 0; });
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

function candidatesForSeat(plan, visit, poolId, currentId){
  const f = facilityById(visit.facilityId);
  const ord = ordOf(visit.date);
  const busy = new Set(plan.visits.filter(v=>v.date===visit.date && v.id!==visit.id).flatMap(visitTeamIds));
  const inTeam = new Set(visitTeamIds(visit));
  const T = planTally(plan);
  return activePeople().filter(p=>p.pool===poolId && p.id!==currentId && !inTeam.has(p.id)).map(p=>{
    let reason = null, warn = null;
    if(busy.has(p.id)) reason = 'busy';
    else if(!personAvailable(p, ord)) reason = 'off';
    else if((p.blocked||[]).includes(f.id)) reason = 'blocked';
    else if(T.rules.denied(p.id, f)) warn = 'rule';
    else if(T.rules.countsOf(p.id).some(r=>r.max!=null && inScopeOpt(f, r.scope) && (T.q[r.key]||0) >= r.max)) warn = 'quota';
    return {p, reason, warn, load: T.assigned[p.id]||0};
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
    return {date:d, count:others.length, conflicts, full, wdBad};
  });
}

function approvePlan(){
  const plan = App.plan;
  if(!plan || plan.approved) return;
  const H = App.data.history;
  const snap = {facilities: plan.visits.map(v=>{ const f = facilityById(v.facilityId); return f ? {id:f.id, lastVisit:f.lastVisit, visitCount:f.visitCount, history:deepClone(f.history)} : null; }).filter(Boolean),
    fpv: Object.assign({}, H.fpv), counts: Object.assign({}, H.counts), lastCycle: H.lastCycle};
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    if(!f.lastVisit || v.date > f.lastVisit) f.lastVisit = v.date;
    f.visitCount = (f.visitCount||0)+1;
    const names = visitTeamIds(v).map(id=>(personById(id)||{}).name).filter(Boolean);
    f.history = [{date:v.date, team:names}].concat(f.history||[]).sort((a,b)=>a.date<b.date?1:-1).slice(0,20);
    for(const id of visitTeamIds(v)){
      H.fpv[f.id+'|'+id] = (H.fpv[f.id+'|'+id]||0)+1;
      H.counts[id] = (H.counts[id]||0)+1;
    }
  }
  H.lastCycle = plan.cycle;
  snap.goalSince = {};
  for(const g of S().goals){
    const r = plan.goalReport && plan.goalReport[g.id];
    if(r && r.rolled && r.since){ snap.goalSince[g.id] = g.since; g.since = r.since; }
  }
  plan.approved = true; plan.stale = false; plan.snapshot = snap;
  save(); savePlan(); emit('plan');
}
function unapprovePlan(){
  const plan = App.plan;
  if(!plan || !plan.approved || !plan.snapshot) return;
  const s = plan.snapshot;
  for(const x of s.facilities){ const f = facilityById(x.id); if(f){ f.lastVisit = x.lastVisit; f.visitCount = x.visitCount; f.history = x.history; } }
  App.data.history.fpv = s.fpv; App.data.history.counts = s.counts; App.data.history.lastCycle = s.lastCycle;
  for(const id in (s.goalSince||{})){ const g = goalById(id); if(g) g.since = s.goalSince[id]; }
  plan.approved = false; delete plan.snapshot;
  save(); savePlan(); emit('plan');
}
