const P2 = {
  base(extra){
    const spec = Fx.merge({days:6, facilities:[].concat(Fx.fac(4, 'B'), Fx.fac(3, 'C').map((f, i)=>Object.assign(f, {id:'c'+(i+1)}))), people:Fx.ppl(['p1', 'p2', 'p3', 'p4', 'p5']), pools:[{id:'a', basic:1, contracted:1}], volume:{mode:'exact', exact:{basic:0, contracted:0}, perDay:2}}, extra || {});
    spec.people = (extra && extra.people) || spec.people;
    spec.facilities = (extra && extra.facilities) || spec.facilities;
    Fx.use(spec);
    return spec;
  },
  plan(list, extra){ return Fx.manualPlan(list, extra); },
  flips:[
    {rule:'day.cap', build(){ P2.base(); S().days[0] = normalizeDay({cap:1}); return P2.plan([{date:Fx.iso(0), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(0), facilityId:'f2', team:{a:['p2']}}]); }, set(lv){ S().days[0].cap.lv = lv; }},
    {rule:'day.min', build(){ P2.base(); S().days[1] = normalizeDay({min:2}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().days[1].min.lv = lv; }},
    {rule:'day.kind', build(){ P2.base(); S().days[1] = normalizeDay({lean:'contracted'}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().days[1].kind.lv = lv; }},
    {rule:'day.category', build(){ P2.base(); S().days[1] = normalizeDay({favor:'C'}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().days[1].category.lv = lv; }},
    {rule:'day.band', build(){ P2.base(); App.data.locations.push({id:'loc_far', name:'F', km:80}); App.data.facilities.find(f=>f.id==='f1').locationId = 'loc_far'; S().days[1] = normalizeDay({dist:'near'}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().days[1].band.lv = lv; }},
    {rule:'day.only', build(){ P2.base(); S().days[1] = normalizeDay({only:['C']}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().days[1].only.lv = lv; }},
    {rule:'fac.weekdays', build(){ P2.base(); App.data.facilities.find(f=>f.id==='f1').weekdays = [3]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ App.data.facilities.find(f=>f.id==='f1').lv = Object.assign(facilityLvOf(null), {weekdays:lv}); }},
    {rule:'vol.week', build(){ P2.base(); S().volume.perWeek = 1; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}]); }, set(lv){ S().lv['vol.week'] = lv; }},
    {rule:'vol.everyDay', build(){ P2.base(); S().volume.requireEveryEligibleDay = true; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().lv['vol.everyDay'] = lv; }},
    {rule:'vol.gap', build(){ P2.base(); S().spacing = {mode:'gap', gap:3, strict:'must'}; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}]); }, set(lv){ S().lv['vol.gap'] = lv; }},
    {rule:'vol.activity', build(){ P2.base(); S().patterns.activity = {on:true, strict:'must', pattern:{minRest:1, maxRun:null, cycle:null}}; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}]); }, set(lv){ S().lv['vol.activity'] = lv; }},
    {rule:'p.blocked', build(){ P2.base(); App.data.people.find(p=>p.id==='p1').blocked = ['f1']; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {blocked:lv}); }},
    {rule:'p.avail', build(){ P2.base(); App.data.people.find(p=>p.id==='p1').off = [{from:Fx.iso(1), to:Fx.iso(1)}]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {avail:lv}); }},
    {rule:'p.maxRun', build(){ P2.base(); App.data.people.find(p=>p.id==='p1').maxRun = 1; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {maxRun:lv}); }},
    {rule:'p.maxWeek', build(){ P2.base(); App.data.people.find(p=>p.id==='p1').maxPerWeek = 1; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(3), facilityId:'f2', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {maxWeek:lv}); }},
    {rule:'p.rest', build(){ P2.base(); App.data.people.find(p=>p.id==='p1').pattern = {mode:'custom', minRest:2}; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {rest:lv}); }},
    {rule:'p.quota', build(){ P2.base(); App.data.people.find(p=>p.id==='p1').quota = {min:null, max:1}; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(3), facilityId:'f2', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {quota:lv}); }},
    {rule:'gender.rule', build(){ P2.base({people:[{id:'p1', gender:'m'}, {id:'p2', gender:'m'}], pools:[{id:'a', basic:2, contracted:2}]}); S().genderRules = [{id:'g', on:true, kinds:['basic'], categories:[], facilities:[], minEach:50, avoidEven:false, lv:mkLv('prefer', 8)}]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1', 'p2']}}]); }, set(lv){ S().genderRules[0].lv = lv; }},
    {rule:'senior', build(){ P2.base({people:[{id:'p1', skill:10}, {id:'p2', skill:90}], facilities:[{id:'f1', cat:'B', importance:80}]}); S().seniority = Object.assign({}, S().seniority, {on:true, threshold:50, mode:'require'}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().lv.senior = lv; }},
    {rule:'pair', build(){ P2.base({pools:[{id:'a', basic:2, contracted:2}]}); S().pairs = [{id:'pr', a:'p1', b:'p2', type:'avoid', mode:'rigid', strength:'medium', on:true, lv:mkLv('must', 5)}]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1', 'p2']}}]); }, set(lv){ S().pairs[0].lv = lv; }},
    {rule:'rotate', build(){ P2.base({history:{fpv:{'f1|p1':5}}}); S().repeatBlock = {on:true, times:2}; S().rotation.on = true; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().lv.rotate = lv; }},
    {rule:'gender.pref.m', build(){ P2.base({people:[{id:'p1', gender:'m'}, {id:'p2'}]}); S().genderPrefs.m = {on:true, dist:null, kind:'contracted', days:[], strength:'medium'}; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().lv['gender.pref.m'] = lv; }},
    {rule:'dist.pick', build(){ P2.base(); App.data.locations.push({id:'loc_far', name:'F', km:80}); App.data.facilities.find(f=>f.id==='f1').locationId = 'loc_far'; S().distance.pickBias = 'near'; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().lv['dist.pick'] = lv; }},
    {rule:'p.dist', build(){ P2.base(); App.data.locations.push({id:'loc_far', name:'F', km:80}); App.data.facilities.find(f=>f.id==='f1').locationId = 'loc_far'; App.data.people.find(p=>p.id==='p1').distPref = 'near'; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ const p = App.data.people.find(x=>x.id==='p1'); p.lv = Object.assign(personLvOf(p), {dist:lv}); }},
    {rule:'vol.share', build(){ P2.base({volume:{mode:'fill', share:0.5, perDay:2}}); return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}], {targets:{mode:'fill', share:0.5}}); }, set(lv){ S().lv['vol.share'] = lv; }},
    {rule:'vol.exact', build(){ P2.base(); S().volume.mode = 'exact'; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}], {targets:{mode:'exact', basic:2, contracted:0}}); }, set(lv){ S().lv['vol.exact'] = lv; }},
    {rule:'goal.person', build(){ P2.base(); S().goals = [normalizeGoal({id:'gp', type:'person', on:true, people:['p1'], rel:'never', n:1, scope:{kind:'all', ids:[]}})]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().goals[0].lv = lv; }},
    {rule:'goal.atMost', build(){ P2.base(); S().goals = [normalizeGoal({id:'ga', type:'atMost', on:true, n:1, scope:{kind:'all', ids:[]}})]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(2), facilityId:'f2', team:{a:['p2']}}]); }, set(lv){ S().goals[0].lv = lv; }},
    {rule:'goal.atLeast', build(){ P2.base(); S().goals = [normalizeGoal({id:'gl', type:'atLeast', on:true, n:3, scope:{kind:'all', ids:[]}})]; return P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]); }, set(lv){ S().goals[0].lv = lv; }}
  ],
  flip(sc){
    const out = [];
    for(const level of ['must', 'prefer']){
      const plan = sc.build();
      sc.set(mkLv(level, 5));
      const v = validatePlan(plan);
      const mine = v.violations.filter(x=>x.rule===sc.rule);
      if(!mine.length){ out.push(sc.rule+' '+level+': no violation ('+v.violations.map(x=>x.key+':'+x.rule).join(',')+')'); continue; }
      const want = level==='must' ? 'hard' : 'soft';
      const wrong = mine.filter(x=>x.cls!==want && x.cls!=='exception');
      if(wrong.length) out.push(sc.rule+' '+level+': class '+wrong[0].cls);
      if(mine.some(x=>x.weight!==5 || x.level!==level)) out.push(sc.rule+' '+level+': level/weight '+mine[0].level+'/'+mine[0].weight);
      if(mine.some(x=>!(x.units>0))) out.push(sc.rule+' '+level+': units');
    }
    return out;
  }
};

P2.flips.forEach(sc=>regress('v4: '+sc.rule+' moves between hard and soft with its level', ()=>{
  const bad = P2.flip(sc);
  return verdict(!bad.length, 'must→hard prefer→soft', bad.join(' | '));
}));

regress('v4: structural rules are always hard with weight 10', ()=>{
  P2.base();
  const plan = P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p1']}}]);
  const v = validatePlan(plan);
  const s = v.violations.filter(x=>x.rule && x.rule.startsWith('struct.'));
  return verdict(s.length>0 && s.every(x=>x.level==='always' && x.weight===10 && (x.cls==='hard' || x.cls==='exception')), s.length+' structural', JSON.stringify(s.map(x=>[x.rule, x.level, x.weight, x.cls])));
});

regress('v4: hardScore and softScore are weighted unit sums of the violations', ()=>{
  P2.base();
  S().days[1] = normalizeDay({min:3, lean:'contracted'});
  S().days[1].min.lv = mkLv('prefer', 4);
  S().days[1].kind.lv = mkLv('prefer', 2);
  const plan = P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}, {date:Fx.iso(1), facilityId:'f2', team:{a:['p2']}}]);
  const v = validatePlan(plan);
  let h = 0, s = 0;
  for(const x of v.violations){ if(x.cls==='hard') h += x.weight*x.units; else if(x.cls==='soft') s += x.weight*x.units; }
  const min = v.violations.find(x=>x.rule==='day.min'), kind = v.violations.find(x=>x.rule==='day.kind');
  const ok = Math.abs(h-v.hardScore)<1e-6 && Math.abs(s-v.softScore)<1e-6 && min && min.units===1 && min.weight===4 && kind && kind.units===2 && kind.weight===2;
  return verdict(ok, 'sums match', JSON.stringify({h, s, hs:v.hardScore, ss:v.softScore, min:min && [min.units, min.weight], kind:kind && [kind.units, kind.weight]}));
});

regress('v4: ten units at weight 1 equal one unit at weight 10 for a Prefer rule', ()=>{
  P2.base();
  S().days[1] = normalizeDay({min:11});
  S().days[1].min.lv = mkLv('prefer', 1);
  const plan = P2.plan([{date:Fx.iso(1), facilityId:'f1', team:{a:['p1']}}]);
  const a = validatePlan(plan).violations.find(x=>x.rule==='day.min');
  S().days[1] = normalizeDay({min:2});
  S().days[1].min.lv = mkLv('prefer', 10);
  const b = validatePlan(plan).violations.find(x=>x.rule==='day.min');
  return verdict(a && b && a.units*a.weight===b.units*b.weight, a && b ? a.units*a.weight+'='+b.units*b.weight : 'missing', 'no match');
});

regress('v4: incremental delta equals the full evaluation on 1000 random moves', ()=>{
  const keep = App.debugScore;
  App.debugScore = true;
  App.data = normalizeData(JSON.parse(SEED_JSON));
  S().period = Object.assign({}, S().period, {goal:'range', preset:'custom', start:Fx.W1.start, end:'2026-10-15'});
  const r = generatePlan();
  const plan = r.plan;
  const st = makeState(plan);
  const rnd = Fx.rng(4242);
  const days = plan.days;
  const others = schedulableFacilities().filter(f=>!plan.visits.some(v=>v.facilityId===f.id));
  const people = activePeople();
  let bad = 0, n = 0, detail = '';
  try{
    for(let i=0; i<1000; i++){
      const pick = rnd();
      const v = plan.visits[Math.floor(rnd()*plan.visits.length)];
      let move = null;
      if(pick<0.3) move = {ops:[{op:'set', id:v.id, fields:{date:days[Math.floor(rnd()*days.length)]}}]};
      else if(pick<0.5){ const f = others[Math.floor(rnd()*others.length)]; move = {ops:[{op:'set', id:v.id, fields:{facilityId:f.id}}]}; }
      else if(pick<0.8){
        const w = plan.visits[Math.floor(rnd()*plan.visits.length)];
        const pool = Object.keys(v.team).find(k=>(v.team[k]||[]).length);
        if(!pool || !(w.team[pool]||[]).length) continue;
        const a = v.team[pool].slice(), b = w.team[pool].slice();
        const ia = Math.floor(rnd()*a.length), ib = Math.floor(rnd()*b.length);
        const x = a[ia]; a[ia] = b[ib]; b[ib] = x;
        const t1 = Object.assign({}, v.team, {[pool]:a});
        const t2 = Object.assign({}, w.team, {[pool]:b});
        move = v===w ? {ops:[{op:'set', id:v.id, fields:{team:t1}}]} : {ops:[{op:'set', id:v.id, fields:{team:t1}}, {op:'set', id:w.id, fields:{team:t2}}]};
      } else {
        const pool = Object.keys(v.team).find(k=>(v.team[k]||[]).length);
        if(!pool) continue;
        const p = people[Math.floor(rnd()*people.length)];
        const list = v.team[pool].slice();
        list[Math.floor(rnd()*list.length)] = p.id;
        move = {ops:[{op:'set', id:v.id, fields:{team:Object.assign({}, v.team, {[pool]:list})}}]};
      }
      const before = {hard:st.hard, soft:st.soft};
      const d = deltaMove(st, move);
      const fresh = validatePlan(JSON.parse(JSON.stringify(plan)));
      const freshReward = sum(plan.visits, x=>lvOf('due.priority').w*(st.due.get(x.facilityId)||0));
      const freshSoft = Math.round((fresh.softScore-freshReward)*1000)/1000;
      n++;
      if(fresh.hardScore!==st.hard || Math.abs(freshSoft-st.soft)>0.002){ bad++; detail = 'move '+i+' hard '+fresh.hardScore+'/'+st.hard+' soft '+freshSoft+'/'+st.soft; break; }
      if(Math.abs((before.hard+d.delta.hard)-st.hard)>1e-6) { bad++; detail = 'delta hard mismatch'; break; }
      if(rnd()<0.5){ d.revert(); if(st.hard!==before.hard || st.soft!==before.soft){ bad++; detail = 'revert mismatch at '+i; break; } }
    }
  } finally { App.debugScore = keep; }
  return verdict(bad===0 && n>800, n+' moves identical', detail || ('only '+n+' moves'));
});
