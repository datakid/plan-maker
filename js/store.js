const STORE_KEY = 'alkhitta.v5';
const PLAN_KEY = 'alkhitta.plan.v5';
const LEGACY_KEY = 'alkhitta.v4';
const SETTINGS_REV = 6;
const RULES_REV = 8;

const App = {
  data: null,
  plan: null,
  ui: {
    lang: 'ar', theme: 'auto', tab: 'plan', view: 'list', focusPerson: null,
    facSearch: '', facKind: 'all', facCategory: '', facLocation: '', facSort: 'overdue', facSelected: new Set(),
    teamShowRetired: false, calMonth: null
  },
  listeners: new Map(),
  undo: null
};

function locIdFor(name){ return 'loc_' + norm(name).replace(/\s+/g,'_'); }

function defaultSettings(){
  return {
    period: {goal:'range', preset:'month', start:null, end:null, scope:{kind:'all', ids:[]}, times:1},
    calendar: {workdays:[0,1,2,3,4], holidays:[], extra:[]},
    volume: {mode:'fill', share:0.6, exact:{basic:12, contracted:8}, quotas:{}, perDay:1, perWeek:null, requireEveryEligibleDay:false},
    goals: defaultGoals(),
    overrides: [],
    spacing: {mode:'even', gap:2, strict:'try'},
    patterns: defaultPatterns(),
    days: {},
    genderRules: [
      {id:'g_basic', on:true, kinds:['basic'], categories:[], facilities:[], minEach:25, avoidEven:true},
      {id:'g_contracted', on:false, kinds:['contracted'], categories:[], facilities:[], minEach:1, avoidEven:false}
    ],
    genderPrefs: {m:{on:false, dist:null, kind:null, days:[], strength:'medium'}, f:{on:false, dist:null, kind:null, days:[], strength:'medium'}},
    seniority: {on:true, threshold:60, mode:'require', match:0.3},
    fairness: {carry:true},
    rotation: {on:true, strength:0.35},
    repeatBlock: {on:false, times:3},
    distance: {nearKm:20, farKm:45, origin:'home', shortTrips:false, pickBias:null, balanceFar:false},
    pairs: [],
    pools: deepClone(SEED_POOLS)
  };
}

function defaultPattern(){ return {minRest:0, maxRun:null, cycle:null}; }
function defaultPatterns(){
  return {
    activity: {on:false, strict:'must', pattern:defaultPattern()},
    person: {on:false, strict:'must', pattern:defaultPattern()}
  };
}
function cleanInt(v, lo, hi, dflt){
  if(v==null || v==='' || typeof v==='boolean') return dflt;
  const n = +v;
  if(!isFinite(n)) return dflt;
  return clamp(Math.round(n), lo, hi);
}
function cleanNum(v, lo, hi, dflt){
  if(v==null || v==='' || typeof v==='boolean') return dflt;
  const n = +v;
  if(!isFinite(n)) return dflt;
  return clamp(n, lo, hi);
}
function cleanIso(v, dflt){
  if(v==null || v==='') return dflt===undefined ? null : dflt;
  const d = parseDate(v);
  return d || (dflt===undefined ? null : dflt);
}
function normalizeCycle(c){
  if(!c || typeof c!=='object') return null;
  return {on:cleanInt(c.on, 1, 60, 1), off:cleanInt(c.off, 0, 60, 1), anchor:cleanIso(c.anchor, todayISO())};
}
function normalizePattern(x){
  const out = defaultPattern();
  if(!x || typeof x!=='object') return out;
  out.minRest = cleanInt(x.minRest, 0, 60, 0);
  out.maxRun = x.maxRun==null || x.maxRun==='' ? null : cleanInt(x.maxRun, 1, 60, null);
  out.cycle = normalizeCycle(x.cycle);
  return out;
}
function normalizePatterns(x){
  const out = defaultPatterns();
  for(const k of ['activity','person']){
    const src = x && x[k];
    if(!src) continue;
    out[k].on = !!src.on;
    out[k].strict = src.strict==='try' ? 'try' : 'must';
    out[k].pattern = normalizePattern(src.pattern);
  }
  return out;
}
function normalizePersonPattern(x){
  const mode = x && (x.mode==='custom' || x.mode==='none') ? x.mode : 'inherit';
  return {mode, minRest:cleanInt(x && x.minRest, 0, 60, 0)};
}

function seedData(){
  const locations = Object.keys(SEED_LOCATIONS).map(name=>({id:locIdFor(name), name, km:SEED_LOCATIONS[name]}));
  const categories = Object.keys(SEED_CATEGORIES).map(name=>({name, kind:SEED_CATEGORIES[name]}));
  const facilities = SEED_FACILITIES.map((r,i)=>{
    const kind = SEED_CATEGORIES[r[1]] || 'excluded';
    const isSchool = /مدارس|مدرسة/.test(r[0]);
    return {
      id:'f_'+i, name:r[0], category:r[1], locationId:locIdFor(r[2]), kindOverride: isSchool ? 'excluded' : null,
      freq: SEED_LOW_FREQ.has(r[0]) ? 0.5 : (norm(r[0]).endsWith(norm('مسائي')) ? 0.35 : 1),
      importance: SEED_CRIT_HIGH.has(r[0]) ? 100 : (kind==='basic' ? 75 : 50),
      pinned:false, excluded:false, lastVisit:null, visitCount:0, history:[], weekdays:null, review:null
    };
  });
  const people = SEED_PEOPLE.map(p=>freshPerson(Object.assign({}, p, {origin: locIdFor(p.origin||'دمنهور')})));
  return {version:5, rev:SETTINGS_REV, rulesRev:RULES_REV, settings:defaultSettings(), locations, categories, facilities, people,
    history:{fpv:{}, counts:{}, lastCycle:0}, aliases:{people:{}}, unresolved:[]};
}

function freshPerson(p){
  const base = {
    id: uid('p'), name:'', pool:'fin', gender:null, title:null, retired:false, active:true,
    skill:{basic:50, contracted:50, byCategory:{}}, share:1, quota:{min:null, max:null}, origin:null, distPref:null,
    avail:{mode:'plan', weekdays:[0,1,2,3,4], cycle:{on:2, off:2, anchor:todayISO()}},
    maxRun:null, maxPerWeek:null, off:[], blocked:[], pattern:{mode:'inherit', minRest:0}, lv:null
  };
  const out = Object.assign(base, p||{});
  out.skill = Object.assign({basic:50, contracted:50, byCategory:{}}, (p&&p.skill)||{});
  out.avail = Object.assign({mode:'plan', weekdays:[0,1,2,3,4], cycle:{on:2, off:2, anchor:todayISO()}}, (p&&p.avail)||{});
  out.avail.cycle = Object.assign({on:2, off:2, anchor:todayISO()}, out.avail.cycle||{});
  out.quota = normalizeQuota(p && p.quota, p && p.fixed);
  out.skill.basic = cleanNum(out.skill.basic, 0, 100, 50);
  out.skill.contracted = cleanNum(out.skill.contracted, 0, 100, 50);
  if(!out.skill.byCategory || typeof out.skill.byCategory!=='object') out.skill.byCategory = {};
  for(const k of Object.keys(out.skill.byCategory)) out.skill.byCategory[k] = cleanNum(out.skill.byCategory[k], 0, 100, 50);
  out.share = cleanNum(out.share, 0, 5, 1);
  out.avail.cycle.on = cleanInt(out.avail.cycle.on, 1, 60, 2);
  out.avail.cycle.off = cleanInt(out.avail.cycle.off, 0, 60, 2);
  out.maxRun = out.maxRun==null || out.maxRun==='' ? null : cleanInt(out.maxRun, 1, 60, null);
  out.maxPerWeek = out.maxPerWeek==null || out.maxPerWeek==='' ? null : cleanInt(out.maxPerWeek, 1, 60, null);
  out.pattern = normalizePersonPattern(out.pattern);
  out.lv = out.lv ? normalizePersonLv(out.lv) : null;
  delete out.fixed;
  return out;
}
function normalizeQuota(q, legacyFixed){
  const num = v=>v==null || v==='' || !isFinite(+v) ? null : Math.max(0, Math.round(+v));
  if((!q || (q.min==null && q.max==null)) && legacyFixed!=null && isFinite(+legacyFixed)) return {min:num(legacyFixed), max:num(legacyFixed)};
  let min = num(q && q.min), max = num(q && q.max);
  if(min!=null && max!=null && min>max) max = min;
  return {min, max};
}

function migrateV4(raw){
  const d = seedData();
  const s = raw.settings || {};
  if(Array.isArray(raw.locations) && raw.locations.length) d.locations = raw.locations.map(l=>({id:l.id, name:l.name, km:+l.km||0}));
  const catKinds = new Map(d.categories.map(c=>[c.name, c.kind]));
  if(Array.isArray(raw.facilities) && raw.facilities.length){
    d.facilities = raw.facilities.map(f=>{
      if(f.category && !catKinds.has(f.category)) catKinds.set(f.category, f.kind==='basic'||f.kind==='contracted' ? f.kind : 'excluded');
      const derived = catKinds.get(f.category) || 'excluded';
      return {
        id:f.id, name:f.name, category:f.category||'', locationId:f.locationId || (f.location ? locIdFor(f.location) : null),
        kindOverride: f.kind && f.kind!==derived ? f.kind : null,
        freq: typeof f.weight==='number' && isFinite(f.weight) ? f.weight : 1,
        importance: f.crit==null ? 50 : clamp(+f.crit, 0, 100),
        pinned:!!f.pinned, excluded:!!f.manualExcluded, lastVisit:f.lastVisit||null, visitCount:f.visitCount||0,
        history:(f.visitHistory||[]).filter(v=>v && v.date).map(v=>({date:parseDate(v.date)||v.date, team:v.team||[]})),
        weekdays:f.visitWeekdays||null, review:f.reviewFlag||null
      };
    });
    d.categories = [...catKinds].map(([name, kind])=>({name, kind}));
  }
  const poolsRaw = Array.isArray(s.pools) && s.pools.length ? s.pools : null;
  if(poolsRaw){
    d.settings.pools = poolsRaw.filter(p=>p && p.id && p.id!=='retired').map(p=>{
      const seed = SEED_POOLS.find(x=>x.id===p.id);
      return {id:p.id, name:p.name || (seed?seed.name:p.id), nameEn: seed?seed.nameEn:(p.name||p.id), seats:{basic:p.seats?+p.seats.basic:1, contracted:p.seats?+p.seats.contracted:1}, byCategory:p.byCategory||{}};
    });
  }
  const firstPool = d.settings.pools[0].id;
  if(Array.isArray(raw.people) && raw.people.length){
    const seedById = new Map(SEED_PEOPLE.map(p=>[p.id, p]));
    d.people = raw.people.map(p=>{
      const retired = p.pool==='retired';
      const seed = seedById.get(p.id);
      const pool = retired ? (seed ? seed.pool : firstPool) : (d.settings.pools.some(x=>x.id===p.pool) ? p.pool : firstPool);
      const rb = p.rankBasic!=null ? p.rankBasic : (p.rank!=null ? p.rank : 50);
      const rc = p.rankContracted!=null ? p.rankContracted : (p.rank!=null ? p.rank : 50);
      return freshPerson({
        id:p.id, name:p.name, pool, gender: p.gender==='m'||p.gender==='f' ? p.gender : null, title:p.title||null,
        retired, active: p.active!==false, skill:{basic:rb, contracted:rc, byCategory:{}},
        share: typeof p.weight==='number' && p.weight>0 ? p.weight : 1, fixed: p.fixedCount!=null ? p.fixedCount : null,
        origin: p.originLocationId || locIdFor('دمنهور'),
        distPref: p.distanceAffinity>0 ? 'far' : (p.distanceAffinity<0 ? 'near' : null),
        avail: Array.isArray(p.workWeekdays) ? {mode:'weekdays', weekdays:p.workWeekdays} : {mode:'plan'},
        off: Array.isArray(p.off) ? p.off : [], blocked: Array.isArray(p.blockedFacilities) ? p.blockedFacilities : []
      });
    });
  }
  const st = d.settings;
  if(Array.isArray(s.weekdays)) st.calendar.workdays = s.weekdays.slice();
  if(Array.isArray(s.holidays)) st.calendar.holidays = s.holidays.slice();
  if(Array.isArray(s.exceptions)) st.calendar.extra = s.exceptions.slice();
  if(s.range) st.period.preset = s.range;
  if(s.customStart) st.period.start = s.customStart;
  if(s.customEnd) st.period.end = s.customEnd;
  if(s.goal && s.goal.mode==='coverage'){ st.period.goal='coverage'; st.period.scope = s.goal.scope||{kind:'all',ids:[]}; st.period.times = s.goal.times||1; if(s.goal.start) st.period.start = s.goal.start; }
  if(s.ratioP!=null) st.volume.share = s.ratioP;
  if(s.maxVisitsPerDay) st.volume.perDay = s.maxVisitsPerDay;
  const vb = s.visitBudget||{};
  if(vb.perWeek) st.volume.perWeek = vb.perWeek;
  if(vb.kind==='total'){ st.volume.mode='exact'; st.volume.exact = {basic:s.countsM||0, contracted:s.countsR||0}; }
  if(vb.kind==='quota'){ st.volume.mode='quota'; st.volume.quotas = vb.quotas||{}; }
  if(vb.spread==='front') st.spacing.mode = 'pack';
  else if(s.cadence && s.cadence.mode && s.cadence.mode!=='off'){ st.spacing.mode='gap'; st.spacing.gap = s.cadence.gapDays||2; }
  if(s.genderRule){
    const map = v=> v==='31' ? {on:true, minEach:25, avoidEven:true} : (v==='mixed' ? {on:true, minEach:1, avoidEven:false} : {on:false});
    Object.assign(st.genderRules[0], map(s.genderRule.basic||'off'));
    Object.assign(st.genderRules[1], map(s.genderRule.contracted||'off'));
  }
  if(s.familiarityGamma!=null){ st.rotation.on = s.familiarityGamma>0; if(s.familiarityGamma>0) st.rotation.strength = s.familiarityGamma; }
  if(s.hardBlockOverTied){ st.repeatBlock.on = true; st.repeatBlock.times = s.overTieMinVisits||3; }
  if(s.originMode){ st.distance.origin = s.originMode==='ignore' ? 'hq' : 'home'; st.distance.shortTrips = s.originMode==='favor'; }
  if(s.globalDistanceBias) st.distance.pickBias = s.globalDistanceBias>0 ? 'far' : 'near';
  if(s.critMode) st.seniority.mode = s.critMode==='prefer' ? 'prefer' : 'require';
  if(Array.isArray(s.pairRules)) st.pairs = s.pairRules.map(r=>({id:r.id||uid('pr'), a:r.a, b:r.b, type:r.type==='together'?'together':'avoid', mode:r.mode==='rigid'?'rigid':'flexible', strength:r.strength||'medium', on:true}));
  const ov = s.dayOverrides||{};
  for(const k of Object.keys(ov)){
    const o = ov[k]||{};
    st.days[k] = normalizeDay({cap:o.visitCap||null, lean:o.kindLean>0?'basic':(o.kindLean<0?'contracted':null), dist:o.distLean>0?'far':(o.distLean<0?'near':null), favor:o.favorCategory||null, only:o.restrictTo||null});
  }
  const h = raw.history||{};
  d.history.fpv = h.facilityPersonVisits||{};
  d.history.lastCycle = h.lastCycleNumber||0;
  const counts = {};
  for(const pid of Object.keys(h.initialCounts||{})){ const m = h.initialCounts[pid]||{}; for(const id in m) counts[id] = (counts[id]||0)+(+m[id]||0); }
  d.history.counts = counts;
  d.aliases = {people:(raw.aliases&&raw.aliases.people)||{}};
  d.unresolved = Array.isArray(raw.unresolvedNames) ? raw.unresolvedNames : [];
  return d;
}

function normalizeData(d){
  const fresh = defaultSettings();
  d.settings = Object.assign(defaultSettings(), d.settings||{});
  for(const k of ['period','calendar','volume','spacing','seniority','fairness','rotation','repeatBlock','distance']) d.settings[k] = Object.assign(fresh[k], d.settings[k]||{});
  d.settings.volume.exact = Object.assign({basic:0, contracted:0}, d.settings.volume.exact||{});
  d.settings.volume.exact.basic = cleanInt(d.settings.volume.exact.basic, 0, 500, 0);
  d.settings.volume.exact.contracted = cleanInt(d.settings.volume.exact.contracted, 0, 500, 0);
  d.settings.volume.share = cleanNum(d.settings.volume.share, 0, 1, 0.6);
  d.settings.distance.nearKm = cleanNum(d.settings.distance.nearKm, 0, 2000, 20);
  d.settings.distance.farKm = Math.max(d.settings.distance.nearKm, cleanNum(d.settings.distance.farKm, 0, 2000, 45));
  d.settings.volume.perDay = cleanInt(d.settings.volume.perDay, 1, 10, 1);
  d.settings.volume.perWeek = d.settings.volume.perWeek==null || d.settings.volume.perWeek==='' ? null : cleanInt(d.settings.volume.perWeek, 1, 60, null);
  d.settings.volume.requireEveryEligibleDay = !!d.settings.volume.requireEveryEligibleDay;
  d.settings.volume.quotas = d.settings.volume.quotas || {};
  d.settings.spacing.strict = d.settings.spacing.strict==='must' ? 'must' : 'try';
  d.settings.spacing.gap = cleanInt(d.settings.spacing.gap, 2, 30, 2);
  d.settings.patterns = normalizePatterns(d.settings.patterns);
  d.settings.period.scope = d.settings.period.scope || {kind:'all', ids:[]};
  if(!Array.isArray(d.settings.pools) || !d.settings.pools.length) d.settings.pools = deepClone(SEED_POOLS);
  d.settings.days = d.settings.days || {};
  d.settings.genderRules = Array.isArray(d.settings.genderRules) ? d.settings.genderRules : [];
  d.settings.pairs = Array.isArray(d.settings.pairs) ? d.settings.pairs : [];
  d.settings.goals = Array.isArray(d.settings.goals) ? d.settings.goals.map(normalizeGoal) : defaultGoals();
  d.settings.overrides = Array.isArray(d.settings.overrides) ? d.settings.overrides.map(normalizeOverride) : [];
  if((d.rev||0) < SETTINGS_REV){
    d.settings.calendar.workdays = [0,1,2,3,4];
    d.settings.volume.share = 0.6;
    if(!d.settings.goals.length) d.settings.goals = defaultGoals();
    d.rev = SETTINGS_REV;
  }
  if((d.rulesRev||0) < 7) migrateRules(d);
  d.rulesRev = RULES_REV;
  const gp = d.settings.genderPrefs || {};
  d.settings.genderPrefs = {m:Object.assign(fresh.genderPrefs.m, gp.m||{}), f:Object.assign(fresh.genderPrefs.f, gp.f||{})};
  d.locations = d.locations||[]; d.categories = d.categories||[]; d.facilities = d.facilities||[];
  d.people = (d.people||[]).map(freshPerson);
  migrateLv(d);
  const ids = new Set(d.people.map(p=>p.id));
  for(const g of d.settings.goals){
    if(Array.isArray(g.people)) g.people = g.people.filter(id=>ids.has(id));
    if(g.a && !ids.has(g.a)) g.a = null;
    if(g.b && !ids.has(g.b)) g.b = null;
  }
  d.history = Object.assign({fpv:{}, counts:{}, lastCycle:0}, d.history||{});
  d.aliases = d.aliases || {people:{}};
  d.unresolved = d.unresolved || [];
  const known = new Set(d.categories.map(c=>c.name));
  for(const f of d.facilities) if(f.category && !known.has(f.category)){ d.categories.push({name:f.category, kind:'excluded'}); known.add(f.category); }
  const locIds = new Set(d.locations.map(l=>l.id));
  for(const f of d.facilities) if(f.locationId && !locIds.has(f.locationId)){ d.locations.push({id:f.locationId, name:f.locationId.replace(/^loc_/,'').replace(/_/g,' '), km:0}); locIds.add(f.locationId); }
  return d;
}

function migrateRules(d){
  const sp = d.settings.spacing;
  sp.strict = 'try';
  d.settings.volume.requireEveryEligibleDay = false;
  d.settings.patterns = normalizePatterns(d.settings.patterns);
  for(const p of d.people) p.pattern = normalizePersonPattern(p.pattern);
}

let saveTimer = null, saveFailed = false;
function saveNow(){
  try{ localStorage.setItem(STORE_KEY, JSON.stringify(App.data)); saveFailed = false; }
  catch(e){ if(!saveFailed) toast(t('storageFull')); saveFailed = true; }
}
function save(){ clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 200); }
function savePlan(){
  try{ if(App.plan) localStorage.setItem(PLAN_KEY, JSON.stringify(App.plan)); else localStorage.removeItem(PLAN_KEY); }
  catch(e){ toast(t('storageFull')); }
}
function loadAll(){
  let data = null;
  try{ const raw = localStorage.getItem(STORE_KEY); if(raw) data = JSON.parse(raw); }catch(e){ data = null; }
  if(!data){
    try{ const raw = localStorage.getItem(LEGACY_KEY); if(raw){ data = migrateV4(JSON.parse(raw)); App.migrated = true; } }catch(e){ data = null; }
  }
  if(!data) data = seedData();
  App.data = normalizeData(data);
  try{ const p = localStorage.getItem(PLAN_KEY); App.plan = p ? JSON.parse(p) : null; }catch(e){ App.plan = null; }
  if(App.plan && !Array.isArray(App.plan.visits)) App.plan = null;
  if(App.plan && !App.plan.approved && !(App.plan.gen && App.plan.gen.rulesRev>=RULES_REV)) App.plan.stale = true;
  saveNow();
}

function on(topic, fn){ if(!App.listeners.has(topic)) App.listeners.set(topic, new Set()); App.listeners.get(topic).add(fn); return ()=>App.listeners.get(topic).delete(fn); }
function emit(topic){ for(const tp of [topic, '*']) for(const fn of (App.listeners.get(tp)||[])) fn(topic); }
function commit(topic, opts){
  save();
  if(!(opts && opts.keepPlan) && App.plan && !App.plan.approved && !App.plan.stale){ App.plan.stale = true; savePlan(); emit('plan'); }
  emit(topic||'data');
}

const S = ()=>App.data.settings;
function poolById(id){ return S().pools.find(p=>p.id===id) || S().pools[0]; }
function poolName(pl){ return App.ui.lang==='en' ? (pl.nameEn || pl.name) : (pl.name || pl.nameEn); }
function personById(id){ return App.data.people.find(p=>p.id===id); }
function facilityById(id){ return App.data.facilities.find(f=>f.id===id); }
function locationById(id){ return App.data.locations.find(l=>l.id===id); }
function categoryKind(name){ const c = App.data.categories.find(x=>x.name===name); return c ? c.kind : 'excluded'; }
function facilityKind(f){ return f.kindOverride || categoryKind(f.category); }
function facilityKm(f){ const l = f && locationById(f.locationId); return l ? l.km : null; }
function activePeople(){ return App.data.people.filter(p=>!p.retired && p.active!==false && S().pools.some(pl=>pl.id===p.pool)); }
function teamPeople(){ return App.data.people.filter(p=>!p.retired); }
function schedulableFacilities(){ return App.data.facilities.filter(f=>{ const k = facilityKind(f); return (k==='basic'||k==='contracted') && !f.excluded && f.freq>0; }); }
function seatsFor(pool, kind, category){
  if(pool.byCategory && category!=null && pool.byCategory[category]!=null) return pool.byCategory[category];
  return (pool.seats && pool.seats[kind]) || 0;
}
function distBand(km){
  const d = S().distance;
  if(km==null) return 'mid';
  if(km<=d.nearKm) return 'near';
  if(km>=d.farKm) return 'far';
  return 'mid';
}
function skillOf(p, kind, category){
  if(p.skill && p.skill.byCategory && category && p.skill.byCategory[category]!=null) return p.skill.byCategory[category];
  return (p.skill && p.skill[kind]!=null) ? p.skill[kind] : 50;
}
function isOff(p, iso){ return (p.off||[]).some(r=>iso>=r.from && iso<=r.to); }
function personPatternOn(p, ord){
  const a = p.avail || {mode:'plan'};
  const cal = S().calendar;
  if(a.mode==='weekdays') return (a.weekdays||[]).includes(wdOf(ord));
  if(a.mode==='cycle'){
    const c = a.cycle || {on:2, off:2};
    const len = Math.max(1, (c.on||1)+(c.off||0));
    const anchor = c.anchor ? ordOf(c.anchor) : ord;
    const pos = (((ord-anchor)%len)+len)%len;
    return pos < (c.on||1);
  }
  const iso = isoOf(ord);
  if(cal.extra.includes(iso)) return true;
  if(isOverrideDate(iso)) return true;
  return cal.workdays.includes(wdOf(ord));
}
function isOverrideDate(iso){ const ov = S().overrides; return !!ov && ov.some(o=>o.on!==false && o.date===iso && o.facilityId); }
function personBaseAvailable(p, ord){
  if(!p || p.retired || p.active===false) return false;
  if(isOff(p, isoOf(ord))) return false;
  return personPatternOn(p, ord);
}
function personAvailable(p, ord){
  return personBaseAvailable(p, ord) && patternCyclesAllow(p, ord);
}
function normalizeOff(spans){
  const c = (spans||[]).map(s=>s.from<=s.to ? {from:s.from, to:s.to} : {from:s.to, to:s.from}).sort((a,b)=>a.from<b.from?-1:1);
  const out = [];
  for(const s of c){
    const last = out[out.length-1];
    if(last && ordOf(s.from) <= ordOf(last.to)+1){ if(s.to>last.to) last.to = s.to; }
    else out.push({from:s.from, to:s.to});
  }
  return out;
}
function removeOffDay(off, iso){
  const res = [];
  for(const r of off||[]){
    if(iso<r.from || iso>r.to){ res.push(r); continue; }
    if(r.from!==iso) res.push({from:r.from, to:isoOf(ordOf(iso)-1)});
    if(r.to!==iso) res.push({from:isoOf(ordOf(iso)+1), to:r.to});
  }
  return res;
}
