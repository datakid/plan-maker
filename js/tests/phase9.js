const P9 = {
  base(extra){
    return Fx.merge({
      days:6,
      pools:[{id:'a', basic:1, contracted:1}],
      facilities:Fx.fac(6),
      people:Fx.ppl(['p1','p2','p3','p4','p5','p6']),
      settings:{volume:{mode:'exact', exact:{basic:4, contracted:0}, perDay:2, perWeek:null}}
    }, extra || {});
  }
};

regress('v9: two fixed visits for the same place and day are both kept', ()=>{
  Fx.use(P9.base({overrides:[
    {id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:['p1'], fill:false, note:'a'},
    {id:'o2', on:true, date:Fx.iso(1), facilityId:'f1', people:['p2'], fill:false, note:'b'}
  ]}));
  const plan = generatePlan().plan;
  const n = plan.visits.filter(v=>v.facilityId==='f1' && v.date===Fx.iso(1)).length;
  return verdict(S().overrides.length===2 && n===2, '2 visits', 'overrides '+S().overrides.length+' visits '+n);
});

regress('v9: a place seat count shrinks the visit team and is clamped', ()=>{
  Fx.use(P9.base({pools:[{id:'a', basic:3, contracted:3}], settings:{volume:{exact:{basic:3, contracted:0}}}}));
  const f = App.data.facilities[0];
  f.seats = {a:1};
  f.pinned = true;
  const pool = S().pools[0];
  if(seatsForF(pool, 'basic', f)!==1) return verdict(false, '', 'seatsForF ignored the place seats');
  const plan = generatePlan().plan;
  const v = plan.visits.find(x=>x.facilityId===f.id);
  const n = v ? visitTeamIds(v).length : -1;
  f.seats = {a:99};
  const big = seatsForF(pool, 'basic', f);
  f.seats = {a:0};
  const none = seatsForF(pool, 'basic', f);
  return verdict(n===1 && big===9 && none===0, 'team of 1', 'team '+n+' big '+big+' none '+none);
});

regress('v9: a must far/near preference is never broken by the generated plan', ()=>{
  let bad = 0, hits = 0;
  for(let seed=1; seed<=8; seed++){
    Fx.use(P9.base({people:Fx.ppl(['p1','p2','p3','p4','p5','p6']).map((p, i)=>i===0 ? Object.assign(p, {distPref:'near', lv:{dist:mkLv('must', 5)}}) : p)}));
    App.data.locations.push({id:'loc_far', name:'Far', km:120});
    App.data.facilities.forEach((f, i)=>{ if(i%2) f.locationId = 'loc_far'; });
    const p1 = personById('p1');
    const plan = generatePlan({seed}).plan;
    for(const v of Fx.visits(plan, 'p1')){ hits++; if(distBand(personTravelKm(p1, facilityById(v.facilityId)))!=='near') bad++; }
  }
  return verdict(bad===0 && hits>0, hits+' visits all near', 'broken '+bad+' of '+hits);
});

regress('v9: a person range of 1 to 2 visits is respected', ()=>{
  let bad = 0;
  for(let seed=1; seed<=6; seed++){
    const g = Object.assign(newGoal('person'), {people:['p1'], rel:'between', n:1, n2:2, scope:{kind:'all', ids:[]}, strict:'must'});
    Fx.use(P9.base({goals:[g]}));
    const plan = generatePlan({seed}).plan;
    const q = Fx.count(plan, 'p1');
    if(q<1 || q>2) bad++;
  }
  return verdict(bad===0, '6/6', 'out of range '+bad);
});

regress('v9: fixed only mode plans exactly the fixed visits and special goals and nothing else', ()=>{
  let bad = 0;
  for(let seed=1; seed<=5; seed++){
    const sp = Object.assign(newGoal('special'), {facilityId:'f2', people:['p1'], fill:true, times:1});
    Fx.use(P9.base({
      overrides:[{id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:[], fill:true}],
      goals:[sp],
      settings:{volume:{mode:'fixed'}}
    }));
    const plan = generatePlan({seed}).plan;
    const ids = plan.visits.map(v=>v.facilityId).sort().join();
    if(ids!=='f1,f2') bad++;
  }
  return verdict(bad===0, '5/5', 'wrong visits in '+bad);
});

regress('v9: a special goal visit stays on its own place through optimisation', ()=>{
  let bad = 0;
  for(let seed=1; seed<=10; seed++){
    const sp = Object.assign(newGoal('special'), {facilityId:'f3', people:['p1'], fill:true, times:1});
    Fx.use(P9.base({goals:[sp]}));
    const plan = generatePlan({seed}).plan;
    const v = plan.visits.find(x=>x.special===sp.id);
    if(!v || v.facilityId!=='f3') bad++;
  }
  return verdict(bad===0, '10/10', 'moved or missing in '+bad);
});

regress('v9: a minimum per day puts a visit on every working day', ()=>{
  let bad = 0;
  for(let seed=1; seed<=6; seed++){
    Fx.use(P9.base({days:3, settings:{volume:{mode:'exact', exact:{basic:3, contracted:0}, perDay:2, minPerDay:1}}}));
    const plan = generatePlan({seed}).plan;
    const dates = new Set(plan.visits.map(v=>v.date));
    if(dates.size!==3 || dayCfg(Fx.ord(0)).min!==1) bad++;
  }
  return verdict(bad===0, '6/6', 'days missed in '+bad);
});

regress('v9: a fixed visit with auto fill off reports no empty seats', ()=>{
  Fx.use(P9.base({pools:[{id:'a', basic:3, contracted:3}], overrides:[{id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:['p1'], fill:false}], settings:{volume:{mode:'fixed'}}}));
  const plan = generatePlan().plan;
  const v = plan.visits.find(x=>x.facilityId==='f1');
  const open = v ? sum(Object.values(v.open||{})) : -1;
  const a = validatePlan(plan);
  const seatsViol = (a.violations||[]).filter(x=>x.key==='dOpenSeats').length;
  return verdict(v && visitTeamIds(v).length===1 && open===0 && seatsViol===0, 'no empty seats', 'team '+(v?visitTeamIds(v).length:'-')+' open '+open+' viol '+seatsViol);
});

regress('v9: seats locked on one visit apply to that visit only and leave no empty seats', ()=>{
  Fx.use(P9.base({
    pools:[{id:'a', basic:3, contracted:3}],
    overrides:[
      {id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:['p1'], fill:true, seats:{a:1}},
      {id:'o2', on:true, date:Fx.iso(2), facilityId:'f1', people:['p2'], fill:true, seats:{a:2}}
    ],
    settings:{volume:{mode:'fixed'}}
  }));
  const plan = generatePlan().plan;
  const v1 = plan.visits.find(x=>x.overrideId==='o1'), v2 = plan.visits.find(x=>x.overrideId==='o2');
  const n1 = visitTeamIds(v1).length, n2 = visitTeamIds(v2).length;
  const open = sum(plan.visits, v=>sum(Object.values(v.open||{})));
  return verdict(n1===1 && n2===2 && open===0, 'locked', 'n1 '+n1+' n2 '+n2+' open '+open);
});

regress('v9: people named for one visit only can be limited and excluded for that visit only', ()=>{
  let bad = 0;
  for(let seed=1; seed<=6; seed++){
    Fx.use(P9.base({
      pools:[{id:'a', basic:2, contracted:2}],
      overrides:[
        {id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:[], fill:true, only:['p5','p6']},
        {id:'o2', on:true, date:Fx.iso(2), facilityId:'f2', people:[], fill:true, never:['p1','p2','p3']}
      ],
      settings:{volume:{mode:'fixed'}}
    }));
    const plan = generatePlan({seed}).plan;
    const a = visitTeamIds(plan.visits.find(x=>x.overrideId==='o1')).slice().sort().join();
    const b = visitTeamIds(plan.visits.find(x=>x.overrideId==='o2'));
    if(a!=='p5,p6' || b.some(id=>['p1','p2','p3'].includes(id))) bad++;
  }
  return verdict(bad===0, '6/6', 'broken in '+bad);
});

regress('v9: a new person rule defaults to a range', ()=>{
  const g = newGoal('person');
  return verdict(g.rel==='between' && PERSON_RELS[0]==='between' && g.n2>=g.n, 'between first', g.rel+' '+PERSON_RELS.join());
});

regress('v9: two user-made visits for the same place and day are an exception, not a hard violation', ()=>{
  Fx.use(P9.base({overrides:[
    {id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:['p1'], fill:false},
    {id:'o2', on:true, date:Fx.iso(1), facilityId:'f1', people:['p2'], fill:false}
  ], settings:{volume:{mode:'fixed'}}}));
  const a = validatePlan(generatePlan().plan);
  const dup = a.violations.filter(x=>x.key==='dFacDup');
  return verdict(dup.length===1 && dup.every(x=>x.cls==='exception'), 'exception', JSON.stringify(dup.map(x=>x.cls)));
});

regress('v9: a generated visit never repeats a place used the same day by another generated visit', ()=>{
  Fx.use(P9.base({settings:{volume:{mode:'exact', exact:{basic:5, contracted:0}, perDay:3}}}));
  const plan = generatePlan().plan;
  const a = validatePlan(plan);
  return verdict(a.violations.filter(x=>x.key==='dFacDup' && x.cls==='hard').length===0, 'none', 'dup place on one day');
});

regress('v9: per-visit exclusions and strict far/near hold through the exact team solver', ()=>{
  let bad = 0;
  for(let seed=1; seed<=8; seed++){
    Fx.use(P9.base({
      people:Fx.ppl(['p1','p2','p3','p4','p5','p6']).map((p, i)=>i===0 ? Object.assign(p, {distPref:'near', lv:{dist:mkLv('must', 5)}}) : p),
      overrides:[{id:'o1', on:true, date:Fx.iso(1), facilityId:'f1', people:[], fill:true, never:['p2','p3']}],
      settings:{volume:{mode:'exact', exact:{basic:4, contracted:0}, perDay:2}}
    }));
    App.data.locations.push({id:'loc_far', name:'Far', km:120});
    App.data.facilities.forEach((f, i)=>{ if(i%2) f.locationId = 'loc_far'; });
    const p1 = personById('p1');
    const plan = generatePlan({seed}).plan;
    const ov = plan.visits.find(v=>v.overrideId==='o1');
    if(visitTeamIds(ov).some(id=>id==='p2' || id==='p3')) bad++;
    for(const v of plan.visits) if(visitTeamIds(v).includes('p1') && distBand(personTravelKm(p1, facilityById(v.facilityId)))!=='near') bad++;
  }
  return verdict(bad===0, '8/8', 'broken '+bad);
});
