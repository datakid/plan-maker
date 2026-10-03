const PlanView = {};

function presetLabel(p){ return t({week:'pWeek', month:'pMonth', nextMonth:'pNextMonth', quarter:'pQuarter', custom:'pCustom'}[p]||'pCustom'); }
function poolIndex(id){ return Math.max(0, S().pools.findIndex(p=>p.id===id)); }
function personPoolIdx(pid){ const p = personById(pid); return p ? poolIndex(p.pool) : 0; }

function tileSummaries(){
  const P = S().period, C = S().calendar;
  const pv = volumePreview();
  const out = {};
  if(P.goal==='coverage'){
    out.period = {v:t('goalCoverage'), s: pv.reachable ? t('covUntil', fmtDate(isoOf(pv.end),'dm'), pv.workdays) : t('covUnreachable'), warn:!pv.reachable};
  } else if(pv.invalid){
    out.period = {v:presetLabel(P.preset), s:t('errRange'), warn:true};
  } else {
    const label = P.preset==='custom' ? fmtDate(isoOf(pv.start),'dm')+' – '+fmtDate(isoOf(pv.end),'dm') : presetLabel(P.preset);
    out.period = {v:label, s:fmtDate(isoOf(pv.start),'dm')+' – '+fmtDate(isoOf(pv.end),'dm')+' · '+t('workdaysN', pv.workdays)};
  }
  const order = [6,0,1,2,3,4,5].filter(d=>C.workdays.includes(d));
  const extra = [];
  if(C.holidays.length) extra.push(C.holidays.length+' '+t('holidays'));
  if(C.extra.length) extra.push('+'+C.extra.length);
  const tuned = Object.values(S().days).filter(c=>c && Object.values(c).some(x=>x!=null && x!=='' && !(Array.isArray(x) && !x.length))).length;
  if(tuned) extra.push(tuned+' '+t('rDays'));
  out.workdays = {v: order.map(d=>wdName(d,'short')).join(' · ') || '—', s: extra.join(' · ') || order.length+' / 7'};
  out.visits = {v:(pv.total||0)+' '+(App.ui.lang==='ar'?'زيارة':'visits'), s: pv.overCapacity ? t('vOver', pv.total, pv.capacity) : t('vSummary', pv.basic||0, pv.contracted||0), warn:!!pv.overCapacity};
  const act = activePeople();
  out.team = {v:t('teamActive', act.length), s:S().pools.map(pl=>act.filter(p=>p.pool===pl.id).length+' '+poolName(pl)).join(' · ')};
  const gOn = S().goals.filter(g=>g.on);
  const gp = goalsPreview();
  out.goals = {v: gOn.length ? (gOn.length===1 ? goalTitle(gOn[0]) : t('goalsN', gOn.length)) : t('goalsNoneShort'), s: gp ? t('goalsDemand', gp.must, gp.try) : '—'};
  const ov = S().overrides.filter(o=>o.on!==false && o.facilityId);
  const inWin = gp ? overridesIn(gp.win.start, gp.win.end).length : 0;
  const bad = ov.filter(o=>overrideIssues(o).some(x=>x.sev!=='info')).length;
  out.fixed = {v: ov.length ? t('fixedN', ov.length) : t('fixedNone'), s: bad ? t('fixedBad', bad) : (ov.length ? t('fixedInPlan', inWin) : t('fixedTap')), warn:!!bad};
  return out;
}

function buildSetupStrip(){
  const strip = el('section', {class:'setup', id:'setup-strip', 'aria-label':t('tabPlan')});
  const tiles = {};
  const defs = [
    {k:'period', label:'sPeriod', icon:ICON.cal, build:periodPop},
    {k:'workdays', label:'sWorkdays', icon:ICON.grid, build:workdaysPop},
    {k:'visits', label:'sVisits', icon:ICON.building, build:visitsPop},
    {k:'team', label:'sTeam', icon:ICON.users, build:teamPop},
    {k:'goals', label:'sGoals', icon:ICON.target, build:goalsPop},
    {k:'fixed', label:'sFixed', icon:ICON.flag, build:fixedPop}
  ];
  for(const d of defs){
    const v = el('span', {class:'v'}), s = el('span', {class:'s'});
    const tile = el('button', {type:'button', class:'setup-tile', 'aria-haspopup':'dialog'}, [el('span', {class:'k'}, [el('span', {html:d.icon, style:{display:'flex'}}), t(d.label)]), v, s]);
    tile.addEventListener('click', ()=>popover(tile, (close, refresh)=>[el('div', {class:'pop-title'}, t(d.label)), d.build(refresh)], {width:d.k==='visits'||d.k==='team'||d.k==='goals'||d.k==='fixed'?400:380, noRefocus:false}));
    tiles[d.k] = {tile, v, s};
    strip.appendChild(tile);
  }
  const go = el('div', {class:'setup-go'});
  const btn = el('button', {type:'button', class:'gen-btn', id:'generate-btn'}, [el('span', {html:ICON.sparkle, style:{display:'flex'}}), el('span', {class:'gl'}, App.plan ? t('regenerate') : t('generate'))]);
  btn.addEventListener('click', ()=>runGenerate(btn));
  go.appendChild(btn);
  strip.appendChild(go);
  strip.update = function(){
    const sm = tileSummaries();
    for(const k in tiles){ tiles[k].v.textContent = sm[k].v; tiles[k].s.textContent = sm[k].s; tiles[k].s.classList.toggle('warn', !!sm[k].warn); }
    btn.querySelector('.gl').textContent = App.plan ? t('regenerate') : t('generate');
    go.hidden = !App.plan;
  };
  strip.update();
  PlanView.strip = strip;
  return strip;
}
function settingsChanged(refresh){
  commit('settings');
  if(PlanView.strip && PlanView.strip.isConnected) PlanView.strip.update();
  if(refresh) refresh();
  if(activePop) activePop.position();
}

function periodPop(refresh){
  const P = S().period;
  const box = el('div', {class:'stack', style:{gap:'12px'}});
  box.appendChild(Seg([{value:'range', label:t('goalRange')},{value:'coverage', label:t('goalCoverage')}], P.goal, v=>{ P.goal = v; settingsChanged(refresh); }, {cls:'block'}));
  if(P.goal==='range'){
    box.appendChild(Seg(['week','month','nextMonth','quarter','custom'].map(p=>({value:p, label:presetLabel(p)})), P.preset, v=>{
      P.preset = v;
      if(v==='custom' && (!P.start || !P.end)){ const w = presetWindow('month'); P.start = isoOf(w.start); P.end = isoOf(w.end); }
      settingsChanged(refresh);
    }));
    if(P.preset==='custom'){
      box.appendChild(el('div', {class:'grid-2'}, [
        el('div', {class:'field'}, [el('label', null, t('from')), DateInput(P.start, v=>{ P.start = v; settingsChanged(); }, {rangeWith:()=>P.end})]),
        el('div', {class:'field'}, [el('label', null, t('to')), DateInput(P.end, v=>{ P.end = v; settingsChanged(); }, {rangeWith:()=>P.start})])
      ]));
    }
  } else {
    const sc = P.scope;
    box.appendChild(el('div', {class:'field'}, [el('label', null, t('scope')), Seg([{value:'all',label:t('scopeAll')},{value:'type',label:t('scopeType')},{value:'category',label:t('scopeCategory')},{value:'location',label:t('scopeLocation')}], sc.kind, v=>{ P.scope = {kind:v, ids:[]}; settingsChanged(refresh); })]));
    if(sc.kind!=='all'){
      let opts;
      if(sc.kind==='type') opts = [{value:'basic', label:t('kBasic')},{value:'contracted', label:t('kContracted')}];
      else if(sc.kind==='category') opts = App.data.categories.filter(c=>c.kind!=='excluded').map(c=>({value:c.name, label:c.name}));
      else { const used = new Set(schedulableFacilities().map(f=>f.locationId)); opts = App.data.locations.filter(l=>used.has(l.id)).map(l=>({value:l.id, label:l.name})); }
      box.appendChild(ChipToggles(opts, sc.ids, ids=>{ P.scope.ids = ids; settingsChanged(); }));
    }
    box.appendChild(el('div', {class:'grid-2'}, [
      el('div', {class:'field'}, [el('label', null, t('times')), Stepper(P.times||1, v=>{ P.times = v; settingsChanged(); }, {min:1, max:6})]),
      el('div', {class:'field'}, [el('label', null, t('startDate')), DateInput(P.start || todayISO(), v=>{ P.start = v; settingsChanged(); })])
    ]));
  }
  const pv = volumePreview();
  box.appendChild(el('div', {class:'hint'}, pv.goal==='coverage' ? (pv.reachable ? t('covUntil', fmtDate(isoOf(pv.end)), pv.workdays) : t('covUnreachable')) : (pv.invalid ? t('errRange') : t('workdaysN', pv.workdays))));
  return box;
}

function workdaysPop(){
  const C = S().calendar;
  return el('div', {class:'stack', style:{gap:'14px'}}, [
    el('div', {class:'field'}, [el('label', null, t('sWorkdays')), DaySet(C.workdays, v=>{ C.workdays = v; settingsChanged(); })]),
    el('div', {class:'field'}, [el('label', null, t('holidays')), MultiDates(C.holidays, v=>{ C.holidays = v; settingsChanged(); }, {isWork:iso=>isWorkday(ordOf(iso))})]),
    el('div', {class:'field'}, [el('label', null, t('extraDays')), MultiDates(C.extra, v=>{ C.extra = v; settingsChanged(); })]),
    el('button', {type:'button', class:'link', style:{alignSelf:'flex-start', fontSize:'12.5px'}, onclick:()=>{ closePop(); goTab('rules', 'rule-days'); }}, t('rDays')+' →')
  ]);
}

function visitsPop(refresh){
  const V = S().volume;
  const box = el('div', {class:'stack', style:{gap:'12px'}});
  if(S().period.goal==='coverage'){
    const pv = volumePreview();
    box.appendChild(el('div', {class:'banner info'}, t('vSummary', pv.basic, pv.contracted)));
  } else {
    box.appendChild(Seg([{value:'fill',label:t('vFill')},{value:'exact',label:t('vExact')},{value:'quota',label:t('vQuota')}], V.mode, v=>{ V.mode = v; settingsChanged(refresh); }, {cls:'block'}));
    const live = el('div', {class:'hint'});
    const paint = ()=>{ const pv = volumePreview(); live.textContent = t('vSummary', pv.basic, pv.contracted)+' · '+t('capLine', pv.capacity); live.style.color = pv.overCapacity ? 'var(--warn)' : ''; };
    if(V.mode==='fill'){
      box.appendChild(el('div', {class:'field'}, [el('label', null, t('vShare')), Slider(Math.round(V.share*100), v=>{ V.share = v/100; settingsChanged(); paint(); }, {min:0, max:100, step:5, format:v=>v+'%'})]));
    } else if(V.mode==='exact'){
      box.appendChild(el('div', {class:'grid-2'}, [
        el('div', {class:'field'}, [el('label', null, t('kBasic')), Stepper(V.exact.basic, v=>{ V.exact.basic = v; settingsChanged(); paint(); }, {min:0, max:500})]),
        el('div', {class:'field'}, [el('label', null, t('kContracted')), Stepper(V.exact.contracted, v=>{ V.exact.contracted = v; settingsChanged(); paint(); }, {min:0, max:500})])
      ]));
    } else {
      const list = el('div', {class:'stack', style:{gap:'4px', maxHeight:'260px', overflow:'auto'}});
      const pool = schedulableFacilities();
      for(const c of App.data.categories.filter(c=>c.kind!=='excluded')){
        const n = pool.filter(f=>f.category===c.name).length;
        if(!n) continue;
        list.appendChild(el('div', {class:'row'}, [el('span', {class:'dot '+c.kind}), el('span', {style:{flex:'1'}}, c.name), el('span', {class:'muted num', style:{fontSize:'11.5px'}}, '/'+n), Stepper(V.quotas[c.name]||0, v=>{ if(v) V.quotas[c.name] = v; else delete V.quotas[c.name]; settingsChanged(); paint(); }, {min:0, max:n, sm:true})]));
      }
      box.appendChild(list);
    }
    box.appendChild(live); paint();
  }
  box.appendChild(el('div', {class:'grid-2', style:{paddingTop:'10px', borderTop:'1px solid var(--line)'}}, [
    el('div', {class:'field'}, [el('label', null, t('vPerDay')), Stepper(V.perDay||1, v=>{ V.perDay = v; settingsChanged(); }, {min:1, max:10})]),
    el('div', {class:'field'}, [el('label', null, t('vPerWeek')), Stepper(V.perWeek, v=>{ V.perWeek = v; settingsChanged(); }, {min:1, max:60, nullable:true, placeholder:t('noLimit')})])
  ]));
  return box;
}

function teamPop(refresh){
  const pv = volumePreview();
  const days = pv.start!=null && pv.end!=null ? listWorkdays(pv.start, pv.end) : [];
  const box = el('div', {class:'stack', style:{gap:'10px', maxHeight:'420px', overflow:'auto'}});
  for(const pl of S().pools){
    const members = teamPeople().filter(p=>p.pool===pl.id);
    box.appendChild(el('div', {class:'section-title', style:{marginBottom:'0'}}, poolName(pl)+' · '+seatsFor(pl,'basic')+'/'+seatsFor(pl,'contracted')));
    for(const p of members){
      const avail = days.filter(o=>personAvailable(p, o)).length;
      box.appendChild(el('div', {class:'row'}, [
        el('span', {class:'avatar'+(p.gender==='f'?' f':''), style:{width:'28px', height:'28px', fontSize:'12px'}}, p.name.slice(0,1)),
        el('div', {style:{flex:'1', minWidth:'0'}}, [el('div', {style:{fontWeight:'500', fontSize:'13px'}}, p.name), el('div', {class:'muted', style:{fontSize:'11.5px'}}, p.active===false ? t('off') : avail+'/'+days.length)]),
        Switch(p.active!==false, v=>{ p.active = v; commit('data'); if(PlanView.strip) PlanView.strip.update(); refresh(); })
      ]));
    }
  }
  box.appendChild(el('button', {type:'button', class:'link', style:{alignSelf:'flex-start', fontSize:'12.5px'}, onclick:()=>{ closePop(); goTab('team'); }}, t('tabTeam')+' →'));
  return box;
}

function runGenerate(btn){
  if(App.plan && App.plan.approved){
    confirmDialog(t('regenerate'), App.ui.lang==='ar' ? 'الخطة الحالية معتمدة. التوليد ينشئ خطة جديدة دون إلغاء الاعتماد السابق.' : 'Current plan is approved. Generating creates a new plan; the previous approval stays recorded.', {onConfirm:()=>doGenerate(btn)});
    return;
  }
  doGenerate(btn);
}
function doGenerate(btn){
  closePop();
  const label = btn ? btn.querySelector('.gl') : null;
  if(btn){ btn.disabled = true; btn.classList.add('busy'); if(label) label.textContent = t('generating'); }
  setTimeout(()=>{
    let res;
    try{ res = generatePlan(); }catch(e){ console.error(e); res = {error:'fail'}; }
    if(btn){ btn.disabled = false; btn.classList.remove('busy'); }
    if(res.error){
      if(label) label.textContent = App.plan ? t('regenerate') : t('generate');
      toast(t({rangeInvalid:'errRange', noWorkdays:'errNoWorkdays', coverageUnreachable:'covUnreachable'}[res.error] || 'errNoWorkdays'));
      return;
    }
    App.plan = res.plan; App.ui.focusPerson = null; App.ui.calMonth = null;
    savePlan();
    PlanView.animate = true;
    emit('plan');
  }, 30);
}

function renderPlan(root){
  const strip = buildSetupStrip();
  root.appendChild(strip);
  const results = el('div', {class:'stack', id:'plan-results'});
  root.appendChild(results);
  PlanView.results = results;
  renderResults();
}
function renderResults(){
  const root = PlanView.results; if(!root) return;
  clear(root);
  const old = document.getElementById('plan-actionbar'); if(old) old.remove();
  const plan = App.plan;
  if(!plan){
    const pv = volumePreview();
    const gp = goalsPreview();
    root.appendChild(el('section', {class:'card hero', id:'plan-empty'}, [
      el('div', {class:'brand-mark', style:{width:'56px', height:'56px', borderRadius:'18px'}, html:WORDMARK}),
      el('button', {type:'button', class:'gen-btn', onclick:e=>runGenerate(e.currentTarget)}, [el('span', {html:ICON.sparkle, style:{display:'flex'}}), el('span', {class:'gl'}, t('generate'))]),
      el('p', null, pv.invalid ? t('errRange') : t('vSummary', pv.basic, pv.contracted)+' · '+t('workdaysN', pv.workdays)),
      gp && (gp.must || gp.try || gp.fixed) ? el('p', null, t('goalsDemand', gp.must, gp.try)+(gp.fixed ? ' · '+t('fixedN', gp.fixed) : '')) : null,
      el('p', null, t('genHint'))
    ]));
    return;
  }
  const A = analyzePlan(plan);
  PlanView.analysis = A;
  if(plan.stale && !plan.approved){
    root.appendChild(el('div', {class:'banner warn', role:'status'}, [el('span', {html:ICON.alert, style:{display:'flex'}}), t('staleMsg'), el('button', {type:'button', class:'btn sm', onclick:()=>doGenerate(document.getElementById('generate-btn'))}, [el('span', {html:ICON.refresh, style:{display:'flex'}}), t('regenerate')])]));
  }
  const card = el('section', {class:'card', id:'plan-card'});
  const vl = (ic, key)=>({label:el('span', {class:'row vlab', style:{gap:'6px'}}, [el('span', {html:ic, style:{display:'flex'}}), el('span', {class:'vt'}, t(key))]), title:t(key)});
  const views = [Object.assign({value:'list'}, vl(ICON.list,'vList')), Object.assign({value:'calendar'}, vl(ICON.cal,'vCalendar')), Object.assign({value:'matrix'}, vl(ICON.grid,'vMatrix')), Object.assign({value:'summary'}, vl(ICON.chart,'vSummaryView'))];
  const head = el('div', {class:'plan-toolbar', style:{padding:'14px 16px', borderBottom:'1px solid var(--line)'}}, [
    el('div', {style:{minWidth:'0'}}, [el('h2', null, t('cycle', plan.cycle)), el('div', {class:'range'}, fmtDate(plan.start,'dm')+' – '+fmtDate(plan.end)+' · '+t('workdaysN', plan.days.length))]),
    el('div', {class:'spacer'}),
    App.ui.focusPerson ? el('button', {type:'button', class:'chip on', onclick:()=>{ App.ui.focusPerson = null; renderResults(); }}, [t('focusing', (personById(App.ui.focusPerson)||{}).name||''), el('span', {class:'x', html:ICON.x})]) : null,
    Seg(views, App.ui.view, v=>{ App.ui.view = v; localStorage.setItem('alkhitta.view', v); renderResults(); })
  ]);
  card.appendChild(head);
  const body = el('div');
  if(!plan.visits.length) body.appendChild(el('div', {class:'empty'}, t('emptyPlan')));
  else if(App.ui.view==='calendar') body.appendChild(viewCalendar(plan, A));
  else if(App.ui.view==='matrix') body.appendChild(viewMatrix(plan, A));
  else if(App.ui.view==='summary') body.appendChild(viewSummary(plan, A));
  else body.appendChild(viewList(plan, A));
  card.appendChild(body);
  root.appendChild(card);
  root.appendChild(buildActionBar(plan, A));
  PlanView.animate = false;
}

function issueVisitIds(A){ const s = new Set(); for(const d of A.diags) if(d.visit && d.sev!=='info') s.add(d.visit); return s; }
function personPill(id, extra){
  const p = personById(id);
  const cls = 'person p'+personPoolIdx(id)+(p && p.gender==='f' ? ' g-f' : '')+(App.ui.focusPerson===id ? ' hl' : '');
  const toggle = e=>{ e.stopPropagation(); e.preventDefault(); App.ui.focusPerson = App.ui.focusPerson===id ? null : id; renderResults(); };
  return el('span', {class:cls, role:'button', tabindex:'0', title:p?poolName(poolById(p.pool)):'', onclick:toggle, onkeydown:e=>{ if(e.key==='Enter'||e.key===' ') toggle(e); }}, p ? p.name : '?');
}
function teamPills(v){
  const out = [];
  for(const pl of S().pools){ for(const id of (v.team[pl.id]||[])) out.push(personPill(id)); }
  const open = sum(Object.values(v.open||{}));
  if(open) out.push(el('span', {class:'person open'}, t('openSeat')+(open>1?' ×'+open:'')));
  return out;
}

function viewList(plan, A){
  const wrap = el('div', {class:'list-wrap'+(PlanView.animate?' anim':'')});
  wrap.appendChild(el('div', {class:'list-head'}, [el('span', null, t('colDate')), el('span', null, t('colFacility')), el('span', null, t('colCategory')), el('span', {style:{textAlign:'end'}}, t('colTeam'))]));
  const issues = issueVisitIds(A);
  let month = null;
  const byDate = groupBy(plan.visits, v=>v.date);
  const dates = [...byDate.keys()].sort();
  for(const d of dates){
    const o = ordOf(d), ym = ymdOf(o);
    const mk = ym.y+'-'+ym.m;
    if(mk!==month){ month = mk; wrap.appendChild(el('h3', {class:'month-h'}, monthName(ym.m)+' '+ym.y)); }
    const block = el('div', {class:'day-block'});
    block.appendChild(el('div', {class:'day-label'}, [el('span', {class:'d'}, String(ym.d)), el('span', {class:'w'}, wdName(wdOf(o)))]));
    const col = el('div', {class:'day-visits'});
    for(const v of byDate.get(d)){
      const f = facilityById(v.facilityId) || {name:'—', category:''};
      const km = facilityKm(f), band = distBand(km);
      const dim = App.ui.focusPerson && !visitTeamIds(v).includes(App.ui.focusPerson);
      col.appendChild(el('button', {type:'button', class:'visit '+v.kind+(issues.has(v.id)?' has-issue':'')+(dim?' dim':''), 'data-v':v.id, onclick:()=>openVisit(v.id)}, [
        el('span', {class:'fac'}, [el('b', null, [v.fixed ? el('span', {class:'fx-flag', html:ICON.flag, title:t('fixedTag')}) : null, f.name]), el('span', null, [km!=null ? el('span', {class:'num'}, km+' '+t('km')) : null, f.pinned ? el('span', {html:ICON.pin}) : null, v.fixed ? el('span', null, '· '+t('fixedTag')) : null, v.moved ? el('span', null, '· '+t('moved')) : null, v.late ? el('span', {style:{color:'var(--warn)'}}, '· '+t('lateTag')) : null])]),
        el('span', {class:'cat tag '+v.kind}, f.category || kindLabel(v.kind)),
        el('span', {class:'team'}, teamPills(v))
      ]));
    }
    block.appendChild(col);
    wrap.appendChild(block);
  }
  return wrap;
}

function viewCalendar(plan, A){
  const wrap = el('div', {class:'cal'});
  const start = ordOf(plan.start), end = ordOf(plan.end);
  const months = [];
  { let {y,m} = ymdOf(start); const e = ymdOf(end); while(y<e.y || (y===e.y && m<=e.m)){ months.push({y,m}); m++; if(m>11){ m=0; y++; } } }
  if(App.ui.calMonth==null || App.ui.calMonth>=months.length) App.ui.calMonth = 0;
  const cur = months[App.ui.calMonth];
  const rtl = document.documentElement.dir==='rtl';
  wrap.appendChild(el('div', {class:'cal-nav'}, [
    el('button', {type:'button', class:'icon-btn', 'aria-label':'prev', disabled:App.ui.calMonth===0, html:rtl?ICON.right:ICON.left, onclick:()=>{ App.ui.calMonth--; renderResults(); }}),
    el('h3', null, monthName(cur.m)+' '+cur.y),
    el('button', {type:'button', class:'icon-btn', 'aria-label':'next', disabled:App.ui.calMonth>=months.length-1, html:rtl?ICON.left:ICON.right, onclick:()=>{ App.ui.calMonth++; renderResults(); }}),
    el('div', {class:'spacer'}),
    el('div', {class:'legend', style:{padding:'0'}}, [el('span', null, [el('i', {style:{background:'var(--basic-soft)', borderInlineStart:'3px solid var(--basic)'}}), t('legendBasic')]), el('span', null, [el('i', {style:{background:'var(--contracted-soft)', borderInlineStart:'3px solid var(--contracted)'}}), t('legendContracted')])])
  ]));
  const grid = el('div', {class:'cal-grid'});
  const order = [6,0,1,2,3,4,5];
  for(const d of order) grid.appendChild(el('div', {class:'cal-wd'}, wdName(d,'short')));
  const first = monthStartOrd(cur.y, cur.m);
  const lead = (wdOf(first)-6+7)%7;
  const dim = daysInMonth(cur.y, cur.m);
  const total = Math.ceil((lead+dim)/7)*7;
  const byDate = groupBy(plan.visits, v=>v.date);
  const planDays = new Set(plan.days);
  const issues = issueVisitIds(A);
  const tOrd = todayOrd();
  const editable = !plan.approved;
  for(let i=0;i<total;i++){
    const o = first - lead + i;
    const iso = isoOf(o);
    const inMonth = i>=lead && i<lead+dim;
    const inPlan = planDays.has(iso);
    const cell = el('div', {class:'cal-cell'+(!inMonth?' out':'')+(inMonth && !inPlan ? ' off':'')+(o===tOrd?' today':'')});
    cell.appendChild(el('span', {class:'cal-d'}, String(ymdOf(o).d)));
    for(const v of (byDate.get(iso)||[])){
      const f = facilityById(v.facilityId) || {name:'—'};
      const dimmed = App.ui.focusPerson && !visitTeamIds(v).includes(App.ui.focusPerson);
      const ev = el('button', {type:'button', class:'cal-ev '+v.kind+(issues.has(v.id)?' has-issue':'')+(dimmed?' dim':'')+(v.fixed?' fixed':''), draggable: editable && !v.fixed ? 'true' : null, title:f.name, onclick:()=>openVisit(v.id)}, [
        el('b', null, [v.fixed ? el('span', {class:'fx-flag', html:ICON.flag}) : null, f.name]), el('span', null, visitTeamIds(v).map(id=>(personById(id)||{}).name).join('، '))
      ]);
      if(editable && !v.fixed) ev.addEventListener('dragstart', e=>{ e.dataTransfer.setData('text/plain', v.id); e.dataTransfer.effectAllowed = 'move'; });
      cell.appendChild(ev);
    }
    if(inMonth && editable) cell.appendChild(el('button', {type:'button', class:'cal-add', title:t('fixedAddOn', fmtDate(iso,'wdm')), 'aria-label':t('fixedAddOn', fmtDate(iso,'wdm')), html:ICON.plus, onclick:()=>addOverride({date:iso})}));
    if(inPlan && editable){
      cell.addEventListener('dragover', e=>{ e.preventDefault(); cell.classList.add('drop'); });
      cell.addEventListener('dragleave', ()=>cell.classList.remove('drop'));
      cell.addEventListener('drop', e=>{ e.preventDefault(); cell.classList.remove('drop'); const id = e.dataTransfer.getData('text/plain'); moveVisit(id, iso); });
    }
    grid.appendChild(cell);
  }
  wrap.appendChild(grid);
  return wrap;
}

function viewMatrix(plan, A){
  const wrap = el('div');
  const mode = App.ui.matrixMode || 'people';
  wrap.appendChild(el('div', {class:'row', style:{padding:'10px 16px 0'}}, [
    Seg([{value:'people', label:t('tabTeam')},{value:'facilities', label:t('tabFacilities')}], mode, v=>{ App.ui.matrixMode = v; renderResults(); }, {cls:'sm'}),
    el('div', {class:'spacer'}),
    el('div', {class:'legend', style:{padding:'0'}}, [
      el('span', null, [el('i', {style:{background:'var(--basic-soft)'}}), t('legendBasic')]),
      el('span', null, [el('i', {style:{background:'var(--contracted-soft)'}}), t('legendContracted')]),
      mode==='people' ? el('span', null, [el('i', {style:{background:'repeating-linear-gradient(135deg, transparent, transparent 3px, var(--line-2) 3px, var(--line-2) 4px)', border:'1px solid var(--line)'}}), t('legendOff')]) : null
    ])
  ]));
  const scroller = el('div', {class:'matrix-wrap', style:{marginTop:'10px'}});
  const tbl = el('table', {class:'matrix'});
  const days = plan.days;
  const thead = el('thead');
  const hr = el('tr', null, [el('th', {class:'name'}, mode==='people' ? t('pName') : t('colFacility'))]);
  let prevWk = null;
  const wkStart = days.map(d=>{ const k = weekKey(ordOf(d)); const s = k!==prevWk; prevWk = k; return s; });
  days.forEach((d,i)=>{ const o = ordOf(d); hr.appendChild(el('th', {class:wkStart[i]&&i?'wk-start':null}, [el('span', {class:'d'}, String(ymdOf(o).d)), el('span', {class:'w'}, wdName(wdOf(o),'min'))])); });
  hr.appendChild(el('th', {class:'tot'}, 'Σ'));
  thead.appendChild(hr); tbl.appendChild(thead);
  const tb = el('tbody');
  const byDate = groupBy(plan.visits, v=>v.date);
  const letter = k=>App.ui.lang==='ar' ? (k==='basic'?'أ':'م') : (k==='basic'?'B':'C');
  if(mode==='people'){
    for(const {pool, members} of poolsLive()){
      tb.appendChild(el('tr', {class:'pool-row'}, [el('th', {colspan:String(days.length+2)}, poolName(pool))]));
      for(const p of members){
        const tr = el('tr');
        tr.appendChild(el('td', {class:'name'}, el('span', {class:'row', style:{gap:'6px'}}, [el('span', {class:'dot', style:{background: p.gender==='f' ? 'var(--contracted)' : 'var(--basic)'}}), p.name])));
        let tot = 0;
        days.forEach((d,i)=>{
          const vs = (byDate.get(d)||[]).filter(v=>visitTeamIds(v).includes(p.id));
          const td = el('td', {class:wkStart[i]&&i?'wk-start':null});
          if(vs.length){
            tot += vs.length;
            const v = vs[0], f = facilityById(v.facilityId);
            td.appendChild(el('div', {class:'mx '+v.kind+(vs.length>1?' many':'')+(App.ui.focusPerson===p.id?' hl':''), 'data-n':vs.length>1?String(vs.length):null, title:fmtDate(d,'wdm')+' · '+(f?f.name:''), onclick:()=>openVisit(v.id)}, letter(v.kind)));
          } else if(!personAvailable(p, ordOf(d))) td.appendChild(el('div', {class:'mx off', title:t('legendOff')}));
          else td.appendChild(el('div', {class:'mx'}));
          tr.appendChild(td);
        });
        tr.appendChild(el('td', {class:'tot'}, String(tot)));
        tb.appendChild(tr);
      }
    }
  } else {
    const facIds = [...new Set(plan.visits.map(v=>v.facilityId))];
    facIds.sort((a,b)=>{ const fa = plan.visits.find(v=>v.facilityId===a), fb = plan.visits.find(v=>v.facilityId===b); return fa.date<fb.date?-1:1; });
    for(const fid of facIds){
      const f = facilityById(fid) || {name:'—'};
      const tr = el('tr', {class:'fac-row'});
      tr.appendChild(el('td', {class:'name', title:f.name}, f.name.length>22 ? f.name.slice(0,22)+'…' : f.name));
      let tot = 0;
      days.forEach((d,i)=>{
        const vs = (byDate.get(d)||[]).filter(v=>v.facilityId===fid);
        const td = el('td', {class:wkStart[i]&&i?'wk-start':null});
        if(vs.length){ tot += vs.length; td.appendChild(el('div', {class:'mx '+vs[0].kind, title:visitTeamIds(vs[0]).map(id=>(personById(id)||{}).name).join('، '), onclick:()=>openVisit(vs[0].id)}, String(visitTeamIds(vs[0]).length))); }
        else td.appendChild(el('div', {class:'mx'}));
        tr.appendChild(td);
      });
      tr.appendChild(el('td', {class:'tot'}, String(tot)));
      tb.appendChild(tr);
    }
  }
  const fr = el('tr', null, [el('td', {class:'name muted'}, t('matrixTotal'))]);
  days.forEach((d,i)=>fr.appendChild(el('td', {class:(wkStart[i]&&i?'wk-start ':'')+'num muted', style:{fontSize:'11px', padding:'6px 0'}}, String((byDate.get(d)||[]).length || ''))));
  fr.appendChild(el('td', {class:'tot'}, String(plan.visits.length)));
  tb.appendChild(fr);
  tbl.appendChild(tb);
  scroller.appendChild(tbl);
  wrap.appendChild(scroller);
  return wrap;
}

function viewSummary(plan, A){
  const wrap = el('div', {class:'stack', style:{padding:'16px', gap:'18px'}});
  const visitDays = new Set(plan.visits.map(v=>v.date)).size;
  const totalKm = Math.round(sum(Object.values(A.km)));
  const okChecks = A.checks.filter(c=>c.ok).length;
  wrap.appendChild(el('div', {class:'kpis'}, [
    el('div', {class:'kpi'}, [el('div', {class:'n num'}, String(plan.visits.length)), el('div', {class:'l'}, t('kpiVisits')), el('div', {class:'split'}, [el('span', {class:'row', style:{gap:'5px'}}, [el('span', {class:'dot basic'}), String(A.kinds.basic||0)]), el('span', {class:'row', style:{gap:'5px'}}, [el('span', {class:'dot contracted'}), String(A.kinds.contracted||0)])])]),
    el('div', {class:'kpi'}, [el('div', {class:'n num ltr'}, visitDays+' / '+plan.days.length), el('div', {class:'l'}, t('kpiDays'))]),
    el('div', {class:'kpi'}, [el('div', {class:'n num'}, totalKm.toLocaleString('en')), el('div', {class:'l'}, t('kpiKm'))]),
    el('div', {class:'kpi'}, [el('div', {class:'n num ltr'}, okChecks+' / '+A.checks.length), el('div', {class:'l'}, t('checksTitle'))])
  ]));
  const grid = el('div', {class:'grid-2', style:{alignItems:'start'}});
  const loadBox = el('div');
  loadBox.appendChild(el('div', {class:'section-title'}, t('loadTitle')));
  const maxLoad = Math.max(1, ...Object.values(A.loads).map(l=>l.total), ...Object.values(A.expected));
  for(const {pool, members} of poolsLive()){
    loadBox.appendChild(el('div', {class:'muted', style:{fontSize:'12px', margin:'10px 6px 4px'}}, poolName(pool)));
    const bars = el('div', {class:'bars'});
    for(const p of members){
      const L = A.loads[p.id] || {total:0, basic:0, contracted:0};
      const exp = A.expected[p.id]||0;
      const dev = L.total - exp;
      bars.appendChild(el('div', {class:'bar-row', onclick:()=>{ App.ui.focusPerson = p.id; App.ui.view = 'list'; renderResults(); }}, [
        el('span', {class:'nm'}, p.name),
        el('span', {class:'bar'}, [el('i', {class:'b', style:{width:(L.basic/maxLoad*100)+'%'}}), el('i', {class:'c', style:{width:(L.contracted/maxLoad*100)+'%'}}), el('span', {class:'exp', style:{insetInlineStart:(exp/maxLoad*100)+'%'}})]),
        el('span', {class:'v ltr'}, [el('b', null, String(L.total)), ' / '+exp.toFixed(1)+'  ', el('span', {class:dev>=0.5?'dev-pos':(dev<=-0.5?'dev-neg':'')}, (dev>=0?'+':'')+dev.toFixed(1))])
      ]));
    }
    loadBox.appendChild(bars);
  }
  grid.appendChild(loadBox);
  const right = el('div', {class:'stack', style:{gap:'18px'}});
  const gpb = goalsProgressBlock(plan);
  if(gpb) right.appendChild(gpb);
  const checks = el('div');
  checks.appendChild(el('div', {class:'section-title'}, t('checksTitle')));
  for(const c of A.checks){
    checks.appendChild(el('div', {class:'check '+(c.ok ? 'ok' : (c.soft ? 'soft' : 'bad'))}, [el('span', {html:c.ok?ICON.ok:ICON.alert, style:{display:'flex'}}), t(c.key), c.ok ? null : el('span', {class:'n'}, String(c.n))]));
  }
  right.appendChild(checks);
  if(A.diags.length){
    const notes = el('div');
    notes.appendChild(el('div', {class:'section-title'}, t('notesTitle')+' · '+A.diags.length));
    for(const d of A.diags.slice(0, 60)){
      notes.appendChild(el('button', {type:'button', class:'note', onclick:d.visit ? ()=>openVisit(d.visit) : null}, [el('span', {class:'dot '+(d.sev==='error'?'danger':(d.sev==='warn'?'warn':'info'))}), el('span', null, t.apply(null, [d.key].concat(d.args||[])))]));
    }
    right.appendChild(notes);
  }
  if(plan.carryover && plan.carryover.length){
    const co = el('div');
    co.appendChild(el('div', {class:'section-title'}, t('carryTitle')));
    co.appendChild(el('div', {class:'chips'}, plan.carryover.map(id=>facilityById(id)).filter(Boolean).map(f=>el('span', {class:'chip'}, [el('span', {class:'dot '+facilityKind(f)}), f.name]))));
    right.appendChild(co);
  }
  grid.appendChild(right);
  wrap.appendChild(grid);
  return wrap;
}

function buildActionBar(plan, A){
  const bar = el('div', {class:'actionbar', id:'plan-actionbar'});
  const n = plan.visits.length;
  let dot, txt;
  if(plan.approved){ dot = 'ok'; txt = t('statusApproved', n); }
  else if(A.blocking){ dot = 'danger'; txt = t('statusBlocked', n, A.blocking); }
  else if(A.softFails){ dot = 'warn'; txt = t('statusIssues', n, A.softFails); }
  else { dot = 'ok'; txt = t('statusReady', n); }
  const status = el('button', {type:'button', class:'status', title:t('vSummaryView'), onclick:()=>{ App.ui.view = 'summary'; renderResults(); }}, [el('span', {class:'dot '+dot}), el('span', null, txt)]);
  const exportBtn = el('button', {type:'button', class:'btn outline', onclick:e=>openExport(e.currentTarget)}, [el('span', {html:ICON.download, style:{display:'flex'}}), el('span', {class:'txt-long'}, t('exportBtn'))]);
  const printBtn = el('button', {type:'button', class:'btn ghost', 'aria-label':t('print'), title:t('print'), onclick:doPrint, html:ICON.printer});
  let main;
  if(plan.approved) main = el('button', {type:'button', class:'btn ghost', onclick:()=>{ unapprovePlan(); }}, t('unapprove'));
  else main = el('button', {type:'button', class:'btn primary', disabled: !!A.blocking || plan.stale || !n, onclick:()=>{ approvePlan(); toast(t('approved')); }}, [el('span', {html:ICON.check, style:{display:'flex'}}), t('approve')]);
  bar.appendChild(el('div', {class:'actionbar-inner'}, [status, el('span', {style:{width:'10px'}}), printBtn, exportBtn, main]));
  return bar;
}

function openExport(anchor){
  let mode = App.ui.exportMode || 'full';
  popover(anchor, (close, refresh)=>[
    el('div', {class:'pop-title'}, t('expTitle')),
    el('div', {class:'field', style:{marginBottom:'12px'}}, [el('label', null, t('expMode')), Seg([{value:'full',label:t('expFull')},{value:'noTeam',label:t('expNoTeam')},{value:'noFac',label:t('expNoFac')}], mode, v=>{ mode = v; App.ui.exportMode = v; })]),
    el('div', {class:'menu'}, [
      el('button', {type:'button', class:'menu-item', onclick:()=>{ close(); const rows = exportPlanRows(App.plan, mode); downloadBlob(buildXlsx([{name:App.ui.lang==='ar'?'الخطة':'Plan', rows, widths:rows[0].map((_,i)=>i===5?40:18)}, exportMatrixSheet(App.plan)]), (App.ui.lang==='ar'?'الخطة-':'plan-')+App.plan.cycle+'.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); }}, [el('span', {html:ICON.download}), t('expXlsx'), el('span', {class:'meta'}, '.xlsx')]),
      el('button', {type:'button', class:'menu-item', onclick:()=>{ close(); downloadBlob(new TextEncoder().encode(toCSV(exportPlanRows(App.plan, mode))), (App.ui.lang==='ar'?'الخطة-':'plan-')+App.plan.cycle+'.csv', 'text/csv;charset=utf-8'); }}, [el('span', {html:ICON.download}), t('expCsv'), el('span', {class:'meta'}, '.csv')]),
      el('button', {type:'button', class:'menu-item', onclick:()=>{ close(); copyText(exportPlanRows(App.plan, mode).map(r=>r.join('\t')).join('\n')); }}, [el('span', {html:ICON.copy}), t('expCopy'), el('span', {class:'meta'}, 'TSV')])
    ])
  ], {width:340});
}

function doPrint(){
  const plan = App.plan; if(!plan) return;
  const surf = document.getElementById('printSurface');
  clear(surf);
  surf.setAttribute('dir', document.documentElement.dir);
  const rows = exportPlanRows(plan, App.ui.exportMode||'full');
  surf.appendChild(el('h1', null, t('appName')+' · '+t('cycle', plan.cycle)+' · '+fmtDate(plan.start,'dm')+' – '+fmtDate(plan.end)));
  surf.appendChild(el('table', null, [el('thead', null, el('tr', null, rows[0].map(h=>el('th', null, h)))), el('tbody', null, rows.slice(1).map(r=>el('tr', null, r.map((c,i)=>el('td', null, i===4 ? fmtDate(c,'wdm') : c)))))]));
  window.print();
}

function mutatePlan(fn){
  if(!App.plan || App.plan.approved){ toast(t('vdLocked')); return; }
  fn(App.plan);
  let synced = false;
  for(const v of App.plan.visits){
    if(!v.fixed || !v.overrideId) continue;
    const o = overrideById(v.overrideId); if(!o) continue;
    const ids = visitTeamIds(v);
    if(o.date!==v.date || o.facilityId!==v.facilityId || o.people.join()!==ids.join()){ o.date = v.date; o.facilityId = v.facilityId; o.people = ids; o.fill = false; synced = true; }
  }
  if(synced) save();
  savePlan();
  renderResults();
  if(sheet.current) sheet.current.render();
}
function moveVisit(id, iso){
  const v = App.plan && App.plan.visits.find(x=>x.id===id);
  if(!v || v.date===iso) return;
  const target = moveTargets(App.plan, v).find(x=>x.date===iso);
  const doIt = ()=>mutatePlan(p=>{ v.date = iso; v.moved = true; p.visits.sort((a,b)=>a.date<b.date?-1:(a.date>b.date?1:0)); });
  if(target && (target.conflicts || target.full || target.wdBad)){
    const f = facilityById(v.facilityId);
    confirmDialog(t('vdMove'), (f?f.name+' → ':'')+fmtDate(iso,'wdm')+' · '+[target.conflicts?t('conflicts', target.conflicts):null, target.full?t('dayFull'):null, target.wdBad?t('wdNotAllowed'):null].filter(Boolean).join(' · '), {onConfirm:doIt});
  } else doIt();
}

function openVisit(id){
  sheet({
    title:()=>{ const v = App.plan.visits.find(x=>x.id===id); const f = v && facilityById(v.facilityId); return f ? f.name : '—'; },
    sub:()=>{
      const v = App.plan.visits.find(x=>x.id===id); if(!v) return [];
      const f = facilityById(v.facilityId) || {};
      const km = facilityKm(f), band = distBand(km);
      return [el('span', null, fmtDate(v.date,'wdm')), el('span', {class:'tag '+v.kind}, kindLabel(v.kind)), f.category ? el('span', {class:'tag'}, f.category) : null, km!=null ? el('span', {class:'tag '+band}, (locationById(f.locationId)||{}).name+' · '+km+' '+t('km')) : null];
    },
    body:api=>{
      const plan = App.plan;
      const v = plan.visits.find(x=>x.id===id);
      if(!v){ api.close(); return []; }
      const f = facilityById(v.facilityId) || {name:'—', history:[]};
      const locked = plan.approved;
      const out = [];
      const why = el('section', {class:'sheet-sec'});
      why.appendChild(el('div', {class:'section-title'}, t('vdWhy')));
      const gNames = (v.why && v.why.goals || []).map(id=>{ if(id==='pinned') return t('fPinned'); if(id==='period') return t('goalCoverage'); const g = goalById(id); return g ? goalTitle(g) : null; }).filter(Boolean);
      why.appendChild(el('div', {class:'row wrap', style:{gap:'8px'}}, [
        v.fixed ? el('span', {class:'tag warn', html:ICON.flag+' '+t('fixedTag')}) : null,
        ...gNames.map(n=>el('span', {class:'tag ok', html:ICON.target+' '}, n)),
        v.why && v.why.deadline ? el('span', {class:'tag'+(v.late?' warn':'')}, t('vdDeadline', fmtDate(v.why.deadline,'dm'))) : null,
        v.why ? el('span', {class:'tag'}, t('vdOverdue', v.why.overdue)) : null,
        v.why && v.why.rank!=null ? el('span', {class:'tag'}, t('vdRank', v.why.rank, kindLabel(v.kind))) : null,
        el('span', {class:'imp-meter', style:{'--p':(f.importance||0)+'%'}}, [t('fImportance'), el('i'), String(f.importance||0)]),
        f.pinned ? el('span', {class:'tag warn', html:ICON.pin+' '+t('fPinned')}) : null
      ]));
      out.push(why);
      const A = analyzePlan(plan);
      const vd = A.diags.filter(d=>d.visit===v.id);
      if(vd.length){
        out.push(el('section', {class:'sheet-sec'}, vd.map(d=>el('div', {class:'check '+(d.sev==='error'?'bad':'soft')}, [el('span', {html:ICON.alert, style:{display:'flex'}}), t.apply(null, [d.key].concat(d.args||[]))]))));
      }
      const teamSec = el('section', {class:'sheet-sec'});
      teamSec.appendChild(el('div', {class:'section-title'}, t('vdTeam')));
      if(locked) teamSec.appendChild(el('div', {class:'banner info', style:{marginBottom:'8px'}}, [el('span', {html:ICON.lock, style:{display:'flex'}}), t('vdLocked')]));
      for(const pl of S().pools){
        const seats = seatsFor(pl, v.kind, f.category);
        if(!seats) continue;
        teamSec.appendChild(el('div', {class:'muted', style:{fontSize:'12px', margin:'8px 0 4px'}}, poolName(pl)));
        const list = v.team[pl.id] || [];
        for(let i=0;i<seats;i++){
          const pid = list[i];
          const p = pid ? personById(pid) : null;
          const L = pid && A.loads[pid] ? A.loads[pid].total : 0;
          const btn = el('button', {type:'button', class:'btn sm outline', disabled:locked}, [el('span', {html:ICON.swap, style:{display:'flex'}}), p ? t('vdSwap') : t('vdFill')]);
          btn.addEventListener('click', ()=>{
            const cands = candidatesForSeat(plan, v, pl.id, pid);
            menu(btn, cands.map(c=>({label:c.p.name, meta:c.reason ? t({busy:'rBusy', off:'rOff', blocked:'rBlocked'}[c.reason]) : t('loadN', c.load), disabled:!!c.reason, onClick:()=>mutatePlan(()=>{
              v.team[pl.id] = v.team[pl.id] || [];
              if(pid) v.team[pl.id][i] = c.p.id; else { v.team[pl.id].push(c.p.id); if(v.open && v.open[pl.id]){ v.open[pl.id]--; if(!v.open[pl.id]) delete v.open[pl.id]; } }
            })})), {search:cands.length>8, width:280});
          });
          teamSec.appendChild(el('div', {class:'row', style:{padding:'6px 0', borderBottom:'1px dashed var(--line)'}}, [
            p ? el('span', {class:'avatar'+(p.gender==='f'?' f':''), style:{width:'30px', height:'30px', fontSize:'12.5px'}}, p.name.slice(0,1)) : el('span', {class:'avatar', style:{width:'30px', height:'30px', background:'var(--danger-soft)', color:'var(--danger)'}}, '!'),
            el('div', {style:{flex:'1', minWidth:'0'}}, [el('div', {style:{fontWeight:'500'}}, p ? p.name : t('openSeat')), p ? el('div', {class:'muted', style:{fontSize:'11.5px'}}, t('loadN', L)+' · '+t('pSkill')+' '+skillOf(p, v.kind, f.category)) : null]),
            btn
          ]));
        }
      }
      out.push(teamSec);
      if(!locked){
        const act = el('section', {class:'sheet-sec'});
        const moveBtn = el('button', {type:'button', class:'btn outline'}, [el('span', {html:ICON.move, style:{display:'flex'}}), t('vdMove')]);
        moveBtn.addEventListener('click', ()=>menu(moveBtn, moveTargets(plan, v).map(x=>({label:fmtDate(x.date,'wdm'), meta:[x.count+' ×', x.conflicts?t('conflicts',x.conflicts):null, x.full?t('dayFull'):null, x.wdBad?t('wdNotAllowed'):null].filter(Boolean).join(' · '), onClick:()=>moveVisit(v.id, x.date)})), {width:300}));
        const repBtn = el('button', {type:'button', class:'btn outline'}, [el('span', {html:ICON.building, style:{display:'flex'}}), t('vdReplace')]);
        repBtn.addEventListener('click', ()=>menu(repBtn, replacementFacilities(plan, v).map(x=>({label:x.f.name, meta:x.f.category+' · '+t('vdOverdue', x.overdue), onClick:()=>mutatePlan(()=>{ v.facilityId = x.f.id; v.why = {overdue:x.overdue, score:Math.round(x.score), rank:'—'}; })})), {search:true, width:340}));
        const delBtn = el('button', {type:'button', class:'btn ghost', style:{color:'var(--danger)'}, onclick:()=>confirmDialog(t('vdRemove'), f.name, {danger:true, label:t('del'), onConfirm:()=>{ mutatePlan(p=>{ p.visits = p.visits.filter(x=>x.id!==v.id); }); api.close(); }})}, [el('span', {html:ICON.trash, style:{display:'flex'}}), t('vdRemove')]);
        const fixBtn = el('button', {type:'button', class:'btn outline', onclick:()=>{ fixVisitAsOverride(v); api.render(); }}, [el('span', {html:ICON.flag, style:{display:'flex'}}), v.fixed ? t('vdEditFixed') : t('vdFix')]);
        act.appendChild(el('div', {class:'row wrap'}, [fixBtn, moveBtn, repBtn, delBtn]));
        if(v.fixed) act.appendChild(el('div', {class:'hint', style:{marginTop:'8px'}}, t('vdFixedHint')));
        out.push(act);
      }
      const hist = el('section', {class:'sheet-sec'});
      hist.appendChild(el('div', {class:'section-title'}, t('vdHistory')));
      const h = (f.history||[]).slice(0,6);
      if(!h.length) hist.appendChild(el('div', {class:'muted', style:{fontSize:'13px'}}, t('vdNoHistory')));
      for(const x of h) hist.appendChild(el('div', {class:'row', style:{padding:'5px 0', fontSize:'12.5px', borderBottom:'1px dashed var(--line)'}}, [el('span', {class:'num muted', style:{minWidth:'92px'}}, x.date), el('span', null, (x.team||[]).join('، '))]));
      out.push(hist);
      return out;
    },
    foot:api=>[el('button', {type:'button', class:'btn ghost', onclick:()=>{ api.close(); openFacility(App.plan.visits.find(x=>x.id===id).facilityId); }}, t('fTitle')+' →'), el('div', {class:'spacer'}), el('button', {type:'button', class:'btn', onclick:()=>api.close()}, t('done'))]
  });
}
