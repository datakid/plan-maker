const GOAL_TYPES = ['cover','atLeast','atMost','maxGap'];

function newGoal(type){
  const g = {id:uid('goal'), on:true, type, strict:'try', scope:{kind:'all', ids:[]}};
  if(type==='cover') Object.assign(g, {times:1, since:todayISO(), by:null, repeat:true});
  if(type==='atLeast') Object.assign(g, {n:4});
  if(type==='atMost') Object.assign(g, {n:2, strict:'must'});
  if(type==='maxGap') Object.assign(g, {days:60, strict:'must'});
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
  return out;
}
function newOverride(p){ return Object.assign({id:uid('ov'), on:true, date:todayISO(), facilityId:null, people:[], fill:false, note:''}, p||{}); }
function normalizeOverride(o){
  const x = newOverride(o);
  x.people = Array.isArray(x.people) ? [...new Set(x.people.filter(Boolean))] : [];
  x.fill = !!x.fill; x.on = x.on!==false;
  return x;
}

function goalById(id){ return S().goals.find(g=>g.id===id); }
function overrideById(id){ return S().overrides.find(o=>o.id===id); }
function goalFacilities(g){ return schedulableFacilities().filter(f=>inScope(f, g.scope)); }
function activeOverrides(){ return S().overrides.filter(o=>o.on!==false && o.date && o.facilityId && facilityById(o.facilityId)); }
function overridesIn(start, end){ return activeOverrides().filter(o=>{ const d = ordOf(o.date); return d>=start && d<=end; }).sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0)); }

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
  return {total:goalFacilities(g).length};
}

function buildDemand(win, fixed){
  const items = new Map();
  const caps = [];
  const report = {};
  const diags = [];
  const fixedCount = new Map();
  for(const fx of fixed) fixedCount.set(fx.facilityId, (fixedCount.get(fx.facilityId)||0)+1);
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
    for(const f of schedulableFacilities().filter(f=>inScope(f, P.scope)).sort(byScore)) want(f, times-(fixedCount.get(f.id)||0), 0, null, 'period');
  }
  for(const f of schedulableFacilities()) if(f.pinned && !fixedCount.has(f.id)) want(f, 1, 1, null, 'pinned');
  const goals = S().goals.filter(g=>g.on);
  const ordered = [...goals.filter(g=>g.type==='cover'), ...goals.filter(g=>g.type==='maxGap'), ...goals.filter(g=>g.type==='atLeast'), ...goals.filter(g=>g.type==='atMost')];
  const soonest = win.work.length ? win.work[Math.min(win.work.length-1, 4)] : win.start;
  for(const g of ordered){
    const tier = g.strict==='must' ? 0 : 1;
    if(g.type==='cover'){
      let st = coverState(g), rolled = false, since = g.since;
      if(st.total && st.remaining===0 && g.repeat){ since = isoOf(win.start); st = coverState(g, since); rolled = true; }
      const pending = st.rows.map(r=>({f:r.f, need:st.times - r.done - (fixedCount.get(r.f.id)||0)})).filter(r=>r.need>0);
      pending.sort((a,b)=>byScore(a.f, b.f));
      let quota = g.by ? sum(pending, r=>r.need) : 0, deadline = null, paced = false;
      if(g.by){
        const by = ordOf(g.by);
        if(by>=win.start && by<=win.end) deadline = by;
        else if(by>win.end){ const left = countWorkdays(win.start, by); quota = Math.ceil(quota * win.work.length / Math.max(1, left)); paced = true; }
      }
      const need = {};
      let acc = 0;
      for(const r of pending){
        need[r.f.id] = r.need;
        if(acc<quota){ const take = Math.min(r.need, quota-acc); want(r.f, take, tier, deadline, g.id); acc += take; }
        else want(r.f, r.need, 2, null, g.id);
      }
      report[g.id] = {type:'cover', done:st.done, total:st.total, target:Math.min(quota, acc), need, paced, rolled, since, open:!g.by};
    } else if(g.type==='maxGap'){
      const due = {};
      for(const f of goalFacilities(g)){
        if(fixedCount.has(f.id)) continue;
        const last = f.lastVisit ? ordOf(f.lastVisit) : null;
        const dueOrd = last==null ? win.end : last + (g.days||0);
        if(dueOrd>win.end) continue;
        const dl = Math.max(dueOrd, soonest);
        want(f, 1, tier, dl, g.id);
        due[f.id] = isoOf(dl);
      }
      report[g.id] = {type:'maxGap', due, target:Object.keys(due).length};
    } else if(g.type==='atLeast'){
      const scope = goalFacilities(g);
      const have = sum(fixed, fx=>{ const f = facilityById(fx.facilityId); return f && inScope(f, g.scope) ? 1 : 0; });
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
      const have = sum(fixed, fx=>{ const f = facilityById(fx.facilityId); return f && inScope(f, g.scope) ? 1 : 0; });
      caps.push({id:g.id, scope:g.scope, must:g.strict==='must', left:Math.max(0, (g.n||0) - have)});
      report[g.id] = {type:'atMost', target:g.n||0, have};
    }
  }
  return {items, caps, report, diags};
}

function goalTitle(g){
  const sc = scopeLabel(g.scope);
  if(g.type==='cover') return t('gtCoverT', sc, g.times||1);
  if(g.type==='atLeast') return t('gtAtLeastT', g.n||0, sc);
  if(g.type==='atMost') return t('gtAtMostT', g.n||0, sc);
  if(g.type==='maxGap') return t('gtMaxGapT', sc, g.days||0);
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

function goalProgress(plan){
  const out = [];
  if(!plan) return out;
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
