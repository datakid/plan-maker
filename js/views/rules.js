function ruleSection(id, title, hint, status, build){
  const sec = el('section', {class:'card rule-sec', id});
  const body = el('div', {class:'card-body'});
  const statusEl = el('span', {class:'tag'+(status && status.cls ? ' '+status.cls : '')});
  function paint(){
    const y = window.scrollY;
    clear(body); appendKids(body, build(paint));
    const st = typeof status==='function' ? status() : status;
    statusEl.hidden = !st; if(st){ statusEl.textContent = st.text; statusEl.className = 'tag '+(st.cls||''); }
    const nav = document.querySelector('.side-nav a[href="#'+id+'"] .st'); if(nav) nav.textContent = st ? st.text : '';
    if(Math.abs(window.scrollY-y)>2) window.scrollTo(0, y);
  }
  sec.appendChild(el('div', {class:'card-head'}, [el('h2', null, title), statusEl]));
  if(hint) sec.appendChild(el('div', {class:'hint', style:{padding:'4px 20px 0'}}, hint));
  sec.appendChild(body);
  paint();
  sec.paint = paint;
  return sec;
}
const onOff = v=>({text: v ? t('on') : t('off'), cls: v ? 'ok' : ''});

function personDefaultSpreadLv(){
  return personLvOf(activePeople()[0]).spread;
}

function personDefaultLv(){
  const p = activePeople()[0];
  return personLvOf(p).rest;
}

function dayLvChip(wd, field, rule, paint, extra){
  const e = (S().days[wd] || {})[field];
  if(!e) return null;
  return LevelChip(e.lv, rule, v=>{ S().days[wd][field].lv = v; commit('settings'); if(paint) paint(); }, extra ? {extra:()=>extra(e)} : {});
}

function howManyExtra(wd, field, paint){
  return e=>Seg([{value:'all', label:t('lvHowAll')}, {value:'one', label:t('lvHowOne')}], e.howMany, v=>{ S().days[wd][field].howMany = v; commit('settings'); paint(); }, {cls:'sm'});
}

function renderRules(root){
  const set = S();
  const sections = [
    ['rule-goals', t('goalsTitle'), ICON.target],
    ['rule-fixed', t('sFixed'), ICON.flag],
    ['rule-calendar', t('rCalendar'), ICON.cal],
    ['rule-volume', t('rVolume'), ICON.building],
    ['rule-rest', t('rRest'), ICON.cal],
    ['rule-days', t('rDays'), ICON.grid],
    ['rule-gender', t('rGender'), ICON.users],
    ['rule-seniority', t('rSeniority'), ICON.chart],
    ['rule-pairs', t('rPairs'), ICON.swap],
    ['rule-fairness', t('rFairness'), ICON.rules],
    ['rule-distance', t('rDistance'), ICON.pin]
  ];
  const nav = el('nav', {class:'side-nav', 'aria-label':t('rTitle')});
  for(const [id, label, ic] of sections){
    nav.appendChild(el('a', {href:'#'+id, onclick:e=>{ e.preventDefault(); const tg = document.getElementById(id); if(tg){ window.scrollTo({top: tg.getBoundingClientRect().top + window.scrollY - (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h'))||60) - (window.innerWidth<=980?56:14), behavior:'smooth'}); markNav(id); navLock = Date.now()+700; } }}, [el('span', {html:ic, style:{display:'flex'}}), el('span', null, label), el('span', {class:'st'})]));
  }
  let navLock = 0;
  function markNav(id){ nav.querySelectorAll('a').forEach(a=>a.classList.toggle('active', a.getAttribute('href')==='#'+id)); const a = nav.querySelector('a.active'); if(a && nav.scrollWidth>nav.clientWidth){ const nb = nav.getBoundingClientRect(), ab = a.getBoundingClientRect(); const delta = (ab.left + ab.width/2) - (nb.left + nb.width/2); if(Math.abs(delta)>8) nav.scrollBy({left:delta, behavior:'smooth'}); } }
  const main = el('div', {class:'stack'});
  const layout = el('div', {class:'layout-side'}, [nav, main]);
  root.appendChild(layout);

  const gl = (id, opts)=>LevelChip(lvOf(id), id, v=>{ if(!set.lv) set.lv = {}; set.lv[id] = v; commit('settings'); if(opts && opts.repaint) opts.repaint(); }, opts);
  main.appendChild(ruleSection('rule-goals', t('goalsTitle'), t('goalsHint'), ()=>{ const n = set.goals.filter(g=>g.on).length; return n ? {text:String(n), cls:'ok'} : {text:t('off')}; }, paint=>[GoalsManager({onChange:()=>{}})]));
  main.appendChild(ruleSection('rule-fixed', t('sFixed'), t('fixedHint'), ()=>{ const n = set.overrides.filter(o=>o.on!==false && o.facilityId).length; return n ? {text:String(n), cls:'ok'} : null; }, ()=>[overridesEditor(()=>renderTab())]));

  main.appendChild(ruleSection('rule-calendar', t('rCalendar'), t('rCalendarHint'), ()=>({text:set.calendar.workdays.length+'/7'}), ()=>[
    setting(t('sWorkdays'), null, DaySet(set.calendar.workdays, v=>{ set.calendar.workdays = v; commit('settings'); })),
    setting(t('holidays'), null, null, {full:MultiDates(set.calendar.holidays, v=>{ set.calendar.holidays = v; commit('settings'); }, {isWork:iso=>isWorkday(ordOf(iso))})}),
    setting(t('extraDays'), null, null, {full:MultiDates(set.calendar.extra, v=>{ set.calendar.extra = v; commit('settings'); })})
  ]));

  main.appendChild(ruleSection('rule-volume', t('rVolume'), null, ()=>({text:t({fill:'vFill', exact:'vExact', quota:'vQuota'}[set.volume.mode])}), paint=>{
    const V = set.volume, sp = set.spacing;
    return [
      setting(t('sVisits'), null, Seg([{value:'fill',label:t('vFill')},{value:'exact',label:t('vExact')},{value:'quota',label:t('vQuota')}], V.mode, v=>{ V.mode = v; commit('settings'); paint(); })),
      V.mode==='fill' ? setting(t('vShare'), null, gl('vol.share'), {full:Slider(Math.round(V.share*100), v=>{ V.share = v/100; commit('settings'); }, {min:0, max:100, step:5, format:v=>v+'%'})}) : null,
      V.mode==='exact' ? setting(t('vExact'), null, [el('span', {class:'muted', style:{fontSize:'12px'}}, t('kBasic')), Stepper(V.exact.basic, v=>{ V.exact.basic = v; commit('settings'); }, {min:0, max:500, sm:true}), el('span', {class:'muted', style:{fontSize:'12px'}}, t('kContracted')), Stepper(V.exact.contracted, v=>{ V.exact.contracted = v; commit('settings'); }, {min:0, max:500, sm:true}), gl('vol.exact')]) : null,
      V.mode==='quota' ? setting(t('vQuota'), null, gl('vol.quota'), {full:(()=>{ const g = el('div', {style:{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'6px'}}); const pool = schedulableFacilities(); for(const c of App.data.categories.filter(c=>c.kind!=='excluded')){ const n = pool.filter(f=>f.category===c.name).length; if(!n) continue; g.appendChild(el('div', {class:'row', style:{padding:'4px 8px', border:'1px solid var(--line)', borderRadius:'9px'}}, [el('span', {class:'dot '+c.kind}), el('span', {style:{flex:'1', fontSize:'12.5px'}}, c.name), el('span', {class:'muted num', style:{fontSize:'11px'}}, '/'+n), Stepper(V.quotas[c.name]||0, v=>{ if(v) V.quotas[c.name] = v; else delete V.quotas[c.name]; commit('settings'); }, {min:0, max:n, sm:true})])); } return g; })()}) : null,
      setting(t('vPerDay'), null, [Stepper(V.perDay||1, v=>{ V.perDay = v; commit('settings'); }, {min:1, max:10}), AlwaysTag('rs_perDay')]),
      setting(t('vPerWeek'), null, [Stepper(V.perWeek, v=>{ V.perWeek = v; commit('settings'); }, {min:1, max:60, nullable:true, placeholder:t('noLimit')}), gl('vol.week')]),
      setting(t('rSpacing'), null, [Seg([{value:'even',label:t('spEven')},{value:'pack',label:t('spPack')},{value:'gap',label:t('spGap')}], sp.mode, v=>{ sp.mode = v; commit('settings'); paint(); }), sp.mode==='gap' ? null : gl('space.shape')]),
      sp.mode==='gap' ? setting(t('spGapDays'), null, Stepper(sp.gap||2, v=>{ sp.gap = v; commit('settings'); }, {min:2, max:14})) : null,
      sp.mode==='gap' ? setting(t('spStrict'), t('spStrictHint'), gl('vol.gap')) : null,
      setting(t('requireEvery'), t('requireEveryHint'), [Switch(!!V.requireEveryEligibleDay, v=>{ V.requireEveryEligibleDay = v; commit('settings'); }), gl('vol.everyDay')]),
      setting(t('rn_due.priority'), t('rn_dueNote'), gl('due.priority')),
      setting(t('rn_structural'), null, null, {full:el('div', {class:'always-list'}, STRUCTURAL_RULES.map(x=>el('span', {class:'chip always-item'}, [AlwaysTag(x.name), t(x.name)])))})
    ];
  }));

  main.appendChild(ruleSection('rule-rest', t('rRest'), t('rRestHint'), ()=>{ const P = set.patterns; const n = [P.activity.on, P.person.on].filter(Boolean).length; return n ? {text:String(n), cls:'ok'} : {text:t('off')}; }, paint=>{
    const P = set.patterns;
    const block = (key, titleKey, hintKey)=>{
      const c = P[key];
      const box = el('div', {class:'rule-card'+(c.on ? '' : ' off')}, [
        el('div', {class:'rc-head'}, [Switch(c.on, v=>{ c.on = v; commit('settings'); paint(); }), el('div', {class:'gl-main'}, [el('b', null, t(titleKey)), el('span', null, t(hintKey))]), el('div', {class:'spacer'}),
          key==='activity' ? gl('vol.activity') : LevelChip(personDefaultLv(), 'p.rest', v=>{ for(const p of App.data.people) p.lv = Object.assign(personLvOf(p), {rest:v}); commit('settings'); })])
      ]);
      if(c.on) box.appendChild(PatternEditor(c.pattern, ()=>commit('settings')));
      return box;
    };
    return [block('activity', 'rrActivity', 'rrActivityHint'), block('person', 'rrPerson', 'rrPersonHint')];
  }));

  main.appendChild(ruleSection('rule-days', t('rDays'), t('rDaysHint'), ()=>{ const n = Object.values(set.days).filter(c=>!dayConfigIsEmpty(normalizeDay(c))).length; return n ? {text:String(n), cls:'ok'} : null; }, paint=>{
    const cats = App.data.categories.filter(c=>c.kind!=='excluded');
    const tbl = el('table', {class:'day-table'});
    tbl.appendChild(el('thead', null, el('tr', null, [el('th', null, ''), el('th', null, t('dCap')), el('th', null, t('dMin')), el('th', null, t('dLean')), el('th', null, t('dDist')), el('th', null, t('dFavor')), el('th', null, t('dOnly')), el('th', null, '')])));
    const tb = el('tbody');
    const pd = set.volume.perDay||1;
    for(const d of [6,0,1,2,3,4,5]){
      const on = set.calendar.workdays.includes(d);
      const c = dayView(set.days[d]);
      const upd = (patch, quiet)=>{ patchDay(d, patch); commit('settings'); if(!quiet) paint(); };
      if(!on){ tb.appendChild(el('tr', {class:'off'}, [el('td', {class:'dn'}, wdName(d)), el('td', {colspan:'7'}, t('dOffDay'))])); continue; }
      const onlyBtn = el('button', {type:'button', class:'chip'+(c.only&&c.only.length?' on':'')}, c.only && c.only.length ? String(c.only.length) : t('all'));
      onlyBtn.addEventListener('click', ()=>popover(onlyBtn, ()=>[el('div', {class:'pop-title'}, wdName(d)+' · '+t('dOnly')), ChipToggles(cats.map(x=>({value:x.name, label:x.name})), c.only||[], v=>upd({only:v}, true))], {width:340, onClose:()=>paint()}));
      const favBtn = el('button', {type:'button', class:'chip'+(c.favorIds.length?' on':'')}, c.favorIds.length ? String(c.favorIds.length) : t('all'));
      favBtn.addEventListener('click', ()=>popover(favBtn, ()=>[el('div', {class:'pop-title'}, wdName(d)+' · '+t('dFavor')), ChipToggles(cats.map(x=>({value:x.name, label:x.name})), c.favorIds, v=>upd({favor:v}, true))], {width:340, onClose:()=>paint()}));
      tb.appendChild(el('tr', null, [
        el('td', {class:'dn'}, wdName(d)),
        el('td', null, [Stepper(c.cap!=null?c.cap:null, v=>upd({cap:v}), {min:0, max:pd, nullable:true, sm:true, placeholder:String(pd)}), dayLvChip(d, 'cap', 'day.cap', paint)]),
        el('td', null, [Stepper(c.min||null, v=>upd({min:v}), {min:1, max:pd, nullable:true, sm:true, placeholder:'—'}), dayLvChip(d, 'min', 'day.min', paint)]),
        el('td', null, [Select([{value:'',label:'—'},{value:'basic',label:t('kBasic')},{value:'contracted',label:t('kContracted')}], c.lean||'', v=>upd({lean:v||null}), {sm:true}), dayLvChip(d, 'kind', 'day.kind', paint, howManyExtra(d, 'kind', paint))]),
        el('td', null, [Select([{value:'',label:'—'},{value:'near',label:t('bandNear')},{value:'far',label:t('bandFar')}], c.dist||'', v=>upd({dist:v||null}), {sm:true}), dayLvChip(d, 'band', 'day.band', paint, howManyExtra(d, 'band', paint))]),
        el('td', null, [favBtn, dayLvChip(d, 'category', 'day.category', paint, howManyExtra(d, 'category', paint))]),
        el('td', null, [onlyBtn, dayLvChip(d, 'only', 'day.only', paint)]),
        el('td', null, set.days[d] ? el('button', {type:'button', class:'icon-btn sm', html:ICON.x, title:t('reset'), onclick:()=>{ delete set.days[d]; commit('settings'); paint(); }}) : null)
      ]));
    }
    tbl.appendChild(tb);
    return el('div', {style:{overflowX:'auto', paddingBottom:'8px'}}, tbl);
  }));

  main.appendChild(ruleSection('rule-gender', t('rGender'), t('rGenderHint'), ()=>{ const n = set.genderRules.filter(r=>r.on).length; return {text:n ? n+' '+t('on') : t('off'), cls:n?'ok':''}; }, paint=>{
    const list = el('div', {class:'rules-list'});
    const cats = App.data.categories.filter(c=>c.kind!=='excluded');
    set.genderRules.forEach((r, i)=>{
      const card = el('div', {class:'rule-card'+(r.on?'':' off')});
      const upd = ()=>{ commit('settings'); paint(); };
      const sizes = [...new Set(schedulableFacilities().filter(f=>(!r.kinds.length || r.kinds.includes(facilityKind(f))) && (!r.categories.length || r.categories.includes(f.category))).map(f=>teamSizeFor(facilityKind(f), f.category)))].sort();
      const examples = sizes.map(n=>{ const min = genderMinCount(r, n); const combos = []; for(let m=0;m<=n;m++){ if(genderValid(r, m, n-m, n)) combos.push(m+'+'+(n-m)); } return t('gPreview', n)+': '+(combos.length ? combos.join(' / ') : '✕'); }).join('   ·   ');
      card.appendChild(el('div', {class:'rc-head'}, [Switch(r.on, v=>{ r.on = v; upd(); }), el('b', null, (r.kinds.length ? r.kinds.map(kindLabel).join(' + ') : t('gAllKinds')) + (r.categories.length ? ' · '+r.categories.join('، ') : '') + (r.facilities.length ? ' · '+r.facilities.length+' '+t('tabFacilities') : '')), el('div', {class:'spacer'}), LevelChip(r.lv, 'gender.rule', v=>{ r.lv = v; commit('settings'); }),
        i>0 ? el('button', {type:'button', class:'icon-btn sm', title:'↑', html:svg('<path d="M12 19V5M5 12l7-7 7 7"/>',14), onclick:()=>{ const a = set.genderRules; [a[i-1], a[i]] = [a[i], a[i-1]]; upd(); }}) : null,
        el('button', {type:'button', class:'icon-btn sm', html:ICON.trash, 'aria-label':t('del'), onclick:()=>{ set.genderRules.splice(i,1); upd(); }})]));
      card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gKinds')), ChipToggles([{value:'basic',label:t('kBasic')},{value:'contracted',label:t('kContracted')}], r.kinds, v=>{ r.kinds = v; upd(); })]));
      const catBtn = el('button', {type:'button', class:'chip'+(r.categories.length?' on':'')}, r.categories.length ? r.categories.length+' '+t('gCats') : t('gAllCats'));
      catBtn.addEventListener('click', ()=>popover(catBtn, ()=>[el('div', {class:'pop-title'}, t('gCats')), ChipToggles(cats.filter(c=>!r.kinds.length || r.kinds.includes(c.kind)).map(c=>({value:c.name, label:c.name})), r.categories, v=>{ r.categories = v; commit('settings'); })], {width:340, onClose:()=>paint()}));
      card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gCats')), catBtn]));
      card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gFacs')), FacilityPicker(r.facilities, ids=>{ r.facilities = ids; upd(); }, {addLabel:r.facilities.length ? t('add') : t('gAllFacs'), filter:f=>schedulableFacilities().includes(f)})]));
      card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gMinEach')), Slider(r.minEach, v=>{ r.minEach = v; upd(); }, {min:0, max:50, step:5, format:v=>v===0?t('off'):v+'%'})]));
      card.appendChild(el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gAvoidEven')), Switch(!!r.avoidEven, v=>{ r.avoidEven = v; upd(); })]));
      if(examples) card.appendChild(el('div', {class:'hint num', style:{fontSize:'12px'}}, examples));
      list.appendChild(card);
    });
    list.appendChild(el('button', {type:'button', class:'btn sm outline', style:{alignSelf:'flex-start'}, onclick:()=>{ set.genderRules.push({id:uid('g'), on:true, kinds:[], categories:[], facilities:[], minEach:25, avoidEven:false, lv:mkLv('prefer', 8)}); commit('settings'); paint(); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('gAdd')]));
    const unknown = activePeople().filter(p=>!p.gender).length;
    if(unknown) list.appendChild(el('div', {class:'banner warn'}, t('dGenderUnknown', unknown)));
    const gpWrap = el('div', {class:'stack', style:{gap:'8px', paddingTop:'6px'}}, [
      el('div', {class:'row'}, [el('b', {style:{fontWeight:'600', fontSize:'13.5px'}}, t('gpTitle'))]),
      el('div', {class:'hint'}, t('gpHint'))
    ]);
    const grid = el('div', {class:'gp-grid'});
    for(const g of ['m','f']){
      const gp = set.genderPrefs[g];
      const n = activePeople().filter(p=>p.gender===g).length;
      const upd = ()=>{ commit('settings'); paint(); };
      const card = el('div', {class:'rule-card'+(gp.on?'':' off')}, [
        el('div', {class:'rc-head'}, [Switch(gp.on, v=>{ gp.on = v; upd(); }), el('b', null, t(g==='m'?'gpMale':'gpFemale')), el('span', {class:'muted num', style:{fontSize:'12px'}}, String(n)), el('div', {class:'spacer'})]),
        el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gpDist')), Seg([{value:'near',label:t('bandNear')},{value:'',label:t('any')},{value:'far',label:t('bandFar')}], gp.dist||'', v=>{ gp.dist = v||null; commit('settings'); }, {cls:'sm'})]),
        el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gpKind')), Seg([{value:'basic',label:t('kBasic')},{value:'',label:t('any')},{value:'contracted',label:t('kContracted')}], gp.kind||'', v=>{ gp.kind = v||null; commit('settings'); }, {cls:'sm'})]),
        el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gpDays')), DaySet(gp.days||[], v=>{ gp.days = v; commit('settings'); }, {sm:true})]),
        el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gpStrength')), gl('gender.pref.'+g)])
      ]);
      grid.appendChild(card);
    }
    gpWrap.appendChild(grid);
    list.appendChild(gpWrap);
    return list;
  }));

  main.appendChild(ruleSection('rule-seniority', t('rSeniority'), t('rSeniorityHint'), ()=>onOff(set.seniority.on), paint=>{
    const sen = set.seniority;
    const affected = schedulableFacilities().filter(f=>(f.importance||0) >= sen.threshold).length;
    return [
      setting(t('rSeniority'), t('senAffects', affected), Switch(sen.on, v=>{ sen.on = v; commit('settings'); paint(); })),
      el('div', {class:'setting'+(sen.on?'':' disabled')}, [el('div', {class:'lbl'}, [el('b', null, t('senThreshold'))]), el('div', {class:'ctl'}), el('div', {class:'full'}, Slider(sen.threshold, v=>{ sen.threshold = v; commit('settings'); paint(); }, {min:0, max:100, step:5, tiers:impTier}))]),
      setting(t('senMode'), null, gl('senior'), {cls:sen.on?'':'disabled'}),
      el('div', {class:'setting'+(sen.on?'':' disabled')}, [el('div', {class:'lbl'}, [el('b', null, t('senMatch'))]), el('div', {class:'ctl'}, gl('skill.match')), el('div', {class:'full'}, Slider(Math.round(sen.match*100), v=>{ sen.match = v/100; commit('settings'); }, {min:0, max:100, step:10, format:v=>v===0?t('off'):v+'%'}))])
    ];
  }));

  main.appendChild(ruleSection('rule-pairs', t('rPairs'), t('rPairsHint'), ()=>{ const n = set.pairs.filter(r=>r.on).length; return n ? {text:String(n), cls:'ok'} : null; }, paint=>{
    const list = el('div', {class:'rules-list'});
    const people = activePeople();
    const opts = people.map(p=>({value:p.id, label:p.name}));
    set.pairs.forEach((r,i)=>{
      const upd = ()=>{ commit('settings'); paint(); };
      list.appendChild(el('div', {class:'rule-card'+(r.on?'':' off')}, [
        el('div', {class:'rc-row'}, [
          Switch(r.on!==false, v=>{ r.on = v; upd(); }),
          Select(opts, r.a, v=>{ r.a = v; upd(); }, {sm:true, width:'130px'}),
          Seg([{value:'together',label:t('prTogether')},{value:'avoid',label:t('prAvoid')}], r.type, v=>{ r.type = v; upd(); }, {cls:'sm'}),
          Select(opts, r.b, v=>{ r.b = v; upd(); }, {sm:true, width:'130px'}),
          el('div', {class:'spacer'}),
          LevelChip(r.lv, 'pair', v=>{ r.lv = v; commit('settings'); }),
          el('button', {type:'button', class:'icon-btn sm', html:ICON.trash, 'aria-label':t('del'), onclick:()=>{ set.pairs.splice(i,1); upd(); }})
        ])
      ]));
    });
    if(people.length>=2) list.appendChild(el('button', {type:'button', class:'btn sm outline', style:{alignSelf:'flex-start'}, onclick:()=>{ set.pairs.push({id:uid('pr'), a:people[0].id, b:people[1].id, type:'avoid', lv:mkLv('prefer', 5), on:true}); commit('settings'); paint(); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('prAdd')]));
    return list;
  }));

  main.appendChild(ruleSection('rule-fairness', t('rFairness'), null, ()=>({text:[set.fairness.carry, set.rotation.on].filter(Boolean).length+'/2'}), paint=>{
    const R = set.rotation, B = set.repeatBlock;
    return [
      setting(t('rn_p.spread'), t('rn_spreadHint'), LevelChip(personDefaultSpreadLv(), 'p.spread', v=>{ for(const p of App.data.people) p.lv = Object.assign(personLvOf(p), {spread:v}); commit('settings'); })),
      setting(t('fairCarry'), t('fairCarryHint'), [Switch(set.fairness.carry, v=>{ set.fairness.carry = v; commit('settings'); paint(); }), gl('fair.load')]),
      setting(t('rotOn'), null, [R.on && lvMust('rotate') ? Stepper(B.times, v=>{ B.times = v; commit('settings'); }, {min:1, max:50, sm:true, unit:t('rbTimes')}) : null, Switch(R.on, v=>{ R.on = v; B.on = v; commit('settings'); paint(); }), R.on ? gl('rotate', {repaint:paint}) : null])
    ];
  }));

  main.appendChild(ruleSection('rule-distance', t('rDistance'), t('rDistanceHint'), ()=>({text:'≤'+set.distance.nearKm+' · ≥'+set.distance.farKm}), paint=>{
    const D = set.distance;
    const bands = {near:0, mid:0, far:0};
    for(const f of schedulableFacilities()) bands[distBand(facilityKm(f))]++;
    const total = Math.max(1, bands.near+bands.mid+bands.far);
    const bar = el('div', {class:'bar', style:{height:'12px', margin:'10px 0 4px'}}, [el('i', {style:{width:(bands.near/total*100)+'%', background:'var(--ok)'}}), el('i', {style:{width:(bands.mid/total*100)+'%', background:'var(--line-2)'}}), el('i', {style:{width:(bands.far/total*100)+'%', background:'var(--warn)'}})]);
    return [
      setting(t('distNearKm'), null, Stepper(D.nearKm, v=>{ D.nearKm = Math.min(v, D.farKm); commit('settings'); paint(); }, {min:0, max:300, step:1, unit:t('km')})),
      setting(t('distFarKm'), null, Stepper(D.farKm, v=>{ D.farKm = Math.max(v, D.nearKm); commit('settings'); paint(); }, {min:0, max:300, step:1, unit:t('km')}), {full:el('div', null, [bar, el('div', {class:'hint'}, t('bandCounts', bands.near, bands.mid, bands.far))])}),
      setting(t('distOrigin'), null, Seg([{value:'hq',label:t('distHq')},{value:'home',label:t('distHome')}], D.origin, v=>{ D.origin = v; commit('settings'); })),
      setting(t('distShort'), null, [Switch(D.shortTrips, v=>{ D.shortTrips = v; commit('settings'); }), gl('dist.short')]),
      setting(t('distBalance'), null, [Switch(!!D.balanceFar, v=>{ D.balanceFar = v; commit('settings'); }), gl('dist.balanceFar')]),
      setting(t('distPick'), null, [Seg([{value:'near',label:t('bandNear')},{value:'',label:t('none')},{value:'far',label:t('bandFar')}], D.pickBias||'', v=>{ D.pickBias = v||null; commit('settings'); }), gl('dist.pick')])
    ];
  }));

  main.appendChild(el('div', {class:'row', style:{justifyContent:'flex-end'}}, el('button', {type:'button', class:'btn ghost sm', onclick:()=>confirmDialog(t('rsSettings'), t('rsSettingsQ'), {danger:true, label:t('reset'), onConfirm:()=>{ const pools = S().pools; App.data.settings = Object.assign(defaultSettings(), {pools}); migrateLv(App.data); commit('settings'); renderTab(); }})}, t('rsSettings'))));

  function spy(){
    if(!layout.isConnected){ window.removeEventListener('scroll', spy); return; }
    if(Date.now()<navLock) return;
    const off = (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar-h'))||60) + 80;
    let cur = sections[0][0];
    for(const [id] of sections){ const n = document.getElementById(id); if(n && n.getBoundingClientRect().top <= off) cur = id; }
    if(window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) cur = sections[sections.length-1][0];
    markNav(cur);
  }
  window.addEventListener('scroll', spy, {passive:true});
  requestAnimationFrame(()=>{ spy(); main.querySelectorAll('.rule-sec').forEach(s=>s.paint && s.paint()); if(App.ui.jump){ const n = document.getElementById(App.ui.jump); App.ui.jump = null; if(n) setTimeout(()=>nav.querySelector('a[href="#'+n.id+'"]').click(), 60); } });
}
