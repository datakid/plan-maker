const FACILITY_GOALS = ['cover','atLeast','atMost','maxGap'];
const PEOPLE_GOALS = ['person','together','special'];
const GOAL_TYPES = FACILITY_GOALS.concat(PEOPLE_GOALS);
const TOGETHER_RELS = ['atLeast','atMost'];

function newGoal(type){
  const g = {id:uid('goal'), on:true, type, strict:'try', scope:{kind:'all', ids:[]}};
  if(type==='cover') Object.assign(g, {times:1, since:todayISO(), by:null, repeat:true});
  if(type==='atLeast') Object.assign(g, {n:4});
  if(type==='atMost') Object.assign(g, {n:2, strict:'must', scope:{kind:'category', ids:[]}});
  if(type==='maxGap') Object.assign(g, {days:60, strict:'must'});
  if(type==='person') Object.assign(g, {people:[], rel:'never', n:4, strict:'must', scope:{kind:'type', ids:['contracted']}});
  if(type==='together') Object.assign(g, {a:null, b:null, rel:'atLeast', pct:50});
  if(type==='special') Object.assign(g, {facilityId:null, people:[], fill:true, times:1, from:null, to:null, strict:'must'});
  return g;
}
function defaultGoals(){
  const cover = newGoal('cover'); cover.id = 'goal_cover';
  const gap = newGoal('maxGap'); gap.id = 'goal_gap'; gap.on = false; gap.days = 90; gap.scope = {kind:'type', ids:['basic']};
  return [cover, gap];
}
function normalizeGoal(g){
  const type = GOAL_TYPES.includes(g && g.type) ? g.type : 'cover';
  const out = Object.assign(newGoal(type), g||{}, {type});
  out.scope = out.scope && out.scope.kind ? {kind:out.scope.kind, ids:Array.isArray(out.scope.ids) ? out.scope.ids.slice() : []} : {kind:'all', ids:[]};
  out.strict = out.strict==='must' ? 'must' : 'try';
  out.on = out.on!==false;
  if(type==='person'){
    out.people = Array.isArray(out.people) ? [...new Set(out.people.filter(Boolean))] : [];
    if(!PERSON_RELS.includes(out.rel)) out.rel = 'never';
    out.n = Math.max(0, out.n|0);
  }
  if(type==='together'){
    if(!TOGETHER_RELS.includes(out.rel)) out.rel = 'atLeast';
    out.pct = clamp(out.pct|0, 0, 100);
  }
  if(type==='special'){
    out.people = Array.isArray(out.people) ? [...new Set(out.people.filter(Boolean))] : [];
    out.times = Math.max(1, out.times|0);
    out.fill = out.fill!==false;
  }
  return out;
}
function newOverride(p){ return Object.assign({id:uid('ov'), on:true, date:todayISO(), facilityId:null, people:[], fill:false, note:''}, p||{}); }
function normalizeOverride(o){
  const x = newOverride(o);
  x.people = Array.isArray(x.people) ? [...new Set(x.people.filter(Boolean))] : [];
  x.fill = !!x.fill; x.on = x.on!==false;
  return x;
}

function isPeopleGoal(g){ return PEOPLE_GOALS.includes(g.type); }
function goalById(id){ return S().goals.find(g=>g.id===id); }
function overrideById(id){ return S().overrides.find(o=>o.id===id); }
function goalFacilities(g){ return schedulableFacilities().filter(f=>inScope(f, g.scope)); }
function activeOverrides(){ return S().overrides.filter(o=>o.on!==false && o.date && o.facilityId && facilityById(o.facilityId)); }
function overridesIn(start, end){ return activeOverrides().filter(o=>{ const d = ordOf(o.date); return d>=start && d<=end; }).sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0)); }
function liveIds(ids){ return (ids||[]).filter(id=>{ const p = personById(id); return p && !p.retired && p.active!==false; }); }

function visitsSince(f, sinceIso){
  if(!sinceIso) return f.visitCount||0;
  const dates = new Set((f.history||[]).map(h=>h && h.date).filter(d=>d && d>=sinceIso));
  if(f.lastVisit && f.lastVisit>=sinceIso) dates.add(f.lastVisit);
  return dates.size;
}
function coverState(g, since){
  const times = Math.max(1, g.times||1);
  const from = since===undefined ? g.since : since;
  const rows = goalFacilities(g).map(f=>({f, done:Math.min(times, visitsSince(f, from))}));
  const total = rows.length*times, done = sum(rows, r=>r.done);
  return {rows, times, total, done, remaining:total-done};
}
function countWorkdays(a, b){ let n = 0; for(let o=a;o<=b;o++) if(isWorkday(o)) n++; return n; }

function goalStatusLine(g){
  if(g.type==='cover'){ const st = coverState(g); return {done:st.done, total:st.total}; }
  if(g.type==='maxGap'){
    const t0 = todayOrd(), list = goalFacilities(g);
    const late = list.filter(f=>!f.lastVisit || t0-ordOf(f.lastVisit) > (g.days||0)).length;
    return {late, total:list.length};
  }
  if(g.type==='person') return {people:liveIds(g.people).length, total:goalFacilities(g).length};
  if(g.type==='together') return {ok:!!(g.a && g.b && g.a!==g.b)};
  if(g.type==='special') return {ok:!!facilityById(g.facilityId)};
  return {total:goalFacilities(g).length};
}

function specialWindow(g, win){
  const lo = Math.max(win.start, g.from ? ordOf(g.from) : win.start);
  const hi = Math.min(win.end, g.to ? ordOf(g.to) : win.end);
  return hi<lo ? null : {lo, hi};
}

function buildDemand(win, fixed){
  const items = new Map();
  const caps = [];
  const report = {};
  const diags = [];
  const specials = [];
  const preCount = new Map();
  const bump = id=>preCount.set(id, (preCount.get(id)||0)+1);
  for(const fx of fixed) bump(fx.f.id);
  const goals = S().goals.filter(g=>g.on);

  for(const g of goals.filter(g=>g.type==='special')){
    const f = facilityById(g.facilityId);
    const tier = g.strict==='must' ? 0 : 1;
    report[g.id] = {type:'special', target:0};
    if(!f){ diags.push({sev:'info', key:'dSpecialNoFacility', args:[goalTitle(g)]}); continue; }
    const w = specialWindow(g, win);
    if(!w) continue;
    const people = liveIds(g.people);
    if(people.length < (g.people||[]).length) diags.push({sev:'warn', key:'dSpecialPeopleGone', args:[goalTitle(g)]});
    for(let k=0;k<g.times;k++){ specials.push({g, f, kind:visitKindOf(f), people, auto:g.fill || !people.length, lo:w.lo, hi:w.hi, tier, copy:k}); bump(f.id); }
    report[g.id].target = g.times;
  }

  const scoreOf = f=>facilityScore(f, win.start).score;
  const byScore = (a,b)=>(!!b.pinned - !!a.pinned) || scoreOf(b)-scoreOf(a) || ((a.visitCount||0)-(b.visitCount||0));
  function want(f, need, tier, deadline, gid){
    if(need<=0) return;
    let it = items.get(f.id);
    if(!it){ it = {f, kind:facilityKind(f), need:0, tier:9, deadline:null, goals:new Set()}; items.set(f.id, it); }
    it.need = Math.max(it.need, need);
    it.tier = Math.min(it.tier, tier);
    if(deadline!=null) it.deadline = it.deadline==null ? deadline : Math.min(it.deadline, deadline);
    if(gid) it.goals.add(gid);
  }
  const P = S().period;
  if(P.goal==='coverage'){
    const times = Math.max(1, P.times||1);
    for(const f of schedulableFacilities().filter(f=>inScope(f, P.scope)).sort(byScore)) want(f, times-(preCount.get(f.id)||0), 0, null, 'period');
  }
  for(const f of schedulableFacilities()) if(f.pinned && !preCount.has(f.id)) want(f, 1, 1, null, 'pinned');
  const ordered = ['cover','maxGap','atLeast','atMost'].flatMap(type=>goals.filter(g=>g.type===type));
  const soonest = win.work.length ? win.work[Math.min(win.work.length-1, 4)] : win.start;
  const preIn = scope=>{ let n = 0; for(const [id, c] of preCount){ const f = facilityById(id); if(f && inScope(f, scope)) n += c; } return n; };
  for(const g of ordered){
    const tier = g.strict==='must' ? 0 : 1;
    if(g.type==='cover'){
      let st = coverState(g), rolled = false, since = g.since;
      if(st.total && st.remaining===0 && g.repeat){ since = isoOf(win.start); st = coverState(g, since); rolled = true; }
      const pending = st.rows.map(r=>({f:r.f, need:st.times - r.done - (preCount.get(r.f.id)||0)})).filter(r=>r.need>0);
      pending.sort((a,b)=>byScore(a.f, b.f));
      let quota = g.by ? sum(pending, r=>r.need) : 0, deadline = null, paced = false;
      if(g.by){
        const by = ordOf(g.by);
        if(by>=win.start && by<=win.end) deadline = by;
        else if(by>win.end){ const left = countWorkdays(win.start, by); quota = Math.ceil(quota * win.work.length / Math.max(1, left)); paced = true; }
      }
      const need = {};
      let acc = 0;
      for(const r of st.rows){ const n = st.times - r.done; if(n>0) need[r.f.id] = n; }
      for(const r of pending){
        if(acc<quota){ const take = Math.min(r.need, quota-acc); want(r.f, take, tier, deadline, g.id); acc += take; }
        else want(r.f, r.need, 2, null, g.id);
      }
      report[g.id] = {type:'cover', done:st.done, total:st.total, target:Math.min(sum(Object.values(need)), acc + preIn(g.scope)), need, paced, rolled, since, open:!g.by};
    } else if(g.type==='maxGap'){
      const due = {};
      for(const f of goalFacilities(g)){
        const last = f.lastVisit ? ordOf(f.lastVisit) : null;
        const dueOrd = last==null ? win.end : last + (g.days||0);
        if(dueOrd>win.end) continue;
        const dl = Math.max(dueOrd, soonest);
        due[f.id] = isoOf(dl);
        if(!preCount.has(f.id)) want(f, 1, tier, dl, g.id);
      }
      report[g.id] = {type:'maxGap', due, target:Object.keys(due).length};
    } else if(g.type==='atLeast'){
      const scope = goalFacilities(g);
      const have = preIn(g.scope);
      let left = Math.max(0, (g.n||0) - have);
      const pre = scope.filter(f=>items.has(f.id)).sort(byScore), rest = scope.filter(f=>!items.has(f.id)).sort(byScore);
      for(const f of pre.concat(rest)){
        if(left<=0) break;
        const it = items.get(f.id);
        const n = it ? Math.min(it.need, left) : 1;
        want(f, it ? it.need : 1, tier, null, g.id);
        left -= n;
      }
      if(left>0) diags.push({sev:g.strict==='must'?'warn':'info', key:'dGoalShortPool', args:[goalTitle(g), g.n, g.n-left]});
      report[g.id] = {type:'atLeast', target:g.n||0, have};
    } else if(g.type==='atMost'){
      const have = preIn(g.scope);
      caps.push({id:g.id, scope:g.scope, must:g.strict==='must', left:Math.max(0, (g.n||0) - have)});
      report[g.id] = {type:'atMost', target:g.n||0, have};
    }
  }

  for(const g of goals){
    if(g.type==='person'){
      report[g.id] = {type:'person'};
      if(!liveIds(g.people).length) continue;
      if(g.rel==='exactly' || g.rel==='atLeast'){
        for(const pid of liveIds(g.people)){
          const p = personById(pid);
          const avail = win.days.filter(o=>personAvailable(p, o)).length;
          if(avail < g.n) diags.push({sev:g.strict==='must'?'warn':'info', key:'dPersonFewDays', args:[p.name, g.n, avail]});
        }
      }
      if(g.rel==='only' && !goalFacilities(g).length) diags.push({sev:'warn', key:'dPersonEmptyScope', args:[goalTitle(g)]});
    } else if(g.type==='together'){
      report[g.id] = {type:'together'};
      if(g.a && g.b && g.a!==g.b && g.rel==='atLeast' && g.pct>0 && !togetherSeatsPossible(g)) diags.push({sev:'warn', key:'dTogetherNoSeats', args:[goalTitle(g)]});
    }
  }
  return {items, caps, report, diags, specials, preCount};
}

function personNames(ids){
  const names = (ids||[]).map(id=>(personById(id)||{}).name).filter(Boolean);
  if(!names.length) return '—';
  return names.length>2 ? names.slice(0,2).join('، ')+' +'+(names.length-2) : names.join('، ');
}
function goalTitle(g){
  const sc = scopeLabel(g.scope);
  if(g.type==='cover') return t('gtCoverT', sc, g.times||1);
  if(g.type==='atLeast') return t('gtAtLeastT', g.n||0, sc);
  if(g.type==='atMost') return t('gtAtMostT', g.n||0, sc);
  if(g.type==='maxGap') return t('gtMaxGapT', sc, g.days||0);
  if(g.type==='person') return t('gtPersonT', personNames(g.people), g.rel, g.n||0, g.scope && g.scope.kind!=='all' ? sc : '');
  if(g.type==='together') return t('gtTogetherT', personNames([g.a]), personNames([g.b]), g.rel, g.pct||0, g.scope && g.scope.kind!=='all' ? sc : '');
  if(g.type==='special'){ const f = facilityById(g.facilityId); return t('gtSpecialT', f ? f.name : '—', g.times||1); }
  return sc;
}
function scopeLabel(sc){
  if(!sc || sc.kind==='all') return t('gsAll');
  const ids = sc.ids||[];
  if(!ids.length) return '—';
  let names;
  if(sc.kind==='type') names = ids.map(kindLabel);
  else if(sc.kind==='category') names = ids.slice();
  else if(sc.kind==='location') names = ids.map(id=>(locationById(id)||{}).name||id);
  else names = ids.map(id=>(facilityById(id)||{}).name).filter(Boolean);
  if(names.length>2) return names.slice(0,2).join('، ')+' +'+(names.length-2);
  return names.join('، ');
}

function goalProgress(plan, T){
  const out = [];
  if(!plan) return out;
  T = T || planTally(plan);
  const rep = plan.goalReport || {};
  for(const g of S().goals){
    if(!g.on) continue;
    const r = rep[g.id];
    const row = {g, title:goalTitle(g), must:g.strict==='must'};
    if(!r){ row.state = 'new'; out.push(row); continue; }
    const inScopeVisits = plan.visits.filter(v=>{ const f = facilityById(v.facilityId); return f && inScope(f, g.scope); });
    if(g.type==='cover'){
      const per = new Map();
      for(const v of inScopeVisits) per.set(v.facilityId, (per.get(v.facilityId)||0)+1);
      let inPlan = 0;
      for(const fid in r.need) inPlan += Math.min(r.need[fid], per.get(fid)||0);
      row.done = r.done; row.inPlan = inPlan; row.total = r.total; row.target = r.target; row.paced = r.paced;
      row.met = r.open ? true : inPlan >= r.target;
      row.open = !!r.open;
      row.pct = r.total ? Math.round((r.done+inPlan)/r.total*100) : 100;
      row.label = (r.done+inPlan)+'/'+r.total;
    } else if(g.type==='maxGap'){
      const ids = Object.keys(r.due);
      let ok = 0;
      for(const fid of ids){ if(inScopeVisits.some(v=>v.facilityId===fid && v.date<=r.due[fid])) ok++; }
      row.inPlan = ok; row.target = ids.length; row.met = ok>=ids.length;
      row.pct = ids.length ? Math.round(ok/ids.length*100) : 100;
    } else if(g.type==='atLeast'){
      row.inPlan = inScopeVisits.length; row.target = r.target; row.met = row.inPlan>=r.target;
      row.pct = r.target ? Math.min(100, Math.round(row.inPlan/r.target*100)) : 100;
    } else if(g.type==='atMost'){
      row.inPlan = inScopeVisits.length; row.target = r.target; row.met = row.inPlan<=r.target;
      row.pct = row.met ? 100 : Math.round(r.target/Math.max(1,row.inPlan)*100);
    } else if(g.type==='person'){
      const ids = liveIds(g.people);
      if(g.rel==='never' || g.rel==='only'){
        let bad = 0;
        for(const v of plan.visits){ const f = facilityById(v.facilityId); if(!f) continue; for(const id of visitTeamIds(v)) if(ids.includes(id) && T.rules.deniedBy(id, f, g.id)) bad++; }
        row.met = bad===0; row.pct = row.met ? 100 : 0; row.label = bad ? t('gpBreaks', bad) : t('gpClean');
      } else {
        const ok = ids.filter(id=>{ const q = T.q[g.id+'|'+id]||0; return (g.rel==='atMost' || q>=g.n) && (g.rel==='atLeast' || q<=g.n); }).length;
        row.inPlan = ok; row.target = ids.length; row.met = ok===ids.length;
        row.pct = ids.length ? Math.round(ok/ids.length*100) : 100;
        row.label = ids.map(id=>(personById(id)||{}).name+' '+(T.q[g.id+'|'+id]||0)).join(' · ');
      }
    } else if(g.type==='together'){
      const rule = T.rules.together.find(x=>x.id===g.id);
      if(!rule){ row.state = 'new'; out.push(row); continue; }
      const st = togetherTarget(rule, T);
      row.met = st.met; row.pct = rule.rel==='atLeast' ? (rule.pct ? Math.min(100, Math.round(st.pct/rule.pct*100)) : 100) : (st.met ? 100 : Math.round(rule.pct/Math.max(1, st.pct)*100));
      row.label = t('gpTogether', st.both, st.base, st.pct);
    } else if(g.type==='special'){
      row.inPlan = plan.visits.filter(v=>v.why && v.why.special===g.id).length; row.target = r.target;
      row.met = row.inPlan>=r.target; row.pct = r.target ? Math.min(100, Math.round(row.inPlan/r.target*100)) : 100;
    }
    if(row.label==null) row.label = row.inPlan+'/'+row.target;
    row.state = row.open && row.pct<100 ? 'progress' : (row.met ? 'met' : 'short');
    out.push(row);
  }
  return out;
}

function overrideIssues(o){
  const out = [];
  if(!o.facilityId || !facilityById(o.facilityId)){ out.push({sev:'error', key:'ovNoFacility'}); return out; }
  if(!o.date){ out.push({sev:'error', key:'ovNoDate'}); return out; }
  const f = facilityById(o.facilityId);
  const ord = ordOf(o.date), iso = o.date;
  const kind = facilityKind(f);
  if(kind==='excluded' || f.excluded) out.push({sev:'info', key:'ovExcluded'});
  const cal = S().calendar;
  if(cal.holidays.includes(iso) || !(cal.workdays.includes(wdOf(ord)) || cal.extra.includes(iso))) out.push({sev:'info', key:'ovAddsDay'});
  const same = activeOverrides().filter(x=>x.id!==o.id && x.date===o.date);
  for(const pid of o.people){
    const p = personById(pid);
    if(!p){ out.push({sev:'warn', key:'ovGone'}); continue; }
    if(p.retired || p.active===false) out.push({sev:'warn', key:'ovInactive', args:[p.name]});
    else if(isOff(p, iso) || (p.avail && p.avail.mode!=='plan' && !personPatternOn(p, ord))) out.push({sev:'warn', key:'ovPersonOff', args:[p.name]});
    if((p.blocked||[]).includes(f.id)) out.push({sev:'warn', key:'ovPersonBlocked', args:[p.name]});
    if(same.some(x=>x.people.includes(pid))) out.push({sev:'error', key:'ovPersonTwice', args:[p.name]});
  }
  if(!o.people.length && !o.fill) out.push({sev:'info', key:'ovAutoTeam'});
  const k = kind==='excluded' ? 'basic' : kind;
  const n = teamSizeFor(k, f.category);
  if(o.people.length > n) out.push({sev:'info', key:'ovBigTeam', args:[o.people.length, n]});
  return out;
}
