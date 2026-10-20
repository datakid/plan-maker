const Fx = {
  START: '2026-10-04',
  iso(n){ return isoOf(ordOf(Fx.START)+n); },
  ord(n){ return ordOf(Fx.START)+n; },

  merge(base, patch){
    if(patch==null) return base;
    if(Array.isArray(patch) || typeof patch!=='object') return patch;
    const out = Array.isArray(base) || base==null || typeof base!=='object' ? {} : Object.assign({}, base);
    for(const k of Object.keys(patch)) out[k] = Fx.merge(out[k], patch[k]);
    return out;
  },

  data(spec){
    spec = spec || {};
    const days = spec.days || 6;
    const start = spec.start || Fx.START;
    const end = isoOf(ordOf(start)+days-1);
    const pools = (spec.pools || [{id:'a', basic:1, contracted:1}]).map(p=>({id:p.id, name:p.id, nameEn:p.id, seats:{basic:p.basic==null?1:p.basic, contracted:p.contracted==null?1:p.contracted}, byCategory:p.byCategory||{}}));
    const facilities = (spec.facilities || []).map(f=>({
      id:f.id, name:f.name || f.id, category:f.cat || 'B', locationId:'loc_x', kindOverride:null, freq:f.freq==null?1:f.freq,
      importance:f.importance==null?50:f.importance, pinned:!!f.pinned, excluded:false, lastVisit:f.lastVisit||null,
      visitCount:f.visitCount||0, history:f.history||[], weekdays:f.weekdays||null, review:null
    }));
    const people = (spec.people || []).map(p=>{
      const q = Object.assign({}, p);
      const skill = q.skill;
      delete q.skill; delete q.cat;
      return freshPerson(Object.assign({id:q.id, name:q.name || q.id, pool:pools[0].id, gender:null, origin:'loc_x'}, q, skill==null ? {} : {skill:typeof skill==='number' ? {basic:skill, contracted:skill, byCategory:{}} : skill}));
    });
    const settings = defaultSettings();
    settings.pools = pools;
    settings.period = {goal:'range', preset:'custom', start, end, scope:{kind:'all', ids:[]}, times:1};
    settings.calendar = {workdays:spec.workdays || [0,1,2,3,4,5,6], holidays:spec.holidays || [], extra:spec.extra || []};
    settings.volume = Object.assign({mode:'exact', share:0.5, exact:{basic:0, contracted:0}, quotas:{}, perDay:1, perWeek:null}, spec.volume || {});
    settings.volume.exact = Object.assign({basic:0, contracted:0}, settings.volume.exact);
    settings.genderRules = [];
    settings.seniority = Object.assign({}, settings.seniority, {on:false});
    settings.fairness = {carry:false};
    settings.rotation = {on:false, strength:0.35};
    settings.goals = (spec.goals || []).map(normalizeGoal);
    settings.overrides = (spec.overrides || []).map(normalizeOverride);
    const merged = Fx.merge(settings, spec.settings || {});
    merged.goals = (merged.goals || []).map(normalizeGoal);
    const cats = new Map([['B', 'basic'], ['C', 'contracted']]);
    for(const f of facilities) if(!cats.has(f.category)) cats.set(f.category, /^C/.test(f.category) ? 'contracted' : 'basic');
    for(const c of (spec.categories || [])) cats.set(c.name, c.kind);
    const data = {
      version:5, rev:SETTINGS_REV, settings:merged,
      locations:[{id:'loc_x', name:'X', km:0}],
      categories:[...cats].map(([name, kind])=>({name, kind})),
      facilities, people,
      history:Object.assign({fpv:{}, counts:{}, lastCycle:0}, spec.history || {}),
      aliases:{people:{}}, unresolved:[]
    };
    if(typeof RULES_REV!=='undefined') data.rulesRev = RULES_REV;
    return normalizeData(data);
  },

  use(spec){
    App.data = Fx.data(spec);
    App.plan = null;
    return App.data;
  },

  gen(spec){
    if(spec) Fx.use(spec);
    const r = generatePlan();
    if(r.error) throw new Error('generatePlan error '+r.error);
    return r.plan;
  },

  fac(n, cat, extra){
    const out = [];
    for(let i=1;i<=n;i++) out.push(Object.assign({id:'f'+i, cat:cat||'B'}, extra||{}));
    return out;
  },
  ppl(ids, extra){ return ids.map(id=>Object.assign({id}, extra||{})); },

  visits(plan, pid){ return plan.visits.filter(v=>visitTeamIds(v).includes(pid)); },
  dates(plan, pid){ return Fx.visits(plan, pid).map(v=>v.date).sort(); },
  count(plan, pid){ return Fx.visits(plan, pid).length; },
  facilitiesIn(plan){ return plan.visits.map(v=>v.facilityId).sort(); },
  doubleBooked(plan){
    let n = 0;
    for(const [, list] of groupBy(plan.visits, v=>v.date)){
      const seen = new Set();
      for(const v of list) for(const id of visitTeamIds(v)){ if(seen.has(id)) n++; seen.add(id); }
    }
    return n;
  },
  manualPlan(visits, extra){
    const set = S();
    const win = presetWindow(set.period.preset, set.period.start, set.period.end);
    const days = [];
    for(let o=win.start;o<=win.end;o++) if(isWorkday(o)) days.push(isoOf(o));
    return Object.assign({
      id:'manual', cycle:1, createdAt:0, approved:false, stale:false, start:isoOf(win.start), end:isoOf(win.end), days,
      goal:'range', requested:visits.length, carryover:[], goalReport:{}, genDiags:[],
      visits:visits.map((v, i)=>({
        id:v.id || 'mv'+i, date:v.date, facilityId:v.facilityId, kind:v.kind || visitKindOf(facilityById(v.facilityId)),
        team:v.team || {}, open:v.open || {}, why:v.why || {}, moved:false, fixed:!!v.fixed, overrideId:v.overrideId || null, special:v.special || null, late:!!v.late
      }))
    }, extra || {});
  },
  strictOf(g){ return g.strict==='must' ? 'must' : 'try'; }
};

Fx.rng = function(a){
  return function(){ a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
};
Fx.W1 = {start:'2026-10-04', end:'2026-10-08', tuesday:'2026-10-06', tuesdayWd:2};
Fx.w1 = function(opts){
  opts = opts || {};
  App.data = normalizeData(JSON.parse(SEED_JSON));
  App.plan = null;
  if(opts.shuffle){
    const r = Fx.rng(opts.shuffle);
    for(const f of App.data.facilities){
      const d = Math.floor(r() * 600);
      f.lastVisit = isoOf(ordOf('2026-10-03') - d - 1);
      f.history = [f.lastVisit];
      f.visitCount = 1;
    }
  }
  const s = S();
  s.period = Object.assign({}, s.period, {goal:'range', preset:'custom', start:Fx.W1.start, end:Fx.W1.end});
  s.volume = Object.assign({}, s.volume, {mode:'fill', share:0.6, perDay:1});
  const leans = opts.leans || {2:'contracted'};
  for(const wd of Object.keys(leans)) patchDay(+wd, {lean:leans[wd]});
  return App.data;
};
Fx.leanMisses = function(plan, leans){
  leans = leans || {2:'contracted'};
  return Object.keys(leans).filter(wd=>!plan.visits.some(v=>wdOf(ordOf(v.date))===+wd && v.kind===leans[wd])).length;
};

const VISITPLAN_WEEK = JSON.parse('{"rest":{"rest":1,"maxRun":1},"gmaxOn":true,"gmax":2,"members":[{"id":101,"name":"شوقي","pool":1,"gender":"M","off":[1,2]},{"id":102,"name":"ميسرة","pool":1,"gender":"M","off":[]},{"id":103,"name":"اسماء","pool":1,"gender":"F","off":[1]},{"id":104,"name":"شرنوبي","pool":1,"gender":"M","off":[2,3,1]},{"id":105,"name":"مريم","pool":1,"gender":"F","off":[]},{"id":106,"name":"حمودين","pool":1,"gender":"M","off":[1]},{"id":107,"name":"لبني","pool":2,"gender":"F","off":[1,5]},{"id":108,"name":"اباظة","pool":2,"gender":"M","off":[1,3,4]},{"id":109,"name":"شلتوت","pool":2,"gender":"M","off":[3,1,5]},{"id":110,"name":"اماني","pool":2,"gender":"F","off":[4]},{"id":111,"name":"غادة","pool":2,"gender":"F","off":[1,2,3]}],"locations":[{"id":112,"name":"رئيسي ١","type":"main","closed":[]},{"id":113,"name":"رئيسي ٢","type":"main","closed":[1,2,3,5]},{"id":114,"name":"رئيسي ٣","type":"main","closed":[]},{"id":115,"name":"متعاقد ١","type":"contracted","closed":[]},{"id":116,"name":"متعاقد ٢","type":"contracted","closed":[]}]}');
Fx.visitplanSpec = function(B){
  B = B || VISITPLAN_WEEK;
  const offs = ns=>ns.map(n=>({from:Fx.iso(n-1), to:Fx.iso(n-1)}));
  const people = B.members.map(m=>({id:'p'+m.id, name:m.name, pool:m.pool===1 ? 'cl' : 'ad', gender:m.gender==='M' ? 'm' : 'f', off:offs(m.off), quota:{min:null, max:B.gmaxOn ? B.gmax : null}, pattern:{mode:'custom', minRest:B.rest.rest}}));
  const facilities = B.locations.map(l=>{
    const open = [1, 2, 3, 4, 5].filter(d=>!(l.closed || []).includes(d)).map(d=>d-1);
    return {id:'l'+l.id, name:l.name, cat:l.type==='main' ? 'B' : 'C', weekdays:open.length===5 ? null : open};
  });
  return {
    days:5, facilities, people, workdays:[0, 1, 2, 3, 4],
    pools:[{id:'cl', basic:2, contracted:2}, {id:'ad', basic:2, contracted:1}],
    volume:{mode:'exact', exact:{basic:3, contracted:2}, perDay:1, requireEveryEligibleDay:true},
    settings:{genderRules:[{id:'g1', on:true, kinds:['basic'], categories:[], facilities:[], minEach:25, avoidEven:true}]}
  };
};
Fx.visitplanWitness = function(){
  const day = (d, fac, cl, ad)=>({date:Fx.iso(d), facilityId:'l'+fac, team:{cl:cl.map(n=>'p'+n), ad:ad.map(n=>'p'+n)}});
  return [
    day(0, 115, [102, 105], [110]),
    day(1, 112, [103, 106], [108, 109]),
    day(2, 114, [101, 105], [107, 110]),
    day(3, 113, [102, 104], [109, 111]),
    day(4, 116, [101, 103], [108])
  ];
};
