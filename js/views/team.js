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

function renderTeam(root){
  root.appendChild(Mount(node=>{
    const out = [];
    const card = el('section', {class:'card', id:'team-card'});
    card.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('tTitle')), el('span', {class:'sub'}, t('teamActive', activePeople().length)), el('div', {class:'spacer'}),
      el('button', {type:'button', class:'btn primary sm', onclick:()=>{ const p = freshPerson({name:'', pool:S().pools[0].id, origin:locIdFor('دمنهور')}); openPerson(null, p, ()=>node.render()); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('tAdd')])]));
    const counts = App.data.history.counts||{};
    for(const pl of S().pools){
      const members = teamPeople().filter(p=>p.pool===pl.id);
      card.appendChild(el('div', {class:'pool-block-h'}, [el('span', {class:'dot', style:{background:poolIndex(pl.id)===0?'var(--primary)':(poolIndex(pl.id)===1?'var(--ink-3)':'var(--contracted)')}}), el('b', null, poolName(pl)), el('span', null, members.filter(p=>p.active!==false).length+' · '+t('tSeatsBasic')+' '+seatsFor(pl,'basic')+' · '+t('tSeatsContracted')+' '+seatsFor(pl,'contracted'))]));
      const grid = el('div', {class:'people-grid'});
      for(const p of members) grid.appendChild(personCard(p, counts, ()=>node.render()));
      if(!members.length) grid.appendChild(el('div', {class:'empty'}, '—'));
      card.appendChild(grid);
    }
    const retired = App.data.people.filter(p=>p.retired);
    if(retired.length){
      const tog = el('button', {type:'button', class:'btn ghost sm', style:{margin:'0 16px 14px'}, onclick:()=>{ App.ui.teamShowRetired = !App.ui.teamShowRetired; node.render(); }}, [el('span', {html:ICON.down, style:{display:'flex', transform:App.ui.teamShowRetired?'rotate(180deg)':''}}), t('tShowRetired', retired.length)]);
      card.appendChild(tog);
      if(App.ui.teamShowRetired){ const g = el('div', {class:'people-grid', style:{paddingTop:'0'}}); for(const p of retired) g.appendChild(personCard(p, counts, ()=>node.render())); card.appendChild(g); }
    }
    out.push(card);
    out.push(renderPoolsCard(()=>node.render()));
    return out;
  }));
}

function personCard(p, counts, rerender){
  const sb = p.skill.basic, sc = p.skill.contracted;
  const tags = [];
  if(p.fixed!=null) tags.push(el('span', {class:'tag'}, t('pFixed')+' '+p.fixed));
  else if(p.share!=null && p.share!==1) tags.push(el('span', {class:'tag'}, t('pShare')+' '+Math.round(p.share*100)+'%'));
  if(p.maxRun) tags.push(el('span', {class:'tag'}, '≤'+p.maxRun+' '+(App.ui.lang==='ar'?'متتالية':'in a row')));
  if(p.maxPerWeek) tags.push(el('span', {class:'tag'}, '≤'+p.maxPerWeek+'/'+(App.ui.lang==='ar'?'أسبوع':'wk')));
  if(p.distPref) tags.push(el('span', {class:'tag '+p.distPref}, t(p.distPref==='near'?'pDistNear':'pDistFar')));
  if((p.blocked||[]).length) tags.push(el('span', {class:'tag danger'}, (p.blocked||[]).length+' '+t('rBlocked')));
  const upcomingOff = (p.off||[]).filter(r=>r.to>=todayISO()).length;
  if(upcomingOff) tags.push(el('span', {class:'tag warn'}, upcomingOff+' '+t('pOff')));
  const origin = locationById(p.origin);
  return el('button', {type:'button', class:'pcard'+(p.active===false||p.retired?' inactive':''), onclick:()=>openPerson(p.id, null, rerender)}, [
    el('div', {class:'pcard-head'}, [
      el('span', {class:'avatar'+(p.gender==='f'?' f':'')}, (p.name||'?').slice(0,1)),
      el('div', {style:{flex:'1', minWidth:'0'}}, [el('b', null, p.name||'—'), el('span', null, [p.gender ? t(p.gender==='m'?'pMale':'pFemale') : t('pUnset'), origin ? ' · '+origin.name : '', ' · '+t('pStats', counts[p.id]||0)].join(''))]),
      p.active===false ? el('span', {class:'tag'}, t('off')) : null
    ]),
    el('div', {class:'skill-mini'}, [
      el('span', null, t('kBasic')), el('i', {style:{'--p':sb+'%'}}), el('span', {class:'num'}, String(sb)),
      el('span', null, t('kContracted')), el('i', {class:'c', style:{'--p':sc+'%'}}), el('span', {class:'num'}, String(sc))
    ]),
    el('div', null, [el('div', {class:'muted', style:{fontSize:'11.5px', marginBottom:'4px'}}, t('pAvail')+': '+availSummary(p)), weekStrip(p, 14)]),
    tags.length ? el('div', {class:'chips', style:{gap:'4px'}}, tags) : null
  ]);
}

function openPerson(id, draft, rerender){
  const isNew = !!draft;
  const p = draft || personById(id);
  if(!p) return;
  const saveP = ()=>{ if(isNew){ if(!p.name.trim()) return; if(!App.data.people.includes(p)) App.data.people.push(p); } commit('data'); if(rerender) rerender(); };
  sheet({
    title:()=>p.name || t('tAdd'),
    sub:()=>[el('span', {class:'tag'}, poolName(poolById(p.pool))), p.retired ? el('span', {class:'tag warn'}, t('tRetired')) : null],
    body:api=>{
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

      const load = el('section', {class:'sheet-sec'}, [
        el('div', {class:'section-title'}, t('pShare')),
        setting(t('pShare'), t('pShareHint'), Seg([{value:'share', label:t('pFixedOff')},{value:'fixed', label:t('pFixed')}], p.fixed!=null?'fixed':'share', v=>{ p.fixed = v==='fixed' ? 4 : null; saveP(); R(); }, {cls:'sm'}),
          {full: p.fixed!=null ? Stepper(p.fixed, v=>{ p.fixed = v; saveP(); }, {min:0, max:99}) : Slider(Math.round((p.share==null?1:p.share)*100), v=>{ p.share = v/100; saveP(); }, {min:0, max:200, step:10, format:v=>v+'%'})})
      ]);

      const a = p.avail;
      const availSec = el('section', {class:'sheet-sec'});
      availSec.appendChild(el('div', {class:'section-title'}, t('pAvail')));
      availSec.appendChild(Seg([{value:'plan',label:t('pAvailPlan')},{value:'weekdays',label:t('pAvailWeekdays')},{value:'cycle',label:t('pAvailCycle')}], a.mode, v=>{ a.mode = v; if(v==='weekdays' && !(a.weekdays&&a.weekdays.length)) a.weekdays = S().calendar.workdays.slice(); saveP(); R(); }, {cls:'block'}));
      if(a.mode==='weekdays') availSec.appendChild(el('div', {style:{marginTop:'12px'}}, DaySet(a.weekdays, v=>{ a.weekdays = v; saveP(); R(); })));
      if(a.mode==='cycle'){
        availSec.appendChild(el('div', {class:'grid-3', style:{marginTop:'12px'}}, [
          el('div', {class:'field'}, [el('label', null, t('pCycleOn')), Stepper(a.cycle.on, v=>{ a.cycle.on = v; saveP(); R(); }, {min:1, max:14})]),
          el('div', {class:'field'}, [el('label', null, t('pCycleOff')), Stepper(a.cycle.off, v=>{ a.cycle.off = v; saveP(); R(); }, {min:0, max:14})]),
          el('div', {class:'field'}, [el('label', null, t('pCycleAnchor')), DateInput(a.cycle.anchor, v=>{ a.cycle.anchor = v; saveP(); R(); })])
        ]));
      }
      availSec.appendChild(el('div', {style:{marginTop:'12px'}}, [el('div', {class:'muted', style:{fontSize:'11.5px', marginBottom:'4px'}}, t('pCyclePreview')), weekStrip(p, 14)]));
      availSec.appendChild(el('div', {class:'grid-2', style:{marginTop:'14px'}}, [
        el('div', {class:'field'}, [el('label', null, t('pMaxRun')), Stepper(p.maxRun, v=>{ p.maxRun = v; saveP(); }, {min:1, max:14, nullable:true, placeholder:t('noLimit')})]),
        el('div', {class:'field'}, [el('label', null, t('pMaxWeek')), Stepper(p.maxPerWeek, v=>{ p.maxPerWeek = v; saveP(); }, {min:1, max:14, nullable:true, placeholder:t('noLimit')})])
      ]));

      const offSec = el('section', {class:'sheet-sec'});
      offSec.appendChild(el('div', {class:'row'}, [el('div', {class:'section-title', style:{margin:'0'}}, t('pOff')), el('div', {class:'spacer'}), (p.off||[]).length ? el('button', {type:'button', class:'btn sm ghost', onclick:()=>{ p.off = []; saveP(); R(); }}, t('pOffClear')) : null]));
      offSec.appendChild(el('div', {class:'hint', style:{margin:'4px 0 10px'}}, t('pOffHint')));
      const cal = MiniCal({isSelected:iso=>isOff(p, iso), isWork:iso=>personPatternOn(p, ordOf(iso)), onPick:iso=>{ p.off = isOff(p, iso) ? removeOffDay(p.off, iso) : normalizeOff((p.off||[]).concat([{from:iso, to:iso}])); saveP(); paintSpans(); }, onRange:(x,y)=>{ p.off = normalizeOff((p.off||[]).concat([{from:x, to:y}])); saveP(); paintSpans(); }});
      const spans = el('div', {class:'chips', style:{marginTop:'10px'}});
      function paintSpans(){ clear(spans); for(const r of (p.off||[])) spans.appendChild(el('span', {class:'chip'}, [r.from===r.to ? fmtDate(r.from,'wdm') : fmtDate(r.from,'dm')+' – '+fmtDate(r.to,'dm'), el('button', {type:'button', class:'x', html:ICON.x, onclick:()=>{ p.off = p.off.filter(x=>x!==r); saveP(); paintSpans(); cal.repaint(); }})])); }
      paintSpans();
      offSec.appendChild(cal); offSec.appendChild(spans);

      const origin = el('section', {class:'sheet-sec'}, [
        el('div', {class:'section-title'}, t('rDistance')),
        setting(t('pOrigin'), null, Select(App.data.locations.slice().sort((a,b)=>a.km-b.km).map(l=>({value:l.id, label:l.name+' · '+l.km+' '+t('km')})), p.origin||'', v=>{ p.origin = v; saveP(); })),
        setting(t('pDistPref'), null, Seg([{value:'near',label:t('pDistNear')},{value:'',label:t('pDistAny')},{value:'far',label:t('pDistFar')}], p.distPref||'', v=>{ p.distPref = v||null; saveP(); }, {cls:'sm'})),
        el('div', {class:'field', style:{paddingTop:'10px'}}, [el('label', null, t('pBlocked')), FacilityPicker(p.blocked, ids=>{ p.blocked = ids; saveP(); }, {filter:f=>{ const k = facilityKind(f); return k==='basic'||k==='contracted'; }})])
      ]);
      return [basics, skill, load, availSec, offSec, origin];
    },
    foot:api=>{
      const exists = App.data.people.includes(p);
      return [
        exists ? el('button', {type:'button', class:'btn ghost', onclick:()=>{ p.retired = !p.retired; saveP(); api.render(); }}, p.retired ? t('pRestore') : t('pRetire')) : null,
        exists ? el('button', {type:'button', class:'btn ghost', style:{color:'var(--danger)'}, onclick:()=>confirmDialog(t('pDelete'), t('pDeleteQ'), {danger:true, label:t('del'), onConfirm:()=>{ App.data.people = App.data.people.filter(x=>x!==p); S().pairs = S().pairs.filter(r=>r.a!==p.id && r.b!==p.id); commit('data'); api.close(); if(rerender) rerender(); }})}, t('pDelete')) : null,
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
