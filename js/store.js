const STORE_KEY = 'alkhitta.v5';
const PLAN_KEY = 'alkhitta.plan.v5';
const LEGACY_KEY = 'alkhitta.v4';
const LEGACY_PLAN_KEY = 'alkhitta.plan.v1';

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
    calendar: {workdays:[1,2,3,4], holidays:[], extra:[]},
    volume: {mode:'fill', share:0.25, exact:{basic:4, contracted:12}, quotas:{}, perDay:1, perWeek:null},
    spacing: {mode:'even', gap:2},
    days: {},
    genderRules: [
      {id:'g_basic', on:true, kinds:['basic'], categories:[], facilities:[], minEach:25, avoidEven:true},
      {id:'g_contracted', on:false, kinds:['contracted'], categories:[], facilities:[], minEach:1, avoidEven:false}
    ],
    seniority: {on:true, threshold:60, mode:'require', match:0.3},
    fairness: {carry:true},
    rotation: {on:true, strength:0.35},
    repeatBlock: {on:false, times:3},
    distance: {nearKm:20, farKm:45, origin:'home', shortTrips:false, pickBias:null, balanceFar:false},
    pairs: [],
    pools: deepClone(SEED_POOLS)
  };
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
  return {version:5, settings:defaultSettings(), locations, categories, facilities, people,
    history:{fpv:{}, counts:{}, lastCycle:0}, aliases:{people:{}}, unresolved:[]};
}

function freshPerson(p){
  const base = {
    id: uid('p'), name:'', pool:'fin', gender:null, title:null, retired:false, active:true,
    skill:{basic:50, contracted:50, byCategory:{}}, share:1, fixed:null, origin:null, distPref:null,
    avail:{mode:'plan', weekdays:[1,2,3,4], cycle:{on:2, off:2, anchor:todayISO()}},
    maxRun:null, maxPerWeek:null, off:[], blocked:[]
  };
  const out = Object.assign(base, p||{});
  out.skill = Object.assign({basic:50, contracted:50, byCategory:{}}, (p&&p.skill)||{});
  out.avail = Object.assign({mode:'plan', weekdays:[1,2,3,4], cycle:{on:2, off:2, anchor:todayISO()}}, (p&&p.avail)||{});
  out.avail.cycle = Object.assign({on:2, off:2, anchor:todayISO()}, out.avail.cycle||{});
  return out;
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
    st.days[k] = {cap:o.visitCap||null, lean:o.kindLean>0?'basic':(o.kindLean<0?'contracted':null), dist:o.distLean>0?'far':(o.distLean<0?'near':null), favor:o.favorCategory||null, only:o.restrictTo||null};
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
  d.settings.volume.quotas = d.settings.volume.quotas || {};
  d.settings.period.scope = d.settings.period.scope || {kind:'all', ids:[]};
  if(!Array.isArray(d.settings.pools) || !d.settings.pools.length) d.settings.pools = deepClone(SEED_POOLS);
  d.settings.days = d.settings.days || {};
  d.settings.genderRules = Array.isArray(d.settings.genderRules) ? d.settings.genderRules : [];
  d.settings.pairs = Array.isArray(d.settings.pairs) ? d.settings.pairs : [];
  d.locations = d.locations||[]; d.categories = d.categories||[]; d.facilities = d.facilities||[];
  d.people = (d.people||[]).map(freshPerson);
  d.history = Object.assign({fpv:{}, counts:{}, lastCycle:0}, d.history||{});
  d.aliases = d.aliases || {people:{}};
  d.unresolved = d.unresolved || [];
  const known = new Set(d.categories.map(c=>c.name));
  for(const f of d.facilities) if(f.category && !known.has(f.category)){ d.categories.push({name:f.category, kind:'excluded'}); known.add(f.category); }
  const locIds = new Set(d.locations.map(l=>l.id));
  for(const f of d.facilities) if(f.locationId && !locIds.has(f.locationId)){ d.locations.push({id:f.locationId, name:f.locationId.replace(/^loc_/,'').replace(/_/g,' '), km:0}); locIds.add(f.locationId); }
  return d;
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
  return cal.workdays.includes(wdOf(ord));
}
function personAvailable(p, ord){
  if(!p || p.retired || p.active===false) return false;
  if(isOff(p, isoOf(ord))) return false;
  return personPatternOn(p, ord);
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
