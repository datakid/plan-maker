const PT_GROUPS = ['basic', 'skills', 'plan', 'avail', 'rules', 'limits'];
const PT_DEFAULTS = {basic:true, skills:true, plan:true, avail:true, rules:true, limits:false};

function ptPersonGoals(p){
  return S().goals.filter(g=>g.on && ((g.type==='person' && g.people.includes(p.id)) || (g.type==='together' && (g.a===p.id || g.b===p.id)) || ((g.type==='special' || g.type==='pattern') && g.people.includes(p.id))));
}

function ptChip(text, build, opts){
  opts = opts || {};
  const b = el('button', {type:'button', class:'chip pt-chip'+(opts.on ? ' on' : '')+(opts.cls ? ' '+opts.cls : ''), 'aria-haspopup':'dialog'}, text);
  b.addEventListener('click', e=>{
    e.stopPropagation();
    const row = b.closest('tr[data-pid]');
    const cell = b.closest('td');
    const index = row && cell ? [...row.cells].indexOf(cell) : -1;
    const wasFocused = document.activeElement===b;
    popover(b, (close, refresh)=>build(close, refresh), {width:opts.width || 380, onClose:()=>{
      if(opts.onClose) opts.onClose();
      if(wasFocused && row && !b.isConnected){
        const next = [...document.querySelectorAll('tr[data-pid]')].find(r=>r.dataset.pid===row.dataset.pid);
        const chip = next && next.cells[index] && next.cells[index].querySelector('button.pt-chip');
        if(chip) chip.focus({preventScroll:true});
      }
    }});
  });
  return b;
}

function ptQuotaEditor(p, save, rerender){
  const q = p.quota;
  const qMode = q.min==null && q.max==null ? 'auto' : (q.min!=null && q.min===q.max ? 'exact' : 'range');
  const out = [
    el('div', {class:'pop-title'}, t('pPerPlan')),
    el('div', {class:'row', style:{gap:'8px'}}, [Seg([{value:'auto', label:t('pQAuto')}, {value:'exact', label:t('pQExact')}, {value:'range', label:t('pQRange')}], qMode, v=>{
      const cur = Math.round(analyzeLoadGuess(p));
      if(v==='auto') p.quota = {min:null, max:null};
      else if(v==='exact') p.quota = {min:q.min!=null ? q.min : cur, max:q.min!=null ? q.min : cur};
      else p.quota = {min:q.min, max:q.max!=null ? q.max : cur+2};
      save(); rerender();
    }, {cls:'sm'}), pChip(p, 'quota', 'p.quota', save)])
  ];
  if(qMode==='exact') out.push(Stepper(q.min, v=>{ p.quota = {min:v, max:v}; save(); }, {min:0, max:99, sm:true, unit:t('gPerPlan')}));
  if(qMode==='range') out.push(el('div', {class:'grid-2'}, [
    el('div', {class:'field'}, [el('label', null, t('pQMin')), Stepper(q.min, v=>{ p.quota = normalizeQuota({min:v, max:p.quota.max}); save(); }, {min:0, max:99, nullable:true, sm:true, placeholder:t('noLimit')})]),
    el('div', {class:'field'}, [el('label', null, t('pQMax')), Stepper(q.max, v=>{ p.quota = normalizeQuota({min:p.quota.min, max:v}); save(); }, {min:0, max:99, nullable:true, sm:true, placeholder:t('noLimit')})])
  ]));
  return out;
}

function renderTeam(root){
  if(renderTeam.api && renderTeam.api.dispose) renderTeam.api.dispose();
  root.classList.add('page-wide');
  const U = App.ui;
  if(!U.teamSel) U.teamSel = new Set();
  if(!U.teamCols) U.teamCols = Object.assign({}, PT_DEFAULTS);
  if(U.teamSearch==null) U.teamSearch = '';
  if(!U.teamPoolFilter) U.teamPoolFilter = [];
  if(U.teamPanel===undefined) U.teamPanel = null;
  const wide = ()=>U.teamWide!=null ? U.teamWide : window.innerWidth>=980;
  const layout = el('div', {class:'pt-layout'});
  const main = el('div', {class:'pt-main'});
  const panelEl = el('aside', {class:'pt-panel', hidden:true, 'aria-label':t('tTitle')});
  layout.appendChild(main); layout.appendChild(panelEl);
  root.appendChild(layout);
  const bulkEl = el('div', {class:'pt-bulk', hidden:true});
  const info = el('span', {class:'sub'});
  const tableWrap = el('div', {class:'pt-wrap'});
  let table = null, tbody = null;
  const pendingRefresh = new Set();
  let returnFocusId = null;
  const lifecycle = new MutationObserver(()=>{ if(!layout.isConnected) dispose(); });
  lifecycle.observe(root, {childList:true});

  function dispose(){
    popOverlay(closePanel);
    lifecycle.disconnect();
    window.removeEventListener('resize', onResize);
  }
  function onResize(){ if(!wide() && U.teamPanel) closePanel(); }
  window.addEventListener('resize', onResize);

  const save = ()=>{ commit('data'); paintMeta(); };
  const list = ()=>{
    const q = U.teamSearch.trim().toLowerCase();
    return App.data.people.filter(p=>(U.teamShowRetired || !p.retired) && (!U.teamPoolFilter.length || U.teamPoolFilter.includes(p.pool)) && (!q || (p.name||'').toLowerCase().includes(q)));
  };
  const orderIds = ()=>list().map(p=>p.id);

  function loadText(p, an){
    const assigned = App.plan ? App.plan.visits.filter(v=>visitTeamIds(v).includes(p.id)).length : 0;
    const exp = an && an.expected[p.id]!=null ? an.expected[p.id] : analyzeLoadGuess(p);
    return assigned+' / '+(Math.round(exp*10)/10);
  }

  function cols(){
    const on = g=>U.teamCols[g]!==false;
    const C = [];
    C.push({id:'sel', g:'basic', fixed:true, cls:'pt-c-sel', head:()=>el('input', {type:'checkbox', 'aria-label':t('all'), onchange:e=>{ if(e.target.checked) for(const id of orderIds()) U.teamSel.add(id); else U.teamSel.clear(); paintTable(); }}), cell:p=>el('input', {type:'checkbox', checked:U.teamSel.has(p.id), 'aria-label':p.name, onclick:e=>e.stopPropagation(), onchange:e=>{ if(e.target.checked) U.teamSel.add(p.id); else U.teamSel.delete(p.id); e.target.closest('tr').classList.toggle('sel', e.target.checked); paintBulk(); }})});
    C.push({id:'name', g:'basic', fixed:true, cls:'pt-c-name', label:'ptName', cell:p=>el('div', {class:'pt-namecell'}, [el('button', {type:'button', class:'avatar'+(p.gender==='f' ? ' f' : ''), 'aria-label':t('ptDetails'), onclick:e=>{ e.stopPropagation(); openPanel(p.id); }}, (p.name||'?').slice(0, 1)), el('input', {class:'input sm pt-name', value:p.name||'', placeholder:t('pNewName'), 'aria-label':t('ptName'), onchange:e=>{ p.name = e.target.value.trim(); save(); const av = e.target.previousSibling; if(av) av.textContent = (p.name||'?').slice(0, 1); if(U.teamPanel===p.id) paintPanel(); }})])});
    C.push({id:'pool', g:'basic', fixed:true, cls:'pt-c-pool', label:'ptPool', cell:p=>Select(S().pools.map(pl=>({value:pl.id, label:poolName(pl)})), p.pool, v=>{ p.pool = v; commit('data'); paintTable(); }, {sm:true, width:'120px'})});
    C.push({id:'gender', g:'basic', cls:'pt-c-gender', label:'ptGender', cell:p=>Seg([{value:'m', label:t('pMale')}, {value:'f', label:t('pFemale')}], p.gender||'', v=>{ p.gender = v; save(); refreshRow(p); }, {cls:'sm'})});
    C.push({id:'active', g:'basic', cls:'pt-c-active', label:'ptActive', cell:p=>Switch(p.active!==false, v=>{ p.active = v; save(); refreshRow(p); })});
    C.push({id:'skillB', g:'skills', cls:'pt-c-skill', label:'ptSkillB', cell:p=>Stepper(p.skill.basic, v=>{ p.skill.basic = v; save(); }, {min:0, max:100, step:5, sm:true, label:t('ptSkillB')})});
    C.push({id:'skillC', g:'skills', cls:'pt-c-skill', label:'ptSkillC', cell:p=>Stepper(p.skill.contracted, v=>{ p.skill.contracted = v; save(); }, {min:0, max:100, step:5, sm:true, label:t('ptSkillC')})});
    C.push({id:'quota', g:'plan', cls:'pt-c-quota', label:'ptPerPlan', cell:p=>{
      const label = ()=>quotaLabel(p.quota) || t('pQAuto');
      const chip = ptChip(label(), ()=>{ const box = el('div', {class:'stack', style:{gap:'10px'}}); const paint = ()=>{ clear(box); appendKids(box, ptQuotaEditor(p, ()=>{ save(); chip.textContent = label(); chip.classList.toggle('on', !!quotaLabel(p.quota)); }, paint)); }; paint(); return [box]; }, {on:!!quotaLabel(p.quota), width:340, onClose:()=>flushRow(p)});
      return chip;
    }});
    C.push({id:'share', g:'limits', cls:'pt-c-num', label:'ptShare', cell:p=>Stepper(Math.round((p.share==null ? 1 : p.share)*100), v=>{ p.share = v/100; save(); }, {min:0, max:200, step:10, sm:true, unit:'%'})});
    C.push({id:'maxRun', g:'limits', cls:'pt-c-num', label:'ptMaxRun', cell:p=>el('div', {class:'row', style:{gap:'4px', flexWrap:'nowrap'}}, [Stepper(p.maxRun, v=>{ p.maxRun = v; save(); }, {min:1, max:14, nullable:true, sm:true, placeholder:'—'}), pChip(p, 'maxRun', 'p.maxRun', save)])});
    C.push({id:'maxWeek', g:'limits', cls:'pt-c-num', label:'ptMaxWeek', cell:p=>el('div', {class:'row', style:{gap:'4px', flexWrap:'nowrap'}}, [Stepper(p.maxPerWeek, v=>{ p.maxPerWeek = v; save(); }, {min:1, max:14, nullable:true, sm:true, placeholder:'—'}), pChip(p, 'maxWeek', 'p.maxWeek', save)])});
    C.push({id:'dist', g:'limits', cls:'pt-c-dist', label:'ptDist', cell:p=>el('div', {class:'row', style:{gap:'4px', flexWrap:'nowrap'}}, [Seg([{value:'near', label:t('pDistNear')}, {value:'', label:t('pDistAny')}, {value:'far', label:t('pDistFar')}], p.distPref||'', v=>{ p.distPref = v||null; save(); }, {cls:'sm'}), pChip(p, 'dist', 'p.dist', save)])});
    C.push({id:'avail', g:'avail', cls:'pt-c-avail', label:'ptAvail', cell:p=>{
      const chip = ptChip(availSummary(p), (close, refresh)=>{ const x = personParts(p, {render:refresh, close}, ()=>{ save(); refreshRow(p); }); return [x.availSec]; }, {on:(p.avail||{}).mode && p.avail.mode!=='plan', width:440, onClose:()=>flushRow(p)});
      return chip;
    }});
    C.push({id:'off', g:'avail', cls:'pt-c-off', label:'ptOff', cell:p=>{
      const n = ()=>(p.off||[]).filter(r=>r.to>=todayISO()).length;
      const chip = ptChip(String(n()), (close, refresh)=>{ const x = personParts(p, {render:refresh, close}, ()=>{ save(); refreshRow(p); }); return [x.offSec]; }, {on:n()>0, width:360, onClose:()=>flushRow(p)});
      return chip;
    }});
    C.push({id:'blocked', g:'rules', cls:'pt-c-blocked', label:'ptBlocked', cell:p=>{
      const chip = ptChip(String((p.blocked||[]).length), ()=>[el('div', {class:'field'}, [el('label', null, [t('pBlocked'), pChip(p, 'blocked', 'p.blocked', save)]), FacilityPicker(p.blocked, ids=>{ p.blocked = ids; save(); chip.textContent = String(ids.length); chip.classList.toggle('on', ids.length>0); }, {filter:f=>{ const k = facilityKind(f); return k==='basic' || k==='contracted'; }})])], {on:(p.blocked||[]).length>0, width:400, onClose:()=>flushRow(p)});
      return chip;
    }});
    C.push({id:'rules', g:'rules', cls:'pt-c-rules', label:'ptRules', cell:p=>{
      const n = ptPersonGoals(p).length;
      return ptChip(String(n), (close, refresh)=>{ const x = personParts(p, {render:refresh, close:()=>closePop()}, ()=>{ save(); refreshRow(p); }); return [x.goalsSec]; }, {on:n>0, width:380, onClose:()=>flushRow(p)});
    }});
    C.push({id:'load', g:'plan', cls:'pt-c-load', label:'ptLoad', cell:p=>el('span', {class:'num pt-load', 'data-load':p.id}, loadText(p, null))});
    C.push({id:'menu', g:'basic', fixed:true, cls:'pt-c-menu', cell:p=>{
      const b = el('button', {type:'button', class:'icon-btn sm', 'aria-label':t('ptDetails'), html:ICON.more});
      b.addEventListener('click', e=>{ e.stopPropagation(); menu(b, [
        {label:t('ptDetails'), onClick:()=>openPanel(p.id)},
        {label:t('ptDuplicate'), onClick:()=>{ const c = freshPerson(Object.assign(JSON.parse(JSON.stringify(p)), {id:uid('p'), name:(p.name||'')+t('ptCopySuffix')})); App.data.people.push(c); commit('data'); paintTable(); }},
        {label:p.retired ? t('pRestore') : t('pRetire'), onClick:()=>{ p.retired = !p.retired; commit('data'); paintTable(); }},
        {label:t('pDelete'), danger:true, onClick:()=>confirmDialog(t('pDelete'), t('pDeleteQ'), {danger:true, label:t('del'), onConfirm:()=>{ App.data.people = App.data.people.filter(x=>x!==p); forgetPerson(p.id); U.teamSel.delete(p.id); if(U.teamPanel===p.id) closePanel(); commit('data'); commit('settings'); paintTable(); }})}
      ]); });
      return b;
    }});
    return C.filter(c=>c.fixed || on(c.g));
  }

  const currentAnalysis = ()=>App.plan && !App.plan.stale ? analyzePlan(App.plan) : null;

  function rowFor(p, C, an){
    const tr = el('tr', {class:'pt-row'+(U.teamSel.has(p.id) ? ' sel' : '')+(U.teamPanel===p.id ? ' open' : '')+(p.active===false || p.retired ? ' inactive' : ''), 'data-pid':p.id, 'data-pool':p.pool, tabindex:'0'});
    for(const c of C){
      const td = el('td', {class:c.cls || ''}, c.cell(p));
      if(c.id==='load') td.firstChild.textContent = loadText(p, an);
      tr.appendChild(td);
    }
    tr.addEventListener('click', e=>{ if(e.target.closest('input,button,select,.seg,.switch,.stepper,.chip')) return; openPanel(p.id); });
    return tr;
  }

  function paintTable(){
    const keepX = tableWrap.scrollLeft, keepTop = tableWrap.scrollTop, keepY = window.scrollY;
    clear(tableWrap);
    const people = list();
    const C = cols();
    const an = App.plan && !App.plan.stale ? analyzePlan(App.plan) : null;
    table = el('table', {class:'pt'});
    const thead = el('thead');
    const hr = el('tr');
    for(const c of C) hr.appendChild(el('th', {class:c.cls || ''}, c.head ? c.head() : (c.label ? t(c.label) : '')));
    thead.appendChild(hr);
    table.appendChild(thead);
    tbody = el('tbody');
    let any = false;
    for(const pl of S().pools){
      const members = people.filter(p=>p.pool===pl.id);
      if(!members.length) continue;
      any = true;
      tbody.appendChild(el('tr', {class:'pt-pool'}, el('td', {colSpan:C.length}, el('div', {class:'row', style:{gap:'8px'}}, [el('b', null, poolName(pl)), el('span', {class:'muted'}, t('ptSeats', pl.seats.basic, pl.seats.contracted))]))));
      for(const p of members) tbody.appendChild(rowFor(p, C, an));
    }
    if(!any) tbody.appendChild(el('tr', null, el('td', {colSpan:C.length, class:'empty', id:'team-empty'}, App.data.people.length ? t('ptNoMatch') : t('emptyTeam'))));
    table.appendChild(tbody);
    tbody.addEventListener('keydown', onKey);
    tableWrap.appendChild(table);
    tableWrap.scrollLeft = keepX;
    tableWrap.scrollTop = keepTop;
    paintMeta();
    paintBulk();
    window.scrollTo(0, keepY);
  }

  function paintMeta(){
    info.textContent = t('teamActive', activePeople().length);
    const an = App.plan && !App.plan.stale ? analyzePlan(App.plan) : null;
    for(const n of tableWrap.querySelectorAll('.pt-load')){ const p = personById(n.dataset.load); if(p) n.textContent = loadText(p, an); }
  }

  function onKey(e){
    const row = e.target.closest('tr[data-pid]');
    if(!row) return;
    const tag = e.target.tagName;
    if(e.key==='ArrowDown' || e.key==='ArrowUp'){
      if(tag==='SELECT' || (tag==='INPUT' && e.target.type==='range')) return;
      const rows = [...tbody.querySelectorAll('tr[data-pid]')];
      const next = rows[rows.indexOf(row)+(e.key==='ArrowDown' ? 1 : -1)];
      if(!next) return;
      e.preventDefault();
      next.focus();
      if(U.teamPanel) openPanel(next.dataset.pid);
    } else if(e.key==='ArrowLeft' || e.key==='ArrowRight'){
      if(tag==='INPUT' && e.target.type==='text') return;
      const items = [...row.querySelectorAll('input,button,select')].filter(x=>!x.disabled);
      const i = items.indexOf(e.target);
      const rtl = document.documentElement.dir==='rtl';
      const dir = (e.key==='ArrowRight' ? 1 : -1)*(rtl ? -1 : 1);
      const n = items[i<0 ? (dir>0 ? 0 : items.length-1) : i+dir];
      if(n){ e.preventDefault(); n.focus(); }
    } else if(e.key==='Enter' && e.target===row){
      const inp = row.querySelector('input.pt-name');
      if(inp){ e.preventDefault(); inp.focus(); inp.select(); }
    } else if(e.key==='Escape' && tag==='INPUT' && e.target.classList.contains('pt-name')){
      const p = personById(row.dataset.pid);
      e.target.value = p ? p.name : '';
      e.target.blur();
    }
  }

  function markOpen(){
    for(const r of tbody ? tbody.querySelectorAll('tr[data-pid]') : []) r.classList.toggle('open', r.dataset.pid===U.teamPanel);
  }

  function openPanel(id){
    const p = personById(id);
    if(!p) return;
    if(!wide()){ openPersonSheetNav(p.id, orderIds(), ()=>paintTable()); return; }
    if(U.teamPanel===id){ closePanel(); return; }
    if(!U.teamPanel) returnFocusId = id;
    U.teamPanel = id;
    paintPanel();
    markOpen();
  }
  function closePanel(){
    const id = returnFocusId || U.teamPanel;
    popOverlay(closePanel);
    U.teamPanel = null;
    paintPanel();
    markOpen();
    const row = tbody && [...tbody.querySelectorAll('tr[data-pid]')].find(r=>r.dataset.pid===id);
    if(row && row.isConnected) row.focus({preventScroll:true});
    returnFocusId = null;
  }
  function stepPanel(d){
    const ids = orderIds();
    const i = ids.indexOf(U.teamPanel);
    const n = ids[i+d];
    if(n) openPanel(n);
  }
  function paintPanel(){
    const oldBody = panelEl.querySelector('.pt-panel-body');
    const keepScroll = oldBody ? oldBody.scrollTop : 0;
    clear(panelEl);
    const p = U.teamPanel ? personById(U.teamPanel) : null;
    panelEl.hidden = !p;
    layout.classList.toggle('with-panel', !!p);
    popOverlay(closePanel);
    if(!p) return;
    pushOverlay(closePanel);
    const ids = orderIds();
    const i = ids.indexOf(p.id);
    const api = {render:paintPanel, close:closePanel};
    panelEl.appendChild(el('header', {class:'pt-panel-head'}, [
      el('button', {type:'button', class:'icon-btn sm pt-prev', 'aria-label':t('ptPrev'), disabled:i<=0, html:document.documentElement.dir==='rtl' ? ICON.right : ICON.left, onclick:()=>stepPanel(-1)}),
      el('button', {type:'button', class:'icon-btn sm pt-next', 'aria-label':t('ptNext'), disabled:i<0 || i>=ids.length-1, html:document.documentElement.dir==='rtl' ? ICON.left : ICON.right, onclick:()=>stepPanel(1)}),
      el('div', {style:{flex:'1', minWidth:'0'}}, [el('h2', null, p.name || t('tAdd')), el('div', {class:'sub'}, poolName(poolById(p.pool)))]),
      el('button', {type:'button', class:'icon-btn sm', 'aria-label':t('ptClosePanel'), html:ICON.x, onclick:closePanel})
    ]));
    const body = el('div', {class:'pt-panel-body'});
    appendKids(body, personEditor(p, api, ()=>{ commit('data'); refreshRow(p); }));
    panelEl.appendChild(body);
    body.scrollTop = keepScroll;
  }
  function flushRow(p){
    if(pendingRefresh.has(p.id)) refreshRow(p);
  }
  function refreshRow(p){
    const tr = tbody && [...tbody.querySelectorAll('tr[data-pid]')].find(r=>r.dataset.pid===p.id);
    if(!tr) return;
    if(popStack.some(pop=>tr.contains(pop.anchor))){
      pendingRefresh.add(p.id);
      const update = (cls, text, on)=>{
        const chip = tr.querySelector(cls+' button.pt-chip');
        if(chip){ chip.textContent = text; chip.classList.toggle('on', !!on); }
      };
      update('.pt-c-avail', availSummary(p), p.avail.mode!=='plan');
      const off = (p.off||[]).filter(r=>r.to>=todayISO()).length;
      update('.pt-c-off', String(off), off>0);
      paintMeta();
      return;
    }
    pendingRefresh.delete(p.id);
    const focusable = row=>[...row.querySelectorAll('input,button,select,textarea,[tabindex]')].filter(n=>!n.disabled);
    const active = document.activeElement;
    const hadFocus = tr.contains(active);
    const index = hadFocus ? focusable(tr).indexOf(active) : -1;
    let next;
    if(tr.dataset.pool!==p.pool){
      paintTable();
      next = [...tbody.querySelectorAll('tr[data-pid]')].find(r=>r.dataset.pid===p.id);
    } else {
      next = rowFor(p, cols(), currentAnalysis());
      tr.replaceWith(next);
    }
    if(hadFocus && next) (focusable(next)[index] || next).focus({preventScroll:true});
    paintMeta();
  }

  function bulk(fn){
    const ids = [...U.teamSel];
    if(!ids.length) return;
    const snap = JSON.stringify(App.data.people);
    for(const id of ids){ const p = personById(id); if(p) fn(p); }
    commit('data');
    paintTable();
    toast(t('ptBulkDone', ids.length), {label:t('ptUndo'), onClick:()=>{ App.data.people = JSON.parse(snap).map(freshPerson); commit('data'); paintTable(); }});
  }

  function paintBulk(){
    clear(bulkEl);
    const n = U.teamSel.size;
    bulkEl.hidden = !n;
    if(!n) return;
    const pop = (label, build)=>{ const b = el('button', {type:'button', class:'btn sm outline'}, label); b.addEventListener('click', ()=>popover(b, build, {width:300})); return b; };
    const men = (label, items)=>{ const b = el('button', {type:'button', class:'btn sm outline'}, label); b.addEventListener('click', ()=>menu(b, items)); return b; };
    const stepperPop = (label, min, max, step, apply, nullable)=>pop(label, ()=>{ let val = nullable ? null : min; return [el('div', {class:'pop-title'}, label), Stepper(val, v=>{ val = v; }, {min, max, step, nullable:!!nullable, sm:true}), el('button', {type:'button', class:'btn sm primary', style:{marginTop:'10px'}, onclick:()=>{ closePop(); bulk(p=>apply(p, val)); }}, t('ptApply'))]; });
    const fieldLevels = [['quota', 'p.quota'], ['maxRun', 'p.maxRun'], ['maxWeek', 'p.maxWeek'], ['dist', 'p.dist'], ['blocked', 'p.blocked'], ['avail', 'p.avail'], ['rest', 'p.rest']];
    appendKids(bulkEl, [
      el('b', null, t('ptSelected', n)),
      men(t('ptSetPool'), S().pools.map(pl=>({label:poolName(pl), onClick:()=>bulk(p=>{ p.pool = pl.id; })}))),
      el('button', {type:'button', class:'btn sm outline', onclick:()=>bulk(p=>{ p.active = true; })}, t('ptActiveOn')),
      el('button', {type:'button', class:'btn sm outline', onclick:()=>bulk(p=>{ p.active = false; })}, t('ptActiveOff')),
      men(t('ptSetGender'), [{label:t('pMale'), onClick:()=>bulk(p=>{ p.gender = 'm'; })}, {label:t('pFemale'), onClick:()=>bulk(p=>{ p.gender = 'f'; })}]),
      stepperPop(t('ptSkillB'), 0, 100, 5, (p, v)=>{ p.skill.basic = v; }),
      stepperPop(t('ptSkillC'), 0, 100, 5, (p, v)=>{ p.skill.contracted = v; }),
      men(t('ptSetPerPlan'), [{label:t('pQAuto'), onClick:()=>bulk(p=>{ p.quota = {min:null, max:null}; })}, {label:t('pQExact')+' 2', onClick:()=>bulk(p=>{ p.quota = {min:2, max:2}; })}, {label:t('pQRange')+' 1–3', onClick:()=>bulk(p=>{ p.quota = {min:1, max:3}; })}]),
      stepperPop(t('ptSetShare')+' %', 0, 200, 10, (p, v)=>{ p.share = v/100; }),
      stepperPop(t('ptSetMaxRun'), 1, 14, 1, (p, v)=>{ p.maxRun = v; }, true),
      stepperPop(t('ptSetMaxWeek'), 1, 14, 1, (p, v)=>{ p.maxPerWeek = v; }, true),
      men(t('ptSetDist'), [{label:t('pDistNear'), onClick:()=>bulk(p=>{ p.distPref = 'near'; })}, {label:t('pDistAny'), onClick:()=>bulk(p=>{ p.distPref = null; })}, {label:t('pDistFar'), onClick:()=>bulk(p=>{ p.distPref = 'far'; })}]),
      pop(t('ptSetLevel'), ()=>{ let field = fieldLevels[0]; let lv = null; const sel = Select(fieldLevels.map((f, i)=>({value:String(i), label:t('rn_'+f[1])})), '0', v=>{ field = fieldLevels[+v]; }, {sm:true}); const chip = LevelChip(personLvOf(personById([...U.teamSel][0]))[fieldLevels[0][0]], 'p.quota', v=>{ lv = v; }, {sm:true}); return [el('div', {class:'pop-title'}, t('ptSetLevel')), sel, el('div', {style:{marginTop:'8px'}}, chip), el('button', {type:'button', class:'btn sm primary', style:{marginTop:'10px'}, onclick:()=>{ closePop(); if(lv) bulk(p=>{ p.lv = Object.assign(personLvOf(p), {[field[0]]:lv}); }); }}, t('ptApply'))]; }),
      pop(t('ptAddOff'), ()=>{ let from = todayISO(), to = todayISO(); return [el('div', {class:'pop-title'}, t('ptAddOff')), el('div', {class:'grid-2'}, [el('div', {class:'field'}, [el('label', null, t('ptFrom')), DateInput(from, v=>{ from = v; if(to<from) to = v; })]), el('div', {class:'field'}, [el('label', null, t('ptTo')), DateInput(to, v=>{ to = v; })])]), el('button', {type:'button', class:'btn sm primary', style:{marginTop:'10px'}, onclick:()=>{ closePop(); bulk(p=>{ p.off = normalizeOff((p.off||[]).concat([{from, to:to<from ? from : to}])); }); }}, t('ptApply'))]; }),
      pop(t('ptAddBlocked'), ()=>{ let ids = []; return [el('div', {class:'pop-title'}, t('ptAddBlocked')), FacilityPicker(ids, v=>{ ids = v; }, {filter:f=>{ const k = facilityKind(f); return k==='basic' || k==='contracted'; }}), el('button', {type:'button', class:'btn sm primary', style:{marginTop:'10px'}, onclick:()=>{ closePop(); bulk(p=>{ p.blocked = [...new Set((p.blocked||[]).concat(ids))]; }); }}, t('ptApply'))]; }),
      el('button', {type:'button', class:'btn sm outline', onclick:()=>bulk(p=>{ p.retired = true; })}, t('pRetire')),
      el('div', {class:'spacer'}),
      el('button', {type:'button', class:'btn sm ghost', onclick:()=>{ U.teamSel.clear(); paintTable(); }}, t('clear'))
    ]);
  }

  function toolbar(){
    const search = el('input', {class:'input sm pt-search', type:'search', value:U.teamSearch, placeholder:t('ptSearch'), 'aria-label':t('ptSearch'), oninput:e=>{ U.teamSearch = e.target.value; paintTable(); }});
    const poolChips = el('div', {class:'chips'}, S().pools.map(pl=>el('button', {type:'button', class:'chip'+(U.teamPoolFilter.includes(pl.id) ? ' on' : ''), onclick:e=>{ const i = U.teamPoolFilter.indexOf(pl.id); if(i>=0) U.teamPoolFilter.splice(i, 1); else U.teamPoolFilter.push(pl.id); e.currentTarget.classList.toggle('on', i<0); paintTable(); }}, poolName(pl))));
    const colBtn = el('button', {type:'button', class:'btn sm outline'}, t('ptColumns'));
    colBtn.addEventListener('click', ()=>popover(colBtn, ()=>[el('div', {class:'pop-title'}, t('ptColumns')), el('div', {class:'stack', style:{gap:'8px'}}, PT_GROUPS.filter(g=>g!=='basic').map(g=>el('label', {class:'row', style:{gap:'8px'}}, [Switch(U.teamCols[g]!==false, v=>{ U.teamCols[g] = v; paintTable(); }), t('ptg'+g[0].toUpperCase()+g.slice(1))])))], {width:260}));
    const ret = el('label', {class:'row', style:{gap:'6px'}}, [Switch(!!U.teamShowRetired, v=>{ U.teamShowRetired = v; paintTable(); }), el('span', null, t('ptShowRetired'))]);
    const add = el('button', {type:'button', class:'btn primary sm', onclick:()=>{ const p = freshPerson({name:'', pool:S().pools[0].id, origin:locIdFor('دمنهور')}); openPerson(null, p, ()=>paintTable()); }}, [el('span', {html:ICON.plus, style:{display:'flex'}}), t('tAdd')]);
    return el('div', {class:'pt-toolbar'}, [search, poolChips, el('div', {class:'spacer'}), ret, colBtn, add]);
  }

  const card = el('section', {class:'card pt-card', id:'team-card'});
  card.appendChild(el('div', {class:'card-head'}, [el('h2', null, t('tTitle')), info]));
  card.appendChild(toolbar());
  card.appendChild(bulkEl);
  card.appendChild(tableWrap);
  main.appendChild(card);
  main.appendChild(renderPoolsCard(()=>renderTab()));
  paintTable();
  paintPanel();
  renderTeam.api = {openPanel, closePanel, stepPanel, paintTable, refreshRow, orderIds, bulk, dispose};
}

function openPersonSheetNav(id, order, rerender){
  const p = personById(id);
  if(!p) return;
  const i = order.indexOf(id);
  const go = d=>{ const n = order[i+d]; if(n) openPersonSheetNav(n, order, rerender); };
  sheet({
    title:()=>p.name || t('tAdd'),
    sub:()=>[el('span', {class:'tag'}, poolName(poolById(p.pool)))],
    headActions:api=>[
      el('button', {type:'button', class:'icon-btn sm', 'aria-label':t('ptPrev'), disabled:i<=0, html:document.documentElement.dir==='rtl' ? ICON.right : ICON.left, onclick:()=>go(-1)}),
      el('button', {type:'button', class:'icon-btn sm', 'aria-label':t('ptNext'), disabled:i<0 || i>=order.length-1, html:document.documentElement.dir==='rtl' ? ICON.left : ICON.right, onclick:()=>go(1)})
    ],
    body:api=>personEditor(p, api, ()=>{ commit('data'); if(rerender) rerender(); }),
    onClose:()=>{ if(rerender) rerender(); }
  });
}
