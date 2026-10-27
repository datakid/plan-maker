const STRUCTURAL_RULES = [
  {id:'calendar', name:'rs_calendar'},
  {id:'daysOff', name:'rs_daysOff'},
  {id:'retired', name:'rs_retired'},
  {id:'onePlace', name:'rs_onePlace'},
  {id:'facilityOnce', name:'rs_facilityOnce'},
  {id:'seats', name:'rs_seats'},
  {id:'perDay', name:'rs_perDay'},
  {id:'fixedVisit', name:'rs_fixedVisit'}
];

const RULES = [];
const RULE_INDEX = new Map();

function defRule(id, group, layer, scope, level, w, flags){
  const r = Object.assign({id, group, layer, scope, def:{level, w}, name:'rn_'+id, unit:'ru_'+id, must:'rm_'+id, preferOnly:false, structural:false}, flags || {});
  if(r.preferOnly) r.def = {level:'prefer', w};
  RULES.push(r);
  RULE_INDEX.set(id, r);
}

defRule('day.cap', 'rule-days', 'layout', 'day', 'must', 5);
defRule('day.min', 'rule-days', 'layout', 'day', 'prefer', 5);
defRule('day.kind', 'rule-days', 'layout', 'day', 'prefer', 5, {params:['howMany']});
defRule('day.band', 'rule-days', 'layout', 'day', 'prefer', 5, {params:['howMany']});
defRule('day.category', 'rule-days', 'layout', 'day', 'prefer', 5, {params:['howMany']});
defRule('day.only', 'rule-days', 'layout', 'day', 'must', 5);
defRule('fac.weekdays', 'rule-calendar', 'layout', 'facility', 'must', 5);
defRule('vol.week', 'rule-volume', 'layout', 'global', 'must', 5);
defRule('vol.everyDay', 'rule-rest', 'layout', 'global', 'must', 5);
defRule('vol.exact', 'rule-volume', 'layout', 'global', 'must', 3);
defRule('vol.share', 'rule-volume', 'layout', 'global', 'prefer', 5);
defRule('vol.quota', 'rule-volume', 'layout', 'global', 'must', 3);
defRule('vol.gap', 'rule-rest', 'layout', 'global', 'prefer', 5);
defRule('vol.activity', 'rule-rest', 'layout', 'global', 'must', 5);
defRule('fac.pinned', 'rule-volume', 'layout', 'facility', 'prefer', 9);
defRule('dist.pick', 'rule-distance', 'layout', 'global', 'prefer', 5);
defRule('p.blocked', 'team', 'staff', 'person', 'must', 5);
defRule('p.avail', 'team', 'staff', 'person', 'must', 5);
defRule('p.maxRun', 'team', 'staff', 'person', 'must', 5);
defRule('p.maxWeek', 'team', 'staff', 'person', 'must', 5);
defRule('p.rest', 'team', 'staff', 'person', 'must', 5);
defRule('p.quota', 'team', 'both', 'person', 'must', 5);
defRule('p.dist', 'team', 'staff', 'person', 'prefer', 5);
defRule('fair.load', 'rule-fairness', 'staff', 'global', 'prefer', 5, {params:['carry']});
defRule('gender.rule', 'rule-gender', 'staff', 'item', 'prefer', 8);
defRule('gender.pref.m', 'rule-gender', 'staff', 'global', 'prefer', 5);
defRule('gender.pref.f', 'rule-gender', 'staff', 'global', 'prefer', 5);
defRule('senior', 'rule-seniority', 'staff', 'global', 'must', 5);
defRule('pair', 'rule-pairs', 'staff', 'item', 'prefer', 5);
defRule('rotate', 'rule-fairness', 'staff', 'global', 'prefer', 5, {params:['maxRepeats']});
defRule('dist.short', 'rule-distance', 'staff', 'global', 'prefer', 5);
defRule('dist.balanceFar', 'rule-distance', 'staff', 'global', 'prefer', 5);
defRule('goal.cover', 'rule-goals', 'layout', 'goal', 'prefer', 5);
defRule('goal.atLeast', 'rule-goals', 'layout', 'goal', 'prefer', 5);
defRule('goal.atMost', 'rule-goals', 'layout', 'goal', 'must', 5);
defRule('goal.maxGap', 'rule-goals', 'layout', 'goal', 'must', 5);
defRule('goal.person', 'rule-goals', 'staff', 'goal', 'must', 5);
defRule('goal.together', 'rule-goals', 'staff', 'goal', 'prefer', 5);
defRule('goal.separate', 'rule-goals', 'staff', 'goal', 'must', 5);
defRule('goal.special', 'rule-goals', 'both', 'goal', 'must', 5);
defRule('goal.pattern', 'rule-goals', 'both', 'goal', 'must', 5);
defRule('due.priority', 'rule-volume', 'layout', 'global', 'prefer', 3, {preferOnly:true});
defRule('skill.match', 'rule-seniority', 'staff', 'global', 'prefer', 5, {preferOnly:true});
defRule('space.shape', 'rule-rest', 'layout', 'global', 'prefer', 5, {preferOnly:true});
defRule('p.spread', 'team', 'staff', 'person', 'prefer', 2, {preferOnly:true});

const GOAL_RULE = {cover:'goal.cover', atLeast:'goal.atLeast', atMost:'goal.atMost', maxGap:'goal.maxGap', person:'goal.person', together:'goal.together', separate:'goal.separate', special:'goal.special', pattern:'goal.pattern'};

function ruleSpec(id){ return typeof id==='string' ? RULE_INDEX.get(id) || null : id; }
function strengthToW(s){ return s==='light' ? 3 : (s==='strong' ? 8 : 5); }
function rotationToW(x){ const v = +x; if(!isFinite(v)) return 5; return v<=0.27 ? 3 : (v>=0.5 ? 8 : 5); }

function normLv(x, def, spec){
  const d = def || {level:'prefer', w:5};
  const src = x && typeof x==='object' ? x : {};
  let level = src.level==='must' ? 'must' : (src.level==='prefer' ? 'prefer' : d.level);
  const wn = Math.round(+src.w);
  const w = isFinite(wn) && wn>=1 ? Math.min(10, wn) : d.w;
  if(spec && spec.preferOnly) level = 'prefer';
  return {level, w};
}
function mkLv(level, w){ return {level, w:w==null ? 5 : w}; }

function lvOf(id){
  const spec = ruleSpec(id);
  const set = S();
  const own = set.lv && set.lv[id];
  const base = normLv(own, spec ? spec.def : null, spec);
  if(id==='vol.everyDay'){
    const u = set.volume && set.volume.useAllDays;
    if(u==='prefer') return mkLv('prefer', base.level==='prefer' ? base.w : 5);
    if(u==='must') return mkLv('must', base.w);
  }
  return base;
}

function goalRuleId(g){ return GOAL_RULE[g.type] || 'goal.cover'; }

function normalizeLvMap(map){
  const out = {};
  const src = map && typeof map==='object' ? map : {};
  for(const r of RULES) if(r.scope==='global') out[r.id] = normLv(src[r.id], r.def, r);
  return out;
}

function personLvDefaults(){
  return {spread:mkLv('prefer', 2), blocked:mkLv('must', 5), avail:mkLv('must', 5), maxRun:mkLv('must', 5), maxWeek:mkLv('must', 5), rest:mkLv('must', 5), quota:mkLv('must', 5), dist:mkLv('prefer', 5)};
}
const PERSON_LV_RULE = {spread:'p.spread', blocked:'p.blocked', avail:'p.avail', maxRun:'p.maxRun', maxWeek:'p.maxWeek', rest:'p.rest', quota:'p.quota', dist:'p.dist'};

function normalizePersonLv(x){
  const out = {};
  const d = personLvDefaults();
  for(const k of Object.keys(d)) out[k] = normLv(x && x[k], d[k], ruleSpec(PERSON_LV_RULE[k]));
  return out;
}
function normalizeFacilityLv(x){
  return {weekdays:normLv(x && x.weekdays, mkLv('must', 5), ruleSpec('fac.weekdays')), pinned:normLv(x && x.pinned, mkLv('prefer', 9), ruleSpec('fac.pinned'))};
}

function howManyOf(v){ return v==='one' ? 'one' : 'all'; }

function normalizeDay(o){
  if(!o || typeof o!=='object') return {};
  const out = {};
  const num = v=>v==null || v==='' || !isFinite(+v) ? null : Math.max(0, Math.round(+v));
  const capN = o.cap && typeof o.cap==='object' ? num(o.cap.n) : num(o.cap);
  if(capN!=null) out.cap = {n:capN, lv:normLv(o.cap && o.cap.lv, mkLv('must', 5), ruleSpec('day.cap'))};
  const minN = o.min && typeof o.min==='object' ? num(o.min.n) : num(o.min);
  if(minN) out.min = {n:minN, lv:normLv(o.min && o.min.lv, mkLv('prefer', 5), ruleSpec('day.min'))};
  const kind = o.kind && typeof o.kind==='object' ? o.kind.kind : o.lean;
  if(kind==='basic' || kind==='contracted') out.kind = {kind, howMany:howManyOf(o.kind && o.kind.howMany), lv:normLv(o.kind && o.kind.lv, mkLv('prefer', 5), ruleSpec('day.kind'))};
  const band = o.band && typeof o.band==='object' ? o.band.band : o.dist;
  if(band==='near' || band==='far') out.band = {band, howMany:howManyOf(o.band && o.band.howMany), lv:normLv(o.band && o.band.lv, mkLv('prefer', 5), ruleSpec('day.band'))};
  let catIds = o.category && typeof o.category==='object' ? o.category.ids : o.favor;
  if(typeof catIds==='string') catIds = [catIds];
  if(Array.isArray(catIds) && catIds.length) out.category = {ids:catIds.filter(x=>typeof x==='string' && x), howMany:howManyOf(o.category && o.category.howMany), lv:normLv(o.category && o.category.lv, mkLv('prefer', 5), ruleSpec('day.category'))};
  let onlyIds = o.only && !Array.isArray(o.only) && typeof o.only==='object' ? o.only.ids : o.only;
  if(typeof onlyIds==='string') onlyIds = [onlyIds];
  if(Array.isArray(onlyIds) && onlyIds.length) out.only = {ids:onlyIds.filter(x=>typeof x==='string' && x), lv:normLv(o.only && o.only.lv, mkLv('must', 5), ruleSpec('day.only'))};
  return out;
}

function dayConfigIsEmpty(c){ return !c || !Object.keys(c).length; }

function dayView(c){
  const o = c || {};
  return {
    cap:o.cap ? o.cap.n : null,
    min:o.min ? o.min.n : null,
    lean:o.kind ? o.kind.kind : null,
    dist:o.band ? o.band.band : null,
    favor:o.category && o.category.ids.length ? o.category.ids[0] : null,
    favorIds:o.category ? o.category.ids.slice() : [],
    only:o.only ? o.only.ids : null
  };
}

function patchDay(wd, patch){
  const set = S();
  const cur = normalizeDay(set.days[wd]);
  const keep = (key, dflt)=>cur[key] ? cur[key].lv : dflt;
  if('cap' in patch) cur.cap = patch.cap==null ? null : {n:patch.cap, lv:keep('cap', mkLv('must', 5))};
  if('min' in patch) cur.min = patch.min==null ? null : {n:patch.min, lv:keep('min', mkLv('prefer', 5))};
  if('lean' in patch) cur.kind = patch.lean ? {kind:patch.lean, howMany:cur.kind ? cur.kind.howMany : 'all', lv:keep('kind', mkLv('prefer', 5))} : null;
  if('dist' in patch) cur.band = patch.dist ? {band:patch.dist, howMany:cur.band ? cur.band.howMany : 'all', lv:keep('band', mkLv('prefer', 5))} : null;
  if('favor' in patch) cur.category = patch.favor && (!Array.isArray(patch.favor) || patch.favor.length) ? {ids:Array.isArray(patch.favor) ? patch.favor.slice() : [patch.favor], howMany:cur.category ? cur.category.howMany : 'all', lv:keep('category', mkLv('prefer', 5))} : null;
  if('only' in patch) cur.only = patch.only && patch.only.length ? {ids:patch.only.slice(), lv:keep('only', mkLv('must', 5))} : null;
  for(const k of Object.keys(cur)) if(cur[k]==null) delete cur[k];
  const next = normalizeDay(cur);
  if(dayConfigIsEmpty(next)) delete set.days[wd]; else set.days[wd] = next;
}

function strictToLv(strict, tryW){ return strict==='must' ? mkLv('must', 5) : mkLv('prefer', tryW==null ? 5 : tryW); }

function migrateLv(d){
  const set = d.settings;
  const old = set.lv && typeof set.lv==='object' ? set.lv : {};
  const lv = normalizeLvMap(old);
  const has = id=>old[id] && typeof old[id]==='object';
  const put = (id, v)=>{ if(!has(id)) lv[id] = normLv(v, null, ruleSpec(id)); };
  put('vol.gap', strictToLv(set.spacing && set.spacing.strict));
  put('vol.activity', strictToLv(set.patterns && set.patterns.activity && set.patterns.activity.strict));
  const gp = set.genderPrefs || {};
  put('gender.pref.m', mkLv('prefer', strengthToW(gp.m && gp.m.strength)));
  put('gender.pref.f', mkLv('prefer', strengthToW(gp.f && gp.f.strength)));
  const sen = set.seniority || {};
  put('senior', sen.mode==='prefer' ? mkLv('prefer', 5) : mkLv('must', 5));
  const rb = set.repeatBlock || {};
  const rot = set.rotation || {};
  if(!has('rotate')){
    if(rb.on) lv.rotate = mkLv('must', 5);
    else lv.rotate = mkLv('prefer', rot.on===false ? 3 : rotationToW(rot.strength));
  }
  set.lv = lv;
  const days = {};
  for(const k of Object.keys(set.days || {})){
    const n = normalizeDay(set.days[k]);
    if(!dayConfigIsEmpty(n)) days[k] = n;
  }
  set.days = days;
  for(const r of (set.genderRules || [])) r.lv = normLv(r.lv, mkLv('prefer', 8), ruleSpec('gender.rule'));
  for(const pr of (set.pairs || [])){
    if(pr.lv && typeof pr.lv==='object') pr.lv = normLv(pr.lv, mkLv('prefer', 5), ruleSpec('pair'));
    else pr.lv = pr.mode==='rigid' ? mkLv('must', 5) : mkLv('prefer', strengthToW(pr.strength));
  }
  for(const g of (set.goals || [])) g.lv = goalLvOf(g);
  const restLv = strictToLv(set.patterns && set.patterns.person && set.patterns.person.strict);
  for(const p of d.people || []) p.lv = normalizePersonLv(p.lv || {rest:restLv});
  for(const f of d.facilities || []) f.lv = normalizeFacilityLv(f.lv);
}

function lvMust(id){ return lvOf(id).level==='must'; }
function personLvOf(p){ return normalizePersonLv(p && p.lv); }
function facilityLvOf(f){ return normalizeFacilityLv(f && f.lv); }

function goalMust(g){ return !!g && !!g.lv && g.lv.level==='must'; }
function goalStrict(g){ return goalMust(g) ? 'must' : 'try'; }

function goalLvOf(g){
  const spec = ruleSpec(goalRuleId(g));
  if(g.lv && typeof g.lv==='object') return normLv(g.lv, spec.def, spec);
  return mkLv(spec.def.level, spec.def.w);
}

function tierKey(w){ return w<=3 ? 'light' : (w>=7 ? 'strong' : 'medium'); }
function pairRigid(r){ return !!r.lv && r.lv.level==='must'; }
function pairStrength(r){ return tierKey(r.lv ? r.lv.w : 5); }
function genderPrefStrength(gender){ return tierKey(lvOf(gender==='f' ? 'gender.pref.f' : 'gender.pref.m').w); }
function seniorRequired(){ return lvMust('senior'); }
function rotationFactor(){ const w = lvOf('rotate').w; return w<=3 ? 0.2 : (w>=7 ? 0.7 : 0.35); }
function rotateMustActive(){ const s = S(); return (s.repeatBlock.on || s.rotation.on) && lvMust('rotate'); }
function rotatePreferActive(){ return S().rotation.on && !lvMust('rotate'); }
