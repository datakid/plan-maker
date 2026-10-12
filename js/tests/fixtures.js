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
