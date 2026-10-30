function pChip(p, key, rule, save){
  return LevelChip(personLvOf(p)[key], rule, v=>{ p.lv = Object.assign(personLvOf(p), {[key]:v}); save(); }, {sm:true});
}

function availSummary(p){
  const a = p.avail||{mode:'plan'};
  if(a.mode==='weekdays') return [6,0,1,2,3,4,5].filter(d=>(a.weekdays||[]).includes(d)).map(d=>wdName(d,'short')).join(' · ') || '—';
  if(a.mode==='cycle') return (a.cycle.on||1)+' / '+(a.cycle.off||0);
  return t('pAvailPlan');
}
function weekStrip(p, days){
  const start = todayOrd();
  const cells = [];
  for(let i=0;i<(days||14);i++){
    const o = start+i;
    cells.push(el('i', {class:personAvailable(p, o) && (p.avail.mode!=='plan' || isWorkday(o)) ? 'on' : '', title:fmtDate(isoOf(o),'wdm')}, wdName(wdOf(o),'min')));
  }
  return el('div', {class:'week-strip'}, cells);
}

function analyzeLoadGuess(p){
  if(App.plan && !App.plan.stale){ const e = analyzePlan(App.plan).expected[p.id]; if(e!=null) return e; }
  const pv = volumePreview(), pl = poolById(p.pool);
  const seats = (pv.basic||0)*seatsFor(pl,'basic') + (pv.contracted||0)*seatsFor(pl,'contracted');
  return seats / Math.max(1, activePeople().filter(x=>x.pool===p.pool).length);
}

function personParts(p, api, saveP){
  const R = ()=>api.render();
  const basics = el('section', {class:'sheet-sec stack', style:{gap:'12px'}}, [
    el('div', {class:'grid-2'}, [
      el('div', {class:'field'}, [el('label', null, t('pName')), el('input', {class:'input', value:p.name, placeholder:t('pNewName'), onchange:e=>{ p.name = e.target.value.trim(); saveP(); R(); }})]),
      el('div', {class:'field'}, [el('label', null, t('pTitle')), el('input', {class:'input', value:p.title||'', onchange:e=>{ p.title = e.target.value.trim()||null; saveP(); }})])
    ]),
    el('div', {class:'grid-2'}, [
      el('div', {class:'field'}, [el('label', null, t('pPool')), Select(S().pools.map(pl=>({value:pl.id, label:poolName(pl)})), p.pool, v=>{ p.pool = v; saveP(); R(); })]),
      el('div', {class:'field'}, [el('label', null, t('pGender')), Seg([{value:'m',label:t('pMale')},{value:'f',label:t('pFemale')},{value:'',label:t('pUnset')}], p.gender||'', v=>{ p.gender = v||null; saveP(); }, {cls:'block'})])
    ]),
    setting(t('pActive'), null, Switch(p.active!==false, v=>{ p.active = v; saveP(); }))
  ]);
  const skill = el('section', {class:'sheet-sec'}, [
    el('div', {class:'section-title'}, t('pSkill')),
    el('div', {class:'hint', style:{marginBottom:'6px'}}, t('pSkillHint')),
    setting(t('kBasic'), null, null, {full:Slider(p.skill.basic, v=>{ p.skill.basic = v; saveP(); }, {min:0, max:100, step:5, tiers:skillTier})}),
    setting(t('kContracted'), null, null, {full:Slider(p.skill.contracted, v=>{ p.skill.contracted = v; saveP(); }, {min:0, max:100, step:5, tiers:skillTier})})
  ]);
  const bc = p.skill.byCategory||{};
  for(const cat of Object.keys(bc)){
    skill.appendChild(setting(cat, null, el('button', {type:'button', class:'icon-btn sm', html:ICON.x, 'aria-label':t('del'), onclick:()=>{ delete bc[cat]; saveP(); R(); }}), {full:Slider(bc[cat], v=>{ bc[cat] = v; saveP(); }, {min:0, max:100, step:5, tiers:skillTier})}));
  }
  const addCat = el('button', {type:'button', class:'btn sm ghost', style:{marginTop:'6px'}}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('pSkillCat')]);
  addCat.addEventListener('click', ()=>menu(addCat, App.data.categories.filter(c=>c.kind!=='excluded' && bc[c.name]==null).map(c=>({label:c.name, meta:kindLabel(c.kind), onClick:()=>{ p.skill.byCategory = Object.assign(bc, {[c.name]:skillOf(p, c.kind)}); saveP(); R(); }}))));
  skill.appendChild(addCat);

  const load = el('section', {class:'sheet-sec'}, [el('div', {class:'section-title'}, t('pLoad'))]);
  const q = p.quota;
  const qMode = q.min==null && q.max==null ? 'auto' : (q.min!=null && q.min===q.max ? 'exact' : 'range');
  load.appendChild(setting(t('pPerPlan'), t('pPerPlanHint'), [pChip(p, 'quota', 'p.quota', saveP), Seg([{value:'auto', label:t('pQAuto')},{value:'exact', label:t('pQExact')},{value:'range', label:t('pQRange')}], qMode, v=>{
    const cur = Math.round(analyzeLoadGuess(p));
    if(v==='auto') p.quota = {min:null, max:null};
    else if(v==='exact') p.quota = {min:q.min!=null ? q.min : cur, max:q.min!=null ? q.min : cur};
    else p.quota = {min:q.min, max:q.max!=null ? q.max : cur+2};
    saveP(); R();
  }, {cls:'sm'})], {full: qMode==='auto' ? null : qMode==='exact'
    ? Stepper(q.min, v=>{ p.quota = {min:v, max:v}; saveP(); }, {min:0, max:99, unit:t('gPerPlan')})
    : el('div', {class:'grid-2'}, [
        el('div', {class:'field'}, [el('label', null, t('pQMin')), Stepper(q.min, v=>{ p.quota = normalizeQuota({min:v, max:p.quota.max}); saveP(); R(); }, {min:0, max:99, nullable:true, placeholder:t('noLimit')})]),
        el('div', {class:'field'}, [el('label', null, t('pQMax')), Stepper(q.max, v=>{ p.quota = normalizeQuota({min:p.quota.min, max:v}); saveP(); R(); }, {min:0, max:99, nullable:true, placeholder:t('noLimit')})])
      ])}));
  if(qMode!=='exact') load.appendChild(setting(t('pShare'), t('pShareHint'), null, {full:Slider(Math.round((p.share==null?1:p.share)*100), v=>{ p.share = v/100; saveP(); }, {min:0, max:200, step:10, format:v=>v+'%'})}));
  const myGoals = S().goals.filter(g=>(g.type==='person' && g.people.includes(p.id)) || (g.type==='together' && (g.a===p.id || g.b===p.id)) || ((g.type==='special' || g.type==='pattern') && g.people.includes(p.id)));
  const gBox = el('div', {class:'stack', style:{gap:'6px', marginTop:'10px'}});
  for(const g of myGoals) gBox.appendChild(el('div', {class:'goal-row'+(g.on?'':' off')}, [el('span', {class:'goal-ic', html:ICON.target}), el('div', {class:'gl-main', style:{cursor:'pointer'}, onclick:()=>{ closePop(); openGoals(g.id); }}, [el('b', null, goalTitle(g)), el('span', null, goalTypeLabel(g.type))]), LevelChip(g.lv, goalRuleId(g), v=>{ g.lv = v; commit('settings'); }, {sm:true})]));
  const addG = type=>el('button', {type:'button', class:'btn sm ghost'}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('gAddFor_'+type)]);
  const b1 = addG('person'), b2 = addG('together'), b3 = addG('special'), b4 = addG('pattern');
  const make = (type, fill)=>{ if(!App.data.people.includes(p)) { toast(t('pNewName')); return; } const g = newGoal(type); fill(g); S().goals.push(g); commit('settings'); api.close(); openGoals(g.id); };
  b1.addEventListener('click', ()=>make('person', g=>{ g.people = [p.id]; }));
  b2.addEventListener('click', ()=>make('together', g=>{ g.a = p.id; }));
  b3.addEventListener('click', ()=>make('special', g=>{ g.people = [p.id]; g.fill = true; }));
  b4.addEventListener('click', ()=>make('pattern', g=>{ g.people = [p.id]; }));
  gBox.appendChild(el('div', {class:'row wrap', style:{gap:'4px'}}, [b2, b3, b4]));
  gBox.appendChild(RuleDraft({lockSubject:true, make:()=>{ const g = simpleRuleGoal(); g.subject = {kind:'people', ids:[]}; g.people = [p.id]; return g; }}));
  const goalsSec = el('div', {class:'stack', style:{gap:'6px'}}, [el('div', {class:'section-title', style:{marginTop:'14px'}}, t('pGoals')), gBox]);

  const a = p.avail;
  const availSec = el('section', {class:'sheet-sec'});
  availSec.appendChild(el('div', {class:'section-title'}, [t('pAvail'), pChip(p, 'avail', 'p.avail', saveP)]));
  availSec.appendChild(Seg([{value:'plan',label:t('pAvailPlan')},{value:'weekdays',label:t('pAvailWeekdays')},{value:'cycle',label:t('pAvailCycle')}], a.mode, v=>{ a.mode = v; if(v==='weekdays' && !(a.weekdays&&a.weekdays.length)) a.weekdays = S().calendar.workdays.slice(); saveP(); R(); }, {cls:'block'}));
  if(a.mode==='weekdays') availSec.appendChild(el('div', {style:{marginTop:'12px'}}, DaySet(a.weekdays, v=>{ a.weekdays = v; saveP(); R(); })));
  if(a.mode==='cycle'){
    availSec.appendChild(el('div', {class:'grid-2', style:{marginTop:'12px'}}, [
      el('div', {class:'field'}, [el('label', null, t('pCycleOn')), Stepper(a.cycle.on, v=>{ a.cycle.on = v; saveP(); R(); }, {min:1, max:14})]),
      el('div', {class:'field'}, [el('label', null, t('pCycleOff')), Stepper(a.cycle.off, v=>{ a.cycle.off = v; saveP(); R(); }, {min:0, max:14})]),
      el('div', {class:'field', style:{gridColumn:'1 / -1'}}, [el('label', null, t('pCycleAnchor')), DateInput(a.cycle.anchor, v=>{ a.cycle.anchor = v; saveP(); R(); })])
    ]));
  }
  availSec.appendChild(el('div', {style:{marginTop:'12px'}}, [el('div', {class:'muted', style:{fontSize:'11.5px', marginBottom:'4px'}}, t('pCyclePreview')), weekStrip(p, 14)]));
  availSec.appendChild(el('div', {class:'grid-2', style:{marginTop:'14px'}}, [
    el('div', {class:'field'}, [el('label', null, [t('pMaxRun'), pChip(p, 'maxRun', 'p.maxRun', saveP)]), Stepper(p.maxRun, v=>{ p.maxRun = v; saveP(); }, {min:1, max:14, nullable:true, placeholder:t('noLimit')})]),
    el('div', {class:'field'}, [el('label', null, [t('pMaxWeek'), pChip(p, 'maxWeek', 'p.maxWeek', saveP)]), Stepper(p.maxPerWeek, v=>{ p.maxPerWeek = v; saveP(); }, {min:1, max:14, nullable:true, placeholder:t('noLimit')})])
  ]));

  const pat = p.pattern = p.pattern || {mode:'inherit', minRest:0};
  const prSec = el('section', {class:'sheet-sec stack', style:{gap:'8px'}});
  prSec.appendChild(el('div', {class:'section-title'}, [t('prTitle'), pChip(p, 'rest', 'p.rest', saveP)]));
  prSec.appendChild(el('div', {class:'hint'}, t('prHint')));
  prSec.appendChild(Seg([{value:'inherit', label:t('prInherit')}, {value:'custom', label:t('prCustom')}, {value:'none', label:t('prNone')}], pat.mode, v=>{ pat.mode = v; if(v==='custom' && !(pat.minRest>0)) pat.minRest = 1; saveP(); R(); }, {cls:'block'}));
  if(pat.mode==='custom'){
    prSec.appendChild(el('div', {class:'chips'}, [
      el('button', {type:'button', class:'chip'+(pat.minRest===1 ? ' on' : ''), onclick:()=>{ pat.minRest = 1; saveP(); R(); }}, t('patPresetNoRun'))
    ]));
    prSec.appendChild(setting(t('patMinRest'), null, Stepper(pat.minRest||0, v=>{ pat.minRest = v; saveP(); R(); }, {min:0, max:60, sm:true, unit:t('daysU')})));
  }
  const w = planWindow();
  if(!w.error){
    const eligible = w.days.filter(o=>(normalWorkday(o) || isOverrideDate(isoOf(o))) && personAvailable(p, o)).length;
    const assigned = App.plan ? App.plan.visits.filter(v=>visitTeamIds(v).includes(p.id)).length : 0;
    prSec.appendChild(el('div', {class:'muted', style:{fontSize:'12px'}}, t('prPreview', eligible, assigned)));
  }

  const offSec = el('section', {class:'sheet-sec'});
  const clearOff = el('button', {type:'button', class:'btn sm ghost', hidden:!(p.off||[]).length, onclick:()=>{ p.off = []; saveP(); R(); }}, t('pOffClear'));
  offSec.appendChild(el('div', {class:'row'}, [el('div', {class:'section-title', style:{margin:'0'}}, t('pOff')), el('div', {class:'spacer'}), clearOff]));
  offSec.appendChild(el('div', {class:'hint', style:{margin:'4px 0 10px'}}, t('pOffHint')));
  const cal = MiniCal({isSelected:iso=>isOff(p, iso), isWork:iso=>personPatternOn(p, ordOf(iso)), onPick:iso=>{ p.off = isOff(p, iso) ? removeOffDay(p.off, iso) : normalizeOff((p.off||[]).concat([{from:iso, to:iso}])); saveP(); paintSpans(); }, onRange:(x,y)=>{ p.off = normalizeOff((p.off||[]).concat([{from:x, to:y}])); saveP(); paintSpans(); }});
  const spans = el('div', {class:'chips', style:{marginTop:'10px'}});
  function paintSpans(){ clearOff.hidden = !(p.off||[]).length; clear(spans); for(const r of (p.off||[])) spans.appendChild(el('span', {class:'chip'}, [r.from===r.to ? fmtDate(r.from,'wdm') : fmtDate(r.from,'dm')+' – '+fmtDate(r.to,'dm'), el('button', {type:'button', class:'x', html:ICON.x, onclick:()=>{ p.off = p.off.filter(x=>x!==r); saveP(); paintSpans(); cal.repaint(); }})])); }
  paintSpans();
  offSec.appendChild(cal); offSec.appendChild(spans);

  const origin = el('section', {class:'sheet-sec'}, [
    el('div', {class:'section-title'}, t('rDistance')),
    setting(t('pOrigin'), null, Select(App.data.locations.slice().sort((a,b)=>a.km-b.km).map(l=>({value:l.id, label:l.name+' · '+l.km+' '+t('km')})), p.origin||'', v=>{ p.origin = v; saveP(); })),
    setting(t('pDistPref'), null, [Seg([{value:'near',label:t('pDistNear')},{value:'',label:t('pDistAny')},{value:'far',label:t('pDistFar')}], p.distPref||'', v=>{ p.distPref = v||null; saveP(); }, {cls:'sm'}), pChip(p, 'dist', 'p.dist', saveP)]),
    el('div', {class:'field', style:{paddingTop:'10px'}}, [el('label', null, [t('pBlocked'), pChip(p, 'blocked', 'p.blocked', saveP)]), FacilityPicker(p.blocked, ids=>{ p.blocked = ids; saveP(); }, {filter:f=>{ const k = facilityKind(f); return k==='basic'||k==='contracted'; }})])
  ]);
  return {basics, skill, load, goalsSec, availSec, prSec, offSec, origin};
}

function personActivity(p){
  const sec = el('section', {class:'sheet-sec'});
  sec.appendChild(el('div', {class:'section-title'}, t('ptab_activity')));
  const vis = App.plan ? App.plan.visits.filter(v=>visitTeamIds(v).includes(p.id)).slice().sort((a, b)=>a.date<b.date ? -1 : 1) : [];
  const an = App.plan && !App.plan.stale ? analyzePlan(App.plan) : null;
  const exp = an && an.expected[p.id]!=null ? an.expected[p.id] : analyzeLoadGuess(p);
  sec.appendChild(el('div', {class:'hint'}, t('pActLoad', vis.length, Math.round(exp*10)/10)));
  if(!vis.length) sec.appendChild(el('div', {class:'muted', style:{fontSize:'13px'}}, t('pActNone')));
  for(const v of vis){
    const f = facilityById(v.facilityId);
    sec.appendChild(el('div', {class:'row', style:{padding:'5px 0', fontSize:'12.5px', borderBottom:'1px dashed var(--line)'}}, [el('span', {class:'num muted', style:{minWidth:'92px'}}, fmtDate(v.date, 'short')), el('span', null, f ? f.name : v.facilityId)]));
  }
  return sec;
}

const PERSON_TABS = ['profile', 'avail', 'rules', 'activity'];

function personEditor(p, api, saveP){
  const x = personParts(p, api, saveP);
  x.load.appendChild(x.goalsSec);
  const U = App.ui;
  const sections = {profile:[x.basics, x.skill, x.origin], avail:[x.availSec, x.offSec], rules:[x.load, x.prSec], activity:[personActivity(p)]};
  if(!sections[U.personTab]) U.personTab = 'profile';
  if(!U.personScroll) U.personScroll = {};
  const holder = ()=>document.querySelector('.pt-panel-body') || document.querySelector('.sheet-body');
  const bar = el('div', {class:'pt-tabs', role:'tablist'}, PERSON_TABS.map(k=>el('button', {type:'button', role:'tab', class:'pt-tab'+(U.personTab===k ? ' on' : ''), 'aria-selected':U.personTab===k ? 'true' : 'false', 'data-ptab':k, onclick:()=>{
    const h = holder();
    if(h) U.personScroll[U.personTab] = h.scrollTop;
    U.personTab = k;
    api.render();
    setTimeout(()=>{ const h2 = holder(); if(h2) h2.scrollTop = U.personScroll[k] || 0; }, 0);
  }}, t('ptab_'+k))));
  return [bar].concat(sections[U.personTab]);
}

function openPerson(id, draft, rerender){
  const isNew = !!draft;
  const p = draft || personById(id);
  if(!p) return;
  const saveP = ()=>{ if(isNew){ if(!p.name.trim()) return; if(!App.data.people.includes(p)) App.data.people.push(p); } commit('data'); if(rerender) rerender(); };
  sheet({
    title:()=>p.name || t('tAdd'),
    sub:()=>[el('span', {class:'tag'}, poolName(poolById(p.pool))), p.retired ? el('span', {class:'tag warn'}, t('tRetired')) : null],
    body:api=>personEditor(p, api, saveP),
    foot:api=>{
      const exists = App.data.people.includes(p);
      return [
        exists ? el('button', {type:'button', class:'btn ghost', onclick:()=>{ p.retired = !p.retired; saveP(); api.render(); }}, p.retired ? t('pRestore') : t('pRetire')) : null,
        exists ? el('button', {type:'button', class:'btn ghost', style:{color:'var(--danger)'}, onclick:()=>confirmDialog(t('pDelete'), t('pDeleteQ'), {danger:true, label:t('del'), onConfirm:()=>{ App.data.people = App.data.people.filter(x=>x!==p); forgetPerson(p.id); commit('data'); api.close(); if(rerender) rerender(); }})}, t('pDelete')) : null,
        el('div', {class:'spacer'}),
        el('button', {type:'button', class:'btn primary', onclick:()=>{ if(isNew && !p.name.trim()){ toast(t('pNewName')); return; } saveP(); api.close(); }}, t('done'))
      ];
    }
  });
}

function renderPoolsCard(rerender){
  const card = el('section', {class:'card', id:'pools-card'});
  card.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('tPools')), el('span', {class:'sub'}, t('tPoolsHint')), el('div', {class:'spacer'}),
    el('button', {type:'button', class:'btn sm', onclick:()=>{ const n = S().pools.length+1; S().pools.push({id:uid('pool'), name:'مجموعة '+n, nameEn:'Group '+n, seats:{basic:1, contracted:1}, byCategory:{}}); commit('settings'); rerender(); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('tPoolAdd')])]));
  const body = el('div', {class:'card-pad stack', style:{gap:'10px'}});
  for(const pl of S().pools){
    const bc = pl.byCategory||{};
    const row = el('div', {class:'rule-card'}, [
      el('div', {class:'rc-head'}, [
        el('input', {class:'input sm', value:poolName(pl), style:{fontWeight:'600', maxWidth:'220px'}, onchange:e=>{ const v = e.target.value.trim(); if(!v) return; if(App.ui.lang==='en') pl.nameEn = v; else pl.name = v; commit('settings'); }}),
        el('span', {class:'muted', style:{fontSize:'12px'}}, activePeople().filter(p=>p.pool===pl.id).length+' '+(App.ui.lang==='ar'?'نشط':'active')),
        el('div', {class:'spacer'}),
        S().pools.length>1 ? el('button', {type:'button', class:'icon-btn sm', html:ICON.trash, 'aria-label':t('del'), onclick:()=>confirmDialog(t('del'), t('tPoolDelQ'), {danger:true, label:t('del'), onConfirm:()=>{ const first = S().pools.find(x=>x!==pl); App.data.people.forEach(p=>{ if(p.pool===pl.id) p.pool = first.id; }); S().pools = S().pools.filter(x=>x!==pl); commit('settings'); rerender(); }})}) : null
      ]),
      el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('tSeatsBasic')), Stepper(pl.seats.basic, v=>{ pl.seats.basic = v; commit('settings'); }, {min:0, max:9, sm:true}), el('span', {class:'lab', style:{minWidth:'auto', marginInlineStart:'12px'}}, t('tSeatsContracted')), Stepper(pl.seats.contracted, v=>{ pl.seats.contracted = v; commit('settings'); }, {min:0, max:9, sm:true})])
    ]);
    const catRow = el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('tSeatsByCat'))]);
    for(const c of Object.keys(bc)) catRow.appendChild(el('span', {class:'chip'}, [c, Stepper(bc[c], v=>{ bc[c] = v; commit('settings'); }, {min:0, max:9, sm:true}), el('button', {type:'button', class:'x', html:ICON.x, onclick:()=>{ delete bc[c]; commit('settings'); rerender(); }})]));
    const add = el('button', {type:'button', class:'chip', html:ICON.plus});
    add.addEventListener('click', ()=>menu(add, App.data.categories.filter(c=>c.kind!=='excluded' && bc[c.name]==null).map(c=>({label:c.name, meta:kindLabel(c.kind), onClick:()=>{ pl.byCategory = Object.assign(bc, {[c.name]:seatsFor(pl, c.kind)}); commit('settings'); rerender(); }}))));
    catRow.appendChild(add);
    row.appendChild(catRow);
    body.appendChild(row);
  }
  card.appendChild(body);
  return card;
}
