function goalsChanged(refresh){
  commit('settings');
  if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update();
  if(refresh) refresh();
  if(activePop) activePop.position();
}

function ScopePicker(scope, onChange, opts){
  opts = opts||{};
  const box = el('div', {class:'stack', style:{gap:'8px'}});
  const kinds = [{value:'all',label:t('scopeAll')},{value:'type',label:t('scopeType')},{value:'category',label:t('scopeCategory')},{value:'location',label:t('scopeLocation')},{value:'facility',label:t('scopeFacility')}];
  function paint(){
    clear(box);
    box.appendChild(Seg(kinds, scope.kind, v=>{ scope.kind = v; scope.ids = []; onChange(); paint(); }, {cls:'sm scope-seg'}));
    if(scope.kind==='all') return;
    if(scope.kind==='facility'){
      box.appendChild(FacilityPicker(scope.ids, ids=>{ scope.ids = ids; onChange(); }, {addLabel:t('add'), filter:f=>schedulableFacilities().includes(f)}));
      return;
    }
    let options;
    if(scope.kind==='type') options = [{value:'basic', label:t('kBasic')},{value:'contracted', label:t('kContracted')}];
    else if(scope.kind==='category') options = App.data.categories.filter(c=>c.kind!=='excluded').map(c=>({value:c.name, label:c.name}));
    else { const used = new Set(schedulableFacilities().map(f=>f.locationId)); options = App.data.locations.filter(l=>used.has(l.id)).map(l=>({value:l.id, label:l.name})); }
    if(options.length>10){
      const b = el('button', {type:'button', class:'chip'+(scope.ids.length?' on':'')}, scope.ids.length ? scopeLabel(scope) : t('choose'));
      b.addEventListener('click', ()=>popover(b, ()=>[el('div', {class:'pop-title'}, kinds.find(k=>k.value===scope.kind).label), ChipToggles(options, scope.ids, ids=>{ scope.ids = ids; onChange(); })], {width:360, onClose:paint}));
      box.appendChild(b);
    } else box.appendChild(ChipToggles(options, scope.ids, ids=>{ scope.ids = ids; onChange(); }));
  }
  paint();
  return box;
}

const GOAL_KEY = {cover:'Cover', atLeast:'AtLeast', atMost:'AtMost', maxGap:'MaxGap', person:'Person', together:'Together', special:'Special', pattern:'Pattern'};
function goalTypeLabel(type){ return t('gType'+GOAL_KEY[type]); }
function goalTypeHint(type){ return t('gHint'+GOAL_KEY[type]); }

function PersonSelect(id, onChange, opts){
  opts = opts||{};
  const b = el('button', {type:'button', class:'select person-select'}, el('span', {class:'select-lbl'}, id && personById(id) ? personById(id).name : t('choosePerson')));
  b.addEventListener('click', ()=>{
    const items = [];
    for(const pl of S().pools){
      const members = activePeople().filter(p=>p.pool===pl.id && !(opts.exclude||[]).includes(p.id));
      if(!members.length) continue;
      if(items.length) items.push({sep:true});
      for(const p of members) items.push({label:p.name, meta:poolName(pl), selected:p.id===id, onClick:()=>{ id = p.id; b.firstChild.textContent = p.name; onChange(p.id); }});
    }
    menu(b, items, {search:items.length>8, width:280});
  });
  return b;
}

function FacilitySelect(id, onChange){
  const f = facilityById(id);
  const b = el('button', {type:'button', class:'select', style:{width:'100%'}}, el('span', {class:'select-lbl'}, f ? f.name+' · '+f.category : t('ovPickFacility')));
  b.addEventListener('click', ()=>{
    const list = schedulableFacilities().slice().sort((a,b)=>norm(a.name)<norm(b.name)?-1:1);
    menu(b, list.map(x=>({label:x.name, meta:x.category, selected:x.id===id, onClick:()=>{ id = x.id; b.firstChild.textContent = x.name+' · '+x.category; onChange(x.id); }})), {search:true, width:360});
  });
  return b;
}

function goalStatusText(g){
  const st = goalStatusLine(g);
  if(g.type==='cover') return t('gStCover', st.done, st.total);
  if(g.type==='maxGap') return t('gStGap', st.late, st.total);
  if(g.type==='person') return st.people ? t('ovPeopleN', st.people) : t('gNeedPeople');
  if(g.type==='together') return st.ok ? '' : t('gNeedPair');
  if(g.type==='special') return st.ok ? '' : t('ovPickFacility');
  if(g.type==='pattern') return st.people ? t('ovPeopleN', st.people) : t('gNeedPeople');
  return t('gStPool', st.total);
}

function goalFields(g, upd, paint){
  const row = (lab, ctl)=>el('div', {class:'rc-row'}, [el('span', {class:'lab'}, lab), ctl]);
  const out = [];
  if(g.type==='person'){
    out.push(row(t('gWho'), PersonPicker(g.people.slice(), ids=>{ g.people = ids; upd(); paint(); })));
    out.push(row(t('gRel'), Seg(PERSON_RELS.map(r=>({value:r, label:t('rel_'+r)})), g.rel, v=>{ g.rel = v; upd(); paint(); }, {cls:'sm wrap-seg'})));
    if(g.rel!=='never' && g.rel!=='only') out.push(row(t('gVisitsN'), Stepper(g.n, v=>{ g.n = v; upd(); }, {min:0, max:60, sm:true, unit:t('gPerPlan')})));
    out.push(row(g.rel==='never' ? t('gWhere') : (g.rel==='only' ? t('gOnlyWhere') : t('gCountWhere')), ScopePicker(g.scope, upd)));
  } else if(g.type==='together'){
    out.push(row(t('gPair'), el('div', {class:'row wrap', style:{gap:'6px'}}, [
      PersonSelect(g.a, v=>{ g.a = v; upd(); paint(); }, {exclude:[g.b]}),
      el('span', {class:'muted'}, '+'),
      PersonSelect(g.b, v=>{ g.b = v; upd(); paint(); }, {exclude:[g.a]})
    ])));
    out.push(row(t('gRel'), Seg(TOGETHER_RELS.map(r=>({value:r, label:t('trel_'+r)})), g.rel, v=>{ g.rel = v; upd(); paint(); }, {cls:'sm'})));
    out.push(row(t('gShare'), Slider(g.pct, v=>{ g.pct = v; upd(); }, {min:0, max:100, step:5, format:v=>v+'%'})));
    out.push(row(t('gCountWhere'), ScopePicker(g.scope, upd)));
    out.push(el('div', {class:'hint', style:{fontSize:'12px'}}, t('gTogetherHow')));
  } else if(g.type==='pattern'){
    out.push(row(t('gWho'), PersonPicker(g.people.slice(), ids=>{ g.people = ids; upd(); paint(); })));
    out.push(PatternEditor(g.pattern, ()=>upd()));
    out.push(row(t('gBetween'), el('div', {class:'row wrap', style:{gap:'6px'}}, [OptDate(g.from, v=>{ g.from = v; upd(); }, t('gPlanStart')), el('span', {class:'muted'}, '–'), OptDate(g.to, v=>{ g.to = v; upd(); }, t('gPlanEnd'))])));
  } else if(g.type==='special'){
    out.push(row(t('ovFacility'), FacilitySelect(g.facilityId, v=>{ g.facilityId = v; upd(); paint(); })));
    out.push(row(t('gTimes'), Stepper(g.times, v=>{ g.times = v; upd(); }, {min:1, max:20, sm:true, unit:t('gPerPlan')})));
    out.push(row(t('gBetween'), el('div', {class:'row wrap', style:{gap:'6px'}}, [OptDate(g.from, v=>{ g.from = v; upd(); }, t('gPlanStart')), el('span', {class:'muted'}, '–'), OptDate(g.to, v=>{ g.to = v; upd(); }, t('gPlanEnd'))])));
    out.push(row(t('ovPeople'), PersonPicker(g.people.slice(), ids=>{ g.people = ids; upd(); paint(); })));
    out.push(row(t('ovFill'), Switch(g.fill || !g.people.length, v=>{ g.fill = v; upd(); }, null, {disabled:!g.people.length})));
  } else {
    out.push(row(t('gScope'), ScopePicker(g.scope, upd)));
    if(g.type==='cover'){
      out.push(row(t('gTimes'), Stepper(g.times||1, v=>{ g.times = v; upd(); }, {min:1, max:6, sm:true})));
      out.push(row(t('gSince'), DateInput(g.since, v=>{ g.since = v; upd(); paint(); })));
      out.push(row(t('gBy'), OptDate(g.by, v=>{ g.by = v; upd(); }, t('gNoDeadline'))));
      out.push(row(t('gRepeat'), Switch(!!g.repeat, v=>{ g.repeat = v; upd(); })));
    } else if(g.type==='atLeast' || g.type==='atMost'){
      out.push(row(t('gN'), Stepper(g.n||0, v=>{ g.n = v; upd(); }, {min:0, max:300, sm:true, unit:t('gPerPlan')})));
      if(g.type==='atLeast') out.push(row(t('gAtLeastRepeat'), Switch(!!g.repeat, v=>{ g.repeat = v; upd(); })));
    } else if(g.type==='maxGap'){
      out.push(row(t('gDays'), Stepper(g.days||30, v=>{ g.days = v; upd(); paint(); }, {min:7, max:730, step:1, sm:true, unit:t('daysU')})));
    }
  }
  return out;
}

function OptDate(value, onChange, emptyLabel){
  const wrap = el('div', {class:'row', style:{gap:'4px'}});
  function paint(){
    clear(wrap);
    wrap.appendChild(DateInput(value, v=>{ value = v; onChange(v); paint(); }, {placeholder:emptyLabel}));
    if(value) wrap.appendChild(el('button', {type:'button', class:'icon-btn sm', 'aria-label':t('clear'), title:t('clear'), html:ICON.x, onclick:()=>{ value = null; onChange(null); paint(); }}));
  }
  paint();
  return wrap;
}

function openGoals(focusId){
  const api = sheet({
    cls:'wide',
    title:()=>t('goalsTitle'),
    sub:()=>[el('span', null, t('goalsHint'))],
    body:api=>[GoalsManager({selectId:focusId, onChange:()=>{}})],
    foot:api=>[el('button', {type:'button', class:'btn ghost', onclick:()=>{ api.close(); goTab('rules', 'rule-goals'); }}, t('rTitle')+' →'), el('div', {class:'spacer'}), el('button', {type:'button', class:'btn primary', onclick:()=>api.close()}, t('done'))],
    onClose:()=>{ if(App.ui.tab==='team' || App.ui.tab==='rules') setTimeout(renderTab, 0); }
  });
}

function goalsPop(refresh){
  const box = el('div', {class:'stack', style:{gap:'8px'}});
  const goals = S().goals;
  const prog = App.plan && !App.plan.stale ? goalProgress(App.plan) : [];
  if(!goals.length) box.appendChild(el('div', {class:'hint'}, t('goalsNone')));
  for(const g of goals){
    const pr = prog.find(r=>r.g.id===g.id);
    box.appendChild(el('div', {class:'goal-row'+(g.on?'':' off')}, [
      Switch(g.on, v=>{ g.on = v; goalsChanged(refresh); }),
      el('div', {class:'gl-main'}, [el('b', null, goalTitle(g)), el('span', null, [pr ? pr.label : ''])]),
      LevelChip(g.lv, goalRuleId(g), v=>{ g.lv = v; goalsChanged(refresh); }, {sm:true}),
      pr ? goalMeter(pr) : null
    ]));
  }
  box.appendChild(el('div', {class:'row', style:{paddingTop:'6px', borderTop:'1px solid var(--line)'}}, [
    el('button', {type:'button', class:'btn sm outline', onclick:()=>{ closePop(); openGoals(); }}, [el('span', {html:ICON.rules, style:{display:'flex'}}), t('goalsManage')])
  ]));
  return box;
}

function goalMeter(r){
  return el('span', {class:'goal-meter '+r.state, title:r.label}, [el('i', {style:{'--p':Math.max(0, Math.min(100, r.pct||0))+'%'}}), el('span', {class:'num'}, (r.pct||0)+'%')]);
}

function goalRowEl(r){
  const ic = r.state==='met' ? ICON.ok : (r.state==='short' || r.state==='exceeded' ? ICON.alert : ICON.target);
  return el('div', {class:'goal-prow '+r.state}, [
    el('span', {html:ic, style:{display:'flex'}}),
    el('div', {class:'gl-main'}, [el('b', null, r.title), el('span', null, t('gp_'+r.state)+' · '+r.label+(r.paced?' · '+t('gPaced'):''))]),
    goalMeter(r)
  ]);
}
function goalsProgressBlock(plan){
  const box = el('div', {class:'goal-progress'});
  const cur = goalProgress(plan, null, {source:'current'});
  const snap = plan.gen && plan.stale ? goalProgress(plan, null, {source:'snapshot'}) : [];
  if(!cur.length && !snap.length) return null;
  box.appendChild(el('div', {class:'section-title'}, t('goalProgressTitle')));
  if(snap.length){
    box.appendChild(el('div', {class:'hint'}, t('goalSnapshotHint')));
    for(const r of snap) box.appendChild(goalRowEl(r));
    box.appendChild(el('div', {class:'section-title', style:{marginTop:'10px'}}, t('goalCurrentTitle')));
  }
  for(const r of cur) box.appendChild(goalRowEl(r));
  return box;
}

function fixedPop(refresh){
  const box = el('div', {class:'stack', style:{gap:'6px', maxHeight:'380px', overflow:'auto'}});
  const list = S().overrides.slice().sort((a,b)=>(a.date||'')<(b.date||'')?-1:1);
  if(!list.length) box.appendChild(el('div', {class:'hint'}, t('fixedHint')));
  for(const o of list){
    const f = facilityById(o.facilityId);
    const issues = overrideIssues(o).filter(x=>x.sev!=='info');
    box.appendChild(el('button', {type:'button', class:'fixed-row'+(o.on?'':' off'), onclick:()=>{ closePop(); openOverride(o.id); }}, [
      el('span', {class:'fx-date'}, [el('b', {class:'num'}, o.date ? String(ymdOf(ordOf(o.date)).d) : '—'), el('span', null, o.date ? monthName(ymdOf(ordOf(o.date)).m).slice(0,3) : '')]),
      el('span', {class:'gl-main'}, [el('b', null, f ? f.name : t('ovPickFacility')), el('span', null, o.people.length ? o.people.map(id=>(personById(id)||{}).name).filter(Boolean).join('، ') + (o.fill?' +':'') : t('ovAutoShort'))]),
      issues.length ? el('span', {class:'tag warn', html:ICON.alert}) : null
    ]));
  }
  box.appendChild(el('div', {class:'row', style:{paddingTop:'6px', borderTop:'1px solid var(--line)'}}, [
    el('button', {type:'button', class:'btn sm primary', onclick:()=>{ closePop(); addOverride({}); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('fixedAdd')])
  ]));
  return box;
}

function addOverride(p){
  const o = newOverride(p);
  if(!p.date){ const w = planWindow(); if(!w.error && w.work.length) o.date = isoOf(w.work[0]); }
  S().overrides.push(o);
  goalsChanged();
  openOverride(o.id, true);
}

function PersonPicker(ids, onChange){
  const wrap = el('div', {class:'chips'});
  function paint(){
    clear(wrap);
    for(const id of ids){
      const p = personById(id); if(!p) continue;
      wrap.appendChild(el('span', {class:'chip person-chip'+(p.gender==='f'?' g-f':'')}, [p.name, el('span', {class:'muted', style:{fontSize:'11px'}}, poolName(poolById(p.pool))), el('button', {type:'button', class:'x', html:ICON.x, 'aria-label':t('del'), onclick:()=>{ ids = ids.filter(x=>x!==id); paint(); onChange(ids.slice()); }})]));
    }
    const add = el('button', {type:'button', class:'chip', html:ICON.plus+'<span>'+t('ovAddPerson')+'</span>'});
    add.addEventListener('click', ()=>{
      const items = [];
      for(const pl of S().pools){
        const members = activePeople().filter(p=>p.pool===pl.id && !ids.includes(p.id));
        if(!members.length) continue;
        if(items.length) items.push({sep:true});
        for(const p of members) items.push({label:p.name, meta:poolName(pl), onClick:()=>{ ids = ids.concat([p.id]); paint(); onChange(ids.slice()); }});
      }
      menu(add, items, {search:items.length>8, width:280});
    });
    wrap.appendChild(add);
  }
  paint();
  return wrap;
}

function openOverride(id, isNew){
  sheet({
    title:()=>{ const o = overrideById(id); const f = o && facilityById(o.facilityId); return f ? f.name : t('fixedNew'); },
    sub:()=>{ const o = overrideById(id); return o ? [el('span', {class:'tag', html:ICON.flag+' '+t('fixedTag')}), o.date ? el('span', null, fmtDate(o.date,'wdm')) : null] : []; },
    body:api=>{
      const o = overrideById(id);
      if(!o){ api.close(); return []; }
      const upd = ()=>{ goalsChanged(); api.render(); };
      const out = [];
      out.push(el('section', {class:'sheet-sec stack', style:{gap:'12px'}}, [
        el('div', {class:'field'}, [el('label', null, t('ovDate')), DateInput(o.date, v=>{ o.date = v; upd(); })]),
        el('div', {class:'field'}, [el('label', null, t('ovFacility')), (()=>{
          const f = facilityById(o.facilityId);
          const b = el('button', {type:'button', class:'select', style:{width:'100%'}}, el('span', {class:'select-lbl'}, f ? f.name+' · '+f.category : t('ovPickFacility')));
          b.addEventListener('click', ()=>{
            const ranked = App.data.facilities.slice().sort((a,b)=>{ const ka = schedulableFacilities().includes(a)?0:1, kb = schedulableFacilities().includes(b)?0:1; return ka-kb || (norm(a.name)<norm(b.name)?-1:1); });
            menu(b, ranked.map(x=>({label:x.name, meta:x.category+(facilityKind(x)==='excluded'||x.excluded?' · '+t('kExcluded'):''), selected:x.id===o.facilityId, onClick:()=>{ o.facilityId = x.id; upd(); }})), {search:true, width:360});
          });
          return b;
        })()]),
        el('div', {class:'field'}, [el('label', null, t('ovPeople')), PersonPicker(o.people.slice(), ids=>{ o.people = ids; upd(); })]),
        setting(t('ovFill'), t('ovFillHint'), Switch(o.fill || !o.people.length, v=>{ o.fill = v; upd(); })),
        el('div', {class:'field'}, [el('label', null, t('ovNote')), el('input', {class:'input', value:o.note||'', placeholder:'—', onchange:e=>{ o.note = e.target.value; commit('settings'); }})]),
        setting(t('on'), null, Switch(o.on!==false, v=>{ o.on = v; upd(); }))
      ]));
      const f = facilityById(o.facilityId);
      if(f){
        const kind = visitKindOf(f);
        const need = S().pools.map(pl=>seatsFor(pl, kind, f.category)+' '+poolName(pl)).join(' · ');
        out.push(el('div', {class:'hint', style:{marginBottom:'8px'}}, t('ovUsualTeam', need)));
      }
      const issues = overrideIssues(o);
      if(issues.length) out.push(el('section', {class:'sheet-sec stack', style:{gap:'4px'}}, issues.map(x=>el('div', {class:'check '+(x.sev==='error'?'bad':(x.sev==='warn'?'soft':'ok'))}, [el('span', {html:x.sev==='info'?ICON.info:ICON.alert, style:{display:'flex'}}), t.apply(null, [x.key].concat(x.args||[]))]))));
      return out;
    },
    foot:api=>[
      el('button', {type:'button', class:'btn ghost', style:{color:'var(--danger)'}, onclick:()=>{ S().overrides = S().overrides.filter(x=>x.id!==id); goalsChanged(); api.close(); }}, [el('span', {html:ICON.trash, style:{display:'flex'}}), t('del')]),
      el('div', {class:'spacer'}),
      el('button', {type:'button', class:'btn primary', onclick:()=>{ api.close(); const o = overrideById(id); if(o && o.facilityId && App.plan && !App.plan.approved && App.plan.stale) toast(t('fixedSaved'), {label:t('regenerate'), onClick:()=>doGenerate(document.getElementById('generate-btn'))}); }}, t('done'))
    ],
    onClose:()=>{
      const o = overrideById(id);
      if(isNew && o && !o.facilityId){ S().overrides = S().overrides.filter(x=>x.id!==id); goalsChanged(); }
      if(App.ui.tab==='rules') setTimeout(renderTab, 0);
    }
  });
}

function overridesEditor(paint){
  const list = el('div', {class:'rules-list'});
  const arr = S().overrides.slice().sort((a,b)=>(a.date||'')<(b.date||'')?-1:1);
  if(!arr.length) list.appendChild(el('div', {class:'hint'}, t('fixedHint')));
  for(const o of arr){
    const f = facilityById(o.facilityId);
    const issues = overrideIssues(o).filter(x=>x.sev!=='info');
    list.appendChild(el('div', {class:'rule-card'+(o.on?'':' off')}, [el('div', {class:'rc-head'}, [
      Switch(o.on!==false, v=>{ o.on = v; commit('settings'); paint(); }),
      el('span', {class:'num', style:{fontWeight:'600', minWidth:'86px'}}, o.date ? fmtDate(o.date,'wdm') : '—'),
      el('b', {style:{flex:'1', minWidth:'0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}, f ? f.name : t('ovPickFacility')),
      el('span', {class:'muted', style:{fontSize:'12px'}}, o.people.length ? t('ovPeopleN', o.people.length) : t('ovAutoShort')),
      issues.length ? el('span', {class:'tag warn', html:ICON.alert}) : null,
      el('button', {type:'button', class:'btn sm ghost', onclick:()=>openOverride(o.id)}, t('edit'))
    ])]));
  }
  list.appendChild(el('button', {type:'button', class:'btn sm outline', style:{alignSelf:'flex-start'}, onclick:()=>addOverride({})}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('fixedAdd')]));
  return list;
}

function fixVisitAsOverride(v0){
  const v = (App.plan && App.plan.visits.find(x=>x.id===v0.id)) || v0;
  const exists = S().overrides.find(o=>o.id===v.overrideId);
  if(exists){ openOverride(exists.id); return; }
  const ids = visitTeamIds(v);
  const o = newOverride({date:v.date, facilityId:v.facilityId, people:ids, fill:false});
  S().overrides.push(o);
  commit('settings', {keepPlan:true});
  if(App.plan){ v.fixed = true; v.overrideId = o.id; v.locked = ids.slice(); v.auto = false; savePlan(); renderResults(); }
  if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update();
  toast(t('fixedSaved'));
}
