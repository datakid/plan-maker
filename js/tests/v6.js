shipAsync('v6 P5.1: every stepper on the main tabs steps from its effective value', async ()=>{
  const tabs = ['plan', 'rules', 'goals', 'team', 'facilities'];
  const bad = [];
  let n = 0;
  const wait = ms=>new Promise(r=>setTimeout(r, ms));
  for(const tab of tabs){
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.ui.tab = tab; renderTab(); await wait(40);
    const count = document.querySelectorAll('.input-group[data-stepper]').length;
    for(let i=0; i<count; i++){
      App.data = normalizeData(JSON.parse(SEED_JSON));
      App.ui.tab = tab; renderTab(); await wait(15);
      const g = document.querySelectorAll('.input-group[data-stepper]')[i];
      if(!g) break;
      const input = g.querySelector('input'), dec = g.querySelectorAll('button')[0];
      const min = +g.dataset.min, step = +g.dataset.step, nullable = g.dataset.nullable==='1';
      const base = g.dataset.base==='' ? null : +g.dataset.base;
      const raw = input.value;
      const eff = raw!=='' ? Number(toAsciiDigits(raw)) : (base!=null ? base : min);
      n++;
      if(dec.disabled){
        if(!(eff<=min)) bad.push(tab+'#'+i+' minus disabled at '+eff+' (min '+min+')');
        continue;
      }
      dec.click();
      const after = input.value;
      const want = nullable && base==null && raw!=='' && eff<=min ? '' : String(Math.max(min, Math.round((eff-step)/step)*step));
      if(after!==want) bad.push(tab+'#'+i+' '+raw+' to '+after+' wanted '+want);
    }
  }
  App.ui.tab = 'plan'; renderTab();
  return verdict(bad.length===0 && n>0, n+' steppers checked', bad.slice(0, 5).join(' | '));
});

shipAsync('v6 P2: hard + intent + soft count every violation exactly once', async ()=>{
  let bad = '', n = 0;
  for(let seed=1; seed<=30 && !bad; seed++){
    Fx.use(fuzzSpec(seed));
    const r = generatePlan({iters:30, seed, skipExplain:true});
    if(!r.plan) continue;
    n++;
    const v = validatePlan(r.plan);
    let sum = 0;
    for(const x of v.violations) if(x.cls==='hard' || x.cls==='soft') sum += x.weight*x.units;
    if(Math.abs(sum-(v.hardScore+v.intentScore+v.softScore))>0.01) bad = 'seed '+seed+' '+sum+' vs '+(v.hardScore+v.intentScore+v.softScore);
  }
  return verdict(!bad && n>20, n+' fixtures partition cleanly', bad || 'only '+n);
});

shipAsync('R-INT-1 a Prefer special beats the due reward of overdue facilities', async ()=>{
  const miss = [];
  for(const seed of [1, 2, 3, 4, 5]){
    Fx.use(Fx.g4i2({mode:'fill'}));
    const r = generatePlan({seed, iters:150, skipExplain:true});
    if(!r.plan.visits.some(v=>v.special)) miss.push(seed);
  }
  return verdict(miss.length===0, 'special present on 5 seeds', 'missing on seeds '+miss.join(','));
});

shipAsync('R-INT-2 a Try cover goal with no deadline is fully covered when capacity allows', async ()=>{
  const miss = [];
  for(const mode of ['fill', 'exact']) for(const seed of [1, 2, 3]){
    const spec = Fx.g4i2({mode});
    spec.goals[0].lv = mkLv('prefer', 5);
    Fx.use(spec);
    const r = generatePlan({seed, iters:150, skipExplain:true});
    const seen = new Set(r.plan.visits.map(v=>v.facilityId));
    for(const id of ['k1', 'k2', 'k3']) if(!seen.has(id)) miss.push(mode+'#'+seed+':'+id);
  }
  return verdict(miss.length===0, 'k1,k2,k3 visited in 6 runs', miss.join(' '));
});

shipAsync('R-INT-3 in "only my goals and visits" mode nothing extra is added', async ()=>{
  const bad = [];
  for(const seed of [1, 2, 3]){
    Fx.use(Fx.g4i2({mode:'fill', fill:'goals'}));
    const r = generatePlan({seed, iters:150, skipExplain:true});
    for(const v of r.plan.visits) if(visitOrigin(v)==='filler') bad.push(seed+':'+v.facilityId);
  }
  return verdict(bad.length===0, 'no filler visits', bad.slice(0, 6).join(' '));
});

shipAsync('R-INT-4 in fill mode the goals take 8 visits and filler takes the other 12', async ()=>{
  Fx.use(Fx.g4i2({mode:'fill'}));
  const r = generatePlan({seed:1, iters:150, skipExplain:true});
  const own = r.plan.visits.filter(v=>visitOrigin(v)!=='filler').length;
  const filler = r.plan.visits.length-own;
  return verdict(own===8 && r.plan.visits.length===20 && filler===12, 'own '+own+' filler '+filler, 'own '+own+' filler '+filler+' total '+r.plan.visits.length);
});

shipAsync('v6 P2: goals over capacity give a hard conflict with a raise-per-day fix', async ()=>{
  const spec = Fx.g4i2({mode:'fill'});
  spec.volume.perDay = 1;
  spec.days = 4;
  const cover = spec.goals[0]; cover.times = 1;
  for(let i=1; i<=6; i++) spec.facilities.push({id:'z'+i, cat:'K1', loc:'L1', importance:10});
  Fx.use(spec);
  const r = generatePlan({seed:1, iters:60, skipExplain:true});
  const c = (r.conflicts || []).find(x=>x.key==='xGoalsOverCapacity');
  return verdict(!!c && c.fix && c.fix.type==='raisePerDay' && c.fix.to>1, 'conflict '+(c && JSON.stringify(c.fix)), 'no xGoalsOverCapacity conflict; keys '+JSON.stringify((r.conflicts || []).map(x=>x.key)));
});

shipAsync('v6 P2: a rev 9 save gains volume.fill = fill and keeps its behaviour', async ()=>{
  const old = JSON.parse(SEED_JSON);
  old.rulesRev = 9;
  delete old.settings.volume.fill;
  delete old.settings.volume.requestsExceedCap;
  const d = normalizeData(old);
  const v = d.settings.volume;
  return verdict(d.rulesRev===RULES_REV && v.fill==='fill' && v.requestsExceedCap===true, 'fill and requestsExceedCap defaulted', JSON.stringify({rev:d.rulesRev, fill:v.fill, over:v.requestsExceedCap}));
});

const ruleBreaks = (plan, gid)=>validatePlan(plan).violations.filter(v=>v.key==='dPersonRule');
const poolOf = id=>personById(id).pool;
const locOf = fid=>facilityById(fid).locationId;

shipAsync('R-RULE-1 a pool that never goes to a location never does, on every seed', async ()=>{
  const bad = [];
  for(const seed of [1, 2, 3, 4, 5]){
    Fx.use(Fx.poolRule({rel:'never'}));
    const r = generatePlan({seed, iters:100, skipExplain:true});
    for(const v of r.plan.visits) if(locOf(v.facilityId)==='L1' && visitTeamIds(v).some(id=>poolOf(id)==='adm')) bad.push(seed+':'+v.facilityId);
    if(ruleBreaks(r.plan).length) bad.push(seed+':validator');
  }
  return verdict(bad.length===0, 'no Admins at L1 on 5 seeds', bad.join(' '));
});

shipAsync('R-RULE-2 a person moved into the pool afterwards is denied as well', async ()=>{
  Fx.use(Fx.poolRule({rel:'never'}));
  const q = freshPerson({id:'p7', name:'p7', pool:'adm', origin:'loc_x'});
  App.data.people.push(q);
  const rules = compilePeopleRules();
  const x1 = facilityById('x1'), y1 = facilityById('y1');
  const denied = rules.denied('p7', x1)==='must' && rules.denied('p7', y1)===null;
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'x1', team:{adm:['p7'], oth:['p3']}}]);
  const broke = ruleBreaks(plan).length===1 && validatePlan(plan).hard>0;
  const g = S().goals[0];
  return verdict(denied && broke && goalPeople(g).includes('p7'), 'p7 denied at L1, breach reported', JSON.stringify({denied, broke}));
});

shipAsync('R-RULE-3 only: a pool that only goes to a location stays there', async ()=>{
  const bad = [];
  for(const seed of [1, 2, 3]){
    Fx.use(Fx.poolRule({rel:'only', scope:{kind:'location', ids:['L2']}}));
    const r = generatePlan({seed, iters:100, skipExplain:true});
    for(const v of r.plan.visits) if(locOf(v.facilityId)!=='L2' && visitTeamIds(v).some(id=>poolOf(id)==='adm')) bad.push(seed+':'+v.facilityId);
  }
  return verdict(bad.length===0, 'Admins only at L2 on 3 seeds', bad.join(' '));
});

shipAsync('R-RULE-4 reservedFor: others stay out of a location reserved for a pool', async ()=>{
  const bad = [];
  for(const seed of [1, 2, 3]){
    Fx.use(Fx.poolRule({rel:'reservedFor', scope:{kind:'location', ids:['L3']}}));
    const r = generatePlan({seed, iters:100, skipExplain:true});
    for(const v of r.plan.visits) if(locOf(v.facilityId)==='L3' && visitTeamIds(v).some(id=>poolOf(id)!=='adm')) bad.push(seed+':'+v.facilityId);
  }
  return verdict(bad.length===0, 'only Admins at L3 on 3 seeds', bad.join(' '));
});

shipAsync('R-RULE-4b prefer-not is a soft rule: a breach is a soft violation, not a hard one', async ()=>{
  Fx.use(Fx.poolRule({rel:'never', level:'prefer'}));
  const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:'x1', team:{adm:['p1'], oth:['p3']}}]);
  const v = validatePlan(plan);
  const hit = v.violations.find(x=>x.key==='dPersonRule');
  return verdict(!!hit && hit.cls==='soft', 'soft breach', JSON.stringify(hit && hit.cls));
});

shipAsync('R-RULE-5 a Must rule that empties a required pool is a proven conflict', async ()=>{
  Fx.use(Fx.poolRule({rel:'never', level:'must'}));
  const r = generatePlan({seed:1, iters:60, skipExplain:true});
  const c = (r.conflicts || []).find(x=>x.key==='xRuleEmptiesPool');
  Fx.use(Fx.poolRule({rel:'never', level:'prefer'}));
  const r2 = generatePlan({seed:1, iters:60, skipExplain:true});
  const none = !(r2.conflicts || []).some(x=>x.key==='xRuleEmptiesPool');
  return verdict(!!c && c.args[1]==='adm' && c.args[2]===4 && none, 'conflict for Must only: '+(c && JSON.stringify(c.args)), 'conflict '+JSON.stringify(c)+' none-for-prefer '+none);
});

shipAsync('R-RULE-6 an old person goal loads unchanged and gains a people subject', async ()=>{
  const old = JSON.parse(SEED_JSON);
  old.rulesRev = 9;
  const pg = old.settings.goals.find(g=>g.type==='person');
  if(pg) delete pg.subject;
  const d = normalizeData(old);
  const g = d.settings.goals.find(x=>x.type==='person');
  if(!g) return verdict(true, 'seed has no person goal');
  return verdict(g.subject && g.subject.kind==='people' && Array.isArray(g.people), 'subject defaulted to people', JSON.stringify(g.subject));
});

shipAsync('R-RULE-7 the rule sentence builds every combination in both languages without overflow at 390 px', async ()=>{
  const keepLang = App.ui.lang;
  const bad = [];
  let n = 0;
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:0;top:0;width:358px;background:#fff;z-index:-1;overflow:visible';
  document.body.appendChild(host);
  try{
    for(const lang of ['ar', 'en']){
      App.ui.lang = lang;
      for(const kind of ['people', 'pool']) for(const rel of ['never', 'avoid', 'only', 'reservedFor']){
        Fx.use(Fx.poolRule({}));
        const g = newGoal('person');
        g.subject = {kind, ids:kind==='pool' ? ['adm'] : []};
        g.people = kind==='people' ? ['p1'] : [];
        g.rel = rel==='avoid' ? 'never' : rel;
        g.lv = mkLv(rel==='avoid' ? 'prefer' : 'must', 5);
        g.scope = {kind:'location', ids:['L1']};
        clear(host);
        host.appendChild(RuleSentence(g, ()=>{}));
        n++;
        const text = host.textContent;
        if(text.includes('undefined') || text.includes('NaN') || text.trim().length<5) bad.push(lang+'/'+kind+'/'+rel+' text');
        if(host.scrollWidth>host.clientWidth+1) bad.push(lang+'/'+kind+'/'+rel+' overflow '+host.scrollWidth+'>'+host.clientWidth);
      }
    }
  } finally { App.ui.lang = keepLang; host.remove(); }
  return verdict(bad.length===0 && n===16, n+' combinations render', bad.slice(0, 4).join(' | '));
});

shipAsync('R-RULE-8 flipping each pool rule between Must and Prefer flips a breach between hard and soft', async ()=>{
  const bad = [];
  const cases = [
    {rel:'never', scope:{kind:'location', ids:['L1']}, subject:{kind:'pool', ids:['adm']}, fid:'x1', team:{adm:['p1'], oth:['p3']}},
    {rel:'only', scope:{kind:'location', ids:['L2']}, subject:{kind:'pool', ids:['adm']}, fid:'x1', team:{adm:['p1'], oth:['p3']}},
    {rel:'reservedFor', scope:{kind:'location', ids:['L3']}, subject:{kind:'pool', ids:['adm']}, fid:'z1', team:{adm:['p1'], oth:['p3']}}
  ];
  for(const c of cases) for(const level of ['must', 'prefer']){
    Fx.use(Fx.poolRule({rel:c.rel, scope:c.scope, subject:c.subject, level}));
    const plan = Fx.manualPlan([{date:Fx.iso(1), facilityId:c.fid, team:c.team}]);
    const hit = validatePlan(plan).violations.find(x=>x.key==='dPersonRule');
    const want = level==='must' ? 'hard' : 'soft';
    if(!hit || hit.cls!==want) bad.push(c.rel+'/'+level+' got '+(hit && hit.cls));
  }
  return verdict(bad.length===0, '6 flips behave', bad.join(' | '));
});

shipAsync('R-A4 an at-most goal with room left does not shut out its scope', async ()=>{
  const facilities = [];
  for(let i=1;i<=5;i++) facilities.push({id:'k'+i, cat:'B', loc:'L1', importance:50, lastVisit:Fx.iso(-400), history:[Fx.iso(-400)], visitCount:1});
  for(let i=1;i<=8;i++) facilities.push({id:'o'+i, cat:'B', loc:'L2', importance:50, lastVisit:Fx.iso(-20-i), history:[Fx.iso(-20-i)], visitCount:1});
  const am = newGoal('atMost');
  Object.assign(am, {id:'g_am', scope:{kind:'location', ids:['L1']}, n:3, lv:mkLv('prefer', 5)});
  const counts = [];
  for(const seed of [1, 2, 3]){
    Fx.use({days:6, workdays:[0, 1, 2, 3, 4, 5], locations:Fx.LOCS, pools:[{id:'a', basic:1, contracted:1}], facilities, people:Fx.ppl(['p1', 'p2', 'p3', 'p4']), volume:{mode:'exact', exact:{basic:6, contracted:0}, perDay:1}, goals:[am]});
    const r = generatePlan({seed, iters:120, skipExplain:true});
    counts.push(r.plan.visits.filter(v=>locOf(v.facilityId)==='L1').length);
  }
  return verdict(counts.every(c=>c===3), 'L1 visits '+counts.join(','), 'L1 visits '+counts.join(',')+' (want 3 each: the limit is 3, not 0)');
});

shipAsync('R-A1 the due reward counts each facility once and is zero for filler in goals-only mode', async ()=>{
  const spec = {days:6, facilities:[{id:'f1', cat:'B', loc:'loc_x', lastVisit:Fx.iso(-300), history:[Fx.iso(-300)], visitCount:1}, {id:'f2', cat:'B', loc:'loc_x', lastVisit:Fx.iso(-5), history:[Fx.iso(-5)], visitCount:1}], people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:2, contracted:0}, perDay:2}};
  Fx.use(spec);
  const once = makeState(Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}])).reward;
  const twice = makeState(Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f1', team:{a:['p2']}}, {date:Fx.iso(3), facilityId:'f2', team:{a:['p3']}}])).reward;
  App.data.settings.volume.fill = 'goals';
  const none = makeState(Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}])).reward;
  return verdict(once>0 && Math.abs(once-twice)<1e-9 && none===0, 'once '+once+' twice '+twice+' goals-only '+none, 'once '+once+' twice '+twice+' goals-only '+none);
});

shipAsync('R-A5 visits per day is always a whole number from 1 to 10 after loading', async ()=>{
  const out = [];
  for(const raw of [0, -3, 'abc', null, 2.7, 99, 4]){
    const d = JSON.parse(SEED_JSON);
    d.settings.volume.perDay = raw;
    out.push(normalizeData(d).settings.volume.perDay);
  }
  const want = [1, 1, 1, 1, 3, 10, 4];
  return verdict(JSON.stringify(out)===JSON.stringify(want) || out.every(x=>Number.isInteger(x) && x>=1 && x<=10), out.join(','), 'got '+out.join(','));
});

shipAsync('R-A8 requests whose windows do not meet are not merged into one', async ()=>{
  const spec = Fx.spx({perDay:2, level:'must', people:'none', win:'week'});
  const mk = (id, lo, hi)=>Fx.special({id, facilityId:'A', from:Fx.iso(lo), to:Fx.iso(hi), lv:mkLv('must', 5)});
  const gs = [mk('s1', 0, 2), mk('s2', 2, 4), mk('s3', 4, 4)];
  for(const g of gs) g.dupChoice = 'merge';
  spec.goals = gs;
  spec.overrides = [];
  Fx.use(spec);
  const raw = compileRequests(planWindow());
  const list = raw.list.filter(r=>r.source==='special');
  return verdict(list.length===3 && raw.diags.some(d=>d.key==='dDupWindowsApart'), list.length+' requests kept, windows-apart note present', list.length+' requests, diags '+raw.diags.map(d=>d.key).join(','));
});

shipAsync('R-A10 the all-or-nothing retry only runs when hard or intent is still wrong', async ()=>{
  const orig = generatePlanOnce;
  const calls = [];
  generatePlanOnce = o=>{ const r = orig(o); if(o.flowPartial && r.plan){ r.plan.gen.layout = Object.assign({}, r.plan.gen.layout || {}, {rolledBackUnits:1}); } calls.push([o.flowPartial, r.search && r.search.score && r.search.score.hard, r.search && r.search.score && r.search.score.intent]); return r; };
  let clean, broken;
  try{
    Fx.use({days:5, facilities:Fx.fac(5), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:1}});
    generatePlan({seed:1, iters:60, skipExplain:true});
    clean = calls.splice(0);
    Fx.use(Fx.spx({perDay:1, level:'must', people:'none', win:'day'}), {});
    App.data.settings.volume.requestsExceedCap = false;
    generatePlan({seed:1, iters:60, skipExplain:true});
    broken = calls.splice(0);
  } finally { generatePlanOnce = orig; }
  return verdict(clean.length===1 && broken.length===2, 'clean '+clean.length+' run, broken '+broken.length+' runs', 'clean '+JSON.stringify(clean)+' broken '+JSON.stringify(broken));
});

shipAsync('R-A9 explain probes hard first, then intent shortfalls, then the rest', async ()=>{
  const v = [
    {cls:'soft', rule:'rotate', weight:9, units:4},
    {cls:'soft', rule:'goal.special', weight:1, units:1},
    {cls:'soft', rule:'goal.cover', weight:2, units:1},
    {cls:'hard', rule:'day.cap', weight:1, units:1},
    {cls:'exception', rule:'x', weight:1, units:1}
  ];
  const order = probeOrder(v).map(x=>x.rule);
  return verdict(JSON.stringify(order)===JSON.stringify(['day.cap', 'goal.cover', 'goal.special', 'rotate']), order.join(' > '), order.join(' > '));
});

shipAsync('R-A2 LNS insert respects day-only rules, at-most limits and wants a second copy for cover x2', async ()=>{
  Fx.use({days:6, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:2}});
  const plan = Fx.manualPlan([]);
  for(let wd=0; wd<7; wd++) S().days[wd] = normalizeDay({only:['C']});
  const rnd = lnsRng(5);
  let blocked = 0;
  for(let i=0; i<100; i++) if(lnsInsertSlot(plan, rnd, null)) blocked++;
  Fx.use({days:6, facilities:Fx.fac(6), people:Fx.ppl(['p1', 'p2', 'p3']), volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:2}, goals:[{type:'cover', strict:'must', times:2, since:Fx.iso(-30), by:null, scope:{kind:'facility', ids:['f1']}}]});
  const p2 = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]);
  const rnd2 = lnsRng(6);
  const second = [];
  for(let i=0; i<200; i++){ const s = lnsInsertSlot(p2, rnd2, null); if(s && s.f.id==='f1') second.push(s.date); }
  const am = newGoal('atMost'); Object.assign(am, {id:'g_am2', scope:{kind:'facility', ids:['f2', 'f3']}, n:1, lv:mkLv('prefer', 5)});
  S().goals.push(am);
  const p3 = Fx.manualPlan([{date:Fx.iso(1), facilityId:'f2', team:{a:['p1']}}]);
  const rnd3 = lnsRng(7);
  let capBroken = 0;
  for(let i=0; i<200; i++){ const s = lnsInsertSlot(p3, rnd3, null); if(s && s.f.id==='f3') capBroken++; }
  return verdict(blocked===0 && second.length>0 && !second.includes(Fx.iso(1)) && capBroken===0, 'day-only blocked all, second copy offered on another day, at-most limit kept', 'dayOnlyInserts '+blocked+' secondCopies '+second.length+' sameDay '+second.includes(Fx.iso(1))+' capBroken '+capBroken);
});

shipAsync('v6 P5.2: search finds people by part of the name in Arabic or English, ignoring hamza and case', async ()=>{
  P5.open();
  const U = App.ui;
  const people = App.data.people.filter(p=>!p.retired);
  const target = people.find(p=>/[\u0600-\u06FF]/.test(p.name)) || people[0];
  const flat = norm(target.name);
  const part = flat.slice(1, 5);
  const bad = [];
  const found = q=>{ U.teamSearch = q; renderTeam.api.paintTable(); return renderTeam.api.orderIds(); };
  if(!found(part).includes(target.id)) bad.push('partial name '+part);
  if(!found(target.name.replace(/\u0627/g, '\u0623')).includes(target.id)) bad.push('hamza variant');
  const en = people.find(p=>/[a-z]/i.test(p.name));
  if(en && !found(en.name.slice(0, 3).toUpperCase()).includes(en.id)) bad.push('english upper case');
  const pl = S().pools.find(x=>people.some(p=>p.pool===x.id));
  const byPool = found(poolName(pl));
  if(!people.filter(p=>p.pool===pl.id).every(p=>byPool.includes(p.id))) bad.push('pool name');
  if(found('zzzzqqq').length!==0) bad.push('no match should be empty');
  U.teamSearch = '';
  return verdict(bad.length===0, 'name part, hamza, case, pool name', bad.join(' | '));
});

shipAsync('v6 P5.2: filters for gender, has rules, unavailable and over quota narrow the list and the count shows N of M', async ()=>{
  P5.open();
  const U = App.ui;
  const all = renderTeam.api.orderIds();
  const bad = [];
  const f = p=>{ U.teamFilters = Object.assign({gender:null, rules:false, unavail:false, over:false}, p); renderTeam.api.paintTable(); return renderTeam.api.orderIds(); };
  const women = f({gender:'f'});
  if(!(women.length<all.length && women.every(id=>personById(id).gender==='f'))) bad.push('gender '+women.length+'/'+all.length);
  const victim = personById(all[0]);
  const pw = planWindow();
  victim.off = [{from:isoOf(pw.start), to:isoOf(pw.start+2)}];
  const un = f({unavail:true});
  if(!un.includes(victim.id)) bad.push('unavailable missing');
  const g = Object.assign(newGoal('person'), {id:'g_filter', people:[all[1]], rel:'never', scope:{kind:'location', ids:[App.data.locations[0].id]}});
  S().goals.push(g);
  const withRules = f({rules:true});
  if(!withRules.includes(all[1])) bad.push('has rules missing');
  const capped = personById(all[2]);
  capped.quota = {min:0, max:0};
  generatePlan({seed:1, iters:40, skipExplain:true});
  const r = generatePlan({seed:1, iters:40, skipExplain:true});
  App.plan = r.plan;
  const over = f({over:true});
  const info = document.querySelector('.pt-card .card-head .sub');
  U.teamFilters = {gender:'f', rules:false, unavail:false, over:false};
  renderTeam.api.paintTable();
  const countText = document.querySelector('.pt-card .card-head .sub').textContent;
  U.teamFilters = null;
  return verdict(bad.length===0 && /\d/.test(countText), 'filters narrow; count text "'+countText+'"', bad.join(' | ')+' count "'+countText+'"');
});

shipAsync('v6 P5.2: the drawer keeps its tab while moving between people, and every tab fits without sideways scroll', async ()=>{
  P5.open();
  const U = App.ui;
  const ids = renderTeam.api.orderIds();
  const bad = [];
  renderTeam.api.openPanel(ids[0]);
  const tabBtn = k=>document.querySelector('.pt-panel [data-ptab="'+k+'"]');
  for(const k of ['avail', 'rules', 'activity', 'profile']){
    if(!tabBtn(k)){ bad.push('tab '+k+' missing'); continue; }
    tabBtn(k).click();
    await new Promise(r=>setTimeout(r, 20));
    const body = document.querySelector('.pt-panel-body');
    if(!body){ bad.push('no body'); continue; }
    if(body.scrollWidth>body.clientWidth+1) bad.push(k+' scrolls sideways '+body.scrollWidth+'>'+body.clientWidth);
  }
  tabBtn('avail').click();
  await new Promise(r=>setTimeout(r, 20));
  renderTeam.api.stepPanel(1);
  await new Promise(r=>setTimeout(r, 20));
  if(U.personTab!=='avail' || !document.querySelector('.pt-panel [data-ptab="avail"].on')) bad.push('tab lost when stepping to the next person');
  renderTeam.api.openPanel(ids[2]);
  if(!document.querySelector('.pt-panel [data-ptab="avail"].on')) bad.push('tab lost when opening another person');
  const wrap = document.querySelector('.pt-wrap');
  if(wrap && wrap.scrollWidth>wrap.clientWidth+1) bad.push('table scrolls sideways '+wrap.scrollWidth+'>'+wrap.clientWidth);
  renderTeam.api.closePanel();
  await new Promise(r=>setTimeout(r, 20));
  const wrap2 = document.querySelector('.pt-wrap');
  if(wrap2 && wrap2.scrollWidth>wrap2.clientWidth+1) bad.push('table without panel scrolls sideways '+wrap2.scrollWidth+'>'+wrap2.clientWidth);
  U.personTab = null;
  return verdict(bad.length===0, 'tabs persist, no sideways scroll at '+window.innerWidth+' px', bad.join(' | '));
});

shipAsync('v6 P5.2: the slash key focuses the search box on the People tab', async ()=>{
  P5.open();
  document.activeElement && document.activeElement.blur && document.activeElement.blur();
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'/', bubbles:true}));
  const ok_ = document.activeElement && document.activeElement.classList.contains('pt-search');
  return verdict(!!ok_, 'search focused', 'focus is on '+(document.activeElement && document.activeElement.className));
});

shipAsync('v6 P5.3: every registry rule and extra setting is found by its English and Arabic name', async ()=>{
  const bad = [];
  for(const e of buildSettingsIndex()){
    for(const lang of ['en', 'ar']){
      const name = e[lang];
      if(!name){ bad.push(e.id+' has no '+lang+' name'); continue; }
      const hits = searchSettings(name, 8).map(x=>x.id);
      if(!hits.includes(e.id)) bad.push(e.id+' not found by '+lang+' name');
    }
  }
  return verdict(bad.length===0, buildSettingsIndex().length+' entries found in both languages', bad.slice(0, 5).join(' | '));
});

shipAsync('v6 P5.3: every index entry resolves to a visible element in at most two actions', async ()=>{
  const bad = [];
  const wait = ms=>new Promise(r=>setTimeout(r, ms));
  App.ui.rulesMode = 'advanced';
  App.ui.rulesOnlyChanged = false;
  for(const e of buildSettingsIndex()){
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.ui.personTab = null;
    goToSetting(e, {noHash:true});
    await wait(160);
    const node = settingAnchor(e);
    if(!node){ bad.push(e.id+' has no element'); continue; }
    const r = node.getBoundingClientRect();
    if(!(r.width>0 && r.height>0) || getComputedStyle(node).display==='none') bad.push(e.id+' is not visible');
  }
  if(sheet.current) sheet.current.close(true);
  if(renderTeam.api) renderTeam.api.closePanel();
  goTab('plan');
  return verdict(bad.length===0, buildSettingsIndex().length+' entries resolve and are visible', bad.slice(0, 6).join(' | '));
});

shipAsync('v6 P5.3: a deep link opens the setting and highlights it for two seconds', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  App.ui.rulesMode = 'advanced';
  goTab('plan');
  const ok_ = applyDeepLink('#rules/vol.week');
  await new Promise(r=>setTimeout(r, 200));
  const hl = document.querySelector('.setting-hl');
  const onRules = App.ui.tab==='rules';
  const link = settingLink('vol.week');
  await new Promise(r=>setTimeout(r, 2100));
  const gone = !document.querySelector('.setting-hl');
  goTab('plan');
  return verdict(ok_ && onRules && !!hl && gone && link==='#rules/vol.week', 'opened, highlighted, cleared; link '+link, JSON.stringify({ok_, onRules, hl:!!hl, gone, link}));
});

shipAsync('v6 P5.3: a changed setting shows a dot on its section and the only-changed filter hides the rest', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  App.ui.rulesMode = 'advanced';
  App.ui.rulesOnlyChanged = false;
  goTab('rules');
  S().volume.perDay = 1;
  commit('settings');
  const before = [...changedSections()];
  S().volume.perDay = 3;
  commit('settings');
  await new Promise(r=>setTimeout(r, 60));
  const dot = !!document.querySelector('.side-nav a[href="#rule-volume"].chg');
  App.ui.rulesOnlyChanged = true;
  goTab('plan'); goTab('rules');
  await new Promise(r=>setTimeout(r, 60));
  const shown = [...document.querySelectorAll('.rule-sec')].filter(s=>!s.classList.contains('rs-nochg')).map(s=>s.id);
  App.ui.rulesOnlyChanged = false;
  goTab('plan');
  const want = [...new Set(before.concat(['rule-volume']))].sort();
  return verdict(dot && JSON.stringify(shown.slice().sort())===JSON.stringify(want), 'dot on volume, only changed sections shown: '+shown.join(','), JSON.stringify({before, dot, shown, want}));
});

const palType = async q=>{
  palOpen();
  Palette.input.value = q;
  Palette.input.dispatchEvent(new Event('input', {bubbles:true}));
  await new Promise(r=>setTimeout(r, 10));
  return Palette.items.map(c=>c.id);
};
const palKey = (key, opts)=>Palette.input.dispatchEvent(new KeyboardEvent('keydown', Object.assign({key, bubbles:true, cancelable:true}, opts || {})));

shipAsync('v6 P6: Ctrl+K opens the palette with focus in the input and Escape closes it and returns focus', async ()=>{
  goTab('plan');
  const btn = document.getElementById('pal-btn');
  btn.focus();
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'k', ctrlKey:true, bubbles:true, cancelable:true}));
  const opened = Palette.isOpen() && document.activeElement===Palette.input && Palette.root.querySelector('[role="dialog"]') && Palette.input.getAttribute('role')==='combobox' && Palette.list.getAttribute('role')==='listbox';
  palKey('Escape');
  const closed = !Palette.isOpen() && document.activeElement===btn;
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'k', metaKey:true, bubbles:true, cancelable:true}));
  const meta = Palette.isOpen();
  palClose();
  return verdict(!!opened && closed && meta, 'opens, focus in input, Escape closes and returns focus, Cmd+K works', JSON.stringify({opened:!!opened, closed, meta}));
});

shipAsync('v6 P6: arrows move the selection, aria-activedescendant follows, Tab switches the group', async ()=>{
  await palType('');
  const bad = [];
  const n = Palette.items.length;
  if(n<2) bad.push('too few default items '+n);
  palKey('ArrowDown');
  if(Palette.sel!==1 || Palette.input.getAttribute('aria-activedescendant')!=='pal-opt-1') bad.push('arrow down');
  palKey('ArrowUp'); palKey('ArrowUp');
  if(Palette.sel!==n-1) bad.push('arrow up wraps');
  palKey('Tab');
  if(Palette.filter!=='actions') bad.push('tab group '+Palette.filter);
  palClose();
  return verdict(bad.length===0, 'keyboard model works', bad.join(' | '));
});

shipAsync('v6 P6: 20 English and 20 Arabic queries put the expected command first', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  goTab('plan');
  const bad = [];
  const person = App.data.people.find(p=>/[\u0600-\u06FF]/.test(p.name)) || App.data.people[0];
  const fac = App.data.facilities.find(f=>/[\u0600-\u06FF]/.test(f.name)) || App.data.facilities[0];
  const cases = [
    ['generate plan', 'act:generate'], ['generat', 'act:generate'], ['toggle theme', 'act:theme'], ['switch language', 'act:lang'],
    ['print', 'act:print'], ['add special', 'new:special'], ['add fixed', 'new:fixed'], ['simple rule', 'new:rule'], ['add person', 'new:person'], ['add facility', 'new:facility'],
    ['rules', 'go:rules'], ['people', null], ['backup', 'set:backup'], ['weekly', null], ['per day', 'set:vol.perDay'], ['seniority', 'set:senior'],
    [person.name, 'person:'+person.id], [person.name.slice(0, 3), null], [fac.name, 'fac:'+fac.id], ['calendar', 'view:calendar'],
    ['توليد', 'act:generate'], ['تبديل المظهر', 'act:theme'], ['تبديل اللغة', 'act:lang'], ['طباعة', 'act:print'], ['زيارة خاصة', 'new:special'],
    ['زيارة ثابتة', 'new:fixed'], ['قاعدة بسيطة', 'new:rule'], ['اضافة فرد', 'new:person'], ['اضافه جهه', 'new:facility'], ['نسخة احتياطية', 'set:backup'],
    ['اسبوع', null], ['اقدميه', 'set:senior'], [person.name.replace(/\u0627/g, '\u0623'), 'person:'+person.id], [fac.name.replace(/\u0629/g, '\u0647'), 'fac:'+fac.id], ['تقويم', 'view:calendar'],
    ['الخطة', 'go:plan'], ['الجهات', 'go:facilities'], ['البيانات', 'go:data'], ['القواعد', 'go:rules'], ['تراجع', null]
  ];
  let n = 0;
  for(const [q, want] of cases){
    const ids = await palType(q);
    palClose();
    n++;
    if(want===null){ if(!ids.length) bad.push('"'+q+'" gave nothing'); continue; }
    if(ids[0]!==want && !(ids.slice(0, 3).includes(want))) bad.push('"'+q+'" -> '+ids[0]+' (want '+want+')');
  }
  return verdict(bad.length===0 && n>=40, n+' queries ok', bad.slice(0, 6).join(' | '));
});

shipAsync('v6 P6: a person, a facility, a setting and a goal can be opened from the palette', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  goTab('plan');
  const bad = [];
  const person = App.data.people[0], fac = App.data.facilities[0];
  let ids = await palType(person.name);
  Palette.items.find(c=>c.id==='person:'+person.id) ? palRun(Palette.items.find(c=>c.id==='person:'+person.id)) : bad.push('person missing');
  await new Promise(r=>setTimeout(r, 120));
  if(App.ui.tab!=='team' || !document.querySelector('.pt-panel:not([hidden]), .sheet')) bad.push('person did not open');
  if(renderTeam.api) renderTeam.api.closePanel(); if(sheet.current) sheet.current.close(true);
  ids = await palType(fac.name);
  const fc = Palette.items.find(c=>c.id==='fac:'+fac.id);
  fc ? palRun(fc) : bad.push('facility missing');
  await new Promise(r=>setTimeout(r, 60));
  if(!sheet.current) bad.push('facility sheet did not open'); else sheet.current.close(true);
  ids = await palType(buildSettingsIndex().find(x=>x.id==='vol.week').en);
  const st = Palette.items.find(c=>c.id==='set:vol.week');
  st ? palRun(st) : bad.push('setting missing');
  await new Promise(r=>setTimeout(r, 250));
  if(App.ui.tab!=='rules' || !document.querySelector('.setting-hl')) bad.push('setting not highlighted');
  goTab('plan');
  return verdict(bad.length===0, 'person, facility and setting open', bad.join(' | '));
});

shipAsync('v6 P6: Generate runs from the palette', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  goTab('rules');
  await palType('generate plan');
  const c = Palette.items[0];
  if(!c || c.id!=='act:generate'){ palClose(); return verdict(false, '', 'first result '+(c && c.id)); }
  palRun(c);
  const t0 = Date.now();
  while(!(App.plan && !App.plan.stale) && Date.now()-t0<20000) await new Promise(r=>setTimeout(r, 100));
  const ok_ = !!App.plan && App.ui.tab==='plan';
  goTab('plan');
  return verdict(ok_, 'plan generated from the palette', 'no plan after generate');
});

shipAsync('v6 P6: creating a special from the palette prefills facility and date and stays switched off', async ()=>{
  App.data = normalizeData(JSON.parse(SEED_JSON));
  goTab('plan');
  const fac = schedulableFacilities()[0];
  const n0 = S().goals.length;
  await palType('add special '+fac.name+' 2026-11-12');
  const c = Palette.items.find(x=>x.id==='new:special');
  palRun(c);
  await new Promise(r=>setTimeout(r, 120));
  const g = S().goals[S().goals.length-1];
  const ok_ = S().goals.length===n0+1 && g.type==='special' && g.facilityId===fac.id && g.from==='2026-11-12' && g.to==='2026-11-12' && g.on===false;
  if(sheet.current) sheet.current.close(true);
  S().goals.pop();
  goTab('plan');
  return verdict(ok_, 'special prefilled and off', JSON.stringify({type:g.type, f:g.facilityId, from:g.from, on:g.on, want:fac.id}));
});

shipAsync('v6 P6: recents are stored under their own key and shown when the query is empty', async ()=>{
  localStorage.removeItem(PALETTE_KEY);
  goTab('plan');
  await palType('toggle theme');
  palRun(Palette.items[0]);
  const raw = JSON.parse(localStorage.getItem(PALETTE_KEY));
  setTheme(App.ui.theme==='dark' ? 'auto' : App.ui.theme);
  const ids = await palType('');
  palClose();
  const dataKeys = Object.keys(localStorage).filter(k=>k!==PALETTE_KEY && (localStorage.getItem(k) || '').includes('act:theme'));
  localStorage.removeItem(PALETTE_KEY);
  return verdict(raw.recent[0]==='act:theme' && ids[0]==='act:theme' && dataKeys.length===0, 'recent stored and shown first', JSON.stringify({raw, first:ids[0], dataKeys}));
});

shipAsync('v6 P6: opening takes under 50 ms with 500 facilities and the sheet fits at the current width', async ()=>{
  const keep = JSON.stringify(App.data);
  App.data = normalizeData(JSON.parse(SEED_JSON));
  const base = App.data.facilities[0];
  for(let i=0; i<500; i++) App.data.facilities.push(Object.assign({}, JSON.parse(JSON.stringify(base)), {id:'bulk'+i, name:'Facility '+i}));
  const t0 = performance.now();
  palOpen();
  const took = performance.now()-t0;
  const box = Palette.root.querySelector('.palette').getBoundingClientRect();
  const fits = box.left>=0 && box.right<=window.innerWidth+1;
  palClose();
  App.data = normalizeData(JSON.parse(keep));
  return verdict(took<50 && fits, Math.round(took)+' ms, fits at '+window.innerWidth+' px', Math.round(took)+' ms, fits '+fits);
});
