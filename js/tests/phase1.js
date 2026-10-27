const P1 = {
  strip(o){
    if(Array.isArray(o)){ o.forEach(P1.strip); return o; }
    if(o && typeof o==='object'){ delete o.lv; for(const k of Object.keys(o)) P1.strip(o[k]); }
    return o;
  },
  legacy(){
    const d = JSON.parse(SEED_JSON);
    P1.strip(d);
    d.rev = 6; d.rulesRev = 7;
    const s = d.settings;
    s.spacing = {mode:'gap', gap:3, strict:'must'};
    s.patterns = {activity:{on:true, strict:'try', pattern:{minRest:1, maxRun:null, cycle:null}}, person:{on:true, strict:'try', pattern:{minRest:1, maxRun:null, cycle:null}}};
    s.genderPrefs = {m:{on:true, dist:'far', kind:null, days:[], strength:'strong'}, f:{on:true, dist:null, kind:'basic', days:[], strength:'light'}};
    s.seniority = {on:true, threshold:60, mode:'prefer', match:0.3};
    s.repeatBlock = {on:true, times:4};
    s.rotation = {on:true, strength:0.7};
    s.days = {
      1:{cap:2, lean:'contracted', dist:'far', favor:'اشعة', only:['معمل', 'اشعة']},
      3:{min:2, lean:'basic'}
    };
    s.genderRules = [{id:'g1', on:true, kinds:['basic'], categories:[], facilities:[], minEach:25, avoidEven:true}];
    const a = d.people[0].id, b = d.people[1].id;
    s.pairs = [{id:'pr1', a, b, type:'avoid', mode:'rigid', strength:'medium', on:true}, {id:'pr2', a, b:d.people[2].id, type:'together', mode:'flexible', strength:'strong', on:true}];
    s.goals = [
      {id:'g_a', on:true, type:'cover', strict:'must', scope:{kind:'all', ids:[]}, times:1, since:null, by:null, repeat:true},
      {id:'g_b', on:true, type:'atLeast', strict:'try', scope:{kind:'all', ids:[]}, n:3, repeat:false},
      {id:'g_c', on:true, type:'person', strict:'must', scope:{kind:'type', ids:['contracted']}, people:[a], rel:'never', n:4}
    ];
    return d;
  }
};

regress('v4: registry has every rule of the brief table', ()=>{
  const want = ['day.cap', 'day.min', 'day.kind', 'day.band', 'day.category', 'day.only', 'fac.weekdays', 'vol.week', 'vol.everyDay', 'vol.exact', 'vol.share', 'vol.quota', 'vol.gap', 'vol.activity', 'fac.pinned', 'dist.pick', 'p.blocked', 'p.avail', 'p.maxRun', 'p.maxWeek', 'p.rest', 'p.quota', 'p.dist', 'fair.load', 'gender.rule', 'gender.pref.m', 'gender.pref.f', 'senior', 'pair', 'rotate', 'dist.short', 'dist.balanceFar', 'goal.cover', 'goal.atLeast', 'goal.atMost', 'goal.maxGap', 'goal.person', 'goal.together', 'goal.separate', 'goal.special', 'goal.pattern', 'due.priority', 'skill.match', 'space.shape', 'p.spread'];
  const missing = want.filter(id=>!ruleSpec(id));
  const extra = RULES.map(r=>r.id).filter(id=>!want.includes(id));
  const noText = [];
  for(const r of RULES) for(const lang of ['ar', 'en']) for(const k of [r.name, r.unit, r.must]) if(!I18N[lang][k]) noText.push(lang+':'+k);
  for(const r of STRUCTURAL_RULES) for(const lang of ['ar', 'en']) if(!I18N[lang][r.name]) noText.push(lang+':'+r.name);
  const po = RULES.filter(r=>r.preferOnly).map(r=>r.id).sort().join(',');
  return verdict(!missing.length && !extra.length && !noText.length && STRUCTURAL_RULES.length===8 && po==='due.priority,p.spread,skill.match,space.shape', RULES.length+' rules', JSON.stringify({missing, extra, noText:noText.slice(0, 5), po}));
});

regress('v4: migration maps every legacy field (v3.2-era backup)', ()=>{
  const d = normalizeData(P1.legacy());
  const s = d.settings, L = s.lv;
  const bad = [];
  const eq = (name, got, level, w)=>{ if(!got || got.level!==level || (w!=null && got.w!==w)) bad.push(name+' '+JSON.stringify(got)); };
  eq('vol.gap', L['vol.gap'], 'must');
  eq('vol.activity', L['vol.activity'], 'prefer', 5);
  eq('gender.pref.m', L['gender.pref.m'], 'prefer', 8);
  eq('gender.pref.f', L['gender.pref.f'], 'prefer', 3);
  eq('senior', L.senior, 'prefer', 5);
  eq('rotate', L.rotate, 'must');
  eq('vol.exact', L['vol.exact'], 'must');
  eq('vol.share', L['vol.share'], 'prefer', 5);
  eq('vol.quota', L['vol.quota'], 'must');
  eq('vol.week', L['vol.week'], 'must');
  eq('vol.everyDay', L['vol.everyDay'], 'must');
  eq('dist.pick', L['dist.pick'], 'prefer', 5);
  eq('dist.short', L['dist.short'], 'prefer', 5);
  eq('dist.balanceFar', L['dist.balanceFar'], 'prefer', 5);
  eq('fair.load', L['fair.load'], 'prefer', 5);
  eq('due.priority', L['due.priority'], 'prefer', 3);
  const d1 = s.days[1], d3 = s.days[3];
  if(!d1 || d1.cap.n!==2 || d1.cap.lv.level!=='must') bad.push('day1.cap');
  if(!d1 || d1.kind.kind!=='contracted' || d1.kind.howMany!=='all' || d1.kind.lv.level!=='prefer' || d1.kind.lv.w!==5) bad.push('day1.kind');
  if(!d1 || d1.band.band!=='far' || d1.band.lv.level!=='prefer') bad.push('day1.band');
  if(!d1 || JSON.stringify(d1.category.ids)!=='["اشعة"]' || d1.category.lv.level!=='prefer') bad.push('day1.category');
  if(!d1 || d1.only.ids.length!==2 || d1.only.lv.level!=='must') bad.push('day1.only');
  if(!d3 || d3.min.n!==2 || d3.min.lv.level!=='prefer' || d3.kind.kind!=='basic') bad.push('day3');
  eq('gender.rule', s.genderRules[0].lv, 'prefer', 8);
  eq('pair rigid', s.pairs[0].lv, 'must');
  eq('pair flexible strong', s.pairs[1].lv, 'prefer', 8);
  eq('goal cover', s.goals[0].lv, 'must');
  eq('goal atLeast', s.goals[1].lv, 'prefer', 5);
  eq('goal person', s.goals[2].lv, 'must');
  if(s.goals.some(g=>g.strict!==(g.lv.level==='must' ? 'must' : 'try'))) bad.push('goal strict mirror');
  for(const p of d.people){
    const pl = p.lv;
    if(!pl) { bad.push('person lv '+p.id); continue; }
    if(pl.blocked.level!=='must' || pl.avail.level!=='must' || pl.maxRun.level!=='must' || pl.maxWeek.level!=='must' || pl.quota.level!=='must' || pl.dist.level!=='prefer' || pl.rest.level!=='prefer') bad.push('person lv '+p.id+' '+JSON.stringify(pl));
  }
  for(const f of d.facilities) if(!f.lv || f.lv.weekdays.level!=='must' || f.lv.pinned.level!=='prefer' || f.lv.pinned.w!==9){ bad.push('facility lv '+f.id); break; }
  return verdict(!bad.length && d.rulesRev===RULES_REV, 'all mapped', bad.slice(0, 6).join(' | '));
});

regress('v4: rotation strength maps to prefer weights 3/5/8', ()=>{
  const out = [];
  for(const [x, w] of [[0.2, 3], [0.35, 5], [0.7, 8]]){
    const d = P1.legacy();
    d.settings.repeatBlock = {on:false, times:3};
    d.settings.rotation = {on:true, strength:x};
    const r = normalizeData(d).settings.lv.rotate;
    if(r.level!=='prefer' || r.w!==w) out.push(x+'→'+JSON.stringify(r));
  }
  return verdict(!out.length, 'ok', out.join(' '));
});

regress('v4: normalize is idempotent and keeps stored levels', ()=>{
  const a = normalizeData(P1.legacy());
  a.settings.lv['vol.share'] = {level:'must', w:7};
  a.settings.days[1].kind.lv = {level:'must', w:9};
  a.people[0].lv.maxRun = {level:'prefer', w:2};
  const b = normalizeData(JSON.parse(JSON.stringify(a)));
  const c = normalizeData(JSON.parse(JSON.stringify(b)));
  const same = JSON.stringify(b)===JSON.stringify(c);
  const kept = b.settings.lv['vol.share'].level==='must' && b.settings.lv['vol.share'].w===7 && b.settings.days[1].kind.lv.w===9 && b.people[0].lv.maxRun.w===2 && b.people[0].lv.maxRun.level==='prefer';
  return verdict(same && kept, 'stable', 'same='+same+' kept='+kept);
});

regress('v4: old v4 and v5 backups import without losing data', ()=>{
  const d = P1.legacy();
  const n0 = d.facilities.length, p0 = d.people.length, g0 = d.settings.goals.length;
  const out = normalizeData(JSON.parse(JSON.stringify(d)));
  const dayOk = Object.keys(out.settings.days).length===2;
  return verdict(out.facilities.length===n0 && out.people.length===p0 && out.settings.goals.length===g0 && dayOk && out.settings.pairs.length===2, 'kept', 'counts changed');
});

regress('v4: a saved plan from an older rulesRev loads as stale', ()=>{
  const keepData = App.data, keepPlan = App.plan;
  const keyD = localStorage.getItem(STORE_KEY), keyP = localStorage.getItem(PLAN_KEY);
  try{
    const plan = Fx.manualPlan([]);
    plan.gen = {rulesRev:7};
    localStorage.setItem(PLAN_KEY, JSON.stringify(plan));
    loadAll();
    const stale = !!(App.plan && App.plan.stale);
    const kept = !!App.plan && Array.isArray(App.plan.visits);
    return verdict(stale && kept, 'stale', 'stale='+stale+' kept='+kept);
  } finally {
    if(keyD==null) localStorage.removeItem(STORE_KEY); else localStorage.setItem(STORE_KEY, keyD);
    if(keyP==null) localStorage.removeItem(PLAN_KEY); else localStorage.setItem(PLAN_KEY, keyP);
    App.data = keepData; App.plan = keepPlan;
  }
});

regress('v4: LevelChip renders and edits in light, dark, RTL and LTR', ()=>{
  const root = document.documentElement;
  const keepDir = root.dir, keepTheme = root.getAttribute('data-theme'), keepLang = App.ui.lang;
  const box = document.createElement('div');
  document.body.appendChild(box);
  const bad = [];
  try{
    for(const [dir, theme] of [['rtl', 'light'], ['rtl', 'dark'], ['ltr', 'light'], ['ltr', 'dark']]){
      root.dir = dir; root.setAttribute('data-theme', theme); App.ui.lang = dir==='rtl' ? 'ar' : 'en';
      let got = null;
      const must = LevelChip({level:'must', w:5}, 'vol.exact', v=>{ got = v; });
      const pref = LevelChip({level:'prefer', w:7}, 'vol.share', ()=>{});
      const only = LevelChip({level:'prefer', w:3}, 'due.priority', ()=>{});
      box.appendChild(must); box.appendChild(pref); box.appendChild(only);
      if(must.textContent!==t('lvMust') || !must.querySelector('.lk') || !must.classList.contains('must')) bad.push(dir+theme+' must');
      if(pref.textContent!==t('lvPrefer')+' · 7' || !pref.classList.contains('prefer')) bad.push(dir+theme+' prefer');
      pref.click();
      const pop = document.querySelector('.pop');
      const segBtns = pop ? pop.querySelectorAll('.seg button') : [];
      if(!pop || segBtns.length!==2 || !pop.querySelector('input[type=range]') || !pop.querySelector('.lv-hint')) bad.push(dir+theme+' popover');
      else {
        const slider = pop.querySelector('input[type=range]');
        slider.value = '9'; slider.dispatchEvent(new Event('change'));
        if(pref.textContent!==t('lvPrefer')+' · 9') bad.push(dir+theme+' slider');
        segBtns[0].click();
        if(!pref.classList.contains('must') || pref.get().level!=='must' || pref.get().w!==9) bad.push(dir+theme+' seg');
      }
      closePop();
      only.click();
      const pop2 = document.querySelector('.pop');
      const mb = pop2 ? pop2.querySelector('.seg button') : null;
      if(!mb || !mb.disabled) bad.push(dir+theme+' prefer-only must not disabled');
      closePop();
      clear(box);
    }
  } finally {
    closePop();
    box.remove();
    root.dir = keepDir; App.ui.lang = keepLang;
    if(keepTheme==null) root.removeAttribute('data-theme'); else root.setAttribute('data-theme', keepTheme);
  }
  return verdict(!bad.length, 'ok', bad.join(' | '));
});
