const P4 = {
  sources(){ return [renderRules, goalsPop, GoalsManager, goalFields, openGoals, openPerson, openFacility, renderTeam, personEditor, personDefaultLv, dayLvChip].map(f=>String(f)); },
  labels(){ return [...document.querySelectorAll('button.chip.level')].map(b=>b.getAttribute('aria-label') || ''); },
  prepare(mode, spacing){
    App.data = normalizeData(JSON.parse(SEED_JSON));
    App.plan = null;
    const s = S();
    s.period = Object.assign({}, s.period, {goal:'range', preset:'custom', start:Fx.W1.start, end:Fx.W1.end});
    s.volume.mode = mode;
    s.spacing.mode = spacing;
    s.rotation.on = true;
    s.seniority.on = true;
    s.genderRules = [{id:'gx', on:true, kinds:[], categories:[], facilities:[], minEach:25, avoidEven:false, lv:mkLv('prefer', 8)}];
    const ps = activePeople();
    s.pairs = [{id:'prx', a:ps[0].id, b:ps[1].id, type:'avoid', lv:mkLv('prefer', 5), on:true}];
    const cat = App.data.categories.find(c=>c.kind!=='excluded').name;
    for(const wd of [0, 1, 2, 3, 4]) patchDay(wd, {cap:2, min:1, lean:'basic', dist:'near', favor:[cat], only:[cat]});
    s.goals = GOAL_TYPES.map(type=>{ const g = newGoal(type); if(g.people) g.people = [ps[0].id]; if(type==='together'){ g.a = ps[0].id; g.b = ps[1].id; } if(type==='special'){ g.facilityId = schedulableFacilities()[0].id; } return g; });
    return s;
  },
  render(){
    goTab('rules');
    document.querySelectorAll('.rule-sec').forEach(s=>s.paint && s.paint());
    const out = new Set(P4.labels());
    return out;
  },
  gather(){
    const all = new Set();
    for(const [mode, spacing] of [['fill', 'even'], ['exact', 'gap'], ['quota', 'pack']]){
      P4.prepare(mode, spacing);
      for(const l of P4.render()) all.add(l);
    }
    P4.prepare('fill', 'even');
    openPerson(activePeople()[0].id);
    for(const l of P4.labels()) all.add(l);
    sheet.current.close(true);
    openFacility(schedulableFacilities()[0].id);
    for(const l of P4.labels()) all.add(l);
    sheet.current.close(true);
    openGoals();
    for(const l of P4.labels()) all.add(l);
    sheet.current.close(true);
    return all;
  }
};

regress('v4: no Must/Try Seg, rigid/flexible or light/medium/strong control remains in the views', ()=>{
  const bad = [];
  const joined = P4.sources().join('\n');
  const pats = [/t\('gMust'\)/, /t\('gTry'\)/, /prFlexible|prRigid|prLight|prMedium|prStrong/, /senRequire|senPrefer/, /\['sLight'\]|t\('sLight'\)|t\('sNormal'\)|t\('sStrong'\)/, /strict\s*=\s*v\b/];
  for(const p of pats) if(p.test(joined)) bad.push(String(p));
  return verdict(!bad.length, 'clean', bad.join(' | '));
});

regress('v4: every registry rule is reachable through a LevelChip', ()=>{
  const keep = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  try{
    const labels = [...P4.gather()];
    const missing = RULES.filter(r=>!labels.some(l=>l.endsWith(' · '+t(r.name)))).map(r=>r.id);
    return verdict(!missing.length, RULES.length+' rules', 'missing '+missing.join(','));
  } finally { App.data = keep; App.plan = keepPlan; App.ui.tab = keepTab; }
});

regress('v4: toggling every rule chip between Must and Prefer regenerates without errors', ()=>{
  const keep = App.data, keepPlan = App.plan, keepTab = App.ui.tab;
  const bad = [];
  let toggled = 0;
  try{
    for(const [mode, spacing] of [['fill', 'even'], ['exact', 'gap'], ['quota', 'pack']]){
      P4.prepare(mode, spacing);
      goTab('rules');
      document.querySelectorAll('.rule-sec').forEach(s=>s.paint && s.paint());
      const chips = [...document.querySelectorAll('button.chip.level')];
      for(const chip of chips){
        const label = chip.getAttribute('aria-label');
        chip.click();
        const pop = document.querySelector('.pop');
        if(!pop){ bad.push(label+' no popover'); continue; }
        const btns = pop.querySelector('.seg').querySelectorAll('button');
        const slider = pop.querySelector('input[type=range]');
        if(btns.length!==2 || !slider){ bad.push(label+' popover shape'); closePop(); continue; }
        if(!btns[0].disabled) btns[0].click();
        slider.value = '7'; slider.dispatchEvent(new Event('change'));
        btns[1].click();
        closePop();
        toggled++;
        const r = generatePlan({skipSearch:true});
        if(r.error || !r.plan) bad.push(label+' generate '+(r.error || 'no plan'));
        if(!document.body.contains(chip)){ goTab('rules'); document.querySelectorAll('.rule-sec').forEach(s=>s.paint && s.paint()); }
        if(bad.length>6) break;
      }
    }
  } finally { closePop(); App.data = keep; App.plan = keepPlan; App.ui.tab = keepTab; }
  return verdict(!bad.length && toggled>30, toggled+' chips toggled', bad.slice(0, 5).join(' | ')+' toggled '+toggled);
});
