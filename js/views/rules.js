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

function renderRules(root){
  const set = S();
  const sections = [
    ['rule-calendar', t('rCalendar'), ICON.cal],
    ['rule-volume', t('rVolume'), ICON.building],
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

  main.appendChild(ruleSection('rule-calendar', t('rCalendar'), t('rCalendarHint'), ()=>({text:set.calendar.workdays.length+'/7'}), ()=>[
    setting(t('sWorkdays'), null, DaySet(set.calendar.workdays, v=>{ set.calendar.workdays = v; commit('settings'); })),
    setting(t('holidays'), null, null, {full:MultiDates(set.calendar.holidays, v=>{ set.calendar.holidays = v; commit('settings'); }, {isWork:iso=>isWorkday(ordOf(iso))})}),
    setting(t('extraDays'), null, null, {full:MultiDates(set.calendar.extra, v=>{ set.calendar.extra = v; commit('settings'); })})
  ]));

  main.appendChild(ruleSection('rule-volume', t('rVolume'), null, ()=>({text:t({fill:'vFill', exact:'vExact', quota:'vQuota'}[set.volume.mode])}), paint=>{
    const V = set.volume, sp = set.spacing;
    return [
      setting(t('sVisits'), null, Seg([{value:'fill',label:t('vFill')},{value:'exact',label:t('vExact')},{value:'quota',label:t('vQuota')}], V.mode, v=>{ V.mode = v; commit('settings'); paint(); })),
      V.mode==='fill' ? setting(t('vShare'), null, null, {full:Slider(Math.round(V.share*100), v=>{ V.share = v/100; commit('settings'); }, {min:0, max:100, step:5, format:v=>v+'%'})}) : null,
      V.mode==='exact' ? setting(t('vExact'), null, [el('span', {class:'muted', style:{fontSize:'12px'}}, t('kBasic')), Stepper(V.exact.basic, v=>{ V.exact.basic = v; commit('settings'); }, {min:0, max:500, sm:true}), el('span', {class:'muted', style:{fontSize:'12px'}}, t('kContracted')), Stepper(V.exact.contracted, v=>{ V.exact.contracted = v; commit('settings'); }, {min:0, max:500, sm:true})]) : null,
      V.mode==='quota' ? setting(t('vQuota'), null, null, {full:(()=>{ const g = el('div', {style:{display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:'6px'}}); const pool = schedulableFacilities(); for(const c of App.data.categories.filter(c=>c.kind!=='excluded')){ const n = pool.filter(f=>f.category===c.name).length; if(!n) continue; g.appendChild(el('div', {class:'row', style:{padding:'4px 8px', border:'1px solid var(--line)', borderRadius:'9px'}}, [el('span', {class:'dot '+c.kind}), el('span', {style:{flex:'1', fontSize:'12.5px'}}, c.name), el('span', {class:'muted num', style:{fontSize:'11px'}}, '/'+n), Stepper(V.quotas[c.name]||0, v=>{ if(v) V.quotas[c.name] = v; else delete V.quotas[c.name]; commit('settings'); }, {min:0, max:n, sm:true})])); } return g; })()}) : null,
      setting(t('vPerDay'), null, Stepper(V.perDay||1, v=>{ V.perDay = v; commit('settings'); }, {min:1, max:10})),
      setting(t('vPerWeek'), null, Stepper(V.perWeek, v=>{ V.perWeek = v; commit('settings'); }, {min:1, max:60, nullable:true, placeholder:t('noLimit')})),
      setting(t('rSpacing'), null, Seg([{value:'even',label:t('spEven')},{value:'pack',label:t('spPack')},{value:'gap',label:t('spGap')}], sp.mode, v=>{ sp.mode = v; commit('settings'); paint(); })),
      sp.mode==='gap' ? setting(t('spGapDays'), null, Stepper(sp.gap||2, v=>{ sp.gap = v; commit('settings'); }, {min:2, max:14})) : null
    ];
  }));

  main.appendChild(ruleSection('rule-days', t('rDays'), t('rDaysHint'), ()=>{ const n = Object.values(set.days).filter(c=>c && Object.values(c).some(x=>x!=null && !(Array.isArray(x)&&!x.length))).length; return n ? {text:String(n), cls:'ok'} : null; }, paint=>{
    const cats = App.data.categories.filter(c=>c.kind!=='excluded');
    const tbl = el('table', {class:'day-table'});
    tbl.appendChild(el('thead', null, el('tr', null, [el('th', null, ''), el('th', null, t('dCap')), el('th', null, t('dMin')), el('th', null, t('dLean')), el('th', null, t('dDist')), el('th', null, t('dFavor')), el('th', null, t('dOnly')), el('th', null, '')])));
    const tb = el('tbody');
    const pd = set.volume.perDay||1;
    for(const d of [6,0,1,2,3,4,5]){
      const on = set.calendar.workdays.includes(d);
      const c = set.days[d] || {};
      const upd = (patch, quiet)=>{ const next = Object.assign({}, set.days[d]||{}, patch); for(const k in next) if(next[k]==null || (Array.isArray(next[k]) && !next[k].length)) delete next[k]; if(Object.keys(next).length) set.days[d] = next; else delete set.days[d]; commit('settings'); if(!quiet) paint(); };
      if(!on){ tb.appendChild(el('tr', {class:'off'}, [el('td', {class:'dn'}, wdName(d)), el('td', {colspan:'7'}, t('dOffDay'))])); continue; }
      const onlyBtn = el('button', {type:'button', class:'chip'+(c.only&&c.only.length?' on':'')}, c.only && c.only.length ? String(c.only.length) : t('all'));
      onlyBtn.addEventListener('click', ()=>popover(onlyBtn, ()=>[el('div', {class:'pop-title'}, wdName(d)+' · '+t('dOnly')), ChipToggles(cats.map(x=>({value:x.name, label:x.name})), c.only||[], v=>upd({only:v}, true))], {width:340, onClose:()=>paint()}));
      tb.appendChild(el('tr', null, [
        el('td', {class:'dn'}, wdName(d)),
        el('td', null, Stepper(c.cap!=null?c.cap:null, v=>upd({cap:v}), {min:0, max:pd, nullable:true, sm:true, placeholder:String(pd)})),
        el('td', null, Stepper(c.min||null, v=>upd({min:v}), {min:1, max:pd, nullable:true, sm:true, placeholder:'—'})),
        el('td', null, Select([{value:'',label:'—'},{value:'basic',label:t('kBasic')},{value:'contracted',label:t('kContracted')}], c.lean||'', v=>upd({lean:v||null}), {sm:true})),
        el('td', null, Select([{value:'',label:'—'},{value:'near',label:t('bandNear')},{value:'far',label:t('bandFar')}], c.dist||'', v=>upd({dist:v||null}), {sm:true})),
        el('td', null, Select([{value:'',label:'—'}].concat(cats.map(x=>({value:x.name, label:x.name}))), c.favor||'', v=>upd({favor:v||null}), {sm:true, width:'120px'})),
        el('td', null, onlyBtn),
        el('td', null, Object.keys(c).length ? el('button', {type:'button', class:'icon-btn sm', html:ICON.x, title:t('reset'), onclick:()=>{ delete set.days[d]; commit('settings'); paint(); }}) : null)
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
      card.appendChild(el('div', {class:'rc-head'}, [Switch(r.on, v=>{ r.on = v; upd(); }), el('b', null, (r.kinds.length ? r.kinds.map(kindLabel).join(' + ') : t('gAllKinds')) + (r.categories.length ? ' · '+r.categories.join('، ') : '') + (r.facilities.length ? ' · '+r.facilities.length+' '+t('tabFacilities') : '')), el('div', {class:'spacer'}),
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
    list.appendChild(el('button', {type:'button', class:'btn sm outline', style:{alignSelf:'flex-start'}, onclick:()=>{ set.genderRules.push({id:uid('g'), on:true, kinds:[], categories:[], facilities:[], minEach:25, avoidEven:false}); commit('settings'); paint(); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('gAdd')]));
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
        el('div', {class:'rc-row'}, [el('span', {class:'lab'}, t('gpStrength')), Seg([{value:'light',label:t('prLight')},{value:'medium',label:t('prMedium')},{value:'strong',label:t('prStrong')}], gp.strength||'medium', v=>{ gp.strength = v; commit('settings'); }, {cls:'sm'})])
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
      setting(t('senMode'), null, Seg([{value:'require',label:t('senRequire')},{value:'prefer',label:t('senPrefer')}], sen.mode, v=>{ sen.mode = v; commit('settings'); }), {cls:sen.on?'':'disabled'}),
      el('div', {class:'setting'+(sen.on?'':' disabled')}, [el('div', {class:'lbl'}, [el('b', null, t('senMatch'))]), el('div', {class:'ctl'}), el('div', {class:'full'}, Slider(Math.round(sen.match*100), v=>{ sen.match = v/100; commit('settings'); }, {min:0, max:100, step:10, format:v=>v===0?t('off'):v+'%'}))])
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
          Seg([{value:'flexible',label:t('prFlexible')},{value:'rigid',label:t('prRigid')}], r.mode, v=>{ r.mode = v; upd(); }, {cls:'sm'}),
          r.mode==='flexible' ? Seg([{value:'light',label:t('prLight')},{value:'medium',label:t('prMedium')},{value:'strong',label:t('prStrong')}], r.strength||'medium', v=>{ r.strength = v; upd(); }, {cls:'sm'}) : null,
          el('button', {type:'button', class:'icon-btn sm', html:ICON.trash, 'aria-label':t('del'), onclick:()=>{ set.pairs.splice(i,1); upd(); }})
        ])
      ]));
    });
    if(people.length>=2) list.appendChild(el('button', {type:'button', class:'btn sm outline', style:{alignSelf:'flex-start'}, onclick:()=>{ set.pairs.push({id:uid('pr'), a:people[0].id, b:people[1].id, type:'avoid', mode:'flexible', strength:'medium', on:true}); commit('settings'); paint(); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('prAdd')]));
    return list;
  }));

  main.appendChild(ruleSection('rule-fairness', t('rFairness'), null, ()=>({text:[set.fairness.carry, set.rotation.on, set.repeatBlock.on].filter(Boolean).length+'/3'}), paint=>{
    const R = set.rotation, B = set.repeatBlock;
    return [
      setting(t('fairCarry'), t('fairCarryHint'), Switch(set.fairness.carry, v=>{ set.fairness.carry = v; commit('settings'); paint(); })),
      setting(t('rotOn'), null, Switch(R.on, v=>{ R.on = v; commit('settings'); paint(); }), {full: R.on ? Seg([{value:0.2,label:t('sLight')},{value:0.35,label:t('sNormal')},{value:0.7,label:t('sStrong')}], [0.2,0.35,0.7].reduce((a,b)=>Math.abs(b-R.strength)<Math.abs(a-R.strength)?b:a), v=>{ R.strength = v; commit('settings'); }) : null}),
      setting(t('rbOn'), null, [B.on ? Stepper(B.times, v=>{ B.times = v; commit('settings'); }, {min:1, max:50, sm:true, unit:t('rbTimes')}) : null, Switch(B.on, v=>{ B.on = v; commit('settings'); paint(); })])
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
      setting(t('distShort'), null, Switch(D.shortTrips, v=>{ D.shortTrips = v; commit('settings'); })),
      setting(t('distBalance'), null, Switch(!!D.balanceFar, v=>{ D.balanceFar = v; commit('settings'); })),
      setting(t('distPick'), null, Seg([{value:'near',label:t('bandNear')},{value:'',label:t('none')},{value:'far',label:t('bandFar')}], D.pickBias||'', v=>{ D.pickBias = v||null; commit('settings'); }))
    ];
  }));

  main.appendChild(el('div', {class:'row', style:{justifyContent:'flex-end'}}, el('button', {type:'button', class:'btn ghost sm', onclick:()=>confirmDialog(t('rsSettings'), t('rsSettingsQ'), {danger:true, label:t('reset'), onConfirm:()=>{ const pools = S().pools; App.data.settings = Object.assign(defaultSettings(), {pools}); commit('settings'); renderTab(); }})}, t('rsSettings'))));

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
