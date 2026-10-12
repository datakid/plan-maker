const CLS = {HARD:'hard', SOFT:'soft', EXC:'exception'};
const HISTORY_LOOKBACK = 30;

function mkViolation(o){
  return Object.assign({id:'', src:'', cls:CLS.HARD, group:'', people:[], facilities:[], dates:[], visits:[], actual:null, required:null, key:'', args:[], goal:null}, o);
}

function patternsCfg(){
  const p = S().patterns;
  return p || defaultPatterns();
}
function inWindowOrd(r, ord){
  if(r.from && ord<ordOf(r.from)) return false;
  if(r.to && ord>ordOf(r.to)) return false;
  return true;
}
function cycleOn(c, ord){
  if(!c) return true;
  const len = Math.max(1, (c.on||1)+(c.off||0));
  const anchor = c.anchor ? ordOf(c.anchor) : ord;
  const pos = (((ord-anchor)%len)+len)%len;
  return pos < (c.on||1);
}
function activityCfg(){ return patternsCfg().activity; }
function activityHard(){ const a = activityCfg(); return !!(a && a.on && a.strict==='must'); }
function activityDayAllowed(ord){
  const a = activityCfg();
  if(!a || !a.on || a.strict!=='must' || !a.pattern || !a.pattern.cycle) return true;
  return cycleOn(a.pattern.cycle, ord);
}
function activitySoftDayPenalty(ord){
  const a = activityCfg();
  if(!a || !a.on || a.strict==='must' || !a.pattern || !a.pattern.cycle) return 1;
  return cycleOn(a.pattern.cycle, ord) ? 1 : 0.35;
}

function effectivePersonPattern(p){
  const P = patternsCfg().person;
  const own = p.pattern || {mode:'inherit', minRest:0};
  const eff = {mode:own.mode, minRest:0, maxRun:null, cycle:null, hard:true, from:'person'};
  if(p.maxRun) eff.maxRun = p.maxRun;
  if(own.mode==='custom') eff.minRest = own.minRest||0;
  else if(own.mode==='inherit' && P && P.on && P.pattern){
    eff.minRest = P.pattern.minRest||0;
    if(eff.maxRun==null) eff.maxRun = P.pattern.maxRun||null;
    if(P.pattern.cycle && !(p.avail && p.avail.mode==='cycle')) eff.cycle = P.pattern.cycle;
    eff.hard = P.strict==='must';
    eff.from = 'default';
  }
  return eff;
}

function personPatternRules(p){
  const out = {hard:[], soft:[]};
  if(p.maxRun) out.hard.push({src:'person', minRest:0, maxRun:p.maxRun, from:null, to:null});
  const own = p.pattern || {mode:'inherit', minRest:0};
  if(own.mode==='custom' && own.minRest>0) out.hard.push({src:'person', minRest:own.minRest, maxRun:null, from:null, to:null});
  const P = patternsCfg().person;
  if(own.mode==='inherit' && P && P.on && P.pattern && (P.pattern.minRest>0 || (P.pattern.maxRun && !p.maxRun))){
    const r = {src:'default', minRest:P.pattern.minRest||0, maxRun:p.maxRun ? null : (P.pattern.maxRun||null), from:null, to:null};
    (P.strict==='must' ? out.hard : out.soft).push(r);
  }
  for(const g of S().goals){
    if(!g.on || g.type!=='pattern' || !(g.people||[]).includes(p.id) || !g.pattern) continue;
    if(!(g.pattern.minRest>0) && !g.pattern.maxRun) continue;
    (g.strict==='must' ? out.hard : out.soft).push({src:g.id, gid:g.id, minRest:g.pattern.minRest||0, maxRun:g.pattern.maxRun||null, from:g.from||null, to:g.to||null});
  }
  return out;
}

function patternCyclesAllow(p, ord){
  const e = effectivePersonPattern(p);
  if(e.cycle && e.hard && !cycleOn(e.cycle, ord)) return false;
  for(const g of S().goals){
    if(!g.on || g.type!=='pattern' || g.strict!=='must' || !g.pattern || !g.pattern.cycle) continue;
    if(!(g.people||[]).includes(p.id) || !inWindowOrd(g, ord)) continue;
    if(!cycleOn(g.pattern.cycle, ord)) return false;
  }
  return true;
}
function patternCycleSoftPenalty(p, ord){
  let m = 1;
  const e = effectivePersonPattern(p);
  if(e.cycle && !e.hard && !cycleOn(e.cycle, ord)) m *= 0.35;
  for(const g of S().goals){
    if(!g.on || g.type!=='pattern' || g.strict==='must' || !g.pattern || !g.pattern.cycle) continue;
    if(!(g.people||[]).includes(p.id) || !inWindowOrd(g, ord)) continue;
    if(!cycleOn(g.pattern.cycle, ord)) m *= 0.35;
  }
  return m;
}

function ruleBreaksOn(r, ds, ord){
  if(!ds || !(r.minRest>0 || r.maxRun)) return false;
  const lo = r.from ? ordOf(r.from) : -Infinity, hi = r.to ? ordOf(r.to) : Infinity;
  if(ord<lo || ord>hi) return false;
  const has = o=>o>=lo && o<=hi && ds.has(o);
  if(r.minRest>0){ for(let k=1;k<=r.minRest;k++) if(has(ord-k) || has(ord+k)) return 'rest'; }
  if(r.maxRun){
    let n = 1;
    for(let o=ord-1; has(o); o--) n++;
    for(let o=ord+1; has(o); o++) n++;
    if(n>r.maxRun) return 'run';
  }
  return false;
}

function ruleViolationsOn(r, sortedDates){
  const lo = r.from ? ordOf(r.from) : -Infinity, hi = r.to ? ordOf(r.to) : Infinity;
  const ds = sortedDates.filter(o=>o>=lo && o<=hi);
  const out = [];
  if(r.minRest>0){
    for(let i=1;i<ds.length;i++) if(ds[i]-ds[i-1]-1 < r.minRest) out.push({kind:'rest', a:ds[i-1], b:ds[i]});
  }
  if(r.maxRun){
    let run = 1;
    for(let i=1;i<ds.length;i++){
      run = ds[i]===ds[i-1]+1 ? run+1 : 1;
      if(run>r.maxRun){ out.push({kind:'run', a:ds[i-run+1], b:ds[i], n:run}); run = 1; }
    }
  }
  return out;
}

function nameIndex(){
  const m = new Map();
  for(const p of App.data.people) m.set(norm(p.name), p.id);
  const al = (App.data.aliases && App.data.aliases.people) || {};
  for(const k of Object.keys(al)) if(!m.has(k)) m.set(k, al[k]);
  return m;
}
function historyIndex(startOrd, lookback){
  lookback = lookback || HISTORY_LOOKBACK;
  const names = nameIndex();
  const map = new Map();
  let entries = 0, unresolved = 0;
  for(const f of App.data.facilities){
    for(const h of (f.history||[])){
      if(!h || !h.date) continue;
      const o = ordOf(h.date);
      if(!(o<startOrd && o>=startOrd-lookback)) continue;
      entries++;
      const team = h.team||[];
      if(!team.length){ unresolved++; continue; }
      for(const nm of team){
        const id = names.get(norm(nm));
        if(!id){ unresolved++; continue; }
        if(!map.has(id)) map.set(id, new Set());
        map.get(id).add(o);
      }
    }
  }
  return {map, entries, unresolved};
}
function seedHistory(ctx, startOrd){
  const H = historyIndex(startOrd);
  for(const [id, set] of H.map){
    const ds = ctx.dates[id] || (ctx.dates[id] = new Map());
    for(const o of set){
      ds.set(o, (ds.get(o)||0)+1);
      const wk = id+'|'+weekKey(o);
      ctx.week[wk] = (ctx.week[wk]||0)+1;
    }
  }
  ctx.history = H;
  return H;
}

function planFrame(plan){
  const start = plan.start ? ordOf(plan.start) : (plan.days && plan.days.length ? ordOf(plan.days[0]) : todayOrd());
  const end = plan.end ? ordOf(plan.end) : (plan.days && plan.days.length ? ordOf(plan.days[plan.days.length-1]) : start);
  const days = (plan.days||[]).map(ordOf);
  return {start, end, days, daySet:new Set(plan.days||[])};
}

function lastVisitBefore(f, startOrd){
  let best = null;
  const consider = iso=>{ if(!iso) return; const o = ordOf(iso); if(o<startOrd && (best==null || o>best)) best = o; };
  consider(f.lastVisit);
  for(const h of (f.history||[])) if(h) consider(h.date);
  return best;
}
function visitDatesBefore(f, startOrd){
  const s = new Set();
  const add = iso=>{ if(!iso) return; const o = ordOf(iso); if(o<startOrd) s.add(o); };
  add(f.lastVisit);
  for(const h of (f.history||[])) if(h) add(h.date);
  return s;
}
function baselineVisits(f, sinceIso, startOrd, plan){
  if(!sinceIso){
    const own = plan && plan.approved ? plan.visits.filter(v=>v.facilityId===f.id).length : 0;
    return Math.max(0, (f.visitCount||0) - own);
  }
  const lo = ordOf(sinceIso);
  let n = 0;
  for(const o of visitDatesBefore(f, startOrd)) if(o>=lo) n++;
  return n;
}

function eligibleDaysOf(days){
  return days.filter(o=>normalWorkday(o));
}

function visitLockInfo(v){
  const lock = Array.isArray(v.locked) ? v.locked : null;
  const exact = !!(v.fixed || v.special) && lock!=null && v.auto===false;
  return {lock, exact, fixed:!!v.fixed};
}

function isFixedLockedPerson(v, pid){
  return !!v.fixed && Array.isArray(v.locked) && v.locked.includes(pid);
}

function uniqIds(ids){ return [...new Set(ids)]; }
function seatTarget(f, kind){
  const m = {};
  for(const pl of S().pools) m[pl.id] = seatsFor(pl, kind, f.category);
  return m;
}
function isExemptLocked(v, pid){ return isFixedLockedPerson(v, pid); }

function planDayRules(){
  const out = [];
  const a = activityCfg();
  if(a && a.on && a.pattern && (a.pattern.minRest>0 || a.pattern.maxRun)){
    out.push({src:'activity', hard:a.strict==='must', minRest:a.pattern.minRest||0, maxRun:a.pattern.maxRun||null, group:'cCalendar'});
  }
  const sp = S().spacing;
  if(sp && sp.mode==='gap' && sp.gap>1) out.push({src:'spacing', hard:sp.strict==='must', minRest:sp.gap-1, maxRun:null, group:'cSpacing'});
  return out;
}

function workedMap(plan, fr){
  const m = new Map();
  for(const v of plan.visits){
    const f = facilityById(v.facilityId); if(!f) continue;
    const o = ordOf(v.date);
    for(const id of uniqIds(visitTeamIds(v))){
      if(!m.has(id)) m.set(id, new Map());
      const dm = m.get(id);
      if(!dm.has(o)) dm.set(o, []);
      dm.get(o).push(v);
    }
  }
  return m;
}

function chainEval(last, dates, days, startOrd, endOrd){
  const out = {noHistory:last==null, inherited:false, late:[], tail:null, none:false, due:null};
  let prev = last;
  let i = 0;
  if(last==null){
    if(!dates.length){ out.none = true; return out; }
    prev = dates[0]; i = 1;
  } else if(last + days < startOrd){
    out.inherited = true;
    if(!dates.length){ out.none = true; out.due = last + days; return out; }
    prev = dates[0]; i = 1;
  }
  for(; i<dates.length; i++){
    const d = dates[i];
    if(d - prev > days) out.late.push({prev, due:prev+days, visit:d});
    prev = d;
  }
  if(prev + days <= endOrd) out.tail = {prev, due:prev+days};
  return out;
}

function chainNextNeed(last, dates, days, startOrd, endOrd){
  let prev = last, i = 0;
  const sorted = dates.slice().sort((a,b)=>a-b);
  if(last==null){
    if(!sorted.length) return {lo:startOrd, hi:endOrd, first:true, early:false};
    prev = sorted[0]; i = 1;
  } else if(last + days < startOrd){
    if(!sorted.length) return {lo:startOrd, hi:endOrd, first:true, early:true};
    prev = sorted[0]; i = 1;
  }
  for(; i<sorted.length; i++){
    const d = sorted[i];
    if(d - prev > days) return {lo:Math.max(startOrd, prev+1), hi:prev+days, first:false, early:false};
    prev = d;
  }
  if(prev + days <= endOrd) return {lo:Math.max(startOrd, prev+1), hi:prev+days, first:false, early:false};
  return null;
}

function strictCls(g){ return g.strict==='must' ? CLS.HARD : CLS.SOFT; }

function evaluateGoals(plan, T, ctx){
  const rows = [], viols = [];
  const fr = ctx.fr;
  const startOrd = fr.start, endOrd = fr.end;
  const vis = ctx.vis.filter(x=>x.f);
  const requested = plan.requested!=null ? plan.requested : plan.visits.length;
  const visitsIn = scope=>vis.filter(x=>inScope(x.f, scope));
  const planWork = fr.days.filter(normalWorkday).length;
  for(const g of S().goals){
    if(!g.on) continue;
    const row = {g, title:goalTitle(g), must:g.strict==='must', state:'new', met:false, pct:0, label:'', inPlan:0, target:0};
    const viol = o=>{ viols.push(Object.assign({src:'goal', cls:strictCls(g), group:isPeopleGoal(g) ? 'cPeople' : 'cGoals', goal:g.id}, o)); };
    rows.push(row);
    if(g.type==='cover'){
      const facs = goalFacilities(g);
      const times = Math.max(1, g.times||1);
      let since = g.since || null;
      let base = f=>baselineVisits(f, since, startOrd, plan);
      let rolled = false;
      if(facs.length && facs.every(f=>base(f)>=times) && g.repeat){ since = isoOf(startOrd); rolled = true; base = ()=>0; }
      const sinceOrd = since ? ordOf(since) : -Infinity;
      const need = {}, covered = {};
      let remaining = 0, doneBase = 0;
      for(const f of facs){
        const b = Math.min(times, base(f));
        doneBase += b;
        const n = times - b;
        if(n>0){
          need[f.id] = n; remaining += n;
          covered[f.id] = Math.min(n, vis.filter(x=>x.f.id===f.id && x.ord>=sinceOrd).length);
        }
      }
      const inPlan = sum(Object.values(covered));
      const total = facs.length*times;
      let target = remaining, paced = false, open = !g.by, byOrd = null;
      const missing = [];
      if(g.by){
        byOrd = ordOf(g.by);
        if(byOrd>=startOrd && byOrd<=endOrd){
          let ok = 0;
          for(const fid in need){
            const c = Math.min(need[fid], vis.filter(x=>x.f.id===fid && x.ord>=sinceOrd && x.ord<=byOrd).length);
            ok += c;
            if(c<need[fid]) missing.push(fid);
          }
          row.inPlan = ok;
        } else if(byOrd>endOrd){
          const left = countWorkdays(startOrd, byOrd);
          target = Math.ceil(remaining * planWork / Math.max(1, left));
          paced = true; open = false;
        }
      } else target = Math.min(remaining, requested);
      if(!(byOrd!=null && byOrd>=startOrd && byOrd<=endOrd)) row.inPlan = inPlan;
      row.target = target; row.done = doneBase; row.total = total; row.paced = paced; row.open = !!open && !paced;
      row.rolled = rolled; row.since = since; row.remaining = remaining;
      row.complete = remaining===0 || inPlan>=remaining;
      row.met = row.inPlan>=target;
      row.pct = total ? Math.min(100, Math.round((doneBase+inPlan)/total*100)) : 100;
      row.label = (doneBase+inPlan)+'/'+total;
      if(!row.met) viol({key:'dCoverShort', actual:row.inPlan, required:target, facilities:missing, args:[row.title, row.inPlan, target]});
      row.state = row.open && !row.complete && g.strict!=='must' ? 'progress' : (row.met ? 'met' : 'short');
      if(row.open && row.met && !row.complete && g.strict==='must') row.ongoing = true;
    } else if(g.type==='maxGap'){
      const days = Math.max(1, g.days||1);
      const facs = goalFacilities(g);
      let ok = 0, noHistory = 0, inherited = 0, bad = 0;
      const detail = [];
      for(const f of facs){
        const last = lastVisitBefore(f, startOrd);
        const ds = [...new Set(vis.filter(x=>x.f.id===f.id).map(x=>x.ord))].sort((a,b)=>a-b);
        const ev = chainEval(last, ds, days, startOrd, endOrd);
        if(ev.noHistory) noHistory++;
        if(ev.inherited) inherited++;
        const fail = ev.none || ev.late.length>0 || !!ev.tail;
        const needsAny = ev.noHistory || ev.inherited || (last + days <= endOrd);
        if(!needsAny){ continue; }
        detail.push({fid:f.id, ev});
        if(fail){
          bad++;
          const key = ev.none ? (ev.noHistory ? 'dGapNone' : 'dGapOverdue') : (ev.late.length ? 'dGapLate' : 'dGapTail');
          const first = ev.late[0] || ev.tail;
          viol({key, facilities:[f.id], dates:first ? [isoOf(first.due)] : [], actual:first && first.visit!=null ? first.visit : null, required:first ? first.due : null, args:[f.name, first ? isoOf(first.due) : '—', first && first.visit!=null ? isoOf(first.visit) : '—']});
        } else ok++;
      }
      row.inPlan = ok; row.target = ok+bad; row.noHistory = noHistory; row.inherited = inherited; row.bad = bad; row.detail = detail;
      row.met = bad===0;
      row.pct = row.target ? Math.round(ok/row.target*100) : 100;
      row.label = ok+'/'+row.target;
      row.state = row.met ? 'met' : 'short';
    } else if(g.type==='atLeast'){
      const V = visitsIn(g.scope);
      const n = g.repeat ? V.length : new Set(V.map(x=>x.f.id)).size;
      row.inPlan = n; row.target = g.n||0; row.met = n>=row.target;
      row.pct = row.target ? Math.min(100, Math.round(n/row.target*100)) : 100;
      row.state = row.met ? 'met' : 'short';
      if(!row.met) viol({key:'dAtLeastShort', actual:n, required:row.target, args:[row.title, n, row.target]});
    } else if(g.type==='atMost'){
      const V = visitsIn(g.scope);
      row.inPlan = V.length; row.target = g.n||0; row.met = V.length<=row.target;
      row.pct = row.met ? 100 : Math.round(row.target/Math.max(1, V.length)*100);
      row.state = row.met ? 'met' : (g.strict==='must' ? 'short' : 'exceeded');
      if(!row.met){
        const fixedOnly = V.filter(x=>!x.v.fixed).length===0;
        viol({key:g.strict==='must' ? 'dCapMust' : 'dCapPref', cls:fixedOnly && g.strict==='must' ? CLS.EXC : strictCls(g), actual:V.length, required:row.target, visits:V.map(x=>x.v.id), args:[row.title, V.length, row.target]});
      }
    } else if(g.type==='special'){
      const f = facilityById(g.facilityId);
      if(!f){ row.state = 'new'; row.label = '—'; continue; }
      const people = liveIds(g.people);
      const lo = g.from ? ordOf(g.from) : -Infinity, hi = g.to ? ordOf(g.to) : Infinity;
      const q = vis.filter(x=>x.f.id===f.id && x.ord>=lo && x.ord<=hi && people.every(id=>x.ids.includes(id)));
      row.inPlan = q.length; row.target = Math.max(1, g.times||1);
      row.met = q.length>=row.target;
      row.pct = Math.min(100, Math.round(q.length/row.target*100));
      row.state = row.met ? 'met' : 'short';
      if(!row.met) viol({key:'dSpecialShort', actual:q.length, required:row.target, facilities:[f.id], args:[row.title, q.length, row.target]});
    } else if(g.type==='person'){
      const ids = liveIds(g.people);
      if(g.rel==='never' || g.rel==='only'){
        let bad = 0;
        const badVisits = [];
        for(const x of vis) for(const id of x.ids) if(ids.includes(id) && T.rules.deniedBy(id, x.f, g.id)){
          bad++; badVisits.push(x.v.id);
          const ex = isExemptLocked(x.v, id);
          viol({key:'dPersonRule', cls:ex ? CLS.EXC : strictCls(g), people:[id], facilities:[x.f.id], dates:[x.v.date], visits:[x.v.id], args:[(personById(id)||{}).name||'?', x.f.name]});
        }
        row.met = bad===0; row.pct = row.met ? 100 : 0; row.label = bad ? t('gpBreaks', bad) : t('gpClean');
        row.state = row.met ? 'met' : 'short';
        row.inPlan = ids.length-bad; row.target = ids.length;
      } else {
        const per = [];
        let okN = 0;
        for(const id of ids){
          const q = T.q[g.id+'|'+id]||0;
          const okp = (g.rel==='atMost' || q>=g.n) && (g.rel==='atLeast' || q<=g.n);
          per.push({id, q, ok:okp});
          if(okp) okN++;
          else {
            const over = g.rel!=='atLeast' && q>g.n;
            let cls = strictCls(g);
            if(over && cls===CLS.HARD){
              const ex = sum(vis.filter(x=>x.ids.includes(id) && isExemptLocked(x.v, id) && inScopeOpt(x.f, g.scope)), ()=>1);
              if(q-ex<=0) cls = CLS.EXC;
            }
            viol({key:'dQuotaPerson', cls, people:[id], actual:q, required:g.n, args:[(personById(id)||{}).name||'?', q, g.rel==='atLeast' ? '≥'+g.n : (g.rel==='atMost' ? '≤'+g.n : '='+g.n)]});
          }
        }
        row.per = per; row.inPlan = okN; row.target = ids.length; row.met = okN===ids.length;
        row.pct = ids.length ? Math.round(okN/ids.length*100) : 100;
        row.label = per.map(x=>(personById(x.id)||{}).name+' '+x.q+'/'+g.n).join(' · ');
        row.state = row.met ? 'met' : 'short';
      }
    } else if(g.type==='together'){
      const rule = T.rules.together.find(x=>x.id===g.id);
      if(!rule){ row.state = 'new'; continue; }
      const st = togetherTarget(rule, T);
      row.met = st.met;
      row.pct = rule.rel==='atLeast' ? (rule.pct ? Math.min(100, Math.round(st.pct/rule.pct*100)) : 100) : (st.met ? 100 : Math.round(rule.pct/Math.max(1, st.pct)*100));
      row.label = t('gpTogether', st.both, st.base, st.pct);
      row.state = row.met ? 'met' : 'short';
      row.inPlan = st.both; row.target = st.base;
      if(!row.met) viol({key:'dTogetherShort', people:[g.a, g.b], actual:st.pct, required:rule.pct, args:[row.title, st.pct, rule.pct]});
    } else if(g.type==='pattern'){
      const ids = liveIds(g.people);
      const per = [];
      let okN = 0;
      for(const id of ids){
        const dm = ctx.worked.get(id) || new Map();
        const dates = [...dm.keys()];
        for(const o of (ctx.history.map.get(id)||[])) dates.push(o);
        const sorted = [...new Set(dates)].sort((a,b)=>a-b);
        const r = {minRest:g.pattern.minRest||0, maxRun:g.pattern.maxRun||null, from:g.from||null, to:g.to||null};
        const vs = ruleViolationsOn(r, sorted).filter(x=>x.b>=startOrd);
        let cycleBad = 0;
        if(g.pattern.cycle) for(const o of dm.keys()) if(inWindowOrd(g, o) && !cycleOn(g.pattern.cycle, o)) cycleBad++;
        per.push({id, rest:vs.filter(x=>x.kind==='rest').length, run:vs.filter(x=>x.kind==='run').length, cycle:cycleBad});
        if(!vs.length && !cycleBad) okN++;
        else {
          for(const x of vs){
            const ex = (dm.get(x.a) ? dm.get(x.a).every(v=>isExemptLocked(v, id)) : false) && (dm.get(x.b) ? dm.get(x.b).every(v=>isExemptLocked(v, id)) : false);
            viol({key:x.kind==='rest' ? 'dRest' : 'dRun', group:x.kind==='rest' ? 'cRest' : 'cRun', cls:ex ? CLS.EXC : strictCls(g), people:[id], dates:[isoOf(x.a), isoOf(x.b)], args:[(personById(id)||{}).name||'?', isoOf(x.a), isoOf(x.b)]});
          }
          if(cycleBad) viol({key:'dPatternGoalCycle', group:'cRest', people:[id], args:[(personById(id)||{}).name||'?', cycleBad]});
        }
      }
      row.per = per; row.inPlan = okN; row.target = ids.length; row.met = okN===ids.length;
      row.pct = ids.length ? Math.round(okN/ids.length*100) : 100;
      row.label = okN+'/'+ids.length;
      row.state = row.met ? 'met' : 'short';
    }
    if(row.label==='' ) row.label = row.inPlan+'/'+row.target;
  }
  return {rows, viols};
}

function withGenSnapshot(plan, fn){
  const gen = plan && plan.gen;
  if(!gen || !gen.settings) return fn();
  const keepSettings = App.data.settings;
  const keepPeople = new Map();
  const keepFacs = new Map();
  try{
    App.data.settings = gen.settings;
    for(const p of App.data.people){
      const snap = gen.people && gen.people[p.id];
      if(!snap) continue;
      keepPeople.set(p.id, {});
      for(const k of Object.keys(snap)){ keepPeople.get(p.id)[k] = p[k]; p[k] = deepClone(snap[k]); }
    }
    for(const f of App.data.facilities){
      const snap = gen.facilities && gen.facilities[f.id];
      if(!snap) continue;
      keepFacs.set(f.id, {});
      for(const k of Object.keys(snap)){ keepFacs.get(f.id)[k] = f[k]; f[k] = deepClone(snap[k]); }
    }
    return fn();
  } finally {
    App.data.settings = keepSettings;
    for(const [id, o] of keepPeople){ const p = personById(id); if(p) Object.assign(p, o); }
    for(const [id, o] of keepFacs){ const f = facilityById(id); if(f) Object.assign(f, o); }
  }
}

const GEN_PERSON_FIELDS = ['pool','active','retired','avail','off','blocked','maxRun','maxPerWeek','quota','pattern','gender','skill','share'];
const GEN_FACILITY_FIELDS = ['weekdays','category','kindOverride','excluded','freq','importance','locationId'];
function genSnapshot(extra){
  const people = {}, facilities = {};
  for(const p of App.data.people){ people[p.id] = {}; for(const k of GEN_PERSON_FIELDS) people[p.id][k] = deepClone(p[k]); }
  for(const f of App.data.facilities){ facilities[f.id] = {}; for(const k of GEN_FACILITY_FIELDS) facilities[f.id][k] = deepClone(f[k]); }
  return Object.assign({rulesRev:RULES_REV, at:Date.now(), settings:deepClone(S()), people, facilities}, extra||{});
}

function validatePlan(plan, opts){
  opts = opts || {};
  if(plan && opts.source==='snapshot' && plan.gen && plan.gen.settings){
    const r = withGenSnapshot(plan, ()=>validatePlan(plan, Object.assign({}, opts, {source:'current'})));
    r.source = 'snapshot';
    for(const row of r.goals) row.source = 'snapshot';
    return r;
  }
  const out = {violations:[], notes:[], hard:0, soft:0, exceptions:0, valid:true, goals:[], tally:null, source:'current', days:null, spacing:null, byGroup:{}};
  if(!plan) return out;
  const set = S();
  const fr = planFrame(plan);
  const add = o=>{ const v = mkViolation(o); v.id = 'x'+out.violations.length; out.violations.push(v); return v; };
  const vis = (plan.visits||[]).map(v=>{
    const f = facilityById(v.facilityId);
    const ids = [];
    return {v, f, ord:ordOf(v.date), kind:f ? visitKindOf(f) : v.kind, ids};
  });
  const poolIds = new Set(set.pools.map(pl=>pl.id));
  const cap = (fixedFlag)=>fixedFlag ? CLS.EXC : CLS.HARD;

  for(const x of vis){
    const {v, f, ord} = x;
    if(!f){ add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dMissingFacility', visits:[v.id], dates:[v.date]}); continue; }
    const fixed = !!v.fixed;
    const team = v.team && typeof v.team==='object' ? v.team : {};
    const seen = new Set();
    const need = seatTarget(f, x.kind);
    const got = {};
    for(const pk of Object.keys(team)){
      const list = Array.isArray(team[pk]) ? team[pk] : [];
      if(!poolIds.has(pk) && list.length){ add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dTeamPoolUnknown', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]}); }
      for(const id of list){
        const p = personById(id);
        if(!p){ add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dTeamUnknown', visits:[v.id], dates:[v.date], facilities:[f.id], args:[String(id), f.name, v.date]}); continue; }
        if(seen.has(id)){ add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dTeamDup', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, f.name, v.date]}); continue; }
        seen.add(id);
        if(p.retired || p.active===false || !poolIds.has(p.pool)){ add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dTeamInactive', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, f.name, v.date]}); continue; }
        if(p.pool!==pk){ add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dTeamPool', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, f.name, v.date]}); }
        x.ids.push(id);
        got[p.pool] = (got[p.pool]||0)+1;
      }
    }
    const locked = Array.isArray(v.locked) ? v.locked : [];
    const strictSeats = v.auto!==false;
    let open = 0, over = 0;
    for(const pl of set.pools){
      const n = need[pl.id]||0, g = got[pl.id]||0;
      if(g<n && strictSeats) open += n-g;
      if(g>n) over += g-n;
    }
    x.open = open;
    if(open>0) add({src:'visit', cls:CLS.HARD, group:'cOpen', key:'dOpenSeats', visits:[v.id], dates:[v.date], facilities:[f.id], actual:sum(Object.values(got)), required:sum(Object.values(need)), args:[f.name, v.date, open]});
    if(over>0) add({src:'visit', cls:(fixed || v.auto===false) ? CLS.EXC : CLS.HARD, group:'cTeam', key:'dTeamOversize', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date, over]});
    for(const id of locked){
      const p = personById(id);
      if(!p || p.retired || p.active===false) continue;
      if(!x.ids.includes(id)) add({src:'visit', cls:CLS.HARD, group:'cTeam', key:'dLockedMissing', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, f.name, v.date]});
    }

    if(!fr.daySet.has(v.date)) add({src:'visit', cls:cap(fixed), group:'cCalendar', key:'dOutOfPlan', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
    else {
      const cal = set.calendar;
      const baseWork = !cal.holidays.includes(v.date) && (cal.extra.includes(v.date) || cal.workdays.includes(wdOf(ord)));
      if(!normalWorkday(ord)){
        if(baseWork && !activityDayAllowed(ord)) add({src:'visit', cls:cap(fixed), group:'cCalendar', key:'dActivityRest', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
        else add({src:'visit', cls:cap(fixed), group:'cCalendar', key:'dNotWorkday', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
      }
    }
    if(f.weekdays && f.weekdays.length && !f.weekdays.includes(wdOf(ord))) add({src:'visit', cls:cap(fixed), group:'cCalendar', key:'dWeekday', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
    const dc = dayCfg(ord);
    if(dc.only && dc.only.length && !dc.only.includes(f.category)) add({src:'visit', cls:cap(fixed), group:'cCalendar', key:'dDayOnly', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
    if(activitySoftDayPenalty(ord)<1) add({src:'visit', cls:CLS.SOFT, group:'cCalendar', key:'dActivityCycleSoft', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});

    const ids = x.ids;
    const g = teamGender(ids);
    const rule = genderRuleFor(f, x.kind), n = sum(Object.values(need));
    if(rule && g.u===0 && ids.length===n && !genderValid(rule, g.m, g.f, n)) add({src:'visit', cls:CLS.SOFT, group:'cGender', key:'dGender', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date, g.m, g.f]});
    const sen = set.seniority;
    if(sen.on && (f.importance||0) >= sen.threshold && ids.length){
      const qualified = id=>{ const p = personById(id); return p && skillOf(p, x.kind, f.category) >= (f.importance||0); };
      if(!ids.some(qualified)){
        const attainable = activePeople().some(p=>skillOf(p, x.kind, f.category) >= (f.importance||0) && personAvailable(p, ord) && !(p.blocked||[]).includes(f.id));
        if(sen.mode==='require'){
          const exempt = locked.length>0 && fixed;
          add({src:'visit', cls:(attainable && !exempt) ? CLS.HARD : CLS.EXC, group:'cSenior', key:attainable ? 'dSenior' : 'dSeniorNone', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
        } else add({src:'visit', cls:CLS.SOFT, group:'cSenior', key:'dSenior', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
      }
    }
    for(const r of set.pairs){
      if(!r.on || r.mode!=='rigid' || !r.a || !r.b || r.a===r.b) continue;
      const ha = ids.includes(r.a), hb = ids.includes(r.b);
      const broken = (r.type==='avoid' && ha && hb) || (r.type==='together' && ha!==hb);
      if(!broken) continue;
      const lockedPair = fixed && (locked.includes(r.a) || locked.includes(r.b));
      add({src:'visit', cls:lockedPair ? CLS.EXC : CLS.HARD, group:'cPairs', key:'dPair', people:[r.a, r.b], visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.date]});
    }
    if(v.late && v.why && v.why.deadline) add({src:'visit', cls:CLS.SOFT, group:'cGoals', key:'dLate', visits:[v.id], dates:[v.date], facilities:[f.id], args:[f.name, v.why.deadline]});
    for(const id of ids){
      const p = personById(id);
      const exempt = isExemptLocked(v, id);
      if(!p) continue;
      if(isOff(p, v.date) || !personBaseAvailable(p, ord)) add({src:'person', cls:exempt ? CLS.EXC : CLS.HARD, group:'cAvail', key:exempt ? 'dFixedOff' : 'dUnavailable', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, v.date]});
      else if(!patternCyclesAllow(p, ord)) add({src:'person', cls:exempt ? CLS.EXC : CLS.HARD, group:'cRest', key:'dPatternDay', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, v.date]});
      if((p.blocked||[]).includes(f.id)) add({src:'person', cls:exempt ? CLS.EXC : CLS.HARD, group:'cBlocked', key:exempt ? 'dFixedBlocked' : 'dBlocked', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, f.name]});
      const rb = set.repeatBlock;
      if(rb.on && !plan.approved && ((App.data.history.fpv||{})[f.id+'|'+id]||0) >= rb.times) add({src:'person', cls:exempt ? CLS.EXC : CLS.HARD, group:'cPeople', key:'dRepeatBlock', people:[id], visits:[v.id], dates:[v.date], facilities:[f.id], args:[p.name, f.name]});
    }
  }

  const byDate = groupBy(vis.filter(x=>x.f), x=>x.v.date);
  out.perDay = byDate;
  for(const [date, list] of byDate){
    const seen = new Map();
    for(const x of list) for(const id of uniqIds(x.ids)){
      if(seen.has(id)){
        const first = seen.get(id);
        const both = isExemptLocked(first, id) && isExemptLocked(x.v, id);
        add({src:'day', cls:both ? CLS.EXC : CLS.HARD, group:'cDup', key:'dDayDup', people:[id], visits:[first.id, x.v.id], dates:[date], args:[(personById(id)||{}).name||'?', date]});
      }
      else seen.set(id, x.v);
    }
    const facSeen = new Set();
    for(const x of list){ if(facSeen.has(x.f.id)) add({src:'day', cls:CLS.HARD, group:'cDup', key:'dFacDup', facilities:[x.f.id], visits:[x.v.id], dates:[date], args:[x.f.name, date]}); facSeen.add(x.f.id); }
    const ord = ordOf(date), dcap = dayCap(ord);
    if(list.length>dcap){
      const free = list.filter(x=>!x.v.fixed).length;
      add({src:'day', cls:free>0 ? CLS.HARD : CLS.EXC, group:'cCaps', key:'dCapDay', visits:list.map(x=>x.v.id), dates:[date], actual:list.length, required:dcap, args:[date, list.length, dcap]});
    }
  }
  if(set.volume.perWeek){
    const byWk = groupBy(vis.filter(x=>x.f), x=>weekKey(x.ord));
    for(const [wk, list] of byWk) if(list.length>set.volume.perWeek){
      const free = list.filter(x=>!x.v.fixed).length;
      add({src:'week', cls:free>0 ? CLS.HARD : CLS.EXC, group:'cCaps', key:'dCapWeek', visits:list.map(x=>x.v.id), dates:[isoOf(wk)], actual:list.length, required:set.volume.perWeek, args:[isoOf(wk), list.length, set.volume.perWeek]});
    }
  }

  const worked = workedMap(plan, fr);
  const H = historyIndex(fr.start);
  const hasRules = activePeople().some(p=>{ const r = personPatternRules(p); return r.hard.length || r.soft.length; });
  if(hasRules && H.unresolved>0) out.notes.push({key:'dHistoryUnresolved', args:[H.unresolved]});
  const ctxInfo = {fr, vis, worked, history:H};

  const dayDates = [...byDate.keys()].map(ordOf).sort((a,b)=>a-b);
  const dayVisitsOf = o=>byDate.get(isoOf(o)) || [];
  const dayRules = planDayRules();
  for(const r of dayRules){
    const vs = ruleViolationsOn({minRest:r.minRest, maxRun:r.maxRun}, dayDates);
    for(const x of vs){
      const fixedInvolved = [x.a, x.b].some(o=>dayVisitsOf(o).every(y=>y.v.fixed));
      const key = r.src==='spacing' ? 'dSpacing' : (x.kind==='rest' ? 'dActivityRest2' : 'dActivityRun');
      add({src:r.src, cls:fixedInvolved ? CLS.EXC : (r.hard ? CLS.HARD : CLS.SOFT), group:r.group, key, dates:[isoOf(x.a), isoOf(x.b)], actual:x.b-x.a, required:r.minRest+1, visits:[].concat(dayVisitsOf(x.a), dayVisitsOf(x.b)).map(y=>y.v.id), args:[isoOf(x.a), isoOf(x.b), x.b-x.a-1]});
    }
  }

  for(const p of activePeople()){
    const dm = worked.get(p.id) || new Map();
    const dates = [...dm.keys()];
    const histDates = H.map.get(p.id) ? [...H.map.get(p.id)] : [];
    const all = [...new Set(dates.concat(histDates))].sort((a,b)=>a-b);
    const rules = personPatternRules(p);
    const emit = (r, hard)=>{
      for(const x of ruleViolationsOn(r, all)){
        if(x.b<fr.start) continue;
        const ex = [x.a, x.b].every(o=>!dm.has(o) || dm.get(o).every(v=>isExemptLocked(v, p.id)));
        add({src:'person', cls:hard ? (ex ? CLS.EXC : CLS.HARD) : CLS.SOFT, group:x.kind==='rest' ? 'cRest' : 'cRun', key:x.kind==='rest' ? 'dRest' : 'dRun', people:[p.id], dates:[isoOf(x.a), isoOf(x.b)], goal:r.gid||null, visits:[].concat(dm.get(x.a)||[], dm.get(x.b)||[]).map(v=>v.id), args:[p.name, isoOf(x.a), isoOf(x.b), x.n||0]});
      }
    };
    for(const r of rules.hard) if(!r.gid) emit(r, true);
    for(const r of rules.soft) if(!r.gid) emit(r, false);
    if(p.maxPerWeek){
      const byWk = new Map();
      for(const o of dm.keys()) for(const v of dm.get(o)){ const k = weekKey(o); if(!byWk.has(k)) byWk.set(k, []); byWk.get(k).push({o, v}); }
      for(const [wk, list] of byWk) if(list.length>p.maxPerWeek){
        const free = list.filter(e=>!isExemptLocked(e.v, p.id)).length;
        add({src:'person', cls:free>0 ? CLS.HARD : CLS.EXC, group:'cWeek', key:'dWeek', people:[p.id], dates:[isoOf(wk)], visits:list.map(e=>e.v.id), actual:list.length, required:p.maxPerWeek, args:[p.name, list.length, p.maxPerWeek]});
      }
    }
    const e = effectivePersonPattern(p);
    if(e.cycle && !e.hard){
      for(const o of dm.keys()) if(!cycleOn(e.cycle, o)) add({src:'person', cls:CLS.SOFT, group:'cRest', key:'dPatternDaySoft', people:[p.id], dates:[isoOf(o)], args:[p.name, isoOf(o)]});
    }
  }

  const T = planTally(plan);
  out.tally = T;
  const exemptQ = {};
  for(const x of vis) if(x.f) for(const id of x.ids) if(isExemptLocked(x.v, id)) for(const r of T.rules.countsOf(id)) if(inScopeOpt(x.f, r.scope)) exemptQ[r.key] = (exemptQ[r.key]||0)+1;
  for(const r of T.rules.list){
    if(r.src!=='person') continue;
    const q = T.q[r.key]||0, p = personById(r.pid);
    const low = r.min!=null && q<r.min, high = r.max!=null && q>r.max;
    if(!low && !high) continue;
    let cls = r.must ? CLS.HARD : CLS.SOFT;
    if(high && !low && cls===CLS.HARD && q-(exemptQ[r.key]||0)<=0) cls = CLS.EXC;
    add({src:'person', cls, group:'cPeople', key:'dQuotaPerson', people:[r.pid], actual:q, required:low ? r.min : r.max, args:[p?p.name:'?', q, quotaLabel(r)]});
  }
  const ev = evaluateGoals(plan, T, ctxInfo);
  for(const o of ev.viols) add(o);
  out.goals = ev.rows;
  for(const row of out.goals) row.source = 'current';

  const eligible = fr.days.filter(normalWorkday);
  const requireDays = !!set.volume.requireEveryEligibleDay;
  const covered = [], uncovered = [];
  const badVisit = new Set();
  for(const v of out.violations) if(v.cls===CLS.HARD) for(const id of v.visits) badVisit.add(id);
  for(const o of eligible){
    const ok = dayVisitsOf(o).some(x=>x.open===0 && !badVisit.has(x.v.id));
    (ok ? covered : uncovered).push(o);
  }
  if(requireDays) for(const o of uncovered) add({src:'volume', cls:CLS.HARD, group:'cDays', key:'dEveryDay', dates:[isoOf(o)], args:[isoOf(o)]});
  out.days = {required:requireDays, eligible:eligible.length, covered:covered.length, uncovered:uncovered.map(isoOf), used:dayDates.length};

  for(const v of out.violations){
    if(v.cls===CLS.HARD) out.hard++; else if(v.cls===CLS.SOFT) out.soft++; else out.exceptions++;
    out.byGroup[v.group] = out.byGroup[v.group] || {hard:0, soft:0, exceptions:0};
    out.byGroup[v.group][v.cls==='hard' ? 'hard' : (v.cls==='soft' ? 'soft' : 'exceptions')]++;
  }
  out.valid = out.hard===0;
  out.vis = vis;
  return out;
}
