const FACILITY_GOALS = ['cover','atLeast','atMost','maxGap'];
const PEOPLE_GOALS = ['person','together','separate','special','pattern'];
const GOAL_TYPES = FACILITY_GOALS.concat(PEOPLE_GOALS);
const TOGETHER_RELS = ['atLeast','atMost'];

function newGoal(type){
  const g = {id:uid('goal'), on:true, type, scope:{kind:'all', ids:[]}};
  if(type==='cover') Object.assign(g, {times:1, since:todayISO(), by:null, repeat:true, within:null});
  if(type==='atLeast') Object.assign(g, {n:4, repeat:false});
  if(type==='atMost') Object.assign(g, {n:2, scope:{kind:'category', ids:[]}});
  if(type==='maxGap') Object.assign(g, {days:60});
  if(type==='person') Object.assign(g, {people:[], rel:'between', n:1, n2:2, scope:{kind:'all', ids:[]}});
  if(type==='together') Object.assign(g, {a:null, b:null, rel:'atLeast', pct:50});
  if(type==='separate') Object.assign(g, {scope:{kind:'facility', ids:[]}, scope2:{kind:'facility', ids:[]}});
  if(type==='special') Object.assign(g, {facilityId:null, people:[], fill:true, times:1, from:null, to:null, seats:null, only:[], never:[], rules:null, guests:[], within:null});
  if(type==='pattern') Object.assign(g, {people:[], pattern:{minRest:1, maxRun:null, cycle:null}, from:null, to:null});
  g.lv = ruleSpec(GOAL_RULE[type]).def ? mkLv(ruleSpec(GOAL_RULE[type]).def.level, ruleSpec(GOAL_RULE[type]).def.w) : mkLv('prefer', 5);
  Object.defineProperty(g, 'strict', {get(){ return this.lv && this.lv.level==='must' ? 'must' : 'try'; }, set(v){ this.lv = mkLv(v==='must' ? 'must' : 'prefer', this.lv ? this.lv.w : 5); }, enumerable:false, configurable:true});
  return g;
}
function defaultGoals(){
  const cover = newGoal('cover'); cover.id = 'goal_cover';
  const gap = newGoal('maxGap'); gap.id = 'goal_gap'; gap.on = false; gap.days = 90; gap.scope = {kind:'type', ids:['basic']};
  return [cover, gap];
}
function normalizeGoal(g){
  const type = GOAL_TYPES.includes(g && g.type) ? g.type : 'cover';
  const base = newGoal(type);
  const out = Object.assign(base, g||{}, {type});
  out.scope = out.scope && out.scope.kind ? {kind:out.scope.kind, ids:Array.isArray(out.scope.ids) ? out.scope.ids.slice() : []} : {kind:'all', ids:[]};
  out.scope2 = out.scope2 && out.scope2.kind ? {kind:out.scope2.kind, ids:Array.isArray(out.scope2.ids) ? out.scope2.ids.slice() : []} : (type==='separate' ? {kind:'facility', ids:[]} : undefined);
  if(out.scope2===undefined) delete out.scope2;
  out.lv = normLv(out.lv, ruleSpec(goalRuleId(out)).def, ruleSpec(goalRuleId(out)));
  out.on = out.on!==false;
  const dflt = newGoal(type);
  if(type==='cover'){
    out.times = cleanInt(out.times, 1, 50, 1);
    out.since = cleanIso(out.since, null);
    out.by = cleanIso(out.by, null);
    out.within = cleanWithin(out.within);
    out.repeat = out.repeat!==false;
  }
  if(type==='atLeast'){ out.n = cleanInt(out.n, 0, 999, dflt.n); out.repeat = !!out.repeat; }
  if(type==='atMost') out.n = cleanInt(out.n, 0, 999, dflt.n);
  if(type==='maxGap') out.days = cleanInt(out.days, 1, 3650, dflt.days);
  if(type==='person'){
    out.people = Array.isArray(out.people) ? [...new Set(out.people.filter(Boolean))] : [];
    if(!PERSON_RELS.includes(out.rel)) out.rel = 'never';
    const sk = out.subject && out.subject.kind==='pool' ? 'pool' : 'people';
    out.subject = {kind:sk, ids:sk==='pool' && Array.isArray(out.subject.ids) ? [...new Set(out.subject.ids.filter(Boolean))] : []};
    out.n = cleanInt(out.n, 0, 999, dflt.n);
    out.n2 = Math.max(out.n, cleanInt(out.n2, 0, 999, out.n+1));
  }
  if(type==='together'){
    if(!TOGETHER_RELS.includes(out.rel)) out.rel = 'atLeast';
    out.pct = cleanInt(out.pct, 0, 100, dflt.pct);
  }
  if(type==='special'){
    out.people = Array.isArray(out.people) ? [...new Set(out.people.filter(Boolean))] : [];
    out.times = cleanInt(out.times, 1, 50, 1);
    out.fill = out.fill!==false;
    out.seats = cleanSeatMap(out.seats); out.only = cleanIdList(out.only); out.never = cleanIdList(out.never);
    out.rules = cleanVisitRules(out.rules); out.guests = cleanIdList(out.guests); out.dupChoice = ['merge', 'keep', 'reject'].includes(out.dupChoice) ? out.dupChoice : null;
    out.within = cleanWithin(out.within);
    out.from = cleanIso(out.from, null);
    out.to = cleanIso(out.to, null);
    if(out.from && out.to && out.from>out.to){ const x = out.from; out.from = out.to; out.to = x; }
  }
  if(type==='pattern'){
    out.people = Array.isArray(out.people) ? [...new Set(out.people.filter(Boolean))] : [];
    out.pattern = normalizePattern(out.pattern);
    out.from = cleanIso(out.from, null);
    out.to = cleanIso(out.to, null);
    if(out.from && out.to && out.from>out.to){ const x = out.from; out.from = out.to; out.to = x; }
  }
  return out;
}

function newOverride(p){ return Object.assign({id:uid('ov'), on:true, date:todayISO(), facilityId:null, people:[], fill:false, note:'', seats:null, only:[], never:[], rules:null, guests:[]}, p||{}); }
function cleanWithin(w){
  if(!w || typeof w!=='object') return null;
  const raw = Number(w.n);
  if(!Number.isFinite(raw) || raw<1) return null;
  const n = Math.min(366, Math.floor(raw));
  return {n, unit:['days','weeks','months'].includes(w.unit) ? w.unit : 'weeks'};
}

function withinEndOrd(startOrd, w){
  if(!w) return Infinity;
  if(w.unit==='days') return startOrd + w.n - 1;
  if(w.unit==='weeks') return startOrd + 7*w.n - 1;
  const d = new Date(isoOf(startOrd)+'T00:00:00Z');
  d.setUTCMonth(d.getUTCMonth() + w.n);
  return ordOf(d.toISOString().slice(0, 10)) - 1;
}

function coverByOrd(g, startOrd){
  const a = g.by ? ordOf(g.by) : Infinity, b = withinEndOrd(startOrd, g.within);
  const m = Math.min(a, b);
  return m===Infinity ? null : m;
}

function cleanVisitRules(r){
  if(!r || typeof r!=='object') return null;
  let gender = 'inherit';
  if(r.gender==='none') gender = 'none';
  else if(r.gender && typeof r.gender==='object') gender = {minEach:cleanInt(r.gender.minEach, 0, 50, 0), avoidEven:!!r.gender.avoidEven};
  const senior = r.senior==='on' || r.senior==='off' ? r.senior : 'inherit';
  return gender==='inherit' && senior==='inherit' ? null : {gender, senior};
}

function normalizeOverride(o){
  const x = newOverride(o);
  x.people = Array.isArray(x.people) ? [...new Set(x.people.filter(Boolean))] : [];
  x.fill = !!x.fill; x.on = x.on!==false;
  x.seats = cleanSeatMap(x.seats); x.only = cleanIdList(x.only); x.never = cleanIdList(x.never);
  x.rules = cleanVisitRules(x.rules); x.guests = cleanIdList(x.guests); x.dupChoice = ['merge', 'keep', 'reject'].includes(x.dupChoice) ? x.dupChoice : null;
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

function separateReady(g){
  const has = sc=>sc && sc.kind && sc.kind!=='all' && (sc.ids||[]).length>0;
  return has(g.scope) && has(g.scope2);
}

function goalStatusLine(g){
  if(g.type==='cover'){ const st = coverState(g); return {done:st.done, total:st.total}; }
  if(g.type==='maxGap'){
    const t0 = todayOrd(), list = goalFacilities(g);
    const late = list.filter(f=>!f.lastVisit || t0-ordOf(f.lastVisit) > (g.days||0)).length;
    return {late, total:list.length};
  }
  if(g.type==='person') return {people:goalPeople(g).length, total:goalFacilities(g).length};
  if(g.type==='together') return {ok:!!(g.a && g.b && g.a!==g.b)};
  if(g.type==='separate') return {ok:separateReady(g)};
  if(g.type==='special') return {ok:!!facilityById(g.facilityId)};
  if(g.type==='pattern') return {people:liveIds(g.people).length};
  return {total:goalFacilities(g).length};
}

function specialWindow(g, win){
  const lo = Math.max(win.start, g.from ? ordOf(g.from) : win.start);
  const hi = Math.min(win.end, g.to ? ordOf(g.to) : win.end, withinEndOrd(win.start, g.within));
  return hi<lo ? null : {lo, hi};
}


function specialRequests(win){
  const c = compileRequests(win);
  const list = [];
  for(const {r, copy} of requestCopies(c.list.filter(r=>r.source==='special')))
    list.push({g:r.ref, f:r.f, kind:r.kind, people:r.people, auto:r.auto, lo:r.window.lo, hi:r.window.hi, tier:r.tier, copy, request:r});
  return {list, diags:c.diags.filter(d=>d.key==='dSpecialNoFacility' || d.key==='dSpecialPeopleGone')};
}

function findDuplicateRequests(win){
  const lo0 = win ? win.start : -Infinity, hi0 = win ? win.end : Infinity;
  const items = [];
  for(const o of activeOverrides()){
    const d = ordOf(o.date);
    if(d<lo0 || d>hi0) continue;
    items.push({source:'fixed', refId:o.id, facilityId:o.facilityId, lo:d, hi:d});
  }
  for(const g of S().goals.filter(g=>g.on && g.type==='special' && g.facilityId && facilityById(g.facilityId))){
    const lo = Math.max(lo0, g.from ? ordOf(g.from) : -Infinity), hi = Math.min(hi0, g.to ? ordOf(g.to) : Infinity, win ? withinEndOrd(win.start, g.within) : Infinity);
    if(hi<lo) continue;
    items.push({source:'special', refId:g.id, facilityId:g.facilityId, lo, hi});
  }
  const byFac = new Map();
  for(const it of items){ if(!byFac.has(it.facilityId)) byFac.set(it.facilityId, []); byFac.get(it.facilityId).push(it); }
  const groups = [];
  for(const [facilityId, list] of byFac){
    if(list.length<2) continue;
    const parent = list.map((_, i)=>i);
    const find = i=>{ while(parent[i]!==i){ parent[i] = parent[parent[i]]; i = parent[i]; } return i; };
    for(let a=0;a<list.length;a++) for(let b=a+1;b<list.length;b++) if(list[a].lo<=list[b].hi && list[b].lo<=list[a].hi) parent[find(a)] = find(b);
    const comps = new Map();
    list.forEach((it, i)=>{ const r = find(i); if(!comps.has(r)) comps.set(r, []); comps.get(r).push(it); });
    for(const refs of comps.values()) if(refs.length>1) groups.push({facilityId, refs:refs.map(r=>({source:r.source, refId:r.refId, lo:r.lo, hi:r.hi}))});
  }
  return groups;
}

function buildDemand(win, fixed, placed){
  placed = placed || [];
  const obligations = [], caps = [], report = {}, diags = [], chains = [];
  const preferred = new Map();
  const pre = fixed.map(fx=>({f:fx.f, ord:fx.ord})).concat(placed.map(p=>({f:p.f, ord:p.ord})));
  const preCount = new Map();
  for(const x of pre) preCount.set(x.f.id, (preCount.get(x.f.id)||0)+1);
  const preAt = (f, lo, hi)=>pre.filter(x=>x.f.id===f.id && (lo==null || x.ord>=lo) && (hi==null || x.ord<=hi)).length;
  const preIn = scope=>pre.filter(x=>inScope(x.f, scope)).length;
  const goals = S().goals.filter(g=>g.on);
  const scoreOf = f=>facilityScore(f, win.start).score;
  const byScore = (a,b)=>(!!b.pinned - !!a.pinned) || scoreOf(b)-scoreOf(a) || ((a.visitCount||0)-(b.visitCount||0));
  const ob = (gid, f, strict, count, extra)=>{ if(count>0) obligations.push(Object.assign({gid, facilityId:f.id, strict, count, earliest:null, latest:null, kind:'', pooled:false, chain:false}, extra||{})); };
  const prefer = (f, gid)=>{ if(!preferred.has(f.id)) preferred.set(f.id, new Set()); preferred.get(f.id).add(gid); };

  const P = S().period;
  if(P.goal==='coverage'){
    const times = Math.max(1, P.times||1);
    for(const f of schedulableFacilities().filter(f=>inScope(f, P.scope)).sort(byScore)) ob('period', f, 'must', times-preAt(f), {kind:'period'});
  }
  for(const f of schedulableFacilities()) if(f.pinned && !preCount.has(f.id)) ob('pinned', f, 'try', 1, {kind:'pinned'});

  const ordered = ['cover','maxGap','atLeast','atMost'].flatMap(type=>goals.filter(g=>g.type===type));
  for(const g of ordered){
    if(g.type==='cover'){
      const times = Math.max(1, g.times||1);
      let since = g.since || null;
      const facs = goalFacilities(g);
      let base = f=>baselineVisits(f, since, win.start, null);
      let rolled = false;
      if(facs.length && facs.every(f=>base(f)>=times) && g.repeat){ since = isoOf(win.start); base = ()=>0; rolled = true; }
      const sinceOrd = since ? ordOf(since) : null;
      const pending = facs.map(f=>({f, need:times-Math.min(times, base(f))})).filter(r=>r.need>0).sort((a,b)=>byScore(a.f, b.f));
      report[g.id] = {type:'cover', rolled, since};
      const byOrd = coverByOrd(g, win.start);
      if(byOrd!=null){
        const by = byOrd;
        if(by>=win.start && by<=win.end){
          for(const r of pending) ob(g.id, r.f, goalStrict(g), r.need-preAt(r.f, sinceOrd, by), {kind:'cover', latest:by});
        } else if(by>win.end){
          const left = countWorkdays(win.start, by);
          const rest = pending.map(r=>({f:r.f, need:r.need-preAt(r.f, sinceOrd)})).filter(r=>r.need>0);
          const quota = Math.ceil(sum(rest, r=>r.need) * win.work.length / Math.max(1, left));
          let acc = 0;
          for(const r of rest){
            if(acc<quota){ const take = Math.min(r.need, quota-acc); ob(g.id, r.f, goalStrict(g), take, {kind:'cover'}); acc += take; if(take<r.need) prefer(r.f, g.id); }
            else prefer(r.f, g.id);
          }
          report[g.id].paced = true;
        } else {
          for(const r of pending) ob(g.id, r.f, goalStrict(g), r.need-preAt(r.f, sinceOrd), {kind:'cover'});
        }
      } else {
        for(const r of pending){
          const n = r.need-preAt(r.f, sinceOrd);
          if(n<=0) continue;
          if(goalMust(g)) ob(g.id, r.f, 'must', n, {kind:'cover', open:true});
          else { ob(g.id, r.f, goalStrict(g), n, {kind:'cover', open:true}); prefer(r.f, g.id); }
        }
        report[g.id].open = true;
      }
    } else if(g.type==='maxGap'){
      const days = Math.max(1, g.days||1);
      report[g.id] = {type:'maxGap'};
      for(const f of goalFacilities(g)){
        const last = lastVisitBefore(f, win.start);
        const sim = pre.filter(x=>x.f.id===f.id).map(x=>x.ord);
        chains.push({gid:g.id, f, days, strict:goalStrict(g), last});
        for(let i=0;i<400;i++){
          const need = chainNextNeed(last, sim, days, win.start, win.end);
          if(!need) break;
          ob(g.id, f, goalStrict(g), 1, {kind:'maxGap', chain:true, earliest:need.lo, latest:need.hi, first:need.first, early:need.early});
          sim.push(need.first ? win.start : need.hi);
        }
      }
    } else if(g.type==='atLeast'){
      const scope = goalFacilities(g);
      const preFacs = new Set(pre.filter(x=>inScope(x.f, g.scope)).map(x=>x.f.id));
      const have = g.repeat ? preIn(g.scope) : preFacs.size;
      let left = Math.max(0, (g.n||0) - have);
      const withOb = new Set(obligations.map(o=>o.facilityId));
      const open = scope.filter(f=>g.repeat || !preFacs.has(f.id));
      const shared = open.filter(f=>withOb.has(f.id)).sort(byScore), rest = open.filter(f=>!withOb.has(f.id)).sort(byScore);
      const order = shared.concat(rest);
      const limits = goals.filter(m=>m.type==='atMost');
      const obFacs = new Set(obligations.filter(o=>o.count>0).map(o=>o.facilityId));
      const room = new Map(limits.map(m=>[m.id, Math.max(0, (m.n||0) - preIn(m.scope)) - [...obFacs].filter(id=>inScope(facilityById(id), m.scope)).length]));
      const fits = f=>obFacs.has(f.id) || limits.every(m=>!inScope(f, m.scope) || room.get(m.id)>0);
      const taken = new Set();
      const take = f=>{
        ob(g.id, f, goalStrict(g), 1, {kind:'atLeast', pooled:true});
        left--; taken.add(f.id);
        if(!obFacs.has(f.id)){ obFacs.add(f.id); for(const m of limits) if(inScope(f, m.scope)) room.set(m.id, room.get(m.id)-1); }
      };
      for(const f of order){ if(left<=0) break; if(fits(f)) take(f); }
      for(const f of order){ if(left<=0) break; if(!taken.has(f.id)) take(f); }
      for(let round=1; g.repeat && left>0 && order.length && round<50; round++){
        for(const f of order){
          if(left<=0) break;
          ob(g.id, f, goalStrict(g), 1, {kind:'atLeast', pooled:true, copy:round});
          left--;
        }
      }
      if(left>0) diags.push({sev:goalMust(g)?'warn':'info', key:'dGoalShortPool', args:[goalTitle(g), g.n, g.n-left]});
      report[g.id] = {type:'atLeast', target:g.n||0};
    } else if(g.type==='atMost'){
      caps.push({id:g.id, scope:g.scope, must:goalMust(g), left:Math.max(0, (g.n||0) - preIn(g.scope))});
      report[g.id] = {type:'atMost', target:g.n||0};
    }
  }

  const byFac = new Map();
  for(const o of obligations) if(o.count>0){ if(!byFac.has(o.facilityId)) byFac.set(o.facilityId, []); byFac.get(o.facilityId).push(o); }
  const items = new Map();
  for(const [fid, list] of byFac){
    const f = facilityById(fid);
    const slots = [];
    const mk = o=>({strict:o.strict==='must', hardDl:null, softDl:null, earliest:null, goals:new Set(), chain:false, first:false, early:false});
    const fold = (s, o)=>{
      s.goals.add(o.gid);
      if(o.strict==='must') s.strict = true;
      if(o.latest!=null){
        if(o.strict==='must') s.hardDl = s.hardDl==null ? o.latest : Math.min(s.hardDl, o.latest);
        else s.softDl = s.softDl==null ? o.latest : Math.min(s.softDl, o.latest);
      }
      if(o.earliest!=null) s.earliest = s.earliest==null ? o.earliest : Math.max(s.earliest, o.earliest);
    };
    for(const o of list.filter(o=>o.chain).sort((a,b)=>a.latest-b.latest)){
      const s = mk(o); s.strict = false; s.chain = true; s.first = !!o.first; s.early = !!o.early;
      fold(s, o); slots.push(s);
    }
    const flat = list.filter(o=>!o.chain).sort((a,b)=>((b.strict==='must')-(a.strict==='must')) || ((a.latest==null)-(b.latest==null)) || ((a.latest||0)-(b.latest||0)));
    for(const o of flat) for(let k=0;k<o.count;k++){
      let s = slots[k];
      if(!s){ s = mk(o); s.strict = false; slots[k] = s; }
      fold(s, o);
    }
    for(const s of slots) s.tier = s.strict ? 0 : 1;
    items.set(fid, {f, kind:facilityKind(f), slots, need:slots.length, tier:Math.min(...slots.map(s=>s.tier)), goals:new Set([].concat(...slots.map(s=>[...s.goals])))});
  }

  for(const g of goals){
    if(g.type==='person'){
      report[g.id] = {type:'person'};
      if(!goalPeople(g).length) continue;
      if(g.rel==='exactly' || g.rel==='atLeast' || g.rel==='between'){
        for(const pid of goalPeople(g)){
          const p = personById(pid);
          const avail = win.days.filter(o=>personAvailable(p, o)).length;
          if(avail < g.n) diags.push({sev:goalMust(g)?'warn':'info', key:'dPersonFewDays', args:[p.name, g.n, avail]});
        }
      }
      if(g.rel==='only' && !goalFacilities(g).length) diags.push({sev:'warn', key:'dPersonEmptyScope', args:[goalTitle(g)]});
    } else if(g.type==='together'){
      report[g.id] = {type:'together'};
      if(g.a && g.b && g.a!==g.b && g.rel==='atLeast' && g.pct>0 && !togetherSeatsPossible(g)) diags.push({sev:'warn', key:'dTogetherNoSeats', args:[goalTitle(g)]});
    } else if(g.type==='separate'){
      report[g.id] = {type:'separate'};
    } else if(g.type==='special'){
      report[g.id] = {type:'special', target:g.times||1};
    } else if(g.type==='pattern'){
      report[g.id] = {type:'pattern'};
    }
  }
  return {items, caps, report, diags, preCount, obligations, chains, preferred};
}

function personNames(ids){
  const names = (ids||[]).map(id=>(personById(id)||{}).name).filter(Boolean);
  if(!names.length) return '—';
  return names.length>2 ? names.slice(0,2).join('، ')+' +'+(names.length-2) : names.join('، ');
}
function goalTitle(g){
  const base = goalTitleBase(g);
  return g.within && (g.type==='cover' || g.type==='special') ? base+' · '+t('gWithinTag', g.within.n, g.within.unit) : base;
}
function goalTitleBase(g){
  const sc = scopeLabel(g.scope);
  if(g.type==='cover') return t('gtCoverT', sc, g.times||1);
  if(g.type==='atLeast') return t('gtAtLeastT', g.n||0, sc);
  if(g.type==='atMost') return t('gtAtMostT', g.n||0, sc);
  if(g.type==='maxGap') return t('gtMaxGapT', sc, g.days||0);
  if(g.type==='person') return t('gtPersonT', goalSubjectLabel(g), g.rel, g.n||0, g.scope && g.scope.kind!=='all' ? sc : '', g.n2||0);
  if(g.type==='together') return t('gtTogetherT', personNames([g.a]), personNames([g.b]), g.rel, g.pct||0, g.scope && g.scope.kind!=='all' ? sc : '');
  if(g.type==='separate') return t('gtSeparateT', scopeLabel(g.scope), scopeLabel(g.scope2));
  if(g.type==='special'){ const f = facilityById(g.facilityId); return t('gtSpecialT', f ? f.name : '—', g.times||1); }
  if(g.type==='pattern') return t('gtPatternT', personNames(g.people), patternLabel(g.pattern));
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


function patternLabel(pt){
  if(!pt) return '—';
  const parts = [];
  if(pt.minRest>0) parts.push(t('patRestN', pt.minRest));
  if(pt.maxRun) parts.push(t('patRunN', pt.maxRun));
  if(pt.cycle) parts.push(t('patCycleN', pt.cycle.on, pt.cycle.off));
  return parts.length ? parts.join(' · ') : t('patNone');
}


function goalProgress(plan, T, opts){
  if(!plan) return [];
  const source = opts && opts.source==='snapshot' ? 'snapshot' : 'current';
  return validatePlan(plan, {source}).goals;
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
  const n = teamSizeFor(k, f);
  if(o.people.length > n) out.push({sev:'info', key:'ovBigTeam', args:[o.people.length, n]});
  return out;
}
