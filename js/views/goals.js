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

function goalTypeLabel(type){ return t({cover:'gTypeCover', atLeast:'gTypeAtLeast', atMost:'gTypeAtMost', maxGap:'gTypeMaxGap'}[type]); }
function goalTypeHint(type){ return t({cover:'gHintCover', atLeast:'gHintAtLeast', atMost:'gHintAtMost', maxGap:'gHintMaxGap'}[type]); }

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

function goalCard(g, i, paint){
  const set = S();
  const upd = ()=>goalsChanged();
  const st = goalStatusLine(g);
  let stText = '';
  if(g.type==='cover') stText = t('gStCover', st.done, st.total);
  else if(g.type==='maxGap') stText = t('gStGap', st.late, st.total);
  else stText = t('gStPool', st.total);
  const card = el('div', {class:'rule-card goal-card'+(g.on?'':' off'), 'data-goal':g.id});
  card.appendChild(el('div', {class:'rc-head'}, [
    Switch(g.on, v=>{ g.on = v; upd(); paint(); }, t('on')),
    el('span', {class:'goal-ic', html:ICON.target}),
    el('b', null, goalTypeLabel(g.type)),
    el('span', {class:'muted', style:{fontSize:'12px'}}, stText),
    el('div', {class:'spacer'}),
    Seg([{value:'must',label:t('gMust')},{value:'try',label:t('gTry')}], g.strict, v=>{ g.strict = v; upd(); }, {cls:'sm'}),
    el('button', {type:'button', class:'icon-btn sm', html:ICON.trash, 'aria-label':t('del'), onclick:()=>{ set.goals.splice(i,1); upd(); paint(); }})
  ]));
  card.appendChild(el('div', {class:'hint', style:{fontSize:'12px'}}, goalTypeHint(g.type)));
  card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gScope')), ScopePicker(g.scope, ()=>{ upd(); }, {})]));
  if(g.type==='cover'){
    card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gTimes')), Stepper(g.times||1, v=>{ g.times = v; upd(); }, {min:1, max:6, sm:true})]));
    card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gSince')), DateInput(g.since, v=>{ g.since = v; upd(); paint(); })]));
    card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gBy')), OptDate(g.by, v=>{ g.by = v; upd(); }, t('gNoDeadline'))]));
    card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gRepeat')), Switch(!!g.repeat, v=>{ g.repeat = v; upd(); })]));
  } else if(g.type==='atLeast' || g.type==='atMost'){
    card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gN')), Stepper(g.n||0, v=>{ g.n = v; upd(); }, {min:0, max:300, sm:true, unit:t('gPerPlan')})]));
  } else if(g.type==='maxGap'){
    card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gDays')), Stepper(g.days||30, v=>{ g.days = v; upd(); paint(); }, {min:7, max:730, step:1, sm:true, unit:t('daysU')})]));
  }
  return card;
}

function goalsEditor(paint){
  const list = el('div', {class:'rules-list'});
  S().goals.forEach((g,i)=>list.appendChild(goalCard(g, i, paint)));
  if(!S().goals.length) list.appendChild(el('div', {class:'empty', style:{padding:'18px'}}, t('goalsNone')));
  const add = el('button', {type:'button', class:'btn sm outline', style:{alignSelf:'flex-start'}}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('goalAdd')]);
  add.addEventListener('click', ()=>menu(add, GOAL_TYPES.map(type=>({label:goalTypeLabel(type), meta:goalTypeHint(type).slice(0,38)+'…', onClick:()=>{ S().goals.push(newGoal(type)); goalsChanged(); paint(); }})), {width:340}));
  list.appendChild(add);
  return list;
}

function openGoals(){
  sheet({
    title:()=>t('goalsTitle'),
    sub:()=>[el('span', null, t('goalsHint'))],
    body:api=>[goalsEditor(()=>api.render())],
    foot:api=>[el('button', {type:'button', class:'btn ghost', onclick:()=>{ api.close(); goTab('rules', 'rule-goals'); }}, t('rTitle')+' →'), el('div', {class:'spacer'}), el('button', {type:'button', class:'btn primary', onclick:()=>api.close()}, t('done'))]
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
      el('div', {class:'gl-main'}, [el('b', null, goalTitle(g)), el('span', null, [el('span', {class:'tag '+(g.strict==='must'?'warn':'')}, t(g.strict==='must'?'gMust':'gTry')), pr ? ' '+pr.label : ''])]),
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

function goalsProgressBlock(plan){
  const rows = goalProgress(plan);
  if(!rows.length) return null;
  const box = el('div', {class:'goal-progress'});
  box.appendChild(el('div', {class:'section-title'}, t('goalProgressTitle')));
  for(const r of rows){
    box.appendChild(el('div', {class:'goal-prow '+r.state}, [
      el('span', {html:r.state==='met'?ICON.ok:(r.state==='short'?ICON.alert:ICON.target), style:{display:'flex'}}),
      el('div', {class:'gl-main'}, [el('b', null, r.title), el('span', null, t('gp_'+r.state)+' · '+r.label+(r.paced?' · '+t('gPaced'):''))]),
      goalMeter(r)
    ]));
  }
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

function fixVisitAsOverride(v){
  const exists = S().overrides.find(o=>o.id===v.overrideId);
  if(exists){ openOverride(exists.id); return; }
  const o = newOverride({date:v.date, facilityId:v.facilityId, people:visitTeamIds(v), fill:false});
  S().overrides.push(o);
  commit('settings', {keepPlan:true});
  if(App.plan){ v.fixed = true; v.overrideId = o.id; savePlan(); renderResults(); }
  if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update();
  toast(t('fixedSaved'));
}
